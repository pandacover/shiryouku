import { describe, expect, it } from "vitest"
import { Effect, Layer } from "effect"
import { SearchIndex } from "@/lib/search"
import { ChromaDb } from "@/lib/chroma"
import { Embeddings } from "@/lib/embed"
import { hybridSearch, formatAnnotatedText, type HybridResult } from "@/lib/retrieval"

// Helper to run Effect tests
const runEffect = <E, A>(effect: Effect.Effect<A, E, never>) => {
  return Effect.runPromiseExit(effect)
}

const SearchIndexTest = Layer.succeed(SearchIndex, SearchIndex.of({
  status: Effect.succeed("ready" as const),
  addFromStoredChunks: () => Effect.void,
  removeDocument: () => Effect.void,
  search: () => Effect.succeed([]),
  reindex: () => Effect.succeed({ documentCount: 0, chunkCount: 0 }),
  getConstellationData: () => Effect.succeed({ documents: [] }),
}))

const ChromaDbTest = Layer.succeed(ChromaDb, ChromaDb.of({
  getOrCreateCollection: () => Effect.die("not implemented in test"),
  upsertEmbeddings: () => Effect.void,
  removeDocument: () => Effect.void,
  deleteCollection: () => Effect.void,
  querySimilar: () => Effect.succeed([]),
}))

const EmbeddingsTest = Layer.succeed(Embeddings, Embeddings.of({
  embedText: () => Effect.succeed([0.1, 0.2, 0.3] as ReadonlyArray<number>),
  embedTexts: () => Effect.succeed([] as ReadonlyArray<ReadonlyArray<number>>),
  embedDocChunks: () => Effect.succeed({ chunkCount: 0 }),
  embedAllDocChunks: () => Effect.succeed({ documentCount: 0, chunkCount: 0 }),
  removeDocumentFromChroma: () => Effect.void,
}))

const TestLayer = Layer.mergeAll(SearchIndexTest, ChromaDbTest, EmbeddingsTest)

describe("Hybrid Search", () => {
  it("returns empty array when no results", async () => {
    const effect = Effect.gen(function* () {
      const results = yield* hybridSearch("test query", 10)
      expect(results.length).toBe(0)
    }).pipe(Effect.provide(TestLayer))

    const exit = await runEffect(effect)
    expect(exit._tag).toBe("Success")
  })
})

describe("formatAnnotatedText", () => {
  it("formats empty results as empty string", () => {
    const result = formatAnnotatedText([])
    expect(result).toBe("")
  })

  it("formats results with source and context", () => {
    const results: HybridResult[] = [
      {
        chunkId: "c1",
        text: "Hello world",
        docId: "d1",
        docName: "Test Doc",
        fileType: "md",
        startIndex: 0,
        endIndex: 11,
        tokenCount: 3,
        prevChunkId: null,
        nextChunkId: null,
        rrfScore: 0.5,
        source: "keyword",
      },
    ]
    const result = formatAnnotatedText(results)
    expect(result).toContain("[SOURCE: Test Doc]")
    expect(result).toContain("[CONTEXT]")
    expect(result).toContain("Hello world")
  })
})
