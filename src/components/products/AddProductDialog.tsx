"use client";

import { useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { ImagePlus, Loader2, Plus, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

import {
  CATEGORIES,
  productSchema,
  type ProductFormValues,
} from "@/lib/schemas";
import { createClient } from "@/lib/supabase/client";
import { insertProduct, insertProductAttributes } from "@/lib/supabase/queries";

interface AddProductDialogProps {
  onProductAdded: () => void;
}

export function AddProductDialog({ onProductAdded }: AddProductDialogProps) {
  const [open, setOpen] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [step, setStep] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<ProductFormValues>({
    resolver: zodResolver(productSchema),
    defaultValues: { name: "", category: undefined, price: undefined },
  });

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0] ?? null;
    setImageFile(file);
    if (file) {
      const url = URL.createObjectURL(file);
      setImagePreview(url);
    } else {
      setImagePreview(null);
    }
  }

  function clearImage() {
    setImageFile(null);
    setImagePreview(null);
    if (fileRef.current) fileRef.current.value = "";
  }

  function resetAll() {
    reset();
    clearImage();
    setSubmitError(null);
    setStep(null);
  }

  async function onSubmit(values: ProductFormValues) {
    setSubmitError(null);
    const supabase = createClient();

    try {
      let imageUrl: string | null = null;

      // 1. Upload image to Supabase Storage (if provided)
      if (imageFile) {
        setStep("Uploading image...");
        const ext = imageFile.name.split(".").pop() ?? "jpg";
        const path = `${crypto.randomUUID()}.${ext}`;

        const { error: uploadErr } = await supabase.storage
          .from("product-images")
          .upload(path, imageFile, { contentType: imageFile.type });

        if (uploadErr) throw new Error(`Image upload failed: ${uploadErr.message}`);

        const { data: urlData } = supabase.storage
          .from("product-images")
          .getPublicUrl(path);

        imageUrl = urlData.publicUrl;
      }

      // 2. Insert product row
      setStep("Saving product...");
      const product = await insertProduct(supabase, {
        name: values.name,
        category: values.category,
        price: values.price,
        image_url: imageUrl,
      });

      // 3. AI analysis (only if image was uploaded)
      if (imageUrl) {
        setStep("Analyzing with AI...");
        try {
          const res = await fetch("/api/analyze", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ imageUrl }),
          });

          if (res.ok) {
            const { attributes } = await res.json();
            await insertProductAttributes(supabase, {
              product_id: product.id,
              dominant_colors: attributes.dominant_colors,
              pattern: attributes.pattern,
              formality: attributes.formality,
              style_tags: attributes.style_tags,
              season: attributes.season,
              clothing_type: attributes.clothing_type,
              raw_ai_json: attributes,
            });
          } else {
            const body = await res.json().catch(() => ({}));
            console.warn("[AI] Analysis failed, product saved without attributes:", body.error);
          }
        } catch (aiErr) {
          // Product is already saved — AI failure is non-fatal
          console.warn("[AI] Analysis error:", aiErr);
        }
      }

      resetAll();
      setOpen(false);
      onProductAdded();
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Failed to add product";
      setSubmitError(message);
      setStep(null);
    }
  }

  const busy = isSubmitting;

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        setOpen(v);
        if (!v) resetAll();
      }}
    >
      <DialogTrigger asChild>
        <Button>
          <Plus className="mr-2 h-4 w-4" />
          Add Product
        </Button>
      </DialogTrigger>

      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add Product</DialogTitle>
          <DialogDescription>
            Upload an image to get AI-powered style analysis.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          {/* Image upload */}
          <div className="space-y-2">
            <Label>Product Image</Label>
            {imagePreview ? (
              <div className="relative">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={imagePreview}
                  alt="Preview"
                  className="h-40 w-full rounded-lg border object-cover"
                />
                <button
                  type="button"
                  onClick={clearImage}
                  className="absolute right-2 top-2 rounded-full bg-background/80 p-1 hover:bg-background"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                className="flex h-32 w-full flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-input text-muted-foreground transition-colors hover:border-ring hover:text-foreground"
              >
                <ImagePlus className="h-6 w-6" />
                <span className="text-sm">Click to upload image</span>
              </button>
            )}
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleFileChange}
            />
          </div>

          {/* Name */}
          <div className="space-y-2">
            <Label htmlFor="name">Name</Label>
            <Input
              id="name"
              placeholder="e.g. Silk Midi Dress"
              {...register("name")}
            />
            {errors.name && (
              <p className="text-sm text-destructive">{errors.name.message}</p>
            )}
          </div>

          {/* Category */}
          <div className="space-y-2">
            <Label htmlFor="category">Category</Label>
            <Select id="category" {...register("category")}>
              <option value="">Select a category</option>
              {CATEGORIES.map((cat) => (
                <option key={cat} value={cat}>
                  {cat.charAt(0).toUpperCase() + cat.slice(1)}
                </option>
              ))}
            </Select>
            {errors.category && (
              <p className="text-sm text-destructive">
                {errors.category.message}
              </p>
            )}
          </div>

          {/* Price */}
          <div className="space-y-2">
            <Label htmlFor="price">Price</Label>
            <Input
              id="price"
              type="number"
              step="0.01"
              min="0"
              placeholder="0.00"
              {...register("price", { valueAsNumber: true })}
            />
            {errors.price && (
              <p className="text-sm text-destructive">
                {errors.price.message}
              </p>
            )}
          </div>

          {/* Submit error */}
          {submitError && (
            <p className="text-sm text-destructive">{submitError}</p>
          )}

          <DialogFooter>
            <Button type="submit" disabled={busy} className="w-full sm:w-auto">
              {busy ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {step ?? "Saving..."}
                </>
              ) : (
                "Save Product"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
