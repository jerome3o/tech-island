# cert-manager

Automatic TLS certificate management using Let's Encrypt.

## What it does

- Automatically provisions TLS certificates for ingresses
- Renews certificates before expiry
- Uses Let's Encrypt for free, trusted certificates

## How it works

1. You create an Ingress with a TLS section
2. cert-manager sees the ingress and creates a Certificate resource
3. cert-manager requests a certificate from Let's Encrypt
4. The certificate is stored in a Kubernetes Secret
5. ingress-nginx uses the secret for TLS termination

## Usage

Add the `cert-manager.io/cluster-issuer` annotation to your ingress:

```yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: my-app
  annotations:
    cert-manager.io/cluster-issuer: "letsencrypt-prod"
spec:
  ingressClassName: nginx
  tls:
    - hosts:
        - my-app.example.com
      secretName: my-app-tls
  rules:
    - host: my-app.example.com
      http:
        paths:
          - path: /
            pathType: Prefix
            backend:
              service:
                name: my-app
                port:
                  number: 80
```

## ClusterIssuers

Two issuers are configured:

- `letsencrypt-staging`: For testing (has higher rate limits, but certs aren't trusted)
- `letsencrypt-prod`: For production (trusted certs, but rate limited)

Always test with staging first!
