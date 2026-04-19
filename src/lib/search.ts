import { Context, Effect, Layer, Ref } from "effect";
import { BM25 } from "fast-bm25";
import type { ChunkMeta } from "@/lib/chunk";
import { Database, type DocChunkRow } from "@/lib/db";
import { SearchIndexError } from "@/lib/errors";

export interface SearchMatch {
  readonly chunkId: string;
  readonly text: string;
  readonly score: number;
  readonly startIndex: number;
  readonly endIndex: number;
  readonly tokenCount: number;
  readonly prevChunkId: string | null;
  readonly nextChunkId: string | null;
  readonly siblings: ReadonlyArray<{
    readonly chunkId: string;
    readonly text: string;
    readonly direction: "prev" | "next";
  }>;
}

export interface SearchResultGroup {
  readonly doc: {
    readonly id: string;
    readonly name: string;
    readonly fileType: string;
  };
  readonly matches: ReadonlyArray<SearchMatch>;
}

export interface ConstellationData {
  readonly documents: ReadonlyArray<{
    readonly id: string;
    readonly name: string;
    readonly fileType: string;
    readonly chunks: ReadonlyArray<{
      readonly chunkId: string;
      readonly text: string;
      readonly startIndex: number;
      readonly endIndex: number;
      readonly tokenCount: number;
      readonly prevChunkId: string | null;
      readonly nextChunkId: string | null;
    }>;
  }>;
}

export type SearchIndexStatus =
  | "uninitialized"
  | "initializing"
  | "ready"
  | "error";

interface SearchIndexState {
  bm25: BM25 | null;
  chunkMap: Map<string, ChunkMeta>;
  indexToChunkId: string[];
  docChunkIds: Map<string, string[]>;
  docMeta: Map<string, { name: string; fileType: string }>;
}

export class SearchIndex extends Context.Tag("SearchIndex")<
  SearchIndex,
  {
    readonly status: Effect.Effect<SearchIndexStatus, never>;
    readonly addFromStoredChunks: (
      docId: string,
      docName: string,
      fileType: string,
      chunks: ReadonlyArray<ChunkMeta>,
    ) => Effect.Effect<void, SearchIndexError>;
    readonly removeDocument: (
      docId: string,
    ) => Effect.Effect<void, SearchIndexError>;
    readonly search: (
      query: string,
      topK?: number,
    ) => Effect.Effect<ReadonlyArray<SearchResultGroup>, SearchIndexError>;
    readonly reindex: () => Effect.Effect<
      { readonly documentCount: number; readonly chunkCount: number },
      SearchIndexError
    >;
    readonly getConstellationData: () => Effect.Effect<
      ConstellationData,
      never
    >;
  }
>() {}

function rowToChunk(
  row: DocChunkRow,
  docName: string,
  fileType: string,
): ChunkMeta {
  return {
    chunkId: row.chunk_id,
    docId: row.doc_id,
    docName,
    fileType,
    text: row.text,
    startIndex: row.start_index ?? 0,
    endIndex: row.end_index ?? 0,
    tokenCount: row.token_count ?? 0,
    prevChunkId: row.prev_chunk_id,
    nextChunkId: row.next_chunk_id,
  };
}

export const SearchIndexLive = Layer.effect(
  SearchIndex,
  Effect.gen(function* () {
    const db = yield* Database;
    const statusRef = yield* Ref.make<SearchIndexStatus>("uninitialized");
    const stateRef = yield* Ref.make<SearchIndexState>({
      bm25: null,
      chunkMap: new Map(),
      indexToChunkId: [],
      docChunkIds: new Map(),
      docMeta: new Map(),
    });

    const rebuildIndex = Effect.gen(function* () {
      const state = yield* Ref.get(stateRef);
      const bm25 = new BM25([], { stemming: true });
      const newIndexToChunkId: string[] = [];

      for (const [docId, chunkIds] of state.docChunkIds) {
        const meta = state.docMeta.get(docId);
        if (!meta) continue;

        for (const chunkId of chunkIds) {
          const chunk = state.chunkMap.get(chunkId);
          if (!chunk) continue;

          newIndexToChunkId.push(chunkId);
          bm25.addDocument({ text: chunk.text, docName: meta.name });
        }
      }

      yield* Ref.update(stateRef, (s) => ({
        ...s,
        bm25,
        indexToChunkId: newIndexToChunkId,
      }));
    });

    const initialize = Effect.gen(function* () {
      yield* Ref.set(statusRef, "initializing");
      yield* Effect.catchAll(
        Effect.gen(function* () {
          const docs = yield* db.listIndexableDocs();

          const bm25 = new BM25([], { stemming: true });
          const chunkMap = new Map<string, ChunkMeta>();
          const indexToChunkId: string[] = [];
          const docChunkIds = new Map<string, string[]>();
          const docMeta = new Map<string, { name: string; fileType: string }>();

          for (const doc of docs) {
            const docId = doc.id;
            const docName = doc.name;
            const fileType = doc.file_type;

            docMeta.set(docId, { name: docName, fileType });

            const rows = yield* db.getChunksForDoc(docId);
            if (rows.length === 0) continue;

            const chunkIds: string[] = [];
            for (const row of rows) {
              const chunk = rowToChunk(row, docName, fileType);
              chunkMap.set(chunk.chunkId, chunk);
              indexToChunkId.push(chunk.chunkId);
              chunkIds.push(chunk.chunkId);
              bm25.addDocument({ text: chunk.text, docName });
            }
            docChunkIds.set(docId, chunkIds);
          }

          yield* Ref.set(stateRef, {
            bm25,
            chunkMap,
            indexToChunkId,
            docChunkIds,
            docMeta,
          });
          yield* Ref.set(statusRef, "ready");
        }),
        (error) =>
          Effect.gen(function* () {
            yield* Ref.set(statusRef, "error");
            yield* Effect.fail(new SearchIndexError({ cause: error }));
          }),
      );
    });

    yield* initialize;

    const addFromStoredChunks = (
      docId: string,
      docName: string,
      fileType: string,
      chunks: ReadonlyArray<ChunkMeta>,
    ): Effect.Effect<void, SearchIndexError> =>
      Effect.gen(function* () {
        yield* Ref.update(stateRef, (s) => {
          if (s.docChunkIds.has(docId)) return s;
          return s;
        });

        const existing = yield* Ref.get(stateRef);
        if (existing.docChunkIds.has(docId)) {
          yield* removeDocument(docId);
        }

        if (chunks.length === 0) return;

        yield* Ref.update(stateRef, (s) => {
          const newDocMeta = new Map(s.docMeta);
          newDocMeta.set(docId, { name: docName, fileType });

          const newChunkMap = new Map(s.chunkMap);
          const newIndexToChunkId = [...s.indexToChunkId];
          const chunkIds: string[] = [];

          for (const chunk of chunks) {
            const enriched: ChunkMeta = { ...chunk, docName, fileType };
            newChunkMap.set(chunk.chunkId, enriched);
            newIndexToChunkId.push(chunk.chunkId);
            chunkIds.push(chunk.chunkId);
          }

          const newDocChunkIds = new Map(s.docChunkIds);
          newDocChunkIds.set(docId, chunkIds);

          return {
            ...s,
            chunkMap: newChunkMap,
            indexToChunkId: newIndexToChunkId,
            docChunkIds: newDocChunkIds,
            docMeta: newDocMeta,
          };
        });

        const state = yield* Ref.get(stateRef);
        if (state.bm25) {
          for (const chunk of chunks) {
            state.bm25.addDocument({ text: chunk.text, docName });
          }
        }
      });

    const removeDocument = (
      docId: string,
    ): Effect.Effect<void, SearchIndexError> =>
      Effect.gen(function* () {
        yield* Ref.update(stateRef, (s) => {
          const chunkIds = s.docChunkIds.get(docId);
          if (!chunkIds) return s;

          const newChunkMap = new Map(s.chunkMap);
          for (const id of chunkIds) {
            newChunkMap.delete(id);
          }

          const newDocChunkIds = new Map(s.docChunkIds);
          newDocChunkIds.delete(docId);

          const newDocMeta = new Map(s.docMeta);
          newDocMeta.delete(docId);

          return {
            ...s,
            chunkMap: newChunkMap,
            docChunkIds: newDocChunkIds,
            docMeta: newDocMeta,
          };
        });

        yield* rebuildIndex;
      });

    const search = (
      query: string,
      topK = 10,
    ): Effect.Effect<ReadonlyArray<SearchResultGroup>, SearchIndexError> =>
      Effect.gen(function* () {
        if (!query.trim()) return [];

        const state = yield* Ref.get(stateRef);
        if (!state.bm25) return [];

        const results = state.bm25.searchPhrase(query, topK);
        const groupedResults = new Map<
          string,
          {
            doc: { id: string; name: string; fileType: string };
            matches: SearchMatch[];
          }
        >();

        for (const result of results) {
          const chunkId = state.indexToChunkId[result.index];
          if (!chunkId) continue;

          const chunk = state.chunkMap.get(chunkId);
          if (!chunk) continue;

          const prevChunk = chunk.prevChunkId
            ? state.chunkMap.get(chunk.prevChunkId)
            : null;
          const nextChunk = chunk.nextChunkId
            ? state.chunkMap.get(chunk.nextChunkId)
            : null;

          const siblings: Array<{
            readonly chunkId: string;
            readonly text: string;
            readonly direction: "prev" | "next";
          }> = [];
          if (prevChunk) {
            siblings.push({
              chunkId: prevChunk.chunkId,
              text: prevChunk.text,
              direction: "prev" as const,
            });
          }
          if (nextChunk) {
            siblings.push({
              chunkId: nextChunk.chunkId,
              text: nextChunk.text,
              direction: "next" as const,
            });
          }

          const match: SearchMatch = {
            chunkId: chunk.chunkId,
            text: chunk.text,
            score: result.score,
            startIndex: chunk.startIndex,
            endIndex: chunk.endIndex,
            tokenCount: chunk.tokenCount,
            prevChunkId: chunk.prevChunkId,
            nextChunkId: chunk.nextChunkId,
            siblings,
          };

          const docId = chunk.docId;
          if (!groupedResults.has(docId)) {
            const meta = state.docMeta.get(docId) ?? {
              name: chunk.docName,
              fileType: chunk.fileType,
            };
            groupedResults.set(docId, {
              doc: { id: docId, name: meta.name, fileType: meta.fileType },
              matches: [],
            });
          }
          groupedResults.get(docId)?.matches.push(match);
        }

        return Array.from(groupedResults.values());
      });

    const reindex = (): Effect.Effect<
      { readonly documentCount: number; readonly chunkCount: number },
      SearchIndexError
    > =>
      Effect.gen(function* () {
        yield* initialize;
        const state = yield* Ref.get(stateRef);
        return {
          documentCount: state.docMeta.size,
          chunkCount: state.chunkMap.size,
        };
      });

    const getConstellationData = (): Effect.Effect<ConstellationData, never> =>
      Effect.gen(function* () {
        const state = yield* Ref.get(stateRef);

        const documents: Array<{
          readonly id: string;
          readonly name: string;
          readonly fileType: string;
          readonly chunks: readonly {
            readonly chunkId: string;
            readonly text: string;
            readonly startIndex: number;
            readonly endIndex: number;
            readonly tokenCount: number;
            readonly prevChunkId: string | null;
            readonly nextChunkId: string | null;
          }[];
        }> = [];

        for (const [docId, chunkIds] of state.docChunkIds) {
          const meta = state.docMeta.get(docId);
          if (!meta) continue;

          const chunks = chunkIds
            .map((id) => state.chunkMap.get(id))
            .filter((c): c is ChunkMeta => c !== undefined)
            .map((c) => ({
              chunkId: c.chunkId,
              text: c.text,
              startIndex: c.startIndex,
              endIndex: c.endIndex,
              tokenCount: c.tokenCount,
              prevChunkId: c.prevChunkId,
              nextChunkId: c.nextChunkId,
            }));

          documents.push({
            id: docId,
            name: meta.name,
            fileType: meta.fileType,
            chunks,
          });
        }

        return { documents };
      });

    return SearchIndex.of({
      status: Ref.get(statusRef),
      addFromStoredChunks,
      removeDocument,
      search,
      reindex,
      getConstellationData,
    });
  }),
);
