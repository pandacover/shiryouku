import type { DocumentWithContent } from "@/components/dashboard/dashboard-types";
import {
  formatFileSize,
  formatUpdatedAt,
} from "@/components/dashboard/dashboard-utils";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface DocumentPreviewDialogProps {
  document: DocumentWithContent | null;
  onClose: () => void;
}

export const DocumentPreviewDialog = ({
  document,
  onClose,
}: DocumentPreviewDialogProps) => {
  return (
    <Dialog
      onOpenChange={(isOpen) => {
        if (!isOpen) {
          onClose();
        }
      }}
      open={document !== null}
    >
      <DialogContent className="w-9/12">
        <DialogHeader>
          <DialogTitle>{document?.name || "Document Preview"}</DialogTitle>
          <DialogDescription>
            {document
              ? `${document.fileType} \u2022 ${formatFileSize(document.size)} \u2022 Updated ${formatUpdatedAt(document.updatedAt)}`
              : ""}
          </DialogDescription>
        </DialogHeader>
        <pre className="max-h-[60vh] overflow-auto border bg-muted/30 p-3 text-xs whitespace-pre-wrap break-words">
          {document?.content || ""}
        </pre>
      </DialogContent>
    </Dialog>
  );
};
