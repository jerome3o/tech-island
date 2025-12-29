/**
 * GCP and GKE Tools for MCP Server
 *
 * Provides tools to interact with Google Kubernetes Engine and Cloud Logging
 */

import { ClusterManagerClient } from "@google-cloud/container";
import { Logging } from "@google-cloud/logging";
import { GoogleAuth } from "google-auth-library";

export interface GCPConfig {
  projectId: string;
  clusterName: string;
  region: string;
  serviceAccountKey: string; // JSON key as string
}

/**
 * Initialize GCP clients with service account credentials
 */
export function createGCPClients(config: GCPConfig) {
  // Parse the service account key
  const credentials = JSON.parse(config.serviceAccountKey);

  // Create auth client
  const auth = new GoogleAuth({
    credentials,
    scopes: [
      "https://www.googleapis.com/auth/cloud-platform",
      "https://www.googleapis.com/auth/logging.read",
    ],
  });

  // Create clients
  const clusterManager = new ClusterManagerClient({
    credentials,
  });

  const logging = new Logging({
    projectId: config.projectId,
    credentials,
  });

  return { clusterManager, logging, auth };
}

/**
 * Get the cluster path for GKE API calls
 */
export function getClusterPath(projectId: string, region: string, clusterName: string): string {
  return `projects/${projectId}/locations/${region}/clusters/${clusterName}`;
}

/**
 * List pods in a namespace
 */
export async function listPods(
  clients: ReturnType<typeof createGCPClients>,
  config: GCPConfig,
  namespace: string = "apps",
  labelSelector?: string
): Promise<any> {
  // For Kubernetes resources, we need to use the Kubernetes API directly
  // The Container client only manages clusters, not resources within them

  // Get cluster credentials
  const clusterPath = getClusterPath(config.projectId, config.region, config.clusterName);
  const [cluster] = await clients.clusterManager.getCluster({ name: clusterPath });

  if (!cluster.endpoint || !cluster.masterAuth?.clusterCaCertificate) {
    throw new Error("Cluster endpoint or CA certificate not found");
  }

  // Build Kubernetes API URL
  const apiUrl = `https://${cluster.endpoint}/api/v1/namespaces/${namespace}/pods`;
  const url = new URL(apiUrl);
  if (labelSelector) {
    url.searchParams.set("labelSelector", labelSelector);
  }

  // Get access token for authentication
  const authClient = await clients.auth.getClient();
  const accessToken = await authClient.getAccessToken();

  if (!accessToken.token) {
    throw new Error("Failed to get access token");
  }

  // Call Kubernetes API
  const response = await fetch(url.toString(), {
    headers: {
      Authorization: `Bearer ${accessToken.token}`,
    },
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to list pods: ${response.status} ${errorText}`);
  }

  const data = await response.json();

  // Format the response to be more readable
  return {
    items: data.items.map((pod: any) => ({
      name: pod.metadata.name,
      namespace: pod.metadata.namespace,
      status: pod.status.phase,
      restarts: pod.status.containerStatuses?.[0]?.restartCount || 0,
      age: pod.metadata.creationTimestamp,
      containers: pod.spec.containers.map((c: any) => c.name),
    })),
    total: data.items.length,
  };
}

/**
 * Get pod logs
 */
export async function getPodLogs(
  clients: ReturnType<typeof createGCPClients>,
  config: GCPConfig,
  podName: string,
  namespace: string = "apps",
  container?: string,
  tailLines: number = 100
): Promise<string> {
  const clusterPath = getClusterPath(config.projectId, config.region, config.clusterName);
  const [cluster] = await clients.clusterManager.getCluster({ name: clusterPath });

  if (!cluster.endpoint) {
    throw new Error("Cluster endpoint not found");
  }

  // Build logs URL
  const apiUrl = `https://${cluster.endpoint}/api/v1/namespaces/${namespace}/pods/${podName}/log`;
  const url = new URL(apiUrl);
  url.searchParams.set("tailLines", tailLines.toString());
  if (container) {
    url.searchParams.set("container", container);
  }

  // Get access token
  const authClient = await clients.auth.getClient();
  const accessToken = await authClient.getAccessToken();

  if (!accessToken.token) {
    throw new Error("Failed to get access token");
  }

  // Call Kubernetes API
  const response = await fetch(url.toString(), {
    headers: {
      Authorization: `Bearer ${accessToken.token}`,
    },
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to get pod logs: ${response.status} ${errorText}`);
  }

  return await response.text();
}

/**
 * Describe a Kubernetes resource
 */
export async function describeResource(
  clients: ReturnType<typeof createGCPClients>,
  config: GCPConfig,
  kind: string,
  name: string,
  namespace: string = "apps"
): Promise<any> {
  const clusterPath = getClusterPath(config.projectId, config.region, config.clusterName);
  const [cluster] = await clients.clusterManager.getCluster({ name: clusterPath });

  if (!cluster.endpoint) {
    throw new Error("Cluster endpoint not found");
  }

  // Map kind to API path
  const apiPaths: Record<string, string> = {
    pod: `/api/v1/namespaces/${namespace}/pods/${name}`,
    pods: `/api/v1/namespaces/${namespace}/pods/${name}`,
    deployment: `/apis/apps/v1/namespaces/${namespace}/deployments/${name}`,
    deployments: `/apis/apps/v1/namespaces/${namespace}/deployments/${name}`,
    service: `/api/v1/namespaces/${namespace}/services/${name}`,
    services: `/api/v1/namespaces/${namespace}/services/${name}`,
    ingress: `/apis/networking.k8s.io/v1/namespaces/${namespace}/ingresses/${name}`,
    ingresses: `/apis/networking.k8s.io/v1/namespaces/${namespace}/ingresses/${name}`,
  };

  const apiPath = apiPaths[kind.toLowerCase()];
  if (!apiPath) {
    throw new Error(`Unsupported resource kind: ${kind}. Supported: pod, deployment, service, ingress`);
  }

  const apiUrl = `https://${cluster.endpoint}${apiPath}`;

  // Get access token
  const authClient = await clients.auth.getClient();
  const accessToken = await authClient.getAccessToken();

  if (!accessToken.token) {
    throw new Error("Failed to get access token");
  }

  // Call Kubernetes API
  const response = await fetch(apiUrl, {
    headers: {
      Authorization: `Bearer ${accessToken.token}`,
    },
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to describe ${kind}/${name}: ${response.status} ${errorText}`);
  }

  return await response.json();
}

/**
 * Query Cloud Logging
 */
export async function queryCloudLogs(
  clients: ReturnType<typeof createGCPClients>,
  config: GCPConfig,
  filter: string,
  limit: number = 50
): Promise<any[]> {
  const log = clients.logging.log("projects/" + config.projectId);

  // Query logs with filter
  const [entries] = await clients.logging.getEntries({
    resourceNames: [`projects/${config.projectId}`],
    filter,
    pageSize: limit,
    orderBy: "timestamp desc",
  });

  // Format entries for readability
  return entries.map((entry) => ({
    timestamp: entry.metadata.timestamp,
    severity: entry.metadata.severity,
    resource: entry.metadata.resource?.type,
    message: typeof entry.data === "string" ? entry.data : JSON.stringify(entry.data),
    labels: entry.metadata.labels,
  }));
}
