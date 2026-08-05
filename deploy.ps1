# Hujjaj Platform Deployment Script (PowerShell)
# This script helps you deploy the platform quickly on Windows

$ErrorActionPreference = "Stop"

Write-Host "========================================" -ForegroundColor Green
Write-Host "  Hujjaj Platform Deployment Script" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host ""

# Check if Docker is running
try {
    docker ps | Out-Null
} catch {
    Write-Host "Error: Docker is not running" -ForegroundColor Red
    Write-Host "Please start Docker Desktop" -ForegroundColor Yellow
    exit 1
}

# Check if docker-compose is available
try {
    docker-compose version | Out-Null
} catch {
    Write-Host "Error: Docker Compose is not installed" -ForegroundColor Red
    Write-Host "Please install Docker Compose from https://docs.docker.com/compose/install/" -ForegroundColor Yellow
    exit 1
}

# Check if .env file exists
if (-not (Test-Path .env)) {
    Write-Host "Warning: .env file not found" -ForegroundColor Yellow
    Write-Host "Creating .env from env.example..." -ForegroundColor Yellow
    Copy-Item env.example .env
    Write-Host "Please edit .env file with your configuration before continuing" -ForegroundColor Yellow
    exit 1
}

# Menu
Write-Host "Select deployment mode:" -ForegroundColor Cyan
Write-Host "1) Development (simple setup)"
Write-Host "2) Production (with SSL and reverse proxy)"
Write-Host "3) Stop all services"
Write-Host "4) View logs"
Write-Host "5) Rebuild services"
$choice = Read-Host "Enter your choice [1-5]"

switch ($choice) {
    "1" {
        Write-Host "Starting development deployment..." -ForegroundColor Green
        docker-compose up -d --build
        Write-Host "Services started!" -ForegroundColor Green
        Write-Host ""
        Write-Host "Frontend: http://localhost"
        Write-Host "Backend API: http://localhost:3001"
        Write-Host ""
        Write-Host "Run 'docker-compose logs -f' to view logs" -ForegroundColor Yellow
    }
    "2" {
        Write-Host "Starting production deployment..." -ForegroundColor Green
        
        # Check if domain is configured
        $envContent = Get-Content .env -Raw
        if ($envContent -notmatch "DOMAIN=") {
            $domain = Read-Host "Enter your domain name"
            Add-Content .env "`nDOMAIN=$domain"
        }
        
        docker-compose -f docker-compose.prod.yml up -d --build
        Write-Host "Services started!" -ForegroundColor Green
        Write-Host ""
        Write-Host "Don't forget to:" -ForegroundColor Yellow
        Write-Host "1. Point your domain to this server's IP"
        Write-Host "2. Configure SSL certificates in nginx/ssl/"
        Write-Host "3. Update nginx/production.conf with your domain"
        Write-Host ""
        Write-Host "Run 'docker-compose -f docker-compose.prod.yml logs -f' to view logs" -ForegroundColor Yellow
    }
    "3" {
        Write-Host "Stopping all services..." -ForegroundColor Yellow
        docker-compose down
        try { docker-compose -f docker-compose.prod.yml down 2>$null } catch {}
        Write-Host "Services stopped" -ForegroundColor Green
    }
    "4" {
        Write-Host "Select service to view logs:" -ForegroundColor Cyan
        Write-Host "1) All services"
        Write-Host "2) Backend only"
        Write-Host "3) Frontend only"
        $logChoice = Read-Host "Enter your choice [1-3]"
        
        switch ($logChoice) {
            "1" { docker-compose logs -f }
            "2" { docker-compose logs -f backend }
            "3" { docker-compose logs -f frontend }
            default { Write-Host "Invalid choice" -ForegroundColor Red }
        }
    }
    "5" {
        Write-Host "Rebuilding services..." -ForegroundColor Yellow
        docker-compose build --no-cache
        docker-compose up -d
        Write-Host "Services rebuilt and started" -ForegroundColor Green
    }
    default {
        Write-Host "Invalid choice" -ForegroundColor Red
        exit 1
    }
}
