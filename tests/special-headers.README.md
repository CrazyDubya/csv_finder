# Optional special-header data regression

Node24+ with jsdom31.0.1, from repository root. Keep dependency installation outside the checkout:

```sh
scratch=$(mktemp -d)
npm install --prefix "$scratch" --no-audit --no-fund --ignore-scripts jsdom@31.0.1
NODE_PATH="$scratch/node_modules" node --test tests/special-headers.cjs
rm -rf "$scratch"
```

The complete local index and its scripts load in jsdom. Synthetic File upload, actual filter/search handlers and Export/Blob reading run without live fetch/XHR. Download navigation is intercepted, not real-browser download or visual-layout coverage. CSV_APP_SOURCE can point to another checkout for baseline/composition checks. No product package or lockfile change required.

If the independent export-header regression is present, run both:

```sh
NODE_PATH=/path/to/external/node_modules node --test tests/special-headers.cjs tests/export-headers.cjs
```
