export function formatAED(amount: number): string {
  return new Intl.NumberFormat("en-AE", {
    style: "currency",
    currency: "AED",
  }).format(amount);
}

export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-AE", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}
