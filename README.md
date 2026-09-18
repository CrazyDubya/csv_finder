# csv_finder

A browser-based CSV viewer with fuzzy search. Open the page, load a CSV, search and filter it. Nothing is uploaded anywhere.

## What's here

- `index.html`, `script.js`, `style.css` — the page. Theme choice is read from `localStorage` at load, defaulting to light if storage is unavailable.
- `worker.js` — a Web Worker that parses CSV with `d3-dsv` and builds a Fuse.js index for search, off the main thread.
- `csv-worker.js` — a second worker that parses in 1000-row chunks; its own comment gives the reason as preventing UI blocking.
- `utils.js` — small helpers written to replace Lodash, starting with `debounce`.
- `tests/` — Jest unit and integration tests plus a Playwright end-to-end spec.

Both workers pull `d3-dsv` and `fuse.js` from CDNs at runtime, so the page needs network access even though your data never leaves the browser.

## Running it

```bash
npm install          # test tooling
npm start            # serves the directory over python3 -m http.server
npm test             # Jest
npm run test:e2e     # Playwright
npm run lint
```

There is no build step.

## Status

Working, with CI on every push.
