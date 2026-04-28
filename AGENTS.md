<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

## Effect Architecture

The backend service layer uses Effect TS for typed error handling, dependency injection, and composable async operations.

### Services (Context.Tag pattern)

All services use `Context.Tag("ServiceName")<ServiceName, { methods }>()` pattern:
- **Database** (`src/lib/db.ts`) — `@effect/sql-pg` (Supabase PostgreSQL)
- **SearchIndex** (`src/lib/search.ts`) — BM25 in-memory search with `Ref<SearchIndexState>`
- **ChromaDb** (`src/lib/chroma.ts`) — ChromaDB vector store client
- **Embeddings** (`src/lib/embed.ts`) — OpenRouter embedding with retry
- **OllamaModel** (`src/lib/chat.ts`) — Ollama LLM model with Effect Config

### Key patterns

- **Layers**: Services are provided via `Layer.effect()` and wired in `src/lib/runtime.ts` as `AppLayer`
- **Errors**: Use `Data.TaggedError` from `src/lib/errors.ts` (DocumentNotFoundError, EmbeddingError, etc.)
- **Config**: Use `Config` from `src/lib/config.ts` for typed env vars
- **API routes**: Use `runEffect()` from `src/api/bridge.ts` to run Effects in Hono handlers
- **Tests**: Import `it` from `@effect/vitest`, use mock Layers in `src/lib/__tests__/helpers.ts`

### Test commands

- `bun run test` — Run vitest
- `bun run lint` — Biome lint
- `bun run format` — Biome format
