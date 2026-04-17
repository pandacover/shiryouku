import { getOrCreateCollection } from "@/lib/chroma";
import type { ChunkMeta } from "@/lib/chunk";
import { chunkDocument, isChunkable } from "@/lib/chunk";
import { getDb } from "@/lib/db";
import { embedTexts } from "@/lib/embed";
import { searchIndex } from "@/lib/search";

async function persistChunks(chunks: ChunkMeta[]) {
  const db = await getDb();

  db.transaction(() => {
    for (const c of chunks) {
      db.prepare(
        `INSERT INTO doc_chunks (chunk_id, doc_id, text, start_index, end_index, token_count, prev_chunk_id, next_chunk_id)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      ).run(
        c.chunkId,
        c.docId,
        c.text,
        c.startIndex,
        c.endIndex,
        c.tokenCount,
        c.prevChunkId,
        c.nextChunkId,
      );
    }
  });
}

async function deleteChunksByDocId(docId: string) {
  const db = await getDb();
  db.prepare("DELETE FROM doc_chunks WHERE doc_id = ?").run(docId);
}

async function deleteContentByDocId(docId: string) {
  const db = await getDb();
  db.prepare("DELETE FROM doc_contents WHERE doc_id = ?").run(docId);
}

async function removeFromChroma(docId: string) {
  const collection = await getOrCreateCollection();
  await collection.delete({
    where: { docId } as Record<string, string>,
  });
}

export async function ingestDocument(
  docId: string,
): Promise<{ chunkCount: number }> {
  const db = await getDb();

  const doc = db
    .prepare("SELECT name, file_type FROM docs WHERE id = ?")
    .get(docId) as Record<string, unknown> | undefined;

  if (!doc) throw new Error(`Document ${docId} not found`);

  const docName = doc.name as string;
  const fileType = doc.file_type as string;

  const contentRow = db
    .prepare("SELECT content FROM doc_contents WHERE doc_id = ?")
    .get(docId) as Record<string, unknown> | undefined;

  const text = (contentRow?.content as string) || "";

  await deleteChunksByDocId(docId);
  await searchIndex.removeDocument(docId).catch((err) => {
    console.error("[Ingest] Failed to remove from BM25:", err);
  });
  await removeFromChroma(docId).catch((err) => {
    console.error("[Ingest] Failed to remove from ChromaDB:", err);
  });

  if (!isChunkable(fileType) || !text.trim()) {
    return { chunkCount: 0 };
  }

  const chunks = await chunkDocument(docId, docName, fileType, text);
  if (chunks.length === 0) return { chunkCount: 0 };

  await persistChunks(chunks);

  await searchIndex.addFromStoredChunks(docId, docName, fileType, chunks);

  try {
    const embeddings = await embedTexts(chunks.map((c) => c.text));
    const collection = await getOrCreateCollection();
    await collection.upsert({
      ids: chunks.map((c) => c.chunkId),
      embeddings,
      documents: chunks.map((c) => c.text),
      metadatas: chunks.map((c) => ({
        docId: c.docId,
        docName,
        fileType,
        startIndex: String(c.startIndex),
        endIndex: String(c.endIndex),
        tokenCount: String(c.tokenCount),
        prevChunkId: c.prevChunkId ?? "",
        nextChunkId: c.nextChunkId ?? "",
      })),
    });
  } catch (err) {
    console.error("[Ingest Embed Error]", err);
  }

  return { chunkCount: chunks.length };
}

export async function removeDocumentFromAllStores(
  docId: string,
): Promise<void> {
  const errors: string[] = [];

  try {
    await deleteChunksByDocId(docId);
  } catch (err) {
    errors.push(
      `doc_chunks: ${err instanceof Error ? err.message : String(err)}`,
    );
  }

  try {
    await deleteContentByDocId(docId);
  } catch (err) {
    errors.push(
      `doc_contents: ${err instanceof Error ? err.message : String(err)}`,
    );
  }

  try {
    await searchIndex.removeDocument(docId);
  } catch (err) {
    errors.push(`bm25: ${err instanceof Error ? err.message : String(err)}`);
  }

  try {
    await removeFromChroma(docId);
  } catch (err) {
    errors.push(`chroma: ${err instanceof Error ? err.message : String(err)}`);
  }

  if (errors.length > 0) {
    console.error("[RemoveDocument] Partial failure for", docId, ":", errors);
  }
}

export async function reingestAllDocuments(): Promise<{
  documentCount: number;
  chunkCount: number;
}> {
  const db = await getDb();
  const docs = db.prepare("SELECT id FROM docs").all() as Record<
    string,
    unknown
  >[];

  let totalChunks = 0;
  let docCount = 0;

  for (const doc of docs) {
    const docId = doc.id as string;
    const result = await ingestDocument(docId);
    totalChunks += result.chunkCount;
    if (result.chunkCount > 0) docCount++;
  }

  return { documentCount: docCount, chunkCount: totalChunks };
}
