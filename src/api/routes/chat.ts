import { convertToModelMessages, ToolLoopAgent, tool } from "ai";
import { createOllama } from "ai-sdk-ollama";
import { Hono } from "hono";
import { z } from "zod";
import { formatAnnotatedText, hybridSearch } from "@/lib/retrieval";

const ollama = createOllama({
  apiKey: process.env.OLLAMA_API_KEY,
  baseURL: process.env.OLLAMA_API_URL,
});

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
    const results = await hybridSearch(query, topK);
    console.log(results);
    const annotated = formatAnnotatedText(results);
    return { context: annotated };
  },
});

const agent = new ToolLoopAgent({
  model: ollama("gpt-oss:120b-cloud", {
    think: true,
    toolCallingOptions: { maxRetries: 3 },
  }),
  tools: { retrieval: retrievalTool },
  instructions:
    "You are a research assistant. Use the retrieval tool to search for relevant context before answering questions. Analyze the annotated context provided by the tool and base your answers on it. If the retrieval tool returns no relevant context, respond with 'No context recovered!'",
});

export const chatRoutes = new Hono().post("/", async (c) => {
  const { messages } = await c.req.json();
  const modelMessages = await convertToModelMessages(messages);

  const res = await agent.stream({
    messages: modelMessages,
  });

  return res.toUIMessageStreamResponse();
});
