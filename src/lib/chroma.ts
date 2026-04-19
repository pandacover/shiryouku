import { ChromaClient, type Collection } from "chromadb";
import { Context, Effect, Layer, Ref } from "effect";
import { ChromaUrl } from "@/lib/config";
import { ChromaDBError } from "@/lib/errors";

const COLLECTION_NAME = "shiryouku_chunks";

export class ChromaDb extends Context.Tag("ChromaDb")<
  ChromaDb,
  {
    readonly getOrCreateCollection: () => Effect.Effect<
      Collection,
      ChromaDBError
    >;
    readonly upsertEmbeddings: (
      docId: string,
      docName: string,
      fileType: string,
      chunks: ReadonlyArray<{
        readonly chunkId: string;
        readonly text: string;
        readonly startIndex?: number;
        readonly endIndex?: number;
        readonly tokenCount?: number;
        readonly prevChunkId?: string | null;
        readonly nextChunkId?: string | null;
      }>,
      embeddings: ReadonlyArray<ReadonlyArray<number>>,
    ) => Effect.Effect<void, ChromaDBError>;
    readonly removeDocument: (
      docId: string,
    ) => Effect.Effect<void, ChromaDBError>;
    readonly deleteCollection: () => Effect.Effect<void, never>;
    readonly querySimilar: (
      embedding: ReadonlyArray<number>,
      topK: number,
    ) => Effect.Effect<
      ReadonlyArray<{
        readonly chunkId: string;
        readonly docId: string;
        readonly docName: string;
        readonly fileType: string;
        readonly text: string;
        readonly startIndex: number;
        readonly endIndex: number;
        readonly tokenCount: number;
        readonly prevChunkId: string | null;
        readonly nextChunkId: string | null;
        readonly score: number;
      }>,
      ChromaDBError
    >;
  }
>() {}

export const ChromaDbLive = Layer.effect(
  ChromaDb,
  Effect.gen(function* () {
    const chromaUrl = yield* ChromaUrl;
    const client = new ChromaClient({ path: chromaUrl });
    const collectionRef = yield* Ref.make<Collection | null>(null);

    const getOrCreateCollection = (): Effect.Effect<
      Collection,
      ChromaDBError
    > =>
      Effect.gen(function* () {
        const existing = yield* Ref.get(collectionRef);
        if (existing) return existing;

        const collection = yield* Effect.tryPromise({
          try: () => client.getOrCreateCollection({ name: COLLECTION_NAME }),
          catch: (e) => new ChromaDBError({ cause: e }),
        });

        yield* Ref.set(collectionRef, collection);
        return collection;
      });

    const upsertEmbeddings = (
      docId: string,
      docName: string,
      fileType: string,
      chunks: ReadonlyArray<{
        readonly chunkId: string;
        readonly text: string;
        readonly startIndex?: number;
        readonly endIndex?: number;
        readonly tokenCount?: number;
        readonly prevChunkId?: string | null;
        readonly nextChunkId?: string | null;
      }>,
      embeddings: ReadonlyArray<ReadonlyArray<number>>,
    ): Effect.Effect<void, ChromaDBError> =>
      Effect.gen(function* () {
        const collection = yield* getOrCreateCollection();

        const ids = chunks.map((c) => c.chunkId);
        const documents = chunks.map((c) => c.text);
        const metadatas = chunks.map((chunk) => ({
          docId,
          docName,
          fileType,
          startIndex: chunk.startIndex ?? 0,
          endIndex: chunk.endIndex ?? 0,
          tokenCount: chunk.tokenCount ?? 0,
          prevChunkId: chunk.prevChunkId ?? "",
          nextChunkId: chunk.nextChunkId ?? "",
        }));
        const embeddingArrays = embeddings.map((e) => [...e]);

        yield* Effect.tryPromise({
          try: () =>
            collection.upsert({
              ids,
              documents,
              metadatas,
              embeddings: embeddingArrays,
            }),
          catch: (e) => new ChromaDBError({ cause: e }),
        });
      });

    const removeDocument = (
      docId: string,
    ): Effect.Effect<void, ChromaDBError> =>
      Effect.gen(function* () {
        const collection = yield* getOrCreateCollection();

        const allIds = yield* Effect.tryPromise({
          try: () => collection.get({ where: { docId } }),
          catch: (e) => new ChromaDBError({ cause: e }),
        });

        if (allIds.ids.length > 0) {
          yield* Effect.tryPromise({
            try: () => collection.delete({ ids: allIds.ids }),
            catch: (e) => new ChromaDBError({ cause: e }),
          });
        }
      });

    const deleteCollection = (): Effect.Effect<void, never> =>
      Effect.gen(function* () {
        yield* Ref.set(collectionRef, null);
        yield* Effect.tryPromise({
          try: () => client.deleteCollection({ name: COLLECTION_NAME }),
          catch: () => undefined as unknown as Error,
        }).pipe(Effect.catchAll(() => Effect.void));
      });

    const querySimilar = (
      embedding: ReadonlyArray<number>,
      topK: number,
    ): Effect.Effect<
      ReadonlyArray<{
        readonly chunkId: string;
        readonly docId: string;
        readonly docName: string;
        readonly fileType: string;
        readonly text: string;
        readonly startIndex: number;
        readonly endIndex: number;
        readonly tokenCount: number;
        readonly prevChunkId: string | null;
        readonly nextChunkId: string | null;
        readonly score: number;
      }>,
      ChromaDBError
    > =>
      Effect.gen(function* () {
        const collection = yield* getOrCreateCollection();

        const results = yield* Effect.tryPromise({
          try: () =>
            collection.query({
              queryEmbeddings: [[...embedding]],
              nResults: topK,
            }),
          catch: (e) => new ChromaDBError({ cause: e }),
        });

        const items: Array<{
          readonly chunkId: string;
          readonly docId: string;
          readonly docName: string;
          readonly fileType: string;
          readonly text: string;
          readonly startIndex: number;
          readonly endIndex: number;
          readonly tokenCount: number;
          readonly prevChunkId: string | null;
          readonly nextChunkId: string | null;
          readonly score: number;
        }> = [];

        if (results.ids[0] && results.distances?.[0]) {
          for (let i = 0; i < results.ids[0].length; i++) {
            const meta = results.metadatas?.[0]?.[i] as
              | Record<string, unknown>
              | null
              | undefined;
            items.push({
              chunkId: (results.ids[0]?.[i] as string) ?? "",
              docId: (meta?.docId as string) ?? "",
              docName: (meta?.docName as string) ?? "",
              fileType: (meta?.fileType as string) ?? "",
              text: (results.documents?.[0]?.[i] as string) ?? "",
              startIndex: Number(meta?.startIndex ?? 0),
              endIndex: Number(meta?.endIndex ?? 0),
              tokenCount: Number(meta?.tokenCount ?? 0),
              prevChunkId: ((meta?.prevChunkId as string) || null) ?? null,
              nextChunkId: ((meta?.nextChunkId as string) || null) ?? null,
              score: results.distances[0][i] ?? 0,
            });
          }
        }

        return items;
      });

    return ChromaDb.of({
      getOrCreateCollection,
      upsertEmbeddings,
      removeDocument,
      deleteCollection,
      querySimilar,
    });
  }),
);
