# App: user-service

> Shared user database and API for all tech-island applications

## Overview

The user-service provides a centralized user database and REST API that all applications in the tech-island platform can use to store and retrieve user information. It automatically creates user records on first access and provides flexible metadata storage.

**Key Features:**
- Centralized user database with automatic migrations
- Auto-creates user records on first access
- RESTful API for user CRUD operations
- Flexible JSONB metadata field for app-specific data
- Automatic timestamp tracking (created_at, updated_at)
- Pagination support for user listings

## Tech Stack

- **Runtime**: Node.js 20
- **Framework**: Express.js
- **Database**: PostgreSQL (shared Cloud SQL instance)
- **Migrations**: node-pg-migrate
- **Testing**: Jest + Supertest
- **Auth**: Handled by platform (oauth2-proxy) - user email available in headers

## Database Schema

```sql
CREATE TABLE users (
  email VARCHAR(255) PRIMARY KEY,
  display_name VARCHAR(255),
  avatar_url TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

The `metadata` field is a flexible JSONB column that apps can use to store custom user data.

## API Endpoints

| Method | Path | Description | Auth |
|--------|------|-------------|------|
| GET | /health | Health check with DB connectivity | No |
| GET | /api/users/me | Get current user (auto-creates if new) | Yes |
| PUT | /api/users/me | Update current user profile | Yes |
| GET | /api/users/:email | Get user by email | Yes |
| GET | /api/users | List all users (paginated) | Yes |

### Example Requests

**Get current user:**
```bash
curl https://user-service.34.142.82.161.nip.io/api/users/me
```

**Update current user:**
```bash
curl -X PUT https://user-service.34.142.82.161.nip.io/api/users/me \
  -H "Content-Type: application/json" \
  -d '{
    "display_name": "John Doe",
    "avatar_url": "https://example.com/avatar.jpg",
    "metadata": {"theme": "dark", "notifications": true}
  }'
```

**Get user by email:**
```bash
curl https://user-service.34.142.82.161.nip.io/api/users/user@example.com
```

**List users (paginated):**
```bash
curl https://user-service.34.142.82.161.nip.io/api/users?limit=50&offset=0
```

## Using from Other Apps

### HTTP API Client

Apps can call the user-service API directly:

```javascript
// Get current user info
async function getCurrentUser(userEmail) {
  const response = await fetch('http://user-service.apps.svc.cluster.local/api/users/me', {
    headers: {
      'x-auth-request-user': userEmail
    }
  });
  return response.json();
}

// Get any user by email
async function getUserByEmail(email) {
  const response = await fetch(
    `http://user-service.apps.svc.cluster.local/api/users/${encodeURIComponent(email)}`
  );
  if (!response.ok) {
    throw new Error('User not found');
  }
  return response.json();
}

// Update current user
async function updateUser(userEmail, updates) {
  const response = await fetch('http://user-service.apps.svc.cluster.local/api/users/me', {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      'x-auth-request-user': userEmail
    },
    body: JSON.stringify(updates)
  });
  return response.json();
}
```

**Note**: Use `http://user-service.apps.svc.cluster.local` for internal cluster communication (faster, no TLS overhead).

### Direct Database Access (Advanced)

Apps can also connect directly to the same Cloud SQL database and query the `users` table:

```javascript
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

// Query users directly
const result = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
```

## Database Migrations

Migrations run automatically on startup using node-pg-migrate.

### Creating New Migrations

```bash
cd apps/user-service
npm run migrate create add-new-field
```

This creates a new migration file in `migrations/`. Edit it:

```javascript
exports.up = (pgm) => {
  pgm.addColumn('users', {
    new_field: { type: 'varchar(255)' }
  });
};

exports.down = (pgm) => {
  pgm.dropColumn('users', 'new_field');
};
```

Migrations run automatically on next deployment.

### Manual Migration Commands

```bash
# Run pending migrations
npm run migrate:up

# Rollback last migration
npm run migrate:down
```

## Local Development

### Prerequisites

You need a PostgreSQL database. Use Docker:

```bash
docker run --name postgres \
  -e POSTGRES_PASSWORD=password \
  -e POSTGRES_DB=techisland \
  -p 5432:5432 \
  -d postgres:15
```

### Running Locally

```bash
cd apps/user-service

# Install dependencies
npm install

# Set database URL
export DATABASE_URL="postgresql://postgres:password@localhost:5432/techisland"

# Run migrations and start server
npm start

# Or for development with auto-reload
npm run dev
```

### Running Tests

```bash
npm test
```

## Deployment

### One-Time Setup: Create Database Secret

Before deploying for the first time, create the database credentials secret:

1. Get credentials from Terraform:
   ```bash
   cd infrastructure/terraform
   terraform output database_private_ip
   terraform output database_name
   terraform output database_user
   terraform output database_password
   ```

2. Create the secret:
   ```bash
   kubectl create secret generic cloudsql-db-credentials \
     --from-literal=url="postgresql://USER:PASSWORD@IP:5432/DATABASE" \
     --namespace apps
   ```

See `k8s/secret-template.yaml` for detailed instructions.

### Deploying the App

Push to main to deploy automatically:

```bash
git add apps/user-service
git commit -m "Add user-service: shared user database"
git push origin main
```

GitHub Actions will:
1. Build the Docker image
2. Push to Artifact Registry
3. Deploy to GKE (migrations run automatically on startup)
4. Provision TLS certificate

The service will be available at: `https://user-service.34.142.82.161.nip.io`

## Environment Variables

| Variable | Description | Default | Required |
|----------|-------------|---------|----------|
| PORT | HTTP server port | 3000 | No |
| DATABASE_URL | PostgreSQL connection string | - | Yes |
| NODE_ENV | Environment (production/development) | production | No |

## File Structure

```
apps/user-service/
├── CLAUDE.md                     # This file
├── Dockerfile                    # Container build
├── package.json                  # Dependencies
├── package-lock.json             # Locked dependencies
├── jest.config.js                # Jest configuration
├── .pgmigrate.json               # Migration config
├── migrations/                   # Database migrations
│   └── 1_create-users-table.js
├── src/
│   └── index.js                  # Express app + API
├── tests/
│   └── api.test.js               # API tests
└── k8s/                          # Kubernetes manifests
    ├── deployment.yaml           # App deployment
    ├── service.yaml              # ClusterIP service
    ├── ingress.yaml              # Main ingress (with auth)
    ├── ingress-oauth2.yaml       # OAuth2 paths (no auth)
    ├── oauth2-proxy-service.yaml # OAuth2 proxy reference
    └── secret-template.yaml      # DB secret instructions
```

## How Apps Should Use This Service

### Pattern 1: Auto-Create User on Login

When a user logs into your app, automatically ensure they exist in the user database:

```javascript
app.get('/api/dashboard', async (req, res) => {
  const email = req.headers['x-auth-request-user'];

  // This creates the user if they don't exist
  const user = await fetch('http://user-service.apps.svc.cluster.local/api/users/me', {
    headers: { 'x-auth-request-user': email }
  }).then(r => r.json());

  // Now you have the user data
  res.render('dashboard', { user });
});
```

### Pattern 2: Store App-Specific Data in Metadata

Use the `metadata` field to store app-specific user preferences:

```javascript
// Get user with app preferences
const user = await getUserByEmail(email);
const appPrefs = user.metadata.myapp || {};

// Update app preferences
await updateUser(email, {
  metadata: {
    ...user.metadata,
    myapp: {
      theme: 'dark',
      language: 'en',
      notifications: true
    }
  }
});
```

### Pattern 3: Cross-App User Lookup

Look up users created by other apps:

```javascript
// Check if a user exists across all apps
const user = await fetch(
  `http://user-service.apps.svc.cluster.local/api/users/${email}`
).then(r => r.json());
```

## Monitoring and Debugging

### Check Migration Status

View migration logs in GitHub Actions or check the pod logs:

```bash
kubectl logs -n apps -l app=user-service --tail=100
```

### Test Database Connectivity

```bash
curl https://user-service.34.142.82.161.nip.io/health
```

Should return:
```json
{"status": "ok", "timestamp": "2024-01-01T00:00:00.000Z"}
```

## Known Issues

- Migrations run on every pod startup - this is safe but logs migration "already applied" messages
- No user deletion endpoint (intentional - preserve user data)
- No admin API for bulk operations (add if needed)

## Future Enhancements

Potential features to add:
- User roles/permissions table
- User activity logging
- Soft delete support
- Bulk user import/export
- User search endpoint
- WebSocket support for real-time updates

## Related Apps

- `hello-world` - Example app showing basic platform usage
- All future apps should use this service for user data

## Support

For issues or questions:
1. Check pod logs: `kubectl logs -n apps -l app=user-service`
2. Verify secret exists: `kubectl get secret cloudsql-db-credentials -n apps`
3. Test database: Access Cloud SQL via Cloud Console SQL Shell
4. Review GitHub Actions logs for deployment issues
