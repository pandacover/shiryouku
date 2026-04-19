import { Context, Effect, Layer, Data } from "effect";
import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { DocumentNotFoundError } from "./errors";

// Database error type
export class DbError extends Data.TaggedError("DbError")<{
  readonly message: string;
  readonly cause?: unknown;
}> {}

// Database row types
export interface DocRow {
  id: string;
  name: string;
  file_type: string;
  size: number;
  created_at: number;
  updated_at: number;
}

export interface DocContentRow {
  id: string;
  doc_id: string;
  content: string;
  created_at: number;
  updated_at: number;
}

export interface DocChunkRow {
  chunk_id: string;
  doc_id: string;
  text: string;
  start_index: number | null;
  end_index: number | null;
  token_count: number | null;
  prev_chunk_id: string | null;
  next_chunk_id: string | null;
}

export interface CreateDocInput {
  readonly name: string;
  readonly fileType: string;
  readonly size: number;
  readonly content: string;
}

export interface UpdateDocInput {
  readonly name?: string;
  readonly fileType?: string;
  readonly size?: number;
}

// Database service interface
export interface DatabaseService {
  readonly listDocs: () => Effect.Effect<ReadonlyArray<DocRow>, DbError>;
  readonly getDoc: (id: string) => Effect.Effect<DocRow, DbError | DocumentNotFoundError>;
  readonly getDocWithContent: (id: string) => Effect.Effect<{ doc: DocRow; content: DocContentRow | null }, DbError | DocumentNotFoundError>;
  readonly createDoc: (input: CreateDocInput) => Effect.Effect<DocRow, DbError>;
  readonly updateDoc: (id: string, input: UpdateDocInput) => Effect.Effect<DocRow, DbError | DocumentNotFoundError>;
  readonly deleteDoc: (id: string) => Effect.Effect<void, DbError>;
  readonly getDocContent: (docId: string) => Effect.Effect<DocContentRow, DbError | DocumentNotFoundError>;
  readonly upsertDocContent: (docId: string, content: string) => Effect.Effect<DocContentRow, DbError | DocumentNotFoundError>;
  readonly deleteChunksForDoc: (docId: string) => Effect.Effect<void, DbError>;
  readonly persistChunks: (chunks: ReadonlyArray<DocChunkRow>) => Effect.Effect<void, DbError>;
  readonly getDocIds: () => Effect.Effect<ReadonlyArray<string>, DbError>;
  readonly getChunksForDoc: (docId: string) => Effect.Effect<ReadonlyArray<DocChunkRow>, DbError>;
  readonly deleteDocContentsForDoc: (docId: string) => Effect.Effect<void, DbError>;
}

// Database service tag - Effect 3.0+ pattern
export class Database extends Context.Tag("Database")<Database, DatabaseService>() {}

// Supabase client tag
export class Supabase extends Context.Tag("Supabase")<Supabase, SupabaseClient>() {}

// Create Supabase client from environment
const createSupabaseClient = Effect.gen(function* () {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  
  if (!url || !key) {
    return yield* Effect.fail(new Error("Supabase URL and key must be set in environment variables"));
  }
  
  yield* Effect.log(`Creating Supabase client for ${url}`);
  
  const client = createClient(url, key, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
  
  yield* Effect.log("Supabase client created successfully");
  
  return client;
});

// Helper to wrap Supabase errors
const wrapError = (message: string, error: unknown): DbError => {
  if (error && typeof error === "object" && "message" in error) {
    return new DbError({ message: `${message}: ${String(error.message)}`, cause: error });
  }
  return new DbError({ message: `${message}: ${String(error)}`, cause: error });
};

// Database implementation using Supabase REST API
const createDatabaseImplementation = Effect.gen(function* () {
  yield* Effect.log("Starting Database service construction...");
  
  const supabase = yield* Supabase;
  yield* Effect.log("Supabase client acquired");
  
  const listDocs = () => Effect.gen(function* () {
    const { data, error } = yield* Effect.promise(() => 
      supabase.from("docs").select("*").order("updated_at", { ascending: false })
    );
    
    if (error) {
      return yield* Effect.fail(wrapError("Failed to list docs", error));
    }
    
    return (data || []).map(row => ({
      id: row.id,
      name: row.name,
      file_type: row.file_type,
      size: row.size,
      created_at: new Date(row.created_at).getTime(),
      updated_at: new Date(row.updated_at).getTime(),
    }));
  });
  
  const getDoc = (id: string) => Effect.gen(function* () {
    const { data, error } = yield* Effect.promise(() => 
      supabase.from("docs").select("*").eq("id", id).single()
    );
    
    if (error || !data) {
      return yield* Effect.fail(new DocumentNotFoundError({ docId: id }));
    }
    
    return {
      id: data.id,
      name: data.name,
      file_type: data.file_type,
      size: data.size,
      created_at: new Date(data.created_at).getTime(),
      updated_at: new Date(data.updated_at).getTime(),
    };
  });
  
  const getDocWithContent = (id: string) => Effect.gen(function* () {
    const doc = yield* getDoc(id);
    
    const { data: contentData, error: contentError } = yield* Effect.promise(() => 
      supabase.from("doc_contents").select("*").eq("doc_id", id).maybeSingle()
    );
    
    if (contentError) {
      return yield* Effect.fail(wrapError("Failed to get content", contentError));
    }
    
    const content = contentData ? {
      id: contentData.id,
      doc_id: contentData.doc_id,
      content: contentData.content,
      created_at: new Date(contentData.created_at).getTime(),
      updated_at: new Date(contentData.updated_at).getTime(),
    } : null;
    
    return { doc, content };
  });
  
  const createDoc = (input: CreateDocInput) => Effect.gen(function* () {
    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    const nowMs = Date.now();
    
    const { error: docError } = yield* Effect.promise(() => 
      supabase.from("docs").insert({
        id,
        name: input.name,
        file_type: input.fileType,
        size: input.size,
        created_at: now,
        updated_at: now,
      })
    );
    
    if (docError) {
      return yield* Effect.fail(wrapError("Failed to create doc", docError));
    }
    
    const { error: contentError } = yield* Effect.promise(() => 
      supabase.from("doc_contents").insert({
        id: crypto.randomUUID(),
        doc_id: id,
        content: input.content,
        created_at: now,
        updated_at: now,
      })
    );
    
    if (contentError) {
      yield* Effect.promise(() => supabase.from("docs").delete().eq("id", id));
      return yield* Effect.fail(wrapError("Failed to create content", contentError));
    }
    
    return {
      id,
      name: input.name,
      file_type: input.fileType,
      size: input.size,
      created_at: nowMs,
      updated_at: nowMs,
    };
  });
  
  const updateDoc = (id: string, input: UpdateDocInput) => Effect.gen(function* () {
    const existing = yield* getDoc(id);
    const now = new Date().toISOString();
    const nowMs = Date.now();
    
    const updates: Record<string, unknown> = {
      updated_at: now,
    };
    if (input.name !== undefined) updates.name = input.name;
    if (input.fileType !== undefined) updates.file_type = input.fileType;
    if (input.size !== undefined) updates.size = input.size;
    
    const { error } = yield* Effect.promise(() => 
      supabase.from("docs").update(updates).eq("id", id)
    );
    
    if (error) {
      return yield* Effect.fail(wrapError("Failed to update doc", error));
    }
    
    return {
      id,
      name: input.name ?? existing.name,
      file_type: input.fileType ?? existing.file_type,
      size: input.size ?? existing.size,
      created_at: existing.created_at,
      updated_at: nowMs,
    };
  });
  
  const deleteDoc = (id: string) => Effect.gen(function* () {
    yield* Effect.promise(() => supabase.from("doc_contents").delete().eq("doc_id", id));
    yield* Effect.promise(() => supabase.from("doc_chunks").delete().eq("doc_id", id));
    
    const { error } = yield* Effect.promise(() => 
      supabase.from("docs").delete().eq("id", id)
    );
    
    if (error) {
      yield* Effect.logWarning(`Failed to delete doc ${id}: ${error.message}`);
    }
  });
  
  const getDocContent = (docId: string) => Effect.gen(function* () {
    const { data, error } = yield* Effect.promise(() => 
      supabase.from("doc_contents").select("*").eq("doc_id", docId).single()
    );
    
    if (error || !data) {
      return yield* Effect.fail(new DocumentNotFoundError({ docId }));
    }
    
    return {
      id: data.id,
      doc_id: data.doc_id,
      content: data.content,
      created_at: new Date(data.created_at).getTime(),
      updated_at: new Date(data.updated_at).getTime(),
    };
  });
  
  const upsertDocContent = (docId: string, content: string) => Effect.gen(function* () {
    const now = new Date().toISOString();
    const nowMs = Date.now();
    
    const { data: existing } = yield* Effect.promise(() => 
      supabase.from("doc_contents").select("id").eq("doc_id", docId).maybeSingle()
    );
    
    if (!existing) {
      const { error: insertError } = yield* Effect.promise(() => 
        supabase.from("doc_contents").insert({
          id: crypto.randomUUID(),
          doc_id: docId,
          content,
          created_at: now,
          updated_at: now,
        })
      );
      
      if (insertError) {
        return yield* Effect.fail(wrapError("Failed to insert content", insertError));
      }
    } else {
      const { error: updateError } = yield* Effect.promise(() => 
        supabase.from("doc_contents").update({ content, updated_at: now }).eq("doc_id", docId)
      );
      
      if (updateError) {
        return yield* Effect.fail(wrapError("Failed to update content", updateError));
      }
    }
    
    const { data, error } = yield* Effect.promise(() => 
      supabase.from("doc_contents").select("*").eq("doc_id", docId).single()
    );
    
    if (error || !data) {
      return yield* Effect.fail(new DocumentNotFoundError({ docId }));
    }
    
    return {
      id: data.id,
      doc_id: data.doc_id,
      content: data.content,
      created_at: new Date(data.created_at).getTime(),
      updated_at: new Date(data.updated_at).getTime(),
    };
  });
  
  const deleteChunksForDoc = (docId: string) => Effect.gen(function* () {
    const { error } = yield* Effect.promise(() => 
      supabase.from("doc_chunks").delete().eq("doc_id", docId)
    );
    
    if (error) {
      yield* Effect.logWarning(`Failed to delete chunks for ${docId}: ${error.message}`);
    }
  });
  
  const persistChunks = (chunks: ReadonlyArray<DocChunkRow>) => Effect.gen(function* () {
    if (chunks.length === 0) return;
    
    const { error } = yield* Effect.promise(() => 
      supabase.from("doc_chunks").insert(
        chunks.map(chunk => ({
          chunk_id: chunk.chunk_id,
          doc_id: chunk.doc_id,
          text: chunk.text,
          start_index: chunk.start_index,
          end_index: chunk.end_index,
          token_count: chunk.token_count,
          prev_chunk_id: chunk.prev_chunk_id,
          next_chunk_id: chunk.next_chunk_id,
        }))
      )
    );
    
    if (error) {
      return yield* Effect.fail(wrapError("Failed to persist chunks", error));
    }
  });
  
  const getDocIds = () => Effect.gen(function* () {
    const { data, error } = yield* Effect.promise(() => 
      supabase.from("docs").select("id")
    );
    
    if (error) {
      return yield* Effect.fail(wrapError("Failed to get doc IDs", error));
    }
    
    return (data || []).map(row => row.id);
  });
  
  const getChunksForDoc = (docId: string) => Effect.gen(function* () {
    const { data, error } = yield* Effect.promise(() => 
      supabase.from("doc_chunks").select("*").eq("doc_id", docId)
    );
    
    if (error) {
      return yield* Effect.fail(wrapError("Failed to get chunks", error));
    }
    
    return (data || []).map(row => ({
      chunk_id: row.chunk_id,
      doc_id: row.doc_id,
      text: row.text,
      start_index: row.start_index,
      end_index: row.end_index,
      token_count: row.token_count,
      prev_chunk_id: row.prev_chunk_id,
      next_chunk_id: row.next_chunk_id,
    }));
  });
  
  const deleteDocContentsForDoc = (docId: string) => Effect.gen(function* () {
    const { error } = yield* Effect.promise(() => 
      supabase.from("doc_contents").delete().eq("doc_id", docId)
    );
    
    if (error) {
      yield* Effect.logWarning(`Failed to delete content for ${docId}: ${error.message}`);
    }
  });
  
  yield* Effect.log("Database service implementation complete");
  
  return {
    listDocs,
    getDoc,
    getDocWithContent,
    createDoc,
    updateDoc,
    deleteDoc,
    getDocContent,
    upsertDocContent,
    deleteChunksForDoc,
    persistChunks,
    getDocIds,
    getChunksForDoc,
    deleteDocContentsForDoc,
  };
}).pipe(
  Effect.tapError((err) => Effect.logError(`Database implementation error: ${String(err)}`))
);

// Supabase client layer
export const SupabaseLive = Layer.effect(
  Supabase,
  createSupabaseClient
);

// Standalone Database layer that creates its own Supabase client
export const DatabaseLive = Layer.effect(
  Database,
  Effect.gen(function* () {
    const supabase = yield* createSupabaseClient;
    return yield* createDatabaseImplementation.pipe(
      Effect.provideService(Supabase, supabase)
    );
  })
);
