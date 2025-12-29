/**
 * GCP and GKE Tools for MCP Server
 *
 * Uses direct REST API calls instead of SDKs to work with Cloudflare Workers
 */

export interface GCPConfig {
  projectId: string;
  clusterName: string;
  region: string;
  serviceAccountKey: string; // JSON key as string
}

interface ServiceAccountCredentials {
  client_email: string;
  private_key: string;
  project_id: string;
}

/**
 * Get an access token using service account credentials
 * Uses JWT signing and OAuth 2.0 flow
 */
async function getAccessToken(credentials: ServiceAccountCredentials): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const expiry = now + 3600; // 1 hour

  // Create JWT header and claims
  const header = {
    alg: "RS256",
    typ: "JWT",
  };

  const claims = {
    iss: credentials.client_email,
    scope: "https://www.googleapis.com/auth/cloud-platform",
    aud: "https://oauth2.googleapis.com/token",
    exp: expiry,
    iat: now,
  };

  // Encode header and claims
  const encodedHeader = base64UrlEncode(JSON.stringify(header));
  const encodedClaims = base64UrlEncode(JSON.stringify(claims));
  const signatureInput = `${encodedHeader}.${encodedClaims}`;

  // Sign with private key
  const signature = await signJWT(signatureInput, credentials.private_key);
  const jwt = `${signatureInput}.${signature}`;

  // Exchange JWT for access token
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: jwt,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to get access token: ${error}`);
  }

  const data = await response.json() as { access_token: string };
  return data.access_token;
}

/**
 * Sign JWT using RS256
 */
async function signJWT(data: string, privateKeyPem: string): Promise<string> {
  // Import the private key
  const pemContents = privateKeyPem
    .replace(/-----BEGIN PRIVATE KEY-----/, "")
    .replace(/-----END PRIVATE KEY-----/, "")
    .replace(/\s/g, "");

  const binaryKey = Uint8Array.from(atob(pemContents), (c) => c.charCodeAt(0));

  const key = await crypto.subtle.importKey(
    "pkcs8",
    binaryKey,
    {
      name: "RSASSA-PKCS1-v1_5",
      hash: "SHA-256",
    },
    false,
    ["sign"]
  );

  // Sign the data
  const encoder = new TextEncoder();
  const signature = await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5",
    key,
    encoder.encode(data)
  );

  // Convert to base64url
  return base64UrlEncode(signature);
}

/**
 * Base64 URL encode
 */
function base64UrlEncode(data: string | ArrayBuffer): string {
  let base64: string;

  if (typeof data === "string") {
    base64 = btoa(data);
  } else {
    const bytes = new Uint8Array(data);
    let binary = "";
    for (let i = 0; i < bytes.length; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    base64 = btoa(binary);
  }

  return base64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
}

/**
 * Get cluster endpoint and CA certificate
 */
async function getCluster(config: GCPConfig, accessToken: string) {
  const url = `https://container.googleapis.com/v1/projects/${config.projectId}/locations/${config.region}/clusters/${config.clusterName}`;

  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to get cluster: ${error}`);
  }

  const cluster = await response.json();
  return {
    endpoint: cluster.endpoint,
    caCertificate: cluster.masterAuth?.clusterCaCertificate,
  };
}

/**
 * List pods in a namespace
 */
export async function listPods(
  config: GCPConfig,
  namespace: string = "apps",
  labelSelector?: string
): Promise<any> {
  const credentials = JSON.parse(config.serviceAccountKey) as ServiceAccountCredentials;
  const accessToken = await getAccessToken(credentials);
  const cluster = await getCluster(config, accessToken);

  const url = new URL(`https://${cluster.endpoint}/api/v1/namespaces/${namespace}/pods`);
  if (labelSelector) {
    url.searchParams.set("labelSelector", labelSelector);
  }

  const response = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to list pods: ${error}`);
  }

  const data = await response.json();

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
  config: GCPConfig,
  podName: string,
  namespace: string = "apps",
  container?: string,
  tailLines: number = 100
): Promise<string> {
  const credentials = JSON.parse(config.serviceAccountKey) as ServiceAccountCredentials;
  const accessToken = await getAccessToken(credentials);
  const cluster = await getCluster(config, accessToken);

  const url = new URL(`https://${cluster.endpoint}/api/v1/namespaces/${namespace}/pods/${podName}/log`);
  url.searchParams.set("tailLines", tailLines.toString());
  if (container) {
    url.searchParams.set("container", container);
  }

  const response = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to get pod logs: ${error}`);
  }

  return await response.text();
}

/**
 * Describe a Kubernetes resource
 */
export async function describeResource(
  config: GCPConfig,
  kind: string,
  name: string,
  namespace: string = "apps"
): Promise<any> {
  const credentials = JSON.parse(config.serviceAccountKey) as ServiceAccountCredentials;
  const accessToken = await getAccessToken(credentials);
  const cluster = await getCluster(config, accessToken);

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
    throw new Error(`Unsupported resource kind: ${kind}`);
  }

  const url = `https://${cluster.endpoint}${apiPath}`;

  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to describe ${kind}/${name}: ${error}`);
  }

  return await response.json();
}

/**
 * Query Cloud Logging using the REST API
 */
export async function queryCloudLogs(
  config: GCPConfig,
  filter: string,
  limit: number = 50
): Promise<any[]> {
  const credentials = JSON.parse(config.serviceAccountKey) as ServiceAccountCredentials;
  const accessToken = await getAccessToken(credentials);

  const url = `https://logging.googleapis.com/v2/entries:list`;

  const response = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      resourceNames: [`projects/${config.projectId}`],
      filter,
      pageSize: limit,
      orderBy: "timestamp desc",
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to query logs: ${error}`);
  }

  const data = await response.json();

  if (!data.entries) {
    return [];
  }

  return data.entries.map((entry: any) => ({
    timestamp: entry.timestamp,
    severity: entry.severity,
    resource: entry.resource?.type,
    message: typeof entry.textPayload === "string" ? entry.textPayload : JSON.stringify(entry.jsonPayload || entry.protoPayload),
    labels: entry.labels,
  }));
}
