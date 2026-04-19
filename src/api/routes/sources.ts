import { Effect } from "effect";
import { Hono } from "hono";
import { runEffect } from "@/api/bridge";
import {
  createSourceSchema,
  type SourceResponse,
  type SourceWithContentResponse,
} from "@/api/schemas/source";
import { Database, type DocRow } from "@/lib/db";
import {
  createWebsiteSource,
  refreshWebsiteSource,
  removeDocumentFromAllStores,
} from "@/lib/ingest";

function toSourceResponse(row: DocRow): SourceResponse {
  return {
    id: row.id,
    name: row.name,
    url: row.source_url ?? "",
    canonicalUrl: row.canonical_url,
    title: row.title,
    description: row.description,
    size: row.size,
    fetchStatus: row.fetch_status,
    fetchError: row.fetch_error,
    lastFetchedAt: row.last_fetched_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export const sourcesRoutes = new Hono()
  .get("/", async (c) => {
    return runEffect(
      c,
      Effect.gen(function* () {
        const db = yield* Database;
        const sources = yield* db.listWebsiteSources();
        return c.json({ data: sources.map(toSourceResponse) });
      }),
    );
  })

  .get("/:id", async (c) => {
    const id = c.req.param("id");
    return runEffect(
      c,
      Effect.gen(function* () {
        const db = yield* Database;
        const result = yield* db.getDocWithContent(id);
        const response: SourceWithContentResponse = {
          ...toSourceResponse(result.doc),
          content: result.content?.content ?? "",
        };
        return c.json({ data: response });
      }),
    );
  })

  .post("/", async (c) => {
    const body = await c.req.json();
    const parsed = createSourceSchema.safeParse(body);

    if (!parsed.success) {
      return c.json(
        { error: "Validation failed", details: parsed.error.issues },
        400,
      );
    }

    return runEffect(
      c,
      Effect.gen(function* () {
        const result = yield* createWebsiteSource(parsed.data.url);
        const db = yield* Database;
        const source = yield* db.getDoc(result.docId);
        return {
          source: toSourceResponse(source),
          chunkCount: result.chunkCount,
        };
      }),
    );
  })

  .post("/:id/refresh", async (c) => {
    const id = c.req.param("id");

    return runEffect(
      c,
      Effect.gen(function* () {
        const result = yield* refreshWebsiteSource(id);
        const db = yield* Database;
        const source = yield* db.getDoc(id);
        return {
          source: toSourceResponse(source),
          chunkCount: result.chunkCount,
        };
      }),
    );
  })

  .delete("/:id", async (c) => {
    const id = c.req.param("id");

    return runEffect(
      c,
      Effect.gen(function* () {
        const db = yield* Database;
        yield* db.deleteDoc(id);
        yield* removeDocumentFromAllStores(id);
        return { id };
      }),
    );
  });
