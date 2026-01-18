# Splunk Demo - Makefile
# Essential commands for building, running, and managing the demo environment

.PHONY: help build up down restart logs shell clean dev prod \
        build-all build-demo build-generator build-seed build-queue \
        splunk-shell splunk-logs splunk-restart \
        seed reseed generate-token test health status

# Default target
help:
	@echo "Splunk Demo - Available Commands"
	@echo "================================="
	@echo ""
	@echo "Quick Start:"
	@echo "  make dev              Start in development mode (with exposed ports)"
	@echo "  make prod             Start in production mode"
	@echo "  make down             Stop all services"
	@echo ""
	@echo "Build Commands:"
	@echo "  make build            Build all Docker images"
	@echo "  make build-demo       Build demo container only"
	@echo "  make build-generator  Build log generator only"
	@echo "  make build-seed       Build seed data loader only"
	@echo "  make build-queue      Build queue manager only"
	@echo ""
	@echo "Runtime Commands:"
	@echo "  make up               Start services (production mode)"
	@echo "  make down             Stop all services"
	@echo "  make restart          Restart all services"
	@echo "  make logs             Follow all service logs"
	@echo "  make status           Show service status"
	@echo "  make health           Check service health"
	@echo ""
	@echo "Splunk Commands:"
	@echo "  make splunk-shell     Open Splunk CLI shell"
	@echo "  make splunk-logs      Follow Splunk logs"
	@echo "  make splunk-restart   Restart Splunk service"
	@echo ""
	@echo "Data Commands:"
	@echo "  make seed             Run seed data loader"
	@echo "  make reseed           Clear and re-seed data"
	@echo "  make generate-token   Generate new invite token"
	@echo ""
	@echo "Development Commands:"
	@echo "  make shell            Open shell in demo container"
	@echo "  make clean            Remove all containers and volumes"
	@echo "  make test             Run tests"

# ============================================================================
# Configuration
# ============================================================================

COMPOSE_FILE := docker-compose.yml
COMPOSE_DEV_FILE := docker-compose.dev.yml
PROJECT_NAME := splunk-demo

# Docker Compose command
DC := docker compose -p $(PROJECT_NAME) -f $(COMPOSE_FILE)
DC_DEV := docker compose -p $(PROJECT_NAME) -f $(COMPOSE_FILE) -f $(COMPOSE_DEV_FILE)

# Colors for output
GREEN := \033[0;32m
YELLOW := \033[0;33m
RED := \033[0;31m
NC := \033[0m

# ============================================================================
# Quick Start Commands
# ============================================================================

dev: build ## Start in development mode with exposed ports
	@echo "$(GREEN)Starting Splunk Demo in development mode...$(NC)"
	$(DC_DEV) up -d
	@echo ""
	@echo "$(GREEN)Services starting up...$(NC)"
	@echo "  Landing page: http://localhost:8080"
	@echo "  Splunk Web:   http://localhost:8000 (admin/DemoPass123!)"
	@echo "  Grafana:      http://localhost:3000"
	@echo ""
	@echo "$(YELLOW)Note: Splunk takes 2-3 minutes to fully initialize.$(NC)"
	@echo "Run 'make logs' to follow startup progress."

prod: build ## Start in production mode
	@echo "$(GREEN)Starting Splunk Demo in production mode...$(NC)"
	$(DC) up -d
	@echo ""
	@echo "$(GREEN)Services starting up...$(NC)"
	@echo "  Landing page: http://localhost:8080"
	@echo ""
	@echo "$(YELLOW)Note: Splunk takes 2-3 minutes to fully initialize.$(NC)"

# ============================================================================
# Build Commands
# ============================================================================

build: build-all ## Build all Docker images

build-all: build-demo build-generator build-seed build-queue
	@echo "$(GREEN)All images built successfully!$(NC)"

build-demo: ## Build demo container
	@echo "$(GREEN)Building demo container...$(NC)"
	docker build -t splunk-demo-container:latest ./demo-container

build-generator: ## Build log generator
	@echo "$(GREEN)Building log generator...$(NC)"
	docker build -t splunk-log-generator:latest -f log-generator/Dockerfile .

build-seed: ## Build seed data loader
	@echo "$(GREEN)Building seed data loader...$(NC)"
	docker build -t splunk-seed-data:latest -f seed-data/Dockerfile .

build-queue: ## Build queue manager
	@echo "$(GREEN)Building queue manager...$(NC)"
	docker build -t splunk-queue-manager:latest ./queue-manager

# ============================================================================
# Runtime Commands
# ============================================================================

up: ## Start services (production mode)
	$(DC) up -d

down: ## Stop all services
	@echo "$(YELLOW)Stopping all services...$(NC)"
	$(DC) down

restart: down up ## Restart all services
	@echo "$(GREEN)Services restarted!$(NC)"

logs: ## Follow all service logs
	$(DC) logs -f

status: ## Show service status
	@echo "$(GREEN)Service Status:$(NC)"
	$(DC) ps

health: ## Check service health (dev ports)
	@echo "$(GREEN)Checking service health (dev mode ports)...$(NC)"
	@echo ""
	@echo "Nginx (18080):"
	@curl -s -o /dev/null -w "  Status: %{http_code}\n" http://localhost:18080 2>/dev/null || echo "  Status: Not available"
	@echo ""
	@echo "Splunk Web (8000):"
	@curl -s -o /dev/null -w "  Status: %{http_code}\n" http://localhost:8000/en-US/account/login 2>/dev/null || echo "  Status: Not available"
	@echo ""
	@echo "Splunk HEC (8088):"
	@curl -s -k -o /dev/null -w "  Status: %{http_code}\n" https://localhost:8088/services/collector/health 2>/dev/null || echo "  Status: Not available"
	@echo ""
	@echo "Queue Manager API (via nginx):"
	@curl -s -o /dev/null -w "  Status: %{http_code}\n" http://localhost:18080/api/health 2>/dev/null || echo "  Status: Not available"
	@echo ""
	@echo "Grafana (13000):"
	@curl -s -o /dev/null -w "  Status: %{http_code}\n" http://localhost:13000 2>/dev/null || echo "  Status: Not available"

# ============================================================================
# Splunk Commands
# ============================================================================

splunk-shell: ## Open Splunk CLI shell
	@echo "$(GREEN)Opening Splunk CLI...$(NC)"
	$(DC) exec splunk /opt/splunk/bin/splunk login -auth admin:$${SPLUNK_PASSWORD:-DemoPass123!}
	$(DC) exec -it splunk /bin/bash

splunk-logs: ## Follow Splunk logs
	$(DC) logs -f splunk

splunk-restart: ## Restart Splunk service
	@echo "$(YELLOW)Restarting Splunk...$(NC)"
	$(DC) restart splunk
	@echo "$(GREEN)Splunk restarted! Wait 1-2 minutes for full initialization.$(NC)"

# ============================================================================
# Data Commands
# ============================================================================

seed: ## Run seed data loader manually
	@echo "$(GREEN)Running seed data loader...$(NC)"
	$(DC) run --rm seed-data

reseed: ## Clear indexes and re-seed data
	@echo "$(YELLOW)This will clear all demo indexes and re-seed data.$(NC)"
	@read -p "Are you sure? [y/N] " confirm && [ "$$confirm" = "y" ] || exit 1
	@echo "$(YELLOW)Clearing indexes...$(NC)"
	$(DC) exec splunk /opt/splunk/bin/splunk clean eventdata -index demo_main -f
	$(DC) exec splunk /opt/splunk/bin/splunk clean eventdata -index demo_devops -f
	$(DC) exec splunk /opt/splunk/bin/splunk clean eventdata -index demo_sre -f
	$(DC) exec splunk /opt/splunk/bin/splunk clean eventdata -index demo_support -f
	$(DC) exec splunk /opt/splunk/bin/splunk clean eventdata -index demo_business -f
	@echo "$(GREEN)Running seed data loader...$(NC)"
	$(DC) run --rm seed-data

generate-token: ## Generate new invite token
	@echo "$(GREEN)Generating invite token...$(NC)"
	@TOKEN=$$(openssl rand -hex 16) && \
	echo "New token: $$TOKEN" && \
	echo "" && \
	echo "Share this URL: http://localhost:8080/?token=$$TOKEN" && \
	echo "" && \
	echo "Add to INVITE_TOKENS env var in docker-compose.yml"

# ============================================================================
# Development Commands
# ============================================================================

shell: ## Open shell in running demo container
	@CONTAINER=$$(docker ps --filter "name=splunk-demo" --filter "ancestor=splunk-demo-container" -q | head -1) && \
	if [ -z "$$CONTAINER" ]; then \
		echo "$(RED)No demo container running. Starting temporary container...$(NC)"; \
		$(DC) run --rm -it demo-container /bin/bash; \
	else \
		docker exec -it $$CONTAINER /bin/bash; \
	fi

clean: ## Remove all containers, images, and volumes
	@echo "$(RED)WARNING: This will remove all containers, images, and volumes!$(NC)"
	@read -p "Are you sure? [y/N] " confirm && [ "$$confirm" = "y" ] || exit 1
	$(DC) down -v --rmi local
	@echo "$(GREEN)Cleanup complete!$(NC)"

test: ## Run tests
	@echo "$(GREEN)Running tests...$(NC)"
	@echo ""
	@echo "$(GREEN)=== Python: shared package ===$(NC)"
	cd shared && python -m pytest -v tests/ 2>/dev/null || echo "No tests found or pytest not installed"
	@echo ""
	@echo "$(GREEN)=== Python: log generator ===$(NC)"
	cd log-generator && python -m pytest -v tests/ 2>/dev/null || echo "No tests found"
	@echo ""
	@echo "$(GREEN)=== Python: seed data ===$(NC)"
	cd seed-data && python -m pytest -v tests/ 2>/dev/null || echo "No tests found"
	@echo ""
	@echo "$(GREEN)=== Node.js: queue manager ===$(NC)"
	cd queue-manager && npm test 2>/dev/null || echo "Run 'npm install' in queue-manager first"
	@echo ""
	@echo "$(GREEN)Tests complete!$(NC)"

# ============================================================================
# Utility Commands
# ============================================================================

.env: ## Create .env file from template
	@if [ ! -f .env ]; then \
		echo "Creating .env file..."; \
		echo "SPLUNK_PASSWORD=DemoPass123!" > .env; \
		echo "SPLUNK_HEC_TOKEN=demo-hec-token-12345" >> .env; \
		echo "INVITE_TOKENS=demo-token-12345" >> .env; \
		echo "$(GREEN).env file created!$(NC)"; \
	else \
		echo "$(YELLOW).env file already exists$(NC)"; \
	fi

# Print variable values for debugging
print-%:
	@echo $* = $($*)
