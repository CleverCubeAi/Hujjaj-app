# Server Deployment Checklist - IP: 3.139.234.93

Use this checklist to deploy your Ashamel platform step by step.

## ☑️ Pre-Deployment Checklist

- [ ] Server access confirmed (SSH working)
- [ ] Supabase project created
- [ ] Supabase credentials ready (URL, service role key, anon key)
- [ ] Domain name ready (optional)
- [ ] SSL certificate plan (Let's Encrypt recommended)

## 📋 Deployment Steps

### 1. Connect to Server

```powershell
# From Windows
ssh -i "your-key.pem" ubuntu@3.139.234.93

# Or if using password
ssh username@3.139.234.93
```

**Status:** ⬜ Not started | ✅ Complete

---

### 2. Install Docker & Docker Compose

```bash
# On the server
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh

sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose

# Verify
docker --version
docker-compose --version
```

**Status:** ⬜ Not started | ✅ Complete

---

### 3. Configure Firewall/Security Groups

**AWS Security Group Rules:**
- [ ] HTTP (80) - 0.0.0.0/0
- [ ] HTTPS (443) - 0.0.0.0/0
- [ ] SSH (22) - Your IP only
- [ ] Custom TCP (3001) - 0.0.0.0/0 (optional)

**Ubuntu UFW:**
```bash
sudo ufw allow 22/tcp
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw enable
```

**Status:** ⬜ Not started | ✅ Complete

---

### 4. Upload Project Files

**Option A: Using quick-deploy script (Recommended)**
```powershell
# From Windows
.\quick-deploy.ps1
# Select option 6 (Full deployment)
```

**Option B: Manual upload**
```powershell
# Create a zip/tar file and upload
scp -i "your-key.pem" project.tar.gz ubuntu@3.139.234.93:~/
```

**Status:** ⬜ Not started | ✅ Complete

---

### 5. Configure Environment Variables

On the server:
```bash
cd ~/Traveling
cp env.example .env
nano .env
```

**Required values to update:**
```env
SUPABASE_URL=https://xxxxxxxxxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJhbGci...
SUPABASE_ANON_KEY=eyJhbGci...
VITE_API_URL=http://3.139.234.93:3001/api
```

**Status:** ⬜ Not started | ✅ Complete

---

### 6. Run Database Migrations

In Supabase Dashboard:
- [ ] Go to SQL Editor
- [ ] Run `001_initial_schema.sql`
- [ ] Run `002_rls_policies.sql`
- [ ] Continue with remaining migration files in order
- [ ] Verify tables are created

**Status:** ⬜ Not started | ✅ Complete

---

### 7. Deploy Application

```bash
cd ~/Traveling
docker-compose up -d --build
```

**Status:** ⬜ Not started | ✅ Complete

---

### 8. Verify Deployment

```bash
# Check containers are running
docker-compose ps

# Check logs
docker-compose logs

# Test endpoints
curl http://localhost
curl http://localhost:3001/health
```

**From your browser:**
- [ ] Frontend loads: http://3.139.234.93
- [ ] Backend API works: http://3.139.234.93:3001/health
- [ ] Can login/register

**Status:** ⬜ Not started | ✅ Complete

---

### 9. Setup Domain (Optional)

**DNS Configuration:**
- [ ] A record: @ → 3.139.234.93
- [ ] A record: www → 3.139.234.93
- [ ] Wait for DNS propagation (5-60 minutes)

**Update .env:**
```env
VITE_API_URL=https://yourdomain.com/api
DOMAIN=yourdomain.com
```

**Status:** ⬜ Not started | ⬜ Skipped | ✅ Complete

---

### 10. Setup SSL Certificate (Optional)

```bash
# Install certbot
sudo apt install -y certbot

# Get certificate
sudo certbot certonly --standalone -d yourdomain.com -d www.yourdomain.com

# Copy to project
sudo cp /etc/letsencrypt/live/yourdomain.com/fullchain.pem ~/Traveling/nginx/ssl/
sudo cp /etc/letsencrypt/live/yourdomain.com/privkey.pem ~/Traveling/nginx/ssl/
sudo chown $USER:$USER ~/Traveling/nginx/ssl/*.pem

# Update nginx config
nano ~/Traveling/nginx/production.conf
# Replace 'your-domain.com' with actual domain

# Deploy with SSL
docker-compose -f docker-compose.prod.yml up -d --build
```

**Status:** ⬜ Not started | ⬜ Skipped | ✅ Complete

---

### 11. Setup Auto-Renewal for SSL (Optional)

```bash
# Test renewal
sudo certbot renew --dry-run

# Add cron job
sudo crontab -e
# Add: 0 0,12 * * * certbot renew --quiet --post-hook "docker-compose -f /home/ubuntu/Traveling/docker-compose.prod.yml restart nginx"
```

**Status:** ⬜ Not started | ⬜ Skipped | ✅ Complete

---

## 🎯 Post-Deployment

### Monitoring Setup
- [ ] Test monitoring script: `./monitor.sh`
- [ ] Setup uptime monitoring (UptimeRobot, etc.)
- [ ] Configure log rotation

### Backup Strategy
- [ ] Backup uploads directory regularly
- [ ] Backup environment variables
- [ ] Document restoration procedure

### Security Hardening
- [ ] Change default SSH port (optional)
- [ ] Disable root login
- [ ] Setup fail2ban (optional)
- [ ] Regular security updates scheduled

### Performance
- [ ] Test application performance
- [ ] Monitor resource usage
- [ ] Setup CDN (optional for images)

---

## 🚨 Troubleshooting

### Container won't start
```bash
docker-compose logs backend
docker-compose logs frontend
```

### Can't access from browser
1. Check security group rules
2. Verify containers: `docker-compose ps`
3. Test locally: `curl http://localhost`

### Environment variables not loading
1. Verify `.env` exists: `ls -la .env`
2. Check format: `cat .env`
3. Restart containers: `docker-compose restart`

---

## 📞 Quick Commands Reference

```bash
# View status
docker-compose ps

# View logs
docker-compose logs -f

# Restart services
docker-compose restart

# Stop services
docker-compose down

# Update and restart
docker-compose up -d --build

# Monitor
./monitor.sh
```

---

## ✅ Final Verification

Before considering deployment complete:

- [ ] Application loads in browser
- [ ] Can create an account
- [ ] Can login
- [ ] Backend API responds
- [ ] Frontend connects to backend
- [ ] Database queries work
- [ ] File uploads work (if applicable)
- [ ] Translations load correctly
- [ ] No errors in logs

---

## 🎉 Deployment Complete!

**Your application is live at:**

- Without domain: `http://3.139.234.93`
- With domain (HTTP): `http://yourdomain.com`
- With domain (HTTPS): `https://yourdomain.com`

**Next Steps:**
1. Create your first admin user
2. Configure agency settings
3. Add seasons and accommodations
4. Start managing pilgrim bookings!

---

## 📚 Additional Resources

- **Detailed Guide:** [DEPLOYMENT_GUIDE.md](DEPLOYMENT_GUIDE.md)
- **Docker Reference:** [DOCKER.md](DOCKER.md)
- **Quick Start:** [QUICKSTART.md](QUICKSTART.md)
- **Build Notes:** [BUILD_NOTES.md](BUILD_NOTES.md)
