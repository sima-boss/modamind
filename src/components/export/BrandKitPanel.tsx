/* eslint-disable @next/next/no-img-element */
"use client";

import { useRef, useState } from "react";
import { ImagePlus, Loader2, Palette, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { LockedFeature } from "@/components/billing/LockedFeature";
import { createClient } from "@/lib/supabase/client";
import type { Profile } from "@/lib/supabase/types";

const DEFAULT_PRIMARY = "#7c3aed";
const DEFAULT_SECONDARY = "#ede9fe";

interface BrandKitPanelProps {
  profile: Profile | null;
  userId: string;
  /** Whether the caller's plan includes the brand kit feature. */
  canUse: boolean;
  onSaved: (profile: Profile) => void;
}

/** Premium-only panel letting a user upload a logo and pick brand colors
 * that get applied to every outfit card they export as an image
 * (see ExportableOutfitCard's `brandKit` prop). */
export function BrandKitPanel({ profile, userId, canUse, onSaved }: BrandKitPanelProps) {
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(
    profile?.brand_logo_url ?? null
  );
  const [primaryColor, setPrimaryColor] = useState(
    profile?.brand_primary_color ?? DEFAULT_PRIMARY
  );
  const [secondaryColor, setSecondaryColor] = useState(
    profile?.brand_secondary_color ?? DEFAULT_SECONDARY
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0] ?? null;
    setLogoFile(file);
    if (file) setLogoPreview(URL.createObjectURL(file));
  }

  function clearLogo() {
    setLogoFile(null);
    setLogoPreview(null);
    if (fileRef.current) fileRef.current.value = "";
  }

  async function handleSave() {
    setSaving(true);
    setError(null);
    setSaved(false);
    try {
      const supabase = createClient();
      let logoUrl = profile?.brand_logo_url ?? null;

      if (logoFile) {
        const ext = logoFile.name.split(".").pop() ?? "png";
        const path = `brand-logos/${userId}-${Date.now()}.${ext}`;
        const { error: uploadErr } = await supabase.storage
          .from("product-images")
          .upload(path, logoFile, { contentType: logoFile.type, upsert: true });
        if (uploadErr) throw new Error(`Logo upload failed: ${uploadErr.message}`);

        const { data: urlData } = supabase.storage
          .from("product-images")
          .getPublicUrl(path);
        logoUrl = urlData.publicUrl;
      } else if (logoPreview === null) {
        logoUrl = null;
      }

      const res = await fetch("/api/brand-kit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          brand_logo_url: logoUrl,
          brand_primary_color: primaryColor,
          brand_secondary_color: secondaryColor,
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? "Could not save brand kit");
      }
      const { profile: updated } = await res.json();
      onSaved(updated);
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save brand kit");
    } finally {
      setSaving(false);
    }
  }

  if (!canUse) {
    return (
      <div className="rounded-xl border bg-card p-5 shadow-sm">
        <div className="mb-1 flex items-center gap-2">
          <Palette className="h-4 w-4 text-muted-foreground" />
          <h3 className="font-medium">Brand Kit</h3>
        </div>
        <p className="mb-3 text-sm text-muted-foreground">
          Apply your logo and brand colors to every outfit card you export.
        </p>
        <LockedFeature label="Brand kit is a Premium feature" />
      </div>
    );
  }

  return (
    <div className="rounded-xl border bg-card p-5 shadow-sm">
      <div className="mb-1 flex items-center gap-2">
        <Palette className="h-4 w-4 text-muted-foreground" />
        <h3 className="font-medium">Brand Kit</h3>
      </div>
      <p className="mb-4 text-sm text-muted-foreground">
        Applied automatically the next time you export an outfit card as an
        image.
      </p>

      <div className="flex flex-wrap items-start gap-6">
        {/* Logo */}
        <div className="space-y-2">
          <Label>Logo</Label>
          {logoPreview ? (
            <div className="relative">
              <img
                src={logoPreview}
                alt="Logo preview"
                className="h-20 w-40 rounded-lg border bg-white object-contain p-2"
              />
              <button
                type="button"
                onClick={clearLogo}
                className="absolute -right-2 -top-2 rounded-full bg-background/80 p-1 hover:bg-background"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="flex h-20 w-40 flex-col items-center justify-center gap-1 rounded-lg border-2 border-dashed border-input text-muted-foreground transition-colors hover:border-ring hover:text-foreground"
            >
              <ImagePlus className="h-5 w-5" />
              <span className="text-xs">Upload logo</span>
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

        {/* Colors */}
        <div className="flex gap-4">
          <div className="space-y-2">
            <Label htmlFor="brand-primary">Primary color</Label>
            <input
              id="brand-primary"
              type="color"
              value={primaryColor}
              onChange={(e) => setPrimaryColor(e.target.value)}
              className="h-10 w-16 cursor-pointer rounded-md border border-input"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="brand-secondary">Secondary color</Label>
            <input
              id="brand-secondary"
              type="color"
              value={secondaryColor}
              onChange={(e) => setSecondaryColor(e.target.value)}
              className="h-10 w-16 cursor-pointer rounded-md border border-input"
            />
          </div>
        </div>
      </div>

      {error && <p className="mt-3 text-sm text-destructive">{error}</p>}
      {saved && (
        <p className="mt-3 text-sm text-green-600 dark:text-green-400">
          Brand kit saved.
        </p>
      )}

      <Button className="mt-4" size="sm" onClick={handleSave} disabled={saving}>
        {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
        Save Brand Kit
      </Button>
    </div>
  );
}
