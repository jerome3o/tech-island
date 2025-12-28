const express = require('express');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());

// Request logging
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} ${req.method} ${req.path}`);
  next();
});

// Health check - no auth required
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Get current user from oauth2-proxy headers
app.get('/api/me', (req, res) => {
  const email = req.headers['x-auth-request-user'] || 'unknown';
  const preferredUsername = req.headers['x-auth-request-preferred-username'] || email;

  res.json({
    email,
    username: preferredUsername,
    // Add more user info as needed
  });
});

// Example API endpoint
app.get('/api/hello', (req, res) => {
  const email = req.headers['x-auth-request-user'] || 'stranger';
  res.json({
    message: `Hello, ${email}!`,
    timestamp: new Date().toISOString(),
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Not found' });
});

// Error handler
app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

// Start server
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Health check: http://localhost:${PORT}/health`);
});
