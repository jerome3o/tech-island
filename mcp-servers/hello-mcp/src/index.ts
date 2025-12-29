import OAuthProvider from "@cloudflare/workers-oauth-provider";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { McpAgent } from "agents/mcp";
import { z } from "zod";
import GoogleHandler from "./google-handler";
import {
  listPods,
  getPodLogs,
  describeResource,
  queryCloudLogs,
  type GCPConfig,
} from "./gcp-tools";

// Environment interface
interface Env {
  GCP_SERVICE_ACCOUNT_KEY?: string;
  GCP_PROJECT_ID?: string;
  GCP_CLUSTER_NAME?: string;
  GCP_REGION?: string;
}

// Define the MCP server with tools
export class HelloMCP extends McpAgent {
  server = new McpServer({
    name: "hello-mcp",
    version: "1.0.0",
  });

  async init() {
    // Get GCP configuration from environment
    console.log("[MCP] Initializing with env keys:", Object.keys(this.env || {}));
    console.log("[MCP] GCP_SERVICE_ACCOUNT_KEY present:", !!this.env.GCP_SERVICE_ACCOUNT_KEY);

    const gcpConfig: GCPConfig | null = this.env.GCP_SERVICE_ACCOUNT_KEY
      ? {
          serviceAccountKey: this.env.GCP_SERVICE_ACCOUNT_KEY,
          projectId: this.env.GCP_PROJECT_ID || "tech-island-447220",
          clusterName: this.env.GCP_CLUSTER_NAME || "tech-island",
          region: this.env.GCP_REGION || "europe-west2",
        }
      : null;

    console.log("[MCP] GCP config created:", !!gcpConfig);
    console.log("[MCP] Will add GCP tools:", !!gcpConfig);

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
              description: "MCP server for Tech Island with GCP/GKE access",
              timestamp: new Date().toISOString(),
              gcpEnabled: !!gcpConfig,
            }, null, 2),
          },
        ],
      })
    );

    // GCP/GKE Tools - only add if credentials are configured
    if (gcpConfig) {
      // List pods in a namespace
      this.server.tool(
        "get_pods",
        {
          namespace: z.string().default("apps").describe("Kubernetes namespace"),
          labelSelector: z.string().optional().describe("Label selector (e.g., 'app=my-app')"),
        },
        async ({ namespace, labelSelector }) => {
          try {
            const pods = await listPods(gcpConfig, namespace, labelSelector);
            return {
              content: [
                {
                  type: "text",
                  text: JSON.stringify(pods, null, 2),
                },
              ],
            };
          } catch (error: any) {
            return {
              content: [
                {
                  type: "text",
                  text: `Error getting pods: ${error.message}`,
                },
              ],
              isError: true,
            };
          }
        }
      );

      // Get pod logs
      this.server.tool(
        "get_pod_logs",
        {
          pod: z.string().describe("Pod name"),
          namespace: z.string().default("apps").describe("Kubernetes namespace"),
          container: z.string().optional().describe("Container name (if pod has multiple)"),
          tail: z.number().default(100).describe("Number of lines to tail"),
        },
        async ({ pod, namespace, container, tail }) => {
          try {
            const logs = await getPodLogs(gcpConfig, pod, namespace, container, tail);
            return {
              content: [
                {
                  type: "text",
                  text: logs,
                },
              ],
            };
          } catch (error: any) {
            return {
              content: [
                {
                  type: "text",
                  text: `Error getting pod logs: ${error.message}`,
                },
              ],
              isError: true,
            };
          }
        }
      );

      // Describe a Kubernetes resource
      this.server.tool(
        "describe_resource",
        {
          kind: z.enum(["pod", "deployment", "service", "ingress"]).describe("Resource kind"),
          name: z.string().describe("Resource name"),
          namespace: z.string().default("apps").describe("Kubernetes namespace"),
        },
        async ({ kind, name, namespace }) => {
          try {
            const resource = await describeResource(gcpConfig, kind, name, namespace);
            return {
              content: [
                {
                  type: "text",
                  text: JSON.stringify(resource, null, 2),
                },
              ],
            };
          } catch (error: any) {
            return {
              content: [
                {
                  type: "text",
                  text: `Error describing ${kind}/${name}: ${error.message}`,
                },
              ],
              isError: true,
            };
          }
        }
      );

      // Query Cloud Logging
      this.server.tool(
        "query_cloud_logs",
        {
          filter: z.string().describe("Cloud Logging filter (e.g., 'resource.type=\"k8s_container\"')"),
          limit: z.number().default(50).describe("Maximum number of log entries to return"),
        },
        async ({ filter, limit }) => {
          try {
            const logs = await queryCloudLogs(gcpConfig, filter, limit);
            return {
              content: [
                {
                  type: "text",
                  text: JSON.stringify(logs, null, 2),
                },
              ],
            };
          } catch (error: any) {
            return {
              content: [
                {
                  type: "text",
                  text: `Error querying logs: ${error.message}`,
                },
              ],
              isError: true,
            };
          }
        }
      );
    }
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
