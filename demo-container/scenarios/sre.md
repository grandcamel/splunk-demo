# SRE / On-Call Scenarios

Investigate production issues, analyze error patterns, and monitor service health.

## Getting Started

Try these prompts:

### Error Investigation

```
Show me the top errors across all services in the last hour
```

```
What's causing the spike in 500 errors?
```

### Latency Analysis

```
Which endpoints have P99 latency above 500ms?
```

```
Show latency trends for the payment service over the past hour
```

### Incident Correlation

```
Find all events related to the payment service in the last 30 minutes
```

```
Trace the request path for trace_id xyz789
```

### Service Health

```
Show health check failures by service
```

```
Which services are currently degraded?
```

## Key Index

- `demo_sre` - Errors, metrics, health checks

## Sourcetypes

| Sourcetype | Description |
|------------|-------------|
| `app:errors` | Application errors with stack traces |
| `metrics:latency` | Response time metrics |
| `health:checks` | Service health endpoint events |
| `incident:events` | PagerDuty-style alerts |
| `slo:tracking` | SLO/SLA metrics |

## Useful SPL Patterns

```spl
# Top errors by service
index=demo_sre sourcetype=app:errors
| stats count by service, error_type
| sort -count
| head 20

# P99 latency by endpoint
index=demo_sre sourcetype=metrics:latency
| stats perc99(duration_ms) as p99 by endpoint
| where p99 > 500
| sort -p99

# Error rate trend with anomaly detection
index=demo_sre sourcetype=app:errors
| timechart span=5m count as errors
| streamstats avg(errors) as avg_errors window=12
| eval anomaly=if(errors > avg_errors*2, "HIGH", "normal")

# Trace correlation
index=demo_sre trace_id="xyz789"
| sort _time
| table _time service span_id duration_ms status
```

## Pre-Built Searches

- **SRE - Top Errors by Service**
- **SRE - P99 Latency by Endpoint**
- **SRE - Service Health Status**
- **SRE - Error Rate Trend**

## Active Alerts

The demo has pre-configured alerts that fire during anomaly injection:

- **Alert - High Error Rate** (triggers when errors > 100 in 5 min)
- **Alert - Failed Deployment** (triggers on production failures)

View triggered alerts at `/webhooks/` in your browser.
