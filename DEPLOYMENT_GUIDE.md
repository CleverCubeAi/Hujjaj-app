# Deployment Guide - Server IP: 3.139.234.93

This guide will help you deploy your Hujjaj platform to your server.

## Prerequisites

- ✅ Server access (SSH key or password)
- ✅ Server IP: `3.139.234.93`
- ✅ Domain name (optional, but recommended) — e.g. hujjaj.app

## Step 1: Connect to Your Server

### From Windows PowerShell

```powershell
# If using password authentication
ssh username@3.139.234.93

# If using SSH key (common for AWS EC2)
ssh -i "path\to\your-key.pem" ubuntu@3.139.234.93

# For AWS EC2 Ubuntu instance
ssh -i "your-key.pem" ubuntu@3.139.234.93

# For AWS EC2 Amazon Linux
ssh -i "your-key.pem" ec2-user@3.139.234.93
```

**Note:** Replace `username` with your actual username (common ones: `ubuntu`, `ec2-user`, `admin`, `root`)

## Step 2: Install Docker on the Server

Once connected to your server, run these commands:

### For Ubuntu/Debian

```bash
# Update package index
sudo apt update

# Install required packages
sudo apt install -y apt-transport-https ca-certificates curl software-properties-common

# Add Docker's official GPG key
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /usr/share/keyrings/docker-archive-keyring.gpg

# Add Docker repository
echo "deb [arch=$(dpkg --print-architecture) signed-by=/usr/share/keyrings/docker-archive-keyring.gpg] https://download.docker.com/linux/ubuntu $(lsb_release -cs) stable" | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null

# Update package index again
sudo apt update

# Install Docker
sudo apt install -y docker-ce docker-ce-cli containerd.io

# Install Docker Compose
sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose

# Add your user to docker group (to run docker without sudo)
sudo usermod -aG docker $USER

# Apply group changes (or logout and login again)
newgrp docker

# Verify installation
docker --version
docker-compose --version
```

### For Amazon Linux 2

```bash
# Update packages
sudo yum update -y

# Install Docker
sudo yum install -y docker

# Start Docker service
sudo service docker start

# Add user to docker group
sudo usermod -a -G docker ec2-user

# Install Docker Compose
sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose

# Verify installation
docker --version
docker-compose --version
```

## Step 3: Configure Firewall/Security Groups

### AWS EC2 Security Group Settings

In AWS Console, configure your security group to allow:

| Type | Protocol | Port Range | Source | Description |
|------|----------|------------|--------|-------------|
| HTTP | TCP | 80 | 0.0.0.0/0 | Web traffic |
| HTTPS | TCP | 443 | 0.0.0.0/0 | Secure web traffic |
| Custom TCP | TCP | 3001 | 0.0.0.0/0 | Backend API (optional) |
| SSH | TCP | 22 | Your IP | SSH access |

### Ubuntu UFW Firewall

```bash
# Enable firewall
sudo ufw enable

# Allow SSH (important - don't lock yourself out!)
sudo ufw allow 22/tcp

# Allow HTTP and HTTPS
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp

# Allow backend API (optional - if accessing directly)
sudo ufw allow 3001/tcp

# Check status
sudo ufw status
```

## Step 4: Transfer Your Code to the Server

### Option A: Using Git (Recommended)

```bash
# On the server
cd ~
git clone <your-repository-url> Traveling
cd Traveling
```

### Option B: Using SCP from Windows

```powershell
# From your Windows machine
# Compress the project (excluding node_modules)
Compress-Archive -Path "d:\Traveling\*" -DestinationPath "d:\Traveling.zip" -Force

# Upload to server
scp -i "your-key.pem" d:\Traveling.zip ubuntu@3.139.234.93:~/

# Then on the server
ssh -i "your-key.pem" ubuntu@3.139.234.93
unzip Traveling.zip -d Traveling
cd Traveling
```

### Option C: Using rsync

```bash
# From your Windows WSL or Git Bash
rsync -avz -e "ssh -i your-key.pem" \
  --exclude 'node_modules' \
  --exclude '.git' \
  --exclude 'backend/uploads' \
  /mnt/d/Traveling/ ubuntu@3.139.234.93:~/Traveling/
```

## Step 5: Configure Environment Variables

On your server:

```bash
cd ~/Traveling

# Copy environment template
cp env.example .env

# Edit the .env file
nano .env
```

**Important:** Update these values in `.env`:

```env
POSTGRES_USER=hujjaj
POSTGRES_PASSWORD=change-me
POSTGRES_DB=hujjaj
DATABASE_URL=postgres://hujjaj:change-me@postgres:5432/hujjaj
JWT_SECRET=replace-with-a-long-random-secret
JWT_EXPIRES_IN=7d
PORT=3001
NODE_ENV=production
PUBLIC_URL=https://hujjaj.app
VITE_API_URL=/api
```

**Save and exit:** Press `Ctrl+X`, then `Y`, then `Enter`

## Step 6: Deploy with Docker

```bash
# Make sure you're in the project directory
cd ~/Traveling

# Build and start the containers
docker-compose up -d --build

# View logs to check everything is working
docker-compose logs -f

# Press Ctrl+C to exit logs
```

## Step 7: Verify Deployment

### Check Container Status

```bash
docker-compose ps
```

You should see both containers running:
- `hujjaj-backend` (port 3001)
- `hujjaj-frontend` (port 80)

### Test the Application

From your browser:
- **Frontend:** http://3.139.234.93
- **Backend API:** http://3.139.234.93:3001/health

### Check Logs

```bash
# All logs
docker-compose logs

# Backend only
docker-compose logs backend

# Frontend only
docker-compose logs frontend

# Follow logs (real-time)
docker-compose logs -f
```

## Step 8: Setup Domain Name (Optional but Recommended)

### 8.1 Point Domain to Server IP

In your domain registrar (GoDaddy, Namecheap, etc.), add these DNS records:

| Type | Name | Value | TTL |
|------|------|-------|-----|
| A | @ | 3.139.234.93 | 3600 |
| A | www | 3.139.234.93 | 3600 |

**Note:** DNS propagation can take 5-60 minutes.

### 8.2 Update Environment Variables

Edit `.env` on the server:

```bash
nano .env
```

Update:
```env
VITE_API_URL=https://yourdomain.com/api
DOMAIN=yourdomain.com
```

### 8.3 Use Production Docker Compose with SSL

```bash
# Stop current deployment
docker-compose down

# Create nginx/ssl directory
mkdir -p nginx/ssl

# Deploy with production config
docker-compose -f docker-compose.prod.yml up -d --build
```

### 8.4 Setup SSL with Let's Encrypt

```bash
# Install Certbot
sudo apt install -y certbot

# Get SSL certificate
sudo certbot certonly --standalone -d yourdomain.com -d www.yourdomain.com

# Copy certificates to nginx directory
sudo cp /etc/letsencrypt/live/yourdomain.com/fullchain.pem ~/Traveling/nginx/ssl/
sudo cp /etc/letsencrypt/live/yourdomain.com/privkey.pem ~/Traveling/nginx/ssl/
sudo chown $USER:$USER ~/Traveling/nginx/ssl/*.pem

# Update nginx/production.conf with your domain name
nano nginx/production.conf
# Replace 'your-domain.com' with your actual domain

# Restart containers
docker-compose -f docker-compose.prod.yml restart
```

## Step 9: Setup Auto-Renewal for SSL

```bash
# Test renewal
sudo certbot renew --dry-run

# Add cron job for auto-renewal
sudo crontab -e

# Add this line (runs twice daily):
0 0,12 * * * certbot renew --quiet --post-hook "docker-compose -f /home/ubuntu/Traveling/docker-compose.prod.yml restart nginx"
```

## Step 10: Monitor Your Application

### Using the Monitor Script

```bash
cd ~/Traveling
./monitor.sh
```

### Manual Monitoring

```bash
# Check container status
docker-compose ps

# Check resource usage
docker stats

# View logs
docker-compose logs -f

# Check disk space
df -h

# Check memory
free -h
```

## Maintenance Commands

### Update Application

```bash
cd ~/Traveling

# Pull latest code (if using Git)
git pull

# Rebuild and restart
docker-compose down
docker-compose up -d --build
```

### Restart Services

```bash
# Restart all services
docker-compose restart

# Restart specific service
docker-compose restart backend
docker-compose restart frontend
```

### View Logs

```bash
# All logs
docker-compose logs

# Recent logs (last 100 lines)
docker-compose logs --tail=100

# Follow logs (real-time)
docker-compose logs -f
```

### Backup Data

```bash
# Backup uploads
tar -czf backup-uploads-$(date +%Y%m%d).tar.gz backend/uploads/

# Upload to S3 (if using AWS)
aws s3 cp backup-uploads-$(date +%Y%m%d).tar.gz s3://your-bucket/backups/
```

## Troubleshooting

### Container Won't Start

```bash
# View detailed logs
docker-compose logs backend
docker-compose logs frontend

# Check if ports are in use
sudo netstat -tlnp | grep -E '80|3001'

# Restart Docker daemon
sudo systemctl restart docker
```

### Out of Disk Space

```bash
# Check disk usage
df -h

# Clean up Docker
docker system prune -a

# Remove old images
docker image prune -a
```

### High Memory Usage

```bash
# Check memory
free -h

# Check Docker stats
docker stats

# Restart containers
docker-compose restart
```

### Can't Connect to Application

1. **Check firewall rules** (Security Groups on AWS)
2. **Verify containers are running:** `docker-compose ps`
3. **Check logs:** `docker-compose logs`
4. **Test locally on server:** `curl http://localhost`
5. **Check DNS** (if using domain): `nslookup yourdomain.com`

## Security Best Practices

### 1. Change SSH Port (Optional)

```bash
sudo nano /etc/ssh/sshd_config
# Change Port 22 to Port 2222
sudo systemctl restart sshd
```

### 2. Disable Root Login

```bash
sudo nano /etc/ssh/sshd_config
# Set: PermitRootLogin no
sudo systemctl restart sshd
```

### 3. Setup Firewall

```bash
sudo ufw enable
sudo ufw allow 22/tcp
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
```

### 4. Keep System Updated

```bash
# Update regularly
sudo apt update && sudo apt upgrade -y
```

### 5. Setup Monitoring

Consider using:
- AWS CloudWatch (if on AWS)
- Uptime Robot (free monitoring)
- Netdata (self-hosted monitoring)

## Quick Reference

### Useful Commands

```bash
# Start services
docker-compose up -d

# Stop services
docker-compose down

# View logs
docker-compose logs -f

# Restart services
docker-compose restart

# Update and restart
git pull && docker-compose up -d --build

# Check status
docker-compose ps

# Check resource usage
docker stats
```

### Important Paths

- **Application:** `~/Traveling`
- **Logs:** `docker-compose logs`
- **Uploads:** `~/Traveling/backend/uploads`
- **SSL Certs:** `~/Traveling/nginx/ssl`
- **Environment:** `~/Traveling/.env`

## Support

- **Quick Start:** See [QUICKSTART.md](QUICKSTART.md)
- **Docker Details:** See [DOCKER.md](DOCKER.md)
- **Build Issues:** See [BUILD_NOTES.md](BUILD_NOTES.md)

---

**Your application should now be live at:** http://3.139.234.93

Once you configure a domain and SSL, it will be available at: https://yourdomain.com
