import json
import re
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "src"))

from neko_legal_kb.cli import llms_txt, run_eval  # noqa: E402
from neko_legal_kb.corpus import chunks_of, load_documents  # noqa: E402
from neko_legal_kb.search import KnowledgeBase  # noqa: E402

STRENGTHS = {"primary", "official", "secondary"}
CITATION_ID = re.compile(r"\b([a-z0-9-]+:(?:art|sec)-[0-9a-z.\-]+)")


class CorpusTest(unittest.TestCase):
    docs = load_documents()

    def test_empty_corpus_loads(self):
        self.assertEqual(load_documents(ROOT / "no-such-corpus"), [])
        with tempfile.TemporaryDirectory() as tmp:
            empty = Path(tmp) / "corpus"
            empty.mkdir()
            self.assertEqual(load_documents(empty), [])
            kb = KnowledgeBase(root=empty)
            self.assertEqual(kb.docs, {})
            self.assertEqual(kb.search("oferta publica", 5), [])
            self.assertEqual(kb.search("zzqqxx", 5), [])

    def test_tokenization_obligations_loaded(self):
        doc = next(d for d in self.docs if d.id == "tokenization-obligations")
        self.assertEqual(doc.topic, "obligations")

    def test_corpus_citations_resolve_in_laws(self):
        missing = []
        for path in sorted((ROOT / "corpus").rglob("*.md")):
            text = path.read_text(encoding="utf-8")
            for cite in set(CITATION_ID.findall(text)):
                norm = cite.split(":", 1)[0]
                articles_path = ROOT / "laws" / norm / "articles.jsonl"
                if not articles_path.exists():
                    continue
                ids = {
                    json.loads(ln)["id"]
                    for ln in articles_path.read_text(encoding="utf-8").splitlines()
                    if ln.strip()
                }
                resolved = cite if cite in ids else cite.rstrip(".")
                if resolved not in ids:
                    missing.append(cite)
        self.assertEqual(missing, [], f"missing article ids: {sorted(missing)}")

    def test_frontmatter(self):
        ids = [d.id for d in self.docs]
        self.assertEqual(len(ids), len(set(ids)), "duplicate ids")
        for d in self.docs:
            with self.subTest(doc=d.id):
                self.assertTrue(d.topic)
                self.assertTrue(d.as_of == "" or re.match(r"^\d{4}-\d{2}-\d{2}$", d.as_of))
                if d.verified:
                    self.assertIn(d.verified, STRENGTHS)
                for s in d.sources:
                    url = s.get("url", "")
                    self.assertTrue(url.startswith("https://") or url.startswith("http://"), s)
                    if s.get("type"):
                        self.assertIn(s.get("type"), STRENGTHS | {"primary"}, s)

    def test_section_keywords_optional(self):
        for d in self.docs:
            for c in chunks_of(d):
                with self.subTest(chunk=c.chunk_id):
                    self.assertNotIn("<!--", c.text)

    def test_links_resolve(self):
        ids = {d.id for d in self.docs}
        for d in self.docs:
            for link in re.findall(r"\[\[([^\]]+)\]\]", d.body):
                self.assertIn(link, ids, f"{d.id} links to unknown [[{link}]]")

    def test_no_em_dashes(self):
        for path in list(ROOT.rglob("*.md")) + [ROOT / "llms.txt"]:
            if not path.exists():
                continue
            # laws/ holds verbatim legal text, which keeps the source's punctuation.
            if ".git" not in path.parts and "laws" not in path.relative_to(ROOT).parts:
                self.assertNotIn("\u2014", path.read_text(encoding="utf-8"), path)

    def test_small_corpus_roundtrip(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            topic = root / "corpus" / "obligations"
            topic.mkdir(parents=True)
            (topic / "sample.md").write_text(
                "---\n"
                "id: sample-doc\n"
                "title: Sample\n"
                "topic: obligations\n"
                "as_of: 2026-10-25\n"
                "strength: secondary\n"
                "in_force: yes\n"
                "sources:\n"
                "  - label: Example\n"
                "    url: https://example.org/x\n"
                "    type: secondary\n"
                "---\n"
                "\n"
                "## Oferta publica\n"
                "<!-- es: oferta publica valores -->\n"
                "\n"
                "Texto sobre oferta publica de valores.\n",
                encoding="utf-8",
            )
            docs = load_documents(root / "corpus")
            self.assertEqual(len(docs), 1)
            self.assertEqual(docs[0].verified, "secondary")
            self.assertEqual(docs[0].status, "yes")
            kb = KnowledgeBase(root=root / "corpus", laws_root=ROOT / "laws")
            hits = kb.search("oferta publica", 3)
            self.assertTrue(hits)
            self.assertEqual(hits[0]["doc_id"], "sample-doc")


class RetrievalTest(unittest.TestCase):
    def test_eval_skipped_when_missing(self):
        eval_dir = ROOT / "eval"
        if (eval_dir / "questions.json").exists() or (eval_dir / "sections.json").exists():
            self.skipTest("eval files present; hit-rate checks are optional here")
        kb = KnowledgeBase()
        self.assertIn("tokenization-obligations", kb.docs)
        hits, total = run_eval(kb)
        self.assertEqual(hits, 0)
        self.assertEqual(total, 0)


class McpTest(unittest.TestCase):
    def test_stdio_handshake_and_search(self):
        msgs = [
            {"jsonrpc": "2.0", "id": 1, "method": "initialize",
             "params": {"protocolVersion": "2025-06-18", "capabilities": {}, "clientInfo": {"name": "t", "version": "0"}}},
            {"jsonrpc": "2.0", "method": "notifications/initialized"},
            {"jsonrpc": "2.0", "id": 2, "method": "tools/list"},
            {"jsonrpc": "2.0", "id": 3, "method": "tools/call",
             "params": {"name": "search_kb", "arguments": {"query": "zzqqxx", "k": 2}}},
            {"jsonrpc": "2.0", "id": 6, "method": "tools/call",
             "params": {"name": "search_kb", "arguments": {"query": "SUGEF", "k": 2}}},
            {"jsonrpc": "2.0", "id": 4, "method": "tools/call",
             "params": {"name": "list_norms", "arguments": {}}},
            {"jsonrpc": "2.0", "id": 5, "method": "nope"},
        ]
        proc = subprocess.run(
            [sys.executable, str(ROOT / "src" / "neko_legal_kb" / "mcp_server.py")],
            input="\n".join(json.dumps(m) for m in msgs) + "\n",
            capture_output=True, text=True, timeout=30,
        )
        self.assertEqual(proc.returncode, 0, proc.stderr)
        out = {r["id"]: r for r in map(json.loads, proc.stdout.splitlines())}
        self.assertEqual(sorted(out), [1, 2, 3, 4, 5, 6])
        self.assertEqual(out[1]["result"]["serverInfo"]["name"], "neko-legal-kb")
        names = [t["name"] for t in out[2]["result"]["tools"]]
        self.assertEqual(len(names), 7)
        self.assertEqual(
            names,
            ["search_kb", "get_document", "list_documents", "get_sources", "search_law", "get_article", "list_norms"],
        )
        self.assertIn("No results", out[3]["result"]["content"][0]["text"])
        sugef = out[6]["result"]["content"][0]["text"]
        self.assertIn("tokenization-obligations", sugef)
        norms = json.loads(out[4]["result"]["content"][0]["text"])
        self.assertIn("stored", norms)
        registry = {n["id"]: n for n in json.loads((ROOT / "laws" / "registry.json").read_text(encoding="utf-8"))["norms"]}
        for entry in norms["registered_not_ingested"]:
            with self.subTest(norm=entry["id"]):
                self.assertIn(entry["id"], registry)
                self.assertIn("Not ingested", registry[entry["id"]].get("note", ""))
        self.assertEqual(out[5]["error"]["code"], -32601)

    def test_llms_txt_empty_corpus(self):
        kb = KnowledgeBase(root=ROOT / "corpus", laws_root=ROOT / "laws")
        text = llms_txt(kb)
        self.assertIn("# neko-legal-kb", text)


if __name__ == "__main__":
    unittest.main()
