import { z } from "zod";
import { MAX_BULK_OUTFITS } from "@/lib/plan-gate";

export const generateOutfitsSchema = z.object({
  count: z.number().int().min(1).max(MAX_BULK_OUTFITS),
  selectedThemes: z.array(z.string()).min(1),
});

export const generateContentSchema = z.object({
  items: z.array(z.record(z.string(), z.unknown())).min(1),
  language: z.enum(["en", "ar"]).default("en"),
  format: z.enum(["generic", "instagram", "tiktok"]).default("generic"),
});
