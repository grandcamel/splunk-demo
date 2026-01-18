#!/usr/bin/env python3
"""
Real-time log generator for Splunk Demo.

Generates realistic log events for different personas:
- DevOps: CI/CD pipelines, deployments, container events
- SRE: Application errors, latency metrics, health checks
- Support: User sessions, tickets, feature usage
- Management: KPIs, compliance, capacity metrics

Sends events to Splunk via HTTP Event Collector (HEC).
"""

import json
import os
import random
import signal
import time
from datetime import datetime
from typing import Any

import requests
from faker import Faker

# Configuration from environment
SPLUNK_HEC_URL = os.environ.get("SPLUNK_HEC_URL", "https://splunk:8088")
SPLUNK_HEC_TOKEN = os.environ.get("SPLUNK_HEC_TOKEN", "demo-hec-token-12345")
EVENTS_PER_MINUTE = int(os.environ.get("EVENTS_PER_MINUTE", "60"))
ANOMALY_RATE = float(os.environ.get("ANOMALY_RATE", "0.05"))  # 5% anomalies
VERIFY_SSL = os.environ.get("VERIFY_SSL", "false").lower() == "true"

# Initialize Faker
fake = Faker()

# Global flag for graceful shutdown
running = True


def signal_handler(signum, frame):
    """Handle shutdown signals."""
    global running
    print("\nShutting down log generator...")
    running = False


signal.signal(signal.SIGINT, signal_handler)
signal.signal(signal.SIGTERM, signal_handler)


# ============================================================================
# Data Templates
# ============================================================================

SERVICES = [
    "api-gateway", "auth-service", "payment-service", "order-service",
    "inventory-service", "notification-service", "user-service", "search-service"
]

REPOSITORIES = [
    "frontend-app", "backend-api", "mobile-ios", "mobile-android",
    "infrastructure", "data-pipeline", "ml-models", "shared-libs"
]

ENVIRONMENTS = ["development", "staging", "production"]

ERROR_TYPES = [
    "NullPointerException", "ConnectionTimeout", "DatabaseError",
    "AuthenticationFailed", "ValidationError", "RateLimitExceeded",
    "ServiceUnavailable", "OutOfMemoryError"
]

ENDPOINTS = [
    "/api/v1/users", "/api/v1/orders", "/api/v1/products",
    "/api/v1/payments", "/api/v1/auth/login", "/api/v1/search",
    "/api/v1/notifications", "/api/v1/inventory"
]

PAGES = [
    "/home", "/products", "/cart", "/checkout", "/account",
    "/orders", "/search", "/help", "/settings"
]

FEATURES = [
    "dark_mode", "quick_checkout", "wishlist", "product_compare",
    "live_chat", "order_tracking", "saved_payments", "notifications"
]

CUSTOMER_TIERS = ["free", "basic", "premium", "enterprise"]

REGIONS = ["us-east", "us-west", "eu-west", "eu-central", "ap-south", "ap-east"]

HOSTS = [f"host-{i:02d}" for i in range(1, 11)]


# ============================================================================
# Event Generators by Index
# ============================================================================

def generate_devops_event() -> dict[str, Any]:
    """Generate DevOps-related events (CI/CD, containers, deployments)."""
    event_type = random.choice(["cicd:pipeline", "container:docker", "container:k8s", "deploy:events", "infra:terraform"])

    if event_type == "cicd:pipeline":
        # CI/CD pipeline events
        is_anomaly = random.random() < ANOMALY_RATE
        status = "failure" if is_anomaly else random.choice(["success", "success", "success", "running"])
        return {
            "index": "demo_devops",
            "sourcetype": "cicd:pipeline",
            "event": {
                "repository": random.choice(REPOSITORIES),
                "branch": random.choice(["main", "develop", f"feature/{fake.slug()}"]),
                "pipeline_id": f"pipeline-{fake.uuid4()[:8]}",
                "stage": random.choice(["build", "test", "deploy", "security-scan"]),
                "status": status,
                "duration_ms": random.randint(5000, 300000) if status != "running" else None,
                "triggered_by": fake.user_name(),
                "commit_sha": fake.sha1()[:7],
                "message": fake.sentence() if status == "failure" else None
            }
        }

    elif event_type == "container:docker":
        # Docker container events
        is_anomaly = random.random() < ANOMALY_RATE
        restart_count = random.randint(5, 20) if is_anomaly else random.randint(0, 2)
        return {
            "index": "demo_devops",
            "sourcetype": "container:docker",
            "event": {
                "container_name": f"{random.choice(SERVICES)}-{random.randint(1,5)}",
                "container_id": fake.uuid4()[:12],
                "image": f"company/{random.choice(SERVICES)}:v{random.randint(1,3)}.{random.randint(0,9)}.{random.randint(0,99)}",
                "status": random.choice(["running", "running", "running", "exited", "restarting"]),
                "restart_count": restart_count,
                "cpu_percent": round(random.uniform(5, 95 if is_anomaly else 60), 1),
                "memory_percent": round(random.uniform(10, 95 if is_anomaly else 70), 1),
                "host": random.choice(HOSTS)
            }
        }

    elif event_type == "container:k8s":
        # Kubernetes events
        return {
            "index": "demo_devops",
            "sourcetype": "container:k8s",
            "event": {
                "namespace": random.choice(["default", "production", "staging", "monitoring"]),
                "pod_name": f"{random.choice(SERVICES)}-{fake.uuid4()[:8]}",
                "event_type": random.choice(["Normal", "Normal", "Normal", "Warning"]),
                "reason": random.choice(["Pulled", "Created", "Started", "Scheduled", "BackOff", "FailedMount"]),
                "message": fake.sentence(),
                "node": f"node-{random.randint(1, 5)}"
            }
        }

    elif event_type == "deploy:events":
        # Deployment events
        is_anomaly = random.random() < ANOMALY_RATE
        return {
            "index": "demo_devops",
            "sourcetype": "deploy:events",
            "event": {
                "service": random.choice(SERVICES),
                "environment": random.choice(ENVIRONMENTS),
                "version": f"v{random.randint(1,3)}.{random.randint(0,9)}.{random.randint(0,99)}",
                "status": "failed" if is_anomaly else random.choice(["success", "success", "success", "in_progress"]),
                "deployed_by": fake.user_name(),
                "deployment_id": f"deploy-{fake.uuid4()[:8]}",
                "rollback": is_anomaly and random.random() < 0.5,
                "duration_s": random.randint(30, 600)
            }
        }

    else:  # infra:terraform
        # Infrastructure changes
        return {
            "index": "demo_devops",
            "sourcetype": "infra:terraform",
            "event": {
                "workspace": random.choice(ENVIRONMENTS),
                "action": random.choice(["apply", "plan", "destroy"]),
                "resource_type": random.choice(["aws_instance", "aws_rds_instance", "aws_s3_bucket", "aws_lambda_function"]),
                "resource_name": fake.slug(),
                "changes": {
                    "add": random.randint(0, 5),
                    "change": random.randint(0, 10),
                    "destroy": random.randint(0, 2)
                },
                "initiated_by": fake.user_name()
            }
        }


def generate_sre_event() -> dict[str, Any]:
    """Generate SRE-related events (errors, latency, health checks)."""
    event_type = random.choice(["app:errors", "metrics:latency", "health:checks", "incident:events", "slo:tracking"])

    if event_type == "app:errors":
        # Application errors
        is_anomaly = random.random() < ANOMALY_RATE
        service = random.choice(SERVICES)
        return {
            "index": "demo_sre",
            "sourcetype": "app:errors",
            "event": {
                "service": service,
                "error_type": random.choice(ERROR_TYPES),
                "severity": "critical" if is_anomaly else random.choice(["warning", "error", "error"]),
                "message": fake.sentence(),
                "stack_trace": f"at {service}.Handler.process({service}.java:{random.randint(50, 500)})\n  at {service}.Service.execute({service}.java:{random.randint(50, 500)})" if random.random() < 0.3 else None,
                "trace_id": f"trace-{fake.uuid4()[:16]}",
                "span_id": f"span-{fake.uuid4()[:8]}",
                "host": random.choice(HOSTS),
                "endpoint": random.choice(ENDPOINTS)
            }
        }

    elif event_type == "metrics:latency":
        # Latency metrics
        is_anomaly = random.random() < ANOMALY_RATE
        base_latency = random.randint(10, 200)
        return {
            "index": "demo_sre",
            "sourcetype": "metrics:latency",
            "event": {
                "service": random.choice(SERVICES),
                "endpoint": random.choice(ENDPOINTS),
                "method": random.choice(["GET", "GET", "GET", "POST", "PUT", "DELETE"]),
                "status_code": random.choice([500, 502, 503]) if is_anomaly else random.choice([200, 200, 200, 201, 204, 400, 404]),
                "duration_ms": base_latency * random.randint(5, 20) if is_anomaly else base_latency,
                "host": random.choice(HOSTS),
                "trace_id": f"trace-{fake.uuid4()[:16]}"
            }
        }

    elif event_type == "health:checks":
        # Health check events
        is_anomaly = random.random() < ANOMALY_RATE
        return {
            "index": "demo_sre",
            "sourcetype": "health:checks",
            "event": {
                "service": random.choice(SERVICES),
                "check_type": random.choice(["liveness", "readiness", "startup"]),
                "status": "unhealthy" if is_anomaly else "healthy",
                "response_time_ms": random.randint(100, 5000) if is_anomaly else random.randint(1, 100),
                "consecutive_failures": random.randint(3, 10) if is_anomaly else 0,
                "host": random.choice(HOSTS)
            }
        }

    elif event_type == "incident:events":
        # Incident/alert events (less frequent)
        if random.random() > 0.1:  # Only 10% chance to generate
            return generate_sre_event()  # Generate different event type
        return {
            "index": "demo_sre",
            "sourcetype": "incident:events",
            "event": {
                "incident_id": f"INC-{random.randint(1000, 9999)}",
                "severity": random.choice(["P1", "P2", "P3", "P4"]),
                "status": random.choice(["triggered", "acknowledged", "resolved"]),
                "title": f"High {random.choice(['error rate', 'latency', 'CPU usage', 'memory usage'])} on {random.choice(SERVICES)}",
                "service": random.choice(SERVICES),
                "assigned_to": fake.user_name(),
                "duration_min": random.randint(5, 120)
            }
        }

    else:  # slo:tracking
        # SLO tracking metrics
        is_anomaly = random.random() < ANOMALY_RATE
        target = 99.9
        return {
            "index": "demo_sre",
            "sourcetype": "slo:tracking",
            "event": {
                "service": random.choice(SERVICES),
                "slo_name": random.choice(["availability", "latency_p99", "error_rate"]),
                "target": target,
                "actual": round(target - random.uniform(1, 5), 2) if is_anomaly else round(target + random.uniform(-0.5, 0.5), 2),
                "budget_remaining_percent": round(random.uniform(0, 30), 1) if is_anomaly else round(random.uniform(50, 100), 1),
                "window": "30d"
            }
        }


def generate_support_event() -> dict[str, Any]:
    """Generate Support-related events (sessions, tickets, user errors)."""
    event_type = random.choice(["session:trace", "ticket:events", "error:user", "feature:usage"])

    customer_id = f"cust_{random.randint(100, 999)}"
    session_id = f"sess_{fake.uuid4()[:12]}"

    if event_type == "session:trace":
        # User session activity
        return {
            "index": "demo_support",
            "sourcetype": "session:trace",
            "event": {
                "session_id": session_id,
                "user_id": customer_id,
                "customer_tier": random.choice(CUSTOMER_TIERS),
                "page": random.choice(PAGES),
                "action": random.choice(["view", "click", "scroll", "form_submit", "search"]),
                "element": fake.slug() if random.random() < 0.5 else None,
                "duration_ms": random.randint(100, 30000),
                "referrer": random.choice(PAGES + [None]),
                "device": random.choice(["desktop", "mobile", "tablet"]),
                "browser": random.choice(["Chrome", "Firefox", "Safari", "Edge"])
            }
        }

    elif event_type == "ticket:events":
        # Support ticket events (less frequent)
        if random.random() > 0.2:  # Only 20% chance
            return generate_support_event()
        return {
            "index": "demo_support",
            "sourcetype": "ticket:events",
            "event": {
                "ticket_id": f"TKT-{random.randint(10000, 99999)}",
                "customer_id": customer_id,
                "customer_tier": random.choice(CUSTOMER_TIERS),
                "status": random.choice(["new", "open", "pending", "resolved", "closed"]),
                "priority": random.choice(["low", "medium", "high", "urgent"]),
                "category": random.choice(["billing", "technical", "account", "feature_request", "bug_report"]),
                "subject": fake.sentence(),
                "assigned_to": fake.user_name() if random.random() < 0.7 else None,
                "response_time_min": random.randint(5, 480)
            }
        }

    elif event_type == "error:user":
        # User-facing errors
        is_anomaly = random.random() < ANOMALY_RATE
        return {
            "index": "demo_support",
            "sourcetype": "error:user",
            "event": {
                "session_id": session_id,
                "user_id": customer_id,
                "customer_tier": random.choice(CUSTOMER_TIERS),
                "error_code": random.choice(["E001", "E002", "E003", "E004", "E005"]),
                "error_message": random.choice([
                    "Payment processing failed",
                    "Session expired",
                    "Invalid input",
                    "Feature not available",
                    "Service temporarily unavailable"
                ]),
                "page": random.choice(PAGES),
                "is_blocking": is_anomaly,
                "retry_count": random.randint(0, 5)
            }
        }

    else:  # feature:usage
        # Feature usage analytics
        return {
            "index": "demo_support",
            "sourcetype": "feature:usage",
            "event": {
                "user_id": customer_id,
                "customer_tier": random.choice(CUSTOMER_TIERS),
                "feature": random.choice(FEATURES),
                "action": random.choice(["enabled", "disabled", "used"]),
                "success": random.random() > 0.1,
                "session_id": session_id
            }
        }


def generate_business_event() -> dict[str, Any]:
    """Generate Business/Management events (KPIs, compliance, capacity)."""
    event_type = random.choice(["kpi:revenue", "kpi:conversion", "compliance:audit", "capacity:metrics", "sla:tracking"])

    if event_type == "kpi:revenue":
        # Revenue metrics
        region = random.choice(REGIONS)
        base_value = random.randint(10000, 100000)
        return {
            "index": "demo_business",
            "sourcetype": "kpi:revenue",
            "event": {
                "region": region,
                "product_line": random.choice(["enterprise", "professional", "starter", "add-ons"]),
                "period": datetime.now().strftime("%Y-%m-%d"),
                "value": base_value,
                "target": int(base_value * random.uniform(0.9, 1.1)),
                "currency": "USD",
                "transaction_count": random.randint(50, 500)
            }
        }

    elif event_type == "kpi:conversion":
        # Conversion funnel metrics
        return {
            "index": "demo_business",
            "sourcetype": "kpi:conversion",
            "event": {
                "funnel_stage": random.choice(["visit", "signup", "trial", "purchase", "renewal"]),
                "source": random.choice(["organic", "paid", "referral", "direct", "social"]),
                "count": random.randint(100, 10000),
                "conversion_rate": round(random.uniform(0.5, 15.0), 2),
                "period": datetime.now().strftime("%Y-%m-%d")
            }
        }

    elif event_type == "compliance:audit":
        # Audit trail events (less frequent)
        if random.random() > 0.3:  # Only 30% chance
            return generate_business_event()
        return {
            "index": "demo_business",
            "sourcetype": "compliance:audit",
            "event": {
                "user": fake.user_name(),
                "action": random.choice(["login", "logout", "config_change", "data_export", "user_create", "permission_change"]),
                "resource": random.choice(["system_config", "user_data", "reports", "api_keys", "integrations"]),
                "ip_address": fake.ipv4(),
                "user_agent": fake.user_agent(),
                "result": random.choice(["success", "success", "success", "denied", "failed"]),
                "details": fake.sentence()
            }
        }

    elif event_type == "capacity:metrics":
        # Capacity/resource metrics
        is_anomaly = random.random() < ANOMALY_RATE
        return {
            "index": "demo_business",
            "sourcetype": "capacity:metrics",
            "event": {
                "host": random.choice(HOSTS),
                "region": random.choice(REGIONS),
                "cpu_percent": round(random.uniform(70, 95) if is_anomaly else random.uniform(20, 60), 1),
                "memory_percent": round(random.uniform(75, 95) if is_anomaly else random.uniform(30, 65), 1),
                "disk_percent": round(random.uniform(80, 98) if is_anomaly else random.uniform(40, 70), 1),
                "network_in_mbps": round(random.uniform(50, 200), 1),
                "network_out_mbps": round(random.uniform(30, 150), 1),
                "active_connections": random.randint(100, 5000)
            }
        }

    else:  # sla:tracking
        # SLA compliance tracking
        is_anomaly = random.random() < ANOMALY_RATE
        return {
            "index": "demo_business",
            "sourcetype": "sla:tracking",
            "event": {
                "service": random.choice(SERVICES),
                "customer_tier": random.choice(["enterprise", "premium"]),
                "sla_type": random.choice(["uptime", "response_time", "resolution_time"]),
                "target": 99.9,
                "actual": round(99.9 - random.uniform(0.5, 3.0), 2) if is_anomaly else round(random.uniform(99.5, 100.0), 2),
                "breached": is_anomaly,
                "period": datetime.now().strftime("%Y-%m-%d")
            }
        }


def generate_main_event() -> dict[str, Any]:
    """Generate general application log events."""
    levels = ["DEBUG", "INFO", "INFO", "INFO", "WARN", "ERROR"]
    is_anomaly = random.random() < ANOMALY_RATE

    return {
        "index": "demo_main",
        "sourcetype": "app:logs",
        "event": {
            "level": "ERROR" if is_anomaly else random.choice(levels),
            "service": random.choice(SERVICES),
            "message": fake.sentence(),
            "logger": f"com.company.{random.choice(SERVICES).replace('-', '.')}.{fake.word().capitalize()}",
            "thread": f"thread-{random.randint(1, 20)}",
            "host": random.choice(HOSTS),
            "trace_id": f"trace-{fake.uuid4()[:16]}" if random.random() < 0.3 else None
        }
    }


# ============================================================================
# HEC Sender
# ============================================================================

def send_to_hec(events: list[dict[str, Any]]) -> bool:
    """Send events to Splunk HEC."""
    url = f"{SPLUNK_HEC_URL}/services/collector/event"
    headers = {
        "Authorization": f"Splunk {SPLUNK_HEC_TOKEN}",
        "Content-Type": "application/json"
    }

    # Format events for HEC
    payload = ""
    for event_data in events:
        hec_event = {
            "index": event_data["index"],
            "sourcetype": event_data["sourcetype"],
            "time": time.time(),
            "host": event_data["event"].get("host", "log-generator"),
            "event": event_data["event"]
        }
        payload += json.dumps(hec_event) + "\n"

    try:
        response = requests.post(
            url,
            headers=headers,
            data=payload,
            verify=VERIFY_SSL,
            timeout=10
        )
        if response.status_code == 200:
            return True
        else:
            print(f"HEC error: {response.status_code} - {response.text}")
            return False
    except requests.exceptions.RequestException as e:
        print(f"HEC connection error: {e}")
        return False


# ============================================================================
# Main Loop
# ============================================================================

def main():
    """Main event generation loop."""
    print("Starting log generator...")
    print(f"  HEC URL: {SPLUNK_HEC_URL}")
    print(f"  Events/min: {EVENTS_PER_MINUTE}")
    print(f"  Anomaly rate: {ANOMALY_RATE * 100}%")

    # Wait for Splunk to be ready
    print("Waiting for Splunk HEC to be available...")
    retries = 0
    max_retries = 60
    while retries < max_retries:
        try:
            response = requests.get(
                f"{SPLUNK_HEC_URL}/services/collector/health",
                headers={"Authorization": f"Splunk {SPLUNK_HEC_TOKEN}"},
                verify=VERIFY_SSL,
                timeout=5
            )
            if response.status_code == 200:
                print("Splunk HEC is ready!")
                break
        except requests.exceptions.RequestException:
            pass
        retries += 1
        time.sleep(5)
    else:
        print("Warning: Could not verify HEC availability, proceeding anyway...")

    # Event generators with weights
    generators = [
        (generate_devops_event, 0.20),   # 20% DevOps
        (generate_sre_event, 0.25),      # 25% SRE
        (generate_support_event, 0.25),  # 25% Support
        (generate_business_event, 0.15), # 15% Business
        (generate_main_event, 0.15),     # 15% General
    ]

    # Calculate sleep interval
    events_per_second = EVENTS_PER_MINUTE / 60
    batch_size = max(1, int(events_per_second))
    sleep_interval = batch_size / events_per_second

    event_count = 0
    error_count = 0
    start_time = time.time()

    print(f"Generating {batch_size} events every {sleep_interval:.2f}s")
    print("-" * 50)

    while running:
        # Generate batch of events
        events = []
        for _ in range(batch_size):
            # Select generator based on weights
            r = random.random()
            cumulative = 0
            for generator, weight in generators:
                cumulative += weight
                if r < cumulative:
                    events.append(generator())
                    break

        # Send to HEC
        if send_to_hec(events):
            event_count += len(events)
        else:
            error_count += 1

        # Progress output every 100 events
        if event_count % 100 < batch_size:
            elapsed = time.time() - start_time
            rate = event_count / elapsed if elapsed > 0 else 0
            print(f"Events: {event_count:,} | Rate: {rate:.1f}/s | Errors: {error_count}")

        time.sleep(sleep_interval)

    print(f"\nShutdown complete. Total events: {event_count:,}")


if __name__ == "__main__":
    main()
