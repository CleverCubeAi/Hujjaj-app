# Quick Start Guide - Docker Deployment

Get your Hujjaj platform running in minutes!

Self-hosted stack: PostgreSQL + Express (JWT auth) + React. Copy `env.example` to `.env` and set `JWT_SECRET` before starting.

## Prerequisites

- **Docker** and **Docker Compose** installed
- **5 minutes** of your time

## Step 1: Configure Environment Variables

```bash
cp env.example .env
```

Edit `.env` and set at least:

```env
JWT_SECRET=replace-with-a-long-random-secret
DATABASE_URL=postgres://hujjaj:hujjaj@postgres:5432/hujjaj
```

Defaults for Postgres user/password/db (`hujjaj`) work out of the box with Compose.

## Step 2: Deploy with Docker

```bash
chmod +x deploy.sh
./deploy.sh
# or:
docker compose up -d --build
```

Migrations run automatically when the backend container starts.

## Step 3: Access Your Platform

- **Frontend**: http://localhost
- **Backend API**: http://localhost:3001/health

## Step 4: Log in

A **super admin** and a full **Al-Baraka demo agency** are seeded automatically on backend start:

| Role | Email | Password |
|------|-------|----------|
| Platform super admin | `admin@hujjaj.app` | `Admin123!` |
| Agency admin (demo) | `ahmed@albaraka.ma` | `Demo123!` |
| Manager | `fatima@albaraka.ma` | `Demo123!` |
| Agent (Rabat) | `youssef@albaraka.ma` | `Demo123!` |
| Agent (Marrakech) | `khadija@albaraka.ma` | `Demo123!` |

Demo includes 3 branches, seasons, flights/hotels/inventory, 6 bookings (confirmed/paid/pending/draft/cancelled), pilgrims, payments, expenses, discounts, and handovers.

Set `SEED_DEMO=false` in `.env` to skip demo data. Override passwords via `SUPER_ADMIN_*` / `DEMO_PASSWORD`.

To create an empty agency instead of using the demo:

```bash
curl -X POST http://localhost:3001/api/auth/register \
  -H 'Content-Type: application/json' \
  -d '{
    "email": "agency@example.com",
    "password": "password123",
    "agencyName": "My Agency",
    "fullName": "Admin",
    "country": "MA"
  }'
```


## Useful Commands

```bash
docker compose ps
docker compose logs -f backend
docker compose down
```

Containers:

- `hujjaj-postgres`
- `hujjaj-backend`
- `hujjaj-frontend`
