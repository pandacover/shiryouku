import { Effect } from "effect";
import { ChromaDb } from "@/lib/chroma";
import { chunkDocument, isChunkable } from "@/lib/chunk";
import { Database, type DbError, type DocChunkRow } from "@/lib/db";
import { Embeddings } from "@/lib/embed";
import {
  type ChromaDBError,
  ChunkingError,
  type DocumentNotFoundError,
  type EmbeddingError,
  type SearchIndexError,
  WebsiteFetchError,
} from "@/lib/errors";
import { SearchIndex } from "@/lib/search";
import { WebsiteFetcher } from "@/lib/website";

export const ingestDocument = (
  docId: string,
): Effect.Effect<
  { readonly chunkCount: number },
  | DbError
  | DocumentNotFoundError
  | SearchIndexError
  | ChromaDBError
  | EmbeddingError
  | ChunkingError,
  Database | SearchIndex | ChromaDb | Embeddings
> =>
  Effect.gen(function* () {
    const db = yield* Database;
    const search = yield* SearchIndex;
    const chroma = yield* ChromaDb;
    const embed = yield* Embeddings;

    const doc = yield* db.getDocWithContent(docId);
    const docName = doc.doc.name;
    const fileType = doc.doc.file_type;
    const text = doc.content?.content ?? "";

    yield* db.deleteChunksForDoc(docId).pipe(Effect.orDie);
    yield* Effect.catchTag(
      search.removeDocument(docId),
      "SearchIndexError",
      (e) =>
        Effect.logWarning(
          `[Ingest] Failed to remove from BM25: ${String(e.cause)}`,
        ).pipe(Effect.asVoid),
    );
    yield* Effect.catchTag(chroma.removeDocument(docId), "ChromaDBError", (e) =>
      Effect.logWarning(
        `[Ingest] Failed to remove from ChromaDB: ${String(e.cause)}`,
      ).pipe(Effect.asVoid),
    );

    if (!isChunkable(fileType) || !text.trim()) {
      return { chunkCount: 0 };
    }

    const chunks = yield* Effect.tryPromise({
      try: () => chunkDocument(docId, docName, fileType, text),
      catch: (e) => new ChunkingError({ cause: e }),
    });

    if (chunks.length === 0) return { chunkCount: 0 };

    const chunkRows: ReadonlyArray<DocChunkRow> = chunks.map((c) => ({
      chunk_id: c.chunkId,
      doc_id: c.docId,
      text: c.text,
      start_index: c.startIndex,
      end_index: c.endIndex,
      token_count: c.tokenCount,
      prev_chunk_id: c.prevChunkId,
      next_chunk_id: c.nextChunkId,
    }));

    yield* db.persistChunks(chunkRows);

    yield* search.addFromStoredChunks(docId, docName, fileType, chunks);

    const embeddings = yield* embed.embedTexts(chunks.map((c) => c.text));
    yield* chroma.upsertEmbeddings(
      docId,
      docName,
      fileType,
      chunks.map((c) => ({
        chunkId: c.chunkId,
        text: c.text,
        startIndex: c.startIndex,
        endIndex: c.endIndex,
        tokenCount: c.tokenCount,
        prevChunkId: c.prevChunkId,
        nextChunkId: c.nextChunkId,
      })),
      embeddings,
    );

    return { chunkCount: chunks.length };
  });

export const removeDocumentFromAllStores = (
  docId: string,
): Effect.Effect<
  void,
  DbError | SearchIndexError | ChromaDBError,
  Database | SearchIndex | ChromaDb
> =>
  Effect.gen(function* () {
    const db = yield* Database;
    const search = yield* SearchIndex;
    const chroma = yield* ChromaDb;

    const results = yield* Effect.all(
      [
        Effect.either(db.deleteChunksForDoc(docId)),
        Effect.either(db.deleteDocContentsForDoc(docId)),
        Effect.either(search.removeDocument(docId)),
        Effect.either(chroma.removeDocument(docId)),
      ],
      { concurrency: "unbounded" },
    );

    const failures = results.filter((r) => r._tag === "Left");
    if (failures.length > 0) {
      yield* Effect.logWarning(
        `[RemoveDocument] Partial failure for ${docId}: ${failures.length}/4`,
      );
    }
  });

export const reingestAllDocuments = (): Effect.Effect<
  { readonly documentCount: number; readonly chunkCount: number },
  | DbError
  | DocumentNotFoundError
  | SearchIndexError
  | ChromaDBError
  | EmbeddingError
  | ChunkingError,
  Database | SearchIndex | ChromaDb | Embeddings
> =>
  Effect.gen(function* () {
    const db = yield* Database;
    const docIds = yield* db.getDocIds();
    let totalChunks = 0;
    let docCount = 0;

    for (const docId of docIds) {
      const result = yield* Effect.catchTag(
        ingestDocument(docId),
        "DocumentNotFoundError",
        () => Effect.succeed({ chunkCount: 0 }),
      );

      totalChunks += result.chunkCount;
      if (result.chunkCount > 0) docCount++;
    }

    return { documentCount: docCount, chunkCount: totalChunks };
  });

export const createWebsiteSource = (
  url: string,
): Effect.Effect<
  { readonly docId: string; readonly chunkCount: number },
  | DbError
  | DocumentNotFoundError
  | SearchIndexError
  | ChromaDBError
  | EmbeddingError
  | ChunkingError
  | WebsiteFetchError,
  Database | SearchIndex | ChromaDb | Embeddings | WebsiteFetcher
> =>
  Effect.gen(function* () {
    const db = yield* Database;
    const fetcher = yield* WebsiteFetcher;
    const page = yield* fetcher.fetchPage(url);
    const now = Date.now();

    const existing = yield* db.getWebsiteSourceByUrl(page.url);
    const doc = existing
      ? yield* db.updateDoc(existing.id, {
          name: page.title,
          fileType: "website",
          size: page.byteSize,
          canonicalUrl: page.canonicalUrl,
          title: page.title,
          description: page.description,
          lastFetchedAt: now,
          fetchStatus: "success",
          fetchError: null,
        })
      : yield* db.createDoc({
          name: page.title,
          fileType: "website",
          size: page.byteSize,
          content: page.text,
          sourceType: "website",
          sourceUrl: page.url,
          canonicalUrl: page.canonicalUrl,
          title: page.title,
          description: page.description,
          lastFetchedAt: now,
          fetchStatus: "success",
          fetchError: null,
        });

    if (existing) {
      yield* db.upsertDocContent(doc.id, page.text);
    }

    const result = yield* ingestDocument(doc.id);
    return { docId: doc.id, chunkCount: result.chunkCount };
  });

export const refreshWebsiteSource = (
  docId: string,
): Effect.Effect<
  { readonly docId: string; readonly chunkCount: number },
  | DbError
  | DocumentNotFoundError
  | SearchIndexError
  | ChromaDBError
  | EmbeddingError
  | ChunkingError
  | WebsiteFetchError,
  Database | SearchIndex | ChromaDb | Embeddings | WebsiteFetcher
> =>
  Effect.gen(function* () {
    const db = yield* Database;
    const fetcher = yield* WebsiteFetcher;
    const doc = yield* db.getDoc(docId);

    if (doc.source_type !== "website" || !doc.source_url) {
      return yield* Effect.fail(
        new WebsiteFetchError({
          url: doc.source_url ?? docId,
          message: "Document is not a website source",
        }),
      );
    }

    const page = yield* fetcher.fetchPage(doc.source_url).pipe(
      Effect.tapError((error) =>
        db
          .updateDoc(docId, {
            fetchStatus: "error",
            fetchError: error.message,
          })
          .pipe(
            Effect.asVoid,
            Effect.catchAll(() => Effect.void),
          ),
      ),
    );
    const now = Date.now();

    yield* db.updateDoc(docId, {
      name: page.title,
      fileType: "website",
      size: page.byteSize,
      canonicalUrl: page.canonicalUrl,
      title: page.title,
      description: page.description,
      lastFetchedAt: now,
      fetchStatus: "success",
      fetchError: null,
    });
    yield* db.upsertDocContent(docId, page.text);

    const result = yield* ingestDocument(docId);
    return { docId, chunkCount: result.chunkCount };
  });
