"use client";

import Graph from "graphology";
import { useCallback, useEffect, useRef, useState } from "react";
import Sigma from "sigma";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Spinner } from "@/components/ui/spinner";
import type { ConstellationResponse } from "@/lib/api";
import { useConstellation } from "@/lib/hooks/use-docs";

function resolveCssVar(name: string): string {
  if (typeof window === "undefined") return "#888888";
  return getComputedStyle(document.documentElement)
    .getPropertyValue(name)
    .trim();
}

function oklchToHex(oklch: string): string {
  const canvas = document.createElement("canvas");
  canvas.width = 1;
  canvas.height = 1;
  const ctx = canvas.getContext("2d");
  if (!ctx) return "#888888";
  ctx.fillStyle = oklch;
  return ctx.fillStyle;
}

function getThemeColors() {
  const primary = oklchToHex(resolveCssVar("--primary"));
  const chart1 = oklchToHex(resolveCssVar("--chart-1"));
  const chart2 = oklchToHex(resolveCssVar("--chart-2"));
  const _chart3 = oklchToHex(resolveCssVar("--chart-3"));
  const chart4 = oklchToHex(resolveCssVar("--chart-4"));
  const muted = oklchToHex(resolveCssVar("--muted"));
  const border = oklchToHex(resolveCssVar("--border"));
  const cardForeground = oklchToHex(resolveCssVar("--card-foreground"));
  const mutedForeground = oklchToHex(resolveCssVar("--muted-foreground"));
  const background = oklchToHex(resolveCssVar("--background"));
  const foreground = oklchToHex(resolveCssVar("--foreground"));

  return {
    docNode: chart4,
    chunkNode: chart1,
    docChunkEdge: primary,
    siblingEdge: chart2,
    labelColor: cardForeground,
    defaultNodeColor: mutedForeground,
    defaultEdgeColor: border,
    dimmedNodeColor: muted,
    dimmedEdgeColor: background,
    background,
    foreground,
  };
}

type SelectedNode =
  | {
      type: "doc";
      id: string;
      name: string;
      fileType: string;
      chunkCount: number;
    }
  | {
      type: "chunk";
      id: string;
      label: string;
      text: string;
      tokenCount: number;
      parentDoc: { id: string; name: string; fileType: string };
      siblings: Array<{
        chunkId: string;
        label: string;
        direction: "prev" | "next" | null;
      }>;
    };

function buildGraph(
  data: ConstellationResponse,
  colors: ReturnType<typeof getThemeColors>,
): {
  graph: Graph;
  lookup: Map<string, SelectedNode>;
} {
  const graph = new Graph({ type: "directed" });
  const lookup = new Map<string, SelectedNode>();

  const totalDocs = data.documents.length;
  const docRadius = totalDocs <= 1 ? 0 : totalDocs <= 3 ? 16 : 22;
  const chunkSpacing = 4;

  for (let di = 0; di < totalDocs; di++) {
    const doc = data.documents[di];
    const docNodeId = `doc-${doc.id}`;
    const angle =
      totalDocs <= 1 ? 0 : (2 * Math.PI * di) / totalDocs - Math.PI / 2;
    const docX = totalDocs <= 1 ? 0 : docRadius * Math.cos(angle);
    const docY = totalDocs <= 1 ? 0 : docRadius * Math.sin(angle);

    graph.addNode(docNodeId, {
      x: docX,
      y: docY,
      label: doc.name,
      size: 22,
      color: colors.docNode,
      nodeType: "doc",
    });

    lookup.set(docNodeId, {
      type: "doc",
      id: doc.id,
      name: doc.name,
      fileType: doc.fileType,
      chunkCount: doc.chunks.length,
    });

    const chunkCount = doc.chunks.length;

    let prevChunkNodeId: string | null = null;

    for (let ci = 0; ci < chunkCount; ci++) {
      const chunk = doc.chunks[ci];
      const chunkNodeId = `chunk-${chunk.chunkId}`;
      const cx = docX + (ci + 1) * chunkSpacing * Math.cos(angle);
      const cy = docY + (ci + 1) * chunkSpacing * Math.sin(angle);

      graph.addNode(chunkNodeId, {
        x: cx,
        y: cy,
        label: `${doc.name} #${ci + 1}`,
        size: 10,
        color: colors.chunkNode,
        nodeType: "chunk",
      });

      const siblings: Array<{
        chunkId: string;
        label: string;
        direction: "prev" | "next" | null;
      }> = [];

      if (chunk.prevChunkId) {
        const prevChunk = doc.chunks.find(
          (c) => c.chunkId === chunk.prevChunkId,
        );
        if (prevChunk) {
          siblings.push({
            chunkId: prevChunk.chunkId,
            label: `${doc.name} #${ci}`,
            direction: "prev",
          });
        }
      }

      if (chunk.nextChunkId) {
        const nextChunk = doc.chunks.find(
          (c) => c.chunkId === chunk.nextChunkId,
        );
        if (nextChunk) {
          siblings.push({
            chunkId: nextChunk.chunkId,
            label: `${doc.name} #${ci + 2}`,
            direction: "next",
          });
        }
      }

      lookup.set(chunkNodeId, {
        type: "chunk",
        id: chunk.chunkId,
        label: `${doc.name} #${ci + 1}`,
        text: chunk.text,
        tokenCount: chunk.tokenCount,
        parentDoc: {
          id: doc.id,
          name: doc.name,
          fileType: doc.fileType,
        },
        siblings,
      });

      if (ci === 0) {
        graph.addEdgeWithKey(
          `doc-chunk-${chunk.chunkId}`,
          docNodeId,
          chunkNodeId,
          {
            color: colors.docChunkEdge,
            size: 2,
            edgeType: "doc-chunk",
          },
        );
      }

      if (prevChunkNodeId) {
        graph.addEdgeWithKey(
          `sibling-${chunk.chunkId}-${doc.chunks[ci - 1].chunkId}`,
          prevChunkNodeId,
          chunkNodeId,
          {
            color: colors.siblingEdge,
            size: 1.5,
            edgeType: "sibling",
          },
        );
      }

      prevChunkNodeId = chunkNodeId;
    }
  }

  return { graph, lookup };
}

function NodePreviewCard({
  node,
  colors,
  onNavigate,
}: {
  node: SelectedNode;
  colors: ReturnType<typeof getThemeColors>;
  onNavigate: (nodeId: string) => void;
}) {
  if (node.type === "doc") {
    return (
      <>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <span
              className="inline-block size-3 rounded-full"
              style={{ backgroundColor: colors.docNode }}
            />
            {node.name}
          </DialogTitle>
          <DialogDescription>
            {node.fileType} &middot; {node.chunkCount} chunk
            {node.chunkCount !== 1 ? "s" : ""}
          </DialogDescription>
        </DialogHeader>
        <div className="mt-2 space-y-1.5">
          <p className="text-xs font-medium text-muted-foreground">
            Chunks in this document
          </p>
        </div>
      </>
    );
  }

  return (
    <>
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2">
          <span
            className="inline-block size-3 rounded-full"
            style={{ backgroundColor: colors.chunkNode }}
          />
          {node.label}
        </DialogTitle>
        <DialogDescription>
          {node.tokenCount} tokens &middot;{" "}
          <button
            type="button"
            className="underline underline-offset-2 hover:opacity-80"
            style={{ color: colors.docNode }}
            onClick={() => onNavigate(`doc-${node.parentDoc.id}`)}
          >
            {node.parentDoc.name}
          </button>{" "}
          ({node.parentDoc.fileType})
        </DialogDescription>
      </DialogHeader>
      <div className="mt-2 space-y-3">
        <div>
          <p className="mb-1 text-xs font-medium text-muted-foreground">
            Content
          </p>
          <div className="max-h-48 overflow-y-auto rounded border border-border bg-muted/30 p-2.5 text-xs/relaxed text-card-foreground">
            {node.text}
          </div>
        </div>
        {node.siblings.length > 0 && (
          <div>
            <p className="mb-1 text-xs font-medium text-muted-foreground">
              Adjacent chunks
            </p>
            <div className="flex flex-wrap gap-1.5">
              {node.siblings.map((sib) => (
                <button
                  key={sib.chunkId}
                  type="button"
                  onClick={() => onNavigate(`chunk-${sib.chunkId}`)}
                >
                  <Badge
                    variant="outline"
                    className="cursor-pointer hover:bg-muted"
                  >
                    {sib.label}
                    <span className="ml-1 text-[10px] text-muted-foreground">
                      ({sib.direction})
                    </span>
                  </Badge>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </>
  );
}

interface ConstellationFlowProps {
  data: ConstellationResponse;
}

const ConstellationFlow = ({ data }: ConstellationFlowProps) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const sigmaRef = useRef<Sigma | null>(null);
  const lookupRef = useRef<Map<string, SelectedNode>>(new Map());
  const highlightRef = useRef<Set<string>>(new Set());
  const colorsRef = useRef<ReturnType<typeof getThemeColors> | null>(null);
  const [selectedNode, setSelectedNode] = useState<SelectedNode | null>(null);

  if (!colorsRef.current) {
    colorsRef.current = getThemeColors();
  }
  const colors = colorsRef.current;

  const handleNavigate = useCallback((nodeId: string) => {
    const info = lookupRef.current.get(nodeId);
    if (!info) return;

    const highlighted = new Set<string>([nodeId]);

    if (info.type === "doc") {
      const graph = sigmaRef.current?.getGraph();
      if (graph) {
        let current = nodeId;
        const visited = new Set<string>();
        while (current) {
          visited.add(current);
          let next: string | null = null;
          graph.forEachEdge(current, (edge) => {
            const target = graph.target(edge);
            if (!visited.has(target)) {
              next = target;
              highlighted.add(target);
            }
          });
          current = next ?? "";
          if (!current) break;
        }
      }
    } else {
      highlighted.add(`doc-${info.parentDoc.id}`);
      for (const sib of info.siblings) {
        highlighted.add(`chunk-${sib.chunkId}`);
      }
    }

    highlightRef.current = highlighted;
    sigmaRef.current?.refresh();
    setSelectedNode(info);
  }, []);

  useEffect(() => {
    if (!containerRef.current) return;

    const { graph, lookup } = buildGraph(data, colors);
    lookupRef.current = lookup;

    const renderer = new Sigma(graph, containerRef.current, {
      renderLabels: true,
      renderEdgeLabels: false,
      defaultNodeColor: colors.defaultNodeColor,
      defaultEdgeColor: colors.defaultEdgeColor,
      labelFont: "Geist, system-ui, sans-serif",
      labelSize: 14,
      labelWeight: "500",
      labelColor: { color: colors.labelColor },
      defaultEdgeType: "arrow",
      stagePadding: 30,
      minCameraRatio: 0.05,
      maxCameraRatio: 15,
      autoCenter: true,
      autoRescale: true,
      nodeReducer: (node, attrs) => {
        const highlighted = highlightRef.current;
        if (highlighted.size > 0) {
          if (highlighted.has(node)) {
            return { ...attrs, highlighted: true, zIndex: 10 };
          }
          return {
            ...attrs,
            color: colors.dimmedNodeColor,
            label: "",
            highlighted: false,
            zIndex: 0,
          };
        }
        return attrs;
      },
      edgeReducer: (edge, attrs) => {
        const highlighted = highlightRef.current;
        if (highlighted.size > 0) {
          const graph = renderer.getGraph();
          const source = graph.source(edge);
          const target = graph.target(edge);
          if (highlighted.has(source) && highlighted.has(target)) {
            return { ...attrs, zIndex: 10 };
          }
          return {
            ...attrs,
            color: colors.dimmedEdgeColor,
            size: 0.5,
            zIndex: 0,
          };
        }
        return attrs;
      },
    });

    renderer.on("clickNode", ({ node }) => {
      const info = lookup.get(node);
      if (!info) return;

      const highlighted = new Set<string>([node]);

      if (info.type === "doc") {
        let current = node;
        const visited = new Set<string>();
        while (current) {
          visited.add(current);
          let next: string | null = null;
          graph.forEachEdge(current, (edge) => {
            const target = graph.target(edge);
            if (!visited.has(target)) {
              next = target;
              highlighted.add(target);
            }
          });
          current = next ?? "";
          if (!current) break;
        }
      } else {
        highlighted.add(`doc-${info.parentDoc.id}`);
        for (const sib of info.siblings) {
          highlighted.add(`chunk-${sib.chunkId}`);
        }
      }

      highlightRef.current = highlighted;
      renderer.refresh();
      setSelectedNode(info);
    });

    renderer.on("clickStage", () => {
      highlightRef.current = new Set();
      renderer.refresh();
      setSelectedNode(null);
    });

    const camera = renderer.getCamera();
    camera.animate({ ratio: 0.7 }, { duration: 400 });

    sigmaRef.current = renderer;

    return () => {
      renderer.kill();
      sigmaRef.current = null;
    };
  }, [data, colors]);

  return (
    <div className="relative h-full w-full">
      <div ref={containerRef} className="h-full w-full" />
      <Dialog
        open={selectedNode !== null}
        onOpenChange={(open) => {
          if (!open) {
            highlightRef.current = new Set();
            sigmaRef.current?.refresh();
            setSelectedNode(null);
          }
        }}
      >
        <DialogContent className="sm:max-w-md">
          {selectedNode && (
            <NodePreviewCard
              node={selectedNode}
              colors={colors}
              onNavigate={handleNavigate}
            />
          )}
        </DialogContent>
      </Dialog>
      <div className="pointer-events-none absolute bottom-3 left-3 flex items-center gap-3 text-xs text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <span
            className="inline-block size-2.5 rounded-full"
            style={{ backgroundColor: colors.docNode }}
          />
          Document
        </span>
        <span className="flex items-center gap-1.5">
          <span
            className="inline-block size-2.5 rounded-full"
            style={{ backgroundColor: colors.chunkNode }}
          />
          Chunk
        </span>
        <span className="flex items-center gap-1.5">
          <span
            className="inline-block size-2.5 rounded-full"
            style={{ backgroundColor: colors.defaultNodeColor }}
          />
          Click a node to inspect
        </span>
      </div>
    </div>
  );
};

interface ChunkConstellationProps {
  constellation?: ConstellationResponse;
}

export const ChunkConstellation = ({
  constellation,
}: ChunkConstellationProps) => {
  const { data, isLoading } = useConstellation({
    fallbackData: constellation,
  });

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Spinner className="size-6" />
      </div>
    );
  }

  if (!data || data.documents.length === 0) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-center">
          <p className="text-lg font-medium text-muted-foreground">
            No documents indexed yet
          </p>
          <p className="mt-1 text-sm text-muted-foreground/70">
            Upload documents and reindex to see the chunk constellation
          </p>
        </div>
      </div>
    );
  }

  return <ConstellationFlow data={data} />;
};
