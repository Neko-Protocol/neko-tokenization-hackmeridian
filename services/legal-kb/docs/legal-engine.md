# Legal data engine: design

Origin: adapted from the cr-tax-kb engine (github.com/Villarley/cr-tax-kb).

Status: proposal, adapted 2026-10-25. Scope: primary and interpretive sources Neko needs for tokenizing real-world assets (Costa Rica first): securities and public offering, anti money laundering and virtual asset service providers, personal data protection, plus US offering exemptions and El Salvador's digital assets law as reference. Stored so an AI can answer with exact, citable, dated text and never needs to scrape a website at question time.

## 1. What "extremely precise" requires

An answer is only as good as the text behind it. For legal work that means:

1. **Verbatim text at article level.** The unit a lawyer cites is the article (or transitorio, or inciso). Summaries are useful, but the answer must be able to quote the article itself.
2. **Exact lookup.** "Artículo 15 quater de la Ley 7786" must return that article, not the five articles that sound most similar.
3. **Time.** Laws are reformed. Every article needs the version it belongs to and the dates it was in force, so the engine can answer "what did the law say at offering time".
4. **Provenance.** Each article carries its source URL, the date it was retrieved, a hash of the source file, and the reform notes SCIJ prints under it ("Así reformado por...").
5. **Binding force.** A law, a decree, a SUGEVAL reglamento, a court ruling and a firm's blog post do not weigh the same. Every record says what it is. Reference-only foreign law is marked as such.
6. **Refusal.** If the corpus does not contain it, the engine says so instead of letting the model fill the gap.

A plain vector database gives none of 2 to 6 by itself. That drives the architecture.

## 2. Git repo or vector database? Both, with different jobs

| Layer               | Job                                                                          | Where it lives                                                         |
| ------------------- | ---------------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| **Source of truth** | Verbatim normalized texts, metadata, reform notes, versions                  | This Git repo, as JSONL and Markdown                                   |
| **Serving index**   | Fast exact lookup, keyword search, semantic search, filters by date and area | Built from the repo: SQLite file today, Postgres + pgvector in the app |
| **Explainers**      | Plain-language guides that cite articles (`corpus/`)                         | This Git repo                                                          |

Why Git as the source of truth:

- **Diffs are the legal history.** When the Asamblea reforms an article, re-ingesting produces a one-line diff in `articles.jsonl`. `git log -p` on an article is its reform history. A database overwrites rows silently.
- **Review.** A change to the law store goes through a pull request and CI checks (article counts, numbering gaps, title match) before anything serves it.
- **Portable.** Any tool, model or vendor can read JSONL. The index can be rebuilt from scratch in seconds, so it is disposable.
- **Cheap.** Size estimate: a focused set of norms for tokenization, under 50 MB of text. That is small for Git and tiny for any database.

Why an index on top:

- **Exact lookup** (norm + article + date) is a SQL query, not a similarity search.
- **Lexical search** (BM25 / Postgres full text with Spanish stemming) is the most precise retriever for legal terms such as "oferta publica", "activos virtuales", "sujetos obligados".
- **Semantic search** (embeddings) catches paraphrased questions that share no words with the article.
- The engine runs both and merges them (reciprocal rank fusion), then returns the full article text with its citation.

Why not a dedicated vector database (Pinecone, Weaviate, etc.): at tens of thousands of vectors, pgvector or sqlite-vec are more than enough, keep everything in one place, and avoid a second vendor. Revisit only if the corpus grows by two orders of magnitude (for example full jurisprudence).

Recommended deployment:

1. **Now:** the MCP server in this repo builds an in-memory SQLite FTS5 index from the files at start. Zero infrastructure, works in Claude Code, Claude Desktop, Cursor.
2. **App:** a `build` step loads the same JSONL into Postgres (the app's database, or Supabase) with `tsvector` (Spanish config) and `pgvector` columns. The Neko app and an HTTP MCP endpoint query that.
3. **Embeddings:** computed at build time and stored next to each article, keyed by the article's content hash so unchanged articles are never re-embedded. Provider is an open decision.

## 3. Data model

```
norm            one law, decree, reglamento or regulation
  version       one consolidated text of that norm (SCIJ "version"), with valid_from / valid_to
    unit        article, transitorio, or annex; verbatim text; reform notes; status
reference       unit -> unit or norm ("remite al articulo 8", "reformado por Ley 10961")
interpretation  ruling, oficio, dictamen or resolution that interprets units
explainer       corpus/ guide sections that cite units
```

Files in the repo:

```
laws/registry.json                    catalog of norms to ingest (curated, see section 5)
laws/<norm-id>/norm.json              metadata of the current version
laws/<norm-id>/articles.jsonl         one unit per line (current version)
laws/<norm-id>/text.md                human-readable rendering
```

Unit record (one line of `articles.jsonl`):

```json
{
  "id": "ley-7732:art-1",
  "norm_id": "ley-7732",
  "norm_title": "Ley Reguladora del Mercado de Valores",
  "kind": "articulo",
  "number": "1",
  "heading": "",
  "path": ["Titulo ...", "Capitulo ..."],
  "text": "verbatim article text",
  "notes": ["(Asi reformado por ...)"],
  "status": "vigente",
  "area": "valores",
  "rank": "ley",
  "version_date": "2026-05-12",
  "source_url": "https://sinalevi.go.cr/...",
  "retrieved_at": "2026-10-25",
  "source_sha256": "...",
  "text_sha256": "..."
}
```

Citation format everywhere: `ley-7732:art-1` (norm id, unit). Explainers in `corpus/` link to units the same way, so a guide's claim can be checked against the article it summarizes.

Rank (binding force), highest first: `constitucion`, `tratado`, `ley`, `decreto` (reglamento ejecutivo), `resolucion-general` (SUGEVAL, SUGEF), `jurisprudencia-vinculante` (Sala Constitucional), `jurisprudencia`, `dictamen-pgr` (binding on the administration that asked), `oficio` (informative only), `secondary`.

## 4. Versions and change tracking

- Each ingest records the SCIJ version date, the source hash and the per-article text hash.
- Git keeps every previous version. For point-in-time answers, the build step can load older versions from Git history into the index with `valid_from` / `valid_to`.
- A scheduled check (weekly) compares the SCIJ version of each registered norm with the stored one and opens a PR when something changed, listing which articles changed.

## 5. Scope: what the engine holds

Norm ids are assigned at ingest; law numbers below are confirmed against the source title at ingest time (the ingester refuses a file whose title does not match). Areas: `valores`, `antilavado`, `datos`, `internacional`, `referencia`, `sociedades` (SPV vehicles: trusts, SAS companies), `fintech`. Mexico, Colombia and Argentina use norm ids prefixed `mx-`, `co-` and `ar-` (securities, fintech/virtual assets, anti money laundering, SPV vehicles).

**Securities and public offering (valores)**

- Ley Reguladora del Mercado de Valores, Ley 7732
- Reglamento sobre Oferta Publica de Valores (and related SUGEVAL rules)

**Anti money laundering and VASPs (antilavado)**

- Ley 7786 (including Ley 10961 reform: article 15 quater, virtual asset service providers registered with SUGEF)
- Related SUGEF rules for virtual asset service providers

**Personal data (datos)**

- Ley de Proteccion de la Persona frente al Tratamiento de sus Datos Personales, Ley 8968
- Reglamento a la Ley 8968 (Decreto 37554-JP)

**US offering exemptions (internacional)**

- Regulation D (17 CFR 230.500 to 230.508)
- Regulation S (17 CFR 230.901 to 230.905)
- Regulation Crowdfunding (17 CFR part 227)

**Reference only (referencia)**

- Ley de Emision de Activos Digitales (El Salvador): not law in Costa Rica; cite as comparative reference only

**SPV vehicles (sociedades)**

- Trusts, SAS companies and similar vehicles used to hold tokenized assets (Costa Rica and, with `mx-`, `co-`, `ar-` ids, Mexico, Colombia, Argentina)

**Fintech and virtual assets (fintech)**

- Fintech licensing, payment and virtual-asset rules (Costa Rica and regional norms with `mx-`, `co-`, `ar-` ids)

**Interpretation layer** (later): PGR dictamenes, Sala Constitucional and other rulings that interpret the units above. Stored with `rank`, date and the units they interpret; never mixed into the norm text.

## 6. Ingestion pipeline

1. **Acquire.** SCIJ consolidated text is the default source for Costa Rican norms, because SCIJ prints reform notes under each article. Since 2026 SCIJ lives at `sinalevi.go.cr` and loads its text through two POST endpoints: `_CargarFicha` and `_CargarTextoCompleto`. The ingester cuts units at SCIJ's "Ficha Articulo" anchors. Registry fields: `scij_nrm` and `scij_version`. Non-Costa Rican norms (US CFR, El Salvador) have no `scij_nrm` and are ingested from a saved file with `--file` and `--url`.
2. **Snapshot.** The raw file is hashed (SHA-256). The hash and URL go into `norm.json`.
3. **Parse.** HTML or PDF to text lines, then split into units at "ARTICULO n" / "TRANSITORIO n" headings, tracking Libro / Titulo / Capitulo / Seccion as the unit's path, and separating reform notes from the article text.
4. **Validate.** Title must match the registry; numbering gaps and duplicates are reported; zero-unit parses fail.
5. **Review and commit.** Diffs go through a PR. CI re-runs the checks.
6. **Build.** Index for MCP (now) and Postgres + pgvector (app).

Access constraint: cloud environments often cannot reach `sinalevi.go.cr` and most `.go.cr` hosts, so ingestion runs on a machine that can reach them, for a short list of named norms, at least 5 seconds between requests. Raw pages are cached in `laws/.cache/` (gitignored) and `ingest` reuses them unless `--refresh` is passed. Legal texts are public, but SCIJ's terms of use should be checked before running a scheduled refresh against it.

## 7. Contract for AI clients

MCP tools:

- `get_article(norm, article)`: exact verbatim text with notes, status, version and source.
- `search_law(query, area?, norm?)`: ranked units with citation ids.
- `list_norms(area?)`: what the engine covers, with version dates.
- Explainer tools (`search_kb`, `get_document`, `list_documents`, `get_sources`) for `corpus/`.

Rules served with the tools: search first; cite the article id and source URL for every claim; say when a source is secondary or reference only; never present a bill as law; leave final positions to a licensed lawyer.

## 8. Phases

1. **Store and ingester**: registry, article model, SCIJ/HTML/PDF parser, validation, search and MCP tools over units, tests on a synthetic fixture.
2. **First ingestion**: Ley 7732, oferta publica reglamento, Ley 7786 (with 15 quater), Ley 8968 and reglamento.
3. **International and reference norms**, explainers in `corpus/`, weekly change check.
4. **Postgres + pgvector build** and hybrid ranking, once the embeddings provider is chosen.
5. **Interpretation layer** (PGR, courts, regulator oficios).

## 9. Open decisions

- Access route for ingestion (section 6).
- Embeddings provider and whether the app's Postgres hosts the index.
- How explainers in `corpus/` are authored and reviewed alongside product compliance work.
