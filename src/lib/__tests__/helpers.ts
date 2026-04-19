import { Layer, Effect } from "effect";
import { DatabaseLive, Database, type DocRow, type DocContentRow, type DocChunkRow, type CreateDocInput, type UpdateDocInput, DbError } from "@/lib/db";
import { SearchIndexLive, SearchIndex } from "@/lib/search";
import { ChromaDbLive } from "@/lib/chroma";
import { EmbeddingsLive } from "@/lib/embed";
import { OllamaModelLive } from "@/lib/chat";
import { DocumentNotFoundError } from "@/lib/errors";

/**
 * Test helpers for database and service testing.
 * 
 * Uses Supabase REST API for database operations.
 * Requires NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY 
 * or SUPABASE_SERVICE_ROLE_KEY environment variables to be set.
 */

// Create fresh mock database for each test
const createMockDatabase = () => {
  // Fresh maps for each test
  const docs = new Map<string, DocRow>([
    [
      "doc1",
      {
        id: "doc1",
        name: "Test Doc 1",
        file_type: "md",
        size: 100,
        created_at: Date.now(),
        updated_at: Date.now(),
      },
    ],
    [
      "doc2",
      {
        id: "doc2",
        name: "Test Doc 2",
        file_type: "txt",
        size: 200,
        created_at: Date.now(),
        updated_at: Date.now(),
      },
    ],
  ]);

  const contents = new Map<string, DocContentRow>([
    [
      "doc1",
      {
        id: "content1",
        doc_id: "doc1",
        content: "Test content for doc1",
        created_at: Date.now(),
        updated_at: Date.now(),
      },
    ],
  ]);

  const chunks = new Map<string, DocChunkRow[]>([
    [
      "doc1",
      [
        {
          chunk_id: "chunk1",
          doc_id: "doc1",
          text: "Chunk 1 text",
          start_index: 0,
          end_index: 10,
          token_count: 5,
          prev_chunk_id: null,
          next_chunk_id: "chunk2",
        },
        {
          chunk_id: "chunk2",
          doc_id: "doc1",
          text: "Chunk 2 text",
          start_index: 11,
          end_index: 20,
          token_count: 5,
          prev_chunk_id: "chunk1",
          next_chunk_id: null,
        },
      ],
    ],
  ]);

  return Database.of({
    listDocs: () => Effect.succeed(Array.from(docs.values())),

    getDoc: (id: string) => {
      const doc = docs.get(id);
      if (!doc) return Effect.fail(new DocumentNotFoundError({ docId: id }));
      return Effect.succeed(doc);
    },

    getDocWithContent: (id: string) => {
      const doc = docs.get(id);
      if (!doc) return Effect.fail(new DocumentNotFoundError({ docId: id }));
      const content = contents.get(id) ?? null;
      return Effect.succeed({ doc, content });
    },

    createDoc: (input: CreateDocInput) => {
      const id = crypto.randomUUID();
      const now = Date.now();
      const doc: DocRow = {
        id,
        name: input.name,
        file_type: input.fileType,
        size: input.size,
        created_at: now,
        updated_at: now,
      };
      docs.set(id, doc);
      contents.set(id, {
        id: crypto.randomUUID(),
        doc_id: id,
        content: input.content,
        created_at: now,
        updated_at: now,
      });
      return Effect.succeed(doc);
    },

    updateDoc: (id: string, input: UpdateDocInput) => {
      const existing = docs.get(id);
      if (!existing) return Effect.fail(new DocumentNotFoundError({ docId: id }));
      const now = Date.now();
      const updated: DocRow = {
        ...existing,
        name: input.name ?? existing.name,
        file_type: input.fileType ?? existing.file_type,
        size: input.size ?? existing.size,
        updated_at: now,
      };
      docs.set(id, updated);
      return Effect.succeed(updated);
    },

    deleteDoc: (id: string) => {
      docs.delete(id);
      contents.delete(id);
      chunks.delete(id);
      return Effect.void;
    },

    getDocContent: (docId: string) => {
      const content = contents.get(docId);
      if (!content) return Effect.fail(new DocumentNotFoundError({ docId }));
      return Effect.succeed(content);
    },

    upsertDocContent: (docId: string, content: string) => {
      const now = Date.now();
      const id = crypto.randomUUID();
      const newContent: DocContentRow = { id, doc_id: docId, content, created_at: now, updated_at: now };
      contents.set(docId, newContent);
      return Effect.succeed(newContent);
    },

    deleteChunksForDoc: (docId: string) => {
      chunks.delete(docId);
      return Effect.void;
    },

    persistChunks: (newChunks: ReadonlyArray<DocChunkRow>) => {
      for (const chunk of newChunks) {
        const docChunks = chunks.get(chunk.doc_id) || [];
        docChunks.push(chunk);
        chunks.set(chunk.doc_id, docChunks);
      }
      return Effect.void;
    },

    getDocIds: () => Effect.succeed(Array.from(docs.keys())),

    getChunksForDoc: (docId: string) => {
      const docChunks = chunks.get(docId) || [];
      return Effect.succeed(docChunks);
    },

    deleteDocContentsForDoc: (docId: string) => {
      contents.delete(docId);
      return Effect.void;
    },
  });
};

// Create a fresh layer for each test
export const DatabaseTest = Layer.fresh(Layer.sync(Database, createMockDatabase));

// Full test layer with all services
export const TestLayer = Layer.mergeAll(
  DatabaseTest,
  SearchIndexLive,
  ChromaDbLive,
  EmbeddingsLive,
  OllamaModelLive
);

/**
 * Helper to run an effect and return the exit
 */
export async function runEffect<A, E>(
  effect: Effect.Effect<A, E>
): Promise<Effect.Effect<A, E>> {
  return Effect.runPromiseExit(effect) as unknown as Effect.Effect<A, E>;
}

/**
 * Real Supabase integration test layer
 * 
 * Uses the actual DatabaseLive with Supabase REST client.
 * Requires NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY 
 * or SUPABASE_SERVICE_ROLE_KEY environment variables.
 */
export const DatabaseSupabaseTest = DatabaseLive;

/**
 * Integration test layer with real Supabase
 */
export const IntegrationTestLayer = Layer.mergeAll(
  DatabaseSupabaseTest,
  SearchIndexLive,
  ChromaDbLive,
  EmbeddingsLive,
  OllamaModelLive
);
