import { Effect } from "effect";
import { Hono } from "hono";
import { runEffect } from "@/api/bridge";
import {
  createDocSchema,
  type DocContentResponse,
  type DocResponse,
  type DocWithContentResponse,
  updateDocContentSchema,
  updateDocSchema,
} from "@/api/schemas/doc";
import { Database } from "@/lib/db";
import { ingestDocument, removeDocumentFromAllStores } from "@/lib/ingest";
import { AppLayer } from "@/lib/runtime";
import { SearchIndex } from "@/lib/search";

function snakeToCamelDoc(row: {
  id: string;
  name: string;
  file_type: string;
  size: number;
  created_at: number;
  updated_at: number;
}): DocResponse {
  return {
    id: row.id,
    name: row.name,
    fileType: row.file_type,
    size: row.size,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function snakeToCamelContent(row: {
  id: string;
  doc_id: string;
  content: string;
  created_at: number;
  updated_at: number;
}): DocContentResponse {
  return {
    id: row.id,
    docId: row.doc_id,
    content: row.content,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export const docsRoutes = new Hono()
  .get("/constellation", async (c) => {
    return runEffect(
      c,
      Effect.gen(function* () {
        const search = yield* SearchIndex;
        const data = yield* search.getConstellationData();
        return { data };
      }),
    );
  })

  .get("/", async (c) => {
    return runEffect(
      c,
      Effect.gen(function* () {
        const db = yield* Database;
        const rows = yield* db.listDocs();
        return c.json({ data: rows.map(snakeToCamelDoc) });
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
        const response: DocWithContentResponse = {
          ...snakeToCamelDoc(result.doc),
          content: result.content?.content ?? "",
        };
        return c.json({ data: response });
      }),
    );
  })

  .post("/", async (c) => {
    const body = await c.req.json();
    const parsed = createDocSchema.safeParse(body);

    if (!parsed.success) {
      return c.json(
        { error: "Validation failed", details: parsed.error.issues },
        400,
      );
    }

    const { name, fileType, size, content } = parsed.data;

    return runEffect(
      c,
      Effect.gen(function* () {
        const db = yield* Database;
        const doc = yield* db.createDoc({
          name,
          fileType,
          size,
          content: content ?? "",
        });
        return { doc, content: parsed.data.content ?? "" };
      }).pipe(
        Effect.tap(({ doc }) =>
          Effect.provide(ingestDocument(doc.id), AppLayer).pipe(
            Effect.catchAll((err) =>
              Effect.logWarning(`[Auto-Ingest Error] ${String(err)}`),
            ),
          ),
        ),
      ),
    );
  })

  .put("/:id", async (c) => {
    const id = c.req.param("id");
    const body = await c.req.json();
    const parsed = updateDocSchema.safeParse(body);

    if (!parsed.success) {
      return c.json(
        { error: "Validation failed", details: parsed.error.issues },
        400,
      );
    }

    return runEffect(
      c,
      Effect.gen(function* () {
        const db = yield* Database;
        const doc = yield* db.updateDoc(id, parsed.data);
        return snakeToCamelDoc(doc);
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
  })

  .get("/:id/content", async (c) => {
    const id = c.req.param("id");

    return runEffect(
      c,
      Effect.gen(function* () {
        const db = yield* Database;
        const content = yield* db.getDocContent(id);
        return snakeToCamelContent(content);
      }),
    );
  })

  .put("/:id/content", async (c) => {
    const id = c.req.param("id");
    const body = await c.req.json();
    const parsed = updateDocContentSchema.safeParse(body);

    if (!parsed.success) {
      return c.json(
        { error: "Validation failed", details: parsed.error.issues },
        400,
      );
    }

    return runEffect(
      c,
      Effect.gen(function* () {
        const db = yield* Database;
        const content = yield* db.upsertDocContent(id, parsed.data.content);
        return snakeToCamelContent(content);
      }).pipe(
        Effect.tap(() =>
          Effect.provide(ingestDocument(id), AppLayer).pipe(
            Effect.catchAll((err) =>
              Effect.logWarning(`[Auto-Ingest Error] ${String(err)}`),
            ),
          ),
        ),
      ),
    );
  });
