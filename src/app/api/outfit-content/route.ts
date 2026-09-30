import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/service";
import { generateContentSchema } from "@/lib/validation/outfits";
import {
  PlanGateError,
  canUseCaptionFormat,
  canUseCaptionLanguage,
  requireSubscription,
  type CaptionFormat,
  type CaptionLanguage,
} from "@/lib/plan-gate";

const FORMAT_GUIDANCE: Record<CaptionFormat, string> = {
  generic:
    "a plain, platform-neutral caption with no hashtags — suitable for any use",
  instagram:
    "an Instagram-ready caption with 2-3 relevant hashtags at the end",
  tiktok:
    "a punchy, trend-aware TikTok caption (short, hook-first) with 2-3 relevant hashtags at the end",
};

const LANGUAGE_GUIDANCE: Record<CaptionLanguage, string> = {
  en: "Write everything in English.",
  ar: "Write everything in Arabic, using a natural Gulf (Khaleeji) dialect — not Modern Standard Arabic.",
};

function buildSystemPrompt(language: CaptionLanguage, format: CaptionFormat): string {
  return `You are a fashion marketing copywriter. Given an outfit's items and their style attributes, return a JSON object with exactly these fields:

{
  "description": "string",      // 2-3 sentence paragraph describing the outfit
  "styling_tips": ["string"],   // exactly 3 short, actionable styling tips
  "social_caption": "string"    // ${FORMAT_GUIDANCE[format]}
}

${LANGUAGE_GUIDANCE[language]}
Keep the tone modern, confident, and concise.
Return ONLY valid JSON. No markdown, no explanation.`;
}

const FALLBACK_CONTENT: Record<CaptionLanguage, { description: string; styling_tips: string[]; social_caption: string }> = {
  en: {
    description:
      "A polished, balanced outfit designed for a clean and confident everyday look.",
    styling_tips: [
      "Keep accessories minimal for a refined finish.",
      "Use neutral footwear and layering pieces for better versatility.",
      "Stick to a coordinated color palette for a sharper appearance.",
    ],
    social_caption:
      "Clean lines, effortless confidence, and styling that works all day. #Fashnix #SmartStyle #OutfitInspo",
  },
  ar: {
    description:
      "إطلالة أنيقة ومتوازنة، مصممة لتمنحك مظهراً يومياً نظيفاً وواثقاً.",
    styling_tips: [
      "حافظ على الإكسسوارات البسيطة للحصول على لمسة نهائية راقية.",
      "استخدم أحذية بألوان محايدة وقطع طبقات لمزيد من التنوع.",
      "التزم بلوحة ألوان متناسقة لمظهر أكثر تميزاً.",
    ],
    social_caption:
      "أناقة بسيطة وثقة بلا حدود، ستايل يناسبك طول يومك ✨ #Fashnix #ستايل",
  },
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

  const parsed = generateContentSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
  const { items, language, format } = parsed.data;

  // Language + caption format are plan-gated — checked against the
  // caller's real subscription, never a client-sent tier.
  try {
    const subscription = await requireSubscription(supabase);
    if (!canUseCaptionLanguage(subscription.plan, language)) {
      return NextResponse.json(
        { error: "Arabic captions are a Standard+ feature. Upgrade to unlock." },
        { status: 403 }
      );
    }
    if (!canUseCaptionFormat(subscription.plan, format)) {
      return NextResponse.json(
        {
          error:
            "Instagram/TikTok caption formats are a Standard+ feature. Upgrade to unlock.",
        },
        { status: 403 }
      );
    }
  } catch (err) {
    if (err instanceof PlanGateError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    throw err;
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
        system: buildSystemPrompt(language, format),
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

    return NextResponse.json({ content, language, format, fallback: false });
  } catch (err: unknown) {
    console.warn(
      "[outfit-content] AI call failed, using fallback:",
      err instanceof Error ? err.message : err
    );
    await refund();
    return NextResponse.json({
      content: FALLBACK_CONTENT[language],
      language,
      format,
      fallback: true,
    });
  }
}
