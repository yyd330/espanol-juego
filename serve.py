#!/usr/bin/env python3
"""Serve the web game to devices on your local network.

Usage:
    python3 serve.py            # serves on port 8321
    python3 serve.py 9000       # custom port

Then open http://<this-machine's-LAN-IP>:PORT/ from any device on the same
Wi-Fi/LAN. Prints the URL to use.
"""
import http.server
import socket
import socketserver
import sys
from pathlib import Path

ROOT = Path(__file__).parent  # repo root: serves /web (app) and /data (content)


def lan_ip() -> str:
    """Best-effort detect the machine's LAN IP (the one phones connect to)."""
    # 1) Try a UDP socket trick (no packet actually sent).
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.connect(("8.8.8.8", 80))
        ip = s.getsockname()[0]
        s.close()
        if ip and not ip.startswith("127."):
            return ip
    except OSError:
        pass
    # 2) Fallback: get the primary IPv4 of the local host.
    try:
        out = socket.getaddrinfo(socket.gethostname(), None, socket.AF_INET)
        for o in out:
            ip = o[4][0]
            if ip and not ip.startswith("127."):
                return ip
    except OSError:
        pass
    return "127.0.0.1"


def main():
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 8321
    host = "0.0.0.0"

    class Handler(http.server.SimpleHTTPRequestHandler):
        def __init__(self, *a, **kw):
            super().__init__(*a, directory=str(ROOT), **kw)

        def log_message(self, *a):  # quiet
            pass

    # serve with keep-alive off (SimpleHTTPRequestHandler is fine), threaded
    socketserver.TCPServer.allow_reuse_address = True
    with socketserver.ThreadingTCPServer((host, port), Handler) as httpd:
        ip = lan_ip()
        print("=" * 56)
        print("  🇲🇽 Español Juego — LAN server")
        print("=" * 56)
        print("  Open from your phone / laptop:")
        print(f"      http://{ip}:{port}/web/")
        print(f"  (local on this machine: http://127.0.0.1:{port}/web/)")
        print("  Ctrl+C to stop")
        print("=" * 56)
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print("\n  Stopped.")


if __name__ == "__main__":
    main()
