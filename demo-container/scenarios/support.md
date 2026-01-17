# Support Engineer Scenarios

Investigate customer issues, track sessions, and analyze user-facing errors.

## Getting Started

Try these prompts:

### Customer Lookup

```
Show all activity for customer cust_456 in the past 24 hours
```

```
What pages did session sess_abc123 visit?
```

### Error Tracking

```
What errors are customers seeing on the checkout page?
```

```
Show user-facing errors by customer tier
```

### Session Analysis

```
Show the complete session trace for session_id sess_abc123
```

```
Find sessions with unusually high error counts
```

### Feature Usage

```
Which features are most used by enterprise customers?
```

```
Show feature adoption trends over the past week
```

## Key Index

- `demo_support` - Sessions, tickets, user errors

## Sourcetypes

| Sourcetype | Description |
|------------|-------------|
| `session:trace` | User session activity logs |
| `ticket:events` | Support ticket events |
| `error:user` | User-facing errors |
| `feature:usage` | Product analytics |

## Useful SPL Patterns

```spl
# Customer activity summary
index=demo_support sourcetype=session:trace user_id="cust_456"
| stats values(page) as pages, sum(duration_ms) as total_time, count as actions
| eval session_duration_min=round(total_time/60000, 1)

# Session trace
index=demo_support sourcetype=session:trace session_id="sess_abc123"
| sort _time
| table _time page action element duration_ms

# User-facing errors by page
index=demo_support sourcetype=error:user
| stats count by error_code, page, customer_tier
| sort -count

# Feature usage by tier
index=demo_support sourcetype=feature:usage
| stats count by feature, customer_tier
| xyseries feature customer_tier count
```

## Pre-Built Searches

- **Support - Customer Session Lookup**
- **Support - User-Facing Errors**
- **Support - Feature Usage by Tier**

## Tips for Support

1. **Start with the session ID** - Customer tickets usually include a session ID
2. **Check the timeline** - Sort events by `_time` to see the user's journey
3. **Look for errors** - Filter by `error` or `exception` keywords
4. **Check customer tier** - Enterprise customers may have different feature access
