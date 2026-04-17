import { FileIcon, Trash2Icon } from "lucide-react";
import type { DocumentMeta } from "@/components/dashboard/dashboard-types";
import {
  formatFileSize,
  formatUpdatedAt,
} from "@/components/dashboard/dashboard-utils";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface DocumentsViewProps {
  documents: DocumentMeta[];
  isLoading?: boolean;
  onDelete: (documentId: string) => void;
  onPreview: (documentId: string) => void;
}

export const DocumentsView = ({
  documents,
  isLoading,
  onDelete,
  onPreview,
}: DocumentsViewProps) => {
  if (isLoading) {
    return (
      <section className="flex min-h-0 flex-1 flex-col p-6">
        <div className="border">
          <Table>
            <TableHeader className="bg-muted/40">
              <TableRow>
                <TableHead className="px-3">Document Name</TableHead>
                <TableHead className="px-3">File Type</TableHead>
                <TableHead className="px-3">Size</TableHead>
                <TableHead className="px-3">Date Updated</TableHead>
                <TableHead className="px-3">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <TableRow>
                <TableCell
                  className="px-3 py-6 text-muted-foreground"
                  colSpan={5}
                >
                  Loading documents...
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </div>
      </section>
    );
  }

  return (
    <section className="flex min-h-0 flex-1 flex-col p-6">
      <div className="border">
        <Table>
          <TableHeader className="bg-muted/40">
            <TableRow>
              <TableHead className="px-3">Document Name</TableHead>
              <TableHead className="px-3">File Type</TableHead>
              <TableHead className="px-3">Size</TableHead>
              <TableHead className="px-3">Date Updated</TableHead>
              <TableHead className="px-3">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {documents.length === 0 && (
              <TableRow>
                <TableCell
                  className="px-3 py-6 text-muted-foreground"
                  colSpan={5}
                >
                  No documents uploaded yet.
                </TableCell>
              </TableRow>
            )}
            {documents.map((document) => (
              <TableRow key={document.id}>
                <TableCell className="px-3">{document.name}</TableCell>
                <TableCell className="px-3">{document.fileType}</TableCell>
                <TableCell className="px-3">
                  {formatFileSize(document.size)}
                </TableCell>
                <TableCell className="px-3">
                  {formatUpdatedAt(document.updatedAt)}
                </TableCell>
                <TableCell className="px-3">
                  <div className="flex items-center gap-1">
                    <Button
                      aria-label={`Preview ${document.name}`}
                      onClick={() => onPreview(document.id)}
                      size="icon-sm"
                      type="button"
                      variant="ghost"
                    >
                      <FileIcon className="size-4" />
                    </Button>
                    <Button
                      aria-label={`Delete ${document.name}`}
                      className="text-destructive hover:text-destructive"
                      onClick={() => onDelete(document.id)}
                      size="icon-sm"
                      type="button"
                      variant="ghost"
                    >
                      <Trash2Icon className="size-4" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </section>
  );
};
