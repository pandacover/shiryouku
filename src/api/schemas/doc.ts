import { z } from "zod";

export const createDocSchema = z.object({
  name: z.string().min(1),
  fileType: z.string().min(1),
  size: z.number().int().nonnegative().default(0),
  content: z.string().default(""),
});

export const updateDocSchema = z.object({
  name: z.string().min(1).optional(),
  fileType: z.string().min(1).optional(),
  size: z.number().int().nonnegative().optional(),
});

export const updateDocContentSchema = z.object({
  content: z.string().min(0),
});

export const docRowSchema = z.object({
  id: z.string(),
  name: z.string(),
  file_type: z.string(),
  size: z.number(),
  created_at: z.number(),
  updated_at: z.number(),
});

export const docContentRowSchema = z.object({
  id: z.string(),
  doc_id: z.string(),
  content: z.string(),
  created_at: z.number(),
  updated_at: z.number(),
});

export type CreateDocInput = z.infer<typeof createDocSchema>;
export type UpdateDocInput = z.infer<typeof updateDocSchema>;
export type UpdateDocContentInput = z.infer<typeof updateDocContentSchema>;
export type DocRow = z.infer<typeof docRowSchema>;
export type DocContentRow = z.infer<typeof docContentRowSchema>;

export interface DocResponse {
  id: string;
  name: string;
  fileType: string;
  size: number;
  createdAt: number;
  updatedAt: number;
}

export interface DocContentResponse {
  id: string;
  docId: string;
  content: string;
  createdAt: number;
  updatedAt: number;
}

export interface DocWithContentResponse extends DocResponse {
  content: string;
}
