export interface TopUpPackage {
  id: "small" | "medium" | "large";
  credits: number;
  amount_aed: number;
}

export const TOPUP_PACKAGES: TopUpPackage[] = [
  { id: "small", credits: 5, amount_aed: 5 },
  { id: "medium", credits: 50, amount_aed: 40 },
  { id: "large", credits: 200, amount_aed: 140 },
];
