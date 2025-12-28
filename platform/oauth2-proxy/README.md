# OAuth2 Proxy

Provides Google authentication for all apps at the ingress level.

## What it does

- Acts as an authentication middleware
- Users must log in with Google before accessing any protected app
- Session is maintained via cookies
- Can be configured to allow unauthenticated access to specific paths

## How it works

1. User requests `https://app.example.com/`
2. Ingress checks auth with oauth2-proxy via `auth-url` annotation
3. If not authenticated, redirects to Google login
4. User logs in with Google
5. oauth2-proxy sets a session cookie
6. Subsequent requests include the cookie and pass through

## Configuration

### Required Secrets

Before deploying, you must create a Kubernetes secret with your OAuth credentials:

```bash
kubectl create secret generic oauth2-proxy-secrets \
  --namespace oauth2-proxy \
  --from-literal=client-id=YOUR_GOOGLE_CLIENT_ID \
  --from-literal=client-secret=YOUR_GOOGLE_CLIENT_SECRET \
  --from-literal=cookie-secret=$(openssl rand -base64 32 | tr -d '\n')
```

See `docs/gcp-setup.md` for instructions on creating Google OAuth credentials.

### Allowed Emails/Domains

By default, only emails from your configured domain can access apps.
Edit `configmap.yaml` to change the allowed domains/emails.

## Allowing Unauthenticated Access

To allow certain paths to be accessed without authentication:

```yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: my-app
  annotations:
    # Don't require auth for these paths
    nginx.ingress.kubernetes.io/auth-snippet: |
      if ($request_uri ~ "^/(health|api/public)") {
        return 200;
      }
spec:
  # ...
```

Or use the `skip-auth-urls` configuration in oauth2-proxy.
