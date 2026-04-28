import { convertToModelMessages, ToolLoopAgent, tool } from "ai";
import type { createOllama } from "ai-sdk-ollama";
import { Effect } from "effect";
import { Hono } from "hono";
import { z } from "zod";
import { OllamaModel } from "@/lib/chat";
import {
  formatAnnotatedText,
  type HybridResult,
  hybridSearch,
} from "@/lib/retrieval";
import { AppLayer } from "@/lib/runtime";

const retrievalTool = tool({
  description:
    "Search documents using hybrid keyword and semantic search. Use this to find relevant context from the document corpus.",
  inputSchema: z.object({
    query: z.string().describe("query to search for relevant document chunks"),
    limit: z
      .number()
      .optional()
      .describe("number of results per search method (default 10)"),
  }),
  execute: async ({ query, limit }) => {
    const topK = limit ?? 10;
    const program = Effect.provide(hybridSearch(query, topK), AppLayer);
    const results: readonly HybridResult[] = await Effect.runPromise(
      program as any,
    );
    const annotated = formatAnnotatedText(results);
    return { context: annotated };
  },
});

export const chatRoutes = new Hono().post("/", async (c) => {
  const { messages } = await c.req.json();

  const program = Effect.gen(function* () {
    const { model } = yield* OllamaModel;
    return model;
  }).pipe(Effect.provide(AppLayer));
  const model = (await Effect.runPromise(program as any)) as ReturnType<
    ReturnType<typeof createOllama>
  >;

  const agent = new ToolLoopAgent({
    model,
    tools: { retrieval: retrievalTool },
    instructions:
      "You are a research assistant. Use the retrieval tool to search for relevant context before answering questions. Analyze the annotated context provided by the tool and base your answers on it. If the retrieval tool returns no relevant context, respond with 'No context recovered!'",
  });

  const modelMessages = await convertToModelMessages(messages);
  const res = await agent.stream({ messages: modelMessages });
  return res.toUIMessageStreamResponse();
});
