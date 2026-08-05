# Hujjaj Platform Monitoring Script (PowerShell)
# Check the health and status of all services

Write-Host "========================================" -ForegroundColor Blue
Write-Host "  Hujjaj Platform Health Monitor" -ForegroundColor Blue
Write-Host "========================================" -ForegroundColor Blue
Write-Host ""

# Check if Docker is running
try {
    docker info | Out-Null
    Write-Host "✓ Docker is running" -ForegroundColor Green
} catch {
    Write-Host "✗ Docker is not running" -ForegroundColor Red
    exit 1
}

Write-Host ""

# Check running containers
Write-Host "Container Status:" -ForegroundColor Blue

try {
    $backendStatus = docker inspect -f '{{.State.Status}}' hujjaj-backend 2>$null
    if ($backendStatus -eq "running") {
        Write-Host "✓ Backend:  Running" -ForegroundColor Green
    } else {
        Write-Host "✗ Backend:  $backendStatus" -ForegroundColor Red
    }
} catch {
    Write-Host "✗ Backend:  Not found" -ForegroundColor Yellow
}

try {
    $frontendStatus = docker inspect -f '{{.State.Status}}' hujjaj-frontend 2>$null
    if ($frontendStatus -eq "running") {
        Write-Host "✓ Frontend: Running" -ForegroundColor Green
    } else {
        Write-Host "✗ Frontend: $frontendStatus" -ForegroundColor Red
    }
} catch {
    Write-Host "✗ Frontend: Not found" -ForegroundColor Yellow
}

Write-Host ""

# Check health endpoints
Write-Host "Health Checks:" -ForegroundColor Blue

try {
    $backendHealth = Invoke-WebRequest -Uri "http://localhost:3001/health" -UseBasicParsing -TimeoutSec 5
    if ($backendHealth.StatusCode -eq 200) {
        Write-Host "✓ Backend API:  Healthy (HTTP 200)" -ForegroundColor Green
    }
} catch {
    Write-Host "✗ Backend API:  Unhealthy" -ForegroundColor Red
}

try {
    $frontendHealth = Invoke-WebRequest -Uri "http://localhost/health" -UseBasicParsing -TimeoutSec 5
    if ($frontendHealth.StatusCode -eq 200) {
        Write-Host "✓ Frontend:     Healthy (HTTP 200)" -ForegroundColor Green
    }
} catch {
    Write-Host "✗ Frontend:     Unhealthy" -ForegroundColor Red
}

Write-Host ""

# Resource usage
Write-Host "Resource Usage:" -ForegroundColor Blue
try {
    docker stats --no-stream --format "table {{.Name}}`t{{.CPUPerc}}`t{{.MemUsage}}" hujjaj-backend hujjaj-frontend
} catch {
    Write-Host "Could not retrieve resource usage" -ForegroundColor Yellow
}

Write-Host ""

# Recent logs
Write-Host "Recent Errors (last 10 lines):" -ForegroundColor Blue
try {
    $logs = docker-compose logs --tail=50 2>$null | Select-String -Pattern "error" -CaseSensitive:$false
    if ($logs) {
        Write-Host "Found $($logs.Count) error messages:" -ForegroundColor Red
        $logs | Select-Object -Last 10 | ForEach-Object { Write-Host $_.Line }
    } else {
        Write-Host "No recent errors found" -ForegroundColor Green
    }
} catch {
    Write-Host "Could not retrieve logs" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Blue
Write-Host "For detailed logs, run: docker-compose logs -f" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Blue
