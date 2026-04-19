import { describe, expect, it } from "vitest"
import { Effect, Layer, Ref } from "effect"
import { Database, type DocRow, type DocContentRow, type DocChunkRow } from "@/lib/db"
import { SearchIndex } from "@/lib/search"
import { ChromaDb } from "@/lib/chroma"
import { Embeddings } from "@/lib/embed"
import { DocumentNotFoundError } from "@/lib/errors"
import { ingestDocument, removeDocumentFromAllStores, reingestAllDocuments } from "@/lib/ingest"
import { DatabaseTest } from "./helpers"

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
  embedText: () => Effect.succeed([] as ReadonlyArray<number>),
  embedTexts: () => Effect.succeed([] as ReadonlyArray<ReadonlyArray<number>>),
  embedDocChunks: () => Effect.succeed({ chunkCount: 0 }),
  embedAllDocChunks: () => Effect.succeed({ documentCount: 0, chunkCount: 0 }),
  removeDocumentFromChroma: () => Effect.void,
}))

const TestLayer = Layer.mergeAll(DatabaseTest, SearchIndexTest, ChromaDbTest, EmbeddingsTest)

describe("Ingestion Pipeline", () => {
  it("ingestDocument fails for non-existent document", async () => {
    const effect = Effect.gen(function* () {
      const result = yield* Effect.either(ingestDocument("nonexistent"))
      expect(result._tag).toBe("Left")
    }).pipe(Effect.provide(TestLayer))

    const exit = await runEffect(effect)
    expect(exit._tag).toBe("Success")
  })

  it("removeDocumentFromAllStores succeeds even with no document", async () => {
    const effect = Effect.gen(function* () {
      yield* removeDocumentFromAllStores("nonexistent")
    }).pipe(Effect.provide(TestLayer))

    const exit = await runEffect(effect)
    expect(exit._tag).toBe("Success")
  })

  it("reingestAllDocuments returns empty stats with no docs", async () => {
    const effect = Effect.gen(function* () {
      const db = yield* Database
      const result = yield* reingestAllDocuments()
      expect(typeof result.documentCount).toBe("number")
      expect(typeof result.chunkCount).toBe("number")
    }).pipe(Effect.provide(TestLayer))

    const exit = await runEffect(effect)
    expect(exit._tag).toBe("Success")
  })
})
