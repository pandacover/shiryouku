import { Effect } from "effect";
import type { Context } from "hono";
import type {
  ChromaDBError,
  ChunkingError,
  DocumentNotFoundError,
  EmbeddingError,
  SearchIndexError,
  ValidationError,
} from "@/lib/errors";
import { AppLayer } from "@/lib/runtime";

function isTaggedError(
  err: unknown,
): err is { _tag: string; [key: string]: unknown } {
  return typeof err === "object" && err !== null && "_tag" in err;
}

export function runEffect<A, E, R>(
  ctx: Context,
  effect: Effect.Effect<A, E, R>,
  errorMap?: Partial<Record<string, (err: never) => Response>>,
): Promise<Response> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const program = Effect.provide(effect as any, AppLayer).pipe(
    Effect.catchAll((err) => {
      // Log layer construction errors
      Effect.logError(`Layer construction error: ${String(err)}`).pipe(
        Effect.runFork,
      );
      return Effect.fail(err);
    }),
  ) as any;

  return Effect.matchEffect(program, {
    onFailure: (err: unknown) => {
      if (isTaggedError(err)) {
        const tag = err._tag;

        if (errorMap && tag in errorMap) {
          const handler = errorMap[tag] as (e: never) => Response;
          return Effect.succeed(handler(err as never));
        }

        switch (tag) {
          case "DocumentNotFoundError":
            return Effect.succeed(
              ctx.json(
                {
                  error: "Document not found",
                  details: (err as unknown as DocumentNotFoundError).docId,
                },
                404,
              ),
            );
          case "ValidationError":
            return Effect.succeed(
              ctx.json(
                {
                  error: "Validation failed",
                  details: (err as unknown as ValidationError).details,
                },
                400,
              ),
            );
          case "SearchIndexError":
            return Effect.succeed(
              ctx.json(
                {
                  error: "Search index error",
                  details: String((err as unknown as SearchIndexError).cause),
                },
                500,
              ),
            );
          case "ChromaDBError":
            return Effect.succeed(
              ctx.json(
                {
                  error: "ChromaDB error",
                  details: String((err as unknown as ChromaDBError).cause),
                },
                500,
              ),
            );
          case "EmbeddingError":
            return Effect.succeed(
              ctx.json(
                {
                  error: "Embedding error",
                  details: String((err as unknown as EmbeddingError).cause),
                },
                500,
              ),
            );
          case "ChunkingError":
            return Effect.succeed(
              ctx.json(
                {
                  error: "Chunking error",
                  details: String((err as unknown as ChunkingError).cause),
                },
                500,
              ),
            );
          case "SqlError": {
            const sqlError = err as { message?: string; cause?: unknown };
            const sqlErrorDetails =
              sqlError.message ?? String(sqlError.cause ?? sqlError);
            return Effect.gen(function* () {
              yield* Effect.logError(`SQL Error: ${sqlErrorDetails}`);
              return ctx.json(
                {
                  error: "Database error",
                  details: sqlErrorDetails,
                },
                500,
              );
            });
          }
          default:
            return Effect.succeed(
              ctx.json({ error: "Internal Server Error" }, 500),
            );
        }
      }

      return Effect.succeed(ctx.json({ error: "Internal Server Error" }, 500));
    },
    onSuccess: (data) =>
      Effect.succeed(data instanceof Response ? data : ctx.json({ data })),
  }).pipe(Effect.runPromise as any) as Promise<Response>;
}
