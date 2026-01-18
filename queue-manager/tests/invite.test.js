/**
 * Tests for services/invite.js
 */

jest.mock('../config/metrics', () => ({
  getTracer: () => null,
  invitesValidatedCounter: null,
}));

const state = require('../services/state');
const { validateInvite, recordInviteUsage } = require('../services/invite');

// Mock Redis client
const createMockRedis = () => ({
  get: jest.fn(),
  set: jest.fn(),
  ttl: jest.fn(),
});

describe('invite module', () => {
  beforeEach(() => {
    // Reset state before each test
    state.clients.clear();
    state.queue.length = 0;
    state.setActiveSession(null);
    state.sessionTokens.clear();
    state.pendingSessionTokens.clear();
  });

  describe('validateInvite', () => {
    describe('token format validation', () => {
      test('should reject null token', async () => {
        const redis = createMockRedis();

        const result = await validateInvite(redis, null);

        expect(result.valid).toBe(false);
        expect(result.reason).toBe('invalid');
      });

      test('should reject empty token', async () => {
        const redis = createMockRedis();

        const result = await validateInvite(redis, '');

        expect(result.valid).toBe(false);
        expect(result.reason).toBe('invalid');
      });

      test('should reject token shorter than 4 chars', async () => {
        const redis = createMockRedis();

        const result = await validateInvite(redis, 'abc');

        expect(result.valid).toBe(false);
        expect(result.reason).toBe('invalid');
      });

      test('should reject token longer than 64 chars', async () => {
        const redis = createMockRedis();
        const longToken = 'a'.repeat(65);

        const result = await validateInvite(redis, longToken);

        expect(result.valid).toBe(false);
        expect(result.reason).toBe('invalid');
      });

      test('should reject token with invalid characters', async () => {
        const redis = createMockRedis();

        const result = await validateInvite(redis, 'abc!@#$');

        expect(result.valid).toBe(false);
        expect(result.reason).toBe('invalid');
      });

      test('should accept valid token format', async () => {
        const redis = createMockRedis();
        redis.get.mockResolvedValue(null);

        const result = await validateInvite(redis, 'valid-token_123');

        // Should proceed to Redis lookup (not_found is expected since we return null)
        expect(result.reason).toBe('not_found');
      });
    });

    describe('token lookup', () => {
      test('should return not_found when token not in Redis', async () => {
        const redis = createMockRedis();
        redis.get.mockResolvedValue(null);

        const result = await validateInvite(redis, 'valid-token');

        expect(result.valid).toBe(false);
        expect(result.reason).toBe('not_found');
      });

      test('should return revoked when token is revoked', async () => {
        const redis = createMockRedis();
        redis.get.mockResolvedValue(JSON.stringify({
          status: 'revoked',
          expiresAt: new Date(Date.now() + 3600000).toISOString(),
          maxUses: 1,
          useCount: 0,
        }));

        const result = await validateInvite(redis, 'revoked-token');

        expect(result.valid).toBe(false);
        expect(result.reason).toBe('revoked');
      });

      test('should return used when token already used', async () => {
        const redis = createMockRedis();
        redis.get.mockResolvedValue(JSON.stringify({
          status: 'used',
          expiresAt: new Date(Date.now() + 3600000).toISOString(),
          maxUses: 1,
          useCount: 1,
        }));

        const result = await validateInvite(redis, 'used-token');

        expect(result.valid).toBe(false);
        expect(result.reason).toBe('used');
      });

      test('should return used when useCount >= maxUses', async () => {
        const redis = createMockRedis();
        redis.get.mockResolvedValue(JSON.stringify({
          status: 'active',
          expiresAt: new Date(Date.now() + 3600000).toISOString(),
          maxUses: 2,
          useCount: 2,
        }));

        const result = await validateInvite(redis, 'maxed-token');

        expect(result.valid).toBe(false);
        expect(result.reason).toBe('used');
      });

      test('should return expired when token is expired', async () => {
        const redis = createMockRedis();
        redis.get.mockResolvedValue(JSON.stringify({
          status: 'active',
          expiresAt: new Date(Date.now() - 3600000).toISOString(), // 1 hour ago
          maxUses: 1,
          useCount: 0,
        }));
        redis.ttl.mockResolvedValue(86400);

        const result = await validateInvite(redis, 'expired-token');

        expect(result.valid).toBe(false);
        expect(result.reason).toBe('expired');
      });

      test('should return valid for good token', async () => {
        const redis = createMockRedis();
        const inviteData = {
          status: 'active',
          expiresAt: new Date(Date.now() + 3600000).toISOString(),
          maxUses: 1,
          useCount: 0,
        };
        redis.get.mockResolvedValue(JSON.stringify(inviteData));

        const result = await validateInvite(redis, 'valid-token');

        expect(result.valid).toBe(true);
        expect(result.data).toEqual(inviteData);
      });
    });

    describe('rejoin logic', () => {
      test('should allow rejoin for same IP with active session', async () => {
        const redis = createMockRedis();
        const token = 'used-invite';
        const clientIp = '192.168.1.1';

        redis.get.mockResolvedValue(JSON.stringify({
          status: 'used',
          expiresAt: new Date(Date.now() + 3600000).toISOString(),
          maxUses: 1,
          useCount: 1,
        }));

        // Set up active session with matching token and IP
        state.setActiveSession({
          inviteToken: token,
          ip: clientIp,
          sessionId: 'session-123',
        });

        const result = await validateInvite(redis, token, clientIp);

        expect(result.valid).toBe(true);
        expect(result.rejoin).toBe(true);
      });

      test('should not allow rejoin for different IP', async () => {
        const redis = createMockRedis();
        const token = 'used-invite';

        redis.get.mockResolvedValue(JSON.stringify({
          status: 'used',
          expiresAt: new Date(Date.now() + 3600000).toISOString(),
          maxUses: 1,
          useCount: 1,
        }));

        state.setActiveSession({
          inviteToken: token,
          ip: '192.168.1.1',
          sessionId: 'session-123',
        });

        const result = await validateInvite(redis, token, '192.168.1.2');

        expect(result.valid).toBe(false);
        expect(result.reason).toBe('used');
      });

      test('should allow rejoin from pending session tokens', async () => {
        const redis = createMockRedis();
        const token = 'used-invite';
        const clientIp = '192.168.1.1';

        redis.get.mockResolvedValue(JSON.stringify({
          status: 'used',
          expiresAt: new Date(Date.now() + 3600000).toISOString(),
          maxUses: 1,
          useCount: 1,
        }));

        // Set up pending session token
        state.pendingSessionTokens.set('pending-token', {
          clientId: 'client-1',
          inviteToken: token,
          ip: clientIp,
        });

        const result = await validateInvite(redis, token, clientIp);

        expect(result.valid).toBe(true);
        expect(result.rejoin).toBe(true);
      });
    });
  });

  describe('recordInviteUsage', () => {
    test('should handle missing invite', async () => {
      const redis = createMockRedis();
      redis.get.mockResolvedValue(null);

      const session = {
        inviteToken: 'nonexistent',
        sessionId: 'session-1',
        clientId: 'client-1',
        startedAt: new Date(),
        queueWaitMs: 1000,
        ip: '192.168.1.1',
        userAgent: 'test-agent',
        errors: [],
      };

      // Should not throw
      await expect(recordInviteUsage(redis, session, new Date(), 'timeout', 30)).resolves.not.toThrow();
    });

    test('should update invite with session data', async () => {
      const redis = createMockRedis();
      const inviteData = {
        status: 'active',
        expiresAt: new Date(Date.now() + 86400000).toISOString(),
        maxUses: 1,
        useCount: 0,
        sessions: [],
      };
      redis.get.mockResolvedValue(JSON.stringify(inviteData));
      redis.ttl.mockResolvedValue(86400);

      const session = {
        inviteToken: 'test-invite',
        sessionId: 'session-1',
        clientId: 'client-1',
        startedAt: new Date(),
        queueWaitMs: 1000,
        ip: '192.168.1.1',
        userAgent: 'test-agent',
        errors: [],
      };

      await recordInviteUsage(redis, session, new Date(), 'timeout', 30);

      expect(redis.set).toHaveBeenCalled();
      const setCall = redis.set.mock.calls[0];
      const savedData = JSON.parse(setCall[1]);

      expect(savedData.useCount).toBe(1);
      expect(savedData.sessions).toHaveLength(1);
      expect(savedData.sessions[0].sessionId).toBe('session-1');
    });

    test('should mark as used when useCount reaches maxUses', async () => {
      const redis = createMockRedis();
      const inviteData = {
        status: 'active',
        expiresAt: new Date(Date.now() + 86400000).toISOString(),
        maxUses: 1,
        useCount: 0,
      };
      redis.get.mockResolvedValue(JSON.stringify(inviteData));
      redis.ttl.mockResolvedValue(86400);

      const session = {
        inviteToken: 'test-invite',
        sessionId: 'session-1',
        clientId: 'client-1',
        startedAt: new Date(),
        queueWaitMs: 0,
        ip: '192.168.1.1',
        userAgent: 'test-agent',
        errors: [],
      };

      await recordInviteUsage(redis, session, new Date(), 'timeout', 30);

      const setCall = redis.set.mock.calls[0];
      const savedData = JSON.parse(setCall[1]);

      expect(savedData.status).toBe('used');
    });

    test('should set appropriate TTL for audit retention', async () => {
      const redis = createMockRedis();
      const expiresAt = new Date(Date.now() + 86400000); // 1 day from now
      const inviteData = {
        status: 'active',
        expiresAt: expiresAt.toISOString(),
        maxUses: 1,
        useCount: 0,
      };
      redis.get.mockResolvedValue(JSON.stringify(inviteData));
      redis.ttl.mockResolvedValue(86400);

      const session = {
        inviteToken: 'test-invite',
        sessionId: 'session-1',
        clientId: 'client-1',
        startedAt: new Date(),
        queueWaitMs: 0,
        ip: '192.168.1.1',
        userAgent: 'test-agent',
        errors: [],
      };

      await recordInviteUsage(redis, session, new Date(), 'timeout', 30);

      const setCall = redis.set.mock.calls[0];
      expect(setCall[2]).toBe('EX');
      // TTL should be at least 1 day (86400 seconds)
      expect(setCall[3]).toBeGreaterThanOrEqual(86400);
    });
  });
});
