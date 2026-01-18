/**
 * Tests for services/state.js
 */

const state = require('../services/state');

describe('state module', () => {
  beforeEach(() => {
    // Reset state before each test
    state.clients.clear();
    state.queue.length = 0;
    state.setActiveSession(null);
    state.sessionTokens.clear();
    state.pendingSessionTokens.clear();
    state.clearDisconnectGraceTimeout();
  });

  describe('clients Map', () => {
    test('should be a Map', () => {
      expect(state.clients).toBeInstanceOf(Map);
    });

    test('should allow adding and retrieving clients', () => {
      const ws = { id: 'test-ws' };
      const client = { id: 'client-1', state: 'connected' };

      state.clients.set(ws, client);

      expect(state.clients.get(ws)).toBe(client);
      expect(state.clients.size).toBe(1);
    });

    test('should allow deleting clients', () => {
      const ws = { id: 'test-ws' };
      const client = { id: 'client-1' };

      state.clients.set(ws, client);
      state.clients.delete(ws);

      expect(state.clients.has(ws)).toBe(false);
    });
  });

  describe('queue array', () => {
    test('should be an array', () => {
      expect(Array.isArray(state.queue)).toBe(true);
    });

    test('should allow adding items', () => {
      state.queue.push('client-1');
      state.queue.push('client-2');

      expect(state.queue).toEqual(['client-1', 'client-2']);
    });

    test('should allow removing items', () => {
      state.queue.push('client-1');
      state.queue.push('client-2');

      const index = state.queue.indexOf('client-1');
      state.queue.splice(index, 1);

      expect(state.queue).toEqual(['client-2']);
    });
  });

  describe('activeSession', () => {
    test('getActiveSession should return null initially', () => {
      expect(state.getActiveSession()).toBeNull();
    });

    test('setActiveSession should update active session', () => {
      const session = { clientId: 'client-1', sessionId: 'session-1' };

      state.setActiveSession(session);

      expect(state.getActiveSession()).toBe(session);
    });

    test('setActiveSession should accept null', () => {
      const session = { clientId: 'client-1' };
      state.setActiveSession(session);

      state.setActiveSession(null);

      expect(state.getActiveSession()).toBeNull();
    });
  });

  describe('sessionTokens Map', () => {
    test('should be a Map', () => {
      expect(state.sessionTokens).toBeInstanceOf(Map);
    });

    test('should allow storing and retrieving tokens', () => {
      const token = 'abc123';
      const sessionId = 'session-1';

      state.sessionTokens.set(token, sessionId);

      expect(state.sessionTokens.get(token)).toBe(sessionId);
    });
  });

  describe('pendingSessionTokens Map', () => {
    test('should be a Map', () => {
      expect(state.pendingSessionTokens).toBeInstanceOf(Map);
    });

    test('should allow storing pending token data', () => {
      const token = 'pending-token';
      const data = { clientId: 'client-1', inviteToken: 'invite-1' };

      state.pendingSessionTokens.set(token, data);

      expect(state.pendingSessionTokens.get(token)).toBe(data);
    });
  });

  describe('disconnectGraceTimeout', () => {
    test('getDisconnectGraceTimeout should return null initially', () => {
      expect(state.getDisconnectGraceTimeout()).toBeNull();
    });

    test('setDisconnectGraceTimeout should store timeout', () => {
      const timeout = setTimeout(() => {}, 1000);

      state.setDisconnectGraceTimeout(timeout);

      expect(state.getDisconnectGraceTimeout()).toBe(timeout);

      // Clean up
      clearTimeout(timeout);
    });

    test('clearDisconnectGraceTimeout should clear and null timeout', () => {
      let called = false;
      const timeout = setTimeout(() => { called = true; }, 10);

      state.setDisconnectGraceTimeout(timeout);
      state.clearDisconnectGraceTimeout();

      expect(state.getDisconnectGraceTimeout()).toBeNull();

      // Verify timeout was cleared by waiting
      return new Promise(resolve => {
        setTimeout(() => {
          expect(called).toBe(false);
          resolve();
        }, 50);
      });
    });

    test('clearDisconnectGraceTimeout should handle null timeout', () => {
      // Should not throw
      expect(() => state.clearDisconnectGraceTimeout()).not.toThrow();
    });
  });
});
