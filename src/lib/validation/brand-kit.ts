import { z } from "zod";

const hexColor = z
  .string()
  .regex(/^#[0-9a-fA-F]{6}$/, "Must be a hex color")
  .nullable();

export const brandKitSchema = z.object({
  brand_logo_url: z.string().url().nullable(),
  brand_primary_color: hexColor,
  brand_secondary_color: hexColor,
});
