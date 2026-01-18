/**
 * Test app setup - creates Express app without starting the server.
 * Used for integration testing with supertest.
 */

const express = require('express');
const cookieParser = require('cookie-parser');

const state = require('../../services/state');
const healthRoutes = require('../../routes/health');
const sessionRoutes = require('../../routes/session');

/**
 * Create a test app instance.
 * @param {Object} mockRedis - Mock Redis client
 * @returns {Express} Express app configured for testing
 */
function createTestApp(mockRedis) {
  const app = express();

  // Middleware
  app.use(express.json());
  app.use(cookieParser());

  // Register routes
  healthRoutes.register(app);
  sessionRoutes.register(app, mockRedis);

  return app;
}

/**
 * Reset state between tests.
 */
function resetState() {
  state.queue.length = 0;
  state.clients.clear();
  state.sessionTokens.clear();
  state.pendingSessionTokens.clear();
  state.setActiveSession(null);
  state.clearDisconnectGraceTimeout();
}

module.exports = { createTestApp, resetState };
