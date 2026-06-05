#!/bin/bash
# ==========================================
# PC Builder Morocco - Deployment Script
# ==========================================
# Run this script on your VPS to deploy the latest changes from GitHub.

echo "Starting Deployment Process..."

# 1. Pull the latest code from the main branch
echo "[1/4] Pulling latest code from GitHub..."
git fetch origin main
git reset --hard origin/main

# 2. Rebuild the Docker containers
echo "[2/4] Building Docker containers (this might take a few minutes)..."
docker-compose build

# 3. Apply changes and restart the services
echo "[3/4] Restarting services with new containers..."
docker-compose up -d

# 4. Clean up old, unused Docker images to save disk space
echo "[4/4] Cleaning up unused Docker images..."
docker image prune -f

echo "=========================================="
echo "Deployment Complete! Your site should be live."
echo "=========================================="
