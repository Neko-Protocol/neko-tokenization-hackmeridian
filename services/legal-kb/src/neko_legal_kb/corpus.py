"""Load the Markdown corpus and split it into citable chunks."""

import os
import re
from dataclasses import asdict, dataclass, field
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[2]


def corpus_dir():
    return Path(os.environ.get("NEKO_LEGAL_KB_CORPUS", REPO_ROOT / "corpus"))


@dataclass
class Document:
    id: str
    title: str
    topic: str
    path: str
    as_of: str = ""
    effective_from: str = ""
    status: str = ""
    verified: str = ""
    keywords_es: str = ""
    sources: list = field(default_factory=list)
    body: str = ""

    def summary(self):
        d = asdict(self)
        d.pop("body")
        return d


@dataclass
class Chunk:
    chunk_id: str
    doc_id: str
    title: str
    section: str
    topic: str
    text: str
    keywords: str = ""


def parse_frontmatter(text):
    """Parse the small YAML subset the corpus uses: top-level scalars plus a
    `sources` list of flat mappings. Returns (meta, body)."""
    if not text.startswith("---\n"):
        return {}, text
    end = text.index("\n---\n", 4)
    head, body = text[4:end], text[end + 5 :]
    meta, sources, current = {}, [], None
    for line in head.splitlines():
        if line.startswith("  - "):
            current = {}
            sources.append(current)
            line = "    " + line[4:]
        if line.startswith("    ") and current is not None:
            k, _, v = line.strip().partition(":")
            current[k.strip()] = v.strip()
        elif ":" in line and not line.startswith(" "):
            k, _, v = line.partition(":")
            meta[k.strip()] = v.strip()
    if sources:
        meta["sources"] = sources
    return meta, body


SECTION_KEYWORDS = re.compile(r"^<!--\s*es:\s*(.*?)\s*-->$")


def split_sections(body):
    """Split at '## ' headings; text before the first heading is 'Overview'.

    A line `<!-- es: ... -->` right under a heading holds Spanish search terms
    for that section only. It is hidden when rendered and removed from the
    chunk text. Returns (heading, text, keywords) tuples."""
    out, heading, buf, kw = [], "Overview", [], ""

    def flush():
        if "".join(buf).strip():
            out.append((heading, "\n".join(buf).strip(), kw))

    for line in body.splitlines():
        m = SECTION_KEYWORDS.match(line.strip())
        if line.startswith("## "):
            flush()
            heading, buf, kw = line[3:].strip(), [], ""
        elif m:
            kw = m.group(1)
        elif not line.startswith("# "):
            buf.append(line)
    flush()
    return out


def load_documents(root=None):
    root = Path(root or corpus_dir())
    if not root.is_dir():
        return []
    docs = []
    for path in sorted(root.rglob("*.md")):
        meta, body = parse_frontmatter(path.read_text(encoding="utf-8"))
        # Explainers use strength / in_force; verified / status remain as aliases.
        docs.append(
            Document(
                id=meta.get("id", path.stem),
                title=meta.get("title", path.stem),
                topic=meta.get("topic", path.parent.name),
                path=str(path.relative_to(root.parent)),
                as_of=meta.get("as_of", ""),
                effective_from=meta.get("effective_from", ""),
                status=meta.get("in_force", meta.get("status", "")),
                verified=meta.get("strength", meta.get("verified", "")),
                keywords_es=meta.get("keywords_es", ""),
                sources=meta.get("sources", []),
                body=body.strip(),
            )
        )
    return docs


def chunks_of(doc):
    return [
        Chunk(f"{doc.id}#{i}", doc.id, doc.title, heading, doc.topic, text, kw)
        for i, (heading, text, kw) in enumerate(split_sections(doc.body))
    ]
