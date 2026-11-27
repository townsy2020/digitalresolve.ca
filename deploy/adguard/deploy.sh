#!/usr/bin/env bash
set -euo pipefail

echo "=============================================="
echo "  Deploying AdGuard Home for Digital Resolve  "
echo "=============================================="

INSTALL_DIR="/opt/adguardhome"
SERVER_IP="${SERVER_IP:-192.168.1.100}"
mkdir -p "$INSTALL_DIR/conf" "$INSTALL_DIR/work"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
if [ -f "$SCRIPT_DIR/conf/AdGuardHome.yaml" ]; then
    echo "[+] Applying pre-configured AdGuardHome.yaml..."
    cp -n "$SCRIPT_DIR/conf/AdGuardHome.yaml" "$INSTALL_DIR/conf/AdGuardHome.yaml" || true
fi

cat << 'EOF' > "$INSTALL_DIR/docker-compose.yml"
services:
  adguardhome:
    image: adguard/adguardhome:latest
    container_name: adguardhome
    restart: unless-stopped
    network_mode: host
    volumes:
      - ./work:/opt/adguardhome/work
      - ./conf:/opt/adguardhome/conf
    environment:
      - TZ=America/Toronto
EOF

cd "$INSTALL_DIR"
echo "[+] Starting AdGuard Home via Docker Compose..."
docker compose pull
docker compose up -d

echo ""
echo "=============================================="
echo "  AdGuard Home Deployed Successfully!         "
echo "=============================================="
echo "  Web Admin Dashboard: http://${SERVER_IP}:3000"
echo "  DNS Listener:        ${SERVER_IP}:53"
echo "  Parallel Upstreams:  Cloudflare DoT + Quad9 DoT"
echo "  Local Rewrites:      torrents, cam, files, stream, feeder"
echo "=============================================="
