#!/bin/bash

# Hujjaj Platform Monitoring Script
# Check the health and status of all services

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}  Hujjaj Platform Health Monitor${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""

# Check if Docker is running
if ! docker info > /dev/null 2>&1; then
    echo -e "${RED}✗ Docker is not running${NC}"
    exit 1
fi

echo -e "${GREEN}✓ Docker is running${NC}"
echo ""

# Check running containers
echo -e "${BLUE}Container Status:${NC}"
containers=$(docker-compose ps --format json 2>/dev/null)

if [ -z "$containers" ]; then
    echo -e "${YELLOW}No containers found. Are services running?${NC}"
    echo -e "Run ${GREEN}docker-compose up -d${NC} to start services"
    exit 0
fi

# Parse and display container status
backend_status=$(docker inspect -f '{{.State.Status}}' hujjaj-backend 2>/dev/null)
frontend_status=$(docker inspect -f '{{.State.Status}}' hujjaj-frontend 2>/dev/null)

if [ "$backend_status" == "running" ]; then
    echo -e "${GREEN}✓ Backend:  Running${NC}"
else
    echo -e "${RED}✗ Backend:  $backend_status${NC}"
fi

if [ "$frontend_status" == "running" ]; then
    echo -e "${GREEN}✓ Frontend: Running${NC}"
else
    echo -e "${RED}✗ Frontend: $frontend_status${NC}"
fi

echo ""

# Check health endpoints
echo -e "${BLUE}Health Checks:${NC}"

# Backend health
backend_health=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3001/health 2>/dev/null)
if [ "$backend_health" == "200" ]; then
    echo -e "${GREEN}✓ Backend API:  Healthy (HTTP 200)${NC}"
else
    echo -e "${RED}✗ Backend API:  Unhealthy (HTTP $backend_health)${NC}"
fi

# Frontend health
frontend_health=$(curl -s -o /dev/null -w "%{http_code}" http://localhost/health 2>/dev/null)
if [ "$frontend_health" == "200" ]; then
    echo -e "${GREEN}✓ Frontend:     Healthy (HTTP 200)${NC}"
else
    echo -e "${RED}✗ Frontend:     Unhealthy (HTTP $frontend_health)${NC}"
fi

echo ""

# Resource usage
echo -e "${BLUE}Resource Usage:${NC}"
docker stats --no-stream --format "table {{.Name}}\t{{.CPUPerc}}\t{{.MemUsage}}" hujjaj-backend hujjaj-frontend 2>/dev/null

echo ""

# Recent logs
echo -e "${BLUE}Recent Errors (last 10 lines):${NC}"
error_count=$(docker-compose logs --tail=50 2>/dev/null | grep -i "error" | wc -l)

if [ "$error_count" -gt 0 ]; then
    echo -e "${RED}Found $error_count error messages:${NC}"
    docker-compose logs --tail=50 2>/dev/null | grep -i "error" | tail -10
else
    echo -e "${GREEN}No recent errors found${NC}"
fi

echo ""
echo -e "${BLUE}========================================${NC}"
echo -e "For detailed logs, run: ${GREEN}docker-compose logs -f${NC}"
echo -e "${BLUE}========================================${NC}"
