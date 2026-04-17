import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import { embed, embedMany } from "ai";
import { getOrCreateCollection } from "@/lib/chroma";
import { getDb } from "@/lib/db";

const openrouter = createOpenRouter({
  apiKey: process.env.OPENROUTER_API_KEY,
});

const embeddingModel = openrouter.textEmbeddingModel(
  "perplexity/pplx-embed-v1-4b",
);

export async function embedText(text: string): Promise<number[]> {
  const { embedding } = await embed({
    model: embeddingModel,
    value: text,
  });
  return embedding;
}

export async function embedTexts(texts: string[]): Promise<number[][]> {
  const { embeddings } = await embedMany({
    model: embeddingModel,
    values: texts,
  });
  return embeddings;
}

export async function embedDocChunks(
  docId: string,
): Promise<{ chunkCount: number }> {
  const db = await getDb();

  const doc = db
    .prepare("SELECT name, file_type FROM docs WHERE id = ?")
    .get(docId) as Record<string, unknown> | undefined;

  if (!doc) throw new Error(`Document ${docId} not found`);

  const docName = doc.name as string;
  const fileType = doc.file_type as string;

  const rows = db
    .prepare(
      "SELECT chunk_id, text, start_index, end_index, token_count, prev_chunk_id, next_chunk_id FROM doc_chunks WHERE doc_id = ? ORDER BY start_index",
    )
    .all(docId) as Record<string, unknown>[];

  if (rows.length === 0) return { chunkCount: 0 };

  const texts = rows.map((r) => r.text as string);
  const embeddings = await embedTexts(texts);

  const collection = await getOrCreateCollection();
  await collection.upsert({
    ids: rows.map((r) => r.chunk_id as string),
    embeddings,
    documents: texts,
    metadatas: rows.map((r) => ({
      docId,
      docName,
      fileType,
      startIndex: String(r.start_index),
      endIndex: String(r.end_index),
      tokenCount: String(r.token_count),
      prevChunkId: (r.prev_chunk_id as string) || "",
      nextChunkId: (r.next_chunk_id as string) || "",
    })),
  });

  return { chunkCount: rows.length };
}

export async function embedAllDocChunks(): Promise<{
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
    const result = await embedDocChunks(docId);
    totalChunks += result.chunkCount;
    if (result.chunkCount > 0) docCount++;
  }

  return { documentCount: docCount, chunkCount: totalChunks };
}

export async function removeDocumentFromChroma(docId: string): Promise<void> {
  const collection = await getOrCreateCollection();
  await collection.delete({
    where: { docId } as Record<string, string>,
  });
}
