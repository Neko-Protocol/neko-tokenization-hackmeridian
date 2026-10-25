"""MCP server over HTTP (Streamable HTTP transport, JSON responses only).

Same tools as the stdio server, for clients that connect to a URL: Claude.ai
custom connectors, the Claude apps, other hosted agents. Standard library only.

  NEKO_LEGAL_KB_TOKEN=<secret> PORT=8080 python3 -m neko_legal_kb.http_server

Endpoint: POST /mcp/<token>, or POST /mcp with "Authorization: Bearer <token>".
Without NEKO_LEGAL_KB_TOKEN the endpoint is plain /mcp with no auth (local use only).
GET /health answers "ok" for health checks (/healthz too, but Cloud Run reserves it).
"""

import hmac
import json
import os
import sys
import threading
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

if __package__ in (None, ""):  # allow running as a plain script
    sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
    from neko_legal_kb.mcp_server import Server
else:
    from .mcp_server import Server

MAX_BODY = 1_000_000


def make_handler(server, token):
    lock = threading.Lock()  # one SQLite connection is shared by all requests

    class Handler(BaseHTTPRequestHandler):
        protocol_version = "HTTP/1.1"
        server_version = "neko-legal-kb"

        def authorized(self):
            if not token:
                return self.path.rstrip("/") == "/mcp"
            if self.path.rstrip("/") == "/mcp":
                given = self.headers.get("Authorization", "").removeprefix("Bearer ").strip()
            elif self.path.startswith("/mcp/"):
                given = self.path[len("/mcp/"):].rstrip("/")
            else:
                return False
            return hmac.compare_digest(given.encode(), token.encode())

        def send(self, status, body=b"", content_type="application/json"):
            self.send_response(status)
            if body:
                self.send_header("Content-Type", content_type)
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)

        def do_GET(self):
            if self.path in ("/health", "/healthz"):  # Cloud Run reserves paths ending in z
                return self.send(200, b"ok", "text/plain")
            if self.authorized():  # no server-initiated stream
                return self.send(405, b"Method not allowed", "text/plain")
            self.send(404, b"Not found", "text/plain")

        def do_DELETE(self):
            self.do_GET()

        def do_POST(self):
            length = int(self.headers.get("Content-Length") or 0)
            if length > MAX_BODY:
                self.close_connection = True  # unread body would corrupt the next request
                return self.send(413, b"Request too large", "text/plain")
            body = self.rfile.read(length)
            if not self.authorized():
                return self.send(404, b"Not found", "text/plain")
            try:
                payload = json.loads(body)
            except (json.JSONDecodeError, UnicodeDecodeError):
                err = {"jsonrpc": "2.0", "id": None, "error": {"code": -32700, "message": "Parse error"}}
                return self.send(400, json.dumps(err).encode())
            msgs = payload if isinstance(payload, list) else [payload]
            if not all(isinstance(m, dict) for m in msgs):
                err = {"jsonrpc": "2.0", "id": None, "error": {"code": -32600, "message": "Invalid request"}}
                return self.send(400, json.dumps(err).encode())
            with lock:
                replies = [r for r in (server.handle(m) for m in msgs) if r is not None]
            if not replies:  # only notifications or responses
                return self.send(202)
            out = replies if isinstance(payload, list) else replies[0]
            self.send(200, json.dumps(out, ensure_ascii=False).encode())

        def log_message(self, fmt, *args):  # keep tokens out of the logs
            path = self.path.split("/mcp/")[0] + "/mcp/***" if "/mcp/" in self.path else self.path
            sys.stderr.write(f"{self.command} {path} {args[1] if len(args) > 1 else ''}\n")

    return Handler


def serve(host="0.0.0.0", port=8080, token=None, kb=None):
    httpd = ThreadingHTTPServer((host, port), make_handler(Server(kb), token))
    return httpd


def main():
    token = os.environ.get("NEKO_LEGAL_KB_TOKEN") or None
    port = int(os.environ.get("PORT", "8080"))
    host = os.environ.get("HOST", "0.0.0.0" if token else "127.0.0.1")
    if not token and os.environ.get("K_SERVICE"):  # set by Cloud Run
        sys.exit("NEKO_LEGAL_KB_TOKEN is not set. Add it to the service (Variables & secrets) and redeploy.")
    if not token:
        sys.stderr.write("NEKO_LEGAL_KB_TOKEN not set: serving /mcp without auth on localhost only.\n")
    httpd = serve(host, port, token)
    sys.stderr.write(f"neko-legal-kb MCP listening on {host}:{port}\n")
    httpd.serve_forever()


if __name__ == "__main__":
    main()
