"""Shared data templates for Splunk event generation."""

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
