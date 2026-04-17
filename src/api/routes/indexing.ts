import { Hono } from "hono";
import type { ReindexResponse } from "@/api/schemas/search";
import { getDb } from "@/lib/db";
import { reingestAllDocuments } from "@/lib/ingest";
import { searchIndex } from "@/lib/search";

export const indexingRoutes = new Hono()
  .post("/reindex", async (c) => {
    try {
      const result = await reingestAllDocuments();
      const response: ReindexResponse = {
        documentCount: result.documentCount,
        chunkCount: result.chunkCount,
      };
      return c.json({ data: response });
    } catch (err) {
      console.error("[Reindex Error]", err);
      const details =
        (err as Error).message || (err as Error).stack || String(err);
      return c.json({ error: "Reindex failed", details }, 500);
    }
  })

  .post("/add", async (c) => {
    const body = await c.req.json();
    const { docId } = body;

    if (!docId) {
      return c.json(
        {
          error: "Validation failed",
          details: "docId is required",
        },
        400,
      );
    }

    try {
      const db = await getDb();
      const doc = db
        .prepare("SELECT name, file_type FROM docs WHERE id = ?")
        .get(docId) as Record<string, unknown> | undefined;

      if (!doc) {
        return c.json({ error: "Document not found" }, 404);
      }

      const rows = db
        .prepare(
          "SELECT chunk_id, doc_id, text, start_index, end_index, token_count, prev_chunk_id, next_chunk_id FROM doc_chunks WHERE doc_id = ? ORDER BY start_index",
        )
        .all(docId) as Record<string, unknown>[];

      const chunks = rows.map((r) => ({
        chunkId: r.chunk_id as string,
        docId: r.doc_id as string,
        docName: doc.name as string,
        fileType: doc.file_type as string,
        text: r.text as string,
        startIndex: r.start_index as number,
        endIndex: r.end_index as number,
        tokenCount: r.token_count as number,
        prevChunkId: (r.prev_chunk_id as string) || null,
        nextChunkId: (r.next_chunk_id as string) || null,
      }));

      await searchIndex.addFromStoredChunks(
        docId,
        doc.name as string,
        doc.file_type as string,
        chunks,
      );
      return c.json({ data: { docId } }, 201);
    } catch (err) {
      console.error("[Index Add Error]", err);
      return c.json(
        { error: "Index add failed", details: (err as Error).message },
        500,
      );
    }
  })

  .delete("/:docId", async (c) => {
    const docId = c.req.param("docId");

    try {
      await searchIndex.removeDocument(docId);
      return c.json({ data: { docId } });
    } catch (err) {
      console.error("[Index Remove Error]", err);
      return c.json(
        { error: "Index remove failed", details: (err as Error).message },
        500,
      );
    }
  });
