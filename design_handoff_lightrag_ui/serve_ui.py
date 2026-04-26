"""
Static file server for the LightRAG UI.

Serves the design folder on http://0.0.0.0:8765. When accessed from a remote
device (e.g. mobile over VPN), the server injects the correct host IP so the
UI calls the LightRAG REST API at the right address instead of localhost.

Also exposes GET /local/document-content/<doc_id> which reconstructs full
document text from kv_store_text_chunks.json (LightRAG has no such endpoint).

Usage:
    python serve_ui.py
    python serve_ui.py --port 8765
    python serve_ui.py --api-port 9621
"""

from __future__ import annotations

import argparse
import http.server
import json
import socket
import socketserver
import urllib.parse
from pathlib import Path

ROOT = Path(__file__).resolve().parent
RAG_STORAGE = Path("D:/LightRAG/rag_storage")

_chunks_cache: dict = {}
_chunks_mtime: float = 0.0


def get_local_ip() -> str:
    try:
        with socket.socket(socket.AF_INET, socket.SOCK_DGRAM) as s:
            s.connect(("8.8.8.8", 80))
            return s.getsockname()[0]
    except Exception:
        return "127.0.0.1"


def load_chunks() -> dict:
    global _chunks_cache, _chunks_mtime
    p = RAG_STORAGE / "kv_store_text_chunks.json"
    if not p.exists():
        return {}
    mtime = p.stat().st_mtime
    if mtime != _chunks_mtime:
        _chunks_cache = json.loads(p.read_text(encoding="utf-8"))
        _chunks_mtime = mtime
    return _chunks_cache


def get_doc_content(doc_id: str) -> str | None:
    chunks = load_chunks()
    doc_chunks = [
        v for v in chunks.values()
        if isinstance(v, dict) and v.get("full_doc_id") == doc_id
    ]
    if not doc_chunks:
        return None
    doc_chunks.sort(key=lambda c: c.get("chunk_order_index", 0))
    return "\n\n".join(c.get("content", "") for c in doc_chunks)


class UIHandler(http.server.SimpleHTTPRequestHandler):
    api_port: int = 9621

    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(ROOT), **kwargs)

    def do_GET(self):
        # Local document content endpoint
        if self.path.startswith("/local/document-content/"):
            doc_id = urllib.parse.unquote(self.path[len("/local/document-content/"):])
            content = get_doc_content(doc_id)
            self._json_response(
                {"content": content, "doc_id": doc_id} if content
                else {"error": "not_found", "doc_id": doc_id},
                status=200 if content else 404,
            )
            return

        if self.path in ('', '/'):
            client_ip = self.client_address[0]
            is_remote = client_ip not in ("127.0.0.1", "::1")
            if is_remote:
                server_ip = get_local_ip()
                api_url = f"http://{server_ip}:{self.api_port}"
                ui_url  = f"http://{server_ip}:{self.server.server_address[1]}"
                self._serve_html_with_injection(api_url, ui_url)
                return
            self.path = '/LightRAG UI.html'
        return super().do_GET()

    def _json_response(self, data: dict, status: int = 200):
        body = json.dumps(data, ensure_ascii=False).encode()
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(body)

    def _serve_html_with_injection(self, api_url: str, ui_url: str):
        html_path = ROOT / "LightRAG UI.html"
        content = html_path.read_bytes()
        injection = (
            f'<script>window.LIGHTRAG_URL="{api_url}";'
            f'window.UI_URL="{ui_url}";</script>\n'
        ).encode()
        content = content.replace(
            b'<script src="api.js"></script>',
            injection + b'<script src="api.js"></script>',
        )
        self.send_response(200)
        self.send_header("Content-Type", "text/html; charset=utf-8")
        self.send_header("Content-Length", str(len(content)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(content)

    def end_headers(self):
        self.send_header("Cache-Control", "no-store")
        super().end_headers()

    def log_message(self, fmt, *args):
        pass


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
