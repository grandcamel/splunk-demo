/**
 * Tests for services/queue.js
 */

jest.mock('../config/metrics', () => ({
  getTracer: () => null,
  invitesValidatedCounter: null,
  sessionsStartedCounter: null,
  sessionsEndedCounter: null,
  sessionDurationHistogram: null,
  queueWaitHistogram: null,
  ttydSpawnHistogram: null,
}));

jest.mock('../services/invite', () => ({
  validateInvite: jest.fn(),
  recordInviteUsage: jest.fn(),
}));

const state = require('../services/state');
const config = require('../config');
const { sendQueuePosition, leaveQueue, broadcastQueueUpdate } = require('../services/queue');

// Mock WebSocket
const createMockWs = () => ({
  send: jest.fn(),
  readyState: 1, // OPEN
});

describe('queue module', () => {
  beforeEach(() => {
    // Reset state before each test
    state.clients.clear();
    state.queue.length = 0;
    state.setActiveSession(null);
    state.sessionTokens.clear();
    state.pendingSessionTokens.clear();
  });

  describe('sendQueuePosition', () => {
    test('should send correct position for first in queue', () => {
      const ws = createMockWs();
      const client = { id: 'client-1', state: 'queued' };

      state.queue.push('client-1');
      state.clients.set(ws, client);

      sendQueuePosition(ws, client);

      expect(ws.send).toHaveBeenCalledTimes(1);
      const message = JSON.parse(ws.send.mock.calls[0][0]);

      expect(message.type).toBe('queue_position');
      expect(message.position).toBe(1);
      expect(message.queue_size).toBe(1);
    });

    test('should send correct position for second in queue', () => {
      const ws = createMockWs();
      const client = { id: 'client-2', state: 'queued' };

      state.queue.push('client-1');
      state.queue.push('client-2');
      state.clients.set(ws, client);

      sendQueuePosition(ws, client);

      const message = JSON.parse(ws.send.mock.calls[0][0]);
      expect(message.position).toBe(2);
      expect(message.queue_size).toBe(2);
    });

    test('should calculate estimated wait based on position', () => {
      const ws = createMockWs();
      const client = { id: 'client-3', state: 'queued' };

      state.queue.push('client-1');
      state.queue.push('client-2');
      state.queue.push('client-3');
      state.clients.set(ws, client);

      sendQueuePosition(ws, client);

      const message = JSON.parse(ws.send.mock.calls[0][0]);
      // Position 3 * AVERAGE_SESSION_MINUTES (45) = 135 minutes
      expect(message.estimated_wait).toBe(`${3 * config.AVERAGE_SESSION_MINUTES} minutes`);
    });

    test('should return 0 position for client not in queue', () => {
      const ws = createMockWs();
      const client = { id: 'not-in-queue', state: 'connected' };

      state.clients.set(ws, client);

      sendQueuePosition(ws, client);

      const message = JSON.parse(ws.send.mock.calls[0][0]);
      expect(message.position).toBe(0);
    });
  });

  describe('leaveQueue', () => {
    test('should remove client from queue', () => {
      const ws = createMockWs();
      const client = { id: 'client-1', state: 'queued' };

      state.queue.push('client-1');
      state.clients.set(ws, client);

      leaveQueue(ws, client);

      expect(state.queue).not.toContain('client-1');
      expect(state.queue.length).toBe(0);
    });

    test('should update client state to connected', () => {
      const ws = createMockWs();
      const client = { id: 'client-1', state: 'queued' };

      state.queue.push('client-1');
      state.clients.set(ws, client);

      leaveQueue(ws, client);

      expect(client.state).toBe('connected');
    });

    test('should send left_queue message', () => {
      const ws = createMockWs();
      const client = { id: 'client-1', state: 'queued' };

      state.queue.push('client-1');
      state.clients.set(ws, client);

      leaveQueue(ws, client);

      expect(ws.send).toHaveBeenCalled();
      const message = JSON.parse(ws.send.mock.calls[0][0]);
      expect(message.type).toBe('left_queue');
    });

    test('should do nothing if client not in queue', () => {
      const ws = createMockWs();
      const client = { id: 'client-1', state: 'connected' };

      state.clients.set(ws, client);

      leaveQueue(ws, client);

      expect(ws.send).not.toHaveBeenCalled();
    });

    test('should maintain queue order when middle client leaves', () => {
      const ws = createMockWs();
      const client = { id: 'client-2', state: 'queued' };

      state.queue.push('client-1');
      state.queue.push('client-2');
      state.queue.push('client-3');
      state.clients.set(ws, client);

      leaveQueue(ws, client);

      expect(state.queue).toEqual(['client-1', 'client-3']);
    });
  });

  describe('broadcastQueueUpdate', () => {
    test('should send position update to all queued clients', () => {
      const ws1 = createMockWs();
      const ws2 = createMockWs();
      const ws3 = createMockWs();

      const client1 = { id: 'client-1', state: 'queued' };
      const client2 = { id: 'client-2', state: 'queued' };
      const client3 = { id: 'client-3', state: 'connected' }; // Not queued

      state.queue.push('client-1');
      state.queue.push('client-2');
      state.clients.set(ws1, client1);
      state.clients.set(ws2, client2);
      state.clients.set(ws3, client3);

      broadcastQueueUpdate();

      expect(ws1.send).toHaveBeenCalled();
      expect(ws2.send).toHaveBeenCalled();
      expect(ws3.send).not.toHaveBeenCalled();
    });

    test('should send correct positions to each client', () => {
      const ws1 = createMockWs();
      const ws2 = createMockWs();

      const client1 = { id: 'client-1', state: 'queued' };
      const client2 = { id: 'client-2', state: 'queued' };

      state.queue.push('client-1');
      state.queue.push('client-2');
      state.clients.set(ws1, client1);
      state.clients.set(ws2, client2);

      broadcastQueueUpdate();

      const message1 = JSON.parse(ws1.send.mock.calls[0][0]);
      const message2 = JSON.parse(ws2.send.mock.calls[0][0]);

      expect(message1.position).toBe(1);
      expect(message2.position).toBe(2);
    });

    test('should handle empty queue', () => {
      // Should not throw
      expect(() => broadcastQueueUpdate()).not.toThrow();
    });

    test('should skip clients with active state', () => {
      const ws = createMockWs();
      const client = { id: 'client-1', state: 'active' };

      state.queue.push('client-1');
      state.clients.set(ws, client);

      broadcastQueueUpdate();

      expect(ws.send).not.toHaveBeenCalled();
    });
  });
});
