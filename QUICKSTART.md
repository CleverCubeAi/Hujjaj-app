# Quick Start Guide - Docker Deployment

Get your Ashamel platform running in minutes!

## Prerequisites

- **Docker** and **Docker Compose** installed
- A **Supabase** project (sign up at https://supabase.com)
- **5 minutes** of your time

## Step 1: Configure Environment Variables

1. Copy the example environment file:
   ```bash
   # Linux/Mac
   cp env.example .env
   
   # Windows PowerShell
   Copy-Item env.example .env
   ```

2. Open `.env` and update these required values:
   ```env
   SUPABASE_URL=https://YOUR-PROJECT.supabase.co
   SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
   SUPABASE_ANON_KEY=your-anon-key
   ```

   Get these values from your Supabase project:
   - Go to **Project Settings** → **API**
   - Copy the **Project URL** → `SUPABASE_URL`
   - Copy the **anon/public** key → `SUPABASE_ANON_KEY`
   - Copy the **service_role** key → `SUPABASE_SERVICE_ROLE_KEY`

## Step 2: Setup Database

1. Go to your Supabase project dashboard
2. Navigate to **SQL Editor**
3. Run the migration files from `supabase/migrations/` folder **in order**:
   - Start with `001_initial_schema.sql`
   - Then `002_rls_policies.sql`
   - Continue through all files in numerical order

## Step 3: Deploy with Docker

### Option A: Use Deployment Script (Recommended)

**Windows:**
```powershell
.\deploy.ps1
```

**Linux/Mac:**
```bash
chmod +x deploy.sh
./deploy.sh
```

Select option **1** for development deployment.

### Option B: Manual Docker Compose

```bash
docker-compose up -d --build
```

## Step 4: Access Your Platform

- **Frontend**: http://localhost
- **Backend API**: http://localhost:3001

The platform should be ready in 2-3 minutes (first build takes longer).

## Step 5: Create First User

1. Open http://localhost in your browser
2. Click on "Register" (or navigate to registration page)
3. Create your first agency admin account

## Verify Everything Works

Check that all services are running:
```bash
docker-compose ps
```

You should see:
- `ashamel-backend` - Status: Up
- `ashamel-frontend` - Status: Up

View logs:
```bash
# All services
docker-compose logs -f

# Specific service
docker-compose logs -f backend
docker-compose logs -f frontend
```

## Common Issues & Solutions

### Port Already in Use

If port 80 or 3001 is already in use, edit `docker-compose.yml`:

```yaml
services:
  backend:
    ports:
      - "8001:3001"  # Change external port
  frontend:
    ports:
      - "8080:80"    # Change external port
```

Then access at:
- Frontend: http://localhost:8080
- Backend: http://localhost:8001

### Frontend Can't Connect to Backend

1. Check backend is running: `docker-compose logs backend`
2. Update `.env` file:
   ```env
   VITE_API_URL=http://localhost:3001/api
   ```
3. Rebuild: `docker-compose up -d --build frontend`

### Services Won't Start

```bash
# View detailed error logs
docker-compose logs

# Rebuild without cache
docker-compose build --no-cache
docker-compose up -d
```

### Environment Variables Not Loading

Make sure `.env` file is in the same directory as `docker-compose.yml`.

## Next Steps

- ✅ Configure email settings (optional) - for sending booking confirmations
- ✅ Configure Twilio (optional) - for SMS notifications
- ✅ Setup SSL for production - see [DOCKER.md](DOCKER.md)
- ✅ Configure custom domain - see [DOCKER.md](DOCKER.md)
- ✅ Fix TypeScript errors - see [TYPESCRIPT_FIXES_NEEDED.md](TYPESCRIPT_FIXES_NEEDED.md) (optional, doesn't affect functionality)

## Stopping the Platform

```bash
# Stop services
docker-compose down

# Stop and remove volumes (careful - removes data!)
docker-compose down -v
```

## Updating the Platform

```bash
# Pull latest changes
git pull

# Rebuild and restart
docker-compose up -d --build
```

## Deploy to Remote Server

To deploy to a VPS or cloud server (AWS EC2, DigitalOcean, etc.):

**Automated deployment (Recommended):**
```powershell
.\quick-deploy.ps1
```

**Manual deployment:**
See [DEPLOYMENT_GUIDE.md](DEPLOYMENT_GUIDE.md) or [SERVER_DEPLOYMENT_CHECKLIST.md](SERVER_DEPLOYMENT_CHECKLIST.md)

## Need More Help?

- 📖 Detailed documentation: [DOCKER.md](DOCKER.md)
- 🔧 Troubleshooting guide: [DOCKER.md#troubleshooting](DOCKER.md#troubleshooting)
- 🚀 Server deployment: [DEPLOYMENT_GUIDE.md](DEPLOYMENT_GUIDE.md)
- ✅ Deployment checklist: [SERVER_DEPLOYMENT_CHECKLIST.md](SERVER_DEPLOYMENT_CHECKLIST.md)

---

**That's it!** You should now have a fully functional Hajj & Omra management platform running on your machine. 🎉
