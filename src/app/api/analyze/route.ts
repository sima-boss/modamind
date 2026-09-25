import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import sharp from "sharp";
import { createServerSupabaseClient } from "@/lib/supabase/server";

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

    const { imageUrl } = await req.json();

    if (!imageUrl || typeof imageUrl !== "string") {
      return NextResponse.json(
        { error: "imageUrl is required" },
        { status: 400 }
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
    const imageRes = await fetch(imageUrl);
    if (!imageRes.ok) {
      return NextResponse.json(
        {
          error: `Could not fetch the image (HTTP ${imageRes.status}). The image URL may be invalid or inaccessible.`,
        },
        { status: 502 }
      );
    }

    const fetchedBuffer = Buffer.from(await imageRes.arrayBuffer());
    const fetchedMediaType = imageRes.headers.get("content-type")?.split(";")[0];

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
      model: "claude-sonnet-5",
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
      return NextResponse.json(
        { error: "No text response from AI" },
        { status: 502 }
      );
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
