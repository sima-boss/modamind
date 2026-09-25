import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/service";

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
    "Clean lines, effortless confidence, and styling that works all day. #Fashnix #SmartStyle #OutfitInspo",
};

export async function POST(req: NextRequest) {
  const supabase = createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const userId = user.id;

  const { items } = await req.json();

  if (!Array.isArray(items) || items.length === 0) {
    return NextResponse.json(
      { error: "items array is required" },
      { status: 400 }
    );
  }

  const service = createServiceRoleClient();
  const { data: consumed, error: consumeErr } = await service.rpc(
    "consume_usage_credits",
    { p_user_id: userId, p_type: "ai_caption", p_count: 1 }
  );

  if (consumeErr) {
    if (consumeErr.message.includes("limit_reached")) {
      return NextResponse.json(
        { error: "You've used all your AI captions for this period." },
        { status: 403 }
      );
    }
    return NextResponse.json({ error: consumeErr.message }, { status: 400 });
  }

  const { from_monthly, from_extra } = consumed[0];
  async function refund() {
    await service.rpc("refund_usage_credits", {
      p_user_id: userId,
      p_type: "ai_caption",
      p_from_monthly: from_monthly,
      p_from_extra: from_extra,
    });
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
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) throw new Error("No API key");

    const userMessage = `Generate marketing content for this outfit:\n\n${itemDescriptions}`;

    // Call Anthropic API directly via fetch to avoid SDK base64 conversion bug
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-5",
        max_tokens: 512,
        system: SYSTEM_PROMPT,
        messages: [{ role: "user", content: userMessage }],
      }),
    });

    const data = await response.json();
    if (!response.ok) throw new Error(data?.error?.message ?? "API error");

    const textBlock = data.content?.find(
      (b: { type: string }) => b.type === "text"
    );
    if (!textBlock) throw new Error("Empty AI response");

    const raw = (textBlock.text as string)
      .replace(/```json?\n?|```/g, "")
      .trim();
    const content = JSON.parse(raw);

    return NextResponse.json({ content, fallback: false });
  } catch (err: unknown) {
    console.warn(
      "[outfit-content] AI call failed, using fallback:",
      err instanceof Error ? err.message : err
    );
    await refund();
    return NextResponse.json({ content: FALLBACK_CONTENT, fallback: true });
  }
}
