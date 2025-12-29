# MCP Servers

Remote Model Context Protocol (MCP) servers deployed on Cloudflare Workers.

## What Are MCP Servers?

MCP servers give Claude tools to interact with external services. When connected via claude.ai Settings > Connectors, Claude can use these tools to:
- View Kubernetes logs
- Check GitHub Actions status
- Merge pull requests
- And more...

## Available Servers

| Server | Description | Status |
|--------|-------------|--------|
| `hello-mcp` | Test server with basic tools | Ready |
| `k8s-tools` | Kubernetes logs and status | Planned |
| `github-tools` | GitHub PRs and Actions | Planned |

## Deployment

MCP servers are automatically deployed when you push to `main`:

```
Push to main → GitHub Action → Cloudflare Workers → Live MCP Server
```

The deployed URL will be:
```
https://SERVER_NAME.YOUR_ACCOUNT.workers.dev/sse
```

## Connecting to Claude

1. Go to [claude.ai Settings > Connectors](https://claude.ai/settings/connectors)
2. Add the MCP server URL
3. For OAuth servers, authorize when prompted
4. Start using the tools in your conversations

## Creating a New MCP Server

1. Copy an existing server:
   ```bash
   cp -r mcp-servers/hello-mcp mcp-servers/my-new-server
   ```

2. Update `wrangler.jsonc`:
   ```json
   {
     "name": "my-new-server"
   }
   ```

3. Implement your tools in `src/index.ts`

4. Add your server to the workflow's options in `.github/workflows/deploy-mcp.yml`

5. Push to main - it will deploy automatically

## Local Development

```bash
cd mcp-servers/hello-mcp

# Install dependencies
npm install

# Start dev server
npm run dev

# Test with MCP inspector
npx @modelcontextprotocol/inspector@latest
```

## Adding OAuth Authentication

For servers that need user authentication (e.g., GitHub):

1. Use the OAuth template:
   ```bash
   npm create cloudflare@latest -- my-server --template=cloudflare/ai/demos/remote-mcp-github-oauth
   ```

2. Configure OAuth app and secrets (see Cloudflare docs)

3. Update wrangler.jsonc with KV namespace for token storage

## Required GitHub Secrets

| Secret | Description |
|--------|-------------|
| `CLOUDFLARE_ACCOUNT_ID` | Your Cloudflare account ID |
| `CLOUDFLARE_API_TOKEN` | API token with Workers edit permission |
| `MCP_AUTHORIZED_EMAIL` | Email address authorized to use the MCP server (e.g., `your@email.com`) |

## Resources

- [Cloudflare MCP Docs](https://developers.cloudflare.com/agents/guides/remote-mcp-server/)
- [MCP Specification](https://modelcontextprotocol.io/)
- [Claude MCP Connector](https://support.claude.com/en/articles/11503834-building-custom-connectors-via-remote-mcp-servers)
