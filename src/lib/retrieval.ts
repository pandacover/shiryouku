import { Effect, Layer } from "effect";
import { reciprocalRankFusion } from "rerank";
import {
  SearchIndex,
  type SearchMatch,
  type SearchResultGroup,
} from "@/lib/search";
import { ChromaDb } from "@/lib/chroma";
import { Embeddings } from "@/lib/embed";
import { SearchIndexError, ChromaDBError, EmbeddingError } from "@/lib/errors";

export interface HybridResult {
  readonly chunkId: string;
  readonly text: string;
  readonly docId: string;
  readonly docName: string;
  readonly fileType: string;
  readonly startIndex: number;
  readonly endIndex: number;
  readonly tokenCount: number;
  readonly prevChunkId: string | null;
  readonly nextChunkId: string | null;
  readonly rrfScore: number;
  readonly source: "keyword" | "semantic" | "both";
}

interface RRFItem {
  readonly chunkId: string;
  readonly text: string;
  readonly docId: string;
  readonly docName: string;
  readonly fileType: string;
  readonly startIndex: number;
  readonly endIndex: number;
  readonly tokenCount: number;
  readonly prevChunkId: string | null;
  readonly nextChunkId: string | null;
}

function searchMatchToRRFItem(
  match: SearchMatch,
  doc: SearchResultGroup["doc"],
): RRFItem {
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

export const hybridSearch = (
  query: string,
  topK = 10,
): Effect.Effect<
  ReadonlyArray<HybridResult>,
  never,
  SearchIndex | ChromaDb | Embeddings
> =>
  Effect.gen(function* () {
    const search = yield* SearchIndex;
    const chroma = yield* ChromaDb;
    const embedSvc = yield* Embeddings;

    const [keywordResults, queryEmbedding] = yield* Effect.all(
      [
        search
          .search(query, topK)
          .pipe(
            Effect.catchTag("SearchIndexError", (e) =>
              Effect.logWarning(`BM25 search failed: ${String(e.cause)}`).pipe(
                Effect.as([]),
              ),
            ),
          ),
        embedSvc
          .embedText(query)
          .pipe(
            Effect.catchTag("EmbeddingError", (e) =>
              Effect.logWarning(`Embedding failed: ${String(e.cause)}`).pipe(
                Effect.as(null),
              ),
            ),
          ),
      ],
      { concurrency: 2 },
    );

    if (queryEmbedding === null) {
      return keywordResults.flatMap((group) =>
        group.matches.map((m) => ({
          ...searchMatchToRRFItem(m, group.doc),
          rrfScore: 0,
          source: "keyword" as const,
        })),
      );
    }

    const semanticResults = yield* chroma
      .querySimilar(queryEmbedding, topK)
      .pipe(
        Effect.catchTag("ChromaDBError", (e) =>
          Effect.logWarning(`Semantic search failed: ${String(e.cause)}`).pipe(
            Effect.as([]),
          ),
        ),
      );

    const keywordItems = keywordResults.flatMap((group) =>
      group.matches.map((m) => searchMatchToRRFItem(m, group.doc)),
    );

    const semanticItems: ReadonlyArray<RRFItem> = semanticResults.map((r) => ({
      chunkId: r.chunkId,
      text: r.text,
      docId: r.docId,
      docName: r.docName,
      fileType: r.fileType,
      startIndex: r.startIndex,
      endIndex: r.endIndex,
      tokenCount: r.tokenCount,
      prevChunkId: r.prevChunkId,
      nextChunkId: r.nextChunkId,
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
      RRFItem & { source: "keyword" | "semantic" | "both" }
    >();

    for (const item of keywordItems) {
      allItemsMap.set(item.chunkId, { ...item, source: "keyword" });
    }
    for (const item of semanticItems) {
      const existing = allItemsMap.get(item.chunkId);
      if (existing) {
        allItemsMap.set(item.chunkId, { ...existing, source: "both" });
      } else {
        allItemsMap.set(item.chunkId, { ...item, source: "semantic" });
      }
    }

    const sortedChunkIds = Array.from(rrfScores.keys());

    return sortedChunkIds
      .map((chunkId) => {
        const item = allItemsMap.get(chunkId);
        if (!item) return null;
        return { ...item, rrfScore: rrfScores.get(chunkId) ?? 0 };
      })
      .filter((r): r is HybridResult => r !== null);
  });

export function formatAnnotatedText(
  results: ReadonlyArray<HybridResult>,
): string {
  const groupedByDoc = new Map<
    string,
    { docName: string; fileType: string; chunks: HybridResult[] }
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
        const prevChunk = results.find((r) => r.chunkId === chunk.prevChunkId);
        if (prevChunk) {
          parts.push(prevChunk.text);
        }
      }

      parts.push(chunk.text);

      if (chunk.nextChunkId) {
        const nextChunk = results.find((r) => r.chunkId === chunk.nextChunkId);
        if (nextChunk) {
          parts.push(nextChunk.text);
        }
      }
    }
  }

  return parts.join("\n");
}
