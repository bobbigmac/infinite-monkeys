# make-shakespeare

A parody Node.js project that asks an LLM to write something — with the system prompt *"You are an infinity of monkeys at typewriters"* and nothing else — then compares the result to the complete works of Shakespeare.

## Setup

```bash
npm install
cp .env.example .env
```

Configure `.env`:

```bash
LLM_ENDPOINT=...
LLM_API_KEY=...
LLM_MODEL=...
```

The Shakespeare corpus lives at `corpus/shakespeare.txt` (Project Gutenberg #100).

## Run

```bash
npm run monkey
```

Each run writes two log files in `logs/`:

- `YYYY-MM-DD.json` — raw API response
- `YYYY-MM-DD.md` — human-readable version of the same run

If you run more than once on the same day, a timestamp suffix is added.

## Site

```bash
npm run build-site
```

This builds `docs/data/` from the logs. GitHub Pages serves `docs/` as a browsable archive:

- **Today** landing page: *Did the monkeys write Shakespeare today?*
- **Previous days** in the sidebar, with verdict, monkey index, audit, and full text

Enable GitHub Pages from **GitHub Actions** (`.github/workflows/pages.yml`). Each daily run commits fresh logs, report data, and rebuilt site data.

Historical runs without `.report.json` files show text only until you run:

```bash
npm run backfill-reports
```

## Test

```bash
npm test
```

## Daily GitHub Action

`.github/workflows/daily-monkeys.yml` can run this once per day and commit new logs. It is **disabled by default** — uncomment the `schedule` block to enable it.

Required GitHub configuration:

- **Secret:** `LLM_API_KEY`
- **Variables:** `LLM_MODEL`, `LLM_ENDPOINT`

Works fine on a public repo; secrets are not exposed to forks.

## Metrics

Each run produces a **monkey index** (0 = pure monkey, 1 = basically Shakespeare) and a plain verdict, plus:

- **Closest passage** — which play the output most resembles, with a similarity score and excerpt
- **Accidental quotations** — verbatim phrases lifted from the canon
- **Canon vocabulary** — how much of the vocabulary Shakespeare would recognise
- **Elizabethan register** — thou/hath/prithee density
- **Pentameter drift** — how many lines accidentally land in iambic pentameter
