export interface TopUpPackage {
  id: "small" | "medium" | "large";
  outfits: number;
  amount_aed: number;
}

export const TOPUP_PACKAGES: TopUpPackage[] = [
  { id: "small", outfits: 5, amount_aed: 5 },
  { id: "medium", outfits: 50, amount_aed: 40 },
  { id: "large", outfits: 200, amount_aed: 140 },
];
