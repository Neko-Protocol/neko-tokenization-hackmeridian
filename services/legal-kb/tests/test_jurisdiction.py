"""Jurisdiction detection and soft boost for search_law."""

import json
import sys
import tempfile
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "src"))

from neko_legal_kb.search import (  # noqa: E402
    KnowledgeBase,
    detect_jurisdictions,
    jurisdiction_factor,
    norm_jurisdiction,
)


class DetectJurisdictionsTest(unittest.TestCase):
    def test_country_names_and_demonyms(self):
        self.assertEqual(detect_jurisdictions("oferta pública en Costa Rica"), {"cr"})
        self.assertEqual(detect_jurisdictions("under Costa Rican law"), {"cr"})
        self.assertEqual(detect_jurisdictions("norma costarricense"), {"cr"})
        self.assertEqual(detect_jurisdictions("oferta privada en México"), {"mx"})
        self.assertEqual(detect_jurisdictions("Mexican securities law"), {"mx"})
        self.assertEqual(detect_jurisdictions("ley mexicana"), {"mx"})
        self.assertEqual(detect_jurisdictions("concepto de valor en Colombia"), {"co"})
        self.assertEqual(detect_jurisdictions("Colombian SAS"), {"co"})
        self.assertEqual(detect_jurisdictions("mercado de capitales de Argentina"), {"ar"})
        self.assertEqual(detect_jurisdictions("El Salvador activos digitales"), {"sv"})
        self.assertEqual(detect_jurisdictions("United States Regulation D"), {"us"})

    def test_regulators(self):
        self.assertEqual(detect_jurisdictions("registro ante SUGEF"), {"cr"})
        self.assertEqual(detect_jurisdictions("autorización de SUGEVAL"), {"cr"})
        self.assertEqual(detect_jurisdictions("definición CNBV"), {"mx"})
        self.assertEqual(detect_jurisdictions("facultades de la CNV"), {"ar"})

    def test_mexican_states_not_us(self):
        self.assertEqual(detect_jurisdictions("Estados Unidos Mexicanos"), {"mx"})
        self.assertNotIn("us", detect_jurisdictions("Estados Unidos Mexicanos"))

    def test_no_detection_keeps_empty(self):
        self.assertEqual(detect_jurisdictions("oferta privada dirigida a inversionistas"), set())
        self.assertEqual(detect_jurisdictions("definition of accredited investor"), set())


class NormJurisdictionTest(unittest.TestCase):
    def test_prefix_and_scij(self):
        self.assertEqual(norm_jurisdiction({"id": "mx-lmv", "title": "LMV"}), "mx")
        self.assertEqual(norm_jurisdiction({"id": "co-ley-964-2005", "title": "x"}), "co")
        self.assertEqual(norm_jurisdiction({"id": "ar-ley-26831", "title": "x"}), "ar")
        self.assertEqual(norm_jurisdiction({"id": "us-17-cfr-230-reg-d", "title": "Regulation D"}), "us")
        self.assertEqual(norm_jurisdiction({"id": "sv-ley-emision-activos-digitales", "title": "x"}), "sv")
        self.assertEqual(
            norm_jurisdiction(
                {
                    "id": "ley-7732",
                    "title": "Ley Reguladora del Mercado de Valores",
                    "source_url": "https://sinalevi.go.cr/x",
                }
            ),
            "cr",
        )

    def test_boost_and_penalty(self):
        cr = {"id": "ley-7732", "title": "LRMV", "source_url": "https://sinalevi.go.cr/x"}
        us = {"id": "us-17-cfr-230-reg-d", "title": "Regulation D"}
        self.assertGreater(jurisdiction_factor({"cr"}, cr), 1.0)
        self.assertLess(jurisdiction_factor({"cr"}, us), 1.0)
        self.assertEqual(jurisdiction_factor(set(), us), 1.0)


def _write_norm(root, norm_id, title, units, source_url=""):
    d = root / norm_id
    d.mkdir(parents=True)
    meta = {
        "id": norm_id,
        "title": title,
        "number": "1",
        "type": "ley",
        "area": "valores",
        "rank": "ley",
        "version_date": "2026-01-01",
        "source_url": source_url,
        "retrieved_at": "2026-10-26",
        "source_sha256": "0" * 64,
        "units": len(units),
        "articles": len(units),
        "transitorios": 0,
        "anexos": 0,
        "derogados": 0,
        "warnings": [],
    }
    (d / "norm.json").write_text(json.dumps(meta), encoding="utf-8")
    with open(d / "articles.jsonl", "w", encoding="utf-8") as f:
        for u in units:
            f.write(json.dumps(u, ensure_ascii=False) + "\n")


class JurisdictionBoostSearchTest(unittest.TestCase):
    def test_costa_rica_question_ranks_cr_above_us(self):
        """On a tiny fixture, a Costa Rica query must prefer the CR article over a US one."""
        with tempfile.TemporaryDirectory() as tmp:
            laws_root = Path(tmp) / "laws"
            corpus = Path(tmp) / "corpus"
            corpus.mkdir()
            laws_root.mkdir()
            (laws_root / "registry.json").write_text(json.dumps({"norms": []}), encoding="utf-8")

            cr_text = (
                "Oferta pública de valores. Para efectos de esta ley costarricense se entenderá "
                "por oferta pública todo ofrecimiento de valores al público inversionista."
            )
            us_text = (
                "Public offering of securities. An issuer may offer or sell securities in a "
                "public offering under this regulation without registration when conditions are met."
            )
            _write_norm(
                laws_root,
                "ley-demo-cr",
                "Ley Demo de Valores",
                [
                    {
                        "id": "ley-demo-cr:art-2",
                        "norm_id": "ley-demo-cr",
                        "norm_title": "Ley Demo de Valores",
                        "kind": "articulo",
                        "number": "2",
                        "heading": "Oferta pública",
                        "path": [],
                        "text": cr_text,
                        "notes": [],
                        "status": "vigente",
                        "area": "valores",
                        "rank": "ley",
                        "version_date": "2026-01-01",
                        "source_url": "https://sinalevi.go.cr/demo",
                        "retrieved_at": "2026-10-26",
                        "source_sha256": "0" * 64,
                        "text_sha256": "a" * 64,
                    }
                ],
                source_url="https://sinalevi.go.cr/demo",
            )
            _write_norm(
                laws_root,
                "us-17-cfr-demo",
                "Regulation Demo: Public Offering Rules (17 CFR)",
                [
                    {
                        "id": "us-17-cfr-demo:sec-230.500",
                        "norm_id": "us-17-cfr-demo",
                        "norm_title": "Regulation Demo: Public Offering Rules (17 CFR)",
                        "kind": "seccion",
                        "number": "230.500",
                        "heading": "Public offering",
                        "path": [],
                        "text": us_text,
                        "notes": [],
                        "status": "vigente",
                        "area": "internacional",
                        "rank": "decreto",
                        "version_date": "2026-01-01",
                        "source_url": "https://www.ecfr.gov/demo",
                        "retrieved_at": "2026-10-26",
                        "source_sha256": "0" * 64,
                        "text_sha256": "b" * 64,
                    }
                ],
                source_url="https://www.ecfr.gov/demo",
            )

            kb = KnowledgeBase(root=corpus, laws_root=laws_root)
            q = "What counts as a public offering of securities under Costa Rican law?"
            self.assertEqual(detect_jurisdictions(q), {"cr"})
            hits = kb.search_law(q, k=2)
            self.assertTrue(hits)
            self.assertEqual(hits[0]["id"], "ley-demo-cr:art-2")
            self.assertTrue(any(h["id"].startswith("ley-demo-cr") for h in hits))
            # Without a country cue the US article may still compete; with the cue CR is first.
            ids = [h["id"] for h in hits]
            if "us-17-cfr-demo:sec-230.500" in ids:
                self.assertLess(ids.index("ley-demo-cr:art-2"), ids.index("us-17-cfr-demo:sec-230.500"))


if __name__ == "__main__":
    unittest.main()
