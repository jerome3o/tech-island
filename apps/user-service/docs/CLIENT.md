# User Service Client Library

This document provides reusable code snippets for integrating with the user-service from your tech-island apps.

## Quick Start

Copy the appropriate client code below into your app and start using the shared user database!

## Node.js / Express Client

### Basic Client (Fetch API)

```javascript
// user-service-client.js
const USER_SERVICE_URL = process.env.USER_SERVICE_URL || 'http://user-service.apps.svc.cluster.local';

class UserServiceClient {
  constructor(baseUrl = USER_SERVICE_URL) {
    this.baseUrl = baseUrl;
  }

  /**
   * Get the current authenticated user (creates if doesn't exist)
   * @param {string} email - User email from X-Auth-Request-User header
   * @returns {Promise<Object>} User object
   */
  async getCurrentUser(email) {
    const response = await fetch(`${this.baseUrl}/api/users/me`, {
      headers: { 'x-auth-request-user': email }
    });

    if (!response.ok) {
      throw new Error(`Failed to get user: ${response.statusText}`);
    }

    return response.json();
  }

  /**
   * Get user by email
   * @param {string} email - User email to lookup
   * @returns {Promise<Object>} User object
   */
  async getUserByEmail(email) {
    const response = await fetch(
      `${this.baseUrl}/api/users/${encodeURIComponent(email)}`
    );

    if (!response.ok) {
      if (response.status === 404) {
        return null;
      }
      throw new Error(`Failed to get user: ${response.statusText}`);
    }

    return response.json();
  }

  /**
   * Update current user profile
   * @param {string} email - User email from X-Auth-Request-User header
   * @param {Object} updates - Fields to update (display_name, avatar_url, metadata)
   * @returns {Promise<Object>} Updated user object
   */
  async updateUser(email, updates) {
    const response = await fetch(`${this.baseUrl}/api/users/me`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'x-auth-request-user': email
      },
      body: JSON.stringify(updates)
    });

    if (!response.ok) {
      throw new Error(`Failed to update user: ${response.statusText}`);
    }

    return response.json();
  }

  /**
   * List all users (paginated)
   * @param {Object} options - Pagination options
   * @param {number} options.limit - Max users per page (default: 50, max: 100)
   * @param {number} options.offset - Number of users to skip
   * @returns {Promise<Object>} Object with users array and pagination info
   */
  async listUsers({ limit = 50, offset = 0 } = {}) {
    const params = new URLSearchParams({ limit, offset });
    const response = await fetch(`${this.baseUrl}/api/users?${params}`);

    if (!response.ok) {
      throw new Error(`Failed to list users: ${response.statusText}`);
    }

    return response.json();
  }
}

module.exports = UserServiceClient;
```

### Usage Example

```javascript
const express = require('express');
const UserServiceClient = require('./user-service-client');

const app = express();
const userService = new UserServiceClient();

// Middleware to ensure user exists
app.use(async (req, res, next) => {
  const email = req.headers['x-auth-request-user'];
  if (email) {
    try {
      // Auto-create user on every request
      req.user = await userService.getCurrentUser(email);
    } catch (error) {
      console.error('Failed to get user:', error);
    }
  }
  next();
});

// Example: Get user profile
app.get('/profile', async (req, res) => {
  res.json(req.user);
});

// Example: Update user profile
app.post('/profile', async (req, res) => {
  const email = req.headers['x-auth-request-user'];
  const { display_name, avatar_url } = req.body;

  const updatedUser = await userService.updateUser(email, {
    display_name,
    avatar_url
  });

  res.json(updatedUser);
});

// Example: Update app-specific metadata
app.post('/settings', async (req, res) => {
  const email = req.headers['x-auth-request-user'];
  const user = await userService.getCurrentUser(email);

  // Merge app settings into metadata
  const updatedUser = await userService.updateUser(email, {
    metadata: {
      ...user.metadata,
      myapp: {
        theme: req.body.theme,
        notifications: req.body.notifications
      }
    }
  });

  res.json(updatedUser);
});
```

## Python / FastAPI Client

```python
# user_service_client.py
import os
import httpx
from typing import Optional, Dict, Any, List
from urllib.parse import quote

USER_SERVICE_URL = os.getenv('USER_SERVICE_URL', 'http://user-service.apps.svc.cluster.local')

class UserServiceClient:
    def __init__(self, base_url: str = USER_SERVICE_URL):
        self.base_url = base_url
        self.client = httpx.AsyncClient()

    async def get_current_user(self, email: str) -> Dict[str, Any]:
        """Get the current authenticated user (creates if doesn't exist)"""
        response = await self.client.get(
            f"{self.base_url}/api/users/me",
            headers={"x-auth-request-user": email}
        )
        response.raise_for_status()
        return response.json()

    async def get_user_by_email(self, email: str) -> Optional[Dict[str, Any]]:
        """Get user by email"""
        response = await self.client.get(
            f"{self.base_url}/api/users/{quote(email)}"
        )

        if response.status_code == 404:
            return None

        response.raise_for_status()
        return response.json()

    async def update_user(self, email: str, updates: Dict[str, Any]) -> Dict[str, Any]:
        """Update current user profile"""
        response = await self.client.put(
            f"{self.base_url}/api/users/me",
            headers={
                "x-auth-request-user": email,
                "Content-Type": "application/json"
            },
            json=updates
        )
        response.raise_for_status()
        return response.json()

    async def list_users(self, limit: int = 50, offset: int = 0) -> Dict[str, Any]:
        """List all users (paginated)"""
        response = await self.client.get(
            f"{self.base_url}/api/users",
            params={"limit": limit, "offset": offset}
        )
        response.raise_for_status()
        return response.json()

    async def close(self):
        """Close the HTTP client"""
        await self.client.aclose()
```

### FastAPI Usage Example

```python
from fastapi import FastAPI, Header, Depends
from user_service_client import UserServiceClient

app = FastAPI()
user_service = UserServiceClient()

async def get_current_user(x_auth_request_user: str = Header(default=None)):
    """Dependency to get current user"""
    if not x_auth_request_user:
        return None
    return await user_service.get_current_user(x_auth_request_user)

@app.get("/profile")
async def get_profile(user = Depends(get_current_user)):
    return user

@app.put("/profile")
async def update_profile(
    updates: dict,
    x_auth_request_user: str = Header(),
):
    return await user_service.update_user(x_auth_request_user, updates)

@app.on_event("shutdown")
async def shutdown():
    await user_service.close()
```

## Direct Database Access

For high-performance apps, you can query the `users` table directly:

### Node.js (pg)

```javascript
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

// Get user
const result = await pool.query(
  'SELECT * FROM users WHERE email = $1',
  ['user@example.com']
);
const user = result.rows[0];

// Update user
await pool.query(
  'UPDATE users SET display_name = $1, metadata = $2 WHERE email = $3',
  ['New Name', JSON.stringify({ theme: 'dark' }), 'user@example.com']
);
```

### Python (asyncpg)

```python
import asyncpg
import os
import json

# Create connection pool
pool = await asyncpg.create_pool(os.getenv('DATABASE_URL'))

# Get user
user = await pool.fetchrow('SELECT * FROM users WHERE email = $1', email)

# Update user
await pool.execute(
    'UPDATE users SET display_name = $1, metadata = $2 WHERE email = $3',
    'New Name',
    json.dumps({'theme': 'dark'}),
    email
)
```

## Best Practices

### 1. Auto-Create Users on First Access

Always call `getCurrentUser()` on user's first request - it will create the user if they don't exist:

```javascript
app.use(async (req, res, next) => {
  const email = req.headers['x-auth-request-user'];
  if (email) {
    req.user = await userService.getCurrentUser(email);
  }
  next();
});
```

### 2. Use Metadata for App-Specific Data

Store app preferences in the metadata field:

```javascript
// Good: Namespaced metadata
{
  "metadata": {
    "todo-app": {
      "default_list": "work",
      "theme": "dark"
    },
    "calendar-app": {
      "default_view": "week"
    }
  }
}
```

### 3. Use Internal Service URL

For cluster-internal communication, use the service DNS name:
```
http://user-service.apps.svc.cluster.local
```

This is faster and doesn't require TLS.

### 4. Handle Errors Gracefully

```javascript
try {
  const user = await userService.getCurrentUser(email);
} catch (error) {
  console.error('User service unavailable:', error);
  // Fallback: use email as display name
  req.user = { email, display_name: email };
}
```

### 5. Cache User Data (Optional)

For high-traffic apps, consider caching user data:

```javascript
const NodeCache = require('node-cache');
const userCache = new NodeCache({ stdTTL: 300 }); // 5 min cache

async function getCachedUser(email) {
  let user = userCache.get(email);
  if (!user) {
    user = await userService.getCurrentUser(email);
    userCache.set(email, user);
  }
  return user;
}
```

## Environment Variables

Set these in your app's deployment:

```yaml
env:
  - name: USER_SERVICE_URL
    value: "http://user-service.apps.svc.cluster.local"
```

For local development:
```bash
export USER_SERVICE_URL="http://localhost:3000"  # If running user-service locally
# or
export USER_SERVICE_URL="https://user-service.34.142.82.161.nip.io"  # Production
```

## Testing

Mock the user service in tests:

```javascript
// test-helpers.js
class MockUserServiceClient {
  async getCurrentUser(email) {
    return {
      email,
      display_name: email,
      avatar_url: null,
      metadata: {},
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
  }

  async updateUser(email, updates) {
    return {
      email,
      ...updates,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
  }
}

module.exports = { MockUserServiceClient };
```

## Troubleshooting

### Connection Refused

If you get connection errors:
1. Verify user-service is running: `kubectl get pods -n apps -l app=user-service`
2. Check service exists: `kubectl get svc user-service -n apps`
3. Test from another pod: `kubectl run -it --rm debug --image=curlimages/curl --restart=Never -- curl http://user-service.apps.svc.cluster.local/health`

### 401 Unauthorized

Make sure you're passing the email header:
```javascript
headers: { 'x-auth-request-user': email }
```

### Database Connection Issues

Check that the `cloudsql-db-credentials` secret exists:
```bash
kubectl get secret cloudsql-db-credentials -n apps
```
