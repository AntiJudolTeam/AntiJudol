PROXY := services/proxy
FILTER := services/filter
KILLSWITCH := $(PROXY)/.killswitch

.PHONY: help install install-proxy install-filter \
        dev dev-proxy dev-filter \
        test build lint format homoglyphs \
        kill-on kill-off

help:               ## Show this help
	@grep -E '^[a-zA-Z_-]+:.*?##' $(MAKEFILE_LIST) | awk -F':.*?## ' '{printf "  %-14s %s\n", $$1, $$2}'

install: install-proxy install-filter   ## Install deps for both services

install-proxy:      ## Install proxy deps
	cd $(PROXY) && bun install

install-filter:     ## Install filter deps (run after activating venv)
	cd $(FILTER) && pip install -r requirements.txt

dev:                ## Run both services concurrently (Ctrl+C kills both)
	@trap 'kill 0' INT TERM EXIT; \
	(cd $(PROXY) && bun dev) & \
	(cd $(FILTER) && python3 -m app.main) & \
	wait

dev-proxy:          ## Run proxy in watch mode (no filter)
	cd $(PROXY) && bun dev

dev-filter:         ## Run filter only
	cd $(FILTER) && python3 -m app.main

test:               ## Run proxy test suite
	cd $(PROXY) && bun test

build:              ## Rebuild client inject.js bundle
	cd $(PROXY) && bun run build:inject

lint:               ## Run ESLint
	cd $(PROXY) && bun run lint

format:             ## Run Prettier
	cd $(PROXY) && bun run format

homoglyphs:         ## Regenerate src/filter/homoglyphs.js from charset.json
	cd $(PROXY) && bun scripts/build-homoglyphs.js

kill-on:            ## Activate kill switch (auto: docker if running, else local)
	@if [ -n "$$(docker compose ps -q proxy 2>/dev/null)" ]; then \
		docker compose exec proxy touch /app/.killswitch && echo "kill switch ACTIVE (docker)"; \
	else \
		touch $(KILLSWITCH) && echo "kill switch ACTIVE (local) → $(KILLSWITCH)"; \
	fi

kill-off:           ## Deactivate kill switch
	@if [ -n "$$(docker compose ps -q proxy 2>/dev/null)" ]; then \
		docker compose exec proxy rm -f /app/.killswitch && echo "kill switch inactive (docker)"; \
	else \
		rm -f $(KILLSWITCH) && echo "kill switch inactive (local)"; \
	fi
