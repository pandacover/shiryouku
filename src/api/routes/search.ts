import { Effect } from "effect";
import { Hono } from "hono";
import { runEffect } from "@/api/bridge";
import { searchQuerySchema } from "@/api/schemas/search";
import { SearchIndex } from "@/lib/search";

export const searchRoutes = new Hono().get("/", async (c) => {
  const q = c.req.query("q") || "";
  const limitParam = c.req.query("limit");

  const parsed = searchQuerySchema.safeParse({ q, limit: limitParam });

  if (!parsed.success) {
    return c.json(
      { error: "Validation failed", details: parsed.error.issues },
      400,
    );
  }

  const { q: query, limit } = parsed.data;

  return runEffect(
    c,
    Effect.gen(function* () {
      const search = yield* SearchIndex;
      const results = yield* search.search(query, limit);
      return { results };
    }),
  );
});
