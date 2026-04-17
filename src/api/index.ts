import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import { chatRoutes } from "./routes/chat";
import { docsRoutes } from "./routes/docs";
import { embeddingRoutes } from "./routes/embedding";
import { indexingRoutes } from "./routes/indexing";
import { searchRoutes } from "./routes/search";

const api = new Hono()
  .basePath("/api")
  .use("*", cors())
  .use("*", logger())
  .onError((err, c) => {
    console.error("[API Error]", err);
    return c.json(
      { error: "Internal Server Error", details: err.message },
      500,
    );
  })
  .route("/docs", docsRoutes)
  .route("/search", searchRoutes)
  .route("/chat", chatRoutes)
  .route("/indexing", indexingRoutes)
  .route("/embedding", embeddingRoutes);

export type ApiType = typeof api;
export { api };
