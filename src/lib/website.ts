import { Context, Effect, Layer } from "effect";
import { WebsiteFetchError } from "@/lib/errors";

const FETCH_TIMEOUT_MS = 15_000;
const MAX_RESPONSE_BYTES = 2 * 1024 * 1024;

export interface FetchedWebsite {
  readonly url: string;
  readonly canonicalUrl: string;
  readonly title: string;
  readonly description: string | null;
  readonly text: string;
  readonly byteSize: number;
}

export class WebsiteFetcher extends Context.Tag("WebsiteFetcher")<
  WebsiteFetcher,
  {
    readonly fetchPage: (
      url: string,
    ) => Effect.Effect<FetchedWebsite, WebsiteFetchError>;
  }
>() {}

function normalizeHttpUrl(value: string): string {
  const url = new URL(value.trim());
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error("Only http and https URLs are supported");
  }
  url.hash = "";
  return url.toString();
}

function decodeHtmlEntities(value: string): string {
  const named: Record<string, string> = {
    amp: "&",
    apos: "'",
    gt: ">",
    lt: "<",
    nbsp: " ",
    quot: '"',
  };

  return value.replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, (match, entity) => {
    const key = String(entity).toLowerCase();
    if (key.startsWith("#x")) {
      const codePoint = Number.parseInt(key.slice(2), 16);
      return Number.isFinite(codePoint)
        ? String.fromCodePoint(codePoint)
        : match;
    }
    if (key.startsWith("#")) {
      const codePoint = Number.parseInt(key.slice(1), 10);
      return Number.isFinite(codePoint)
        ? String.fromCodePoint(codePoint)
        : match;
    }
    return named[key] ?? match;
  });
}

function extractFirst(pattern: RegExp, html: string): string | null {
  const match = pattern.exec(html);
  if (!match?.[1]) return null;
  return decodeHtmlEntities(match[1].replace(/\s+/g, " ").trim());
}

function extractWebsiteText(html: string, requestedUrl: string) {
  const title = extractFirst(/<title[^>]*>([\s\S]*?)<\/title>/i, html);
  const description = extractFirst(
    /<meta\s+[^>]*(?:name|property)=["'](?:description|og:description)["'][^>]*content=["']([^"']*)["'][^>]*>/i,
    html,
  );
  const canonicalHref = extractFirst(
    /<link\s+[^>]*rel=["']canonical["'][^>]*href=["']([^"']*)["'][^>]*>/i,
    html,
  );
  const canonicalUrl = canonicalHref
    ? new URL(canonicalHref, requestedUrl).toString()
    : requestedUrl;

  const text = decodeHtmlEntities(
    html
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
      .replace(/<svg[\s\S]*?<\/svg>/gi, " ")
      .replace(/<(nav|header|footer|aside|form)[^>]*>[\s\S]*?<\/\1>/gi, " ")
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<\/(p|div|section|article|main|li|h[1-6]|tr)>/gi, "\n")
      .replace(/<[^>]+>/g, " ")
      .replace(/[ \t]+\n/g, "\n")
      .replace(/\n{3,}/g, "\n\n")
      .replace(/[ \t]{2,}/g, " ")
      .trim(),
  );

  return {
    canonicalUrl,
    description,
    text,
    title: title || new URL(requestedUrl).hostname,
  };
}

export const WebsiteFetcherLive = Layer.succeed(
  WebsiteFetcher,
  WebsiteFetcher.of({
    fetchPage: (inputUrl) =>
      Effect.tryPromise({
        try: async () => {
          const url = normalizeHttpUrl(inputUrl);
          const controller = new AbortController();
          const timeout = setTimeout(
            () => controller.abort(),
            FETCH_TIMEOUT_MS,
          );

          try {
            const response = await fetch(url, {
              headers: {
                Accept: "text/html,text/plain;q=0.9,*/*;q=0.1",
                "User-Agent": "shiryouku-source-indexer/1.0",
              },
              redirect: "follow",
              signal: controller.signal,
            });

            if (!response.ok) {
              throw new Error(`Request failed with ${response.status}`);
            }

            const contentType = response.headers.get("content-type") ?? "";
            if (
              !contentType.includes("text/html") &&
              !contentType.includes("text/plain")
            ) {
              throw new Error(
                `Unsupported content type: ${contentType || "unknown"}`,
              );
            }

            const contentLength = Number(
              response.headers.get("content-length"),
            );
            if (
              Number.isFinite(contentLength) &&
              contentLength > MAX_RESPONSE_BYTES
            ) {
              throw new Error("Response is too large to index");
            }

            const body = await response.text();
            const byteSize = new TextEncoder().encode(body).byteLength;
            if (byteSize > MAX_RESPONSE_BYTES) {
              throw new Error("Response is too large to index");
            }

            const finalUrl = normalizeHttpUrl(response.url || url);
            const extracted = contentType.includes("text/plain")
              ? {
                  canonicalUrl: finalUrl,
                  description: null,
                  text: body.trim(),
                  title: new URL(finalUrl).hostname,
                }
              : extractWebsiteText(body, finalUrl);

            if (!extracted.text.trim()) {
              throw new Error("No readable text found on the page");
            }

            return {
              url,
              canonicalUrl: extracted.canonicalUrl,
              title: extracted.title,
              description: extracted.description,
              text: extracted.text,
              byteSize,
            };
          } finally {
            clearTimeout(timeout);
          }
        },
        catch: (cause) =>
          new WebsiteFetchError({
            url: inputUrl,
            message: cause instanceof Error ? cause.message : String(cause),
            cause,
          }),
      }),
  }),
);
