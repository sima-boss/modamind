export const MIN_QUERY_LENGTH = 2;
export const RESULT_LIMIT = 5;
export const SEARCH_DEBOUNCE_MS = 250;

/** Builds a `%term%` ILIKE pattern with the LIKE wildcards (`%`, `_`) and
 * the escape character (`\`) escaped, so user input matches literally.
 * Callers must pass the result to `.ilike()` — never interpolate it into
 * an `.or()` filter string, where `,` and `()` are syntax. */
export function toIlikePattern(term: string): string {
  const escaped = term.trim().replace(/[\\%_]/g, (ch) => `\\${ch}`);
  return `%${escaped}%`;
}

export interface SearchPage {
  label: string;
  href: string;
}

export const SEARCH_PAGES: SearchPage[] = [
  { label: "Dashboard", href: "/dashboard" },
  { label: "Products", href: "/products" },
  { label: "Outfits", href: "/outfits" },
  { label: "Analytics", href: "/analytics" },
  { label: "Export", href: "/export" },
  { label: "Billing", href: "/billing" },
];

export function matchPages(query: string): SearchPage[] {
  const q = query.trim().toLowerCase();
  if (q.length < MIN_QUERY_LENGTH) return [];
  return SEARCH_PAGES.filter((p) => p.label.toLowerCase().includes(q));
}
