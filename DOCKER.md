# Docker Deployment Guide

## Prerequisites

- Docker Engine 20.10 or higher
- Docker Compose 2.0 or higher
- A Supabase project (database is not containerized)

## Docker Compose Files

This project includes multiple Docker Compose configurations:

- **docker-compose.yml**: Standard deployment (development/staging)
- **docker-compose.dev.yml**: Development with hot-reload
- **docker-compose.prod.yml**: Production with Nginx reverse proxy and SSL

Choose the appropriate file based on your needs.

## Quick Start

### 1. Environment Setup

Copy the example environment file and configure it:

```bash
cp .env.example .env
```

Edit `.env` and fill in your actual values:
- Supabase credentials (URL, service role key, anon key)
- Email configuration (if using email features)
- Twilio configuration (if using SMS features)

### 2. Build and Run

Build and start all services:

```bash
docker-compose up -d
```

This will start:
- **Backend API** on port 3001
- **Frontend** on port 80

### 3. Check Status

View running containers:

```bash
docker-compose ps
```

View logs:

```bash
# All services
docker-compose logs -f

# Specific service
docker-compose logs -f backend
docker-compose logs -f frontend
```

### 4. Stop Services

```bash
docker-compose down
```

To also remove volumes:

```bash
docker-compose down -v
```

## Production Deployment

### Using a VPS/Cloud Server

1. **Install Docker and Docker Compose** on your server

2. **Clone your repository**:
   ```bash
   git clone <your-repo-url>
   cd Traveling
   ```

3. **Configure environment variables**:
   ```bash
   cp .env.example .env
   nano .env  # Edit with your production values
   ```

4. **Run the application**:
   ```bash
   docker-compose up -d
   ```

5. **Setup domain and SSL** (recommended):
   - Point your domain to your server's IP
   - Use a reverse proxy like Traefik or Caddy for automatic SSL
   - Or use Let's Encrypt with certbot

### Environment-Specific Builds

For production, ensure these environment variables are set:

```bash
NODE_ENV=production
VITE_API_URL=https://your-domain.com/api
```

### Health Checks

Both services include health checks:

- Backend: `http://your-domain:3001/api/health`
- Frontend: `http://your-domain/health`

## Docker Commands Reference

### Building

```bash
# Build all services
docker-compose build

# Build specific service
docker-compose build backend
docker-compose build frontend

# Build without cache
docker-compose build --no-cache
```

### Running

```bash
# Start services
docker-compose up -d

# Start with rebuild
docker-compose up -d --build

# Start and view logs
docker-compose up
```

### Monitoring

```bash
# View logs
docker-compose logs -f

# View logs for last 100 lines
docker-compose logs --tail=100 -f

# Check container status
docker-compose ps

# View resource usage
docker stats
```

### Maintenance

```bash
# Restart services
docker-compose restart

# Restart specific service
docker-compose restart backend

# Stop services
docker-compose stop

# Remove containers
docker-compose down

# Remove containers and volumes
docker-compose down -v

# Remove containers, volumes, and images
docker-compose down -v --rmi all
```

### Accessing Containers

```bash
# Execute command in container
docker-compose exec backend sh
docker-compose exec frontend sh

# View container logs
docker logs hujjaj-backend
docker logs hujjaj-frontend
```

## Development Mode

For local development with hot-reload:

```bash
docker-compose -f docker-compose.dev.yml up
```

This configuration:
- Mounts source code as volumes for instant reload
- Runs development servers (nodemon for backend, vite for frontend)
- Exposes frontend on port 5173 (Vite default)
- Includes full debugging output

## Monitoring

Use the monitoring scripts to check service health:

**Windows:**
```powershell
.\monitor.ps1
```

**Linux/Mac:**
```bash
chmod +x monitor.sh
./monitor.sh
```

The monitor shows:
- Container status
- Health check results
- Resource usage (CPU, Memory)
- Recent error logs

## Known Issues

### TypeScript Errors in Frontend

The frontend currently has some TypeScript type errors that have been bypassed in the Docker build process. The application will build and run correctly, but these should be addressed for better code quality.

See [TYPESCRIPT_FIXES_NEEDED.md](TYPESCRIPT_FIXES_NEEDED.md) for details on what needs to be fixed.

The Docker build uses `vite build` directly (skipping `tsc` type checking) to allow deployment while these issues are being resolved.

## Troubleshooting

### Container won't start

```bash
# Check logs
docker-compose logs <service-name>

# Check container status
docker-compose ps

# Rebuild without cache
docker-compose build --no-cache <service-name>
```

### Port conflicts

If ports 80 or 3001 are already in use, modify `docker-compose.yml`:

```yaml
services:
  backend:
    ports:
      - "8001:3001"  # Change 3001 to 8001
  frontend:
    ports:
      - "8080:80"    # Change 80 to 8080
```

### Environment variables not loaded

Make sure `.env` file is in the same directory as `docker-compose.yml`.

### Frontend can't connect to backend

Update `VITE_API_URL` in `.env` to match your backend URL:

```bash
# For local development
VITE_API_URL=http://localhost:3001/api

# For production
VITE_API_URL=https://api.your-domain.com/api
```

## Updating the Application

```bash
# Pull latest code
git pull

# Rebuild and restart
docker-compose up -d --build
```

## Database Migrations

Since we're using Supabase (external database), run migrations directly in Supabase:

1. Go to your Supabase project dashboard
2. Navigate to SQL Editor
3. Run migration files from `supabase/migrations/` in order

## Backup and Restore

### Backend Uploads

Backup uploaded files:

```bash
docker cp hujjaj-backend:/app/uploads ./backup-uploads
```

Restore:

```bash
docker cp ./backup-uploads hujjaj-backend:/app/uploads
```

## Security Best Practices

1. **Never commit `.env` files** to version control
2. **Use strong passwords** for all services
3. **Enable SSL/TLS** in production
4. **Regularly update** Docker images
5. **Limit exposed ports** to only what's necessary
6. **Use Docker secrets** for sensitive data in production
7. **Implement rate limiting** on your reverse proxy
8. **Regular backups** of data and configuration

## Performance Optimization

1. **Resource Limits**: Add resource limits in docker-compose.yml:

```yaml
services:
  backend:
    deploy:
      resources:
        limits:
          cpus: '1'
          memory: 1G
        reservations:
          cpus: '0.5'
          memory: 512M
```

2. **Logging**: Configure log rotation to prevent disk fill:

```yaml
services:
  backend:
    logging:
      driver: "json-file"
      options:
        max-size: "10m"
        max-file: "3"
```

## Additional Resources

- [Docker Documentation](https://docs.docker.com/)
- [Docker Compose Documentation](https://docs.docker.com/compose/)
- [Supabase Documentation](https://supabase.com/docs)
