# Optional actual-DOM export regression

Run from the repository root with Node 24+ and jsdom 31.0.1. Keep test dependencies outside the checkout:

```sh
scratch=$(mktemp -d)
npm install --prefix "$scratch" --no-audit --no-fund --ignore-scripts jsdom@31.0.1
NODE_PATH="$scratch/node_modules" node --test tests/export-headers.cjs
rm -rf "$scratch"
```

No product package or lockfile change is required. The script loads the whole local index and actual parser/Fuse/utils/application scripts into jsdom. It uploads a synthetic File, clicks the actual Export button, reads its Blob with FileReader, and uploads/exports that text again. Download navigation is intercepted, so this is not real browser download or visual UI coverage. Execution fetch/XHR are blocked. Each window is closed after testing.

Set CSV_APP_SOURCE to an absolute alternate checkout to run the exact tests against a baseline. The historical baseline has two passing and three failing cases. No real CSVs or live services are used.
