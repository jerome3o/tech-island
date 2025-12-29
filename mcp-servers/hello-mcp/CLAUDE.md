# Hello MCP

A test MCP server for verifying the deployment pipeline works.

## Tools

| Tool | Description |
|------|-------------|
| `hello` | Says hello to someone |
| `echo` | Echoes back a message |
| `server_info` | Returns server information |

## Endpoints

- `/sse` - SSE endpoint for MCP clients
- `/mcp` - Streamable HTTP endpoint
- `/health` - Health check
- `/` - Server info

## Testing

Connect to this server in Claude to verify MCP deployment is working:

```
https://hello-mcp.YOUR_ACCOUNT.workers.dev/sse
```

Then ask Claude: "Use the hello tool to greet me"

## Tech Stack

- Cloudflare Workers
- TypeScript
- MCP SDK
- Agents SDK
