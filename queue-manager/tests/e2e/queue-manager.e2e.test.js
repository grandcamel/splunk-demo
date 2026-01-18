/**
 * End-to-End Tests for Queue Manager
 *
 * These tests run against a real Dockerized queue-manager service
 * with real Redis. They test the full request/response cycle.
 *
 * Prerequisites:
 *   docker compose -f docker-compose.test.yml up -d
 *
 * Run:
 *   npm run test:e2e
 */

const WebSocket = require('ws');
const {
  QUEUE_MANAGER_URL,
  waitForService,
  createRedisClient,
  cleanupRedis,
  createTestInvite
} = require('./setup');

// Increase timeout for e2e tests
jest.setTimeout(30000);

describe('Queue Manager E2E Tests', () => {
  let redis;

  beforeAll(async () => {
    // Wait for services to be ready
    await waitForService();

    // Create Redis client for test setup/teardown
    redis = createRedisClient();
  });

  afterAll(async () => {
    if (redis) {
      await redis.quit();
    }
  });

  beforeEach(async () => {
    // Clean Redis state before each test
    await cleanupRedis(redis);
  });

  describe('Health Endpoints', () => {
    it('GET /api/health should return OK', async () => {
      const response = await fetch(`${QUEUE_MANAGER_URL}/api/health`);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.status).toBe('ok');
      expect(data.timestamp).toBeDefined();
    });

    it('GET /api/status should return queue status', async () => {
      const response = await fetch(`${QUEUE_MANAGER_URL}/api/status`);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.queue_size).toBe(0);
      expect(data.session_active).toBe(false);
      expect(data.max_queue_size).toBeGreaterThan(0);
    });
  });

  describe('Invite Validation', () => {
    it('should reject missing invite token', async () => {
      const response = await fetch(`${QUEUE_MANAGER_URL}/api/invite/validate`);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.valid).toBe(false);
      expect(data.reason).toBe('missing');
    });

    it('should reject non-existent invite token', async () => {
      const response = await fetch(`${QUEUE_MANAGER_URL}/api/invite/validate`, {
        headers: { 'X-Invite-Token': 'nonexistent-token' }
      });
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.valid).toBe(false);
      expect(data.reason).toBe('not_found');
    });

    it('should accept valid invite token', async () => {
      // Create a valid invite in Redis
      await createTestInvite(redis, 'valid-e2e-token');

      const response = await fetch(`${QUEUE_MANAGER_URL}/api/invite/validate`, {
        headers: { 'X-Invite-Token': 'valid-e2e-token' }
      });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.valid).toBe(true);
    });

    it('should reject expired invite token', async () => {
      // Create an expired invite
      await createTestInvite(redis, 'expired-e2e-token', {
        expiresAt: new Date(Date.now() - 3600000).toISOString() // 1 hour ago
      });

      const response = await fetch(`${QUEUE_MANAGER_URL}/api/invite/validate`, {
        headers: { 'X-Invite-Token': 'expired-e2e-token' }
      });
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.valid).toBe(false);
      expect(data.reason).toBe('expired');
    });

    it('should reject used invite token', async () => {
      // Create a used invite
      await createTestInvite(redis, 'used-e2e-token', {
        useCount: 1,
        maxUses: 1,
        status: 'used'
      });

      const response = await fetch(`${QUEUE_MANAGER_URL}/api/invite/validate`, {
        headers: { 'X-Invite-Token': 'used-e2e-token' }
      });
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.valid).toBe(false);
      expect(data.reason).toBe('used');
    });

    it('should reject revoked invite token', async () => {
      // Create a revoked invite
      await createTestInvite(redis, 'revoked-e2e-token', {
        status: 'revoked'
      });

      const response = await fetch(`${QUEUE_MANAGER_URL}/api/invite/validate`, {
        headers: { 'X-Invite-Token': 'revoked-e2e-token' }
      });
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.valid).toBe(false);
      expect(data.reason).toBe('revoked');
    });
  });

  describe('Session Validation', () => {
    it('should reject requests without session cookie', async () => {
      const response = await fetch(`${QUEUE_MANAGER_URL}/api/session/validate`);

      expect(response.status).toBe(401);
    });

    it('should reject invalid session cookie', async () => {
      const response = await fetch(`${QUEUE_MANAGER_URL}/api/session/validate`, {
        headers: { 'Cookie': 'demo_session=invalid-token' }
      });

      expect(response.status).toBe(401);
    });
  });

  describe('WebSocket Connection', () => {
    /**
     * Helper to create WebSocket connection.
     */
    function connectWs() {
      const wsUrl = QUEUE_MANAGER_URL.replace('http', 'ws') + '/api/ws';
      return new WebSocket(wsUrl);
    }

    /**
     * Helper to wait for a specific message type.
     */
    function waitForMessage(ws, expectedType, timeout = 5000) {
      return new Promise((resolve, reject) => {
        const timer = setTimeout(() => {
          reject(new Error(`Timeout waiting for ${expectedType}`));
        }, timeout);

        const handler = (data) => {
          const message = JSON.parse(data.toString());
          if (message.type === expectedType) {
            clearTimeout(timer);
            ws.off('message', handler);
            resolve(message);
          }
        };

        ws.on('message', handler);
      });
    }

    it('should connect and receive status message', async () => {
      const ws = connectWs();

      try {
        // Set up listener before connection opens
        const statusPromise = waitForMessage(ws, 'status');

        await new Promise((resolve, reject) => {
          ws.once('open', resolve);
          ws.once('error', reject);
        });

        const status = await statusPromise;

        expect(status.type).toBe('status');
        expect(status.queue_size).toBe(0);
        expect(status.session_active).toBe(false);
      } finally {
        ws.close();
      }
    });

    it('should respond to heartbeat', async () => {
      const ws = connectWs();

      try {
        const statusPromise = waitForMessage(ws, 'status');

        await new Promise((resolve, reject) => {
          ws.once('open', resolve);
          ws.once('error', reject);
        });

        await statusPromise;

        // Send heartbeat
        ws.send(JSON.stringify({ type: 'heartbeat' }));

        const ack = await waitForMessage(ws, 'heartbeat_ack');
        expect(ack.type).toBe('heartbeat_ack');
      } finally {
        ws.close();
      }
    });

    it('should start session when joining empty queue', async () => {
      const ws = connectWs();

      try {
        const statusPromise = waitForMessage(ws, 'status');

        await new Promise((resolve, reject) => {
          ws.once('open', resolve);
          ws.once('error', reject);
        });

        await statusPromise;

        // Join queue
        ws.send(JSON.stringify({ type: 'join_queue' }));

        const response = await waitForMessage(ws, 'session_starting');
        expect(response.type).toBe('session_starting');
        expect(response.terminal_url).toBeDefined();
      } finally {
        ws.close();
      }
    });

    it('should queue second client when session is active', async () => {
      const ws1 = connectWs();
      const ws2 = connectWs();

      try {
        // First client connects and starts session
        const status1Promise = waitForMessage(ws1, 'status');
        await new Promise((resolve, reject) => {
          ws1.once('open', resolve);
          ws1.once('error', reject);
        });
        await status1Promise;

        ws1.send(JSON.stringify({ type: 'join_queue' }));
        await waitForMessage(ws1, 'session_starting');

        // Second client connects
        const status2Promise = waitForMessage(ws2, 'status');
        await new Promise((resolve, reject) => {
          ws2.once('open', resolve);
          ws2.once('error', reject);
        });
        await status2Promise;

        // Second client joins queue
        ws2.send(JSON.stringify({ type: 'join_queue' }));

        const queuePosition = await waitForMessage(ws2, 'queue_position');
        expect(queuePosition.type).toBe('queue_position');
        expect(queuePosition.position).toBe(1);
      } finally {
        ws1.close();
        ws2.close();
      }
    });

    it('should validate invite token when joining queue', async () => {
      // Create valid invite
      await createTestInvite(redis, 'ws-test-invite');

      const ws = connectWs();

      try {
        const statusPromise = waitForMessage(ws, 'status');
        await new Promise((resolve, reject) => {
          ws.once('open', resolve);
          ws.once('error', reject);
        });
        await statusPromise;

        // Join with valid invite
        ws.send(JSON.stringify({ type: 'join_queue', inviteToken: 'ws-test-invite' }));

        const response = await waitForMessage(ws, 'session_starting');
        expect(response.type).toBe('session_starting');
      } finally {
        ws.close();
      }
    });

    it('should reject invalid invite token when joining queue', async () => {
      const ws = connectWs();

      try {
        const statusPromise = waitForMessage(ws, 'status');
        await new Promise((resolve, reject) => {
          ws.once('open', resolve);
          ws.once('error', reject);
        });
        await statusPromise;

        // Join with invalid invite
        ws.send(JSON.stringify({ type: 'join_queue', inviteToken: 'invalid-invite' }));

        const response = await waitForMessage(ws, 'invite_invalid');
        expect(response.type).toBe('invite_invalid');
        expect(response.reason).toBe('not_found');
      } finally {
        ws.close();
      }
    });

    it('should allow client to leave queue', async () => {
      const ws1 = connectWs();
      const ws2 = connectWs();

      try {
        // First client starts session
        const status1Promise = waitForMessage(ws1, 'status');
        await new Promise((resolve, reject) => {
          ws1.once('open', resolve);
          ws1.once('error', reject);
        });
        await status1Promise;
        ws1.send(JSON.stringify({ type: 'join_queue' }));
        await waitForMessage(ws1, 'session_starting');

        // Second client joins queue
        const status2Promise = waitForMessage(ws2, 'status');
        await new Promise((resolve, reject) => {
          ws2.once('open', resolve);
          ws2.once('error', reject);
        });
        await status2Promise;
        ws2.send(JSON.stringify({ type: 'join_queue' }));
        await waitForMessage(ws2, 'queue_position');

        // Verify queue has 1 client via status API
        let statusResponse = await fetch(`${QUEUE_MANAGER_URL}/api/status`);
        let statusData = await statusResponse.json();
        expect(statusData.queue_size).toBe(1);

        // Second client leaves queue
        ws2.send(JSON.stringify({ type: 'leave_queue' }));

        // Wait for queue to update
        await new Promise(resolve => setTimeout(resolve, 100));

        // Verify queue is empty
        statusResponse = await fetch(`${QUEUE_MANAGER_URL}/api/status`);
        statusData = await statusResponse.json();
        expect(statusData.queue_size).toBe(0);
      } finally {
        ws1.close();
        ws2.close();
      }
    });
  });

  describe('Queue Status Updates', () => {
    it('should reflect active session in status', async () => {
      const ws = connectWs();

      try {
        const statusPromise = waitForMessage(ws, 'status');
        await new Promise((resolve, reject) => {
          ws.once('open', resolve);
          ws.once('error', reject);
        });
        await statusPromise;

        // Join queue to start session
        ws.send(JSON.stringify({ type: 'join_queue' }));
        await waitForMessage(ws, 'session_starting');

        // Wait for session to be fully started
        await new Promise(resolve => setTimeout(resolve, 200));

        // Check status API
        const response = await fetch(`${QUEUE_MANAGER_URL}/api/status`);
        const data = await response.json();

        expect(data.session_active).toBe(true);
      } finally {
        ws.close();
      }
    });
  });

  // Helper to create WebSocket connection
  function connectWs() {
    const wsUrl = QUEUE_MANAGER_URL.replace('http', 'ws') + '/api/ws';
    return new WebSocket(wsUrl);
  }
});
