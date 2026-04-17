import { z } from "zod";

export const searchQuerySchema = z.object({
  q: z.string().min(1),
  limit: z.coerce.number().int().min(1).max(50).default(10),
});

export type SearchQueryInput = z.infer<typeof searchQuerySchema>;

export const indexDocSchema = z.object({
  docId: z.string().min(1),
  docName: z.string().min(1),
  fileType: z.string().min(1),
  content: z.string(),
});

export type IndexDocInput = z.infer<typeof indexDocSchema>;

export const removeDocIndexSchema = z.object({
  docId: z.string().min(1),
});

export type RemoveDocIndexInput = z.infer<typeof removeDocIndexSchema>;

export interface ReindexResponse {
  documentCount: number;
  chunkCount: number;
}

export interface SearchMatchResponse {
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

export interface SearchResultGroupResponse {
  doc: { id: string; name: string; fileType: string };
  matches: SearchMatchResponse[];
}

export interface SearchResponse {
  results: SearchResultGroupResponse[];
}
