import { McpAgent } from "agents/mcp";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
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
      "Says hello to someone",
      { name: z.string().describe("The name to greet") },
      async ({ name }) => {
        return {
          content: [
            {
              type: "text",
              text: `Hello, ${name}! This MCP server is working correctly.`,
            },
          ],
        };
      }
    );

    // Echo tool for testing
    this.server.tool(
      "echo",
      "Echoes back the input message",
      { message: z.string().describe("The message to echo") },
      async ({ message }) => {
        return {
          content: [
            {
              type: "text",
              text: `Echo: ${message}`,
            },
          ],
        };
      }
    );

    // Server info tool
    this.server.tool(
      "server_info",
      "Returns information about this MCP server",
      {},
      async () => {
        return {
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
        };
      }
    );
  }
}

// Export the worker
export default {
  fetch(request: Request, env: Env, ctx: ExecutionContext) {
    const url = new URL(request.url);

    // Handle SSE endpoint for MCP
    if (url.pathname === "/sse" || url.pathname === "/sse/") {
      return HelloMCP.serveSSE("/sse").fetch(request, env, ctx);
    }

    // Handle MCP messages endpoint
    if (url.pathname === "/mcp" || url.pathname === "/mcp/") {
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
        endpoints: {
          sse: "/sse",
          mcp: "/mcp",
          health: "/health",
        },
        usage: "Connect via SSE at /sse endpoint",
      }),
      {
        headers: { "Content-Type": "application/json" },
      }
    );
  },
};

// Environment type
interface Env {}
