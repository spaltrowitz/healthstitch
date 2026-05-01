#!/bin/bash
# HealthStitch Cloudflare Tunnel
# Exposes the backend (port 3000) to the internet
# Run: ./scripts/tunnel.sh

echo "🌐 Starting Cloudflare Tunnel for HealthStitch..."
echo "   Backend → localhost:3000"
echo "   Press Ctrl+C to stop"
echo ""

cloudflared tunnel run healthstitch
