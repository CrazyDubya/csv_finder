# csv_finder

A browser-based CSV viewer and search tool. Drop in a CSV, get fuzzy search, filtering, sorting, and charts — no server, no upload.

## What's here

- `index.html` / `script.js` / `style.css` — the app. Fuzzy search via Fuse.js, charts via D3, light/dark theme persisted to `localStorage`.
- `worker.js`, `csv-worker.js` — parsing and search moved off the main thread so large files stay responsive.
- `utils.js` — shared parsing and formatting helpers.
- `tests/` — Jest unit and integration tests plus a Playwright end-to-end suite.

## Running it

```bash
npm install
npm start          # serves the directory on localhost
npm test           # Jest
npm run test:e2e   # Playwright
npm run lint
```

There is no build step — the page loads its scripts directly.

## Status

Working and tested, with CI on every push. The most complete of the small standalone tools here.
