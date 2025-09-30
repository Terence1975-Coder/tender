# IASME Research Scraper

This project provides a production-ready CLI for harvesting the IASME Network Directory and enriching each company with public contact information.

## Features

- Dual-mode directory harvesting:
  - Playwright-powered renderer that iterates A–Z tabs and certification filters.
  - Automatic detection of JSON/XHR feeds for direct ingestion when available.
- Website discovery via profile parsing and DuckDuckGo fallback search.
- Contact enrichment with likely pages (`/contact`, `/about`, `/team`, etc.).
- Extraction of emails, phone numbers, physical addresses, and LinkedIn URLs.
- Role discovery for senior IT and HR leaders using heuristic ranking.
- Structured logging and configurable concurrency/delay/backoff.
- Output validation with Zod and optional schema key remapping.
- Preview mode for on-screen review plus JSON/JSONL export.

## Getting Started

```bash
npm install
npm run build
```

Install Playwright browsers if needed:

```bash
npx playwright install
```

## CLI Usage

```bash
npm start -- \
  --index https://iasme.co.uk/network-directory/ \
  --format jsonl \
  --output out/iasme_companies.jsonl \
  --max-companies 100 \
  --concurrency 4 \
  --delay-ms 500 \
  --retries 3
```

Additional options:

- `--map-file schema-map.json` remaps output keys to match existing ingestion schemas.
- `--preview` prints the collected records to stdout.
- `--dry-run` skips writing the output file.
- `--headless false` shows the Playwright browser during debugging.

## Testing

```bash
npm test
```

Enable the optional live smoke test by removing the `.skip` modifier in `tests/smoke.test.ts` when network access is available.
