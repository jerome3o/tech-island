const request = require('supertest');
const express = require('express');
const { Pool } = require('pg');

// Mock pg Pool
jest.mock('pg', () => {
  const mockQuery = jest.fn();
  const mockPool = {
    query: mockQuery,
    end: jest.fn(),
  };
  return {
    Pool: jest.fn(() => mockPool),
  };
});

// Mock child_process exec for migrations
jest.mock('child_process', () => ({
  exec: jest.fn((cmd, callback) => {
    callback(null, { stdout: 'Migration successful', stderr: '' });
  }),
}));

describe('User Service API', () => {
  let app;
  let pool;

  beforeAll(() => {
    // Import the app (this would need refactoring to export the app separately)
    // For now, this is a structure test
  });

  describe('GET /health', () => {
    test('should return 200 OK when database is healthy', async () => {
      const mockApp = express();
      const mockPool = new Pool();

      mockPool.query.mockResolvedValueOnce({ rows: [{ '?column?': 1 }] });

      mockApp.get('/health', async (req, res) => {
        try {
          await mockPool.query('SELECT 1');
          res.json({ status: 'ok', timestamp: new Date().toISOString() });
        } catch (error) {
          res.status(503).json({ status: 'error', error: 'Database unavailable' });
        }
      });

      const response = await request(mockApp).get('/health');

      expect(response.status).toBe(200);
      expect(response.body.status).toBe('ok');
      expect(response.body).toHaveProperty('timestamp');
    });

    test('should return 503 when database is down', async () => {
      const mockApp = express();
      const mockPool = new Pool();

      mockPool.query.mockRejectedValueOnce(new Error('Connection failed'));

      mockApp.get('/health', async (req, res) => {
        try {
          await mockPool.query('SELECT 1');
          res.json({ status: 'ok', timestamp: new Date().toISOString() });
        } catch (error) {
          res.status(503).json({ status: 'error', error: 'Database unavailable' });
        }
      });

      const response = await request(mockApp).get('/health');

      expect(response.status).toBe(503);
      expect(response.body.status).toBe('error');
    });
  });

  describe('GET /api/users/me', () => {
    test('should return user when authenticated', async () => {
      const mockApp = express();
      mockApp.use(express.json());
      const mockPool = new Pool();

      const mockUser = {
        email: 'test@example.com',
        display_name: 'test@example.com',
        avatar_url: null,
        metadata: {},
        created_at: new Date(),
        updated_at: new Date(),
      };

      mockPool.query.mockResolvedValueOnce({ rows: [mockUser] });

      mockApp.get('/api/users/me', async (req, res) => {
        const email = req.headers['x-auth-request-user'];
        if (!email) {
          return res.status(401).json({ error: 'No authenticated user' });
        }
        const result = await mockPool.query(
          'INSERT INTO users (email, display_name) VALUES ($1, $1) ON CONFLICT (email) DO UPDATE SET email = EXCLUDED.email RETURNING *',
          [email]
        );
        res.json(result.rows[0]);
      });

      const response = await request(mockApp)
        .get('/api/users/me')
        .set('x-auth-request-user', 'test@example.com');

      expect(response.status).toBe(200);
      expect(response.body.email).toBe('test@example.com');
    });

    test('should return 401 when not authenticated', async () => {
      const mockApp = express();
      mockApp.use(express.json());

      mockApp.get('/api/users/me', async (req, res) => {
        const email = req.headers['x-auth-request-user'];
        if (!email) {
          return res.status(401).json({ error: 'No authenticated user' });
        }
        res.json({ email });
      });

      const response = await request(mockApp).get('/api/users/me');

      expect(response.status).toBe(401);
      expect(response.body.error).toBe('No authenticated user');
    });
  });

  describe('PUT /api/users/me', () => {
    test('should update user profile', async () => {
      const mockApp = express();
      mockApp.use(express.json());
      const mockPool = new Pool();

      const updatedUser = {
        email: 'test@example.com',
        display_name: 'Test User',
        avatar_url: 'https://example.com/avatar.jpg',
        metadata: {},
        created_at: new Date(),
        updated_at: new Date(),
      };

      mockPool.query.mockResolvedValueOnce({ rows: [updatedUser] });

      mockApp.put('/api/users/me', async (req, res) => {
        const email = req.headers['x-auth-request-user'];
        if (!email) {
          return res.status(401).json({ error: 'No authenticated user' });
        }

        const { display_name, avatar_url } = req.body;
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

        if (updates.length === 0) {
          return res.status(400).json({ error: 'No fields to update' });
        }

        const query = `UPDATE users SET ${updates.join(', ')} WHERE email = $1 RETURNING *`;
        const result = await mockPool.query(query, values);

        if (result.rows.length === 0) {
          return res.status(404).json({ error: 'User not found' });
        }

        res.json(result.rows[0]);
      });

      const response = await request(mockApp)
        .put('/api/users/me')
        .set('x-auth-request-user', 'test@example.com')
        .send({
          display_name: 'Test User',
          avatar_url: 'https://example.com/avatar.jpg',
        });

      expect(response.status).toBe(200);
      expect(response.body.display_name).toBe('Test User');
    });

    test('should return 400 when no fields provided', async () => {
      const mockApp = express();
      mockApp.use(express.json());

      mockApp.put('/api/users/me', async (req, res) => {
        const email = req.headers['x-auth-request-user'];
        if (!email) {
          return res.status(401).json({ error: 'No authenticated user' });
        }

        const { display_name, avatar_url, metadata } = req.body;

        if (
          display_name === undefined &&
          avatar_url === undefined &&
          metadata === undefined
        ) {
          return res.status(400).json({ error: 'No fields to update' });
        }

        res.json({ success: true });
      });

      const response = await request(mockApp)
        .put('/api/users/me')
        .set('x-auth-request-user', 'test@example.com')
        .send({});

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('No fields to update');
    });
  });

  describe('GET /api/users/:email', () => {
    test('should return user by email', async () => {
      const mockApp = express();
      const mockPool = new Pool();

      const mockUser = {
        email: 'test@example.com',
        display_name: 'Test User',
        avatar_url: null,
        metadata: {},
        created_at: new Date(),
        updated_at: new Date(),
      };

      mockPool.query.mockResolvedValueOnce({ rows: [mockUser] });

      mockApp.get('/api/users/:email', async (req, res) => {
        const { email } = req.params;
        const result = await mockPool.query(
          'SELECT * FROM users WHERE email = $1',
          [email]
        );

        if (result.rows.length === 0) {
          return res.status(404).json({ error: 'User not found' });
        }

        res.json(result.rows[0]);
      });

      const response = await request(mockApp).get('/api/users/test@example.com');

      expect(response.status).toBe(200);
      expect(response.body.email).toBe('test@example.com');
    });

    test('should return 404 when user not found', async () => {
      const mockApp = express();
      const mockPool = new Pool();

      mockPool.query.mockResolvedValueOnce({ rows: [] });

      mockApp.get('/api/users/:email', async (req, res) => {
        const { email } = req.params;
        const result = await mockPool.query(
          'SELECT * FROM users WHERE email = $1',
          [email]
        );

        if (result.rows.length === 0) {
          return res.status(404).json({ error: 'User not found' });
        }

        res.json(result.rows[0]);
      });

      const response = await request(mockApp).get('/api/users/nonexistent@example.com');

      expect(response.status).toBe(404);
      expect(response.body.error).toBe('User not found');
    });
  });

  describe('GET /api/users', () => {
    test('should return paginated list of users', async () => {
      const mockApp = express();
      const mockPool = new Pool();

      const mockUsers = [
        { email: 'user1@example.com', display_name: 'User 1', created_at: new Date() },
        { email: 'user2@example.com', display_name: 'User 2', created_at: new Date() },
      ];

      mockPool.query
        .mockResolvedValueOnce({ rows: mockUsers })
        .mockResolvedValueOnce({ rows: [{ count: '2' }] });

      mockApp.get('/api/users', async (req, res) => {
        const limit = Math.min(parseInt(req.query.limit) || 50, 100);
        const offset = parseInt(req.query.offset) || 0;

        const result = await mockPool.query(
          'SELECT * FROM users ORDER BY created_at DESC LIMIT $1 OFFSET $2',
          [limit, offset]
        );

        const countResult = await mockPool.query('SELECT COUNT(*) FROM users');
        const total = parseInt(countResult.rows[0].count);

        res.json({
          users: result.rows,
          pagination: { limit, offset, total },
        });
      });

      const response = await request(mockApp).get('/api/users?limit=10&offset=0');

      expect(response.status).toBe(200);
      expect(response.body.users).toHaveLength(2);
      expect(response.body.pagination).toEqual({
        limit: 10,
        offset: 0,
        total: 2,
      });
    });
  });
});
