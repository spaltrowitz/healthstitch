#!/bin/bash
set -e

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

# Check .env
if [ ! -f .env ]; then
  echo "⚠️  No .env file found. Creating from .env.example..."
  cp .env.example .env
  echo "WHOOP_AUTO_SYNC=true" >> .env
  echo ""
  echo "📝 Edit .env with your WHOOP credentials:"
  echo "   WHOOP_CLIENT_ID=your_id_here"
  echo "   WHOOP_CLIENT_SECRET=your_secret_here"
  echo ""
  echo "   Get them at: https://developer.whoop.com"
  echo ""
fi

# Check if WHOOP credentials are set
if grep -q "your_whoop_client_id" .env 2>/dev/null; then
  echo "⚠️  WHOOP credentials not configured yet — dashboard will work but WHOOP sync won't."
  echo "   Edit .env when you're ready."
  echo ""
fi

# Install deps if needed
if [ ! -d backend/node_modules ]; then
  echo "📦 Installing backend dependencies..."
  (cd backend && npm install --quiet)
fi
if [ ! -d frontend/node_modules ]; then
  echo "📦 Installing frontend dependencies..."
  (cd frontend && npm install --quiet)
fi

# Kill any existing processes on our ports
lsof -ti:3000 2>/dev/null | xargs kill 2>/dev/null || true
lsof -ti:5173 2>/dev/null | xargs kill 2>/dev/null || true
sleep 1

# Start backend
echo "🔧 Starting backend on http://localhost:3000..."
(cd backend && node src/server.js) &
BACKEND_PID=$!
sleep 2

# Start frontend
echo "⚛️  Starting frontend on http://localhost:5173..."
(cd frontend && npx vite dev --host) &
FRONTEND_PID=$!
sleep 2

echo ""
echo "✅ HealthStitch is running!"
echo "   Dashboard: http://localhost:5173"
echo "   API:       http://localhost:3000"
echo ""
echo "   Press Ctrl+C to stop both servers."

# Open browser
if command -v open &>/dev/null; then
  open http://localhost:5173
fi

# Cleanup on exit
trap "kill $BACKEND_PID $FRONTEND_PID 2>/dev/null; echo ''; echo 'Servers stopped.'" EXIT

wait
