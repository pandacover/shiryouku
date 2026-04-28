import { Hono } from "hono";
import { cors } from "hono/cors";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { createMcpServer } from "@/mcp/factory";
import { Effect, Layer } from "effect";

const mcpRoutes = new Hono();

mcpRoutes.use("*", cors());

// SSE endpoint for MCP Streamable HTTP transport
mcpRoutes.get("/", async (c) => {
  const { server } = createMcpServer();
  const transport = new StreamableHTTPServerTransport({
    sessionIdGenerator: () => crypto.randomUUID(),
  });

  transport.onclose = () => {
    // Transport closed
  };

  transport.onerror = (error) => {
    // eslint-disable-next-line no-console
    console.error("[MCP] Transport error:", error);
  };

  // Handle the request using streamable HTTP
  await transport.handleRequest(c.req.raw, c.res);

  return c.text("", 200);
});

// Handle POST for MCP protocol messages
mcpRoutes.post("/", async (c) => {
  const { server } = createMcpServer();
  const transport = new StreamableHTTPServerTransport({
    sessionIdGenerator: () => crypto.randomUUID(),
  });

  transport.onclose = () => {
    // Transport closed
  };

  transport.onerror = (error) => {
    // eslint-disable-next-line no-console
    console.error("[MCP] Transport error:", error);
  };

  // Parse the body before passing to transport
  const body = await c.req.parseBody();
  await transport.handleRequest(c.req.raw, c.res, body);

  return c.text("", 200);
});

export { mcpRoutes };
