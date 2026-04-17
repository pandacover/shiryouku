import type { Metadata } from "chromadb";
import { reciprocalRankFusion } from "rerank";
import { getOrCreateCollection } from "@/lib/chroma";
import { embedText } from "@/lib/embed";
import type { SearchMatch, SearchResultGroup } from "@/lib/search";
import { searchIndex } from "@/lib/search";

interface HybridResult {
  chunkId: string;
  text: string;
  docId: string;
  docName: string;
  fileType: string;
  startIndex: number;
  endIndex: number;
  tokenCount: number;
  prevChunkId: string | null;
  nextChunkId: string | null;
  rrfScore: number;
  source: "keyword" | "semantic" | "both";
}

function searchMatchToRRFItem(
  match: SearchMatch,
  doc: SearchResultGroup["doc"],
) {
  return {
    chunkId: match.chunkId,
    text: match.text,
    docId: doc.id,
    docName: doc.name,
    fileType: doc.fileType,
    startIndex: match.startIndex,
    endIndex: match.endIndex,
    tokenCount: match.tokenCount,
    prevChunkId: match.prevChunkId,
    nextChunkId: match.nextChunkId,
  };
}

export async function hybridSearch(
  query: string,
  topK = 10,
): Promise<HybridResult[]> {
  const [keywordResults, semanticResults] = await Promise.all([
    searchIndex.search(query, topK).catch(() => [] as SearchResultGroup[]),
    semanticSearch(query, topK).catch(() => []),
  ]);

  const keywordItems = keywordResults.flatMap((group) =>
    group.matches.map((m) => searchMatchToRRFItem(m, group.doc)),
  );

  const semanticItems = semanticResults.map((r) => ({
    chunkId: r.chunkId,
    text: r.text,
    docId: r.docId,
    docName: r.docName,
    fileType: r.fileType,
    startIndex: r.startIndex,
    endIndex: r.endIndex,
    tokenCount: r.tokenCount,
    prevChunkId: r.prevChunkId as string | null,
    nextChunkId: r.nextChunkId as string | null,
  }));

  const keywordRankedLists = keywordItems.map((item) => ({
    ...item,
    chunkId: item.chunkId,
  }));

  const semanticRankedLists = semanticItems.map((item) => ({
    ...item,
    chunkId: item.chunkId,
  }));

  const rrfScores = reciprocalRankFusion(
    [keywordRankedLists, semanticRankedLists],
    "chunkId",
  );

  const allItemsMap = new Map<
    string,
    (typeof keywordItems)[0] & { source: "keyword" | "semantic" | "both" }
  >();

  for (const item of keywordItems) {
    allItemsMap.set(item.chunkId, { ...item, source: "keyword" });
  }
  for (const item of semanticItems) {
    const existing = allItemsMap.get(item.chunkId);
    if (existing) {
      existing.source = "both";
    } else {
      allItemsMap.set(item.chunkId, { ...item, source: "semantic" });
    }
  }

  const sortedChunkIds = Array.from(rrfScores.keys());

  return sortedChunkIds
    .map((chunkId) => {
      const item = allItemsMap.get(chunkId);
      if (!item) return null;
      return {
        ...item,
        rrfScore: rrfScores.get(chunkId) ?? 0,
      };
    })
    .filter((r): r is HybridResult => r !== null);
}

async function semanticSearch(
  query: string,
  topK: number,
): Promise<
  Array<{
    chunkId: string;
    text: string;
    docId: string;
    docName: string;
    fileType: string;
    startIndex: number;
    endIndex: number;
    tokenCount: number;
    prevChunkId: string | null;
    nextChunkId: string | null;
  }>
> {
  const queryEmbedding = await embedText(query);

  const collection = await getOrCreateCollection();
  const results = await collection.query({
    queryEmbeddings: [queryEmbedding],
    nResults: topK,
    include: ["documents", "metadatas", "distances"] as Array<
      "documents" | "metadatas" | "distances"
    >,
  });

  const chunks: Array<{
    chunkId: string;
    text: string;
    docId: string;
    docName: string;
    fileType: string;
    startIndex: number;
    endIndex: number;
    tokenCount: number;
    prevChunkId: string | null;
    nextChunkId: string | null;
  }> = [];

  const ids = results.ids[0] ?? [];
  const documents = results.documents[0] ?? [];
  const metadatas = results.metadatas[0] ?? [];

  for (let i = 0; i < ids.length; i++) {
    const meta = metadatas[i] as Metadata | null;
    const doc = documents[i];
    chunks.push({
      chunkId: ids[i],
      text: doc ?? "",
      docId: (meta?.docId as string) ?? "",
      docName: (meta?.docName as string) ?? "",
      fileType: (meta?.fileType as string) ?? "",
      startIndex: Number(meta?.startIndex ?? 0),
      endIndex: Number(meta?.endIndex ?? 0),
      tokenCount: Number(meta?.tokenCount ?? 0),
      prevChunkId: (meta?.prevChunkId as string) || null,
      nextChunkId: (meta?.nextChunkId as string) || null,
    });
  }

  return chunks;
}

export function formatAnnotatedText(results: HybridResult[]): string {
  const groupedByDoc = new Map<
    string,
    {
      docName: string;
      fileType: string;
      chunks: HybridResult[];
    }
  >();

  for (const result of results) {
    if (!groupedByDoc.has(result.docId)) {
      groupedByDoc.set(result.docId, {
        docName: result.docName,
        fileType: result.fileType,
        chunks: [],
      });
    }
    groupedByDoc.get(result.docId)?.chunks.push(result);
  }

  const parts: string[] = [];

  for (const [, group] of groupedByDoc) {
    parts.push(`[SOURCE: ${group.docName}]`);
    parts.push("[METADATA]");
    parts.push(`fileType: ${group.fileType}`);
    parts.push("[CONTEXT]");

    for (const chunk of group.chunks) {
      if (chunk.prevChunkId) {
        const prevChunk = findChunkInResults(chunk.prevChunkId, results);
        if (prevChunk) {
          parts.push(prevChunk.text);
        }
      }

      parts.push(chunk.text);

      if (chunk.nextChunkId) {
        const nextChunk = findChunkInResults(chunk.nextChunkId, results);
        if (nextChunk) {
          parts.push(nextChunk.text);
        }
      }
    }
  }

  return parts.join("\n");
}

function findChunkInResults(
  chunkId: string,
  results: HybridResult[],
): HybridResult | undefined {
  return results.find((r) => r.chunkId === chunkId);
}
