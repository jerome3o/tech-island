const express = require('express');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());

// Logging
app.use((req, res, next) => {
  const user = req.headers['x-auth-request-user'] || 'anonymous';
  console.log(`${new Date().toISOString()} [${user}] ${req.method} ${req.path}`);
  next();
});

// Health check - no auth required, used by k8s probes
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
});

// Home page - shows welcome message
app.get('/', (req, res) => {
  const email = req.headers['x-auth-request-user'] || 'Guest';
  const username = req.headers['x-auth-request-preferred-username'] || email.split('@')[0];

  res.send(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>Hello World - Tech Island</title>
      <style>
        body {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          max-width: 600px;
          margin: 50px auto;
          padding: 20px;
          background: #f5f5f5;
        }
        .card {
          background: white;
          border-radius: 8px;
          padding: 30px;
          box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }
        h1 { color: #333; margin-bottom: 10px; }
        .user { color: #0066cc; font-weight: bold; }
        .time { color: #666; font-size: 14px; }
        .links { margin-top: 20px; }
        .links a {
          display: inline-block;
          margin-right: 15px;
          color: #0066cc;
        }
        .footer {
          margin-top: 30px;
          padding-top: 20px;
          border-top: 1px solid #eee;
          font-size: 12px;
          color: #999;
        }
      </style>
    </head>
    <body>
      <div class="card">
        <h1>Hello, <span class="user">${username}</span>!</h1>
        <p>Welcome to Tech Island. You're logged in as: <strong>${email}</strong></p>
        <p class="time">Server time: ${new Date().toISOString()}</p>

        <div class="links">
          <h3>API Endpoints:</h3>
          <a href="/api/me">/api/me</a>
          <a href="/api/time">/api/time</a>
          <a href="/health">/health</a>
        </div>

        <div class="footer">
          This is an example app deployed on the Tech Island platform.
          <br>Authentication is handled by OAuth2-Proxy with Google.
        </div>
      </div>
    </body>
    </html>
  `);
});

// API: Current user info
app.get('/api/me', (req, res) => {
  const email = req.headers['x-auth-request-user'] || null;
  const username = req.headers['x-auth-request-preferred-username'] || null;
  const groups = req.headers['x-auth-request-groups'] || null;

  res.json({
    email,
    username,
    groups: groups ? groups.split(',') : [],
    authenticated: !!email,
  });
});

// API: Current time
app.get('/api/time', (req, res) => {
  const now = new Date();
  res.json({
    iso: now.toISOString(),
    unix: Math.floor(now.getTime() / 1000),
    formatted: now.toUTCString(),
    timezone: 'UTC',
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    error: 'Not found',
    path: req.path,
  });
});

// Error handler
app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(500).json({
    error: 'Internal server error',
  });
});

// Start server
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Hello World app running on port ${PORT}`);
  console.log(`Health check: http://localhost:${PORT}/health`);
});
