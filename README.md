# Hujjaj - Hajj & Omra SaaS Platform

A multi-tenant SaaS application for Hajj & Omra travel agencies.

## Features

- **Multi-tenancy**: Agency isolation via `agency_id` in the API
- **Bookings & inventory**: Hotel beds, flight seats, holds/locks
- **Pilgrims & clients**: Registration, payments, room assignment
- **Finance**: Expenses, discounts, handovers, reports
- **Bilingual UI**: Arabic (RTL) and French

## Tech Stack

- **Frontend**: React + Vite + TypeScript + Mantine UI
- **Backend**: Node.js + Express + TypeScript + Knex
- **Database**: PostgreSQL 16 (Docker)
- **Auth**: JWT + bcrypt (self-hosted)

## Project Structure

```
Hujjaj/
├── backend/
│   ├── db/                   # schema.sql + Knex migrations
│   ├── src/
│   │   ├── controllers/
│   │   ├── middleware/
│   │   ├── routes/
│   │   └── services/         # db, query layer, auth
│   └── package.json
├── frontend/
└── docker-compose.yml
```

## Quick Start (Docker)

```bash
cp env.example .env
# Edit JWT_SECRET (required)

./deploy.sh
# or: docker compose up -d --build
```

- App: http://localhost  
- API: http://localhost:3001  
- Default super admin (seeded if missing): `admin@hujjaj.app` / `Admin123!`
- Register an agency: `POST /api/auth/register` with `{ email, password, agencyName, fullName, country }`

## Manual Setup

### 1. Postgres

```bash
docker compose up -d postgres
```

### 2. Backend

```bash
cd backend
cp ../env.example ../.env
# Set DATABASE_URL=postgres://hujjaj:hujjaj@localhost:5432/hujjaj for local
npm install
npm run migrate
npm run dev
```

### 3. Frontend

```bash
cd frontend
# VITE_API_URL=http://localhost:3001/api
npm install
npm run dev
```

## Environment

See [env.example](env.example):

| Variable | Purpose |
|----------|---------|
| `DATABASE_URL` | Postgres connection string |
| `JWT_SECRET` | JWT signing secret |
| `PUBLIC_URL` | Base URL for uploaded file links |
| `VITE_API_URL` | Frontend API base (`/api` behind nginx) |

## Roles

- **super_admin**: Platform owner
- **agency_admin**: Agency administrator
- **manager**: Branch manager
- **agent**: Booking agent
