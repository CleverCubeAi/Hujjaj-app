#!/bin/bash

# Ashamel Platform Deployment Script
# This script helps you deploy the platform quickly

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}  Ashamel Platform Deployment Script${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""

# Check if Docker is installed
if ! command -v docker &> /dev/null; then
    echo -e "${RED}Error: Docker is not installed${NC}"
    echo "Please install Docker from https://docs.docker.com/get-docker/"
    exit 1
fi

# Check if Docker Compose is installed
if ! command -v docker-compose &> /dev/null; then
    echo -e "${RED}Error: Docker Compose is not installed${NC}"
    echo "Please install Docker Compose from https://docs.docker.com/compose/install/"
    exit 1
fi

# Check if .env file exists
if [ ! -f .env ]; then
    echo -e "${YELLOW}Warning: .env file not found${NC}"
    echo "Creating .env from env.example..."
    cp env.example .env
    echo -e "${YELLOW}Please edit .env file with your configuration before continuing${NC}"
    exit 1
fi

# Menu
echo "Select deployment mode:"
echo "1) Development (simple setup)"
echo "2) Production (with SSL and reverse proxy)"
echo "3) Stop all services"
echo "4) View logs"
echo "5) Rebuild services"
read -p "Enter your choice [1-5]: " choice

case $choice in
    1)
        echo -e "${GREEN}Starting development deployment...${NC}"
        docker-compose up -d --build
        echo -e "${GREEN}Services started!${NC}"
        echo ""
        echo "Frontend: http://localhost"
        echo "Backend API: http://localhost:3001"
        echo ""
        echo -e "${YELLOW}Run 'docker-compose logs -f' to view logs${NC}"
        ;;
    2)
        echo -e "${GREEN}Starting production deployment...${NC}"
        
        # Check if domain is configured
        if ! grep -q "DOMAIN=" .env; then
            read -p "Enter your domain name: " domain
            echo "DOMAIN=$domain" >> .env
        fi
        
        docker-compose -f docker-compose.prod.yml up -d --build
        echo -e "${GREEN}Services started!${NC}"
        echo ""
        echo -e "${YELLOW}Don't forget to:${NC}"
        echo "1. Point your domain to this server's IP"
        echo "2. Configure SSL certificates in nginx/ssl/"
        echo "3. Update nginx/production.conf with your domain"
        echo ""
        echo -e "${YELLOW}Run 'docker-compose -f docker-compose.prod.yml logs -f' to view logs${NC}"
        ;;
    3)
        echo -e "${YELLOW}Stopping all services...${NC}"
        docker-compose down
        docker-compose -f docker-compose.prod.yml down 2>/dev/null || true
        echo -e "${GREEN}Services stopped${NC}"
        ;;
    4)
        echo "Select service to view logs:"
        echo "1) All services"
        echo "2) Backend only"
        echo "3) Frontend only"
        read -p "Enter your choice [1-3]: " log_choice
        
        case $log_choice in
            1) docker-compose logs -f ;;
            2) docker-compose logs -f backend ;;
            3) docker-compose logs -f frontend ;;
            *) echo -e "${RED}Invalid choice${NC}" ;;
        esac
        ;;
    5)
        echo -e "${YELLOW}Rebuilding services...${NC}"
        docker-compose build --no-cache
        docker-compose up -d
        echo -e "${GREEN}Services rebuilt and started${NC}"
        ;;
    *)
        echo -e "${RED}Invalid choice${NC}"
        exit 1
        ;;
esac
