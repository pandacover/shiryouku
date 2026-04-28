import { Effect } from "effect";
import { Hono } from "hono";
import { z } from "zod";
import { runEffect } from "@/api/bridge";
import { ChromaDb } from "@/lib/chroma";
import { Embeddings } from "@/lib/embed";

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

    return runEffect(
      c,
      Effect.gen(function* () {
        const embed = yield* Embeddings;
        const result = yield* embed.embedDocChunks(parsed.data.docId);
        return result;
      }),
    );
  })

  .post("/embed-all", async (c) => {
    return runEffect(
      c,
      Effect.gen(function* () {
        const embed = yield* Embeddings;
        const result = yield* embed.embedAllDocChunks();
        return result;
      }),
    );
  })

  .delete("/embed/:docId", async (c) => {
    const docId = c.req.param("docId");

    return runEffect(
      c,
      Effect.gen(function* () {
        const embed = yield* Embeddings;
        yield* embed.removeDocumentFromChroma(docId);
        return { docId };
      }),
    );
  })

  .delete("/embed", async (c) => {
    return runEffect(
      c,
      Effect.gen(function* () {
        const chroma = yield* ChromaDb;
        yield* chroma.deleteCollection();
        return { deleted: true };
      }),
    );
  });
