import {
  ExternalLinkIcon,
  FileTextIcon,
  RefreshCcwIcon,
  Trash2Icon,
} from "lucide-react";
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
import type { SourceResponse } from "@/lib/api";

interface SourcesViewProps {
  isLoading?: boolean;
  refreshingId?: string | null;
  sources: SourceResponse[];
  onDelete: (sourceId: string) => void;
  onPreview: (sourceId: string) => void;
  onRefresh: (sourceId: string) => void;
}

const formatFetchedAt = (timestamp: number | null) =>
  timestamp ? formatUpdatedAt(timestamp) : "Never";

export const SourcesView = ({
  isLoading,
  refreshingId,
  sources,
  onDelete,
  onPreview,
  onRefresh,
}: SourcesViewProps) => {
  return (
    <section className="flex min-h-0 flex-1 flex-col p-6">
      <div className="border">
        <Table>
          <TableHeader className="bg-muted/40">
            <TableRow>
              <TableHead className="px-3">Source</TableHead>
              <TableHead className="px-3">Status</TableHead>
              <TableHead className="px-3">Size</TableHead>
              <TableHead className="px-3">Last Fetched</TableHead>
              <TableHead className="px-3">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading && (
              <TableRow>
                <TableCell
                  className="px-3 py-6 text-muted-foreground"
                  colSpan={5}
                >
                  Loading sources...
                </TableCell>
              </TableRow>
            )}
            {!isLoading && sources.length === 0 && (
              <TableRow>
                <TableCell
                  className="px-3 py-6 text-muted-foreground"
                  colSpan={5}
                >
                  No website sources indexed yet.
                </TableCell>
              </TableRow>
            )}
            {!isLoading &&
              sources.map((source) => (
                <TableRow key={source.id}>
                  <TableCell className="max-w-[28rem] px-3">
                    <div className="flex flex-col gap-1">
                      <span className="truncate font-medium">
                        {source.title || source.name}
                      </span>
                      <a
                        className="truncate text-muted-foreground text-xs hover:underline"
                        href={source.canonicalUrl || source.url}
                        rel="noreferrer"
                        target="_blank"
                      >
                        {source.canonicalUrl || source.url}
                      </a>
                    </div>
                  </TableCell>
                  <TableCell className="px-3">
                    {source.fetchStatus === "error" ? "Error" : "Ready"}
                  </TableCell>
                  <TableCell className="px-3">
                    {formatFileSize(source.size)}
                  </TableCell>
                  <TableCell className="px-3">
                    {formatFetchedAt(source.lastFetchedAt)}
                  </TableCell>
                  <TableCell className="px-3">
                    <div className="flex items-center gap-1">
                      <Button
                        aria-label={`Preview ${source.name}`}
                        onClick={() => onPreview(source.id)}
                        size="icon-sm"
                        type="button"
                        variant="ghost"
                      >
                        <FileTextIcon className="size-4" />
                      </Button>
                      <Button
                        aria-label={`Open ${source.name}`}
                        onClick={() =>
                          window.open(
                            source.canonicalUrl || source.url,
                            "_blank",
                          )
                        }
                        size="icon-sm"
                        type="button"
                        variant="ghost"
                      >
                        <ExternalLinkIcon className="size-4" />
                      </Button>
                      <Button
                        aria-label={`Refresh ${source.name}`}
                        disabled={refreshingId === source.id}
                        onClick={() => onRefresh(source.id)}
                        size="icon-sm"
                        type="button"
                        variant="ghost"
                      >
                        <RefreshCcwIcon className="size-4" />
                      </Button>
                      <Button
                        aria-label={`Delete ${source.name}`}
                        className="text-destructive hover:text-destructive"
                        onClick={() => onDelete(source.id)}
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
