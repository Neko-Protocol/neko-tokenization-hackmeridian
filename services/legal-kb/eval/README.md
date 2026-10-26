# Retrieval evaluation

Versioned question sets that measure whether the knowledge base returns the expected source. They test retrieval only: they do not grade the answers the Launchpad assistant writes.

| File             | What it checks                                                                                 | Tool it exercises                |
| ---------------- | ---------------------------------------------------------------------------------------------- | -------------------------------- |
| `laws.json`      | 20 questions (12 in Spanish, 8 in English) with the verbatim article a reviewer expects to see | `search_law` (assistant's first) |
| `questions.json` | 4 questions with the obligations guide that should answer them                                 | `search_kb`                      |

The expected articles in `laws.json` come from the citations the tokenization admin's compliance checklist already relies on (`apps/admin/src/features/compliance/rules.ts`). They were written before the first run and were not changed to match the results.

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

Why it matters for the assistant: the system prompt only lets it cite articles it retrieved in the same conversation, and the backend tells it when the knowledge base is unreachable, so a miss produces a weaker answer rather than an invented citation. Grading the assistant's final answers (citation validity, abstention, permission checks) is the next step and is not measured here.
