importScripts('https://d3js.org/d3-dsv.v2.min.js');
importScripts('https://cdnjs.cloudflare.com/ajax/libs/fuse.js/6.4.6/fuse.min.js');

let data = [];
let columns = [];
let fuse = null;

self.onmessage = function(e) {
  const msg = e.data;
  if (msg.type === 'parse') {
    try {
      data = d3.csvParse(msg.text);
      if (data.length === 0) {
        self.postMessage({ type: 'error', message: 'CSV is empty. No data to parse.' });
        return;
      }
      columns = Object.keys(data[0]);
      fuse = new Fuse(data, { keys: columns, threshold: 0.4, distance: 100 });
      self.postMessage({ type: 'parsed', data, columns, total: data.length });
    } catch (err) {
      self.postMessage({ type: 'error', message: err.message });
    }
  } else if (msg.type === 'search') {
    if (!fuse) {
      self.postMessage({ type: 'error', message: 'Search operation failed: Fuse is not initialized.' });
      return;
    }
    let results = msg.term ? fuse.search(msg.term).map(r => r.item) : data;
    const filters = msg.filters || {};
    Object.keys(filters).forEach(field => {
      const val = filters[field];
      if (val !== '') {
        results = results.filter(row => String(row[field]).trim() === val);
      }
    });
    self.postMessage({ type: 'results', results });
  }
};
