const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const { test } = require('node:test');
const { JSDOM } = require('jsdom');
const root = process.env.CSV_APP_SOURCE || path.resolve(__dirname, '..');

async function withApp(body) {
  const dom = new JSDOM(fs.readFileSync(path.join(root, 'index.html'), 'utf8'), { runScripts: 'outside-only', url: 'https://example.test/' });
  const w = dom.window;
  let blob;
  let attempts = 0;
  w.fetch = () => { attempts++; throw new Error('Network disabled'); };
  w.XMLHttpRequest = class { constructor() { attempts++; throw new Error('Network disabled'); } };
  w.URL.createObjectURL = value => { blob = value; return 'blob:fixture'; };
  w.URL.revokeObjectURL = () => {};
  w.HTMLAnchorElement.prototype.click = function () {};
  const wait = async predicate => {
    for (let i = 0; i < 150; i++) {
      if (predicate()) return;
      await new Promise(resolve => setTimeout(resolve, 5));
    }
    throw new Error('Application state timed out');
  };
  try {
    for (const file of ['d3-csv.js', 'fuse.js', 'utils.js', 'script.js']) w.eval(fs.readFileSync(path.join(root, file), 'utf8'));
    if (w.document.readyState === 'loading') await new Promise(resolve => w.document.addEventListener('DOMContentLoaded', resolve, { once: true }));
    const upload = async text => {
      const input = w.document.getElementById('fileInput');
      Object.defineProperty(input, 'files', { configurable: true, value: [new w.File([text], 'fixture.csv', { type: 'text/csv' })] });
      input.dispatchEvent(new w.Event('change'));
      await wait(() => w.document.getElementById('fileStatus').textContent.includes('Successfully loaded'));
    };
    const exported = async () => {
      blob = undefined; w.document.getElementById('exportBtn').click(); assert.ok(blob);
      return new Promise((resolve, reject) => {
        const reader = new w.FileReader(); reader.onload = () => resolve(reader.result); reader.onerror = reject; reader.readAsText(blob);
      });
    };
    await body({ w, upload, exported, wait });
    assert.equal(attempts, 0);
  } finally { dom.window.close(); }
}

const CSV = 'Name,__proto__,constructor,toString\nAlice,needle-alpha,ctor-A,string-A\nBob,quartz-zebra,ctor-B,string-B\n';

test('actual parser keeps special headers as ordinary own data properties', async () => {
  await withApp(async ({ w }) => {
    const record = w.CsvParser.csvParse(CSV)[0];
    assert.deepEqual(Object.keys(record), ['Name', '__proto__', 'constructor', 'toString']);
    assert.equal(Object.getPrototypeOf(record), w.Object.prototype);
    const descriptor = Object.getOwnPropertyDescriptor(record, '__proto__');
    assert.equal(descriptor.value, 'needle-alpha');
    assert.equal(descriptor.enumerable, true); assert.equal(descriptor.writable, true); assert.equal(descriptor.configurable, true);
    assert.equal(record.constructor, 'ctor-A'); assert.equal(record.toString, 'string-A');
    assert.equal(JSON.parse(JSON.stringify(record)).__proto__, 'needle-alpha');
    const duplicate = w.CsvParser.csvParse('__proto__,__proto__\nfirst,last\n')[0];
    assert.equal(duplicate.__proto__, 'last'); assert.deepEqual(Object.keys(duplicate), ['__proto__']);
  });
});

test('whole file import supports special/ordinary search, filters and export', async () => {
  await withApp(async ({ w, upload, exported, wait }) => {
    await upload(CSV);
    let rows = w.CsvParser.csvParse(await exported());
    assert.equal(rows.length, 2); assert.equal(rows[0].__proto__, 'needle-alpha');
    const special = w.document.getElementById('filter-__proto__');
    assert.ok(special); special.value = 'quartz-zebra'; special.dispatchEvent(new w.Event('change'));
    rows = w.CsvParser.csvParse(await exported());
    assert.equal(rows.length, 1); assert.equal(rows[0].Name, 'Bob');
    special.value = ''; special.dispatchEvent(new w.Event('change'));
    const search = w.document.getElementById('searchInput');
    search.value = 'needle-alpha'; search.dispatchEvent(new w.Event('input'));
    await wait(() => w.document.getElementById('resultCount').textContent === 'Showing 1 result.');
    rows = w.CsvParser.csvParse(await exported());
    assert.equal(rows.length, 1); assert.equal(rows[0].Name, 'Alice');
    search.value = 'Bob'; search.dispatchEvent(new w.Event('input'));
    // Count remains one, so wait for the existing debounced input handler itself.
    await new Promise(resolve => setTimeout(resolve, 400));
    rows = w.CsvParser.csvParse(await exported()); assert.equal(rows.length, 1); assert.equal(rows[0].Name, 'Bob');
    search.value = ''; search.dispatchEvent(new w.Event('input'));
    await wait(() => w.document.getElementById('resultCount').textContent === 'Showing 2 results.');
    const ordinary = w.document.getElementById('filter-Name'); ordinary.value = 'Alice'; ordinary.dispatchEvent(new w.Event('change'));
    rows = w.CsvParser.csvParse(await exported()); assert.equal(rows.length, 1); assert.equal(rows[0].Name, 'Alice');
    assert.deepEqual(Object.keys(rows[0]), ['Name', '__proto__', 'constructor', 'toString']);
  });
});

test('ordinary parsing, duplicate last-value behavior and validation stay unchanged', async () => {
  await withApp(async ({ w }) => {
    const ordinary = w.CsvParser.csvParse('Name,Note\nAlice,hello\n')[0];
    assert.deepEqual(Object.keys(ordinary), ['Name', 'Note']); assert.equal(ordinary.Note, 'hello');
    const duplicate = w.CsvParser.csvParse('Name,Name\nfirst,last\n')[0];
    assert.equal(duplicate.Name, 'last'); assert.deepEqual(Object.keys(duplicate), ['Name']);
    assert.equal(w.CsvParser.csvParse('').length, 0);
    assert.throws(() => w.CsvParser.csvParse('Name,Note\nAlice\n'), /fields/);
    assert.throws(() => w.CsvParser.csvParse('Name\n"unfinished'), /Unclosed quoted/);
  });
});
