#!/usr/bin/env python3
"""
Splunk Demo Data Seeder.

Seeds historical data into Splunk for the demo environment.
Creates 7 days of realistic log data across all indexes.

This runs once at startup to populate initial data, then exits.
"""

import json
import os
import random
import sys
import time
from datetime import datetime, timedelta
from typing import Any

import requests
from faker import Faker

# Configuration from environment
SPLUNK_HEC_URL = os.environ.get("SPLUNK_HEC_URL", "https://splunk:8088")
SPLUNK_HEC_TOKEN = os.environ.get("SPLUNK_HEC_TOKEN", "demo-hec-token-12345")
DAYS_TO_SEED = int(os.environ.get("DAYS_TO_SEED", "7"))
EVENTS_PER_DAY = int(os.environ.get("EVENTS_PER_DAY", "50000"))  # ~350K total for 7 days
VERIFY_SSL = os.environ.get("VERIFY_SSL", "false").lower() == "true"
BATCH_SIZE = int(os.environ.get("BATCH_SIZE", "500"))

# Initialize Faker
fake = Faker()

# ============================================================================
# Data Templates (shared with generator.py)
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
# Historical Event Generators
# ============================================================================

def generate_historical_event(timestamp: float, anomaly_window: bool = False) -> dict[str, Any]:
    """Generate a random event with a specific timestamp."""
    # Higher anomaly rate during anomaly windows
    anomaly_rate = 0.30 if anomaly_window else 0.03

    # Select event type with weights
    event_types = [
        ("devops", 0.20),
        ("sre", 0.25),
        ("support", 0.25),
        ("business", 0.15),
        ("main", 0.15),
    ]

    r = random.random()
    cumulative = 0
    event_type = "main"
    for et, weight in event_types:
        cumulative += weight
        if r < cumulative:
            event_type = et
            break

    is_anomaly = random.random() < anomaly_rate

    if event_type == "devops":
        return generate_devops_event(timestamp, is_anomaly)
    elif event_type == "sre":
        return generate_sre_event(timestamp, is_anomaly)
    elif event_type == "support":
        return generate_support_event(timestamp, is_anomaly)
    elif event_type == "business":
        return generate_business_event(timestamp, is_anomaly)
    else:
        return generate_main_event(timestamp, is_anomaly)


def generate_devops_event(timestamp: float, is_anomaly: bool) -> dict[str, Any]:
    """Generate DevOps event."""
    sourcetype = random.choice(["cicd:pipeline", "container:docker", "deploy:events"])

    if sourcetype == "cicd:pipeline":
        status = "failure" if is_anomaly else random.choice(["success", "success", "success", "running"])
        return {
            "index": "demo_devops",
            "sourcetype": sourcetype,
            "time": timestamp,
            "event": {
                "repository": random.choice(REPOSITORIES),
                "branch": random.choice(["main", "develop", f"feature/{fake.slug()}"]),
                "pipeline_id": f"pipeline-{fake.uuid4()[:8]}",
                "stage": random.choice(["build", "test", "deploy", "security-scan"]),
                "status": status,
                "duration_ms": random.randint(5000, 300000) if status != "running" else None,
                "triggered_by": fake.user_name(),
                "commit_sha": fake.sha1()[:7]
            }
        }

    elif sourcetype == "container:docker":
        restart_count = random.randint(5, 20) if is_anomaly else random.randint(0, 2)
        return {
            "index": "demo_devops",
            "sourcetype": sourcetype,
            "time": timestamp,
            "event": {
                "container_name": f"{random.choice(SERVICES)}-{random.randint(1,5)}",
                "container_id": fake.uuid4()[:12],
                "image": f"company/{random.choice(SERVICES)}:v{random.randint(1,3)}.{random.randint(0,9)}.{random.randint(0,99)}",
                "status": "restarting" if is_anomaly else random.choice(["running", "running", "running", "exited"]),
                "restart_count": restart_count,
                "cpu_percent": round(random.uniform(70, 95) if is_anomaly else random.uniform(5, 60), 1),
                "memory_percent": round(random.uniform(75, 95) if is_anomaly else random.uniform(10, 70), 1),
                "host": random.choice(HOSTS)
            }
        }

    else:  # deploy:events
        return {
            "index": "demo_devops",
            "sourcetype": sourcetype,
            "time": timestamp,
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


def generate_sre_event(timestamp: float, is_anomaly: bool) -> dict[str, Any]:
    """Generate SRE event."""
    sourcetype = random.choice(["app:errors", "metrics:latency", "health:checks"])

    if sourcetype == "app:errors":
        service = random.choice(SERVICES)
        return {
            "index": "demo_sre",
            "sourcetype": sourcetype,
            "time": timestamp,
            "event": {
                "service": service,
                "error_type": random.choice(ERROR_TYPES),
                "severity": "critical" if is_anomaly else random.choice(["warning", "error", "error"]),
                "message": fake.sentence(),
                "trace_id": f"trace-{fake.uuid4()[:16]}",
                "span_id": f"span-{fake.uuid4()[:8]}",
                "host": random.choice(HOSTS),
                "endpoint": random.choice(ENDPOINTS)
            }
        }

    elif sourcetype == "metrics:latency":
        base_latency = random.randint(10, 200)
        return {
            "index": "demo_sre",
            "sourcetype": sourcetype,
            "time": timestamp,
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

    else:  # health:checks
        return {
            "index": "demo_sre",
            "sourcetype": sourcetype,
            "time": timestamp,
            "event": {
                "service": random.choice(SERVICES),
                "check_type": random.choice(["liveness", "readiness", "startup"]),
                "status": "unhealthy" if is_anomaly else "healthy",
                "response_time_ms": random.randint(100, 5000) if is_anomaly else random.randint(1, 100),
                "consecutive_failures": random.randint(3, 10) if is_anomaly else 0,
                "host": random.choice(HOSTS)
            }
        }


def generate_support_event(timestamp: float, is_anomaly: bool) -> dict[str, Any]:
    """Generate Support event."""
    sourcetype = random.choice(["session:trace", "error:user", "feature:usage"])

    customer_id = f"cust_{random.randint(100, 999)}"
    session_id = f"sess_{fake.uuid4()[:12]}"

    if sourcetype == "session:trace":
        return {
            "index": "demo_support",
            "sourcetype": sourcetype,
            "time": timestamp,
            "event": {
                "session_id": session_id,
                "user_id": customer_id,
                "customer_tier": random.choice(CUSTOMER_TIERS),
                "page": random.choice(PAGES),
                "action": random.choice(["view", "click", "scroll", "form_submit", "search"]),
                "element": fake.slug() if random.random() < 0.5 else None,
                "duration_ms": random.randint(100, 30000),
                "device": random.choice(["desktop", "mobile", "tablet"]),
                "browser": random.choice(["Chrome", "Firefox", "Safari", "Edge"])
            }
        }

    elif sourcetype == "error:user":
        return {
            "index": "demo_support",
            "sourcetype": sourcetype,
            "time": timestamp,
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
        return {
            "index": "demo_support",
            "sourcetype": sourcetype,
            "time": timestamp,
            "event": {
                "user_id": customer_id,
                "customer_tier": random.choice(CUSTOMER_TIERS),
                "feature": random.choice(FEATURES),
                "action": random.choice(["enabled", "disabled", "used"]),
                "success": random.random() > 0.1,
                "session_id": session_id
            }
        }


def generate_business_event(timestamp: float, is_anomaly: bool) -> dict[str, Any]:
    """Generate Business event."""
    sourcetype = random.choice(["kpi:revenue", "compliance:audit", "capacity:metrics"])

    if sourcetype == "kpi:revenue":
        region = random.choice(REGIONS)
        base_value = random.randint(10000, 100000)
        event_date = datetime.fromtimestamp(timestamp)
        return {
            "index": "demo_business",
            "sourcetype": sourcetype,
            "time": timestamp,
            "event": {
                "region": region,
                "product_line": random.choice(["enterprise", "professional", "starter", "add-ons"]),
                "period": event_date.strftime("%Y-%m-%d"),
                "value": base_value,
                "target": int(base_value * random.uniform(0.9, 1.1)),
                "currency": "USD",
                "transaction_count": random.randint(50, 500)
            }
        }

    elif sourcetype == "compliance:audit":
        return {
            "index": "demo_business",
            "sourcetype": sourcetype,
            "time": timestamp,
            "event": {
                "user": fake.user_name(),
                "action": random.choice(["login", "logout", "config_change", "data_export", "user_create", "permission_change"]),
                "resource": random.choice(["system_config", "user_data", "reports", "api_keys", "integrations"]),
                "ip_address": fake.ipv4(),
                "user_agent": fake.user_agent(),
                "result": "denied" if is_anomaly else random.choice(["success", "success", "success", "failed"]),
                "details": fake.sentence()
            }
        }

    else:  # capacity:metrics
        return {
            "index": "demo_business",
            "sourcetype": sourcetype,
            "time": timestamp,
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


def generate_main_event(timestamp: float, is_anomaly: bool) -> dict[str, Any]:
    """Generate general application log event."""
    levels = ["DEBUG", "INFO", "INFO", "INFO", "WARN", "ERROR"]

    return {
        "index": "demo_main",
        "sourcetype": "app:logs",
        "time": timestamp,
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
            "time": event_data["time"],
            "host": event_data["event"].get("host", "seed-data"),
            "event": event_data["event"]
        }
        payload += json.dumps(hec_event) + "\n"

    try:
        response = requests.post(
            url,
            headers=headers,
            data=payload,
            verify=VERIFY_SSL,
            timeout=30
        )
        if response.status_code == 200:
            return True
        else:
            print(f"HEC error: {response.status_code} - {response.text}")
            return False
    except requests.exceptions.RequestException as e:
        print(f"HEC connection error: {e}")
        return False


def wait_for_splunk():
    """Wait for Splunk HEC to be available."""
    print("Waiting for Splunk HEC to be available...")
    retries = 0
    max_retries = 120  # 10 minutes

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
                return True
        except requests.exceptions.RequestException:
            pass
        retries += 1
        if retries % 12 == 0:  # Every minute
            print(f"  Still waiting... ({retries * 5}s)")
        time.sleep(5)

    print("ERROR: Splunk HEC not available after 10 minutes")
    return False


# ============================================================================
# Main Seeding Logic
# ============================================================================

def seed_historical_data():
    """Seed historical data into Splunk."""
    print("=" * 60)
    print("Splunk Demo Data Seeder")
    print("=" * 60)
    print(f"  HEC URL: {SPLUNK_HEC_URL}")
    print(f"  Days to seed: {DAYS_TO_SEED}")
    print(f"  Events per day: {EVENTS_PER_DAY:,}")
    print(f"  Total events: {DAYS_TO_SEED * EVENTS_PER_DAY:,}")
    print(f"  Batch size: {BATCH_SIZE}")
    print("=" * 60)

    if not wait_for_splunk():
        sys.exit(1)

    # Calculate time range
    now = datetime.now()
    start_time = now - timedelta(days=DAYS_TO_SEED)

    # Define anomaly windows (simulate past incidents)
    # 2-3 hour windows on different days
    anomaly_windows = []
    for day in range(1, DAYS_TO_SEED):
        if random.random() < 0.3:  # 30% chance of anomaly window per day
            window_start = start_time + timedelta(days=day, hours=random.randint(8, 18))
            window_end = window_start + timedelta(hours=random.randint(1, 3))
            anomaly_windows.append((window_start.timestamp(), window_end.timestamp()))
            print(f"Anomaly window: {window_start.strftime('%Y-%m-%d %H:%M')} - {window_end.strftime('%H:%M')}")

    total_events = 0
    error_count = 0
    start = time.time()

    for day in range(DAYS_TO_SEED):
        day_start = start_time + timedelta(days=day)

        print(f"\nSeeding day {day + 1}/{DAYS_TO_SEED}: {day_start.strftime('%Y-%m-%d')}")

        # Generate timestamps for this day (distributed throughout the day)
        # More events during business hours
        timestamps = []
        for _ in range(EVENTS_PER_DAY):
            hour = random.gauss(14, 4)  # Peak around 2 PM
            hour = max(0, min(23, int(hour)))
            minute = random.randint(0, 59)
            second = random.randint(0, 59)
            ts = day_start.replace(hour=hour, minute=minute, second=second)
            timestamps.append(ts.timestamp())

        timestamps.sort()

        # Generate and send events in batches
        batch = []
        day_events = 0

        for ts in timestamps:
            # Check if timestamp is in anomaly window
            in_anomaly = any(start <= ts <= end for start, end in anomaly_windows)

            event = generate_historical_event(ts, in_anomaly)
            batch.append(event)

            if len(batch) >= BATCH_SIZE:
                if send_to_hec(batch):
                    total_events += len(batch)
                    day_events += len(batch)
                else:
                    error_count += 1

                batch = []

                # Progress indicator
                if day_events % 10000 == 0:
                    elapsed = time.time() - start
                    rate = total_events / elapsed if elapsed > 0 else 0
                    print(f"  Progress: {day_events:,}/{EVENTS_PER_DAY:,} | Total: {total_events:,} | Rate: {rate:.0f}/s")

        # Send remaining batch
        if batch:
            if send_to_hec(batch):
                total_events += len(batch)
            else:
                error_count += 1

    # Final summary
    elapsed = time.time() - start
    print("\n" + "=" * 60)
    print("Seeding Complete!")
    print("=" * 60)
    print(f"  Total events: {total_events:,}")
    print(f"  Errors: {error_count}")
    print(f"  Duration: {elapsed/60:.1f} minutes")
    print(f"  Rate: {total_events/elapsed:.0f} events/second")
    print("=" * 60)


if __name__ == "__main__":
    seed_historical_data()
