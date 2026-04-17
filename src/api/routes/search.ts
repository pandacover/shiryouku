import { Hono } from "hono";
import { searchQuerySchema } from "@/api/schemas/search";
import { searchIndex } from "@/lib/search";

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

  try {
    const results = await searchIndex.search(query, limit);
    return c.json({ data: { results } });
  } catch (err) {
    console.error("[Search Error]", err);
    return c.json(
      { error: "Search failed", details: (err as Error).message },
      500,
    );
  }
});
