/**
 * WebSocket Integration Tests for Queue Manager.
 *
 * Tests WebSocket protocol with actual connection flow.
 */

const WebSocket = require('ws');
const { createTestServer, startServer, stopServer, resetState } = require('../setup/websocket');
const state = require('../../services/state');

// Mock the session service's startSession to avoid Docker/file system dependencies
const mockStartSession = jest.fn();
jest.mock('../../services/session', () => {
  const actualSession = jest.requireActual('../../services/session');
  return {
    ...actualSession,
    startSession: (...args) => mockStartSession(...args)
  };
});

// Increase timeout for WebSocket tests
jest.setTimeout(10000);

describe('WebSocket Integration Tests', () => {
  let server, wss, port, mockRedis;
  let openConnections = [];

  beforeEach(async () => {
    resetState();
    openConnections = [];

    // Configure mock startSession to simulate session starting
    mockStartSession.mockClear();
    mockStartSession.mockImplementation((redis, ws, client, processQueue) => {
      const sessionId = 'test-session-' + Date.now();
      const token = 'test-token-' + Date.now();
      const expiresAt = new Date(Date.now() + 30 * 60 * 1000);

      // Update state
      state.setActiveSession({
        sessionId,
        clientId: client.id,
        inviteToken: client.inviteToken,
        ip: client.ip,
        sessionToken: token,
        startedAt: new Date(),
        expiresAt
      });

      // Remove from queue
      const queueIndex = state.queue.indexOf(client.id);
      if (queueIndex !== -1) {
        state.queue.splice(queueIndex, 1);
      }

      client.state = 'active';

      // Send session starting message
      ws.send(JSON.stringify({
        type: 'session_starting',
        terminal_url: '/terminal',
        expires_at: expiresAt.toISOString(),
        session_token: token
      }));
    });

    // Create mock Redis client
    mockRedis = {
      get: jest.fn().mockResolvedValue(null),
      set: jest.fn().mockResolvedValue('OK'),
      del: jest.fn().mockResolvedValue(1),
      ttl: jest.fn().mockResolvedValue(3600),
      hincrby: jest.fn().mockResolvedValue(0),
      lpush: jest.fn().mockResolvedValue(1),
      expire: jest.fn().mockResolvedValue(1)
    };

    const setup = createTestServer(mockRedis);
    server = setup.server;
    wss = setup.wss;
    port = await startServer(server);
  });

  afterEach(async () => {
    // Close all open connections
    for (const ws of openConnections) {
      if (ws.readyState === WebSocket.OPEN) {
        ws.close();
      }
    }

    // Wait for connections to close
    await new Promise(resolve => setTimeout(resolve, 100));

    // Stop server
    if (server && wss) {
      await stopServer(server, wss);
    }
  });

  /**
   * Helper to create a WebSocket connection and track it.
   */
  function connect() {
    const ws = new WebSocket(`ws://localhost:${port}/api/ws`);
    openConnections.push(ws);
    return ws;
  }

  /**
   * Helper to connect and wait for initial status message.
   * Sets up message listener before connection opens to avoid race conditions.
   */
  function connectAndWaitForStatus(timeout = 3000) {
    return new Promise((resolve, reject) => {
      const ws = new WebSocket(`ws://localhost:${port}/api/ws`);
      openConnections.push(ws);

      const timer = setTimeout(() => {
        reject(new Error('Timeout waiting for status message'));
      }, timeout);

      let statusReceived = false;

      ws.on('message', (data) => {
        try {
          const message = JSON.parse(data.toString());
          if (message.type === 'status' && !statusReceived) {
            statusReceived = true;
            clearTimeout(timer);
            resolve({ ws, status: message });
          }
        } catch (err) {
          // Ignore parse errors
        }
      });

      ws.on('error', (err) => {
        clearTimeout(timer);
        reject(err);
      });
    });
  }

  /**
   * Helper to wait for a specific message type.
   */
  function waitForMessage(ws, expectedType, timeout = 3000) {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new Error(`Timeout waiting for message type: ${expectedType}`));
      }, timeout);

      const handler = (data) => {
        try {
          const message = JSON.parse(data.toString());
          if (message.type === expectedType) {
            clearTimeout(timer);
            ws.off('message', handler);
            resolve(message);
          }
        } catch (err) {
          // Ignore parse errors, keep waiting
        }
      };

      ws.on('message', handler);
    });
  }

  /**
   * Helper to wait for WebSocket to open.
   */
  function waitForOpen(ws, timeout = 3000) {
    return new Promise((resolve, reject) => {
      if (ws.readyState === WebSocket.OPEN) {
        resolve();
        return;
      }

      const timer = setTimeout(() => {
        reject(new Error('Timeout waiting for connection'));
      }, timeout);

      ws.once('open', () => {
        clearTimeout(timer);
        resolve();
      });

      ws.once('error', (err) => {
        clearTimeout(timer);
        reject(err);
      });
    });
  }

  describe('Connection', () => {
    it('should accept WebSocket connections', async () => {
      const ws = connect();
      await waitForOpen(ws);

      expect(ws.readyState).toBe(WebSocket.OPEN);
    });

    it('should send status message on connect', async () => {
      const { ws, status } = await connectAndWaitForStatus();

      expect(status).toHaveProperty('type', 'status');
      expect(status).toHaveProperty('queue_size', 0);
      expect(status).toHaveProperty('session_active', false);
    });

    it('should track client in state on connect', async () => {
      const { ws } = await connectAndWaitForStatus();

      // Give handler time to register client
      await new Promise(resolve => setTimeout(resolve, 100));

      expect(state.clients.size).toBe(1);
    });
  });

  describe('Heartbeat', () => {
    it('should respond to heartbeat with heartbeat_ack', async () => {
      const { ws } = await connectAndWaitForStatus();

      ws.send(JSON.stringify({ type: 'heartbeat' }));

      const response = await waitForMessage(ws, 'heartbeat_ack');
      expect(response.type).toBe('heartbeat_ack');
    });
  });

  describe('Error Handling', () => {
    it('should return error for unknown message type', async () => {
      const { ws } = await connectAndWaitForStatus();

      ws.send(JSON.stringify({ type: 'unknown_type' }));

      const response = await waitForMessage(ws, 'error');
      expect(response.type).toBe('error');
      expect(response.message).toContain('Unknown message type');
    });

    it('should return error for invalid JSON', async () => {
      const { ws } = await connectAndWaitForStatus();

      ws.send('not valid json');

      const response = await waitForMessage(ws, 'error');
      expect(response.type).toBe('error');
      expect(response.message).toContain('Invalid message format');
    });
  });

  describe('Join Queue', () => {
    it('should start session immediately when queue is empty', async () => {
      const { ws } = await connectAndWaitForStatus();

      ws.send(JSON.stringify({ type: 'join_queue' }));

      const response = await waitForMessage(ws, 'session_starting');
      expect(response.type).toBe('session_starting');
    });

    it('should return queue position when session is active', async () => {
      // Set up active session first
      state.setActiveSession({
        sessionId: 'existing-session',
        clientId: 'existing-client',
        startedAt: new Date()
      });

      const { ws } = await connectAndWaitForStatus();

      ws.send(JSON.stringify({ type: 'join_queue' }));

      const response = await waitForMessage(ws, 'queue_position');
      expect(response.type).toBe('queue_position');
      expect(response.position).toBe(1);
    });

    it('should validate invite token when provided', async () => {
      mockRedis.get.mockResolvedValue(null); // Token not found

      const { ws } = await connectAndWaitForStatus();

      ws.send(JSON.stringify({ type: 'join_queue', inviteToken: 'invalid-token' }));

      const response = await waitForMessage(ws, 'invite_invalid');
      expect(response.type).toBe('invite_invalid');
      expect(response.reason).toBe('not_found');
    });
  });

  describe('Leave Queue', () => {
    it('should allow leaving queue', async () => {
      // Set up active session so we get queued
      state.setActiveSession({
        sessionId: 'existing-session',
        clientId: 'existing-client',
        startedAt: new Date()
      });

      const { ws } = await connectAndWaitForStatus();

      // Join queue first
      ws.send(JSON.stringify({ type: 'join_queue' }));
      await waitForMessage(ws, 'queue_position');

      expect(state.queue.length).toBe(1);

      // Leave queue
      ws.send(JSON.stringify({ type: 'leave_queue' }));

      // Give handler time to process
      await new Promise(resolve => setTimeout(resolve, 100));

      expect(state.queue.length).toBe(0);
    });
  });
});
