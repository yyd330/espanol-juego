#!/usr/bin/env bash
# Español Juego — LAN server. NO Python required.
#
#   ./serve.sh            # port 8321
#   ./serve.sh 9000       # custom port
#
# Strategy:
#   1. If gcc/cc exists → compile the tiny C server (serve/serve.c) and run it.
#   2. Fallback: busybox httpd (if available) — serves the whole repo root.
#
# The game opens at  http://<your-LAN-IP>:<port>/web/
set -euo pipefail

PORT="${1:-8321}"
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# --- print LAN IP (best effort, no python) ---
lan_ip() {
  local ip
  # 1) iproute2
  ip=$(ip -4 route get 1.1.1.1 2>/dev/null | sed -n 's/.*src \([0-9.]*\).*/\1/p' | head -1)
  # 2) ifconfig fallback
  [ -z "${ip:-}" ] && ip=$(ifconfig 2>/dev/null | awk '/inet /{if($2!="127.0.0.1"){print $2; exit}}')
  # 3) hostname -I fallback
  [ -z "${ip:-}" ] && ip=$(hostname -I 2>/dev/null | awk '{print $1}')
  echo "${ip:-127.0.0.1}"
}

banner() {
  echo "========================================================"
  echo "  Espanol Juego - LAN server"
  echo "  Open from your phone / laptop:"
  echo "      http://${1}:${PORT}/web/"
  echo "  (local: http://127.0.0.1:${PORT}/web/)"
  echo "  Ctrl+C to stop"
  echo "========================================================"
}

CC=""
if command -v gcc >/dev/null 2>&1; then CC=gcc
elif command -v cc >/dev/null 2>&1; then CC=cc
elif command -v clang >/dev/null 2>&1; then CC=clang
fi

if [ -n "$CC" ]; then
  BIN="$ROOT/serve/serve"
  echo "Compiling static server with $CC ..."
  "$CC" -O2 -o "$BIN" "$ROOT/serve/serve.c" -lpthread
  banner "$(lan_ip)"
  exec "$BIN" "$PORT" "$ROOT"
fi

# --- fallback: busybox httpd (serves repo root; app at /web/) ---
if command -v busybox >/dev/null 2>&1; then
  banner "$(lan_ip)"
  cd "$ROOT"
  exec busybox httpd -f -p "0.0.0.0:${PORT}" -h "$ROOT"
fi

echo "ERROR: no compiler (gcc/cc/clang) and no busybox found. Install one, e.g.:"
echo "  sudo apt install gcc        # Debian/Ubuntu"
echo "  brew install gcc            # macOS"
exit 1
