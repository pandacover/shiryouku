import type { DocResponse, DocWithContent } from "@/lib/api";

export type DashboardView = "home" | "documents" | "research";

export type DocumentMeta = DocResponse;

export type DocumentWithContent = DocWithContent;

export interface ChatEntry {
  id: string;
  role: "user" | "assistant";
  content: string;
}
