import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

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

export async function POST(req: NextRequest) {
  try {
    const { imageUrl } = await req.json();

    if (!imageUrl || typeof imageUrl !== "string") {
      return NextResponse.json(
        { error: "imageUrl is required" },
        { status: 400 }
      );
    }

    if (!process.env.ANTHROPIC_API_KEY) {
      return NextResponse.json(
        { error: "ANTHROPIC_API_KEY is not configured" },
        { status: 500 }
      );
    }

    const message = await client.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 512,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "image",
              source: { type: "url", url: imageUrl },
            },
            {
              type: "text",
              text: "Analyze this fashion product image and return the JSON as specified.",
            },
          ],
        },
      ],
      system: SYSTEM_PROMPT,
    });

    // Extract the text block from the response
    const textBlock = message.content.find((b) => b.type === "text");
    if (!textBlock || textBlock.type !== "text") {
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
    const message =
      err instanceof Error ? err.message : "AI analysis failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
