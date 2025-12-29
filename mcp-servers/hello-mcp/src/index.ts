import OAuthProvider from "@cloudflare/workers-oauth-provider";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { McpAgent } from "agents/mcp";
import { z } from "zod";
import GoogleHandler from "./google-handler";

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

// Export the OAuth-wrapped worker
export default new OAuthProvider({
  apiRoute: "/sse",
  apiHandler: HelloMCP.serveSSE("/sse"),
  defaultHandler: GoogleHandler,
  authorizeEndpoint: "/authorize",
  tokenEndpoint: "/token",
  clientRegistrationEndpoint: "/register",
});
