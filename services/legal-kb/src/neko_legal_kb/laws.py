"""Primary legal texts at article level: parse, validate, store and load.

A norm (law, decree, reglamento, resolution) lives in laws/<norm-id>/:

  norm.json        metadata of the stored version (source, hash, counts)
  articles.jsonl   one unit (article, transitorio, anexo) per line, verbatim text
  text.md          human-readable rendering

laws/registry.json lists the norms the engine should hold. Parsing works on
plain text lines, so SCIJ HTML, other HTML and PDFs (via pdftotext) share one
splitter. Standard library only, except pdftotext for PDFs.
"""

import gzip
import hashlib
import html
import json
import re
import shutil
import subprocess
import time
import unicodedata
import urllib.parse
import urllib.request
import xml.etree.ElementTree as ET
from dataclasses import asdict, dataclass, field
from html.parser import HTMLParser
from pathlib import Path

from .corpus import REPO_ROOT

LAWS_DIR = REPO_ROOT / "laws"
AREAS = {
    "valores",
    "antilavado",
    "datos",
    "internacional",
    "referencia",
    "sociedades",
    "fintech",
}
TYPES = {"ley", "decreto", "reglamento", "regulation", "resolucion", "tratado", "constitucion"}
RANKS = [
    "constitucion",
    "tratado",
    "ley",
    "decreto",
    "resolucion-general",
    "jurisprudencia-vinculante",
    "jurisprudencia",
    "dictamen-pgr",
    "oficio",
    "secondary",
]
SINALEVI = "https://sinalevi.go.cr"
SINALEVI_INFO_URL = (
    SINALEVI + "/ResultadosNormativa/Informacion?param1={nrm}&param2={version}&param3=1"
)
SINALEVI_FICHA_URL = SINALEVI + "/ResultadosNormativa/_CargarFicha"
SINALEVI_TEXTO_URL = SINALEVI + "/ResultadosNormativa/_CargarTextoCompleto"
USER_AGENT = "neko-legal-kb ingest (Neko; one request per named norm)"
ECFR_VERSIONER = "https://www.ecfr.gov/api/versioner/v1"
ECFR_PATH_TYPES = frozenset({"PART", "SUBPART", "SUBJGRP"})


@dataclass
class Unit:
    id: str
    norm_id: str
    norm_title: str
    kind: str  # articulo, transitorio, anexo
    number: str
    heading: str = ""
    path: list = field(default_factory=list)
    text: str = ""
    notes: list = field(default_factory=list)
    status: str = "vigente"
    area: str = ""
    rank: str = ""
    version_date: str = ""
    source_url: str = ""
    retrieved_at: str = ""
    source_sha256: str = ""
    text_sha256: str = ""


# ---------------------------------------------------------------- text input


class _TextExtractor(HTMLParser):
    """HTML to text lines: block tags end a line, head/scripts/styles dropped."""

    BLOCK = {"p", "div", "li", "tr", "h1", "h2", "h3", "h4", "h5", "h6", "table", "blockquote"}
    SKIP = {"script", "style", "head", "title"}

    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.parts, self.skip, self.cell_depth = [], 0, 0

    def handle_starttag(self, tag, attrs):
        if tag in self.SKIP:
            self.skip += 1
        elif tag in ("td", "th"):
            self.cell_depth += 1
        elif tag == "br":
            self.parts.append(" " if self.cell_depth else "\n")
        elif tag in self.BLOCK:
            if self.cell_depth and tag != "tr":
                self.parts.append(" ")
            else:
                self.parts.append("\n")

    def handle_endtag(self, tag):
        if tag in self.SKIP:
            self.skip = max(0, self.skip - 1)
        elif tag in ("td", "th"):
            self.cell_depth = max(0, self.cell_depth - 1)
            if not self.skip:
                self.parts.append(" | ")
        elif tag in self.BLOCK:
            if tag == "tr" or not self.cell_depth:
                self.parts.append("\n")
            else:
                self.parts.append(" ")

    def handle_data(self, data):
        if not self.skip:
            # Collapse whitespace like a browser; line breaks come from block tags.
            self.parts.append(re.sub(r"\s+", " ", data))


def _strip_table_line(ln):
    ln = re.sub(r"(\s*\|\s*)+$", "", ln)
    ln = ln.strip()
    if not ln or re.fullmatch(r"[\|\s]+", ln):
        return None
    return ln


def html_to_lines(raw):
    p = _TextExtractor()
    p.feed(raw)
    lines = clean_lines("".join(p.parts))
    out = []
    for ln in lines:
        cleaned = _strip_table_line(ln)
        if cleaned is not None:
            out.append(cleaned)
    return out


def pdf_to_lines(path):
    if not shutil.which("pdftotext"):
        raise RuntimeError("pdftotext is needed for PDFs (poppler-utils)")
    out = subprocess.run(["pdftotext", "-enc", "UTF-8", str(path), "-"], capture_output=True, check=True)
    return clean_lines(out.stdout.decode("utf-8"))


def clean_lines(text):
    text = unicodedata.normalize("NFC", html.unescape(text)).replace("\xa0", " ")
    lines = (re.sub(r"[ \t]+", " ", ln).strip() for ln in text.splitlines())
    return [ln for ln in lines if ln]


def read_source(path):
    """Return (lines, raw_bytes) for a saved HTML, PDF or text file."""
    path = Path(path)
    raw = path.read_bytes()
    if raw[:4] == b"%PDF":
        return pdf_to_lines(path), raw
    text = decode(raw)
    if re.search(r"<(html|body|p|div)\b", text[:5000], re.I):
        return html_to_lines(text), raw
    return clean_lines(text), raw


def decode(raw):
    for enc in ("utf-8", "cp1252"):
        try:
            return raw.decode(enc)
        except UnicodeDecodeError:
            continue
    return raw.decode("latin-1")


def fetch(url, timeout=60):
    req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
    with urllib.request.urlopen(req, timeout=timeout) as r:
        return r.read()


def fetch_compressed(url, timeout=120):
    """GET with gzip support (required by the eCFR versioner API)."""
    req = urllib.request.Request(
        url,
        headers={"User-Agent": USER_AGENT, "Accept-Encoding": "gzip"},
    )
    with urllib.request.urlopen(req, timeout=timeout) as r:
        raw = r.read()
        if (r.headers.get("Content-Encoding") or "").lower() == "gzip":
            raw = gzip.decompress(raw)
        return raw


def post_json(url, data, timeout=240):
    """POST form-encoded data; return parsed JSON. Sleep is the caller's job."""
    body = urllib.parse.urlencode({k: str(v) for k, v in data.items()}).encode("utf-8")
    req = urllib.request.Request(
        url,
        data=body,
        headers={
            "User-Agent": USER_AGENT,
            "X-Requested-With": "XMLHttpRequest",
            "Content-Type": "application/x-www-form-urlencoded",
        },
    )
    with urllib.request.urlopen(req, timeout=timeout) as r:
        return json.loads(r.read().decode("utf-8"))


# ------------------------------------------------------------------- parsing

SUFFIX = r"(bis|ter|qu[aá]\s*ter|quinquies|sexies|septies|octies)?"
_ENUM_CLOSER = re.compile(r"(?<![\w(])(?:[a-zA-Z]{1,2}|\d{1,3}|[ivxlcIVXLC]{1,6})\)(?=\s*\S)")
_ABBREV_LAST = frozenset({"no", "nos", "art", "arts", "inc", "ref", "lic", "dr", "sr", "sra"})
_EMBEDDED_ART = re.compile(r"^(?:ART[IÍ]CULO|Art[ií]culo)\s+[IVXLC]+\b", re.M)
_WHOLE_UNIT_REPEAL_START = re.compile(r"^(?:\(\*\)\s*)?\((?:Derogad|Anulad)", re.I)
# A unit heading needs a separator after the number ("ARTÍCULO 1.-",
# "Artículo 10 bis.-", "Artículo 2°-") so in-text references that happen to
# start a line ("Artículo 5 de esta ley...") are not taken as new units.
# Optional leading "A" absorbs SCIJ typos like "Aartículo".
_ART_WORD = r"A?(?:ART[IÍ]CULO|Art[ií]culo|Art\.)"
ARTICLE = re.compile(
    r"^" + _ART_WORD + r"\s+(\d+)\s*(?:[°º]|o(?=\.))?\s*" + SUFFIX + r"\s*[°º]?\s*[.:\-\u2013\u2014]+\s*(.*)$", re.I
)
# Letter suffix (66-B, 66-CH), not Latin bis/ter/...; checked before ARTICLE.
ARTICLE_LETTER = re.compile(
    r"^" + _ART_WORD + r"\s+(\d+)\s*-\s*(CH|[A-Z])\s*[.:\-\u2013\u2014]+\s*(.*)$", re.I
)
TRANSITORIO = re.compile(
    r"^TRANSITORIO\s+([IVXLCDM]+|\d+|[ÚU]NICO)\s*[°º]?\s*" + SUFFIX + r"\s*[°º]?\s*[.:\-\u2013\u2014]+\s*(.*)$",
    re.I,
)
STRUCTURE = re.compile(r"^(LIBRO|T[IÍ]TULO|CAP[IÍ]TULO|SECCI[OÓ]N|SUBSECCI[OÓ]N)\b", re.I)
# Part headings at Título level that are not Libro/Título/Capítulo.
_PART_HEADING = re.compile(r"^(disposiciones\s+transitorias|transitorios|anexos)\.?$")
NOTE = re.compile(
    r"^(?:\(\*+\)\s*|\*+\s*)?"
    r"\(\s*(?:"
    r"As[ií]\b|Reformad|Adicionad|Derogad|Anulad|Interpretad|Corrid|Modificad|Ver\b|Nota\b|Por resoluci|Mediante\b|La Sala|"
    r"Este art[ií]culo|El presente|"
    r"La\b[^)]{0,100}?\bfue\s+(?:derogad|reformad|adicionad|anulad)|"
    r"(?:\S+\s+){1,4}(?:adicionad|reformad|derogad|anulad|modificad|corrid)[oa]s?\s+por\b"
    r")",
    re.I,
)
_NOTE_LA_EL = re.compile(r"^(?:\(\*+\)\s*|\*+\s*)?\(\s*(?:La|El)\s+", re.I)
_FUE_CHANGE = re.compile(r"\bfue\s+(?:derogad|reformad|adicionad|anulad)", re.I)


def is_note_line(ln):
    if NOTE.match(ln):
        return True
    s = (ln or "").strip()
    return bool(_NOTE_LA_EL.match(s) and _FUE_CHANGE.search(s))
NOISE = re.compile(r"^(Ficha (del )?art[ií]culo|Volver arriba|Imprimir|\[?Subir\]?)$", re.I)
LEVEL = {"libro": 0, "titulo": 1, "capitulo": 2, "seccion": 3, "subseccion": 4}
VERSION_DATE = re.compile(r"[Vv]ersi[oó]n (?:de la norma )?\d+ de \d+ del (\d{1,2})/(\d{1,2})/(\d{4})")
SCIJ_ANCHOR = re.compile(
    r'<div class="pb-5 pt-2">\s*<a\b[^>]*handleArticuloClick\(([^)]*)\)[^>]*>'
    r"\s*Ficha Art(?:í|i)culo\s*([^<]*?)\s*</a>\s*</div>",
    re.I,
)
SCIJ_HEADING = re.compile(
    r"^A?(?:ART[IÍ]CULO|Art[ií]culo|Art\.|TRANSITORIO|Transitorio|ANEXO|Anexo)\b", re.I
)
_SCIJ_LABEL_ANEXO = re.compile(r"^(\d+)\s+Anexo$", re.I)
_SCIJ_LABEL_TRANS = re.compile(r"^(\d+)\s+Transitorio(?:\s+(\S+))?$", re.I)
_SCIJ_LABEL_ART = re.compile(r"^(\d+)(?:\s+(\S+))?$", re.I)


def _fold(s):
    return unicodedata.normalize("NFKD", s).encode("ascii", "ignore").decode().lower()


def _fold_trim(s):
    return _fold(s).strip(" .()-")


def _paren_depth(s):
    t = _ENUM_CLOSER.sub("", s)
    return t.count("(") - t.count(")")


def _strip_structure_marker(ln):
    return re.sub(r"\(\*\*\)\s*$|\(\*\)\s*$", "", ln).strip()


def _is_path_note(ln):
    return ln.startswith("(") or bool(re.match(r"^NOTA", ln, re.I))


def _is_bare_nota_line(ln):
    s = (ln or "").strip()
    return bool(re.match(r"^NOTA\b", s, re.I)) and not s.startswith("(")


def _join_bare_nota_continuation(lines, start):
    """Join a NOTA: line with following lines until one ends in '.' (structure zone)."""
    joined = lines[start]
    j = start + 1
    while j < len(lines):
        nxt = lines[j]
        if _is_structure_line(nxt) or SCIJ_HEADING.match(nxt):
            break
        joined = f"{joined} {nxt}"
        j += 1
        if nxt.rstrip().endswith("."):
            break
    return joined, j


def _bad_epigraph_tail(phrase):
    w = _fold(phrase.split()[-1]).strip(".")
    return len(w) == 1 or w in _ABBREV_LAST


def _split_epigraph_note(ln):
    """Short epigraph (<=25 words, one sentence) followed by a parenthetical note."""
    ln = ln.strip()
    if not ln:
        return ln, None
    for pat in (r"^(.+?\.\-)\s*(\(.*)$", r"^(.+?\.)\s+(\(.*)$"):
        m = re.match(pat, ln, re.S)
        if not m:
            continue
        epi, note = m.group(1).strip(), m.group(2).strip()
        if len(epi.split()) > 25:
            continue
        if "." in epi.rstrip(".-").strip():
            continue
        if is_note_line(note) or _is_path_note(note):
            return epi, note
    return ln, None


def _parse_heading_rest(rest):
    """Return (heading, body_text, extra_notes) from text after the unit number."""
    rest = rest.strip()
    epi, note = _split_epigraph_note(rest)
    if note:
        heading, _ = _split_heading(epi)
        if not heading:
            heading = epi.rstrip(".-").strip()
        return heading, epi, [note]
    heading, body = _split_heading(rest)
    return heading, body, []


def _is_whole_unit_derog_note(n):
    s = re.sub(r"^(?:\(\*+\)\s*|\*+\s*)?", "", (n or "").strip())
    t = _fold(s)
    if not t.startswith("(derogad"):
        return False
    if t.startswith("(derogado el inciso") or t.startswith("(derogado el parrafo"):
        return False
    return True


def _is_whole_unit_anul_note(n):
    s = re.sub(r"^(?:\(\*+\)\s*|\*+\s*)?", "", (n or "").strip())
    t = _fold(s)
    if not t.startswith("(anulad"):
        return False
    if t.startswith("(anulado el inciso") or t.startswith("(anulado el parrafo"):
        return False
    return True


def _number(raw, suffix):
    n = raw.lstrip("0") or "0"
    if suffix:
        n += " " + _fold(suffix.strip())
    return n


def arabic_to_roman(n):
    """Convert a positive int to an uppercase Roman numeral."""
    n = int(n)
    if n <= 0:
        return str(n)
    parts = []
    for val, dig in (
        (1000, "M"),
        (900, "CM"),
        (500, "D"),
        (400, "CD"),
        (100, "C"),
        (90, "XC"),
        (50, "L"),
        (40, "XL"),
        (10, "X"),
        (9, "IX"),
        (5, "V"),
        (4, "IV"),
        (1, "I"),
    ):
        while n >= val:
            parts.append(dig)
            n -= val
    return "".join(parts)


def find_version_date(lines):
    for ln in lines[:200]:
        m = VERSION_DATE.search(ln)
        if m:
            d, mth, y = m.groups()
            return f"{y}-{int(mth):02d}-{int(d):02d}"
    return ""


def parse_units(lines, norm_id, start_pattern=None):
    """Split text lines into units. Lines before the first unit (title, preamble)
    are skipped; a structure heading (Título, Capítulo...) and the line right
    after it (its name) become the path of the following units."""
    if start_pattern:
        rx = re.compile(start_pattern, re.I)
        for i, ln in enumerate(lines):
            if rx.search(ln):
                lines = lines[i:]
                break
    lines = merge_note_lines(lines, max_extra=48)
    units, path, cur, pending_name = [], [], None, None
    for ln in lines:
        if NOISE.match(ln):
            continue
        m_letter = ARTICLE_LETTER.match(ln)
        m_art = None if m_letter else ARTICLE.match(ln)
        m_tr = TRANSITORIO.match(ln)
        if m_letter or m_art or m_tr:
            if m_letter:
                digits, letter = m_letter.group(1), m_letter.group(2)
                kind, num, rest = "articulo", f"{digits.lstrip('0') or '0'} {letter.lower()}", m_letter.group(3)
            elif m_art:
                kind, num, rest = "articulo", _number(m_art.group(1), m_art.group(2)), m_art.group(3)
            else:
                num = _fold(m_tr.group(1)).upper()
                if m_tr.group(2):
                    num += " " + _fold(m_tr.group(2).strip())
                kind, rest = "transitorio", m_tr.group(3)
            heading, body, extra_notes = _parse_heading_rest(rest)
            cur = {
                "kind": kind,
                "number": num,
                "heading": heading,
                "path": list(path),
                "lines": [],
                "notes": list(extra_notes),
            }
            if body:
                cur["lines"].append(body)
            units.append(cur)
            pending_name = None
            continue
        if STRUCTURE.match(ln) and len(ln) < 160:
            level = LEVEL.get(_fold(ln.split()[0]), 4)
            path = [p for p in path if p[0] < level] + [(level, ln)]
            pending_name = level
            continue
        if pending_name is not None and len(ln) < 160 and not is_note_line(ln):
            # Name of the Título/Capítulo printed on its own line.
            path[-1] = (path[-1][0], f"{path[-1][1]} {ln}")
            pending_name = None
            continue
        pending_name = None
        if cur is None:
            continue
        if is_note_line(ln):
            cur["notes"].append(ln)
        else:
            cur["lines"].append(ln)
    out = []
    for u in units:
        u["path"] = [p[1] for p in u["path"]]
        text = "\n".join(u.pop("lines")).strip()
        u["text"] = text
        u["status"] = _unit_status(text, u["notes"], u.get("heading", ""))
        out.append(u)
    return out


def merge_note_lines(lines, max_extra=12):
    """Join a reform note wrapped over several lines; paren depth ignores a), 2), etc."""
    out, i = [], 0
    while i < len(lines):
        ln = lines[i]
        if is_note_line(ln) and _paren_depth(ln) > 0:
            joined, j = ln, i + 1
            while j < len(lines) and j <= i + max_extra and _paren_depth(joined) > 0:
                nxt = lines[j]
                if ARTICLE.match(nxt) or TRANSITORIO.match(nxt) or STRUCTURE.match(nxt):
                    break
                joined, j = f"{joined} {nxt}", j + 1
            if _paren_depth(joined) == 0:
                out.append(joined)
                i = j
                continue
        out.append(ln)
        i += 1
    return out


def _split_heading(rest):
    """Return (epígrafe guess, verbatim text). The text always keeps the whole
    line, so a wrong guess never alters the article; the guess is a short
    leading phrase ending in a period, e.g. 'Ámbito de aplicación.'"""
    rest = rest.strip().lstrip("-\u2013. ").strip()
    if not rest or is_note_line(rest):
        return "", rest
    m = re.match(r"^([A-ZÁÉÍÓÚÑ][^.]{2,90})\.\s*-?\s*\S", rest)
    if m and len(m.group(1).split()) <= 6 and not _bad_epigraph_tail(m.group(1)):
        return m.group(1).strip(), rest
    bare = rest.rstrip(".").strip()
    if (
        bare
        and len(bare) <= 120
        and len(bare.split()) <= 10
        and bare[0].isupper()
        and rest.rstrip().endswith(".")
        and not rest.rstrip().endswith(":")
        and not _bad_epigraph_tail(bare)
    ):
        return bare, rest
    return "", rest


def _is_repealed(text, notes, heading=""):
    ft = _fold_trim(text)
    fh = _fold_trim(heading)
    if any(_is_whole_unit_derog_note(n) for n in notes):
        if ft in ("", "derogado", "derogada") or (fh and ft == fh):
            return True
    t = _fold(text).strip(" .()")
    if t in ("", "derogado", "derogada") and any("derog" in _fold(n) for n in notes):
        return True
    return t.startswith("derogado") and len(t) < 200


def _is_annulled(text, notes, heading=""):
    """Empty (or Anulado-only) text plus an anulad note, or Anulado-only text."""
    ft = _fold_trim(text)
    fh = _fold_trim(heading)
    if any(_is_whole_unit_anul_note(n) for n in notes):
        if ft in ("", "anulado") or (fh and ft == fh):
            return True
    t = _fold(text).strip(" .()")
    emptyish = t == "" or t == "anulado" or (t.startswith("anulado") and len(t) < 200)
    if not emptyish:
        return False
    if any("anulad" in _fold(n) for n in notes):
        return True
    return "anulad" in t


def _unit_status(text, notes, heading=""):
    if _is_repealed(text, notes, heading):
        return "derogado"
    if _is_annulled(text, notes, heading):
        return "anulado"
    return "vigente"


def _is_part_heading(ln):
    return bool(_PART_HEADING.match(_fold(ln)))


def _is_structure_line(ln):
    if STRUCTURE.match(ln) and len(ln) < 160:
        return True
    return len(ln) < 160 and _is_part_heading(ln)


def _structure_level(ln):
    if STRUCTURE.match(ln):
        return LEVEL.get(_fold(ln.split()[0]), 4)
    return 1  # part headings sit at Título level


# ------------------------------------------------------------------------- eCFR


def _xml_local_tag(el):
    tag = el.tag
    return tag.split("}", 1)[1] if "}" in tag else tag


def _xml_child_head(el):
    for ch in el:
        if _xml_local_tag(ch) == "HEAD":
            return re.sub(r"\s+", " ", "".join(ch.itertext())).strip()
    return ""


def _ecfr_section_heading(head_text, number):
    h = (head_text or "").strip()
    m = re.match(r"^§\s*" + re.escape(number) + r"\s*", h)
    if m:
        return h[m.end() :].strip()
    m = re.match(r"^§\s*[\d.]+\s*", h)
    return h[m.end() :].strip() if m else h


def _ecfr_section_body(el):
    paras = []
    for ch in el:
        tag = _xml_local_tag(ch)
        if tag in ("P", "FP"):
            t = re.sub(r"\s+", " ", "".join(ch.itertext())).strip()
            if t:
                paras.append(t)
    return "\n".join(paras)


def _ecfr_section_notes(el):
    notes = []
    for ch in el:
        if _xml_local_tag(ch) in ("CITA", "SOURCE", "AUTH"):
            t = re.sub(r"\s+", " ", "".join(ch.itertext())).strip()
            if t:
                notes.append(t)
    return notes


def _ecfr_ancestor_path(section_el, root):
    path = []
    parent_map = {c: p for p in root.iter() for c in p}
    cur = section_el
    while cur in parent_map:
        cur = parent_map[cur]
        if cur.get("TYPE") in ECFR_PATH_TYPES:
            head = _xml_child_head(cur)
            if head:
                path.append(head)
    path.reverse()
    return path


def _ecfr_collect_head_lines(root):
    lines = []
    for el in root.iter():
        if _xml_local_tag(el) == "HEAD":
            t = re.sub(r"\s+", " ", "".join(el.itertext())).strip()
            if t:
                lines.append(t)
    return lines


def parse_ecfr_xml(raw, with_path=True):
    """Parse eCFR versioner XML into unit dicts and HEAD lines for title checks."""
    root = ET.fromstring(raw)
    head_lines = _ecfr_collect_head_lines(root)
    units = []
    for el in root.iter():
        if el.get("TYPE") != "SECTION":
            continue
        number = (el.get("N") or "").strip()
        head_text = _xml_child_head(el)
        if not number or "[Reserved]" in head_text:
            continue
        units.append(
            {
                "kind": "seccion",
                "number": number,
                "heading": _ecfr_section_heading(head_text, number),
                "path": _ecfr_ancestor_path(el, root) if with_path else [],
                "text": _ecfr_section_body(el),
                "notes": _ecfr_section_notes(el),
                "status": "vigente",
            }
        )
    return units, head_lines


def ecfr_latest_issue_date(title):
    data = json.loads(fetch_compressed(f"{ECFR_VERSIONER}/titles.json").decode("utf-8"))
    for row in data.get("titles") or []:
        if int(row.get("number", -1)) == int(title):
            d = row.get("latest_issue_date") or row.get("latest_amended_on")
            if d:
                return d
    raise ValueError(f"eCFR title {title} not found in titles.json")


def fetch_ecfr(ecfr, delay=1.0):
    """Download eCFR XML and return (parsed units, source dict, head lines)."""
    title, part = int(ecfr["title"]), int(ecfr["part"])
    version_date = ecfr_latest_issue_date(title)
    sections = ecfr.get("sections")
    raws = []
    if sections:
        for i, sec in enumerate(sections):
            if i:
                time.sleep(delay)
            url = f"{ECFR_VERSIONER}/full/{version_date}/title-{title}.xml?part={part}&section={sec}"
            raws.append(fetch_compressed(url))
        parsed, head_lines = [], []
        for raw in raws:
            units, heads = parse_ecfr_xml(raw, with_path=False)
            parsed.extend(units)
            head_lines.extend(heads)
    else:
        url = f"{ECFR_VERSIONER}/full/{version_date}/title-{title}.xml?part={part}"
        raw = fetch_compressed(url)
        raws = [raw]
        parsed, head_lines = parse_ecfr_xml(raw, with_path=True)
    source_url = f"https://www.ecfr.gov/current/title-{title}/part-{part}"
    raw_concat = b"".join(raws)
    source = {
        "url": source_url,
        "sha256": hashlib.sha256(raw_concat).hexdigest(),
        "retrieved_at": time.strftime("%Y-%m-%d"),
        "version_date": version_date,
    }
    return parsed, source, head_lines


# ---------------------------------------------------------------- SCIJ / Sinalevi


def parse_scij_ficha(html_str):
    """Pull label, title, version and article count from a ficha HTML snippet."""
    text = re.sub(r"<[^>]+>", " ", html_str or "")
    text = html.unescape(text)
    text = re.sub(r"\s+", " ", text).strip()
    out = {
        "norm_label": "",
        "title": "",
        "version_number": None,
        "version_count": None,
        "version_date": "",
        "article_count": None,
    }
    m = re.search(
        r"((?:Ley|Decreto Ejecutivo|Decreto|Reglamento)[^:]*:\s*\d+\s+del\s+\d{1,2}/\d{1,2}/\d{4})",
        text,
        re.I,
    )
    if m:
        out["norm_label"] = m.group(1).strip()
    m = re.search(r"del\s+\d{1,2}/\d{1,2}/\d{4}\s+(.+?)\s+Datos Generales", text, re.I)
    if m:
        out["title"] = m.group(1).strip()
    m = re.search(
        r"Versi[oó]n de la Norma:\s*(\d+)\s+de\s+(\d+)\s+del\s+(\d{1,2})/(\d{1,2})/(\d{4})",
        text,
        re.I,
    )
    if m:
        out["version_number"] = int(m.group(1))
        out["version_count"] = int(m.group(2))
        d, mth, y = m.group(3), m.group(4), m.group(5)
        out["version_date"] = f"{y}-{int(mth):02d}-{int(d):02d}"
    m = re.search(r"Cantidad de Art[ií]culos:\s*(\d+)", text, re.I)
    if m:
        out["article_count"] = int(m.group(1))
    return out


def fetch_scij(nrm, version=None, delay=6.0, cache_dir=None, norm_id=None):
    """Fetch ficha + texto completo from Sinalevi. Sleeps `delay` before each POST."""
    version_id = version if version not in (None, 0, "0", "") else None
    if version_id is None:
        time.sleep(delay)
        redir = post_json(SINALEVI_FICHA_URL, {"idFichaNorma": nrm, "version": -1})
        m = re.search(r"param2=(\d+)", redir.get("direccion") or "")
        if not m:
            raise ValueError(f"SCIJ ficha redirect missing param2 for nrm={nrm}: {redir!r}")
        version_id = int(m.group(1))
    else:
        version_id = int(version_id)

    time.sleep(delay)
    ficha_raw = post_json(SINALEVI_FICHA_URL, {"idFichaNorma": nrm, "version": version_id})
    ficha = parse_scij_ficha(ficha_raw.get("html") or "")

    time.sleep(delay)
    texto_raw = post_json(
        SINALEVI_TEXTO_URL, {"idFichaNorma": nrm, "version": version_id, "busqueda": ""}
    )
    texto_html = texto_raw.get("html") or ""

    if cache_dir and norm_id:
        cache = Path(cache_dir)
        cache.mkdir(parents=True, exist_ok=True)
        (cache / f"{norm_id}.html").write_text(texto_html, encoding="utf-8")
        (cache / f"{norm_id}.ficha.json").write_text(
            json.dumps(ficha_raw, ensure_ascii=False), encoding="utf-8"
        )
    return texto_html, ficha, version_id


def is_scij_text(html_str):
    return bool(SCIJ_ANCHOR.search(html_str or ""))


def split_scij(html_str):
    """Split texto completo HTML into (label, scij_article_id, fragment_html)."""
    out, prev = [], 0
    for m in SCIJ_ANCHOR.finditer(html_str or ""):
        frag = html_str[prev : m.start()]
        args = [a.strip() for a in m.group(1).split(",")]
        art_id = int(args[3]) if len(args) > 3 and args[3].isdigit() else (args[3] if len(args) > 3 else None)
        label = re.sub(r"\s+", " ", m.group(2)).strip()
        out.append((label, art_id, frag))
        prev = m.end()
    return out


def scij_version_from_text(html_str):
    """Read version id from handleArticuloClick(n, nrm, versionId, artId)."""
    m = re.search(r"handleArticuloClick\s*\(\s*\d+\s*,\s*\d+\s*,\s*(\d+)", html_str or "")
    return int(m.group(1)) if m else None


def _scij_label_known(label):
    lab = re.sub(r"\s+", " ", (label or "")).strip()
    return bool(
        _SCIJ_LABEL_ANEXO.fullmatch(lab)
        or _SCIJ_LABEL_TRANS.fullmatch(lab)
        or _SCIJ_LABEL_ART.fullmatch(lab)
    )


def scij_label(label):
    """Map an anchor label to (kind, number). Unknown -> articulo + folded label."""
    lab = re.sub(r"\s+", " ", (label or "")).strip()
    m = _SCIJ_LABEL_ANEXO.fullmatch(lab)
    if m:
        return "anexo", m.group(1)
    m = _SCIJ_LABEL_TRANS.fullmatch(lab)
    if m:
        num = arabic_to_roman(int(m.group(1)))
        if m.group(2):
            num += " " + _fold(m.group(2))
        return "transitorio", num
    m = _SCIJ_LABEL_ART.fullmatch(lab)
    if m:
        return "articulo", _number(m.group(1), m.group(2))
    return "articulo", _fold(lab)


def parse_scij(html_str, norm_id):
    """Parse Sinalevi texto completo HTML into (units, warnings)."""
    units, warnings = [], []
    path = []  # list of (level, name)
    for frag_i, (label, _art_id, frag) in enumerate(split_scij(html_str)):
        kind, number = scij_label(label)
        if not _scij_label_known(label):
            warnings.append(f"unknown SCIJ label '{label}'")

        lines = merge_note_lines(html_to_lines(frag), max_extra=48)
        h_idx = next((i for i, ln in enumerate(lines) if SCIJ_HEADING.match(ln)), None)
        pre_notes, leading, split_notes = [], [], []

        if h_idx is None:
            warnings.append(f"{kind} {number}: no heading line")
            body, heading = lines, ""
        else:
            before, hline, after = lines[:h_idx], lines[h_idx], lines[h_idx + 1 :]
            i = 0
            while i < len(before):
                ln = before[i]
                if _is_structure_line(ln):
                    level = _structure_level(ln)
                    path = [p for p in path if p[0] < level] + [(level, _strip_structure_marker(ln))]
                    i += 1
                    while i < len(before):
                        ln2 = before[i]
                        if _is_part_heading(ln2) and path and not _is_part_heading(path[-1][1]):
                            path[-1] = (path[-1][0], f"{path[-1][1]} {ln2}")
                            i += 1
                            continue
                        if _is_structure_line(ln2):
                            break
                        if _is_path_note(ln2) or is_note_line(ln2):
                            if _is_bare_nota_line(ln2):
                                joined, i = _join_bare_nota_continuation(before, i)
                                pre_notes.append(joined)
                            else:
                                pre_notes.append(ln2)
                                i += 1
                            continue
                        if len(ln2) < 160 and not ln2.endswith(":"):
                            path[-1] = (path[-1][0], f"{path[-1][1]} {ln2}")
                            i += 1
                            continue
                        break
                    continue
                if _is_path_note(ln) or is_note_line(ln):
                    if _is_bare_nota_line(ln):
                        joined, i = _join_bare_nota_continuation(before, i)
                        pre_notes.append(joined)
                    else:
                        pre_notes.append(ln)
                        i += 1
                    continue
                # Later fragments: keep unattached lines as leading unit text.
                if frag_i > 0:
                    leading.append(ln)
                i += 1

            m_letter = ARTICLE_LETTER.match(hline)
            m_art = None if m_letter else ARTICLE.match(hline)
            m_tr = TRANSITORIO.match(hline)
            heading, body, split_notes = "", list(leading), []
            if m_letter:
                digits, letter, rest_raw = m_letter.group(1), m_letter.group(2), m_letter.group(3)
                got = digits.lstrip("0") or "0"
                exp = number.split()[0].lstrip("0") or "0"
                if got == exp:
                    number = f"{got} {letter.lower()}"
                heading, rest, split_notes = _parse_heading_rest(rest_raw)
                if rest:
                    body.append(rest)
            elif m_art:
                heading, rest, split_notes = _parse_heading_rest(m_art.group(3))
                if rest:
                    body.append(rest)
                if kind == "articulo":
                    got = m_art.group(1).lstrip("0") or "0"
                    exp = number.split()[0].lstrip("0") or "0"
                    if got != exp:
                        warnings.append(f"{kind} {number}: heading line says {m_art.group(1)}")
            elif m_tr:
                num = _fold(m_tr.group(1)).upper()
                if m_tr.group(2):
                    num += " " + _fold(m_tr.group(2).strip())
                number = num
                heading, rest, split_notes = _parse_heading_rest(m_tr.group(3))
                if rest:
                    body.append(rest)
            else:
                body.append(hline)
            body.extend(after)
            if not heading and body:
                ln0 = body[0]
                if (
                    len(ln0.split()) <= 10
                    and ln0.rstrip().endswith(".")
                    and not ln0.rstrip().endswith(":")
                ):
                    guess, _ = _split_heading(ln0)
                    if guess:
                        heading = guess

        notes, text_lines = list(pre_notes) + split_notes, []
        for ln in body:
            if NOISE.match(ln):
                continue
            if is_note_line(ln):
                notes.append(ln)
            else:
                text_lines.append(ln)
        text = "\n".join(text_lines).strip()
        units.append(
            {
                "kind": kind,
                "number": number,
                "heading": heading,
                "path": [p[1] for p in path],
                "text": text,
                "notes": notes,
                "status": _unit_status(text, notes, heading),
            }
        )
    return units, warnings


def validate(units, expected_title=None, lines=None, expected_articles=None):
    """Return a list of problems. Empty means the parse looks sound."""
    problems = []
    if not units:
        return ["no units found"]
    if expected_title and lines is not None:
        head = _fold(" ".join(lines[:80]))
        if _fold(expected_title) not in head:
            problems.append(f"title '{expected_title}' not found near the top of the source")
    if expected_articles is not None:
        got = sum(u["kind"] == "articulo" for u in units)
        if got != expected_articles:
            problems.append(f"article count {got} != SCIJ ficha {expected_articles}")
    seen, last = set(), 0
    for u in units:
        key = (u["kind"], u["number"])
        if key in seen:
            problems.append(f"duplicate {u['kind']} {u['number']}")
        seen.add(key)
        if u["kind"] == "articulo" and u["number"].isdigit():
            n = int(u["number"])
            if n > last + 1:
                missing = f"{last + 1}" if n == last + 2 else f"{last + 1} to {n - 1}"
                problems.append(f"gap: article {missing} missing")
            last = max(last, n)
        if not u["text"] and u["status"] == "vigente":
            problems.append(f"{u['kind']} {u['number']} has no text")
        if u["status"] == "vigente":
            for line in u["text"].split("\n")[:3]:
                if _WHOLE_UNIT_REPEAL_START.match(line.strip()):
                    problems.append(
                        f"{u['kind']} {u['number']}: vigente text mentions repeal/anulacion in first 200 chars"
                    )
                    break
            if _EMBEDDED_ART.search(u["text"]):
                problems.append(
                    f"{u['kind']} {u['number']}: vigente text embeds roman-numbered ARTICULO heading"
                )
        for n in u.get("notes", []):
            if n.count("(") > n.count(")"):
                problems.append(f"note not closed in source: {u['kind']} {u['number']}: {n[:100]}")
        for p in u.get("path", []):
            if p.startswith("(") or re.search(r"NOTA", p, re.I):
                problems.append(f"{u['kind']} {u['number']}: path polluted: {p[:100]}")
    return problems


def unit_id(norm_id, kind, number):
    if kind == "articulo":
        return f"{norm_id}:art-{number.replace(' ', '-').lower()}"
    if kind == "seccion":
        return f"{norm_id}:sec-{number}"
    if kind == "anexo":
        return f"{norm_id}:anexo-{number}"
    return f"{norm_id}:trans-{number.upper().replace(' ', '-')}"


def build_units(parsed, norm, source):
    """Attach norm metadata and hashes. Duplicate numbers (e.g. transitorios
    of several reforming laws) get a -2, -3 suffix so ids stay unique."""
    out, counts = [], {}
    for p in parsed:
        uid = unit_id(norm["id"], p["kind"], p["number"])
        counts[uid] = counts.get(uid, 0) + 1
        if counts[uid] > 1:
            uid = f"{uid}-{counts[uid]}"
        out.append(
            Unit(
                id=uid,
                norm_id=norm["id"],
                norm_title=norm["title"],
                kind=p["kind"],
                number=p["number"],
                heading=p["heading"],
                path=p["path"],
                text=p["text"],
                notes=p["notes"],
                status=p["status"],
                area=norm.get("area", ""),
                rank=norm.get("rank", ""),
                version_date=source.get("version_date", ""),
                source_url=source.get("url", ""),
                retrieved_at=source.get("retrieved_at", ""),
                source_sha256=source.get("sha256", ""),
                text_sha256=hashlib.sha256(p["text"].encode("utf-8")).hexdigest(),
            )
        )
    return out


# ------------------------------------------------------------------- storage


def load_registry(root=None):
    path = Path(root or LAWS_DIR) / "registry.json"
    return json.loads(path.read_text(encoding="utf-8"))["norms"]


def registry_entry(norm_id, root=None):
    for n in load_registry(root):
        if n["id"] == norm_id:
            return n
    raise KeyError(f"{norm_id} is not in laws/registry.json")


def write_norm(norm, units, source, problems, root=None):
    d = Path(root or LAWS_DIR) / norm["id"]
    d.mkdir(parents=True, exist_ok=True)
    meta = {
        **{k: norm[k] for k in ("id", "title", "number", "type", "area", "rank") if k in norm},
        "version_date": source.get("version_date", ""),
        "source_url": source.get("url", ""),
        "retrieved_at": source.get("retrieved_at", ""),
        "source_sha256": source.get("sha256", ""),
        "units": len(units),
        "articles": sum(u.kind == "articulo" for u in units),
        "transitorios": sum(u.kind == "transitorio" for u in units),
        "anexos": sum(u.kind == "anexo" for u in units),
        "derogados": sum(u.status == "derogado" for u in units),
        "warnings": problems,
    }
    if source.get("scij_version_label"):
        meta["scij_version_label"] = source["scij_version_label"]
    if source.get("scij_article_count") is not None:
        meta["scij_article_count"] = source["scij_article_count"]
    (d / "norm.json").write_text(json.dumps(meta, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    with open(d / "articles.jsonl", "w", encoding="utf-8") as f:
        for u in units:
            f.write(json.dumps(asdict(u), ensure_ascii=False) + "\n")
    (d / "text.md").write_text(render_markdown(meta, units), encoding="utf-8")
    return d


def render_markdown(meta, units):
    lines = [
        f"# {meta['title']}",
        "",
        f"Version of {meta['version_date'] or 'unknown date'}, retrieved {meta['retrieved_at']} from {meta['source_url']}.",
        "Generated by `neko_legal_kb.cli ingest`; do not edit by hand.",
        "",
    ]
    last_path = None
    labels = {"articulo": "Artículo", "transitorio": "Transitorio", "anexo": "Anexo", "seccion": "Section"}
    for u in units:
        if u.path != last_path:
            for p in u.path:
                lines += [f"## {p}", ""]
            last_path = u.path
        label = labels.get(u.kind, u.kind)
        title = f"### {label} {u.number}" + (f". {u.heading}" if u.heading else "")
        lines += [title, f"<!-- cite: {u.id} -->", "", u.text or "(sin texto)", ""]
        lines += [f"> {n}" for n in u.notes] + ([""] if u.notes else [])
    return "\n".join(lines)


def load_units(root=None):
    root = Path(root or LAWS_DIR)
    units = []
    for path in sorted(root.glob("*/articles.jsonl")):
        with open(path, encoding="utf-8") as f:
            units += [Unit(**json.loads(ln)) for ln in f if ln.strip()]
    return units


def load_norms(root=None):
    root = Path(root or LAWS_DIR)
    return [json.loads(p.read_text(encoding="utf-8")) for p in sorted(root.glob("*/norm.json"))]


# ------------------------------------------------------------------- ingest


def _load_ficha_file(path):
    if not path or not Path(path).exists():
        return {}
    raw = json.loads(Path(path).read_text(encoding="utf-8"))
    return parse_scij_ficha(raw.get("html") or "")


def _scij_source(texto_html, ficha, src_url, retrieved_at):
    raw = texto_html.encode("utf-8")
    lines = html_to_lines(texto_html[:30000])
    vnum, vcount = ficha.get("version_number"), ficha.get("version_count")
    label = f"{vnum} de {vcount}" if vnum is not None and vcount is not None else ""
    source = {
        "url": src_url,
        "sha256": hashlib.sha256(raw).hexdigest(),
        "retrieved_at": retrieved_at,
        "version_date": ficha.get("version_date") or find_version_date(lines),
        "scij_version_label": label,
        "scij_article_count": ficha.get("article_count"),
    }
    return source, lines


def ingest(norm_id, file=None, url=None, root=None, force=False, delay=6.0, refresh=False):
    """Ingest one registered norm from a saved file, a URL, or its SCIJ id.
    Returns (dir, units, problems). Refuses to write when the title check
    fails unless force is set; other problems are written as warnings."""
    norm = registry_entry(norm_id, root)
    root_path = Path(root or LAWS_DIR)
    parse_warnings = []
    ficha = {}
    expected_articles = None

    if file:
        path = Path(file)
        raw = path.read_bytes()
        if raw[:4] == b"%PDF":
            lines, raw = read_source(path)
            src_url = url or norm.get("source_url", "")
            parsed = parse_units(lines, norm_id, norm.get("start_pattern"))
            source = {
                "url": src_url,
                "sha256": hashlib.sha256(raw).hexdigest(),
                "retrieved_at": time.strftime("%Y-%m-%d"),
                "version_date": find_version_date(lines),
            }
        else:
            text = decode(raw)
            if is_scij_text(text):
                ficha = _load_ficha_file(path.parent / (path.stem + ".ficha.json"))
                parsed, parse_warnings = parse_scij(text, norm_id)
                src_url = url or norm.get("source_url", "")
                source, lines = _scij_source(text, ficha, src_url, time.strftime("%Y-%m-%d"))
                expected_articles = ficha.get("article_count")
            else:
                lines, raw = read_source(path)
                src_url = url or norm.get("source_url", "")
                parsed = parse_units(lines, norm_id, norm.get("start_pattern"))
                source = {
                    "url": src_url,
                    "sha256": hashlib.sha256(raw).hexdigest(),
                    "retrieved_at": time.strftime("%Y-%m-%d"),
                    "version_date": find_version_date(lines),
                }
    elif url:
        time.sleep(delay)
        raw = fetch(url)
        tmp = root_path / ".cache"
        tmp.mkdir(exist_ok=True)
        cached = tmp / (norm_id + (".pdf" if raw[:4] == b"%PDF" else ".html"))
        cached.write_bytes(raw)
        lines, _ = read_source(cached)
        parsed = parse_units(lines, norm_id, norm.get("start_pattern"))
        source = {
            "url": url,
            "sha256": hashlib.sha256(raw).hexdigest(),
            "retrieved_at": time.strftime("%Y-%m-%d"),
            "version_date": find_version_date(lines),
        }
    elif norm.get("scij_nrm"):
        cache = root_path / ".cache"
        html_path = cache / f"{norm_id}.html"
        ficha_path = cache / f"{norm_id}.ficha.json"
        nrm = norm["scij_nrm"]
        if not refresh and html_path.exists() and ficha_path.exists():
            texto_html = html_path.read_text(encoding="utf-8")
            ficha = _load_ficha_file(ficha_path)
            version_id = norm.get("scij_version") or scij_version_from_text(texto_html)
            retrieved_at = time.strftime("%Y-%m-%d", time.localtime(html_path.stat().st_mtime))
        else:
            texto_html, ficha, version_id = fetch_scij(
                nrm, norm.get("scij_version"), delay, cache, norm_id
            )
            retrieved_at = time.strftime("%Y-%m-%d")
        src_url = SINALEVI_INFO_URL.format(nrm=nrm, version=version_id)
        parsed, parse_warnings = parse_scij(texto_html, norm_id)
        source, lines = _scij_source(texto_html, ficha, src_url, retrieved_at)
        expected_articles = ficha.get("article_count")
    elif norm.get("ecfr") and not file:
        parsed, source, lines = fetch_ecfr(norm["ecfr"], delay)
    else:
        src_url = norm.get("source_url") or ""
        if not src_url:
            raise ValueError(f"{norm_id}: no file, url, source_url or scij_nrm")
        time.sleep(delay)
        raw = fetch(src_url)
        tmp = root_path / ".cache"
        tmp.mkdir(exist_ok=True)
        cached = tmp / (norm_id + (".pdf" if raw[:4] == b"%PDF" else ".html"))
        cached.write_bytes(raw)
        lines, _ = read_source(cached)
        parsed = parse_units(lines, norm_id, norm.get("start_pattern"))
        source = {
            "url": src_url,
            "sha256": hashlib.sha256(raw).hexdigest(),
            "retrieved_at": time.strftime("%Y-%m-%d"),
            "version_date": find_version_date(lines),
        }

    problems = parse_warnings + validate(
        parsed, norm.get("match_title"), lines, expected_articles=expected_articles
    )
    if any(p.startswith("title") or p == "no units found" for p in problems) and not force:
        raise ValueError(f"{norm_id}: refusing to write: {problems}")
    units = build_units(parsed, norm, source)
    return write_norm(norm, units, source, problems, root), units, problems
