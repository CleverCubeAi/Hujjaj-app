#!/bin/bash

# Quick Deployment Script for Remote Server
# This script helps deploy the Hujjaj platform to a remote server

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}  Hujjaj Platform - Remote Deployment${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""

# Configuration
read -p "Enter server IP address [3.139.234.93]: " SERVER_IP
SERVER_IP=${SERVER_IP:-3.139.234.93}

read -p "Enter SSH username [ubuntu]: " SSH_USER
SSH_USER=${SSH_USER:-ubuntu}

read -p "Enter path to SSH key (leave empty if using password): " SSH_KEY

# Build SSH command
if [ -n "$SSH_KEY" ]; then
    SSH_CMD="ssh -i $SSH_KEY $SSH_USER@$SERVER_IP"
    SCP_CMD="scp -i $SSH_KEY"
else
    SSH_CMD="ssh $SSH_USER@$SERVER_IP"
    SCP_CMD="scp"
fi

echo ""
echo -e "${GREEN}Testing connection to $SERVER_IP...${NC}"

if $SSH_CMD "echo 'Connection successful'"; then
    echo -e "${GREEN}✓ Connected successfully${NC}"
else
    echo -e "${RED}✗ Connection failed${NC}"
    echo "Please check your credentials and try again"
    exit 1
fi

echo ""
echo "Select deployment action:"
echo "1) Install Docker on server"
echo "2) Upload project files"
echo "3) Deploy application"
echo "4) View logs"
echo "5) Update application"
echo "6) Full deployment (all steps)"
read -p "Enter your choice [1-6]: " choice

case $choice in
    1)
        echo -e "${GREEN}Installing Docker on server...${NC}"
        $SSH_CMD << 'EOF'
            # Update system
            sudo apt update
            
            # Install Docker
            curl -fsSL https://get.docker.com -o get-docker.sh
            sudo sh get-docker.sh
            
            # Install Docker Compose
            sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
            sudo chmod +x /usr/local/bin/docker-compose
            
            # Add user to docker group
            sudo usermod -aG docker $USER
            
            # Verify
            docker --version
            docker-compose --version
            
            echo "Docker installed successfully!"
            echo "Please logout and login again for group changes to take effect"
EOF
        ;;
    
    2)
        echo -e "${GREEN}Uploading project files...${NC}"
        
        # Create archive excluding unnecessary files
        tar -czf /tmp/traveling.tar.gz \
            --exclude='node_modules' \
            --exclude='dist' \
            --exclude='.git' \
            --exclude='backend/uploads/*' \
            --exclude='*.log' \
            -C "$(dirname "$(pwd)")" "$(basename "$(pwd)")"
        
        # Upload to server
        $SCP_CMD /tmp/traveling.tar.gz $SSH_USER@$SERVER_IP:~/
        
        # Extract on server
        $SSH_CMD << 'EOF'
            rm -rf ~/Traveling
            mkdir -p ~/Traveling
            tar -xzf ~/traveling.tar.gz -C ~/
            rm ~/traveling.tar.gz
            echo "Files uploaded successfully!"
EOF
        
        # Clean up local archive
        rm /tmp/traveling.tar.gz
        ;;
    
    3)
        echo -e "${GREEN}Deploying application...${NC}"
        
        # Check if .env exists locally
        if [ ! -f .env ]; then
            echo -e "${YELLOW}Warning: .env file not found${NC}"
            echo "Creating from template..."
            cp env.example .env
            echo -e "${YELLOW}Please edit .env file with your configuration${NC}"
            read -p "Press Enter after editing .env file..."
        fi
        
        # Upload .env file
        $SCP_CMD .env $SSH_USER@$SERVER_IP:~/Traveling/.env
        
        # Deploy on server
        $SSH_CMD << 'EOF'
            cd ~/Traveling
            
            # Make scripts executable
            chmod +x deploy.sh monitor.sh
            
            # Deploy
            docker-compose down
            docker-compose up -d --build
            
            # Show status
            echo ""
            echo "Deployment complete!"
            echo ""
            docker-compose ps
EOF
        ;;
    
    4)
        echo -e "${GREEN}Viewing logs...${NC}"
        $SSH_CMD "cd ~/Traveling && docker-compose logs -f"
        ;;
    
    5)
        echo -e "${GREEN}Updating application...${NC}"
        
        # Upload files
        tar -czf /tmp/traveling.tar.gz \
            --exclude='node_modules' \
            --exclude='dist' \
            --exclude='.git' \
            --exclude='backend/uploads/*' \
            -C "$(dirname "$(pwd)")" "$(basename "$(pwd)")"
        
        $SCP_CMD /tmp/traveling.tar.gz $SSH_USER@$SERVER_IP:~/
        
        # Update on server
        $SSH_CMD << 'EOF'
            cd ~/Traveling
            
            # Backup current .env
            cp .env .env.backup
            
            # Stop services
            docker-compose down
            
            # Extract new files
            tar -xzf ~/traveling.tar.gz -C ~/
            
            # Restore .env
            mv .env.backup .env
            
            # Rebuild and restart
            docker-compose up -d --build
            
            # Clean up
            rm ~/traveling.tar.gz
            
            echo "Update complete!"
            docker-compose ps
EOF
        
        rm /tmp/traveling.tar.gz
        ;;
    
    6)
        echo -e "${GREEN}Starting full deployment...${NC}"
        echo ""
        
        # Step 1: Install Docker
        echo -e "${BLUE}Step 1: Installing Docker...${NC}"
        $SSH_CMD << 'EOF'
            if ! command -v docker &> /dev/null; then
                curl -fsSL https://get.docker.com -o get-docker.sh
                sudo sh get-docker.sh
                sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
                sudo chmod +x /usr/local/bin/docker-compose
                sudo usermod -aG docker $USER
            fi
            docker --version
EOF
        
        # Step 2: Upload files
        echo ""
        echo -e "${BLUE}Step 2: Uploading files...${NC}"
        tar -czf /tmp/traveling.tar.gz \
            --exclude='node_modules' \
            --exclude='dist' \
            --exclude='.git' \
            --exclude='backend/uploads/*' \
            -C "$(dirname "$(pwd)")" "$(basename "$(pwd)")"
        $SCP_CMD /tmp/traveling.tar.gz $SSH_USER@$SERVER_IP:~/
        $SSH_CMD "rm -rf ~/Traveling && mkdir -p ~/Traveling && tar -xzf ~/traveling.tar.gz -C ~/ && rm ~/traveling.tar.gz"
        rm /tmp/traveling.tar.gz
        
        # Step 3: Configure environment
        echo ""
        echo -e "${BLUE}Step 3: Configuring environment...${NC}"
        if [ ! -f .env ]; then
            cp env.example .env
            echo -e "${YELLOW}Please edit .env file with your Supabase credentials${NC}"
            read -p "Press Enter after editing .env..."
        fi
        $SCP_CMD .env $SSH_USER@$SERVER_IP:~/Traveling/.env
        
        # Step 4: Deploy
        echo ""
        echo -e "${BLUE}Step 4: Deploying application...${NC}"
        $SSH_CMD << 'EOF'
            cd ~/Traveling
            chmod +x deploy.sh monitor.sh
            docker-compose up -d --build
            echo ""
            echo "Full deployment complete!"
            echo ""
            docker-compose ps
EOF
        
        echo ""
        echo -e "${GREEN}========================================${NC}"
        echo -e "${GREEN}  Deployment Complete!${NC}"
        echo -e "${GREEN}========================================${NC}"
        echo ""
        echo "Your application is now available at:"
        echo -e "${BLUE}http://$SERVER_IP${NC}"
        echo ""
        ;;
    
    *)
        echo -e "${RED}Invalid choice${NC}"
        exit 1
        ;;
esac

echo ""
echo -e "${GREEN}Done!${NC}"
