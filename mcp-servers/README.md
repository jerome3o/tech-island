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
| `GCP_MCP_SERVICE_ACCOUNT_KEY` | GCP service account JSON key for GKE/Cloud Logging access (see setup below) |

## GCP Integration Setup

The MCP server can access your GKE cluster and Cloud Logging. To enable this:

### 1. Deploy the Terraform Service Account

```bash
cd infrastructure/terraform
terraform apply
```

This creates a service account with the necessary permissions:
- `roles/container.developer` - GKE cluster access
- `roles/logging.viewer` - Cloud Logging access
- `roles/monitoring.viewer` - Cloud Monitoring access
- `roles/container.viewer` - List clusters

After applying, Terraform will output instructions for creating the key.

### 2. Create and Add the Service Account Key

1. Go to [GCP Console - Service Accounts](https://console.cloud.google.com/iam-admin/serviceaccounts)
2. Find the service account: `mcp-server@YOUR_PROJECT.iam.gserviceaccount.com`
3. Click **Keys** → **Add Key** → **Create new key** → **JSON**
4. Download the JSON file
5. Add to GitHub Secrets:
   - Go to your repo → Settings → Secrets and variables → Actions
   - Click **New repository secret**
   - Name: `GCP_MCP_SERVICE_ACCOUNT_KEY`
   - Value: Paste the **entire contents** of the JSON file
   - Click **Add secret**

### 3. Deploy the MCP Server

Push to main or manually trigger the workflow - the MCP server will now have GCP access!

## Available GCP Tools

Once configured, the MCP server provides these tools:

| Tool | Description |
|------|-------------|
| `get_pods` | List pods in a namespace with status and container info |
| `get_pod_logs` | Get logs from a specific pod (supports tail and container selection) |
| `describe_resource` | Get detailed info about pods, deployments, services, or ingresses |
| `query_cloud_logs` | Query Cloud Logging with filters (e.g., search for errors across all services) |

### Example Usage

```typescript
// In claude.ai after connecting the MCP server:

// List all pods in the apps namespace
get_pods({ namespace: "apps" })

// Get logs from a specific pod
get_pod_logs({ pod: "my-app-abc123", namespace: "apps", tail: 100 })

// Describe a deployment
describe_resource({ kind: "deployment", name: "my-app", namespace: "apps" })

// Query logs for errors
query_cloud_logs({
  filter: 'resource.type="k8s_container" AND severity="ERROR"',
  limit: 50
})
```

## Resources

- [Cloudflare MCP Docs](https://developers.cloudflare.com/agents/guides/remote-mcp-server/)
- [MCP Specification](https://modelcontextprotocol.io/)
- [Claude MCP Connector](https://support.claude.com/en/articles/11503834-building-custom-connectors-via-remote-mcp-servers)
