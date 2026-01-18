/**
 * Tests for routes/health.js
 */

const state = require('../services/state');
const config = require('../config');
const healthRoutes = require('../routes/health');

// Mock Express app
const createMockApp = () => {
  const routes = {};
  return {
    get: jest.fn((path, handler) => {
      routes[path] = handler;
    }),
    routes,
  };
};

// Mock request/response
const createMockReq = () => ({});
const createMockRes = () => ({
  json: jest.fn(),
});

describe('health routes', () => {
  beforeEach(() => {
    // Reset state before each test
    state.clients.clear();
    state.queue.length = 0;
    state.setActiveSession(null);
    state.sessionTokens.clear();
    state.pendingSessionTokens.clear();
  });

  describe('register', () => {
    test('should register /api/health route', () => {
      const app = createMockApp();

      healthRoutes.register(app);

      expect(app.get).toHaveBeenCalledWith('/api/health', expect.any(Function));
    });

    test('should register /api/status route', () => {
      const app = createMockApp();

      healthRoutes.register(app);

      expect(app.get).toHaveBeenCalledWith('/api/status', expect.any(Function));
    });
  });

  describe('/api/health', () => {
    test('should return ok status', () => {
      const app = createMockApp();
      healthRoutes.register(app);

      const req = createMockReq();
      const res = createMockRes();

      app.routes['/api/health'](req, res);

      expect(res.json).toHaveBeenCalled();
      const response = res.json.mock.calls[0][0];
      expect(response.status).toBe('ok');
    });

    test('should include timestamp', () => {
      const app = createMockApp();
      healthRoutes.register(app);

      const req = createMockReq();
      const res = createMockRes();

      const before = new Date().toISOString();
      app.routes['/api/health'](req, res);
      const after = new Date().toISOString();

      const response = res.json.mock.calls[0][0];
      expect(response.timestamp).toBeDefined();
      expect(response.timestamp >= before).toBe(true);
      expect(response.timestamp <= after).toBe(true);
    });
  });

  describe('/api/status', () => {
    test('should return queue_size', () => {
      const app = createMockApp();
      healthRoutes.register(app);

      state.queue.push('client-1');
      state.queue.push('client-2');

      const req = createMockReq();
      const res = createMockRes();

      app.routes['/api/status'](req, res);

      const response = res.json.mock.calls[0][0];
      expect(response.queue_size).toBe(2);
    });

    test('should return session_active false when no session', () => {
      const app = createMockApp();
      healthRoutes.register(app);

      const req = createMockReq();
      const res = createMockRes();

      app.routes['/api/status'](req, res);

      const response = res.json.mock.calls[0][0];
      expect(response.session_active).toBe(false);
    });

    test('should return session_active true when session exists', () => {
      const app = createMockApp();
      healthRoutes.register(app);

      state.setActiveSession({ clientId: 'client-1', sessionId: 'session-1' });

      const req = createMockReq();
      const res = createMockRes();

      app.routes['/api/status'](req, res);

      const response = res.json.mock.calls[0][0];
      expect(response.session_active).toBe(true);
    });

    test('should calculate estimated_wait based on queue size', () => {
      const app = createMockApp();
      healthRoutes.register(app);

      state.queue.push('client-1');
      state.queue.push('client-2');
      state.queue.push('client-3');

      const req = createMockReq();
      const res = createMockRes();

      app.routes['/api/status'](req, res);

      const response = res.json.mock.calls[0][0];
      // 3 * AVERAGE_SESSION_MINUTES (45) = 135 minutes
      expect(response.estimated_wait).toBe(`${3 * config.AVERAGE_SESSION_MINUTES} minutes`);
    });

    test('should return max_queue_size from config', () => {
      const app = createMockApp();
      healthRoutes.register(app);

      const req = createMockReq();
      const res = createMockRes();

      app.routes['/api/status'](req, res);

      const response = res.json.mock.calls[0][0];
      expect(response.max_queue_size).toBe(config.MAX_QUEUE_SIZE);
    });

    test('should return 0 minutes for empty queue', () => {
      const app = createMockApp();
      healthRoutes.register(app);

      const req = createMockReq();
      const res = createMockRes();

      app.routes['/api/status'](req, res);

      const response = res.json.mock.calls[0][0];
      expect(response.queue_size).toBe(0);
      expect(response.estimated_wait).toBe('0 minutes');
    });
  });
});
