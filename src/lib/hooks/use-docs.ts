import type { SWRConfiguration } from "swr";
import useSWR from "swr";
import useSWRMutation from "swr/mutation";
import {
  type ConstellationResponse,
  createDoc,
  type DocContent,
  type DocDetailResponse,
  type DocListResponse,
  type DocResponse,
  type DocWithContent,
  deleteDoc,
  type EmbedAllResponse,
  embedAllDocs,
  fetchConstellation,
  fetcher,
  type ReindexResponse,
  reindexDocs,
  type SearchResponse,
  searchDocs,
  updateDoc,
  updateDocContent,
} from "@/lib/api";

export function useDocs(options?: SWRConfiguration<DocListResponse, Error>) {
  return useSWR<DocListResponse, Error>("/docs", fetcher, options);
}

export function useDoc(
  id: string | null,
  options?: SWRConfiguration<DocDetailResponse, Error>,
) {
  return useSWR<DocDetailResponse, Error>(
    id ? `/docs/${id}` : null,
    fetcher,
    options,
  );
}

export function useDocContent(
  id: string | null,
  options?: SWRConfiguration<{ data: DocContent }, Error>,
) {
  return useSWR<{ data: DocContent }, Error>(
    id ? `/docs/${id}/content` : null,
    fetcher,
    options,
  );
}

export function useCreateDoc() {
  return useSWRMutation(
    "/docs",
    async (_key: string, { arg }: { arg: Parameters<typeof createDoc>[0] }) => {
      return createDoc(arg);
    },
  ) as ReturnType<
    typeof useSWRMutation<
      DocWithContent,
      Error,
      string,
      Parameters<typeof createDoc>[0]
    >
  >;
}

export function useDeleteDoc() {
  return useSWRMutation(
    "/docs",
    async (_key: string, { arg }: { arg: string }) => {
      return deleteDoc(arg);
    },
  ) as ReturnType<typeof useSWRMutation<string, Error, string, string>>;
}

export function useUpdateDoc() {
  type UpdateArg = { id: string; data: Parameters<typeof updateDoc>[1] };

  return useSWRMutation(
    "/docs",
    async (_key: string, { arg }: { arg: UpdateArg }) => {
      return updateDoc(arg.id, arg.data);
    },
  ) as ReturnType<typeof useSWRMutation<DocResponse, Error, string, UpdateArg>>;
}

export function useUpdateDocContent() {
  type ContentArg = { id: string; content: string };

  return useSWRMutation(
    "/docs",
    async (_key: string, { arg }: { arg: ContentArg }) => {
      return updateDocContent(arg.id, arg.content);
    },
  ) as ReturnType<typeof useSWRMutation<DocContent, Error, string, ContentArg>>;
}

export function useSearchDocs() {
  type SearchArg = { query: string; limit?: number };

  return useSWRMutation(
    "/search",
    async (_key: string, { arg }: { arg: SearchArg }) => {
      return searchDocs(arg.query, arg.limit);
    },
  ) as ReturnType<
    typeof useSWRMutation<SearchResponse, Error, string, SearchArg>
  >;
}

export function useReindexDocs() {
  return useSWRMutation("/indexing/reindex", async () => {
    return reindexDocs();
  }) as ReturnType<typeof useSWRMutation<ReindexResponse, Error, string, void>>;
}

export function useEmbedAllDocs() {
  return useSWRMutation("/embedding/embed-all", async () => {
    return embedAllDocs();
  }) as ReturnType<
    typeof useSWRMutation<EmbedAllResponse, Error, string, void>
  >;
}

export function useConstellation(
  options?: SWRConfiguration<ConstellationResponse, Error>,
) {
  return useSWR<ConstellationResponse, Error>(
    "/docs/constellation",
    () => fetchConstellation() as Promise<ConstellationResponse>,
    options,
  );
}
