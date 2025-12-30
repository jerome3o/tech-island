# Security Guidelines for Tech Island

> **IMPORTANT**: All applications must follow these security guidelines to protect user privacy and prevent vulnerabilities.

## Core Principles

1. **Privacy First**: Never expose user data unnecessarily
2. **Least Privilege**: Users should only access their own data
3. **Input Validation**: Validate all user inputs
4. **No Secrets in Code**: Never commit secrets, API keys, or passwords

## API Security Requirements

### DO ✅

- **Validate all inputs**: Check types, lengths, and formats
- **Use parameterized queries**: Prevent SQL injection
- **Rate limiting**: Consider implementing rate limits for public endpoints
- **Minimal data exposure**: Only return data the user needs
- **Error handling**: Don't leak sensitive info in error messages
- **HTTPS only**: All external communication must use TLS

### DON'T ❌

- **User enumeration endpoints**: No `/api/users` or `/api/users/:email` that anyone can call
- **List all users**: Never create endpoints that list all user emails
- **Expose internal IDs**: Use email or UUIDs, not sequential IDs
- **Trust client data**: Always validate on the server
- **Hardcode secrets**: Use environment variables and Kubernetes secrets
- **Log sensitive data**: Don't log passwords, tokens, or PII

## Common Vulnerabilities to Avoid

### 1. User Enumeration

**Bad:**
```javascript
// Allows attackers to discover which emails are registered
app.get('/api/users/:email', (req, res) => {
  const user = await db.findUser(req.params.email);
  if (!user) return res.status(404).json({ error: 'User not found' });
  res.json(user);
});
```

**Good:**
```javascript
// Users can only access their own data
app.get('/api/users/me', (req, res) => {
  const email = req.headers['x-auth-request-user'];
  const user = await db.findUser(email);
  res.json(user);
});
```

### 2. SQL Injection

**Bad:**
```javascript
// NEVER do this!
const query = `SELECT * FROM users WHERE email = '${email}'`;
```

**Good:**
```javascript
// Always use parameterized queries
const query = 'SELECT * FROM users WHERE email = $1';
const result = await pool.query(query, [email]);
```

### 3. Mass Assignment

**Bad:**
```javascript
// User could set isAdmin: true
await db.update('users', req.body);
```

**Good:**
```javascript
// Explicitly allow only specific fields
const { display_name, avatar_url } = req.body;
await db.update('users', { display_name, avatar_url });
```

### 4. Information Disclosure in Errors

**Bad:**
```javascript
// Exposes database structure
res.status(500).json({ error: error.message });
```

**Good:**
```javascript
console.error('Database error:', error); // Log for debugging
res.status(500).json({ error: 'Internal server error' }); // Generic message
```

## Authentication & Authorization

All apps use **oauth2-proxy** for authentication. The authenticated user's email is provided in headers:

```javascript
const email = req.headers['x-auth-request-user'];
```

### Important Notes:

- The `/health` endpoint is **excluded from auth** (used by Kubernetes health checks)
- All other endpoints require authentication
- Always check that `x-auth-request-user` exists before processing requests
- Never trust the client to send their own email - always use the header

## Database Security

### Connection Security

- Database connections use private IPs (no public access)
- Credentials stored in Kubernetes secrets
- Connection strings in environment variables

### Query Best Practices

```javascript
// ✅ Good: Parameterized query
await pool.query('SELECT * FROM users WHERE email = $1', [email]);

// ❌ Bad: String concatenation (SQL injection risk)
await pool.query(`SELECT * FROM users WHERE email = '${email}'`);

// ✅ Good: Validate input before queries
if (typeof email !== 'string' || email.length > 255) {
  return res.status(400).json({ error: 'Invalid email' });
}
```

## Secrets Management

### Kubernetes Secrets

Store sensitive data in Kubernetes secrets:

```yaml
apiVersion: v1
kind: Secret
metadata:
  name: my-app-secrets
type: Opaque
stringData:
  api_key: "your-secret-key"
  database_url: "postgresql://..."
```

Reference in deployment:
```yaml
env:
  - name: API_KEY
    valueFrom:
      secretKeyRef:
        name: my-app-secrets
        key: api_key
```

### What NOT to Commit

Never commit these to git:
- API keys or tokens
- Database passwords
- OAuth client secrets
- Private keys
- `.env` files with secrets
- `credentials.json` files

Use `.gitignore`:
```
.env
.env.local
*.key
*.pem
credentials.json
secrets/
```

## Input Validation

Always validate user inputs:

```javascript
// Validate types
if (typeof display_name !== 'string') {
  return res.status(400).json({ error: 'display_name must be a string' });
}

// Validate length
if (display_name.length > 255) {
  return res.status(400).json({ error: 'display_name too long' });
}

// Validate format (email example)
const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
if (!emailRegex.test(email)) {
  return res.status(400).json({ error: 'Invalid email format' });
}

// Limit payload size
if (JSON.stringify(req.body).length > 10000) {
  return res.status(400).json({ error: 'Payload too large' });
}
```

## Rate Limiting

Consider adding rate limiting for public-facing endpoints:

```javascript
const rateLimit = require('express-rate-limit');

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100 // limit each IP to 100 requests per windowMs
});

app.use('/api/', limiter);
```

## Example: Secure User Service

The `user-service` app demonstrates secure patterns:

- ✅ Users can only access `/api/users/me` (their own data)
- ✅ No user listing or enumeration endpoints
- ✅ Input validation on all fields
- ✅ Metadata size limits (10KB max)
- ✅ Parameterized SQL queries
- ✅ Generic error messages
- ✅ Database credentials in Kubernetes secret

See `apps/user-service/src/index.js` for reference implementation.

## Security Checklist for New Apps

Before deploying a new app, verify:

- [ ] All database queries use parameterized queries (no string concatenation)
- [ ] Input validation on all user-provided data
- [ ] No endpoints that list all users or allow user enumeration
- [ ] Users can only access their own data
- [ ] Secrets stored in Kubernetes secrets (not in code)
- [ ] Error messages don't expose sensitive information
- [ ] `/health` endpoint is the only unauthenticated endpoint
- [ ] No hardcoded API keys or credentials
- [ ] `.gitignore` excludes secret files
- [ ] Consider rate limiting for public endpoints

## Reporting Security Issues

If you discover a security vulnerability:

1. **Do NOT create a public GitHub issue**
2. Contact the repository owner privately
3. Provide details of the vulnerability
4. Allow time for a fix before public disclosure

## Resources

- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [Node.js Security Best Practices](https://nodejs.org/en/docs/guides/security/)
- [PostgreSQL Security](https://www.postgresql.org/docs/current/security.html)

## Updates

This document should be updated as new security requirements emerge. When adding a new app, review and follow these guidelines.
