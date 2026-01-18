/**
 * HTTP Integration Tests for Queue Manager.
 *
 * Tests HTTP endpoints with actual request/response flow.
 */

const request = require('supertest');
const { createTestApp, resetState } = require('../setup/app');
const state = require('../../services/state');

describe('HTTP Integration Tests', () => {
  let app;
  let mockRedis;

  beforeEach(() => {
    resetState();

    // Create mock Redis client
    mockRedis = {
      get: jest.fn().mockResolvedValue(null),
      set: jest.fn().mockResolvedValue('OK'),
      del: jest.fn().mockResolvedValue(1),
      ttl: jest.fn().mockResolvedValue(3600),
      lpush: jest.fn().mockResolvedValue(1),
      expire: jest.fn().mockResolvedValue(1)
    };

    app = createTestApp(mockRedis);
  });

  describe('GET /api/health', () => {
    it('should return OK status', async () => {
      const response = await request(app)
        .get('/api/health')
        .expect('Content-Type', /json/)
        .expect(200);

      expect(response.body).toHaveProperty('status', 'ok');
      expect(response.body).toHaveProperty('timestamp');
    });

    it('should return valid ISO timestamp', async () => {
      const response = await request(app)
        .get('/api/health')
        .expect(200);

      const timestamp = new Date(response.body.timestamp);
      expect(timestamp.toISOString()).toBe(response.body.timestamp);
    });
  });

  describe('GET /api/status', () => {
    it('should return queue status when empty', async () => {
      const response = await request(app)
        .get('/api/status')
        .expect('Content-Type', /json/)
        .expect(200);

      expect(response.body).toHaveProperty('queue_size', 0);
      expect(response.body).toHaveProperty('session_active', false);
      expect(response.body).toHaveProperty('estimated_wait', '0 minutes');
      expect(response.body).toHaveProperty('max_queue_size');
    });

    it('should reflect queue size', async () => {
      state.queue.push('client-1', 'client-2', 'client-3');

      const response = await request(app)
        .get('/api/status')
        .expect(200);

      expect(response.body.queue_size).toBe(3);
    });

    it('should show active session', async () => {
      state.setActiveSession({
        sessionId: 'test-session-123',
        clientId: 'test-client-456',
        startedAt: new Date()
      });

      const response = await request(app)
        .get('/api/status')
        .expect(200);

      expect(response.body.session_active).toBe(true);
    });

    it('should calculate estimated wait time', async () => {
      // Add clients to queue
      state.queue.push('client-1', 'client-2');

      const response = await request(app)
        .get('/api/status')
        .expect(200);

      // 2 clients * 45 min average = 90 minutes
      expect(response.body.estimated_wait).toBe('90 minutes');
    });
  });

  describe('GET /api/session/validate', () => {
    it('should return 401 when no session cookie', async () => {
      const response = await request(app)
        .get('/api/session/validate')
        .expect(401);

      expect(response.text).toBe('No session cookie');
    });

    it('should return 401 for invalid session cookie', async () => {
      const response = await request(app)
        .get('/api/session/validate')
        .set('Cookie', 'demo_session=invalid-token')
        .expect(401);

      expect(response.text).toBe('Session not active');
    });

    it('should return 200 for valid active session', async () => {
      const sessionId = 'test-session-123';
      const sessionToken = 'valid-session-token';

      state.sessionTokens.set(sessionToken, sessionId);
      state.setActiveSession({
        sessionId: sessionId,
        clientId: 'test-client-456',
        startedAt: new Date()
      });

      const response = await request(app)
        .get('/api/session/validate')
        .set('Cookie', `demo_session=${sessionToken}`)
        .expect(200);

      expect(response.text).toBe('OK');
      expect(response.headers['x-grafana-user']).toBe(`demo-${sessionId.slice(0, 8)}`);
    });

    it('should return 200 for pending session token', async () => {
      const clientId = 'pending-client-123';
      const pendingToken = 'pending-session-token';

      state.pendingSessionTokens.set(pendingToken, { clientId: clientId });

      const response = await request(app)
        .get('/api/session/validate')
        .set('Cookie', `demo_session=${pendingToken}`)
        .expect(200);

      expect(response.text).toBe('OK');
      expect(response.headers['x-grafana-user']).toBe(`demo-${clientId.slice(0, 8)}`);
    });

    it('should clean up stale session token', async () => {
      const staleToken = 'stale-session-token';
      state.sessionTokens.set(staleToken, 'old-session-id');
      // No active session set

      await request(app)
        .get('/api/session/validate')
        .set('Cookie', `demo_session=${staleToken}`)
        .expect(401);

      // Token should be cleaned up
      expect(state.sessionTokens.has(staleToken)).toBe(false);
    });
  });

  describe('GET /api/invite/validate', () => {
    it('should return 401 when no token provided', async () => {
      const response = await request(app)
        .get('/api/invite/validate')
        .expect('Content-Type', /json/)
        .expect(401);

      expect(response.body).toHaveProperty('valid', false);
      expect(response.body).toHaveProperty('reason', 'missing');
      expect(response.body).toHaveProperty('message', 'Invite token required');
    });

    it('should accept token from header', async () => {
      // Token not found in Redis (get returns null)
      mockRedis.get.mockResolvedValue(null);

      const response = await request(app)
        .get('/api/invite/validate')
        .set('X-Invite-Token', 'test-token-123')
        .expect(401);

      expect(response.body).toHaveProperty('valid', false);
      expect(response.body.reason).toBe('not_found');
    });

    it('should accept token from query parameter', async () => {
      mockRedis.get.mockResolvedValue(null);

      const response = await request(app)
        .get('/api/invite/validate')
        .query({ token: 'query-token-456' })
        .expect(401);

      expect(response.body).toHaveProperty('valid', false);
    });

    it('should return 200 for valid unexpired unused token', async () => {
      const futureTime = new Date(Date.now() + 3600000).toISOString();

      // Invite stored as JSON
      mockRedis.get.mockResolvedValue(JSON.stringify({
        createdAt: new Date().toISOString(),
        expiresAt: futureTime,
        maxUses: 1,
        useCount: 0,
        status: 'active'
      }));

      const response = await request(app)
        .get('/api/invite/validate')
        .set('X-Invite-Token', 'valid-token')
        .expect(200);

      expect(response.body).toHaveProperty('valid', true);
    });

    it('should return 401 for expired token', async () => {
      const pastTime = new Date(Date.now() - 3600000).toISOString();

      mockRedis.get.mockResolvedValue(JSON.stringify({
        createdAt: new Date(Date.now() - 7200000).toISOString(),
        expiresAt: pastTime,
        maxUses: 1,
        useCount: 0,
        status: 'active'
      }));

      const response = await request(app)
        .get('/api/invite/validate')
        .set('X-Invite-Token', 'expired-token')
        .expect(401);

      expect(response.body).toHaveProperty('valid', false);
      expect(response.body.reason).toBe('expired');
    });

    it('should return 401 for used token', async () => {
      mockRedis.get.mockResolvedValue(JSON.stringify({
        createdAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 3600000).toISOString(),
        maxUses: 1,
        useCount: 1,
        status: 'used'
      }));

      const response = await request(app)
        .get('/api/invite/validate')
        .set('X-Invite-Token', 'used-token')
        .expect(401);

      expect(response.body).toHaveProperty('valid', false);
      expect(response.body.reason).toBe('used');
    });

    it('should return 401 for revoked token', async () => {
      mockRedis.get.mockResolvedValue(JSON.stringify({
        createdAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 3600000).toISOString(),
        maxUses: 1,
        useCount: 0,
        status: 'revoked'
      }));

      const response = await request(app)
        .get('/api/invite/validate')
        .set('X-Invite-Token', 'revoked-token')
        .expect(401);

      expect(response.body).toHaveProperty('valid', false);
      expect(response.body.reason).toBe('revoked');
    });
  });

  describe('Error Handling', () => {
    it('should return 404 for unknown routes', async () => {
      await request(app)
        .get('/api/unknown-endpoint')
        .expect(404);
    });
  });
});
