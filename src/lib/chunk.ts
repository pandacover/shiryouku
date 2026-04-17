import type { Chunk } from "@chonkiejs/core";
import { RecursiveChunker } from "@chonkiejs/core";
import { nanoid } from "nanoid";

const CHUNKABLE_TYPES = new Set(["txt", "text/plain", "md", "markdown"]);
const DEFAULT_CHUNK_SIZE = 512;
const OVERLAP_RATIO = 0.2;

export interface ChunkMeta {
  chunkId: string;
  docId: string;
  docName: string;
  fileType: string;
  text: string;
  startIndex: number;
  endIndex: number;
  tokenCount: number;
  prevChunkId: string | null;
  nextChunkId: string | null;
}

let chunkerInstance: RecursiveChunker | null = null;
let chunkerInitPromise: Promise<RecursiveChunker> | null = null;

async function getChunker(): Promise<RecursiveChunker> {
  if (chunkerInstance) return chunkerInstance;
  if (!chunkerInitPromise) {
    chunkerInitPromise = RecursiveChunker.create({
      chunkSize: DEFAULT_CHUNK_SIZE,
    });
  }
  chunkerInstance = await chunkerInitPromise;
  return chunkerInstance;
}

export function isChunkable(fileType: string): boolean {
  const ext = fileType.toLowerCase().replace(/^\./, "");
  return CHUNKABLE_TYPES.has(ext);
}

function applyOverlap(
  rawChunks: Chunk[],
  originalText: string,
): Omit<
  ChunkMeta,
  "chunkId" | "docId" | "docName" | "fileType" | "prevChunkId" | "nextChunkId"
>[] {
  if (rawChunks.length === 0) return [];

  const result: Omit<
    ChunkMeta,
    "chunkId" | "docId" | "docName" | "fileType" | "prevChunkId" | "nextChunkId"
  >[] = [];

  for (let i = 0; i < rawChunks.length; i++) {
    const raw = rawChunks[i];
    const chunkLen = raw.endIndex - raw.startIndex;
    const currentOverlap = Math.floor((chunkLen * OVERLAP_RATIO) / 2);

    const startIdx =
      i > 0 ? Math.max(0, raw.startIndex - currentOverlap) : raw.startIndex;
    const endIdx =
      i < rawChunks.length - 1
        ? Math.min(originalText.length, raw.endIndex + currentOverlap)
        : raw.endIndex;

    const newLen = endIdx - startIdx;
    const adjustedTokenCount =
      chunkLen > 0
        ? Math.round(raw.tokenCount * (newLen / chunkLen))
        : raw.tokenCount;

    result.push({
      text: originalText.slice(startIdx, endIdx),
      startIndex: startIdx,
      endIndex: endIdx,
      tokenCount: adjustedTokenCount,
    });
  }

  return result;
}

export async function chunkDocument(
  docId: string,
  docName: string,
  fileType: string,
  text: string,
): Promise<ChunkMeta[]> {
  if (!isChunkable(fileType) || !text.trim()) return [];

  const chunker = await getChunker();
  const rawChunks = await chunker.chunk(text);

  if (rawChunks.length === 0) return [];

  const overlapped = applyOverlap(rawChunks, text);

  const chunks: ChunkMeta[] = overlapped.map((c) => ({
    ...c,
    chunkId: nanoid(),
    docId,
    docName,
    fileType,
    prevChunkId: null,
    nextChunkId: null,
  }));

  for (let i = 0; i < chunks.length; i++) {
    chunks[i].prevChunkId = i > 0 ? chunks[i - 1].chunkId : null;
    chunks[i].nextChunkId =
      i < chunks.length - 1 ? chunks[i + 1].chunkId : null;
  }

  return chunks;
}
