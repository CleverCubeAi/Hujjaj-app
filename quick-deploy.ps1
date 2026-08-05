# Quick Deployment Script for Remote Server (PowerShell)
# This script helps deploy the Hujjaj platform to a remote server

Write-Host "========================================" -ForegroundColor Blue
Write-Host "  Hujjaj Platform - Remote Deployment" -ForegroundColor Blue
Write-Host "========================================" -ForegroundColor Blue
Write-Host ""

# Configuration
$ServerIP = Read-Host "Enter server IP address [3.139.234.93]"
if ([string]::IsNullOrWhiteSpace($ServerIP)) { $ServerIP = "3.139.234.93" }

$SSHUser = Read-Host "Enter SSH username [ubuntu]"
if ([string]::IsNullOrWhiteSpace($SSHUser)) { $SSHUser = "ubuntu" }

$SSHKey = Read-Host "Enter path to SSH key (leave empty if using password)"

# Build SSH command
if ($SSHKey) {
    $SSHCmd = "ssh -i `"$SSHKey`" $SSHUser@$ServerIP"
    $SCPCmd = "scp -i `"$SSHKey`""
} else {
    $SSHCmd = "ssh $SSHUser@$ServerIP"
    $SCPCmd = "scp"
}

Write-Host ""
Write-Host "Testing connection to $ServerIP..." -ForegroundColor Green

try {
    $testCmd = "$SSHCmd `"echo 'Connection successful'`""
    Invoke-Expression $testCmd
    Write-Host "✓ Connected successfully" -ForegroundColor Green
} catch {
    Write-Host "✗ Connection failed" -ForegroundColor Red
    Write-Host "Please check your credentials and try again"
    exit 1
}

Write-Host ""
Write-Host "Select deployment action:" -ForegroundColor Cyan
Write-Host "1) Install Docker on server"
Write-Host "2) Upload project files"
Write-Host "3) Deploy application"
Write-Host "4) View logs"
Write-Host "5) Update application"
Write-Host "6) Full deployment (all steps)"
$choice = Read-Host "Enter your choice [1-6]"

switch ($choice) {
    "1" {
        Write-Host "Installing Docker on server..." -ForegroundColor Green
        
        $installScript = @"
sudo apt update
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh
sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-`$(uname -s)-`$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose
sudo usermod -aG docker `$USER
docker --version
docker-compose --version
echo 'Docker installed successfully!'
echo 'Please logout and login again for group changes to take effect'
"@
        
        Invoke-Expression "$SSHCmd `"$installScript`""
    }
    
    "2" {
        Write-Host "Uploading project files..." -ForegroundColor Green
        
        # Create archive
        $archivePath = "$env:TEMP\traveling.tar.gz"
        
        Write-Host "Creating archive..." -ForegroundColor Yellow
        
        # Use tar if available (Windows 10+)
        if (Get-Command tar -ErrorAction SilentlyContinue) {
            tar -czf $archivePath `
                --exclude='node_modules' `
                --exclude='dist' `
                --exclude='.git' `
                --exclude='backend/uploads/*' `
                --exclude='*.log' `
                -C (Split-Path -Parent $PSScriptRoot) `
                (Split-Path -Leaf $PSScriptRoot)
        } else {
            Write-Host "tar not found. Please install WSL or use manual upload." -ForegroundColor Red
            exit 1
        }
        
        # Upload to server
        Write-Host "Uploading to server..." -ForegroundColor Yellow
        Invoke-Expression "$SCPCmd `"$archivePath`" $SSHUser@${ServerIP}:~/"
        
        # Extract on server
        $extractScript = @"
rm -rf ~/Traveling
mkdir -p ~/Traveling
tar -xzf ~/traveling.tar.gz -C ~/
rm ~/traveling.tar.gz
echo 'Files uploaded successfully!'
"@
        
        Invoke-Expression "$SSHCmd `"$extractScript`""
        
        # Clean up
        Remove-Item $archivePath
        Write-Host "Upload complete!" -ForegroundColor Green
    }
    
    "3" {
        Write-Host "Deploying application..." -ForegroundColor Green
        
        # Check if .env exists
        if (-not (Test-Path ".env")) {
            Write-Host "Warning: .env file not found" -ForegroundColor Yellow
            Write-Host "Creating from template..."
            Copy-Item "env.example" ".env"
            Write-Host "Please edit .env file with your configuration" -ForegroundColor Yellow
            Read-Host "Press Enter after editing .env file"
        }
        
        # Upload .env
        Invoke-Expression "$SCPCmd .env $SSHUser@${ServerIP}:~/Traveling/.env"
        
        # Deploy on server
        $deployScript = @"
cd ~/Traveling
chmod +x deploy.sh monitor.sh
docker-compose down
docker-compose up -d --build
echo ''
echo 'Deployment complete!'
echo ''
docker-compose ps
"@
        
        Invoke-Expression "$SSHCmd `"$deployScript`""
    }
    
    "4" {
        Write-Host "Viewing logs..." -ForegroundColor Green
        Invoke-Expression "$SSHCmd `"cd ~/Traveling && docker-compose logs -f`""
    }
    
    "5" {
        Write-Host "Updating application..." -ForegroundColor Green
        
        # Create archive
        $archivePath = "$env:TEMP\traveling.tar.gz"
        
        if (Get-Command tar -ErrorAction SilentlyContinue) {
            tar -czf $archivePath `
                --exclude='node_modules' `
                --exclude='dist' `
                --exclude='.git' `
                --exclude='backend/uploads/*' `
                -C (Split-Path -Parent $PSScriptRoot) `
                (Split-Path -Leaf $PSScriptRoot)
        } else {
            Write-Host "tar not found" -ForegroundColor Red
            exit 1
        }
        
        # Upload
        Invoke-Expression "$SCPCmd `"$archivePath`" $SSHUser@${ServerIP}:~/"
        
        # Update on server
        $updateScript = @"
cd ~/Traveling
cp .env .env.backup
docker-compose down
tar -xzf ~/traveling.tar.gz -C ~/
mv .env.backup .env
docker-compose up -d --build
rm ~/traveling.tar.gz
echo 'Update complete!'
docker-compose ps
"@
        
        Invoke-Expression "$SSHCmd `"$updateScript`""
        
        # Clean up
        Remove-Item $archivePath
    }
    
    "6" {
        Write-Host "Starting full deployment..." -ForegroundColor Green
        Write-Host ""
        
        # Step 1: Install Docker
        Write-Host "Step 1: Installing Docker..." -ForegroundColor Blue
        $dockerCheck = @"
if ! command -v docker &> /dev/null; then
    curl -fsSL https://get.docker.com -o get-docker.sh
    sudo sh get-docker.sh
    sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-`$(uname -s)-`$(uname -m)" -o /usr/local/bin/docker-compose
    sudo chmod +x /usr/local/bin/docker-compose
    sudo usermod -aG docker `$USER
fi
docker --version
"@
        Invoke-Expression "$SSHCmd `"$dockerCheck`""
        
        # Step 2: Upload files
        Write-Host ""
        Write-Host "Step 2: Uploading files..." -ForegroundColor Blue
        
        $archivePath = "$env:TEMP\traveling.tar.gz"
        
        if (Get-Command tar -ErrorAction SilentlyContinue) {
            tar -czf $archivePath `
                --exclude='node_modules' `
                --exclude='dist' `
                --exclude='.git' `
                --exclude='backend/uploads/*' `
                -C (Split-Path -Parent $PSScriptRoot) `
                (Split-Path -Leaf $PSScriptRoot)
                
            Invoke-Expression "$SCPCmd `"$archivePath`" $SSHUser@${ServerIP}:~/"
            
            $extractScript = "rm -rf ~/Traveling && mkdir -p ~/Traveling && tar -xzf ~/traveling.tar.gz -C ~/ && rm ~/traveling.tar.gz"
            Invoke-Expression "$SSHCmd `"$extractScript`""
            
            Remove-Item $archivePath
        } else {
            Write-Host "tar not found. Please install WSL." -ForegroundColor Red
            exit 1
        }
        
        # Step 3: Configure environment
        Write-Host ""
        Write-Host "Step 3: Configuring environment..." -ForegroundColor Blue
        
        if (-not (Test-Path ".env")) {
            Copy-Item "env.example" ".env"
            Write-Host "Please edit .env file with your Supabase credentials" -ForegroundColor Yellow
            Read-Host "Press Enter after editing .env"
        }
        
        Invoke-Expression "$SCPCmd .env $SSHUser@${ServerIP}:~/Traveling/.env"
        
        # Step 4: Deploy
        Write-Host ""
        Write-Host "Step 4: Deploying application..." -ForegroundColor Blue
        
        $finalDeploy = @"
cd ~/Traveling
chmod +x deploy.sh monitor.sh
docker-compose up -d --build
echo ''
echo 'Full deployment complete!'
echo ''
docker-compose ps
"@
        
        Invoke-Expression "$SSHCmd `"$finalDeploy`""
        
        Write-Host ""
        Write-Host "========================================" -ForegroundColor Green
        Write-Host "  Deployment Complete!" -ForegroundColor Green
        Write-Host "========================================" -ForegroundColor Green
        Write-Host ""
        Write-Host "Your application is now available at:"
        Write-Host "http://$ServerIP" -ForegroundColor Blue
        Write-Host ""
    }
    
    default {
        Write-Host "Invalid choice" -ForegroundColor Red
        exit 1
    }
}

Write-Host ""
Write-Host "Done!" -ForegroundColor Green
