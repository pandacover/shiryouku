export type ApiResponse<T> = { data: T } | { error: string; details?: unknown };

const BASE_URL = "/api";

export async function fetcher<T>(url: string): Promise<T> {
  const res = await fetch(`${BASE_URL}${url}`);

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(
      ((body as Record<string, unknown>).error as string) ??
        `Request failed: ${res.status}`,
    );
  }

  return res.json() as Promise<T>;
}

export async function createDoc(body: {
  name: string;
  fileType: string;
  size: number;
  content?: string;
}) {
  const res = await fetch(`${BASE_URL}/docs`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(
      ((data as Record<string, unknown>).error as string) ??
        `Create failed: ${res.status}`,
    );
  }

  const json = (await res.json()) as ApiResponse<DocWithContent>;
  return "data" in json ? json.data : json;
}

export async function updateDoc(
  id: string,
  body: { name?: string; fileType?: string; size?: number },
) {
  const res = await fetch(`${BASE_URL}/docs/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(
      ((data as Record<string, unknown>).error as string) ??
        `Update failed: ${res.status}`,
    );
  }

  const json = (await res.json()) as ApiResponse<DocResponse>;
  return "data" in json ? json.data : json;
}

export async function deleteDoc(id: string) {
  const res = await fetch(`${BASE_URL}/docs/${id}`, { method: "DELETE" });

  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(
      ((data as Record<string, unknown>).error as string) ??
        `Delete failed: ${res.status}`,
    );
  }

  return id;
}

export async function updateDocContent(id: string, content: string) {
  const res = await fetch(`${BASE_URL}/docs/${id}/content`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ content }),
  });

  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(
      ((data as Record<string, unknown>).error as string) ??
        `Update content failed: ${res.status}`,
    );
  }

  const json = (await res.json()) as ApiResponse<DocContent>;
  return "data" in json ? json.data : json;
}

export interface DocResponse {
  id: string;
  name: string;
  fileType: string;
  size: number;
  createdAt: number;
  updatedAt: number;
}

export interface DocContent {
  id: string;
  docId: string;
  content: string;
  createdAt: number;
  updatedAt: number;
}

export interface DocWithContent extends DocResponse {
  content: string;
}

export type DocListResponse = { data: DocResponse[] };
export type DocDetailResponse = { data: DocWithContent };

export interface SearchMatchResult {
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
  matches: SearchMatchResult[];
}

export interface SearchResponse {
  results: SearchResultGroup[];
}

export async function searchDocs(query: string, limit = 10) {
  const params = new URLSearchParams({ q: query, limit: String(limit) });
  const res = await fetch(`${BASE_URL}/search?${params}`);

  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(
      ((data as Record<string, unknown>).error as string) ??
        `Search failed: ${res.status}`,
    );
  }

  const json = (await res.json()) as ApiResponse<{
    results: SearchResultGroup[];
  }>;
  return "data" in json ? json.data : json;
}

export interface ReindexResponse {
  documentCount: number;
  chunkCount: number;
}

export interface EmbedAllResponse {
  documentCount: number;
  chunkCount: number;
}

export async function reindexDocs() {
  const res = await fetch(`${BASE_URL}/indexing/reindex`, { method: "POST" });

  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    const error =
      (data as Record<string, unknown>).error ?? `Reindex failed: ${res.status}`;
    const details = (data as Record<string, unknown>).details;
    throw new Error(
      details ? `${error}: ${details}` : (error as string),
    );
  }

  const json = (await res.json()) as ApiResponse<ReindexResponse>;
  return "data" in json ? json.data : json;
}

export interface ConstellationChunk {
  chunkId: string;
  text: string;
  startIndex: number;
  endIndex: number;
  tokenCount: number;
  prevChunkId: string | null;
  nextChunkId: string | null;
}

export interface ConstellationDocument {
  id: string;
  name: string;
  fileType: string;
  chunks: ConstellationChunk[];
}

export interface ConstellationResponse {
  documents: ConstellationDocument[];
}

export async function fetchConstellation() {
  const res = await fetch(`${BASE_URL}/docs/constellation`);

  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(
      ((data as Record<string, unknown>).error as string) ??
        `Fetch constellation failed: ${res.status}`,
    );
  }

  const json = (await res.json()) as ApiResponse<ConstellationResponse>;
  return "data" in json ? json.data : json;
}

export async function embedAllDocs() {
  const res = await fetch(`${BASE_URL}/embedding/embed-all`, {
    method: "POST",
  });

  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(
      ((data as Record<string, unknown>).error as string) ??
        `Embed all failed: ${res.status}`,
    );
  }

  const json = (await res.json()) as ApiResponse<EmbedAllResponse>;
  return "data" in json ? json.data : json;
}
