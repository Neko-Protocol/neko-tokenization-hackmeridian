# Neko Legal KB

Legal knowledge base for tokenizing real-world assets with Neko, served to any AI over MCP. Verbatim laws stored article by article (with version date, source URL and hash), plus a cited obligations checklist.

Engine: Python 3.12, standard library only, BM25 over SQLite FTS5. Not legal advice: final positions belong to a licensed lawyer.

## What is inside

Norms, in order of obligations ([laws/registry.json](laws/registry.json)):

| Order | Norm                                                                                                          | Area          | Units | Version          | Source                  |
| ----- | ------------------------------------------------------------------------------------------------------------- | ------------- | ----- | ---------------- | ----------------------- |
| 1     | Ley 7732, Ley Reguladora del Mercado de Valores                                                               | valores       | 212   | 2026-09-02       | SCIJ                    |
| 2     | Reglamento sobre Oferta Pública de Valores                                                                    | valores       | 150   | 2026-10-05       | SCIJ                    |
| 3     | Ley 7786 (anti money laundering), with the Ley 10961 reform (art. 15 quater, virtual asset service providers) | antilavado    | 183   | 2026-06-09       | SCIJ                    |
| 4     | Ley 8968, protección de datos personales                                                                      | datos         | 37    | 2011-07-07       | SCIJ                    |
| 4     | Decreto 37554-JP, reglamento a la Ley 8968                                                                    | datos         | 91    | 2019-02-21       | SCIJ                    |
| 5     | Regulation D (17 CFR 230.500 to 230.508)                                                                      | internacional | 8     | 2026-10-19       | eCFR                    |
| 5     | Regulation S (17 CFR 230.901 to 230.905)                                                                      | internacional | 5     | 2026-10-19       | eCFR                    |
| 5     | Regulation Crowdfunding (17 CFR part 227)                                                                     | internacional | 22    | 2026-10-19       | eCFR                    |
| 6     | El Salvador, Ley de Emisión de Activos Digitales (reference only)                                             | referencia    | 52    | 2023             | Corte Suprema PDF       |
| 7     | Mexico: Ley Fintech (LRITF)                                                                                   | fintech       | 145   | DOF 2025-11-14   | CNBV PDF                |
| 7     | Mexico: Ley del Mercado de Valores                                                                            | valores       | 456   | CNBV compilation | CNBV PDF                |
| 7     | Mexico: Ley General de Títulos y Operaciones de Crédito (fideicomiso, art. 381 and following)                 | sociedades    | 430   | DOF 2024         | Orden Jurídico Nacional |
| 8     | Colombia: Ley 964 de 2005, mercado de valores                                                                 | valores       | 86    | 2026-10-15       | Secretaría del Senado   |
| 8     | Colombia: Ley 1258 de 2008, SAS                                                                               | sociedades    | 46    | 2026-10-15       | Secretaría del Senado   |
| 9     | Argentina: Ley 26.831, Mercado de Capitales                                                                   | valores       | 158   | current          | InfoLEG                 |
| 9     | Argentina: Ley 25.246 with Ley 27.739 (PSAV)                                                                  | antilavado    | 46    | current          | InfoLEG                 |

Areas for filters and registry entries: `valores`, `antilavado`, `datos`, `internacional`, `referencia`, `sociedades` (SPV vehicles: trusts, SAS companies), `fintech`. The engine also holds Mexico, Colombia and Argentina norms (securities, fintech/virtual assets, anti money laundering, SPV vehicles) with ids prefixed `mx-`, `co-` and `ar-` as they are added to [laws/registry.json](laws/registry.json).

Explainers: [corpus/obligations/latam-spv-and-obligations.md](corpus/obligations/latam-spv-and-obligations.md) (Mexico, Colombia, Argentina: SPV vehicles, offering rules, AML) and [corpus/obligations/tokenization-obligations.md](corpus/obligations/tokenization-obligations.md), the Costa Rica checklist (securities offering, AML and SUGEF registration, personal data, US investors, and how SEP-57 enforces each), every claim cited to an article id.

Not ingested yet: Mexico LFPIORPI with its 2025 reform, Colombia Código de Comercio (fiducia), Argentina CNV RG 1069/2025 and Código Civil y Comercial (fideicomiso).

## Use it

```
cd services/legal-kb
PYTHONPATH=src python3 -m neko_legal_kb.cli law "proveedores de servicios de activos virtuales"
PYTHONPATH=src python3 -m neko_legal_kb.cli article ley-7786 15-quater
PYTHONPATH=src python3 -m neko_legal_kb.cli search "SUGEF registration"
PYTHONPATH=src python3 -m neko_legal_kb.cli norms
```

MCP over stdio: `claude mcp add neko-legal-kb -- python3 /absolute/path/to/services/legal-kb/src/neko_legal_kb/mcp_server.py`. Tools: `search_law`, `get_article`, `list_norms`, `search_kb`, `get_document`, `list_documents`, `get_sources`.

Hosted (Cloud Run, Streamable HTTP at `/mcp/<token>`, health at `/health`): see [docs/deploy.md](docs/deploy.md).

## Add or refresh a norm

Add it to `laws/registry.json`, then `PYTHONPATH=src python3 -m neko_legal_kb.cli ingest <id>` (SCIJ by `scij_nrm`, eCFR by `ecfr`, or `--file saved.pdf --url <source>`). Design: [docs/legal-engine.md](docs/legal-engine.md).

## Tests

```
python3 -m unittest discover -s tests
```
