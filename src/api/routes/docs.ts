import { Hono } from "hono";
import { nanoid } from "nanoid";
import {
  createDocSchema,
  type DocContentResponse,
  type DocResponse,
  type DocWithContentResponse,
  updateDocContentSchema,
  updateDocSchema,
} from "@/api/schemas/doc";
import { getDb } from "@/lib/db";
import { ingestDocument, removeDocumentFromAllStores } from "@/lib/ingest";
import { searchIndex } from "@/lib/search";

async function ensureDb() {
  return getDb();
}

function snakeToCamelDoc(row: Record<string, unknown>): DocResponse {
  return {
    id: row.id as string,
    name: row.name as string,
    fileType: row.file_type as string,
    size: Number(row.size),
    createdAt: Number(row.created_at),
    updatedAt: Number(row.updated_at),
  };
}

function snakeToCamelContent(row: Record<string, unknown>): DocContentResponse {
  return {
    id: row.id as string,
    docId: row.doc_id as string,
    content: row.content as string,
    createdAt: Number(row.created_at),
    updatedAt: Number(row.updated_at),
  };
}

export const docsRoutes = new Hono()
  .get("/constellation", async (c) => {
    try {
      await searchIndex.ensureInitialized();
      const data = searchIndex.getConstellationData();
      return c.json({ data });
    } catch (err) {
      console.error("[Constellation Error]", err);
      return c.json(
        {
          error: "Failed to get constellation data",
          details: (err as Error).message,
        },
        500,
      );
    }
  })

  .get("/", async (c) => {
    const db = await ensureDb();
    const rows = db
      .prepare("SELECT * FROM docs ORDER BY updated_at DESC")
      .all() as Record<string, unknown>[];

    return c.json({
      data: rows.map(snakeToCamelDoc),
    });
  })

  .get("/:id", async (c) => {
    const id = c.req.param("id");
    const db = await ensureDb();

    const doc = db.prepare("SELECT * FROM docs WHERE id = ?").get(id) as
      | Record<string, unknown>
      | undefined;

    if (!doc) {
      return c.json({ error: "Document not found" }, 404);
    }

    const content = db
      .prepare("SELECT * FROM doc_contents WHERE doc_id = ?")
      .get(id) as Record<string, unknown> | undefined;

    const response: DocWithContentResponse = {
      ...snakeToCamelDoc(doc),
      content: content ? (content.content as string) : "",
    };

    return c.json({ data: response });
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
    const db = await ensureDb();
    const now = Date.now();

    const docId = nanoid();
    const contentId = nanoid();

    const insertDoc = db.prepare(
      "INSERT INTO docs (id, name, file_type, size, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)",
    );
    const insertContent = db.prepare(
      "INSERT INTO doc_contents (id, doc_id, content, created_at, updated_at) VALUES (?, ?, ?, ?, ?)",
    );

    db.transaction(() => {
      insertDoc.run(docId, name, fileType, size, now, now);
      insertContent.run(contentId, docId, content || "", now, now);
    });

    const doc = db
      .prepare("SELECT * FROM docs WHERE id = ?")
      .get(docId) as Record<string, unknown>;

    const response: DocWithContentResponse = {
      ...snakeToCamelDoc(doc),
      content: content || "",
    };

    ingestDocument(docId).catch((err) => {
      console.error("[Auto-Ingest Error]", err);
    });

    return c.json({ data: response }, 201);
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

    const db = await ensureDb();

    const existing = db.prepare("SELECT id FROM docs WHERE id = ?").get(id);

    if (!existing) {
      return c.json({ error: "Document not found" }, 404);
    }

    const updates = parsed.data;
    const setClauses: string[] = [];
    const values: unknown[] = [];

    if (updates.name !== undefined) {
      setClauses.push("name = ?");
      values.push(updates.name);
    }
    if (updates.fileType !== undefined) {
      setClauses.push("file_type = ?");
      values.push(updates.fileType);
    }
    if (updates.size !== undefined) {
      setClauses.push("size = ?");
      values.push(updates.size);
    }

    if (setClauses.length > 0) {
      setClauses.push("updated_at = ?");
      values.push(Date.now());
      values.push(id);

      db.prepare(`UPDATE docs SET ${setClauses.join(", ")} WHERE id = ?`).run(
        ...values,
      );
    }

    const doc = db.prepare("SELECT * FROM docs WHERE id = ?").get(id) as Record<
      string,
      unknown
    >;

    return c.json({ data: snakeToCamelDoc(doc) });
  })

  .delete("/:id", async (c) => {
    const id = c.req.param("id");
    const db = await ensureDb();

    const existing = db.prepare("SELECT id FROM docs WHERE id = ?").get(id);

    if (!existing) {
      return c.json({ error: "Document not found" }, 404);
    }

    await removeDocumentFromAllStores(id);
    db.prepare("DELETE FROM docs WHERE id = ?").run(id);

    return c.json({ data: { id } });
  })

  .get("/:id/content", async (c) => {
    const id = c.req.param("id");
    const db = await ensureDb();

    const doc = db.prepare("SELECT id FROM docs WHERE id = ?").get(id);

    if (!doc) {
      return c.json({ error: "Document not found" }, 404);
    }

    const content = db
      .prepare("SELECT * FROM doc_contents WHERE doc_id = ?")
      .get(id) as Record<string, unknown> | undefined;

    if (!content) {
      return c.json({ error: "Content not found" }, 404);
    }

    return c.json({ data: snakeToCamelContent(content) });
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

    const db = await ensureDb();

    const doc = db.prepare("SELECT id FROM docs WHERE id = ?").get(id);

    if (!doc) {
      return c.json({ error: "Document not found" }, 404);
    }

    const now = Date.now();

    const existing = db
      .prepare("SELECT id FROM doc_contents WHERE doc_id = ?")
      .get(id);

    if (existing) {
      db.prepare(
        "UPDATE doc_contents SET content = ?, updated_at = ? WHERE doc_id = ?",
      ).run(parsed.data.content, now, id);
    } else {
      db.prepare(
        "INSERT INTO doc_contents (id, doc_id, content, created_at, updated_at) VALUES (?, ?, ?, ?, ?)",
      ).run(nanoid(), id, parsed.data.content, now, now);
    }

    db.prepare("UPDATE docs SET updated_at = ? WHERE id = ?").run(now, id);

    const content = db
      .prepare("SELECT * FROM doc_contents WHERE doc_id = ?")
      .get(id) as Record<string, unknown>;

    ingestDocument(id).catch((err) => {
      console.error("[Auto-Ingest Error]", err);
    });

    return c.json({ data: snakeToCamelContent(content) });
  });
