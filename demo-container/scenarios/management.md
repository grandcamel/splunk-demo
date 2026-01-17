# Management / Analytics Scenarios

Track KPIs, compliance, and capacity planning metrics.

## Getting Started

Try these prompts:

### Revenue Analysis

```
Show daily revenue trends for the past week by region
```

```
What's our month-over-month revenue growth?
```

### Compliance Reporting

```
Generate an audit report of admin actions this month
```

```
Show all privileged operations in the last 24 hours
```

### Capacity Planning

```
Show resource utilization trends and identify hosts at capacity
```

```
Predict when we'll need to scale based on growth rate
```

### SLA Tracking

```
What's our SLA compliance percentage this week?
```

```
Show services that breached SLA targets
```

## Key Index

- `demo_business` - KPIs, compliance, capacity

## Sourcetypes

| Sourcetype | Description |
|------------|-------------|
| `kpi:revenue` | Revenue metrics by region/product |
| `kpi:conversion` | Conversion funnel metrics |
| `compliance:audit` | Admin action audit trail |
| `capacity:metrics` | Resource utilization |
| `sla:tracking` | SLA compliance events |

## Useful SPL Patterns

```spl
# Daily revenue by region
index=demo_business sourcetype=kpi:revenue
| timechart span=1d sum(value) as revenue by region

# Revenue variance vs target
index=demo_business sourcetype=kpi:revenue
| stats sum(value) as actual, sum(target) as target by period
| eval variance_pct=round((actual-target)/target*100, 1)

# Admin audit trail
index=demo_business sourcetype=compliance:audit
| stats count by user, action, resource
| sort -count

# Capacity utilization
index=demo_business sourcetype=capacity:metrics
| stats avg(cpu_percent) as cpu, avg(memory_percent) as memory by host
| eval status=if(cpu>80 OR memory>80, "HIGH", "Normal")
| sort -cpu
```

## Pre-Built Searches

- **Management - Daily Revenue Trend**
- **Management - Compliance Audit Trail**
- **Management - Capacity Utilization**

## Dashboard Tips

For executive dashboards, use:

1. **Timecharts** for trend visualization
2. **Single value panels** for KPIs
3. **Tables** for top N analysis
4. **Maps** for geographic data

Access Splunk Web at `/splunk/` to build custom dashboards.
