import { createOllama } from "ai-sdk-ollama";
import { Context, Effect, Layer, Redacted } from "effect";
import { OllamaApiKey, OllamaApiUrl } from "@/lib/config";

export class OllamaModel extends Context.Tag("OllamaModel")<
  OllamaModel,
  {
    readonly model: ReturnType<ReturnType<typeof createOllama>>;
  }
>() {}

export const OllamaModelLive = Layer.effect(
  OllamaModel,
  Effect.gen(function* () {
    const apiKey = yield* OllamaApiKey;
    const baseUrl = yield* OllamaApiUrl;
    const ollama = createOllama({
      apiKey: Redacted.value(apiKey),
      baseURL: baseUrl,
    });
    const model = ollama("gpt-oss:120b-cloud", {
      think: true,
      toolCallingOptions: { maxRetries: 3 },
    });
    return OllamaModel.of({ model });
  }),
);
