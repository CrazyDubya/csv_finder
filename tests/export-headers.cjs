const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const { test } = require('node:test');
const { JSDOM } = require('jsdom');
const root = process.env.CSV_APP_SOURCE || path.resolve(__dirname, '..');

async function waitFor(predicate) {
  for (let index = 0; index < 100; index++) {
    if (predicate()) return;
    await new Promise(resolve => setTimeout(resolve, 5));
  }
  throw new Error('FileReader application flow timed out');
}

for (const [label, header] of [
  ['ordinary', 'Name'], ['comma', 'Last, First'], ['quote', 'A "quoted" label'],
  ['newline', 'First\nSecond'], ['carriage-return', 'First\rSecond']
]) {
  test(`upload/export/reimport preserves ${label} header and values`, async () => {
    const dom = new JSDOM(fs.readFileSync(path.join(root, 'index.html'), 'utf8'), {
      runScripts: 'outside-only', url: 'https://example.test/'
    });
    const w = dom.window;
    let blob;
    let networkAttempts = 0;
    w.fetch = () => { networkAttempts++; throw new Error('Network disabled'); };
    w.XMLHttpRequest = class { constructor() { networkAttempts++; throw new Error('Network disabled'); } };
    w.URL.createObjectURL = value => { blob = value; return 'blob:synthetic-fixture'; };
    w.URL.revokeObjectURL = () => {};
    w.HTMLAnchorElement.prototype.click = function () {};
    try {
      for (const file of ['d3-csv.js', 'fuse.js', 'utils.js', 'script.js']) {
        w.eval(fs.readFileSync(path.join(root, file), 'utf8'));
      }
      if (w.document.readyState === 'loading') {
        await new Promise(resolve => w.document.addEventListener('DOMContentLoaded', resolve, { once: true }));
      }
      assert.equal(typeof w.d3.csvFormat, 'undefined', 'exercise the actual fallback default');
      const value = 'Doe, "Jane"\nSecond line';
      const quote = text => '"' + text.replace(/"/g, '""') + '"';
      const inputText = `${quote(header)},Note\r\n${quote(value)},hello\r\n`;
      const input = w.document.getElementById('fileInput');
      async function upload(text) {
        w.document.getElementById('fileStatus').textContent = '';
        Object.defineProperty(input, 'files', { configurable: true,
          value: [new w.File([text], 'synthetic.csv', { type: 'text/csv' })] });
        input.dispatchEvent(new w.Event('change'));
        await waitFor(() => w.document.getElementById('fileStatus').textContent.includes('Successfully loaded 1 records'));
      }
      async function exportedText() {
        blob = undefined;
        w.document.getElementById('exportBtn').click();
        assert.ok(blob, 'actual export button creates a blob');
        return new Promise((resolve, reject) => {
          const reader = new w.FileReader();
          reader.onload = () => resolve(reader.result);
          reader.onerror = reject;
          reader.readAsText(blob);
        });
      }
      await upload(inputText);
      const exported = await exportedText();
      const parsed = w.CsvParser.csvParse(exported);
      assert.deepEqual(Object.keys(parsed[0]), [header, 'Note']);
      assert.equal(parsed.length, 1);
      assert.equal(parsed[0][header], value);
      assert.equal(parsed[0].Note, 'hello');
      await upload(exported);
      assert.equal(await exportedText(), exported, 'second actual upload/export remains stable');
      assert.equal(networkAttempts, 0);
    } finally {
      dom.window.close();
    }
  });
}
