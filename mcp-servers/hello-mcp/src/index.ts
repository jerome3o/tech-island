import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { McpAgent } from "agents/mcp";
import { z } from "zod";

// Define the MCP server with tools
export class HelloMCP extends McpAgent {
  server = new McpServer({
    name: "hello-mcp",
    version: "1.0.0",
  });

  async init() {
    // Simple greeting tool
    this.server.tool(
      "hello",
      { name: z.string() },
      async ({ name }) => ({
        content: [{ type: "text", text: `Hello, ${name}! This MCP server is working correctly.` }],
      })
    );

    // Echo tool for testing
    this.server.tool(
      "echo",
      { message: z.string() },
      async ({ message }) => ({
        content: [{ type: "text", text: `Echo: ${message}` }],
      })
    );

    // Server info tool
    this.server.tool(
      "server_info",
      {},
      async () => ({
        content: [
          {
            type: "text",
            text: JSON.stringify({
              name: "hello-mcp",
              version: "1.0.0",
              description: "Test MCP server for Tech Island",
              timestamp: new Date().toISOString(),
            }, null, 2),
          },
        ],
      })
    );
  }
}

// Export the worker
export default {
  fetch(request: Request, env: Env, ctx: ExecutionContext) {
    const url = new URL(request.url);

    // Handle SSE endpoint for MCP (matches /sse and /sse/message)
    if (url.pathname === "/sse" || url.pathname === "/sse/message") {
      return HelloMCP.serveSSE("/sse").fetch(request, env, ctx);
    }

    // Handle Streamable HTTP endpoint for MCP
    if (url.pathname === "/mcp") {
      return HelloMCP.serve("/mcp").fetch(request, env, ctx);
    }

    // Health check
    if (url.pathname === "/health") {
      return new Response(JSON.stringify({ status: "ok" }), {
        headers: { "Content-Type": "application/json" },
      });
    }

    // Root - show info
    return new Response(
      JSON.stringify({
        name: "hello-mcp",
        version: "1.0.0",
        endpoints: {
          sse: "/sse",
          mcp: "/mcp",
          health: "/health",
        },
        usage: "Connect via /sse (SSE) or /mcp (Streamable HTTP)",
      }),
      {
        headers: { "Content-Type": "application/json" },
      }
    );
  },
};

// Environment type
interface Env {}
