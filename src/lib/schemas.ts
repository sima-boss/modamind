import { z } from "zod";

export const CATEGORIES = [
  "tops",
  "bottoms",
  "dresses",
  "outerwear",
  "shoes",
  "bags",
  "accessories",
] as const;

export type Category = (typeof CATEGORIES)[number];

export const productSchema = z.object({
  name: z.string().min(1, "Product name is required").max(120),
  category: z.enum(CATEGORIES, {
    message: "Please select a category",
  }),
  price: z
    .number({ message: "Price must be a number" })
    .positive("Price must be greater than 0"),
});

export type ProductFormValues = z.infer<typeof productSchema>;
