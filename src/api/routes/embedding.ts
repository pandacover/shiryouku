import { Hono } from "hono";
import { z } from "zod";
import { deleteCollection } from "@/lib/chroma";
import {
  embedAllDocChunks,
  embedDocChunks,
  removeDocumentFromChroma,
} from "@/lib/embed";

export const embeddingRoutes = new Hono()
  .post("/embed", async (c) => {
    const body = await c.req.json();
    const parsed = z.object({ docId: z.string().min(1) }).safeParse(body);

    if (!parsed.success) {
      return c.json(
        { error: "Validation failed", details: parsed.error.issues },
        400,
      );
    }

    try {
      const result = await embedDocChunks(parsed.data.docId);
      return c.json({ data: result }, 201);
    } catch (err) {
      console.error("[Embed Error]", err);
      return c.json(
        { error: "Embedding failed", details: (err as Error).message },
        500,
      );
    }
  })

  .post("/embed-all", async (c) => {
    try {
      const result = await embedAllDocChunks();
      return c.json({ data: result });
    } catch (err) {
      console.error("[Embed All Error]", err);
      return c.json(
        {
          error: "Embedding all documents failed",
          details: (err as Error).message,
        },
        500,
      );
    }
  })

  .delete("/embed/:docId", async (c) => {
    const docId = c.req.param("docId");

    try {
      await removeDocumentFromChroma(docId);
      return c.json({ data: { docId } });
    } catch (err) {
      console.error("[Embed Remove Error]", err);
      return c.json(
        { error: "Removal failed", details: (err as Error).message },
        500,
      );
    }
  })

  .delete("/embed", async (c) => {
    try {
      await deleteCollection();
      return c.json({ data: { deleted: true } });
    } catch (err) {
      console.error("[Embed Delete Collection Error]", err);
      return c.json(
        {
          error: "Failed to delete collection",
          details: (err as Error).message,
        },
        500,
      );
    }
  });
