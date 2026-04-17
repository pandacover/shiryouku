import { BM25 } from "fast-bm25";
import type { ChunkMeta } from "@/lib/chunk";
import { getDb } from "@/lib/db";

export interface SearchMatch {
  chunkId: string;
  text: string;
  score: number;
  startIndex: number;
  endIndex: number;
  tokenCount: number;
  prevChunkId: string | null;
  nextChunkId: string | null;
  siblings: Array<{
    chunkId: string;
    text: string;
    direction: "prev" | "next";
  }>;
}

export interface SearchResultGroup {
  doc: { id: string; name: string; fileType: string };
  matches: SearchMatch[];
}

function rowToChunk(
  row: Record<string, unknown>,
  docName: string,
  fileType: string,
): ChunkMeta {
  return {
    chunkId: row.chunk_id as string,
    docId: row.doc_id as string,
    docName,
    fileType,
    text: row.text as string,
    startIndex: row.start_index as number,
    endIndex: row.end_index as number,
    tokenCount: row.token_count as number,
    prevChunkId: (row.prev_chunk_id as string) || null,
    nextChunkId: (row.next_chunk_id as string) || null,
  };
}

const CHUNKS_SQL =
  "SELECT chunk_id, doc_id, text, start_index, end_index, token_count, prev_chunk_id, next_chunk_id FROM doc_chunks WHERE doc_id = ? ORDER BY start_index";

class SearchIndex {
  private bm25: BM25 | null = null;
  private chunkMap: Map<string, ChunkMeta> = new Map();
  private indexToChunkId: string[] = [];
  private docChunkIds: Map<string, string[]> = new Map();
  private docMeta: Map<string, { name: string; fileType: string }> = new Map();
  private initialized = false;
  private initPromise: Promise<void> | null = null;

  async ensureInitialized(): Promise<void> {
    if (this.initialized) return;
    if (!this.initPromise) {
      this.initPromise = this.initialize();
    }
    await this.initPromise;
  }

  private async initialize(): Promise<void> {
    const db = await getDb();

    const docs = db.prepare("SELECT * FROM docs").all() as Record<
      string,
      unknown
    >[];

    this.bm25 = new BM25([], { stemming: true });
    this.chunkMap = new Map();
    this.indexToChunkId = [];
    this.docChunkIds = new Map();
    this.docMeta = new Map();

    for (const doc of docs) {
      const docId = doc.id as string;
      const docName = doc.name as string;
      const fileType = doc.file_type as string;

      this.docMeta.set(docId, { name: docName, fileType });

      const rows = db.prepare(CHUNKS_SQL).all(docId) as Record<
        string,
        unknown
      >[];
      if (rows.length === 0) continue;

      const chunkIds: string[] = [];
      for (const row of rows) {
        const chunk = rowToChunk(row, docName, fileType);
        this.chunkMap.set(chunk.chunkId, chunk);
        this.indexToChunkId.push(chunk.chunkId);
        chunkIds.push(chunk.chunkId);
        await this.bm25.addDocument({
          text: chunk.text,
          docName: chunk.docName,
        });
      }
      this.docChunkIds.set(docId, chunkIds);
    }

    this.initialized = true;
  }

  async addFromStoredChunks(
    docId: string,
    docName: string,
    fileType: string,
    chunks: ChunkMeta[],
  ): Promise<void> {
    await this.ensureInitialized();

    if (this.docChunkIds.has(docId)) {
      await this.removeDocument(docId);
    }

    if (chunks.length === 0) return;

    this.docMeta.set(docId, { name: docName, fileType });

    const chunkIds: string[] = [];
    for (const chunk of chunks) {
      const enriched: ChunkMeta = { ...chunk, docName, fileType };
      this.chunkMap.set(chunk.chunkId, enriched);
      this.indexToChunkId.push(chunk.chunkId);
      chunkIds.push(chunk.chunkId);
      await this.bm25?.addDocument({
        text: chunk.text,
        docName,
      });
    }
    this.docChunkIds.set(docId, chunkIds);
  }

  async removeDocument(docId: string): Promise<void> {
    await this.ensureInitialized();

    const chunkIds = this.docChunkIds.get(docId);
    if (!chunkIds) return;

    for (const id of chunkIds) {
      this.chunkMap.delete(id);
    }
    this.docChunkIds.delete(docId);
    this.docMeta.delete(docId);

    await this.rebuildIndex();
  }

  async search(query: string, topK = 10): Promise<SearchResultGroup[]> {
    await this.ensureInitialized();

    if (!query.trim() || !this.bm25) return [];

    const results = this.bm25.searchPhrase(query, topK);

    const groupedResults = new Map<
      string,
      {
        doc: { id: string; name: string; fileType: string };
        matches: SearchMatch[];
      }
    >();

    for (const result of results) {
      const chunkId = this.indexToChunkId[result.index];
      if (!chunkId) continue;

      const chunk = this.chunkMap.get(chunkId);
      if (!chunk) continue;

      const prevChunk = chunk.prevChunkId
        ? this.chunkMap.get(chunk.prevChunkId)
        : null;
      const nextChunk = chunk.nextChunkId
        ? this.chunkMap.get(chunk.nextChunkId)
        : null;

      const siblings: SearchMatch["siblings"] = [];
      if (prevChunk) {
        siblings.push({
          chunkId: prevChunk.chunkId,
          text: prevChunk.text,
          direction: "prev",
        });
      }
      if (nextChunk) {
        siblings.push({
          chunkId: nextChunk.chunkId,
          text: nextChunk.text,
          direction: "next",
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
        const meta = this.docMeta.get(docId) || {
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
  }

  getConstellationData(): {
    documents: Array<{
      id: string;
      name: string;
      fileType: string;
      chunks: Array<{
        chunkId: string;
        text: string;
        startIndex: number;
        endIndex: number;
        tokenCount: number;
        prevChunkId: string | null;
        nextChunkId: string | null;
      }>;
    }>;
  } {
    const documents: Array<{
      id: string;
      name: string;
      fileType: string;
      chunks: Array<{
        chunkId: string;
        text: string;
        startIndex: number;
        endIndex: number;
        tokenCount: number;
        prevChunkId: string | null;
        nextChunkId: string | null;
      }>;
    }> = [];

    for (const [docId, chunkIds] of this.docChunkIds) {
      const meta = this.docMeta.get(docId);
      if (!meta) continue;

      const chunks = chunkIds
        .map((id) => this.chunkMap.get(id))
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
  }

  async reindex(): Promise<{ documentCount: number; chunkCount: number }> {
    this.initialized = false;
    this.initPromise = null;
    await this.ensureInitialized();
    return {
      documentCount: this.docMeta.size,
      chunkCount: this.chunkMap.size,
    };
  }

  private async rebuildIndex(): Promise<void> {
    this.bm25 = new BM25([], { stemming: true });
    this.indexToChunkId = [];

    for (const [docId, chunkIds] of this.docChunkIds) {
      const meta = this.docMeta.get(docId);
      if (!meta) continue;

      for (const chunkId of chunkIds) {
        const chunk = this.chunkMap.get(chunkId);
        if (!chunk) continue;

        this.indexToChunkId.push(chunkId);
        await this.bm25.addDocument({
          text: chunk.text,
          docName: meta.name,
        });
      }
    }
  }
}

export const searchIndex = new SearchIndex();
