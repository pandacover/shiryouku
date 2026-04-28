import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/shared/../types.js";
import { Effect } from "effect";
import { AppLayer } from "@/lib/runtime";
import { formatAnnotatedText, hybridSearch, type HybridResult } from "@/lib/retrieval";

const toolSchema = {
  name: "hybrid_search",
  description:
    "Performs a hybrid search combining keyword (BM25) and semantic (vector) search to find relevant document chunks. Returns results ranked by reciprocal rank fusion.",
  inputSchema: {
    type: "object" as const,
    properties: {
      query: {
        type: "string",
        description: "The search query string",
      },
      limit: {
        type: "number",
        description: "Maximum number of results to return (default: 10)",
        default: 10,
      },
    },
    required: ["query"],
  },
};

export interface McpServer {
  readonly server: Server;
}

export function createMcpServer(): McpServer {
  const server = new Server(
    {
      name: "shiryouku-mcp",
      version: "0.1.0",
    },
    {
      capabilities: {
        tools: {},
      },
    },
  );

  server.setRequestHandler(ListToolsRequestSchema, async () => {
    return {
      tools: [toolSchema],
    };
  });

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;

    if (name !== "hybrid_search") {
      return {
        content: [
          {
            type: "text" as const,
            text: `Unknown tool: ${name}`,
          },
        ],
        isError: true,
      };
    }

    try {
      const query = args?.query as string;
      const limit = (args?.limit as number) ?? 10;

      if (!query) {
        return {
          content: [
            {
              type: "text" as const,
              text: "Missing required parameter: query",
            },
          ],
          isError: true,
        };
      }

      const program = Effect.provide(hybridSearch(query, limit), AppLayer);

      const results: readonly HybridResult[] = await Effect.runPromise(
        program as any,
      );

      const annotate = formatAnnotatedText(results)

      return {
        content: [
          {
            type: "text" as const,
            text: annotate,
          },
        ],
      };
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      return {
        content: [
          {
            type: "text" as const,
            text: `Error: ${errorMessage}`,
          },
        ],
        isError: true,
      };
    }
  });

  return { server };
}
