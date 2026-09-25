import { z } from "zod";

export const generateOutfitsSchema = z.object({
  count: z.number().int().min(1).max(5),
  selectedThemes: z.array(z.string()).min(1),
});
