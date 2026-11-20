import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import sharp from "sharp";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getAnthropicModel } from "@/lib/ai-config";
import {
  ImageFetchError,
  fetchImageWithLimits,
  isAllowedImageUrl,
} from "@/lib/image-fetch";
import { createCooldownLimiter } from "@/lib/rate-limit";

// Max 1 analysis per user+product per 30s. In-memory (per server instance).
const analyzeLimiter = createCooldownLimiter(30_000);

const SYSTEM_PROMPT = `You are a fashion product analyst. Given a product image, return a JSON object with these exact fields:

{
  "dominant_colors": ["string"],   // 2-4 main colors, e.g. ["navy", "white"]
  "pattern": "string",             // e.g. "solid", "striped", "floral", "plaid", "abstract"
  "formality": "casual | smart-casual | formal",
  "style_tags": ["string"],        // 3-6 tags, e.g. ["minimalist", "classic", "elegant"]
  "season": "spring | summer | autumn | winter | all-season",
  "clothing_type": "string"        // e.g. "midi dress", "sneakers", "tote bag"
}

Return ONLY valid JSON. No markdown, no explanation.`;

// Claude's vision API only accepts these four image formats.
const SUPPORTED_MEDIA_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
]);
type SupportedMediaType = "image/jpeg" | "image/png" | "image/gif" | "image/webp";

export async function POST(req: NextRequest) {
  try {
    const supabase = createServerSupabaseClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const productId: unknown = body?.productId;
    const force = body?.force === true;

    if (!productId || typeof productId !== "string") {
      return NextResponse.json({ error: "productId is required" }, { status: 400 });
    }

    // Load via the user's client so RLS guarantees they own the product. The
    // image URL comes from the DB, never from the request body.
    const { data: product, error: productError } = await supabase
      .from("products")
      .select("id, image_url, product_attributes(id)")
      .eq("id", productId)
      .maybeSingle();

    if (productError || !product) {
      return NextResponse.json({ error: "Product not found" }, { status: 404 });
    }

    const imageUrl = product.image_url;
    if (!imageUrl) {
      return NextResponse.json({ error: "Product has no image" }, { status: 400 });
    }

    const existingAttrs = (product as { product_attributes?: unknown[] })
      .product_attributes;
    if (!force && Array.isArray(existingAttrs) && existingAttrs.length > 0) {
      return NextResponse.json({ error: "Product already analyzed" }, { status: 409 });
    }

    if (!isAllowedImageUrl(imageUrl, process.env.NEXT_PUBLIC_SUPABASE_URL)) {
      return NextResponse.json({ error: "Image URL is not allowed" }, { status: 400 });
    }

    const limit = analyzeLimiter.check(`${user.id}:${product.id}`);
    if (!limit.ok) {
      return NextResponse.json(
        {
          error: `Please wait ${limit.retryAfterSec}s before analyzing this product again.`,
        },
        {
          status: 429,
          headers: { "Retry-After": String(limit.retryAfterSec) },
        }
      );
    }

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: "ANTHROPIC_API_KEY is not configured" },
        { status: 500 }
      );
    }

    // Fetch the image ourselves instead of handing Claude a bare URL. Product
    // images are sometimes stored as AVIF (or another format the upload file
    // picker allowed) — Claude's vision API rejects anything outside
    // JPEG/PNG/GIF/WEBP with "The file format is invalid or unsupported", so
    // normalize to PNG whenever the source format isn't one of those four.
    let fetchedBuffer: Buffer;
    let fetchedMediaType: string | null;
    try {
      const fetched = await fetchImageWithLimits(imageUrl);
      fetchedBuffer = fetched.buffer;
      fetchedMediaType = fetched.contentType;
    } catch (err) {
      if (err instanceof ImageFetchError) {
        return NextResponse.json({ error: err.message }, { status: err.status });
      }
      throw err;
    }

    let mediaType: SupportedMediaType;
    let imageData: Buffer;
    if (fetchedMediaType && SUPPORTED_MEDIA_TYPES.has(fetchedMediaType)) {
      mediaType = fetchedMediaType as SupportedMediaType;
      imageData = fetchedBuffer;
    } else {
      imageData = await sharp(fetchedBuffer).png().toBuffer();
      mediaType = "image/png";
    }

    const client = new Anthropic({ apiKey });

    const response = await client.messages.create({
      model: getAnthropicModel(),
      max_tokens: 512,
      system: SYSTEM_PROMPT,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "image",
              source: {
                type: "base64",
                media_type: mediaType,
                data: imageData.toString("base64"),
              },
            },
            {
              type: "text",
              text: "Analyze this fashion product image and return the JSON as specified.",
            },
          ],
        },
      ],
    });

    const textBlock = response.content.find((b) => b.type === "text");
    if (!textBlock) {
      return NextResponse.json({ error: "No text response from AI" }, { status: 502 });
    }

    // Parse JSON — strip possible markdown fences
    const raw = textBlock.text.replace(/```json?\n?|```/g, "").trim();
    const attributes = JSON.parse(raw);

    return NextResponse.json({ attributes });
  } catch (err: unknown) {
    console.error("[analyze]", err);

    let errorMessage = "AI analysis failed";
    let status = 500;

    if (err instanceof Anthropic.AuthenticationError) {
      errorMessage = "API key is invalid or expired.";
      status = err.status ?? 401;
    } else if (err instanceof Anthropic.RateLimitError) {
      errorMessage = "Rate limit reached. Please wait a moment and try again.";
      status = err.status ?? 429;
    } else if (err instanceof Anthropic.BadRequestError) {
      errorMessage =
        "Could not process image. The image may be corrupted or in an unsupported format.";
      status = err.status ?? 400;
    } else if (err instanceof Anthropic.APIError) {
      errorMessage = err.message;
      status = err.status ?? 500;
    } else if (err instanceof Error) {
      errorMessage = err.message;
    }

    return NextResponse.json({ error: errorMessage }, { status });
  }
}
