import json
import shutil
import sys
import tempfile
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "src"))

from neko_legal_kb import laws  # noqa: E402
from neko_legal_kb.mcp_server import Server  # noqa: E402
from neko_legal_kb.search import KnowledgeBase, unit_lookup_id  # noqa: E402

FIXTURE = ROOT / "tests" / "fixtures" / "sample_norm.html"
SAMPLE = {
    "id": "ley-prueba",
    "title": "Ley de Prueba Sintética",
    "number": "0000",
    "type": "ley",
    "area": "valores",
    "rank": "ley",
    "match_title": "Ley de Prueba Sintética",
    "phase": 2,
    "scij_nrm": None,
}


class ParserTest(unittest.TestCase):
    lines, _ = laws.read_source(FIXTURE)
    units = laws.parse_units(lines, "x")

    def by(self, kind, number):
        return next(u for u in self.units if u["kind"] == kind and u["number"] == number)

    def test_units_found(self):
        got = [(u["kind"], u["number"]) for u in self.units]
        self.assertEqual(
            got,
            [("articulo", "1"), ("articulo", "2"), ("articulo", "2 bis"), ("articulo", "3"), ("articulo", "5"),
             ("transitorio", "I"), ("transitorio", "UNICO")],
        )

    def test_script_text_ignored(self):
        self.assertNotIn(("articulo", "99"), [(u["kind"], u["number"]) for u in self.units])

    def test_text_is_verbatim_and_keeps_heading(self):
        a1 = self.by("articulo", "1")
        self.assertEqual(a1["heading"], "Objeto")
        self.assertTrue(a1["text"].startswith("Objeto. Texto de prueba del artículo uno."))
        # An in-text reference at the start of a line is not a new article.
        self.assertIn("Artículo 5 de esta ley sin separador.", a1["text"])

    def test_notes_split_from_text(self):
        a1 = self.by("articulo", "1")
        self.assertEqual(len(a1["notes"]), 1)
        self.assertNotIn("Así reformado", a1["text"])
        self.assertNotIn("Ficha", a1["text"])

    def test_structure_path(self):
        self.assertEqual(self.by("articulo", "1")["path"], ["TÍTULO PRIMERO Disposiciones generales", "CAPÍTULO I Objeto"])
        self.assertEqual(self.by("articulo", "3")["path"][-1], "CAPÍTULO II Derogaciones")

    def test_repealed(self):
        self.assertEqual(self.by("articulo", "3")["status"], "derogado")
        self.assertEqual(self.by("articulo", "5")["status"], "vigente")

    def test_version_date(self):
        self.assertEqual(laws.find_version_date(self.lines), "2026-05-12")

    def test_validate(self):
        self.assertEqual(laws.validate(self.units, "Ley de Prueba Sintética", self.lines), ["gap: article 4 missing"])
        self.assertTrue(laws.validate(self.units, "Código de Trabajo", self.lines)[0].startswith("title"))
        self.assertEqual(laws.validate([]), ["no units found"])

    def test_article_letter_suffix_plain_text(self):
        lines = [
            "Art. 6.- Créase la Comisión.",
            "Art. 6-A.- El patrimonio estará compuesto.",
        ]
        units = laws.parse_units(lines, "x")
        self.assertEqual([(u["kind"], u["number"]) for u in units], [("articulo", "6"), ("articulo", "6 a")])


class ScijParserTest(unittest.TestCase):
    """Real SCIJ (sinalevi.go.cr) cases: units are cut at SCIJ's 'Ficha Articulo' anchors."""

    raw = (ROOT / "tests" / "fixtures" / "scij_sample.html").read_text(encoding="utf-8")
    units, warnings = laws.parse_scij(raw, "x")

    def by(self, kind, number):
        return next(u for u in self.units if u["kind"] == kind and u["number"] == number)

    def test_units_and_no_warnings(self):
        got = [(u["kind"], u["number"]) for u in self.units]
        self.assertEqual(got, [("articulo", "88"), ("articulo", "137"), ("articulo", "66 ch"), ("transitorio", "IV")])
        self.assertEqual(self.warnings, [])

    def test_newline_inside_paragraph_is_a_space(self):
        # Word HTML has "Articulo\n88.-" inside one <p>: it must stay one heading line.
        a = self.by("articulo", "88")
        self.assertEqual(a["heading"], "")
        self.assertIn("78, 79, 81 y 83 se reducirán", a["text"])
        self.assertEqual(a["path"], ["TITULO I DISPOSICIONES PRELIMINARES", "CAPITULO UNICO Normas Tributarias"])
        self.assertEqual(a["notes"], ["(Así reformado por el artículo 1º de la ley No.7900 de 3 de agosto de 1999)"])

    def test_typo_heading_and_note_before_heading(self):
        a = self.by("articulo", "137")
        self.assertEqual(a["heading"], "")
        self.assertEqual(a["notes"], ["(NOTA DE SINALEVI: Nota editorial previa al artículo.)"])

    def test_letter_suffix_overrides_scij_label(self):
        self.assertEqual(laws.unit_id("ley-7092", "articulo", self.by("articulo", "66 ch")["number"]), "ley-7092:art-66-ch")
        self.assertEqual(unit_lookup_id("ley-7092", "66-CH"), "ley-7092:art-66-ch")

    def test_annulled_transitorio(self):
        t = self.by("transitorio", "IV")
        self.assertEqual((t["status"], t["text"]), ("anulado", ""))
        self.assertEqual(t["path"], ["Disposiciones Transitorias."])
        self.assertEqual(unit_lookup_id("ley-7092", "transitorio 4"), "ley-7092:trans-IV")


ECFR_SAMPLE = """<?xml version="1.0"?>
<DIV5 N="230" TYPE="PART">
  <HEAD>Part 230 Regulation D</HEAD>
  <DIV8 N="230.500" TYPE="SECTION">
    <HEAD>§ 230.500 Scope of exemption.</HEAD>
    <P>First paragraph here.</P>
    <P>Second paragraph here.</P>
    <CITA>17 CFR 230.500</CITA>
  </DIV8>
  <DIV8 N="230.501" TYPE="SECTION">
    <HEAD>§ 230.501 [Reserved]</HEAD>
  </DIV8>
</DIV5>
"""


class EcfrParserTest(unittest.TestCase):
    units, head_lines = laws.parse_ecfr_xml(ECFR_SAMPLE.encode("utf-8"))

    def test_one_section_skips_reserved(self):
        self.assertEqual(len(self.units), 1)
        u = self.units[0]
        self.assertEqual(u["kind"], "seccion")
        self.assertEqual(u["number"], "230.500")
        self.assertEqual(u["heading"], "Scope of exemption.")
        self.assertEqual(u["text"], "First paragraph here.\nSecond paragraph here.")
        self.assertEqual(u["notes"], ["17 CFR 230.500"])
        self.assertEqual(laws.unit_id("us-17-cfr-230-reg-d", "seccion", "230.500"), "us-17-cfr-230-reg-d:sec-230.500")
        self.assertEqual(unit_lookup_id("us-17-cfr-230-reg-d", "230.500"), "us-17-cfr-230-reg-d:sec-230.500")
        self.assertEqual(unit_lookup_id("us-17-cfr-230-reg-d", "sec-230.500"), "us-17-cfr-230-reg-d:sec-230.500")
        self.assertIn("Regulation D", " ".join(self.head_lines))


class MergeNoteLinesTest(unittest.TestCase):
    def test_merges_enumerator_inside_note(self):
        lines = [
            "(Nota de Sinalevi: según resolución: a) uno.",
            "b) dos.",
            "c) tres.)",
            "Texto del artículo.",
        ]
        self.assertEqual(
            laws.merge_note_lines(lines),
            ["(Nota de Sinalevi: según resolución: a) uno. b) dos. c) tres.)", "Texto del artículo."],
        )

    def test_does_not_merge_when_paren_never_closes(self):
        lines = [
            "(Así anulado por la Sala ... del",
            "Texto que sigue.",
            "f) Otra cosa.",
        ]
        self.assertEqual(laws.merge_note_lines(lines), lines)


class IngestTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.tmp = Path(tempfile.mkdtemp())
        (cls.tmp / "registry.json").write_text(json.dumps({"norms": [SAMPLE]}), encoding="utf-8")
        cls.dir, cls.units, cls.problems = laws.ingest("ley-prueba", file=FIXTURE, url="https://example.org/x", root=cls.tmp)
        cls.kb = KnowledgeBase(laws_root=cls.tmp)

    @classmethod
    def tearDownClass(cls):
        shutil.rmtree(cls.tmp)

    def test_files_written(self):
        meta = json.loads((self.dir / "norm.json").read_text(encoding="utf-8"))
        self.assertEqual(meta["units"], 7)
        self.assertEqual(meta["derogados"], 1)
        self.assertEqual(meta["version_date"], "2026-05-12")
        self.assertEqual(len(meta["source_sha256"]), 64)
        self.assertIn("<!-- cite: ley-prueba:art-2-bis -->", (self.dir / "text.md").read_text(encoding="utf-8"))

    def test_refuses_wrong_title(self):
        bad = dict(SAMPLE, id="otra", match_title="Código de Trabajo")
        (self.tmp / "registry.json").write_text(json.dumps({"norms": [SAMPLE, bad]}), encoding="utf-8")
        with self.assertRaises(ValueError):
            laws.ingest("otra", file=FIXTURE, root=self.tmp)
        self.assertFalse((self.tmp / "otra").exists())

    def test_exact_lookup(self):
        self.assertEqual(self.kb.get_unit("ley-prueba", "Artículo 2 bis").number, "2 bis")
        self.assertEqual(self.kb.get_unit("ley-prueba", "transitorio I").kind, "transitorio")
        self.assertEqual(self.kb.get_unit("ley-prueba", "ley-prueba:art-5").number, "5")
        self.assertIsNone(self.kb.get_unit("ley-prueba", "4"))

    def test_search_skips_repealed(self):
        ids = [h["id"] for h in self.kb.search_law("texto de prueba articulo", 10)]
        self.assertIn("ley-prueba:art-1", ids)
        self.assertNotIn("ley-prueba:art-3", ids)
        ids = [h["id"] for h in self.kb.search_law("derogado", 10, include_repealed=True)]
        self.assertIn("ley-prueba:art-3", ids)

    def test_mcp_get_article(self):
        server = Server(self.kb)
        out = server.call_tool("get_article", {"norm": "ley-prueba", "article": "1"})
        self.assertFalse(out["isError"])
        self.assertIn("[cite: ley-prueba:art-1", out["content"][0]["text"])
        self.assertTrue(server.call_tool("get_article", {"norm": "ley-7732", "article": "1"})["isError"])


class RegistryTest(unittest.TestCase):
    def test_registry_areas_in_areas(self):
        reg = laws.load_registry()
        ids = [n["id"] for n in reg]
        self.assertEqual(len(ids), len(set(ids)))
        for n in reg:
            with self.subTest(norm=n["id"]):
                self.assertIn(n["area"], laws.AREAS)
                self.assertIn(n["rank"], laws.RANKS)
                self.assertIn(n["type"], laws.TYPES)
                self.assertTrue(n["match_title"])

    def test_stored_norms_consistent(self):
        reg = {n["id"] for n in laws.load_registry()}
        for meta in laws.load_norms():
            with self.subTest(norm=meta["id"]):
                self.assertIn(meta["id"], reg)
                units = [u for u in laws.load_units() if u.norm_id == meta["id"]]
                self.assertEqual(len(units), meta["units"])
                self.assertEqual(len({u.id for u in units}), len(units))
                self.assertTrue(meta["source_url"].startswith("https://"))

    def test_lookup_ids(self):
        self.assertEqual(unit_lookup_id("ley-7732", "Artículo 029"), "ley-7732:art-29")
        self.assertEqual(unit_lookup_id("ley-7732", "Transitorio único"), "ley-7732:trans-UNICO")

    def test_real_law_skipped_when_missing(self):
        law_dir = ROOT / "laws" / "ley-7732"
        if not law_dir.is_dir():
            self.skipTest("laws/ley-7732/ not ingested")
        kb = KnowledgeBase()
        self.assertIn("ley-7732", kb.norms)


if __name__ == "__main__":
    unittest.main()
