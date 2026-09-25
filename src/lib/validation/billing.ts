import { z } from "zod";

export const planChangeSchema = z.object({
  plan_id: z.enum(["basic", "standard", "premium"]),
});

export const topupSchema = z.object({
  package: z.enum(["small", "medium", "large"]),
});
