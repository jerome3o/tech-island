# Ingress NGINX

This directory contains the configuration for the ingress-nginx controller.

## What it does

- Provides a single entrypoint (LoadBalancer) for all apps
- Routes traffic to apps based on hostname
- Terminates TLS (with cert-manager)
- Integrates with oauth2-proxy for authentication

## Installation

The manifests install ingress-nginx from the official release. The configuration
is customized for our setup with:

- Static IP address (created by Terraform)
- Integration with oauth2-proxy auth annotations
- Proper logging and metrics

## Usage

Apps use ingress resources with annotations like:

```yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: my-app
  annotations:
    nginx.ingress.kubernetes.io/auth-url: "https://$host/oauth2/auth"
    nginx.ingress.kubernetes.io/auth-signin: "https://$host/oauth2/start?rd=$escaped_request_uri"
spec:
  ingressClassName: nginx
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
