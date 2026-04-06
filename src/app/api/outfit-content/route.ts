import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const SYSTEM_PROMPT = `You are a fashion marketing copywriter. Given an outfit's items and their style attributes, return a JSON object with exactly these fields:

{
  "description": "string",      // 2-3 sentence paragraph describing the outfit
  "styling_tips": ["string"],   // exactly 3 short, actionable styling tips
  "social_caption": "string"    // Instagram-ready caption with 2-3 hashtags
}

Keep the tone modern, confident, and concise.
Return ONLY valid JSON. No markdown, no explanation.`;

const FALLBACK_CONTENT = {
  description:
    "A polished, balanced outfit designed for a clean and confident everyday look.",
  styling_tips: [
    "Keep accessories minimal for a refined finish.",
    "Use neutral footwear and layering pieces for better versatility.",
    "Stick to a coordinated color palette for a sharper appearance.",
  ],
  social_caption:
    "Clean lines, effortless confidence, and styling that works all day. #ModaMind #SmartStyle #OutfitInspo",
};

export async function POST(req: NextRequest) {
  const { items } = await req.json();

  if (!Array.isArray(items) || items.length === 0) {
    return NextResponse.json(
      { error: "items array is required" },
      { status: 400 }
    );
  }

  // Build a concise text description of the outfit for Claude
  const itemDescriptions = items
    .map((item: Record<string, unknown>) => {
      const attrs = item.attributes as Record<string, unknown> | undefined;
      const parts = [`- ${item.role}: ${item.name} (${item.category})`];
      if (attrs) {
        if (attrs.clothing_type) parts.push(`  Type: ${attrs.clothing_type}`);
        if (attrs.formality) parts.push(`  Formality: ${attrs.formality}`);
        if (attrs.season) parts.push(`  Season: ${attrs.season}`);
        if (Array.isArray(attrs.dominant_colors))
          parts.push(
            `  Colors: ${(attrs.dominant_colors as string[]).join(", ")}`
          );
        if (Array.isArray(attrs.style_tags))
          parts.push(
            `  Style: ${(attrs.style_tags as string[]).join(", ")}`
          );
      }
      return parts.join("\n");
    })
    .join("\n\n");

  // Attempt AI generation — fall back gracefully on any failure
  try {
    if (!process.env.ANTHROPIC_API_KEY) throw new Error("No API key");

    const userMessage = `Generate marketing content for this outfit:\n\n${itemDescriptions}`;

    const message = await client.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 512,
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: userMessage }],
    });

    const textBlock = message.content.find((b) => b.type === "text");
    if (!textBlock || textBlock.type !== "text") throw new Error("Empty AI response");

    const raw = textBlock.text.replace(/```json?\n?|```/g, "").trim();
    const content = JSON.parse(raw);

    return NextResponse.json({ content, fallback: false });
  } catch (err: unknown) {
    console.warn(
      "[outfit-content] AI call failed, using fallback:",
      err instanceof Error ? err.message : err
    );
    return NextResponse.json({ content: FALLBACK_CONTENT, fallback: true });
  }
}
