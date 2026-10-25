import json
import sys
import threading
import unittest
import urllib.error
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "src"))

from neko_legal_kb.http_server import serve  # noqa: E402

TOKEN = "test-token-123"


class HttpTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.httpd = serve("127.0.0.1", 0, TOKEN)
        cls.base = f"http://127.0.0.1:{cls.httpd.server_address[1]}"
        threading.Thread(target=cls.httpd.serve_forever, daemon=True).start()

    @classmethod
    def tearDownClass(cls):
        cls.httpd.shutdown()
        cls.httpd.server_close()

    def post(self, path, body, headers=None):
        req = urllib.request.Request(
            self.base + path, json.dumps(body).encode(), {"Content-Type": "application/json", **(headers or {})}
        )
        try:
            with urllib.request.urlopen(req) as r:
                raw = r.read()
                return r.status, json.loads(raw) if raw else None
        except urllib.error.HTTPError as e:
            return e.code, None

    def test_initialize_and_search_with_token_in_path(self):
        status, out = self.post(f"/mcp/{TOKEN}", {"jsonrpc": "2.0", "id": 1, "method": "initialize", "params": {}})
        self.assertEqual(status, 200)
        self.assertEqual(out["result"]["serverInfo"]["name"], "neko-legal-kb")
        call = {"name": "search_kb", "arguments": {"query": "zzqqxx"}}
        status, out = self.post(f"/mcp/{TOKEN}", {"jsonrpc": "2.0", "id": 2, "method": "tools/call", "params": call})
        self.assertEqual(status, 200)
        self.assertIn("No results", out["result"]["content"][0]["text"])
        call = {"name": "search_kb", "arguments": {"query": "SUGEF", "k": 2}}
        status, out = self.post(f"/mcp/{TOKEN}", {"jsonrpc": "2.0", "id": 3, "method": "tools/call", "params": call})
        self.assertEqual(status, 200)
        self.assertIn("tokenization-obligations", out["result"]["content"][0]["text"])

    def test_bearer_header(self):
        status, out = self.post(
            "/mcp", {"jsonrpc": "2.0", "id": 1, "method": "tools/list"}, {"Authorization": f"Bearer {TOKEN}"}
        )
        self.assertEqual(status, 200)
        names = [t["name"] for t in out["result"]["tools"]]
        self.assertIn("search_kb", names)
        self.assertIn("search_law", names)
        self.assertEqual(len(names), 7)

    def test_rejects_missing_or_wrong_token(self):
        msg = {"jsonrpc": "2.0", "id": 1, "method": "tools/list"}
        self.assertEqual(self.post("/mcp", msg)[0], 404)
        self.assertEqual(self.post("/mcp/wrong", msg)[0], 404)

    def test_notification_and_batch(self):
        note = {"jsonrpc": "2.0", "method": "notifications/initialized"}
        self.assertEqual(self.post(f"/mcp/{TOKEN}", note)[0], 202)
        status, out = self.post(f"/mcp/{TOKEN}", [note, {"jsonrpc": "2.0", "id": 7, "method": "ping"}])
        self.assertEqual(status, 200)
        self.assertEqual([r["id"] for r in out], [7])

    def test_health(self):
        with urllib.request.urlopen(self.base + "/health") as r:
            self.assertEqual(r.read(), b"ok")


if __name__ == "__main__":
    unittest.main()
