const express = require('express');
const { Pool } = require('pg');
const { exec } = require('child_process');
const { promisify } = require('util');
const path = require('path');

const execAsync = promisify(exec);
const app = express();
const PORT = process.env.PORT || 3000;

// Database connection pool
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

// Middleware
app.use(express.json());

// Serve static files from public directory
app.use(express.static(path.join(__dirname, 'public')));

// Logging middleware
app.use((req, res, next) => {
  console.log(`${req.method} ${req.path}`);
  next();
});

// Run migrations on startup
async function runMigrations() {
  console.log('Running database migrations...');
  try {
    const { stdout, stderr } = await execAsync('npm run migrate:up');
    console.log('Migration output:', stdout);
    if (stderr) console.error('Migration stderr:', stderr);
    console.log('Migrations completed successfully');
  } catch (error) {
    console.error('Migration failed:', error.message);
    throw error;
  }
}

// Health check endpoint (no auth required)
app.get('/health', async (req, res) => {
  try {
    // Check database connectivity
    await pool.query('SELECT 1');
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  } catch (error) {
    console.error('Health check failed:', error);
    res.status(503).json({ status: 'error', error: 'Database unavailable' });
  }
});

// Debug endpoint - shows all auth headers
app.get('/api/debug/headers', (req, res) => {
  const authHeaders = {};
  Object.keys(req.headers).forEach(key => {
    if (key.toLowerCase().includes('auth') || key.toLowerCase().includes('user')) {
      authHeaders[key] = req.headers[key];
    }
  });
  res.json({
    authHeaders,
    allHeaders: req.headers
  });
});

// Get current user (auto-creates if doesn't exist)
app.get('/api/users/me', async (req, res) => {
  try {
    const email = req.headers['x-auth-request-user'];

    if (!email) {
      return res.status(401).json({ error: 'No authenticated user' });
    }

    // Upsert: create user if doesn't exist, return existing user otherwise
    const result = await pool.query(
      `INSERT INTO users (email, display_name)
       VALUES ($1, $1)
       ON CONFLICT (email) DO UPDATE SET email = EXCLUDED.email
       RETURNING *`,
      [email]
    );

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error getting user:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Update current user profile
app.put('/api/users/me', async (req, res) => {
  try {
    const email = req.headers['x-auth-request-user'];

    if (!email) {
      return res.status(401).json({ error: 'No authenticated user' });
    }

    const { display_name, avatar_url, metadata } = req.body;

    // Input validation
    if (display_name !== undefined && typeof display_name !== 'string') {
      return res.status(400).json({ error: 'display_name must be a string' });
    }

    if (avatar_url !== undefined && typeof avatar_url !== 'string') {
      return res.status(400).json({ error: 'avatar_url must be a string' });
    }

    if (metadata !== undefined) {
      if (typeof metadata !== 'object' || Array.isArray(metadata)) {
        return res.status(400).json({ error: 'metadata must be an object' });
      }
      // Limit metadata size to prevent DoS
      const metadataStr = JSON.stringify(metadata);
      if (metadataStr.length > 10000) {
        return res.status(400).json({ error: 'metadata too large (max 10KB)' });
      }
    }

    // Build dynamic update query based on provided fields
    const updates = [];
    const values = [email];
    let paramIndex = 2;

    if (display_name !== undefined) {
      updates.push(`display_name = $${paramIndex++}`);
      values.push(display_name);
    }

    if (avatar_url !== undefined) {
      updates.push(`avatar_url = $${paramIndex++}`);
      values.push(avatar_url);
    }

    if (metadata !== undefined) {
      updates.push(`metadata = $${paramIndex++}`);
      values.push(JSON.stringify(metadata));
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }

    const query = `
      UPDATE users
      SET ${updates.join(', ')}
      WHERE email = $1
      RETURNING *
    `;

    const result = await pool.query(query, values);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error updating user:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// SECURITY NOTE: The following endpoints are intentionally NOT implemented:
//
// - GET /api/users (list all users) - Privacy violation, allows data scraping
// - GET /api/users/:email - Allows user enumeration attacks
//
// Users can ONLY access their own data via /api/users/me
// If you need to check if a user exists, use direct database access from your app
// with proper authorization checks.

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('SIGTERM signal received: closing HTTP server');
  await pool.end();
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('SIGINT signal received: closing HTTP server');
  await pool.end();
  process.exit(0);
});

// Start server
async function start() {
  try {
    // Run migrations first
    await runMigrations();

    // Then start the server
    app.listen(PORT, () => {
      console.log(`User service listening on port ${PORT}`);
      console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

start();
