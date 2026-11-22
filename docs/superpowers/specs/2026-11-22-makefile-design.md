# Design Spec: Makefile untuk NestJS Modular Monolith

- **Tanggal:** 2026-11-22
- **Status:** Approved by User
- **Cakupan:** Full-suite Makefile untuk otomatisasi workflow lokal, infrastruktur Docker, database Drizzle ORM, development lifecycle, code quality, dan cleanup.

---

## 1. Konteks & Tujuan

Proyek ini adalah NestJS 11 Fastify Modular Monolith dengan runtime Bun (`bun@1.3.14`), Drizzle ORM, PostgreSQL, Redis, MinIO, dan Mailpit.
Tujuan dari pembuatan `Makefile` ini adalah:
1. Menyediakan interface perintah standar dan konsisten bagi developer backend (`make <target>`).
2. Mengotomatisasi manajemen kontainer Docker dependensi lokal (infra-only) tanpa memaksa aplikasi berjalan di dalam kontainer saat local dev.
3. Menyederhanakan alur migrasi dan multi-step seeding Drizzle ORM.
4. Memfasilitasi alur verifikasi kualitas kode (lint, format, test, coverage, depcheck) sebelum pembuatan pull request.

---

## 2. Struktur & Konvensi Makefile

- **Shell:** `/bin/bash` dengan flags `-eu -o pipefail -c` untuk eksekusi yang aman (fail-fast jika ada perintah yang gagal).
- **Default Goal:** `help` (menampilkan daftar perintah berformat rapi dengan ANSI color styling).
- **Phony Targets:** Semua target dideklarasikan dalam `.PHONY` agar tidak terjadi konflik dengan nama file atau folder di root direktori (seperti `build`, `test`, `dist`).
- **Self-Documenting Help:** Parsing otomatis format `## [Kategori]` dan `target: ## Deskripsi` menggunakan AWK script.

---

## 3. Spesifikasi Target Perintah

### 3.1. Variabel Utama
```makefile
SHELL          := /bin/bash
.SHELLFLAGS    := -eu -o pipefail -c
.DEFAULT_GOAL  := help

BUN            := bun
DOCKER_COMPOSE := docker compose
COMPOSE_FILE   := docker-compose.yml
```

### 3.2. Setup & Environment
- **`make env`**: Memeriksa keberadaan `.env`. Jika belum ada, menyalin dari `.env.example`.
- **`make install`**: Menjalankan `bun install` untuk instalasi dependensi.
- **`make setup`**: Onboarding satu perintah yang mengeksekusi urutan: `env` -> `install` -> `infra-up` -> `db-migrate` -> `db-seed`.

### 3.3. Docker & Infrastructure Services
- **`make up`** / **`make infra-up`**: Menjalankan container background (`postgres redis minio mailpit`) secara detached (`-d`).
- **`make down`** / **`make infra-down`**: Menghentikan container background (`docker compose stop postgres redis minio mailpit`).
- **`make infra-logs`**: Stream logs container background (`docker compose logs -f postgres redis minio mailpit`).
- **`make docker-up`**: Menjalankan seluruh stack container termasuk service aplikasi `myapp` (`docker compose up -d --build`).
- **`make docker-down`**: Menghentikan seluruh container stack (`docker compose down`).
- **`make docker-logs`**: Stream logs semua container (`docker compose logs -f`).
- **`make docker-clean`**: Menghentikan container dan menghapus named volume Docker (`docker compose down -v`).

### 3.4. Database & Drizzle ORM
- **`make db-generate`**: Menjalankan `bun run db:generate` (Drizzle Kit generate schema migrations).
- **`make db-migrate`**: Menjalankan `bun run db:migrate` (eksekusi migrasi ke PostgreSQL).
- **`make db-seed`**: Menjalankan `bun run db:seed` (seed dasar).
- **`make db-seed-regional`**: Menjalankan `bun run db:seed:regional`.
- **`make db-seed-org`**: Menjalankan `bun run db:seed:org-members && bun run db:seed:org-invitations`.
- **`make db-seed-all`**: Menjalankan seluruh seeder secara berurutan (`seed` -> `regional` -> `org-members` -> `org-invitations`).
- **`make db-studio`**: Menjalankan Drizzle Studio GUI (`bun run db:studio`).
- **`make db-reset`**: Menghentikan Postgres, menghapus volume lokal DB, menyalakan kembali, menunggu healthcheck, lalu menjalankan `db-migrate` dan `db-seed-all`. Dilengkapi konfirmasi prompt (interactive check).

### 3.5. Development Lifecycle
- **`make dev`**: Menjalankan NestJS watch mode (`bun run start:dev`).
- **`make build`**: Menjalankan build NestJS (`bun run build`).
- **`make start`**: Menjalankan aplikasi production di host (`bun run start`).

### 3.6. Code Quality, Linter, & Testing
- **`make lint`**: Menjalankan ESLint fix (`bun run lint`).
- **`make format`**: Menjalankan Prettier format (`bun run format`).
- **`make test`**: Menjalankan unit & integration test (`bun test`).
- **`make test-cov`**: Menjalankan Bun test dengan laporan coverage (`bun test --coverage`).
- **`make depcheck`**: Memeriksa unused dependencies (`bun run depcheck`).
- **`make check`**: Menjalankan pipeline verifikasi lokal: `format` -> `lint` -> `depcheck` -> `test`.

### 3.7. Maintenance & Cleanup
- **`make clean`**: Menghapus direktori `dist/`, `coverage/`, dan temporary files.

---

## 4. Evaluasi & Self-Review

1. **Placeholder Scan:** Tidak ada placeholder "TBD" atau "TODO". Semua target memiliki perintah eksplisit yang memetakan ke skrip nyata di `package.json` dan `docker-compose.yml`.
2. **Konsistensi:** Sintaks mematuhi panduan GNU Make, menggunakan TAB untuk indentasi resep Makefile, dan menggunakan ANSI escape sequence yang kompatibel dengan terminal Linux modern.
3. **Scope:** Fokus terpusat pada file `Makefile` tunggal tanpa menciptakan dependensi eksternal tambahan.
4. **Keamanan:** Perintah destruktif seperti `db-reset` memiliki konfirmasi y/N agar tidak merusak data pengembangan tanpa sengaja.
