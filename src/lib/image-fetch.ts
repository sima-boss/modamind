export const IMAGE_FETCH_TIMEOUT_MS = 10_000;
export const IMAGE_MAX_BYTES = 5 * 1024 * 1024;

export class ImageFetchError extends Error {
  constructor(
    message: string,
    public readonly status: number
  ) {
    super(message);
    this.name = "ImageFetchError";
  }
}

/**
 * Only allow https URLs pointing at our own Supabase project's storage API.
 * Prevents the server from being used to fetch arbitrary/internal URLs (SSRF).
 */
export function isAllowedImageUrl(
  url: string | null | undefined,
  supabaseUrl: string | null | undefined
): boolean {
  if (!url || !supabaseUrl) return false;
  let target: URL;
  let allowed: URL;
  try {
    target = new URL(url);
    allowed = new URL(supabaseUrl);
  } catch {
    return false;
  }
  if (target.protocol !== "https:") return false;
  if (target.username || target.password) return false;
  if (target.host.toLowerCase() !== allowed.host.toLowerCase()) return false;
  if (!target.pathname.startsWith("/storage/v1/")) return false;
  return true;
}

interface FetchImageOptions {
  timeoutMs?: number;
  maxBytes?: number;
  fetchImpl?: typeof fetch;
}

/**
 * Fetch an image with a hard timeout and size cap. The size cap is enforced
 * both from Content-Length (early reject) and on the actual bytes streamed,
 * so a missing or lying header can't bypass it. Redirects are refused so the
 * request can't be bounced to a different host.
 */
export async function fetchImageWithLimits(
  url: string,
  {
    timeoutMs = IMAGE_FETCH_TIMEOUT_MS,
    maxBytes = IMAGE_MAX_BYTES,
    fetchImpl = fetch,
  }: FetchImageOptions = {}
): Promise<{ buffer: Buffer; contentType: string | null }> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    let res: Response;
    try {
      res = await fetchImpl(url, {
        signal: controller.signal,
        redirect: "error",
      });
    } catch (err) {
      if (controller.signal.aborted) {
        throw new ImageFetchError("Timed out fetching the image.", 504);
      }
      throw new ImageFetchError(
        `Could not fetch the image: ${err instanceof Error ? err.message : "network error"}`,
        502
      );
    }

    if (!res.ok) {
      throw new ImageFetchError(
        `Could not fetch the image (HTTP ${res.status}). The image URL may be invalid or inaccessible.`,
        502
      );
    }

    const tooLarge = () =>
      new ImageFetchError(
        `Image is larger than ${Math.round(maxBytes / (1024 * 1024))} MB.`,
        413
      );

    const declared = Number(res.headers.get("content-length"));
    if (Number.isFinite(declared) && declared > maxBytes) {
      controller.abort();
      throw tooLarge();
    }

    const contentType = res.headers.get("content-type")?.split(";")[0] ?? null;

    if (!res.body) {
      return { buffer: Buffer.alloc(0), contentType };
    }

    const reader = res.body.getReader();
    const chunks: Uint8Array[] = [];
    let total = 0;
    try {
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        total += value.byteLength;
        if (total > maxBytes) {
          controller.abort();
          await reader.cancel().catch(() => {});
          throw tooLarge();
        }
        chunks.push(value);
      }
    } catch (err) {
      if (err instanceof ImageFetchError) throw err;
      if (controller.signal.aborted) {
        throw new ImageFetchError("Timed out fetching the image.", 504);
      }
      throw new ImageFetchError("Failed while reading the image.", 502);
    }

    return {
      buffer: Buffer.concat(chunks.map((c) => Buffer.from(c))),
      contentType,
    };
  } finally {
    clearTimeout(timer);
  }
}
