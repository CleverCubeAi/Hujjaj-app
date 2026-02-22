# Ashamel - Hajj & Omra SaaS Platform

A multi-tenant SaaS application for Hajj & Omra travel agencies, replacing Excel-based accommodation management.

## Features

- **Multi-tenancy**: Full agency isolation using Supabase Row Level Security
- **Accommodation Management**: Excel-like grid for room/bed capacity tracking
- **Pilgrim Registration**: With flight assignment and payment tracking
- **Financial Tracking**: Expenses by category, payment summaries
- **Bilingual Support**: Arabic (RTL) and French with language switcher
- **Real-time Updates**: Supabase subscriptions for live data

## Tech Stack

- **Frontend**: React + Vite + TypeScript + Mantine UI + AG Grid
- **Backend**: Node.js + Express + TypeScript
- **Database**: Supabase (PostgreSQL + Auth + RLS + Realtime)

## Project Structure

```
Ashamel/
├── backend/                  # Express.js API
│   ├── src/
│   │   ├── controllers/      # Route handlers
│   │   ├── middleware/       # Auth middleware
│   │   ├── routes/           # API routes
│   │   └── services/         # Supabase client
│   └── package.json
│
├── frontend/                 # React + Vite
│   ├── public/locales/       # i18n translations (ar, fr)
│   ├── src/
│   │   ├── components/       # Layout, common components
│   │   ├── features/         # Feature modules
│   │   ├── i18n/             # i18next config
│   │   ├── lib/              # API client, Supabase
│   │   └── providers/        # Auth context
│   └── package.json
│
└── supabase/
    └── migrations/           # SQL schema files
```

## Setup

### Quick Start with Docker 🐳

**Fastest way to get started!** See [QUICKSTART.md](QUICKSTART.md) for Docker deployment.

```bash
# Windows
.\deploy.ps1

# Linux/Mac
./deploy.sh
```

Access at http://localhost after deployment completes.

For detailed Docker documentation, see [DOCKER.md](DOCKER.md).

---

### Manual Setup (Without Docker)

### 1. Database (Supabase)

1. Create a new Supabase project at https://supabase.com
2. Go to SQL Editor and run the migration files in order:
   - `supabase/migrations/001_initial_schema.sql`
   - `supabase/migrations/002_rls_policies.sql`
   - `supabase/migrations/003_views_functions.sql`

### 2. Backend

```bash
cd backend
```

Create `.env` file:
```
PORT=3001
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
SUPABASE_ANON_KEY=your-anon-key
```

Install and run:
```bash
npm install
npm run dev
```

### 3. Frontend

```bash
cd frontend
```

Create `.env` file:
```
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
VITE_API_URL=http://localhost:3001/api
```

Install and run:
```bash
npm install
npm run dev
```

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/auth/login` | User login |
| POST | `/api/auth/register` | Agency registration |
| GET/POST | `/api/seasons` | Season management |
| GET/POST | `/api/flights` | Flight groups |
| GET/POST | `/api/accommodations` | Accommodations & rooms |
| GET | `/api/accommodations/:id/capacity` | Bed status |
| GET/POST/PUT | `/api/pilgrims` | Pilgrim management |
| PUT | `/api/pilgrims/:id/payment` | Payment updates |
| POST | `/api/pilgrims/import` | CSV import |
| GET/POST | `/api/expenses` | Expense tracking |
| GET | `/api/expenses/summary` | Category totals |

## User Roles

- **super_admin**: Platform owner (bypass RLS)
- **agency_admin**: Agency owner (full access)
- **manager**: Operations manager
- **agent**: Limited access (read + basic write)

## Production Deployment

To deploy to a remote server (VPS, AWS EC2, etc.):

1. See [DEPLOYMENT_GUIDE.md](DEPLOYMENT_GUIDE.md) for detailed instructions
2. Or use the quick deployment script:
   ```powershell
   # Windows
   .\quick-deploy.ps1
   
   # Linux/Mac
   ./quick-deploy.sh
   ```

## License

ISC
