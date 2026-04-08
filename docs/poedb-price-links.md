# PoEDB Historical Price Link Mapping

This repository includes a PoEDB integration that uses a generated hardcoded link map.
New app installs get those bundled links out of the box.

## What is generated

- Hardcoded map file: `src/data/poedb-item-links.generated.json`
- Generator script: `scripts/generate-poedb-links.js`
- Runtime service usage: src/services/poedb.service.ts`r`n- Runtime stores history in a URL-level cache to avoid duplicating the same 30-day history for every item variant.

- PoEDB UI tab/store usage:
  - `src/components/settings-tabs/prices/poedb-prices-settings/PoeDbPricesSettings.tsx`
  - `src/store/poeDbPriceStore.ts`

## Item source

Item universe is pulled dynamically from `poe.ninja` API categories inside the generator script.
It is **not** a static list in the app.

## How to generate/update links

From repo root:

```bash
npm run poedb:generate-links
```

Default mode is `missing`, so only currently-unmapped items are retried.

Available commands:

```bash
npm run poedb:generate-links
npm run poedb:generate-links:all
npm run poedb:generate-links:report
```

Equivalent direct usage:

```bash
node scripts/generate-poedb-links.js <league> <concurrency> --mode=<missing|all|report> --limit=<N>
```

Examples:

```bash
node scripts/generate-poedb-links.js Standard 4 --mode=missing
node scripts/generate-poedb-links.js Standard 4 --mode=all
node scripts/generate-poedb-links.js Standard 4 --mode=report
node scripts/generate-poedb-links.js Standard 2 --mode=missing --limit=50
```

## Modes

- `missing` (default): scan current poe.ninja universe, resolve only items not in the hardcoded map.
- `all`: force re-resolve all items from current poe.ninja universe.
- `report`: only retry unresolved items from previous run report.

## Output report

A run writes `scripts/poedb-links-report.json` with:

- run metadata (`league`, `mode`, timestamps)
- universe/target counts
- total hardcoded key count
- unresolved items for follow-up

You can keep this file for diagnostics or delete it after review.

## In-app behavior

In PoEDB tab:

- Bundled hardcoded links are applied automatically from the shipped map when price items are available.
- Pull missing dates fetches only URLs where latest saved date is older than today.
- Full refresh forces fetch for all mapped URLs.
- Pulling is deduplicated by PoEDB URL (one request can update many item rows).

## Why not all items resolve

Not every poe.ninja item has a PoEDB economy chart page with OHLC + volume history.
So partial coverage is expected and not a runtime failure.

## Typical update flow for a new league

1. Fetch latest mappings (fast path):
   - `npm run poedb:generate-links`
2. (Optional) Retry unresolved subset:
   - `npm run poedb:generate-links:report`
3. Commit updated `src/data/poedb-item-links.generated.json`.
4. Release the app with the updated `src/data/poedb-item-links.generated.json`.
5. In app, pull history from the PoEDB tab when you want to refresh OHLC data.



