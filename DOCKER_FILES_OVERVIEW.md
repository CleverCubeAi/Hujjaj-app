# Docker Files Overview

This document explains all Docker-related files in the project.

## Core Docker Files

### 1. Dockerfiles

#### `backend/Dockerfile`
Production Dockerfile for the backend API.
- Multi-stage build (builder + production)
- Optimized for minimal image size
- Copies compiled assets (fonts for PDF generation)
- Runs on Node.js 20 Alpine

#### `backend/Dockerfile.dev`
Development Dockerfile for the backend.
- Single-stage build
- Includes all dev dependencies
- Enables hot-reload with nodemon
- Mounts source code as volume

#### `frontend/Dockerfile`
Production Dockerfile for the frontend.
- Multi-stage build (builder + nginx)
- Builds static assets with Vite
- Serves via Nginx with custom config
- Includes environment variable support at build time

#### `frontend/Dockerfile.dev`
Development Dockerfile for the frontend.
- Single-stage build
- Runs Vite dev server
- Hot-reload enabled
- Exposes port 5173

### 2. Docker Compose Files

#### `docker-compose.yml` (Main)
Standard deployment configuration.
- Suitable for development and staging
- Exposes ports directly (80, 3001)
- Includes health checks
- Basic resource management
- Uses bridge networking

**Services:**
- `backend`: API server on port 3001
- `frontend`: Web app on port 80

#### `docker-compose.dev.yml`
Development-optimized configuration.
- Volume mounts for hot-reload
- Development commands (npm run dev)
- Full logging output
- No resource limits
- Frontend on port 5173 (Vite default)

**Use when:** Actively developing and need instant code updates

#### `docker-compose.prod.yml`
Production-ready configuration.
- Unified Nginx reverse proxy
- SSL/TLS support
- Resource limits and reservations
- Log rotation configured
- Health checks on all services
- Certbot for automatic SSL renewal

**Services:**
- `backend`: API server (internal only)
- `frontend`: Web app (internal only)
- `nginx`: Reverse proxy (ports 80, 443)
- `certbot`: SSL certificate management

**Use when:** Deploying to production with custom domain

### 3. Nginx Configuration

#### `frontend/nginx.conf`
Nginx configuration for serving the frontend in production.
- Serves static files from `/usr/share/nginx/html`
- SPA routing support (all routes → index.html)
- Gzip compression enabled
- Cache headers for static assets
- Security headers (XSS, clickjacking protection)
- Health check endpoint

#### `nginx/production.conf`
Unified reverse proxy configuration (optional).
- Handles both frontend and backend
- SSL/TLS termination
- HTTP to HTTPS redirect
- WebSocket support for real-time features
- Rate limiting ready
- Security headers
- Let's Encrypt support

**Use with:** `docker-compose.prod.yml`

## Configuration Files

### `env.example`
Template for environment variables.
- Documents all required variables
- Includes optional configurations (email, SMS)
- Copy to `.env` before deployment

### `.dockerignore` (Root)
Excludes unnecessary files from Docker context.
- Documentation files
- Git repository
- Environment files
- CI/CD configurations

### `frontend/.dockerignore`
Frontend-specific exclusions.
- node_modules
- Build outputs (dist)
- Development files

### `backend/.dockerignore`
Backend-specific exclusions.
- node_modules
- Build outputs (dist)
- Upload files (except structure)

### `.gitignore` (Updated)
Now includes Docker-related ignores:
- `.env` files
- `docker-compose.override.yml`
- SSL certificates
- Upload directories

## Scripts

### Deployment Scripts

#### `deploy.sh` (Linux/Mac)
Interactive deployment script.
- Menu-driven interface
- Checks for Docker/Docker Compose
- Validates environment configuration
- Supports dev and prod deployments
- View logs
- Rebuild services

**Options:**
1. Development deployment
2. Production deployment
3. Stop all services
4. View logs
5. Rebuild services

#### `deploy.ps1` (Windows)
PowerShell version of deployment script.
- Same functionality as deploy.sh
- Windows-native commands
- Color-coded output
- Error handling

### Monitoring Scripts

#### `monitor.sh` (Linux/Mac)
Health monitoring script.
- Checks Docker status
- Verifies container health
- Tests health endpoints
- Shows resource usage
- Displays recent errors

#### `monitor.ps1` (Windows)
PowerShell version of monitoring script.
- Same functionality as monitor.sh
- Windows PowerShell compatible
- Works with Docker Desktop

## Documentation

### `DOCKER.md`
Comprehensive Docker documentation.
- Complete setup instructions
- All Docker commands reference
- Production deployment guide
- SSL/TLS configuration
- Troubleshooting guide
- Security best practices
- Performance optimization

### `QUICKSTART.md`
5-minute quick start guide.
- Minimal configuration
- Step-by-step instructions
- Common issues and solutions
- For users who want to get running fast

### `DOCKER_FILES_OVERVIEW.md` (This File)
Technical reference for all Docker files.
- Explains purpose of each file
- Helps developers understand the setup
- Reference for modifications

## Directory Structure

```
Traveling/
├── backend/
│   ├── Dockerfile              # Production backend image
│   ├── Dockerfile.dev          # Development backend image
│   ├── .dockerignore           # Backend-specific ignores
│   └── uploads/
│       └── .gitkeep            # Keep uploads directory
│
├── frontend/
│   ├── Dockerfile              # Production frontend image
│   ├── Dockerfile.dev          # Development frontend image
│   ├── nginx.conf              # Frontend nginx config
│   └── .dockerignore           # Frontend-specific ignores
│
├── nginx/
│   ├── production.conf         # Unified reverse proxy config
│   └── ssl/
│       └── .gitkeep            # SSL certificates go here
│
├── docker-compose.yml          # Standard deployment
├── docker-compose.dev.yml      # Development mode
├── docker-compose.prod.yml     # Production with SSL
├── .dockerignore               # Root-level ignores
├── env.example                 # Environment template
│
├── deploy.sh                   # Linux/Mac deployment script
├── deploy.ps1                  # Windows deployment script
├── monitor.sh                  # Linux/Mac monitoring script
├── monitor.ps1                 # Windows monitoring script
│
├── DOCKER.md                   # Full Docker documentation
├── QUICKSTART.md               # Quick start guide
└── DOCKER_FILES_OVERVIEW.md    # This file
```

## Usage Examples

### Quick Development Start
```bash
# Copy environment file
cp env.example .env

# Edit with your Supabase credentials
nano .env

# Start with hot-reload
docker-compose -f docker-compose.dev.yml up
```

### Standard Deployment
```bash
# Using script (recommended)
./deploy.sh  # or .\deploy.ps1 on Windows

# Or manually
docker-compose up -d --build
```

### Production Deployment
```bash
# Configure environment
cp env.example .env
nano .env  # Add production values + DOMAIN

# Deploy with SSL support
docker-compose -f docker-compose.prod.yml up -d --build
```

### Monitoring
```bash
# Check health
./monitor.sh  # or .\monitor.ps1 on Windows

# View live logs
docker-compose logs -f

# Check specific service
docker-compose logs -f backend
```

### Updating
```bash
# Pull latest code
git pull

# Rebuild and restart
docker-compose up -d --build
```

## Common Modifications

### Change Ports
Edit `docker-compose.yml`:
```yaml
services:
  backend:
    ports:
      - "8001:3001"  # External:Internal
  frontend:
    ports:
      - "8080:80"
```

### Add Environment Variable
1. Add to `env.example`
2. Add to `.env`
3. Add to appropriate docker-compose.yml:
```yaml
environment:
  - NEW_VARIABLE=${NEW_VARIABLE}
```

### Add Resource Limits
In docker-compose.yml:
```yaml
deploy:
  resources:
    limits:
      cpus: '2'
      memory: 2G
    reservations:
      cpus: '1'
      memory: 1G
```

### Enable Development Hot-Reload
Use `docker-compose.dev.yml` which already has volume mounts configured.

## Security Considerations

### Files to Keep Private
- `.env` - Contains secrets
- `nginx/ssl/*` - SSL certificates
- `backend/uploads/*` - User uploads

### Already Git-Ignored
All sensitive files are in `.gitignore`.

### SSL/TLS
Place certificates in `nginx/ssl/`:
- `fullchain.pem` - Certificate chain
- `privkey.pem` - Private key

Or use Certbot service in `docker-compose.prod.yml`.

## Next Steps

After setup:
1. ✅ Run monitoring script to verify health
2. ✅ Check logs for any errors
3. ✅ Test frontend at http://localhost
4. ✅ Test backend at http://localhost:3001
5. ✅ Configure production domain and SSL
6. ✅ Set up automated backups
7. ✅ Configure monitoring/alerting

## Support

- **Quick issues**: See QUICKSTART.md troubleshooting
- **Detailed help**: See DOCKER.md
- **Docker docs**: https://docs.docker.com
- **Compose docs**: https://docs.docker.com/compose
