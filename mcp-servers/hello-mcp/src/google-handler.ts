/**
 * Google OAuth Handler for MCP Server
 *
 * This handler implements the OAuth flow with Google as the upstream provider.
 * It acts as an OAuth server to MCP clients while using Google as the identity provider.
 */

const GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const GOOGLE_USERINFO_URL = "https://www.googleapis.com/oauth2/v2/userinfo";

interface AuthRequest {
  clientId: string;
  redirectUri: string;
  state: string;
  scope: string;
  codeChallenge?: string;
  codeChallengeMethod?: string;
}

export interface Env {
  OAUTH_KV: KVNamespace;
  GOOGLE_CLIENT_ID: string;
  GOOGLE_CLIENT_SECRET: string;
  COOKIE_ENCRYPTION_KEY: string;
  AUTHORIZED_EMAIL: string;
  OAUTH_PROVIDER: {
    parseAuthRequest(request: Request): Promise<AuthRequest>;
    lookupClient(clientId: string): Promise<{ name: string; redirectUris: string[] } | null>;
    completeAuthorization(options: { request: AuthRequest; userId: string; metadata?: Record<string, unknown>; scope: string; props?: Record<string, unknown> }): Promise<{ redirectTo: string }>;
  };
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);

    // Handle the OAuth authorization request from MCP client
    if (url.pathname === "/authorize") {
      return handleAuthorize(request, env);
    }

    // Handle callback from Google OAuth
    if (url.pathname === "/callback") {
      return handleCallback(request, env);
    }

    // Show a simple login page or redirect
    return new Response("Google OAuth MCP Server", {
      headers: { "Content-Type": "text/plain" },
    });
  },
};

async function handleAuthorize(request: Request, env: Env): Promise<Response> {
  // Parse the authorization request from the MCP client
  const authRequest = await env.OAUTH_PROVIDER.parseAuthRequest(request);

  // Verify the client
  const client = await env.OAUTH_PROVIDER.lookupClient(authRequest.clientId);
  if (!client) {
    return new Response("Unknown client", { status: 400 });
  }

  // Store the full auth request in KV for the callback (including PKCE values)
  const stateKey = crypto.randomUUID();
  await env.OAUTH_KV.put(
    `auth:${stateKey}`,
    JSON.stringify({
      clientId: authRequest.clientId,
      redirectUri: authRequest.redirectUri,
      state: authRequest.state,
      scope: authRequest.scope,
      codeChallenge: authRequest.codeChallenge,
      codeChallengeMethod: authRequest.codeChallengeMethod,
    }),
    { expirationTtl: 600 } // 10 minutes
  );

  // Build Google OAuth URL
  const googleAuthUrl = new URL(GOOGLE_AUTH_URL);
  googleAuthUrl.searchParams.set("client_id", env.GOOGLE_CLIENT_ID);
  googleAuthUrl.searchParams.set("redirect_uri", `${new URL(request.url).origin}/callback`);
  googleAuthUrl.searchParams.set("response_type", "code");
  googleAuthUrl.searchParams.set("scope", "openid email profile");
  googleAuthUrl.searchParams.set("state", stateKey);
  googleAuthUrl.searchParams.set("access_type", "offline");
  googleAuthUrl.searchParams.set("prompt", "consent");

  return Response.redirect(googleAuthUrl.toString(), 302);
}

async function handleCallback(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const stateKey = url.searchParams.get("state");
  const error = url.searchParams.get("error");

  if (error) {
    return new Response(`OAuth error: ${error}`, { status: 400 });
  }

  if (!code || !stateKey) {
    return new Response("Missing code or state", { status: 400 });
  }

  // Retrieve the original auth request
  const authRequestJson = await env.OAUTH_KV.get(`auth:${stateKey}`);
  if (!authRequestJson) {
    return new Response("Invalid or expired state", { status: 400 });
  }
  const authRequest: AuthRequest = JSON.parse(authRequestJson);

  // Exchange code for tokens with Google
  const tokenResponse = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: env.GOOGLE_CLIENT_ID,
      client_secret: env.GOOGLE_CLIENT_SECRET,
      code,
      grant_type: "authorization_code",
      redirect_uri: `${url.origin}/callback`,
    }),
  });

  if (!tokenResponse.ok) {
    const errorText = await tokenResponse.text();
    return new Response(`Token exchange failed: ${errorText}`, { status: 400 });
  }

  const tokens = await tokenResponse.json() as { access_token: string };

  // Get user info from Google
  const userInfoResponse = await fetch(GOOGLE_USERINFO_URL, {
    headers: { Authorization: `Bearer ${tokens.access_token}` },
  });

  if (!userInfoResponse.ok) {
    return new Response("Failed to get user info", { status: 400 });
  }

  const userInfo = await userInfoResponse.json() as { id: string; email: string; name: string };

  // Only allow the authorized email to access this MCP server
  console.log("[OAuth] User email:", userInfo.email);
  console.log("[OAuth] Authorized email:", env.AUTHORIZED_EMAIL);
  console.log("[OAuth] Match:", userInfo.email === env.AUTHORIZED_EMAIL);

  if (userInfo.email !== env.AUTHORIZED_EMAIL) {
    console.error("[OAuth] Unauthorized access attempt:", userInfo.email);
    return new Response("Unauthorized: This MCP server is restricted to authorized users only.", {
      status: 403,
      headers: { "Content-Type": "text/plain" }
    });
  }

  console.log("[OAuth] Access granted to:", userInfo.email);

  // Clean up the state
  await env.OAUTH_KV.delete(`auth:${stateKey}`);

  // Complete the authorization with the OAuth provider
  // Pass the full auth request including PKCE values
  const { redirectTo } = await env.OAUTH_PROVIDER.completeAuthorization({
    request: authRequest,
    userId: userInfo.id,
    metadata: {
      email: userInfo.email,
      name: userInfo.name,
    },
    scope: authRequest.scope,
    props: {
      accessToken: tokens.access_token,
    },
  });

  // Redirect back to the MCP client with the authorization code
  return Response.redirect(redirectTo, 302);
}
