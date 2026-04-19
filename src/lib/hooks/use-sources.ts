import type { SWRConfiguration } from "swr";
import useSWR from "swr";
import useSWRMutation from "swr/mutation";
import {
  createSource,
  deleteSource,
  fetcher,
  refreshSource,
  type SourceDetailResponse,
  type SourceListResponse,
  type SourceMutationResponse,
} from "@/lib/api";

export function useSources(
  options?: SWRConfiguration<SourceListResponse, Error>,
) {
  return useSWR<SourceListResponse, Error>("/sources", fetcher, options);
}

export function useSource(
  id: string | null,
  options?: SWRConfiguration<SourceDetailResponse, Error>,
) {
  return useSWR<SourceDetailResponse, Error>(
    id ? `/sources/${id}` : null,
    fetcher,
    options,
  );
}

export function useCreateSource() {
  return useSWRMutation(
    "/sources",
    async (
      _key: string,
      { arg }: { arg: Parameters<typeof createSource>[0] },
    ) => createSource(arg),
  ) as ReturnType<
    typeof useSWRMutation<
      SourceMutationResponse,
      Error,
      string,
      Parameters<typeof createSource>[0]
    >
  >;
}

export function useRefreshSource() {
  return useSWRMutation(
    "/sources",
    async (_key: string, { arg }: { arg: string }) => refreshSource(arg),
  ) as ReturnType<
    typeof useSWRMutation<SourceMutationResponse, Error, string, string>
  >;
}

export function useDeleteSource() {
  return useSWRMutation(
    "/sources",
    async (_key: string, { arg }: { arg: string }) => deleteSource(arg),
  ) as ReturnType<typeof useSWRMutation<string, Error, string, string>>;
}
