# Retrieval evaluation

Versioned question sets that measure whether the knowledge base returns the expected source. They test retrieval only: they do not grade the answers the Launchpad assistant writes.

| File                 | What it checks                                                                                 | Tool it exercises                |
| -------------------- | ---------------------------------------------------------------------------------------------- | -------------------------------- |
| `laws.json`          | 20 questions (12 in Spanish, 8 in English) with the verbatim article a reviewer expects to see | `search_law` (assistant's first) |
| `laws-holdout.json`  | 12 held-out questions (mix es/en, several countries), written from article text before search changes | `search_law`              |
| `questions.json`     | 4 questions with the obligations guide that should answer them                                 | `search_kb`                      |

The expected articles in `laws.json` come from the citations the tokenization admin's compliance checklist already relies on (`apps/admin/src/features/compliance/rules.ts`). They were written before the first run and were not changed to match the results.

`laws-holdout.json` was written by reading article text in the corpus (not by running search). It was evaluated once for a baseline before jurisdiction changes, then once after tuning against `laws.json` only.

Run it from `services/legal-kb`:

```bash
PYTHONPATH=src python3 -m neko_legal_kb.cli eval        # top-3, exits 1 while any question misses
PYTHONPATH=src python3 -m neko_legal_kb.cli eval -k 5
```

## Results

First run, 26 October 2026, corpus at tokenization commit `a54fafe`:

| Set              | Top-1 | Top-3 | Top-5 |
| ---------------- | ----- | ----- | ----- |
| `laws.json`      | 6/20  | 9/20  | 14/20 |
| `questions.json` | 4/4   | 4/4   | 4/4   |

What the misses show: general questions about "public offering" in one country often rank articles from another country's norm first (for example the Mexican private offering article for a Costa Rican question), and English questions about Latin American law tend to pull US rules. The search has no country filter from the question text yet. Passing `norm` or `area`, which the tool already accepts, avoids most of these.

### After jurisdiction boost (date 2026-10-26)

Soft jurisdiction re-rank in `search_law`: detect country, demonym, or regulator cues in the query; boost matching norms and down-weight others; leave ranking unchanged when nothing is detected. Modest Spanish/English synonym and definition-query tweaks. Tuned only against `laws.json`.

| Set                 | Top-1 | Top-3 | Top-5 |
| ------------------- | ----- | ----- | ----- |
| `laws.json`         | 11/20 | 16/20 | 18/20 |
| `laws-holdout.json` (baseline, before boost) | 5/12 | 7/12 | 7/12 |
| `laws-holdout.json` (after boost, single run) | 5/12 | 7/12 | 8/12 |
| `questions.json`    | 4/4   | 4/4   | 4/4   |

Remaining misses on `laws.json`:

- `oferta privada dirigida a inversionistas sofisticados o institucionales` (no country cue; Mexican LMV art. 8 still ranks first; expected CR reglamento art. 8 bis)
- `protección de datos personales en Colombia, ámbito de aplicación y principios` (expected `co-ley-1258-2008:art-4`, which is the SAS ban on public-market listing; the corpus has no Colombian personal-data law)

Remaining misses on `laws-holdout.json` after the boost: English CR registry registration (`ley-7732:art-6`), Mexican Fintech CNBV definitions (`mx-lritf:art-4`), English Colombian SAS listing ban (`co-ley-1258-2008:art-4`), and El Salvador digital-asset definition (`sv-ley-emision-activos-digitales:art-3`, close siblings in the same norm rank higher).

Why it matters for the assistant: the system prompt only lets it cite articles it retrieved in the same conversation, and the backend tells it when the knowledge base is unreachable, so a miss produces a weaker answer rather than an invented citation. Grading the assistant's final answers (citation validity, abstention, permission checks) is the next step and is not measured here.
