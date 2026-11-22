SHELL := /bin/bash
.SHELLFLAGS := -eu -o pipefail -c
.DEFAULT_GOAL := help

BUN := bun
DOCKER_COMPOSE := docker compose
COMPOSE_FILE := docker-compose.yml

# Colors for terminal output
CYAN   := \033[36m
GREEN  := \033[32m
YELLOW := \033[33m
RED    := \033[31m
RESET  := \033[0m
BOLD   := \033[1m

.PHONY: help env install setup up infra-up down infra-down infra-logs docker-up docker-down docker-logs docker-clean db-generate db-migrate db-seed db-seed-regional db-seed-org db-seed-all db-studio db-reset dev build start lint format test test-cov depcheck check clean

##@ Help
help: ## Tampilkan daftar target dan bantuan penggunaan
	@awk 'BEGIN {FS = ":.*##"; printf "\n$(BOLD)Penggunaan:$(RESET) make $(CYAN)<target>$(RESET)\n"} \
		/^[a-zA-Z0-9_-]+:.*?##/ { printf "  $(CYAN)%-20s$(RESET) %s\n", $$1, $$2 } \
		/^##@/ { printf "\n$(BOLD)%s$(RESET)\n", substr($$0, 5) } ' $(MAKEFILE_LIST)

##@ Setup & Environment
env: ## Buat file .env dari .env.example jika belum ada
	@if [ ! -f .env ]; then \
		cp .env.example .env; \
		echo -e "$(GREEN)✓ File .env berhasil disalin dari .env.example$(RESET)"; \
	else \
		echo -e "$(YELLOW)! File .env sudah ada, tidak ada perubahan$(RESET)"; \
	fi

install: ## Install dependensi via Bun
	@echo -e "$(CYAN)Menginstal dependensi...$(RESET)"
	$(BUN) install

setup: env install infra-up db-migrate db-seed ## Setup awal proyek (env + install + infra-up + migrate + seed)
	@echo -e "$(GREEN)✓ Proyek siap digunakan! Jalankan 'make dev' untuk mulai development.$(RESET)"

##@ Docker & Infrastructure
up: infra-up ## Alias untuk infra-up
infra-up: ## Jalankan service background pendukung (postgres, redis, minio, mailpit)
	@echo -e "$(CYAN)Menjalankan infrastructure container (detached)...$(RESET)"
	$(DOCKER_COMPOSE) up -d postgres redis minio mailpit

down: infra-down ## Alias untuk infra-down
infra-down: ## Hentikan service background pendukung
	@echo -e "$(YELLOW)Menghentikan infrastructure container...$(RESET)"
	$(DOCKER_COMPOSE) stop postgres redis minio mailpit

infra-logs: ## Stream log container background (postgres, redis, minio, mailpit)
	$(DOCKER_COMPOSE) logs -f postgres redis minio mailpit

docker-up: ## Jalankan semua container termasuk service myapp
	@echo -e "$(CYAN)Membangun dan menjalankan semua container...$(RESET)"
	$(DOCKER_COMPOSE) up -d --build

docker-down: ## Hentikan dan hapus semua container
	@echo -e "$(YELLOW)Menghentikan semua container...$(RESET)"
	$(DOCKER_COMPOSE) down

docker-logs: ## Stream log dari semua container
	$(DOCKER_COMPOSE) logs -f

docker-clean: ## Hentikan container dan hapus semua volume data
	@echo -e "$(RED)Menghapus semua container dan data volume...$(RESET)"
	$(DOCKER_COMPOSE) down -v

##@ Database & Drizzle ORM
db-generate: ## Generate file migrasi Drizzle dari schema TypeScript
	@echo -e "$(CYAN)Menjalankan drizzle-kit generate...$(RESET)"
	$(BUN) run db:generate

db-migrate: ## Eksekusi migrasi ke database PostgreSQL
	@echo -e "$(CYAN)Menjalankan migrasi database...$(RESET)"
	$(BUN) run db:migrate

db-seed: ## Jalankan seeder default database
	@echo -e "$(CYAN)Menjalankan database seed...$(RESET)"
	$(BUN) run db:seed

db-seed-regional: ## Jalankan seeder data regional (wilayah)
	@echo -e "$(CYAN)Menjalankan database seed regional...$(RESET)"
	$(BUN) run db:seed:regional

db-seed-org: ## Jalankan seeder organisasi (members dan invitations)
	@echo -e "$(CYAN)Menjalankan seeder organisasi...$(RESET)"
	$(BUN) run db:seed:org-members
	$(BUN) run db:seed:org-invitations

db-seed-all: ## Jalankan semua tahapan seeder database secara berurutan
	@echo -e "$(CYAN)Menjalankan semua seeder database...$(RESET)"
	$(BUN) run db:seed
	$(BUN) run db:seed:regional
	$(BUN) run db:seed:org-members
	$(BUN) run db:seed:org-invitations
	@echo -e "$(GREEN)✓ Semua seeder berhasil dijalankan$(RESET)"

db-studio: ## Buka UI Drizzle Studio untuk eksplorasi database
	@echo -e "$(CYAN)Membuka Drizzle Studio...$(RESET)"
	$(BUN) run db:studio

db-reset: ## Reset total database (Hapus data postgres, migrate, dan seed-all)
	@echo -e "$(RED)$(BOLD)PERINGATAN: Perintah ini akan menghapus seluruh data PostgreSQL!$(RESET)"
	@read -p "Apakah Anda yakin ingin mereset database? [y/N]: " confirm; \
	if [ "$$confirm" = "y" ] || [ "$$confirm" = "Y" ]; then \
		echo -e "$(YELLOW)Menghentikan container postgres dan menghapus volume...$(RESET)"; \
		$(DOCKER_COMPOSE) stop postgres; \
		$(DOCKER_COMPOSE) rm -f -v postgres; \
		docker volume rm -f myapp_postgres_data || true; \
		echo -e "$(CYAN)Menyalakan kembali container postgres...$(RESET)"; \
		$(DOCKER_COMPOSE) up -d postgres; \
		echo -e "$(CYAN)Menunggu PostgreSQL siap...$(RESET)"; \
		until $(DOCKER_COMPOSE) exec -T postgres pg_isready -U $${POSTGRES_USER:-myapp} -d $${POSTGRES_DB:-myapp} > /dev/null 2>&1; do \
			sleep 1; \
		done; \
		echo -e "$(GREEN)PostgreSQL siap. Menjalankan migrasi dan seeder...$(RESET)"; \
		$(MAKE) db-migrate; \
		$(MAKE) db-seed-all; \
		echo -e "$(GREEN)✓ Reset database berhasil!$(RESET)"; \
	else \
		echo -e "$(YELLOW)Reset database dibatalkan.$(RESET)"; \
	fi

##@ Development & Lifecycle
dev: ## Jalankan aplikasi dalam mode watch / hot-reload
	$(BUN) run start:dev

build: ## Kompilasi aplikasi ke dist/
	@echo -e "$(CYAN)Mengompilasi aplikasi...$(RESET)"
	$(BUN) run build

start: ## Jalankan aplikasi mode production dari host
	$(BUN) run start

##@ Code Quality & Testing
lint: ## Jalankan ESLint dengan auto-fix
	@echo -e "$(CYAN)Menjalankan ESLint fix...$(RESET)"
	$(BUN) run lint

format: ## Format kode menggunakan Prettier
	@echo -e "$(CYAN)Menjalankan Prettier format...$(RESET)"
	$(BUN) run format

test: ## Jalankan unit dan integration test via Bun
	@echo -e "$(CYAN)Menjalankan Bun tests...$(RESET)"
	$(BUN) test

test-cov: ## Jalankan test dan tampilkan laporan coverage
	@echo -e "$(CYAN)Menjalankan Bun tests dengan coverage...$(RESET)"
	$(BUN) test --coverage

depcheck: ## Periksa dependensi yang tidak terpakai
	@echo -e "$(CYAN)Menjalankan depcheck...$(RESET)"
	$(BUN) run depcheck

check: format lint depcheck test ## Jalankan seluruh pengecekan kualitas kode (format, lint, depcheck, test)
	@echo -e "$(GREEN)✓ Seluruh pemeriksaan kualitas kode lolos!$(RESET)"

##@ Maintenance & Cleanup
clean: ## Bersihkan direktori build (dist/), coverage, dan cache temporer
	@echo -e "$(YELLOW)Membersihkan file temporer dan build artifacts...$(RESET)"
	rm -rf dist coverage .turbo *.log
	@echo -e "$(GREEN)✓ Direktori kerja bersih$(RESET)"
