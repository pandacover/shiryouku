"use client";

import {
  type ChangeEvent,
  createContext,
  type ReactNode,
  type RefObject,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
} from "react";
import type {
  DocumentMeta,
  DocumentWithContent,
} from "@/components/dashboard/dashboard-types";
import { DocumentPreviewDialog } from "@/components/dashboard/dialogs/document-preview-dialog";
import { SidebarNavigation } from "@/components/dashboard/sidebar-navigation";
import {
  useCreateDoc,
  useDeleteDoc,
  useDoc,
  useDocs,
} from "@/lib/hooks/use-docs";

interface DashboardContextValue {
  documents: DocumentMeta[];
  isLoading: boolean;
  openDocumentPreview: (documentId: string) => void;
  removeDocument: (documentId: string) => void;
  uploadFiles: (event: ChangeEvent<HTMLInputElement>) => Promise<void>;
  fileInputRef: RefObject<HTMLInputElement | null>;
}

const DashboardContext = createContext<DashboardContextValue | null>(null);

export const useDashboard = () => {
  const context = useContext(DashboardContext);

  if (!context) {
    throw new Error("useDashboard must be used within DashboardShell");
  }

  return context;
};

interface DashboardShellProps {
  children: ReactNode;
}

export const DashboardShell = ({ children }: DashboardShellProps) => {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [previewDocId, setPreviewDocId] = useState<string | null>(null);

  const { data: docsResponse, isLoading, mutate: mutateDocs } = useDocs();
  const { trigger: createTrigger } = useCreateDoc();
  const { trigger: deleteTrigger } = useDeleteDoc();

  const { data: previewDetail } = useDoc(previewDocId);

  const documents = useMemo<DocumentMeta[]>(() => {
    if (!docsResponse?.data) return [];
    return docsResponse.data;
  }, [docsResponse]);

  const openDocumentPreview = useCallback((documentId: string) => {
    setPreviewDocId(documentId);
  }, []);

  const removeDocument = useCallback(
    async (documentId: string) => {
      await deleteTrigger(documentId);
      await mutateDocs();
      if (previewDocId === documentId) {
        setPreviewDocId(null);
      }
    },
    [deleteTrigger, mutateDocs, previewDocId],
  );

  const uploadFiles = useCallback(
    async (event: ChangeEvent<HTMLInputElement>) => {
      const uploadedFiles = event.currentTarget.files;

      if (!uploadedFiles || uploadedFiles.length === 0) {
        return;
      }

      const textPreviewExtensions = new Set([
        "txt",
        "md",
        "markdown",
        "json",
        "csv",
        "ts",
        "tsx",
        "js",
        "jsx",
        "html",
        "css",
        "xml",
        "yml",
        "yaml",
      ]);

      const getFileExtension = (name: string) => {
        const segments = name.split(".");
        if (segments.length < 2) return "";
        return segments[segments.length - 1].toLowerCase();
      };

      const readFileAsText = async (file: File): Promise<string> => {
        const ext = getFileExtension(file.name);
        const canPreview =
          file.type.startsWith("text/") || textPreviewExtensions.has(ext);

        if (!canPreview) {
          return "Text preview is not available for this file type.";
        }

        try {
          const content = await file.text();
          if (content.trim().length === 0) return "This document is empty.";
          return content;
        } catch {
          return "Unable to read this document.";
        }
      };

      const creations = await Promise.all(
        Array.from(uploadedFiles).map(async (file) => {
          const ext = getFileExtension(file.name);
          const fileType = file.type || (ext ? ext.toUpperCase() : "Unknown");
          const content = await readFileAsText(file);

          return createTrigger({
            name: file.name,
            fileType,
            size: file.size,
            content,
          });
        }),
      );

      if (creations.length > 0) {
        await mutateDocs();
      }

      if (event.currentTarget?.value) {
        event.currentTarget.value = "";
      }
    },
    [createTrigger, mutateDocs],
  );

  const previewDocument: DocumentWithContent | null = useMemo(() => {
    if (!previewDocId || !previewDetail?.data) return null;
    return previewDetail.data;
  }, [previewDocId, previewDetail]);

  const contextValue = useMemo(
    () => ({
      documents,
      isLoading,
      openDocumentPreview,
      removeDocument,
      uploadFiles,
      fileInputRef,
    }),
    [documents, isLoading, openDocumentPreview, removeDocument, uploadFiles],
  );

  return (
    <DashboardContext.Provider value={contextValue}>
      <div className="flex min-h-screen w-full bg-background">
        <SidebarNavigation />
        <main className="flex min-w-0 flex-1 flex-col">{children}</main>
      </div>
      <input
        className="hidden"
        multiple
        onChange={uploadFiles}
        ref={fileInputRef}
        type="file"
      />

      <DocumentPreviewDialog
        document={previewDocument}
        onClose={() => setPreviewDocId(null)}
      />
    </DashboardContext.Provider>
  );
};
