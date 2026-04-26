"""
Static file server for the LightRAG UI.

Serves the design folder on http://0.0.0.0:8765. When accessed from a remote
device (e.g. mobile over VPN), the server injects the correct host IP so the
UI calls the LightRAG REST API at the right address instead of localhost.

Usage:
    python serve_ui.py
    python serve_ui.py --port 8765
    python serve_ui.py --api-port 9621
"""

from __future__ import annotations

import argparse
import http.server
import socket
import socketserver
from pathlib import Path

ROOT = Path(__file__).resolve().parent


def get_local_ip() -> str:
    try:
        with socket.socket(socket.AF_INET, socket.SOCK_DGRAM) as s:
            s.connect(("8.8.8.8", 80))
            return s.getsockname()[0]
    except Exception:
        return "127.0.0.1"


class UIHandler(http.server.SimpleHTTPRequestHandler):
    api_port: int = 9621

    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(ROOT), **kwargs)

    def do_GET(self):
        if self.path in ('', '/'):
            # Detect if request comes from a remote host
            client_ip = self.client_address[0]
            is_remote = client_ip not in ("127.0.0.1", "::1")

            if is_remote:
                server_ip = get_local_ip()
                api_url = f"http://{server_ip}:{self.api_port}"
                self._serve_html_with_injection(api_url)
                return

            self.path = '/LightRAG UI.html'
        return super().do_GET()

    def _serve_html_with_injection(self, api_url: str):
        html_path = ROOT / "LightRAG UI.html"
        content = html_path.read_bytes()
        injection = f'<script>window.LIGHTRAG_URL="{api_url}";</script>\n'.encode()
        content = content.replace(b'<script src="api.js"></script>',
                                  injection + b'<script src="api.js"></script>')
        self.send_response(200)
        self.send_header("Content-Type", "text/html; charset=utf-8")
        self.send_header("Content-Length", str(len(content)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(content)

    def end_headers(self):
        self.send_header('Cache-Control', 'no-store')
        super().end_headers()

    def log_message(self, fmt, *args):
        pass  # silence per-request noise


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--port", type=int, default=8765)
    parser.add_argument("--api-port", type=int, default=9621)
    args = parser.parse_args()

    UIHandler.api_port = args.api_port
    local_ip = get_local_ip()

    with socketserver.TCPServer(("0.0.0.0", args.port), UIHandler) as httpd:
        print(f"LightRAG UI serving at:")
        print(f"  Local:  http://localhost:{args.port}/")
        print(f"  Remote: http://{local_ip}:{args.port}/  (mobile/VPN)")
        print(f"Backend (LightRAG REST): http://localhost:{args.api_port}")
        print(f"Press Ctrl+C to stop.\n")
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print("\nBye.")


if __name__ == "__main__":
    main()
