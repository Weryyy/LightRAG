"""
Static file server for the LightRAG UI.

Serves the design folder on http://localhost:8765. The UI calls the LightRAG
REST API directly at http://localhost:9621 — CORS is enabled server-side so
no proxy is needed.

Usage:
    python serve_ui.py
    python serve_ui.py --port 8765
"""

from __future__ import annotations

import argparse
import http.server
import socketserver
from pathlib import Path

ROOT = Path(__file__).resolve().parent


class UIHandler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(ROOT), **kwargs)

    def do_GET(self):
        if self.path in ('', '/'):
            self.path = '/LightRAG UI.html'
        return super().do_GET()

    def end_headers(self):
        self.send_header('Cache-Control', 'no-store')
        super().end_headers()


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--port", type=int, default=8765)
    args = parser.parse_args()

    with socketserver.TCPServer(("127.0.0.1", args.port), UIHandler) as httpd:
        print(f"LightRAG UI serving at http://localhost:{args.port}/")
        print(f"Backend (LightRAG REST): http://localhost:9621")
        print(f"Press Ctrl+C to stop.\n")
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print("\nBye.")


if __name__ == "__main__":
    main()
