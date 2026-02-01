#!/bin/bash
# Kill processes using ports 5173 (Vite) and 8787 (Wrangler)

PORTS="5173 8787"

for PORT in $PORTS; do
  PID=$(lsof -ti:$PORT 2>/dev/null)
  if [ -n "$PID" ]; then
    echo "🔪 Killing process on port $PORT (PID: $PID)"
    kill -9 $PID 2>/dev/null
  fi
done

echo "✅ Ports cleared"
