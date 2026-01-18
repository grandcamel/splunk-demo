/**
 * OpenTelemetry metrics setup.
 */

let metrics, trace;
try {
  const api = require('@opentelemetry/api');
  metrics = api.metrics;
  trace = api.trace;
} catch {
  // OTel not available, will use no-op implementations
}

let meter, queueSizeGauge, sessionsActiveGauge, sessionsStartedCounter,
    sessionsEndedCounter, sessionDurationHistogram, queueWaitHistogram,
    ttydSpawnHistogram, invitesValidatedCounter;

/**
 * Initialize OpenTelemetry metrics.
 * @param {Function} getQueueLength - Function returning current queue length
 * @param {Function} getActiveSessionCount - Function returning 1 if session active, 0 otherwise
 */
function initMetrics(getQueueLength, getActiveSessionCount) {
  if (!metrics) return;

  meter = metrics.getMeter('splunk-demo-queue-manager');

  // Gauges
  queueSizeGauge = meter.createObservableGauge('demo_queue_size', {
    description: 'Current number of clients in queue',
  });
  sessionsActiveGauge = meter.createObservableGauge('demo_sessions_active', {
    description: 'Number of currently active sessions',
  });

  // Counters
  sessionsStartedCounter = meter.createCounter('demo_sessions_started_total', {
    description: 'Total number of sessions started',
  });
  sessionsEndedCounter = meter.createCounter('demo_sessions_ended_total', {
    description: 'Total number of sessions ended',
  });
  invitesValidatedCounter = meter.createCounter('demo_invites_validated_total', {
    description: 'Total number of invite validations',
  });

  // Histograms
  sessionDurationHistogram = meter.createHistogram('demo_session_duration_seconds', {
    description: 'Session duration in seconds',
    unit: 's',
  });
  queueWaitHistogram = meter.createHistogram('demo_queue_wait_seconds', {
    description: 'Time spent waiting in queue',
    unit: 's',
  });
  ttydSpawnHistogram = meter.createHistogram('demo_ttyd_spawn_seconds', {
    description: 'Time to spawn ttyd process',
    unit: 's',
  });

  // Register observable callbacks
  queueSizeGauge.addCallback((result) => {
    result.observe(getQueueLength());
  });
  sessionsActiveGauge.addCallback((result) => {
    result.observe(getActiveSessionCount());
  });
}

function getTracer() {
  return trace ? trace.getTracer('splunk-demo-queue-manager') : null;
}

module.exports = {
  initMetrics,
  getTracer,
  get sessionsStartedCounter() { return sessionsStartedCounter; },
  get sessionsEndedCounter() { return sessionsEndedCounter; },
  get sessionDurationHistogram() { return sessionDurationHistogram; },
  get queueWaitHistogram() { return queueWaitHistogram; },
  get ttydSpawnHistogram() { return ttydSpawnHistogram; },
  get invitesValidatedCounter() { return invitesValidatedCounter; },
};
