import { describe, it, expect } from "vitest";
import { ImageFetchError, fetchImageWithLimits, isAllowedImageUrl } from "../image-fetch";

const SUPABASE = "https://proj.supabase.co";
const GOOD = "https://proj.supabase.co/storage/v1/object/public/product-images/a.png";

describe("isAllowedImageUrl", () => {
  it("allows https storage URLs on our Supabase host", () => {
    expect(isAllowedImageUrl(GOOD, SUPABASE)).toBe(true);
    expect(isAllowedImageUrl(GOOD.replace("proj.", "PROJ."), SUPABASE)).toBe(true);
  });

  it.each([
    ["http scheme", "http://proj.supabase.co/storage/v1/object/public/a.png"],
    ["other host", "https://evil.com/storage/v1/object/public/a.png"],
    ["lookalike suffix", "https://proj.supabase.co.evil.com/storage/v1/a.png"],
    ["subdomain", "https://x.proj.supabase.co/storage/v1/a.png"],
    ["userinfo trick", "https://proj.supabase.co@evil.com/storage/v1/a.png"],
    ["userinfo on our host", "https://user:pw@proj.supabase.co/storage/v1/a.png"],
    ["port mismatch", "https://proj.supabase.co:8443/storage/v1/a.png"],
    ["non-storage path", "https://proj.supabase.co/rest/v1/products"],
    ["internal IP", "https://169.254.169.254/latest/meta-data"],
    ["file scheme", "file:///etc/passwd"],
    ["garbage", "not a url"],
    ["empty", ""],
  ])("rejects %s", (_label, url) => {
    expect(isAllowedImageUrl(url, SUPABASE)).toBe(false);
  });

  it("rejects when the Supabase URL is missing or invalid", () => {
    expect(isAllowedImageUrl(GOOD, undefined)).toBe(false);
    expect(isAllowedImageUrl(GOOD, "nope")).toBe(false);
  });
});

function streamOf(chunks: Uint8Array[]) {
  return new ReadableStream<Uint8Array>({
    start(controller) {
      chunks.forEach((c) => controller.enqueue(c));
      controller.close();
    },
  });
}

function mockFetch(res: Response): typeof fetch {
  return (async () => res) as unknown as typeof fetch;
}

async function expectStatus(p: Promise<unknown>, status: number) {
  const err = await p.then(
    () => null,
    (e) => e
  );
  expect(err).toBeInstanceOf(ImageFetchError);
  expect((err as ImageFetchError).status).toBe(status);
}

describe("fetchImageWithLimits", () => {
  it("returns the bytes and content type on success", async () => {
    const res = new Response(streamOf([new Uint8Array([1, 2, 3])]), {
      headers: { "content-type": "image/png; charset=binary" },
    });
    const out = await fetchImageWithLimits(GOOD, { fetchImpl: mockFetch(res) });
    expect(Array.from(out.buffer)).toEqual([1, 2, 3]);
    expect(out.contentType).toBe("image/png");
  });

  it("passes redirect: error and an abort signal", async () => {
    let init: RequestInit | undefined;
    const fetchImpl = (async (_url: string, i?: RequestInit) => {
      init = i;
      return new Response("x");
    }) as unknown as typeof fetch;
    await fetchImageWithLimits(GOOD, { fetchImpl });
    expect(init?.redirect).toBe("error");
    expect(init?.signal).toBeInstanceOf(AbortSignal);
  });

  it("rejects early when content-length exceeds the limit", async () => {
    const res = new Response(streamOf([new Uint8Array(1)]), {
      headers: { "content-length": String(6 * 1024 * 1024) },
    });
    await expectStatus(fetchImageWithLimits(GOOD, { fetchImpl: mockFetch(res) }), 413);
  });

  it("rejects when the actual bytes exceed the limit without content-length", async () => {
    const res = new Response(streamOf([new Uint8Array(60), new Uint8Array(60)]));
    await expectStatus(
      fetchImageWithLimits(GOOD, { fetchImpl: mockFetch(res), maxBytes: 100 }),
      413
    );
  });

  it("rejects when the body is bigger than a lying content-length", async () => {
    const res = new Response(streamOf([new Uint8Array(200)]), {
      headers: { "content-length": "10" },
    });
    await expectStatus(
      fetchImageWithLimits(GOOD, { fetchImpl: mockFetch(res), maxBytes: 100 }),
      413
    );
  });

  it("times out with 504 when the server never responds", async () => {
    const fetchImpl = ((_url: string, init?: RequestInit) =>
      new Promise((_resolve, reject) => {
        init?.signal?.addEventListener("abort", () =>
          reject(new DOMException("aborted", "AbortError"))
        );
      })) as unknown as typeof fetch;
    await expectStatus(fetchImageWithLimits(GOOD, { fetchImpl, timeoutMs: 20 }), 504);
  });

  it("maps a non-OK upstream response to 502", async () => {
    const res = new Response("nope", { status: 404 });
    await expectStatus(fetchImageWithLimits(GOOD, { fetchImpl: mockFetch(res) }), 502);
  });

  it("maps a network error to 502", async () => {
    const fetchImpl = (async () => {
      throw new TypeError("redirect not allowed");
    }) as unknown as typeof fetch;
    await expectStatus(fetchImageWithLimits(GOOD, { fetchImpl }), 502);
  });
});
