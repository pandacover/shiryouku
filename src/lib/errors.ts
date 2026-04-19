import { Data } from "effect";

export class DocumentNotFoundError extends Data.TaggedError(
  "DocumentNotFoundError",
)<{
  readonly docId: string;
}> {}

export class EmbeddingError extends Data.TaggedError("EmbeddingError")<{
  readonly cause: unknown;
}> {}

export class ChromaDBError extends Data.TaggedError("ChromaDBError")<{
  readonly cause: unknown;
}> {}

export class SearchIndexError extends Data.TaggedError("SearchIndexError")<{
  readonly cause: unknown;
}> {}

export class ChunkingError extends Data.TaggedError("ChunkingError")<{
  readonly cause: unknown;
}> {}

export class ValidationError extends Data.TaggedError("ValidationError")<{
  readonly details: unknown;
}> {}

export class ConfigError extends Data.TaggedError("ConfigError")<{
  readonly key: string;
  readonly message: string;
}> {}
