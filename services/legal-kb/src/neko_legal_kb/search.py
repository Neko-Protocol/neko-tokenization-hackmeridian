"""BM25 search over the corpus with an in-memory SQLite FTS5 index.

The corpus is small, so the index is rebuilt on every start: no generated
files to keep in sync. Accents are folded and Spanish words are crudely
stemmed, so "facturas" finds "factura" and "exportacion" finds "exportación".
"""

import json
import re
import sqlite3
from pathlib import Path

from .corpus import chunks_of, load_documents
from .laws import LAWS_DIR, arabic_to_roman, load_norms, load_registry, load_units

STOPWORDS = set(
    """a al algo como con cual cuales cuando cuanto de del donde el ella en es
    esta este esto la las le lo los me mi mis o para pero por que se si sin
    sobre su sus te tiene tengo un una uno y ya the of to and in is for what
    how do does i my on are be""".split()
)
# Question filler that matches thousands of articles and buries the useful terms.
LAW_STOPWORDS = STOPWORDS | set(
    """puedo puede pueden debo debe deben hay cuanto cuanta cuantos cuantas
    cuando realidad algo alguna algun nada eso esa ese les nos tienen tengan
    tener hacer hace pasa pasar quiero quieren necesito estoy esta estan ser
    son fue era mas menos muy otro otra todo todos cada porque pregunta
    when from under into than about also into which that this these those
    counts count must should may can will would could does did has have had
    with without within during before after between among""".split()
)


def fold(s):
    table = str.maketrans("áéíóúüñ", "aeiouun")
    return s.lower().translate(table)


def match_expression(q):
    terms = [t for t in re.findall(r"\w+", fold(q)) if t not in STOPWORDS and len(t) > 1]
    # Exact terms plus stems (last 2 chars dropped) so exact hits score higher.
    stems = {t[: max(4, len(t) - 2)] for t in terms if len(t) > 5}
    return " OR ".join(f'"{t}"*' for t in sorted(set(terms) | stems))


# Tokenization / securities shorthand and related terms for law FTS only.
# Multi-word keys match when the phrase appears in the folded query.
LAW_SYNONYMS = {
    "oferta publica": ["oferta publica", "valores", "autorizacion", "superintendencia"],
    "public offering": ["oferta publica", "public offering", "securities", "valores"],
    "oferta privada": ["oferta privada", "private offering", "acreditacion", "inversionistas"],
    "private offering": ["oferta privada", "private offering", "private placement", "inversionistas"],
    "private placement": ["oferta privada", "private placement", "accredited investors", "inversionistas"],
    "token": ["valor", "activo digital", "activo virtual"],
    "activos virtuales": ["activos virtuales", "proveedores de servicios", "15 quater"],
    "activo digital": ["activo digital", "activos digitales", "digital asset"],
    "lavado": ["legitimacion de capitales", "financiamiento al terrorismo", "sujetos obligados"],
    "kyc": ["identificacion", "debida diligencia", "cliente"],
    "datos personales": ["datos personales", "consentimiento informado", "responsable de la base de datos"],
    "sugef": ["Superintendencia General de Entidades Financieras", "inscripcion"],
    "sugeval": ["Superintendencia General de Valores", "autorizacion", "oferta publica"],
    "cnbv": ["Comision Nacional Bancaria y de Valores", "Registro Nacional de Valores"],
    "cnv": ["Comision Nacional de Valores", "valores negociables"],
    "fideicomiso": ["fideicomiso", "fideicomitente", "fiduciaria"],
    "autorizacion previa": ["autorizacion", "autorizadas", "mercado primario", "oferta publica"],
    "regulation s": ["regulation s", "offshore", "offshore transaction", "non us person"],
    "offshore": ["offshore", "regulation s", "outside the united states"],
}

# Country / regulator cues in the query -> jurisdiction codes used on norms.
# Longer phrases are matched first so "estados unidos mexicanos" wins over "estados unidos".
_JURISDICTION_PHRASES = (
    ("mx", (
        "estados unidos mexicanos", "united mexican states",
        "mexico", "mexicano", "mexicana", "mexicanos", "mexicanas",
        "mexican", "mexicans", "cnbv",
    )),
    ("us", (
        "united states", "estados unidos", "u.s.", "usa", "american", "americans",
        "regulation d", "regulation s", "regulation crowdfunding", "cfr",
    )),
    ("cr", (
        "costa rica", "costarricense", "costarricenses", "costa rican", "costa ricans",
        "sugef", "sugeval", "conassif",
    )),
    ("co", (
        "colombia", "colombiano", "colombiana", "colombianos", "colombianas",
        "colombian", "colombians", "superintendencia financiera",
    )),
    ("ar", (
        "argentina", "argentino", "argentinos", "argentinas",
        "argentine", "argentinian", "cnv",
    )),
    ("sv", (
        "el salvador", "salvadoreno", "salvadorena", "salvadorenos", "salvadorenas",
        "salvadoran", "salvadorian", "cnad",
    )),
)

# Soft re-rank when the query names a jurisdiction; do not hard-filter.
JURISDICTION_BOOST = 2.8
JURISDICTION_PENALTY = 0.12
# Extra when distinctive query tokens also appear in the norm title (e.g. LGTOC).
NORM_TITLE_MATCH_BOOST = 1.35
# Definition-style questions prefer articles that define terms.
DEFINITION_BOOST = 1.45
_DEF_QUERY = re.compile(
    r"\b(definicion|definiciones|definition|definitions|concepto|concept|what counts|counts as)\b"
)
_DEF_TEXT = re.compile(
    r"\b(se entendera por|se entiende por|para efectos de (esta|la presente)|"
    r"definiciones\.|concepto de|is defined as|shall have the meanings?)\b"
)


def detect_jurisdictions(query):
    """Return jurisdiction codes mentioned in the query (country, demonym, or regulator)."""
    folded = fold(query)
    # Normalize punctuation so "U.S." and "Costa-Rican" still match.
    spaced = re.sub(r"[./_-]+", " ", folded)
    spaced = re.sub(r"\s+", " ", spaced).strip()
    found = set()
    for code, phrases in _JURISDICTION_PHRASES:
        for phrase in phrases:
            p = fold(phrase).strip()
            if not p:
                continue
            if " " in p:
                if p in spaced:
                    found.add(code)
            elif re.search(r"(?<!\w)" + re.escape(p) + r"(?!\w)", spaced):
                found.add(code)
    # Bare "us" only as a whole word (avoids matching inside "versus").
    if re.search(r"(?<!\w)us(?!\w)", spaced):
        found.add("us")
    # "Estados Unidos Mexicanos" must not also count as the US.
    if "estados unidos mexicanos" in spaced or "united mexican states" in spaced:
        found.discard("us")
        found.add("mx")
    return found


def norm_jurisdiction(norm):
    """Jurisdiction of a stored norm from id prefix, title, or source URL."""
    nid = (norm.get("id") or "").lower()
    for prefix, code in (
        ("mx-", "mx"),
        ("co-", "co"),
        ("ar-", "ar"),
        ("us-", "us"),
        ("sv-", "sv"),
    ):
        if nid.startswith(prefix):
            return code
    title = fold(norm.get("title") or "")
    url = fold(norm.get("source_url") or "")
    if "mexico" in title or "mexican" in title or "cnbv.gob.mx" in url:
        return "mx"
    if "colombia" in title or "senado.gov.co" in url:
        return "co"
    if "argentina" in title or "infoleg" in url:
        return "ar"
    if "el salvador" in title or "salvador" in title:
        return "sv"
    if (
        "united states" in title
        or "regulation d" in title
        or "regulation s" in title
        or "crowdfunding" in title
        or "ecfr.gov" in url
        or "17 cfr" in title
    ):
        return "us"
    if "sinalevi.go.cr" in url or "scij" in url:
        return "cr"
    # Unprefixed corpus norms (Ley 7732, reglamentos SCIJ, etc.) are Costa Rican.
    return "cr"


def jurisdiction_factor(query_jurisdictions, norm):
    """Multiply BM25-adjusted score: boost matching jurisdiction, down-weight others."""
    if not query_jurisdictions:
        return 1.0
    nj = norm_jurisdiction(norm)
    if nj in query_jurisdictions:
        return JURISDICTION_BOOST
    return JURISDICTION_PENALTY


# Tokens too common across securities norms to justify a title boost on their own.
_TITLE_WEAK_TERMS = frozenset(
    "valores valor oferta publica privada ley mercado titulo titulos credito operaciones "
    "activo activos digital digitales virtual virtuales datos personales proteccion".split()
)


def norm_title_factor(query, norm):
    """Modest boost when the query shares a distinctive phrase or rare tokens with the norm title."""
    title = fold(norm.get("title") or "")
    if not title:
        return 1.0
    folded = fold(query)
    # "regulation s/d", "titulos y operaciones de credito", "emision de activos digitales", ...
    words = re.findall(r"\w+", folded)
    for n in (4, 3, 2):
        for i in range(len(words) - n + 1):
            phrase = " ".join(words[i : i + n])
            if len(phrase) < 10 or phrase in ("oferta publica", "oferta privada", "mercado de valores"):
                continue
            if phrase in title:
                return NORM_TITLE_MATCH_BOOST
    title_words = set(re.findall(r"\w+", title))
    q_terms = [
        t
        for t in set(words)
        if t not in LAW_STOPWORDS and t not in _TITLE_WEAK_TERMS and len(t) > 3
    ]
    if not q_terms:
        return 1.0
    hits = sum(1 for t in q_terms if t in title_words or any(tw.startswith(_stem(t)) for tw in title_words))
    if hits >= 2:
        return NORM_TITLE_MATCH_BOOST
    return 1.0


def definition_factor(query, unit):
    """Boost definitional articles when the question asks for a definition or concept."""
    if not _DEF_QUERY.search(fold(query)):
        return 1.0
    heading = fold(unit.heading or "")
    if heading.startswith("definicion") or heading in ("definiciones", "concepto", "conceptos"):
        return DEFINITION_BOOST
    sample = heading + " " + fold(unit.text[:450])
    if _DEF_TEXT.search(sample):
        return DEFINITION_BOOST
    return 1.0


def law_match_expression(q, extra=()):
    folded = fold(q)
    terms = [t for t in re.findall(r"\w+", folded) if t not in LAW_STOPWORDS and len(t) > 1]
    for phrase in extra:
        terms += [t for t in re.findall(r"\w+", fold(phrase)) if t not in LAW_STOPWORDS and len(t) > 1]
    term_set = set(terms)
    expanded = list(terms)
    for key, syns in LAW_SYNONYMS.items():
        key_f = fold(key)
        if " " in key_f:
            hit = key_f in folded or all(t in term_set for t in key_f.split())
        else:
            hit = key_f in term_set
        if hit:
            for s in syns:
                expanded += [t for t in re.findall(r"\w+", fold(s)) if len(t) > 1]
    stems = {t[: max(4, len(t) - 2)] for t in expanded if len(t) > 5}
    return " OR ".join(f'"{t}"*' for t in sorted(set(expanded) | stems))


# Transitorios and reglamentos repeat wording from the ruling article; favor the law article.
LAW_KIND_PRIOR = {"transitorio": 0.6, "anexo": 0.8}
LAW_RANK_PRIOR = {"decreto": 0.85, "resolucion-general": 0.68, "secondary": 0.75}


# Column weights for bm25(): title, section heading, section keywords,
# document keywords, body text.
W_TITLE, W_SECTION, W_SECTION_KW, W_DOC_KW, W_TEXT = 1.0, 2.0, 4.0, 0.5, 1.0
# For law units: norm title, Título/Capítulo path, epígrafe, article text, reform notes.
W_LAW_TITLE, W_LAW_PATH, W_LAW_HEADING, W_LAW_TEXT, W_LAW_NOTES = 0.9, 1.0, 2.0, 1.0, 0.2


def unit_lookup_id(norm, article):
    a = fold(article).strip().rstrip(".")
    if a.startswith("anexo"):
        n = re.sub(r"^anexo\s*", "", a).strip()
        return f"{norm}:anexo-{n}"
    if a.startswith("sec-"):
        return f"{norm}:{a}"
    m = re.match(r"^sec(?:tion)?[\s.-]+(.+)$", a)
    if m:
        num = re.sub(r"\s+", "", m.group(1))
        return f"{norm}:sec-{num}"
    sec_num = re.sub(r"\s+", "", a)
    if re.fullmatch(r"\d+\.\d+", sec_num):
        return f"{norm}:sec-{sec_num}"
    kind = "trans" if a.startswith("trans") else "art"
    a = re.sub(r"^(transitorio|trans\.?|articulo|art\.?)\s*", "", a).strip()
    a = re.sub(r"[°º]", "", a)
    if kind == "trans":
        m = re.match(r"^(\d+)\s*(.*)$", a)
        if m:
            a = arabic_to_roman(int(m.group(1))) + ((" " + m.group(2)) if m.group(2) else "")
        a = a.upper().replace(" ", "-")
        return f"{norm}:trans-{a}"
    a = re.sub(r"\s+", "-", a.lstrip("0") or "0")
    return f"{norm}:art-{a}"


def _stem(w):
    return w[: max(4, len(w) - 2)] if len(w) > 5 else w


def _phrase_matches(phrase, words):
    return all(any(w.startswith(_stem(t)) for w in words) for t in re.findall(r"\w+", fold(phrase)))


def load_concepts(root=None):
    path = Path(root or LAWS_DIR) / "concepts.json"
    if not path.exists():
        return []
    return json.loads(path.read_text(encoding="utf-8"))["concepts"]


class KnowledgeBase:
    def __init__(self, root=None, laws_root=None):
        self.docs = {d.id: d for d in load_documents(root)}
        self.chunks = {}
        self.db = sqlite3.connect(":memory:", check_same_thread=False)
        self.db.execute(
            """CREATE VIRTUAL TABLE fts USING fts5(chunk_id UNINDEXED, topic UNINDEXED,
            title, section, section_keywords, doc_keywords, text, tokenize='unicode61 remove_diacritics 2')"""
        )
        for doc in self.docs.values():
            for c in chunks_of(doc):
                self.chunks[c.chunk_id] = c
                # Spanish keywords let Spanish queries reach sections written in
                # English. Section keywords pick the section; the document's
                # keywords only weakly help every section of that document.
                self.db.execute(
                    "INSERT INTO fts VALUES (?,?,?,?,?,?,?)",
                    (c.chunk_id, c.topic, c.title, c.section, c.keywords, doc.keywords_es, c.text),
                )

        self._load_laws(laws_root)

    def _load_laws(self, laws_root):
        """Primary texts (laws/), one row per article or transitorio."""
        self.units = {u.id: u for u in load_units(laws_root)}
        self.norms = {n["id"]: n for n in load_norms(laws_root)}
        self.concepts = load_concepts(laws_root)
        self.registry = {r["id"]: r for r in load_registry(laws_root)} if self.norms else {}
        self.db.execute(
            """CREATE VIRTUAL TABLE law_fts USING fts5(unit_id UNINDEXED, area UNINDEXED, norm_id UNINDEXED,
            norm_title, path, heading, text, notes, tokenize='unicode61 remove_diacritics 2')"""
        )
        for u in self.units.values():
            self.db.execute(
                "INSERT INTO law_fts VALUES (?,?,?,?,?,?,?,?)",
                (u.id, u.area, u.norm_id, u.norm_title, " / ".join(u.path), u.heading, u.text, " ".join(u.notes)),
            )

    def match_concepts(self, query):
        """Concepts whose triggers appear in the query, best first, as (score, concept)."""
        words = re.findall(r"\w+", fold(query))
        scored = []
        for c in self.concepts:
            score = sum(len(re.findall(r"\w+", t)) for t in c["triggers"] if _phrase_matches(t, words))
            score += 0.5 * sum(1 for t in c.get("weak", []) if _phrase_matches(t, words))
            if score >= 1:
                scored.append((score, c))
        scored.sort(key=lambda row: row[0], reverse=True)
        return scored

    def coverage_warnings(self, query, area=None):
        """Registered norms that the matched concepts need but that are not ingested."""
        out = []
        for _, c in self.match_concepts(query):
            if area and c["area"] != area:
                continue
            for nid in c.get("pending", []):
                if nid not in self.norms and nid in self.registry:
                    out.append({"concept": c["label"], "norm": nid, "title": self.registry[nid]["title"]})
        return out

    def search_law(self, query, k=5, area=None, norm=None, include_repealed=False):
        concepts = self.match_concepts(query)
        if area:
            concepts = [(s, c) for s, c in concepts if c["area"] == area]
        extra = [t for _, c in concepts for t in c.get("expand", [])]
        expr = law_match_expression(query, extra)
        if not expr or not self.units:
            return []

        jurisdictions = detect_jurisdictions(query)

        def allowed(u):
            if area and u.area != area:
                return False
            if norm and u.norm_id != norm:
                return False
            return u.status == "vigente" or include_repealed

        sql = "SELECT unit_id, bm25(law_fts, 0, 0, 0, ?, ?, ?, ?, ?) AS score FROM law_fts WHERE law_fts MATCH ?"
        args = [W_LAW_TITLE, W_LAW_PATH, W_LAW_HEADING, W_LAW_TEXT, W_LAW_NOTES, expr]
        if area:
            sql += " AND area = ?"
            args.append(area)
        if norm:
            sql += " AND norm_id = ?"
            args.append(norm)
        sql += " ORDER BY score LIMIT ?"
        # Wider pool when re-ranking by jurisdiction so foreign BM25 hits do not crowd out locals.
        args.append(int(k) * (40 if jurisdictions else 10))
        candidates = []
        for unit_id, score in self.db.execute(sql, args):
            u = self.units[unit_id]
            nmeta = self.norms.get(u.norm_id) or {"id": u.norm_id, "title": u.norm_title}
            rel = -score
            prior = LAW_KIND_PRIOR.get(u.kind, 1.0) * LAW_RANK_PRIOR.get(u.rank, 1.0)
            prior *= jurisdiction_factor(jurisdictions, nmeta)
            prior *= norm_title_factor(query, nmeta)
            prior *= definition_factor(query, u)
            candidates.append((rel * prior, u))
        candidates.sort(key=lambda row: row[0], reverse=True)

        # Central articles of the best matching concept(s) go first, then the
        # first anchor of any weaker concept, then keyword ranking. Anchors carry
        # the best keyword score so score thresholds keep working.
        best = round(candidates[0][0], 3) if candidates else 0.0
        hits, seen = [], set()
        top = concepts[0][0] if concepts else None
        for score, c in concepts:
            for uid in c["anchors"] if score == top else c["anchors"][:1]:
                u = self.units.get(uid)
                if not u or uid in seen or not allowed(u):
                    continue
                nmeta = self.norms.get(u.norm_id) or {"id": u.norm_id, "title": u.norm_title}
                if jurisdictions and norm_jurisdiction(nmeta) not in jurisdictions:
                    continue
                seen.add(uid)
                hits.append({**u.__dict__, "score": best, "why": c["label"]})
        for adj, u in candidates:
            if u.id in seen or not allowed(u):
                continue
            seen.add(u.id)
            hits.append({**u.__dict__, "score": round(adj, 3), "why": None})
        return hits[: int(k)]

    def get_unit(self, norm, article):
        """Exact lookup. `article` accepts '29', 'art 29', '29 bis', 'transitorio I'
        or a full id such as 'ley-2:art-29'."""
        uid = article if ":" in article else unit_lookup_id(norm, article)
        return self.units.get(uid)

    def topics(self):
        return sorted({d.topic for d in self.docs.values()})

    def search(self, query, k=5, topic=None):
        expr = match_expression(query)
        if not expr:
            return []
        sql = (
            "SELECT chunk_id, bm25(fts, 0, 0, ?, ?, ?, ?, ?) AS score FROM fts WHERE fts MATCH ?"
        )
        args = [W_TITLE, W_SECTION, W_SECTION_KW, W_DOC_KW, W_TEXT, expr]
        if topic:
            sql += " AND topic = ?"
            args.append(topic)
        sql += " ORDER BY score LIMIT ?"
        args.append(int(k))
        hits = []
        for chunk_id, score in self.db.execute(sql, args):
            c = self.chunks[chunk_id]
            d = self.docs[c.doc_id]
            hits.append(
                {
                    "chunk_id": chunk_id,
                    "doc_id": d.id,
                    "title": d.title,
                    "section": c.section,
                    "topic": d.topic,
                    "as_of": d.as_of,
                    "status": d.status,
                    "verified": d.verified,
                    "path": d.path,
                    "score": round(-score, 3),
                    "text": c.text,
                    "sources": d.sources,
                }
            )
        return hits


def format_hits(hits):
    if not hits:
        return "No results. Try other terms, or list_documents to browse."
    parts = []
    for h in hits:
        src = "\n".join(f"- {s.get('label', '')}: {s.get('url', '')} ({s.get('type', '')})" for s in h["sources"])
        parts.append(
            f"### {h['title']} > {h['section']}\n"
            f"[cite: {h['chunk_id']} | as of {h['as_of']} | status: {h['status']} | backed by: {h['verified']}]\n\n"
            f"{h['text']}\n\nSources:\n{src}"
        )
    return "\n\n---\n\n".join(parts)


EXCERPT_CHARS = 500


def excerpt(text, query, limit=EXCERPT_CHARS):
    """The passage of `text` that best matches `query`, about `limit` characters."""
    if len(text) <= limit + 150:
        return text
    words = {_stem(t) for t in re.findall(r"\w+", fold(query)) if t not in LAW_STOPWORDS and len(t) > 2}
    # Inciso and paragraph breaks first; long paragraphs split into sentences.
    parts = []
    for para in re.split(r"\n+", text):
        parts += re.split(r"(?<=[.;:])\s+", para) if len(para) > limit else [para]
    parts = [p for p in parts if p.strip()]

    def hits(p):
        f = fold(p)
        return sum(1 for w in words if w in f)

    best = max(range(len(parts)), key=lambda i: (hits(parts[i]), -i))
    lo = hi = best
    size = len(parts[best])
    while size < limit and (lo > 0 or hi < len(parts) - 1):
        if hi < len(parts) - 1:
            hi += 1
            size += len(parts[hi]) + 1
        elif lo > 0:
            lo -= 1
            size += len(parts[lo]) + 1
    out = " ".join(parts[lo : hi + 1])
    if len(out) > limit * 2:
        out = out[: limit * 2].rsplit(" ", 1)[0]
    return ("... " if lo > 0 else "") + out + (" ..." if hi < len(parts) - 1 or len(out) < len(" ".join(parts[lo:hi + 1])) else "")


def format_units(units, query=None, warnings=()):
    """Articles as text. With `query`, long articles are cut to the passage that
    matches it (search results); without it, full text (get_article)."""
    if not units and not warnings:
        return "No matching article in the stored legal texts. Use list_norms to see what is covered."
    parts = []
    for u in units:
        label = {"articulo": "Artículo", "transitorio": "Transitorio", "anexo": "Anexo"}.get(
            u["kind"], u["kind"]
        )
        where = " > ".join(u["path"])
        notes = "\n".join(u["notes"])
        body = u["text"] if query is None else excerpt(u["text"], query)
        cut = query is not None and body != u["text"]
        parts.append(
            f"### {u['norm_title']}, {label} {u['number']}\n"
            f"[cite: {u['id']} | {u['rank']} | status: {u['status']} | version {u['version_date'] or 'unknown'}"
            f" | retrieved {u['retrieved_at']}]\n"
            + (f"Why: central article for \"{u['why']}\"\n" if u.get("why") else "")
            + (f"{where}\n" if where else "")
            + f"\n{body}\n"
            + (f"\n[Excerpt of {len(u['text'])} characters: get_article(\"{u['norm_id']}\", \"{u['number']}\") for the full text]\n" if cut else "")
            + (f"\n{notes}\n" if notes and not cut else "")
            + f"\nSource: {u['source_url']}"
        )
    for w in warnings:
        parts.append(
            f"Coverage warning: \"{w['concept']}\" is also governed by {w['title']} ({w['norm']}), "
            "which is registered but not stored yet. The answer may be incomplete; say so."
        )
    return "\n\n---\n\n".join(parts)
