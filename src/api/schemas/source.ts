import { z } from "zod";

export const createSourceSchema = z.object({
  url: z.url(),
});

export type CreateSourceInput = z.infer<typeof createSourceSchema>;

export interface SourceResponse {
  id: string;
  name: string;
  url: string;
  canonicalUrl: string | null;
  title: string | null;
  description: string | null;
  size: number;
  fetchStatus: "success" | "error" | null;
  fetchError: string | null;
  lastFetchedAt: number | null;
  createdAt: number;
  updatedAt: number;
}

export interface SourceWithContentResponse extends SourceResponse {
  content: string;
}
