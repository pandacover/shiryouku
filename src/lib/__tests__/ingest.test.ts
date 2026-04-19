import { Effect, Layer, Ref } from "effect";
import { describe, expect, it } from "vitest";
import { ChromaDb } from "@/lib/chroma";
import { Database } from "@/lib/db";
import { Embeddings } from "@/lib/embed";
import {
  createWebsiteSource,
  ingestDocument,
  refreshWebsiteSource,
  reingestAllDocuments,
  removeDocumentFromAllStores,
} from "@/lib/ingest";
import { SearchIndex } from "@/lib/search";
import { type FetchedWebsite, WebsiteFetcher } from "@/lib/website";
import { DatabaseTest } from "./helpers";

// Helper to run Effect tests
const runEffect = <E, A>(effect: Effect.Effect<A, E, never>) => {
  return Effect.runPromiseExit(effect);
};

const SearchIndexTest = Layer.succeed(
  SearchIndex,
  SearchIndex.of({
    status: Effect.succeed("ready" as const),
    addFromStoredChunks: () => Effect.void,
    removeDocument: () => Effect.void,
    search: () => Effect.succeed([]),
    reindex: () => Effect.succeed({ documentCount: 0, chunkCount: 0 }),
    getConstellationData: () => Effect.succeed({ documents: [] }),
  }),
);

const ChromaDbTest = Layer.succeed(
  ChromaDb,
  ChromaDb.of({
    getOrCreateCollection: () => Effect.die("not implemented in test"),
    upsertEmbeddings: () => Effect.void,
    removeDocument: () => Effect.void,
    deleteCollection: () => Effect.void,
    querySimilar: () => Effect.succeed([]),
  }),
);

const EmbeddingsTest = Layer.succeed(
  Embeddings,
  Embeddings.of({
    embedText: () => Effect.succeed([] as ReadonlyArray<number>),
    embedTexts: () =>
      Effect.succeed([] as ReadonlyArray<ReadonlyArray<number>>),
    embedDocChunks: () => Effect.succeed({ chunkCount: 0 }),
    embedAllDocChunks: () =>
      Effect.succeed({ documentCount: 0, chunkCount: 0 }),
    removeDocumentFromChroma: () => Effect.void,
  }),
);

const makeWebsiteLayer = (page: FetchedWebsite) =>
  Layer.succeed(
    WebsiteFetcher,
    WebsiteFetcher.of({
      fetchPage: () => Effect.succeed(page),
    }),
  );

const TestLayer = Layer.mergeAll(
  DatabaseTest,
  SearchIndexTest,
  ChromaDbTest,
  EmbeddingsTest,
  makeWebsiteLayer({
    url: "https://example.com/",
    canonicalUrl: "https://example.com/",
    title: "Example",
    description: "Example page",
    text: "Example website content for indexing.",
    byteSize: 37,
  }),
);

describe("Ingestion Pipeline", () => {
  it("ingestDocument fails for non-existent document", async () => {
    const effect = Effect.gen(function* () {
      const result = yield* Effect.either(ingestDocument("nonexistent"));
      expect(result._tag).toBe("Left");
    }).pipe(Effect.provide(TestLayer));

    const exit = await runEffect(effect);
    expect(exit._tag).toBe("Success");
  });

  it("removeDocumentFromAllStores succeeds even with no document", async () => {
    const effect = Effect.gen(function* () {
      yield* removeDocumentFromAllStores("nonexistent");
    }).pipe(Effect.provide(TestLayer));

    const exit = await runEffect(effect);
    expect(exit._tag).toBe("Success");
  });

  it("reingestAllDocuments returns empty stats with no docs", async () => {
    const effect = Effect.gen(function* () {
      const result = yield* reingestAllDocuments();
      expect(typeof result.documentCount).toBe("number");
      expect(typeof result.chunkCount).toBe("number");
    }).pipe(Effect.provide(TestLayer));

    const exit = await runEffect(effect);
    expect(exit._tag).toBe("Success");
  });

  it("creates a website source with fetched content", async () => {
    const effect = Effect.gen(function* () {
      const db = yield* Database;
      const result = yield* createWebsiteSource("https://example.com/");
      const sources = yield* db.listWebsiteSources();
      const content = yield* db.getDocContent(result.docId);

      expect(result.chunkCount).toBeGreaterThan(0);
      expect(sources).toHaveLength(1);
      expect(sources[0].source_url).toBe("https://example.com/");
      expect(sources[0].fetch_status).toBe("success");
      expect(content.content).toContain("Example website content");
    }).pipe(Effect.provide(TestLayer));

    const exit = await runEffect(effect);
    expect(exit._tag).toBe("Success");
  });

  it("refreshes a website source and replaces stored content", async () => {
    const initialPage: FetchedWebsite = {
      url: "https://example.com/",
      canonicalUrl: "https://example.com/",
      title: "Old Example",
      description: null,
      text: "Old website content.",
      byteSize: 20,
    };
    const refreshedPage: FetchedWebsite = {
      url: "https://example.com/",
      canonicalUrl: "https://example.com/latest",
      title: "New Example",
      description: "Updated",
      text: "New website content after refresh.",
      byteSize: 34,
    };

    const effect = Effect.gen(function* () {
      const db = yield* Database;
      const created = yield* createWebsiteSource("https://example.com/");
      const refreshed = yield* refreshWebsiteSource(created.docId);
      const source = yield* db.getDoc(created.docId);
      const content = yield* db.getDocContent(created.docId);

      expect(refreshed.docId).toBe(created.docId);
      expect(source.name).toBe("New Example");
      expect(source.canonical_url).toBe("https://example.com/latest");
      expect(content.content).toBe("New website content after refresh.");
    }).pipe(
      Effect.provide(
        Layer.mergeAll(
          DatabaseTest,
          SearchIndexTest,
          ChromaDbTest,
          EmbeddingsTest,
          Layer.effect(
            WebsiteFetcher,
            Effect.gen(function* () {
              const pageRef = yield* Ref.make(initialPage);
              return WebsiteFetcher.of({
                fetchPage: () =>
                  Effect.gen(function* () {
                    const page = yield* Ref.get(pageRef);
                    yield* Ref.set(pageRef, refreshedPage);
                    return page;
                  }),
              });
            }),
          ),
        ),
      ),
    );

    const exit = await runEffect(effect);
    expect(exit._tag).toBe("Success");
  });
});
