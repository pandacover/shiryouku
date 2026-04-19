import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import { embed, embedMany } from "ai";
import { Context, Duration, Effect, Layer, Redacted, Schedule } from "effect";
import { ChromaDb } from "@/lib/chroma";
import { OpenRouterApiKey } from "@/lib/config";
import { Database, type DbError } from "@/lib/db";
import {
  type ChromaDBError,
  type DocumentNotFoundError,
  EmbeddingError,
} from "@/lib/errors";

export class Embeddings extends Context.Tag("Embeddings")<
  Embeddings,
  {
    readonly embedText: (
      text: string,
    ) => Effect.Effect<ReadonlyArray<number>, EmbeddingError>;
    readonly embedTexts: (
      texts: ReadonlyArray<string>,
    ) => Effect.Effect<ReadonlyArray<ReadonlyArray<number>>, EmbeddingError>;
    readonly embedDocChunks: (
      docId: string,
    ) => Effect.Effect<
      { readonly chunkCount: number },
      DbError | DocumentNotFoundError | ChromaDBError | EmbeddingError
    >;
    readonly embedAllDocChunks: () => Effect.Effect<
      { readonly documentCount: number; readonly chunkCount: number },
      DbError | DocumentNotFoundError | ChromaDBError | EmbeddingError
    >;
    readonly removeDocumentFromChroma: (
      docId: string,
    ) => Effect.Effect<void, ChromaDBError>;
  }
>() {}

const EMBED_RETRY_SCHEDULE = Schedule.exponential(Duration.seconds(1)).pipe(
  Schedule.compose(Schedule.recurs(3)),
);

export const EmbeddingsLive = Layer.effect(
  Embeddings,
  Effect.gen(function* () {
    const apiKey = yield* OpenRouterApiKey;
    const db = yield* Database;
    const chroma = yield* ChromaDb;
    const openrouter = createOpenRouter({ apiKey: Redacted.value(apiKey) });
    const embeddingModel = openrouter.textEmbeddingModel(
      "perplexity/pplx-embed-v1-4b",
    );

    const embedText = (
      text: string,
    ): Effect.Effect<ReadonlyArray<number>, EmbeddingError> =>
      Effect.tryPromise({
        try: () => embed({ model: embeddingModel, value: text }),
        catch: (e) => new EmbeddingError({ cause: e }),
      }).pipe(
        Effect.map((r) => r.embedding as ReadonlyArray<number>),
        Effect.retry(EMBED_RETRY_SCHEDULE),
      );

    const embedTexts = (
      texts: ReadonlyArray<string>,
    ): Effect.Effect<ReadonlyArray<ReadonlyArray<number>>, EmbeddingError> =>
      Effect.tryPromise({
        try: () => embedMany({ model: embeddingModel, values: [...texts] }),
        catch: (e) => new EmbeddingError({ cause: e }),
      }).pipe(
        Effect.map((r) => r.embeddings as ReadonlyArray<ReadonlyArray<number>>),
        Effect.retry(EMBED_RETRY_SCHEDULE),
      );

    const embedDocChunks = (
      docId: string,
    ): Effect.Effect<
      { readonly chunkCount: number },
      DbError | DocumentNotFoundError | ChromaDBError | EmbeddingError
    > =>
      Effect.gen(function* () {
        const docResult = yield* db.getDoc(docId);
        const docName = docResult.name;
        const fileType = docResult.file_type;

        const rows = yield* db.getChunksForDoc(docId);
        if (rows.length === 0) return { chunkCount: 0 };

        const texts = rows.map((r) => r.text);
        const embeddings = yield* embedTexts(texts);

        yield* chroma.upsertEmbeddings(
          docId,
          docName,
          fileType,
          rows.map((r) => ({ chunkId: r.chunk_id, text: r.text })),
          embeddings,
        );

        return { chunkCount: rows.length };
      });

    const embedAllDocChunks = (): Effect.Effect<
      { readonly documentCount: number; readonly chunkCount: number },
      DbError | DocumentNotFoundError | ChromaDBError | EmbeddingError
    > =>
      Effect.gen(function* () {
        const docIds = yield* db.getDocIds();
        let totalChunks = 0;
        let docCount = 0;

        for (const docId of docIds) {
          const result = yield* Effect.catchTag(
            embedDocChunks(docId),
            "DocumentNotFoundError",
            () => Effect.succeed({ chunkCount: 0 }),
          );

          totalChunks += result.chunkCount;
          if (result.chunkCount > 0) docCount++;
        }

        return { documentCount: docCount, chunkCount: totalChunks };
      });

    const removeDocumentFromChroma = (
      docId: string,
    ): Effect.Effect<void, ChromaDBError> =>
      Effect.gen(function* () {
        yield* chroma.removeDocument(docId);
      });

    return Embeddings.of({
      embedText,
      embedTexts,
      embedDocChunks,
      embedAllDocChunks,
      removeDocumentFromChroma,
    });
  }),
);
