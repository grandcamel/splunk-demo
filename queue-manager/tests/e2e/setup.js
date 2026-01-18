/**
 * E2E Test Setup
 *
 * Configuration and utilities for end-to-end tests against
 * the Dockerized queue-manager service.
 */

const QUEUE_MANAGER_URL = process.env.QUEUE_MANAGER_URL || 'http://localhost:13000';
const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:16379';

/**
 * Wait for the queue-manager service to be healthy.
 * @param {number} maxRetries - Maximum number of retries
 * @param {number} retryDelay - Delay between retries in ms
 * @returns {Promise<boolean>}
 */
async function waitForService(maxRetries = 30, retryDelay = 1000) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      const response = await fetch(`${QUEUE_MANAGER_URL}/api/health`);
      if (response.ok) {
        console.log('Queue manager is healthy');
        return true;
      }
    } catch (err) {
      // Service not ready yet
    }
    console.log(`Waiting for queue-manager... (${i + 1}/${maxRetries})`);
    await new Promise(resolve => setTimeout(resolve, retryDelay));
  }
  throw new Error('Queue manager failed to become healthy');
}

/**
 * Create a Redis client for direct state inspection/manipulation.
 * @returns {Object} Redis client
 */
function createRedisClient() {
  const Redis = require('ioredis');
  return new Redis(REDIS_URL);
}

/**
 * Clean up Redis state between tests.
 * @param {Object} redis - Redis client
 */
async function cleanupRedis(redis) {
  const keys = await redis.keys('*');
  if (keys.length > 0) {
    await redis.del(...keys);
  }
}

/**
 * Create an invite token directly in Redis for testing.
 * @param {Object} redis - Redis client
 * @param {string} token - Invite token
 * @param {Object} options - Invite options
 * @returns {Promise<void>}
 */
async function createTestInvite(redis, token, options = {}) {
  const invite = {
    token,
    createdAt: new Date().toISOString(),
    expiresAt: options.expiresAt || new Date(Date.now() + 3600000).toISOString(),
    maxUses: options.maxUses || 1,
    useCount: options.useCount || 0,
    status: options.status || 'active',
    createdBy: 'e2e-test'
  };

  await redis.set(`invite:${token}`, JSON.stringify(invite), 'EX', 3600);
}

module.exports = {
  QUEUE_MANAGER_URL,
  REDIS_URL,
  waitForService,
  createRedisClient,
  cleanupRedis,
  createTestInvite
};
