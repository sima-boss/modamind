/**
 * Mood-board helpers — replaces the broken Pollinations.ai virtual-model
 * feature with a pure-CSS collage that uses the outfit's actual product
 * images, themed to the outfit's style. No external API required.
 */

/* ------------------------------------------------------------------ */
/*  Theme → gradient map                                               */
/* ------------------------------------------------------------------ */

const THEME_GRADIENTS: Record<string, string> = {
  "Casual Everyday":
    "linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%)",
  "Business Professional":
    "linear-gradient(135deg, #2c3e50 0%, #4ca1af 100%)",
  "Date Night":
    "linear-gradient(135deg, #614385 0%, #516395 100%)",
  "Streetwear":
    "linear-gradient(135deg, #232526 0%, #414345 100%)",
  "Athleisure":
    "linear-gradient(135deg, #11998e 0%, #38ef7d 100%)",
  "Vacation / Resort":
    "linear-gradient(135deg, #f7971e 0%, #ffd200 100%)",
  "Minimalist Chic":
    "linear-gradient(135deg, #ece9e6 0%, #ffffff 100%)",
  "Evening / Formal":
    "linear-gradient(135deg, #0f0c29 0%, #302b63 50%, #24243e 100%)",
  "Smart Casual":
    "linear-gradient(135deg, #667db6 0%, #0082c8 50%, #667db6 100%)",
  "Bohemian":
    "linear-gradient(135deg, #c94b4b 0%, #4b134f 100%)",
};

const DEFAULT_GRADIENT =
  "linear-gradient(135deg, #667eea 0%, #764ba2 100%)";

export function getThemeGradient(theme?: string | null): string {
  if (!theme) return DEFAULT_GRADIENT;
  return THEME_GRADIENTS[theme] ?? DEFAULT_GRADIENT;
}

/**
 * Returns a foreground colour that contrasts with the theme gradient.
 */
const DARK_THEMES = new Set([
  "Business Professional",
  "Date Night",
  "Streetwear",
  "Evening / Formal",
  "Smart Casual",
  "Bohemian",
]);

export function getThemeTextColor(theme?: string | null): string {
  if (!theme) return "#ffffff";
  return DARK_THEMES.has(theme) ? "#ffffff" : "#1a1a2e";
}

/* ------------------------------------------------------------------ */
/*  Item input (kept for backward-compatibility)                       */
/* ------------------------------------------------------------------ */

export interface VirtualModelItemInput {
  role: string;
  name: string;
  colors?: string[];
  style?: string[];
  imageUrl?: string | null;
}
