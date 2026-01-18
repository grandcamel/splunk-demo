/**
 * Tests for services/session.js
 */

jest.mock('../config/metrics', () => ({
  getTracer: () => null,
  sessionsStartedCounter: null,
  sessionsEndedCounter: null,
  sessionDurationHistogram: null,
  queueWaitHistogram: null,
  ttydSpawnHistogram: null,
}));

jest.mock('../services/invite', () => ({
  recordInviteUsage: jest.fn(),
}));

const state = require('../services/state');
const { generateSessionToken, findClientWs, clearSessionToken, setSessionCookie } = require('../services/session');

describe('session module', () => {
  beforeEach(() => {
    // Reset state before each test
    state.clients.clear();
    state.queue.length = 0;
    state.setActiveSession(null);
    state.sessionTokens.clear();
    state.pendingSessionTokens.clear();
  });

  describe('generateSessionToken', () => {
    test('should generate a token string', () => {
      const token = generateSessionToken('session-123');

      expect(typeof token).toBe('string');
      expect(token.length).toBeGreaterThan(0);
    });

    test('should generate tokens with base64 data and signature', () => {
      const token = generateSessionToken('session-123');

      // Token format: base64data.signature
      expect(token).toMatch(/^[A-Za-z0-9+/=]+\.[a-f0-9]+$/);
    });

    test('should generate different tokens for different sessions', () => {
      const token1 = generateSessionToken('session-1');
      const token2 = generateSessionToken('session-2');

      expect(token1).not.toBe(token2);
    });

    test('should generate different tokens at different times', async () => {
      const token1 = generateSessionToken('session-1');

      // Small delay to ensure different timestamp
      await new Promise(resolve => setTimeout(resolve, 5));

      const token2 = generateSessionToken('session-1');

      expect(token1).not.toBe(token2);
    });

    test('should include session ID in the encoded data', () => {
      const sessionId = 'my-unique-session';
      const token = generateSessionToken(sessionId);

      // Extract base64 part
      const [base64Part] = token.split('.');
      const decoded = Buffer.from(base64Part, 'base64').toString();

      expect(decoded).toContain(sessionId);
    });
  });

  describe('findClientWs', () => {
    test('should return null when no clients exist', () => {
      const result = findClientWs('nonexistent');

      expect(result).toBeNull();
    });

    test('should return null when client ID not found', () => {
      const ws1 = { id: 'ws-1' };
      state.clients.set(ws1, { id: 'client-1', state: 'connected' });

      const result = findClientWs('client-2');

      expect(result).toBeNull();
    });

    test('should return WebSocket when client ID found', () => {
      const ws1 = { id: 'ws-1' };
      const ws2 = { id: 'ws-2' };
      state.clients.set(ws1, { id: 'client-1', state: 'connected' });
      state.clients.set(ws2, { id: 'client-2', state: 'queued' });

      const result = findClientWs('client-2');

      expect(result).toBe(ws2);
    });

    test('should return first matching WebSocket', () => {
      const ws1 = { id: 'ws-1' };
      const ws2 = { id: 'ws-2' };
      state.clients.set(ws1, { id: 'target', state: 'connected' });
      state.clients.set(ws2, { id: 'other', state: 'connected' });

      const result = findClientWs('target');

      expect(result).toBe(ws1);
    });
  });

  describe('clearSessionToken', () => {
    test('should remove token from sessionTokens map', () => {
      const token = 'test-token';
      state.sessionTokens.set(token, 'session-1');

      clearSessionToken(token);

      expect(state.sessionTokens.has(token)).toBe(false);
    });

    test('should not throw for non-existent token', () => {
      expect(() => clearSessionToken('nonexistent')).not.toThrow();
    });

    test('should handle null token', () => {
      expect(() => clearSessionToken(null)).not.toThrow();
    });

    test('should handle undefined token', () => {
      expect(() => clearSessionToken(undefined)).not.toThrow();
    });

    test('should only remove specified token', () => {
      state.sessionTokens.set('token-1', 'session-1');
      state.sessionTokens.set('token-2', 'session-2');

      clearSessionToken('token-1');

      expect(state.sessionTokens.has('token-1')).toBe(false);
      expect(state.sessionTokens.has('token-2')).toBe(true);
    });
  });

  describe('setSessionCookie', () => {
    test('should generate and store a session token', () => {
      const ws = { id: 'ws-1' };
      const sessionId = 'session-123';
      state.clients.set(ws, { id: 'client-1', state: 'active' });

      const token = setSessionCookie(ws, sessionId);

      expect(typeof token).toBe('string');
      expect(state.sessionTokens.has(token)).toBe(true);
      expect(state.sessionTokens.get(token)).toBe(sessionId);
    });

    test('should set sessionToken on client object', () => {
      const ws = { id: 'ws-1' };
      const client = { id: 'client-1', state: 'active' };
      state.clients.set(ws, client);

      const token = setSessionCookie(ws, 'session-123');

      expect(client.sessionToken).toBe(token);
    });

    test('should handle missing client', () => {
      const ws = { id: 'ws-1' };
      // Don't add client to state.clients

      // Should not throw
      const token = setSessionCookie(ws, 'session-123');

      expect(typeof token).toBe('string');
      expect(state.sessionTokens.has(token)).toBe(true);
    });
  });
});
