import { Effect } from "effect";
import { Hono } from "hono";
import { runEffect } from "@/api/bridge";
import { Database } from "@/lib/db";
import { reingestAllDocuments } from "@/lib/ingest";
import { SearchIndex } from "@/lib/search";

export const indexingRoutes = new Hono()
  .post("/reindex", async (c) => {
    return runEffect(
      c,
      Effect.gen(function* () {
        const result = yield* reingestAllDocuments();
        return {
          documentCount: result.documentCount,
          chunkCount: result.chunkCount,
        };
      }),
    );
  })

  .post("/add", async (c) => {
    const body = await c.req.json();
    const { docId } = body;

    if (!docId) {
      return c.json(
        { error: "Validation failed", details: "docId is required" },
        400,
      );
    }

    return runEffect(
      c,
      Effect.gen(function* () {
        const db = yield* Database;
        const doc = yield* db.getDoc(docId);
        const rows = yield* db.getChunksForDoc(docId);

        const chunks = rows.map((r) => ({
          chunkId: r.chunk_id,
          docId: r.doc_id,
          docName: doc.name,
          fileType: doc.file_type,
          text: r.text,
          startIndex: r.start_index ?? 0,
          endIndex: r.end_index ?? 0,
          tokenCount: r.token_count ?? 0,
          prevChunkId: r.prev_chunk_id,
          nextChunkId: r.next_chunk_id,
        }));

        const search = yield* SearchIndex;
        yield* search.addFromStoredChunks(
          docId,
          doc.name,
          doc.file_type,
          chunks,
        );
        return { docId };
      }),
    );
  })

  .delete("/:docId", async (c) => {
    const docId = c.req.param("docId");

    return runEffect(
      c,
      Effect.gen(function* () {
        const search = yield* SearchIndex;
        yield* search.removeDocument(docId);
        return { docId };
      }),
    );
  });
