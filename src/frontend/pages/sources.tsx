"use client";

import { GlobeIcon, PlusIcon } from "lucide-react";
import { type FormEvent, useMemo, useState } from "react";
import {
  formatFileSize,
  formatUpdatedAt,
} from "@/components/dashboard/dashboard-utils";
import { SourcesView } from "@/components/dashboard/views/sources-view";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  useCreateSource,
  useDeleteSource,
  useRefreshSource,
  useSource,
  useSources,
} from "@/lib/hooks/use-sources";

export const SourcesPage = () => {
  const [url, setUrl] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [previewSourceId, setPreviewSourceId] = useState<string | null>(null);
  const [refreshingId, setRefreshingId] = useState<string | null>(null);

  const { data, isLoading, mutate } = useSources();
  const { data: previewDetail } = useSource(previewSourceId);
  const { trigger: createSource, isMutating: isCreating } = useCreateSource();
  const { trigger: refreshSource } = useRefreshSource();
  const { trigger: deleteSource } = useDeleteSource();

  const sources = useMemo(() => data?.data ?? [], [data]);
  const previewSource = previewDetail?.data ?? null;

  const addSource = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmed = url.trim();
    if (!trimmed) return;

    setError(null);
    try {
      await createSource({ url: trimmed });
      setUrl("");
      await mutate();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  };

  const refresh = async (sourceId: string) => {
    setError(null);
    setRefreshingId(sourceId);
    try {
      await refreshSource(sourceId);
      await mutate();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setRefreshingId(null);
    }
  };

  const remove = async (sourceId: string) => {
    setError(null);
    await deleteSource(sourceId);
    if (previewSourceId === sourceId) {
      setPreviewSourceId(null);
    }
    await mutate();
  };

  return (
    <>
      <section className="flex items-center justify-between pr-6">
        <header className="page-header">
          <h1 className="page-header-label">Sources</h1>
        </header>
        <form
          className="flex w-full max-w-xl items-center gap-2"
          onSubmit={addSource}
        >
          <Input
            aria-label="Website URL"
            onChange={(event) => setUrl(event.target.value)}
            placeholder="https://example.com/page"
            type="url"
            value={url}
          />
          <Button disabled={isCreating || !url.trim()} type="submit">
            {isCreating ? (
              <GlobeIcon className="size-4 animate-spin" />
            ) : (
              <PlusIcon className="size-4" />
            )}
            Add
          </Button>
        </form>
      </section>
      {error && (
        <p className="mx-6 border border-destructive/30 bg-destructive/10 p-3 text-destructive text-sm">
          {error}
        </p>
      )}
      <SourcesView
        isLoading={isLoading}
        onDelete={remove}
        onPreview={setPreviewSourceId}
        onRefresh={refresh}
        refreshingId={refreshingId}
        sources={sources}
      />
      <Dialog
        onOpenChange={(isOpen) => {
          if (!isOpen) setPreviewSourceId(null);
        }}
        open={previewSource !== null}
      >
        <DialogContent className="w-9/12">
          <DialogHeader>
            <DialogTitle>
              {previewSource?.title || "Source Preview"}
            </DialogTitle>
            <DialogDescription>
              {previewSource
                ? `${formatFileSize(previewSource.size)} | Fetched ${
                    previewSource.lastFetchedAt
                      ? formatUpdatedAt(previewSource.lastFetchedAt)
                      : "never"
                  }`
                : ""}
            </DialogDescription>
          </DialogHeader>
          <p className="break-all text-muted-foreground text-xs">
            {previewSource?.canonicalUrl || previewSource?.url || ""}
          </p>
          <pre className="max-h-[60vh] overflow-auto border bg-muted/30 p-3 text-xs whitespace-pre-wrap break-words">
            {previewSource?.content || ""}
          </pre>
        </DialogContent>
      </Dialog>
    </>
  );
};
