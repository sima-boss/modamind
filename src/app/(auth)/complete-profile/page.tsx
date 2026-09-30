"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { createClient } from "@/lib/supabase/client";
import { sanitizeNext } from "@/lib/validation/auth";

const schema = z.object({
  fullName: z.string().trim().min(2, "Enter your full name").max(100),
  businessName: z
    .string()
    .trim()
    .min(2, "Enter your business or store name")
    .max(100),
});
type Values = z.infer<typeof schema>;

export default function CompleteProfilePage() {
  return (
    <Suspense
      fallback={<Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />}
    >
      <CompleteProfileForm />
    </Suspense>
  );
}

/** Shown after a first Google sign-in: Google doesn't provide a business
 * name, so ask for it. Skippable — nothing hard-requires it. */
function CompleteProfileForm() {
  const router = useRouter();
  const next = sanitizeNext(useSearchParams().get("next"));
  const [userId, setUserId] = useState<string | null>(null);
  const [serverError, setServerError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<Values>({ resolver: zodResolver(schema) });

  // Prefill the name Google gave us.
  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) return;
      setUserId(user.id);
      const { data: profile } = await supabase
        .from("profiles")
        .select("full_name, business_name")
        .eq("id", user.id)
        .maybeSingle();
      reset({
        fullName:
          profile?.full_name ??
          (user.user_metadata?.full_name as string | undefined) ??
          "",
        businessName: profile?.business_name ?? "",
      });
    });
  }, [reset]);

  async function onSubmit(values: Values) {
    if (!userId) return;
    setSubmitting(true);
    setServerError(null);

    const supabase = createClient();
    const { error } = await supabase
      .from("profiles")
      .update({
        full_name: values.fullName,
        business_name: values.businessName,
      })
      .eq("id", userId);

    if (error) {
      setSubmitting(false);
      setServerError("Could not save your details. Please try again.");
      return;
    }

    router.push(next);
    router.refresh();
  }

  return (
    <>
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">
          One last step
        </h1>
        <p className="text-sm text-muted-foreground">
          Tell us about your store — it appears on your exported outfit cards.
        </p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div className="space-y-2">
          <label htmlFor="fullName" className="text-sm font-medium">
            Full name
          </label>
          <Input id="fullName" placeholder="Jane Doe" {...register("fullName")} />
          {errors.fullName && (
            <p className="text-sm text-destructive">{errors.fullName.message}</p>
          )}
        </div>

        <div className="space-y-2">
          <label htmlFor="businessName" className="text-sm font-medium">
            Business / store name
          </label>
          <Input
            id="businessName"
            placeholder="Fashnix Boutique"
            {...register("businessName")}
          />
          {errors.businessName && (
            <p className="text-sm text-destructive">
              {errors.businessName.message}
            </p>
          )}
        </div>

        {serverError && <p className="text-sm text-destructive">{serverError}</p>}

        <Button type="submit" className="w-full" disabled={submitting || !userId}>
          {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {submitting ? "Saving..." : "Continue"}
        </Button>
      </form>

      <p className="text-center text-sm text-muted-foreground">
        <Link
          href={next}
          className="font-medium text-foreground underline-offset-4 hover:underline"
        >
          Skip for now
        </Link>
      </p>
    </>
  );
}
