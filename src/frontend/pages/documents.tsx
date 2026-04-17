"use client";

import { RefreshCcwIcon, UploadIcon } from "lucide-react";
import { useDashboard } from "@/components/dashboard/dashboard-shell";
import { DocumentsView } from "@/components/dashboard/views/documents-view";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useEmbedAllDocs, useReindexDocs } from "@/lib/hooks/use-docs";
import { RePixelLoader } from "@/components/custom/re-pixel-loader";

export const DocumentsPage = () => {
  const {
    documents,
    isLoading,
    openDocumentPreview,
    removeDocument,
    fileInputRef,
  } = useDashboard();

  const { trigger: reindex, isMutating: isReindexing } = useReindexDocs();
  const { trigger: embedAll, isMutating: isEmbedding } = useEmbedAllDocs();
  const isProcessing = isReindexing || isEmbedding;

  return (
    <>
      <section className="flex justify-between items-center pr-6">
        <header className="page-header">
          <h1 className="page-header-label">Documents</h1>
        </header>
        <TooltipProvider>
          <div className="flex gap-4">
            <Tooltip>
              <TooltipTrigger
                disabled={isProcessing}
                onClick={() => {
                  reindex().then(() => embedAll());
                }}
              >
                {isReindexing ?
                  <RefreshCcwIcon className="size-4" /> :
                  <RePixelLoader pixelSize={1} gap={0.5} />
                }
              </TooltipTrigger>
              <TooltipContent>Re-index documents</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger onClick={() => fileInputRef?.current?.click()}>
                <UploadIcon className="size-4" />
              </TooltipTrigger>
              <TooltipContent>Upload files</TooltipContent>
            </Tooltip>
          </div>
        </TooltipProvider>
      </section>
      <DocumentsView
        documents={documents}
        isLoading={isLoading}
        onDelete={removeDocument}
        onPreview={openDocumentPreview}
      />
    </>
  );
};
