"""MCP server (stdio, JSON-RPC 2.0) for the Neko legal knowledge base.

Standard library only, so any MCP client can launch it with plain Python:

  python3 /path/to/neko-legal-kb/src/neko_legal_kb/mcp_server.py

Tools: search_kb, get_document, list_documents, get_sources (explainers in
corpus/), and search_law, get_article, list_norms (verbatim legal texts in laws/).
Resources: one per document, nekolegal://doc/<id> (text/markdown).
"""

import json
import sys
from pathlib import Path

if __package__ in (None, ""):  # allow running as a plain script
    sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
    from neko_legal_kb import __version__
    from neko_legal_kb.corpus import corpus_dir
    from neko_legal_kb.laws import AREAS, load_registry
    from neko_legal_kb.search import KnowledgeBase, format_hits, format_units
else:
    from . import __version__
    from .corpus import corpus_dir
    from .laws import AREAS, load_registry
    from .search import KnowledgeBase, format_hits, format_units

SUPPORTED_VERSIONS = ["2025-06-18", "2025-03-26", "2024-11-05"]

INSTRUCTIONS = """Legal knowledge base for tokenizing real-world assets with Neko (Costa Rica first): securities and public offering (Ley 7732, SUGEVAL), anti money laundering and virtual asset service providers (Ley 7786, SUGEF), personal data (Ley 8968), US offering exemptions (Regulation D, S, Crowdfunding) and El Salvador's digital assets law as reference. Search first, cite the article id and source URL for every claim, say when a source is secondary or reference only, never present a bill as law, and leave final positions to a licensed lawyer.

Verbatim legal texts (laws, decrees, reglamentos) are served article by article:
get_article for an exact article, search_law to find articles, list_norms for
coverage. search_law returns excerpts of long articles: call get_article before
quoting a part you have not seen. If search_law prints a coverage warning, tell
the user that norm is not stored yet. Quote the article and cite its id (e.g. ley-7732:art-1) and version
date. If a norm or article is not stored, say so instead of answering from memory.
Keep law (the article) separate from interpretation (explainers, oficios)."""

AREA_ENUM = sorted(AREAS)


def _topic_enum():
    root = corpus_dir()
    if root.is_dir():
        topics = sorted({p.parent.name for p in root.rglob("*.md") if p.parent != root})
        if topics:
            return topics
    return ["obligations", "general"]


TOPIC_ENUM = _topic_enum()

TOOLS = [
    {
        "name": "search_kb",
        "title": "Search Neko legal knowledge base",
        "description": "Search explainers for tokenizing real-world assets with Neko (securities, AML/VASP, "
        "personal data, US offering exemptions). Spanish or English queries. "
        "Returns matching sections with a citation id, date, status, and source URLs.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "query": {"type": "string", "description": "Question or keywords, e.g. 'oferta publica de tokens'"},
                "k": {"type": "integer", "description": "Max results (default 5)", "minimum": 1, "maximum": 20},
                "topic": {
                    "type": "string",
                    "enum": TOPIC_ENUM,
                    "description": "Optional filter: " + ", ".join(TOPIC_ENUM),
                },
            },
            "required": ["query"],
        },
        "annotations": {"readOnlyHint": True, "openWorldHint": False},
    },
    {
        "name": "get_document",
        "title": "Get a full document",
        "description": "Return one document in full (Markdown) by id.",
        "inputSchema": {"type": "object", "properties": {"id": {"type": "string"}}, "required": ["id"]},
        "annotations": {"readOnlyHint": True, "openWorldHint": False},
    },
    {
        "name": "list_documents",
        "title": "List documents",
        "description": "List all documents with id, title, topic, as_of date, status and source strength.",
        "inputSchema": {
            "type": "object",
            "properties": {"topic": {"type": "string", "enum": TOPIC_ENUM}},
        },
        "annotations": {"readOnlyHint": True, "openWorldHint": False},
    },
    {
        "name": "get_sources",
        "title": "Get sources",
        "description": "Return the source list (label, URL, type, date) for one document, or for all if no id.",
        "inputSchema": {"type": "object", "properties": {"id": {"type": "string"}}},
        "annotations": {"readOnlyHint": True, "openWorldHint": False},
    },
]


AREA_DESC = "Optional filter: " + ", ".join(AREA_ENUM)

TOOLS += [
    {
        "name": "search_law",
        "title": "Search legal texts",
        "description": "Search the verbatim text of stored laws, decrees and reglamentos at article "
        "level. Everyday wording works: the central article for a known concept comes "
        "first, marked 'Why'. Long articles come as the matching excerpt; call get_article for the full text. "
        "Warns when a relevant norm is registered but not stored yet.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "query": {"type": "string", "description": "Question or keywords, e.g. 'activos virtuales SUGEF'"},
                "k": {"type": "integer", "description": "Max results (default 5)", "minimum": 1, "maximum": 20},
                "area": {"type": "string", "enum": AREA_ENUM, "description": AREA_DESC},
                "norm": {"type": "string", "description": "Optional norm id, e.g. 'ley-7732'"},
                "include_repealed": {"type": "boolean", "description": "Include derogated articles"},
                "full_text": {"type": "boolean", "description": "Return whole articles instead of excerpts"},
            },
            "required": ["query"],
        },
        "annotations": {"readOnlyHint": True, "openWorldHint": False},
    },
    {
        "name": "get_article",
        "title": "Get one article verbatim",
        "description": "Exact article of a stored norm, e.g. norm 'ley-7732' article '1', '15 quater' or 'transitorio I'.",
        "inputSchema": {
            "type": "object",
            "properties": {"norm": {"type": "string"}, "article": {"type": "string"}},
            "required": ["norm", "article"],
        },
        "annotations": {"readOnlyHint": True, "openWorldHint": False},
    },
    {
        "name": "list_norms",
        "title": "List stored legal texts",
        "description": "Norms held as verbatim text, with version date, source and article counts, plus "
        "registered norms not ingested yet.",
        "inputSchema": {
            "type": "object",
            "properties": {"area": {"type": "string", "enum": AREA_ENUM, "description": AREA_DESC}},
        },
        "annotations": {"readOnlyHint": True, "openWorldHint": False},
    },
]


class Server:
    def __init__(self, kb=None):
        self.kb = kb or KnowledgeBase()

    def handle(self, msg):
        method, params, mid = msg.get("method"), msg.get("params") or {}, msg.get("id")
        if mid is None:  # notification, e.g. notifications/initialized
            return None
        try:
            result = self.dispatch(method, params)
        except KeyError as e:
            return {"jsonrpc": "2.0", "id": mid, "error": {"code": -32601, "message": f"Method not found: {e}"}}
        except Exception as e:
            return {"jsonrpc": "2.0", "id": mid, "error": {"code": -32603, "message": str(e)}}
        return {"jsonrpc": "2.0", "id": mid, "result": result}

    def dispatch(self, method, params):
        if method == "initialize":
            requested = params.get("protocolVersion")
            return {
                "protocolVersion": requested if requested in SUPPORTED_VERSIONS else SUPPORTED_VERSIONS[0],
                "capabilities": {"tools": {}, "resources": {}},
                "serverInfo": {"name": "neko-legal-kb", "version": __version__},
                "instructions": INSTRUCTIONS,
            }
        if method == "ping":
            return {}
        if method == "tools/list":
            return {"tools": TOOLS}
        if method == "tools/call":
            return self.call_tool(params.get("name"), params.get("arguments") or {})
        if method == "resources/list":
            return {
                "resources": [
                    {
                        "uri": f"nekolegal://doc/{d.id}",
                        "name": d.id,
                        "title": d.title,
                        "description": f"{d.topic}, as of {d.as_of}, backed by {d.verified}",
                        "mimeType": "text/markdown",
                    }
                    for d in self.kb.docs.values()
                ]
            }
        if method == "resources/read":
            doc_id = params.get("uri", "").removeprefix("nekolegal://doc/")
            d = self.kb.docs.get(doc_id)
            if not d:
                raise ValueError(f"Unknown resource: {params.get('uri')}")
            return {"contents": [{"uri": params["uri"], "mimeType": "text/markdown", "text": d.body}]}
        raise KeyError(method)

    def call_tool(self, name, args):
        def text(s, error=False):
            return {"content": [{"type": "text", "text": s}], "isError": error}

        if name == "search_kb":
            hits = self.kb.search(args.get("query", ""), args.get("k", 5), args.get("topic"))
            return text(format_hits(hits))
        if name == "get_document":
            d = self.kb.docs.get(args.get("id", ""))
            if not d:
                return text(f"Unknown id. Known ids: {', '.join(self.kb.docs) or '(none)'}", error=True)
            meta = json.dumps(d.summary(), ensure_ascii=False, indent=2)
            return text(f"{meta}\n\n{d.body}")
        if name == "list_documents":
            topic = args.get("topic")
            rows = [d.summary() for d in self.kb.docs.values() if not topic or d.topic == topic]
            for r in rows:
                r.pop("sources")
                r.pop("keywords_es")
            return text(json.dumps(rows, ensure_ascii=False, indent=2))
        if name == "get_sources":
            ids = [args["id"]] if args.get("id") else list(self.kb.docs)
            out = {i: self.kb.docs[i].sources for i in ids if i in self.kb.docs}
            if not out:
                return text("Unknown id." if args.get("id") else "No documents in the corpus.", error=bool(args.get("id")))
            return text(json.dumps(out, ensure_ascii=False, indent=2))
        if name == "search_law":
            query = args.get("query", "")
            hits = self.kb.search_law(
                query, args.get("k", 5), args.get("area"), args.get("norm"), bool(args.get("include_repealed")),
            )
            warnings = self.kb.coverage_warnings(query, args.get("area"))
            return text(format_units(hits, None if args.get("full_text") else query, warnings))
        if name == "get_article":
            norm = args.get("norm", "")
            if norm not in self.kb.norms:
                return text(f"Norm '{norm}' is not stored. Stored: {', '.join(self.kb.norms) or 'none yet'}", error=True)
            u = self.kb.get_unit(norm, str(args.get("article", "")))
            if not u:
                return text(f"Article not found in {norm}. Check the number, or search_law with norm={norm}.", error=True)
            return text(format_units([u.__dict__]))
        if name == "list_norms":
            area = args.get("area")
            stored = [n for n in self.kb.norms.values() if not area or n.get("area") == area]
            pending = [
                {k: r[k] for k in ("id", "title", "area", "phase")}
                for r in load_registry()
                if r["id"] not in self.kb.norms and (not area or r["area"] == area)
            ]
            return text(json.dumps({"stored": stored, "registered_not_ingested": pending}, ensure_ascii=False, indent=2))
        return text(f"Unknown tool: {name}", error=True)


def main():
    server = Server()
    for line in sys.stdin:
        line = line.strip()
        if not line:
            continue
        try:
            msg = json.loads(line)
        except json.JSONDecodeError:
            reply = {"jsonrpc": "2.0", "id": None, "error": {"code": -32700, "message": "Parse error"}}
        else:
            reply = server.handle(msg)
        if reply is not None:
            sys.stdout.write(json.dumps(reply, ensure_ascii=False) + "\n")
            sys.stdout.flush()


if __name__ == "__main__":
    main()
