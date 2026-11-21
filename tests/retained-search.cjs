const assert = require('node:assert/strict');
const test = require('node:test');
const fs = require('node:fs');
const path = require('node:path');
const { JSDOM } = require('jsdom');
const root = process.env.CSV_SOURCE || path.resolve(__dirname, '..');
const CSV = 'Name,Item\nAlice,first\nBob,second\n';

async function setup(savedSearch = '') {
    const dom = new JSDOM(fs.readFileSync(path.join(root, 'index.html'), 'utf8'), {
        url: 'https://example.test/', runScripts: 'outside-only'
    });
    const w = dom.window;
    let download;
    let network = 0;
    w.fetch = async () => { network++; throw Error('Network prohibited'); };
    w.URL.createObjectURL = blob => { download = blob; return 'blob:fixture'; };
    w.URL.revokeObjectURL = () => {};
    w.HTMLAnchorElement.prototype.click = function () {};
    w.localStorage.setItem('csvViewerState', JSON.stringify({ search: savedSearch }));
    for (const file of ['d3-csv.js', 'fuse.js', 'utils.js', 'script.js']) w.eval(fs.readFileSync(path.join(root, file), 'utf8'));
    if (w.document.readyState === 'loading') await new Promise(resolve => w.document.addEventListener('DOMContentLoaded', resolve, { once: true }));
    const input = w.document.getElementById('fileInput');
    const search = w.document.getElementById('searchInput');
    const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
    return {
        w, search,
        close() { assert.equal(network, 0); dom.window.close(); },
        async upload(text = CSV) {
            Object.defineProperty(input, 'files', { configurable: true, value: [new w.File([text], 'fixture.csv', { type: 'text/csv' })] });
            input.dispatchEvent(new w.Event('change'));
            await wait(150);
        },
        async query(value) { search.value = value; search.dispatchEvent(new w.Event('input')); await wait(350); },
        rendered: () => w.document.getElementById('resultsContainer').textContent,
        count: () => w.document.getElementById('resultCount').textContent,
        async exported() {
            w.document.getElementById('exportBtn').click();
            assert.ok(download);
            return await new Promise(resolve => {
                const reader = new w.FileReader();
                reader.onload = () => resolve(reader.result);
                reader.readAsText(download);
            });
        },
        snapshot(file) {
            w.document.querySelectorAll('script,link').forEach(n => n.remove());
            const style = w.document.createElement('style');
            style.textContent = fs.readFileSync(path.join(root, 'style.css'), 'utf8');
            w.document.head.appendChild(style);
            search.setAttribute('value', search.value);
            w.document.querySelectorAll('input[type=checkbox]').forEach(n => {
                if (n.checked) n.setAttribute('checked', ''); else n.removeAttribute('checked');
            });
            fs.writeFileSync(file, dom.serialize());
        }
    };
}

function aliceOnly(app) {
    assert.equal(app.search.value, 'Alice');
    assert.match(app.count(), /Showing 1 result\./);
    assert.match(app.rendered(), /Alice/);
    assert.doesNotMatch(app.rendered(), /Bob/);
}

test('saved visible query is applied on first successful file import', async () => {
    const app = await setup('Alice');
    try {
        await app.upload(); aliceOnly(app);
        assert.doesNotMatch(await app.exported(), /Bob/);
    } finally { app.close(); }
});

test('retained visible query agrees with replacement display and actual export', async () => {
    const app = await setup();
    try {
        await app.upload(); await app.query('Alice'); aliceOnly(app);
        await app.upload('Name,Item\nAlice,new first\nBob,new second\n'); aliceOnly(app);
        const exported = await app.exported();
        assert.match(exported, /Alice,new first/); assert.doesNotMatch(exported, /Bob/);
        assert.equal(JSON.parse(app.w.localStorage.getItem('csvViewerState')).search, 'Alice');
        if (process.env.CSV_QUERY_SNAPSHOT) app.snapshot(process.env.CSV_QUERY_SNAPSHOT);
    } finally { app.close(); }
});

test('retained query with no replacement match does not display unrelated rows', async () => {
    const app = await setup();
    try {
        await app.upload(); await app.query('Alice');
        await app.upload('Name,Item\nBob,new second\nCarol,new third\n');
        assert.equal(app.search.value, 'Alice');
        assert.doesNotMatch(app.rendered(), /Bob|Carol/);
        assert.match(app.count(), /0 result/);
    } finally { app.close(); }
});

test('no-query import and explicit reset still show and export all rows', async () => {
    const app = await setup();
    try {
        await app.upload(); assert.match(app.count(), /Showing 2 results\./);
        await app.query('Alice'); aliceOnly(app);
        app.w.document.getElementById('resetFiltersBtn').click();
        assert.equal(app.search.value, '');
        assert.match(app.count(), /Showing 2 results\./);
        assert.match(await app.exported(), /Bob/);
        await app.upload('Name,Item\nAlice,new first\nBob,new second\n');
        assert.match(app.count(), /Showing 2 results\./);
    } finally { app.close(); }
});
