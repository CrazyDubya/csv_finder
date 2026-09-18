(function(root) {
  'use strict';

  function parseRows(text) {
    const rows = [];
    let row = [];
    let field = '';
    let inQuotes = false;
    let atFieldStart = true;
    let recordHasContent = false;

    function finishRecord() {
      row.push(field);
      if (recordHasContent || row.length > 1) rows.push(row);
      row = [];
      field = '';
      atFieldStart = true;
      recordHasContent = false;
    }

    for (let i = 0; i < text.length; i++) {
      const char = text[i];

      if (inQuotes) {
        if (char === '"') {
          if (text[i + 1] === '"') {
            field += '"';
            i++;
          } else {
            inQuotes = false;
          }
        } else {
          field += char;
        }
        continue;
      }

      if (char === '"' && atFieldStart) {
        inQuotes = true;
        atFieldStart = false;
        recordHasContent = true;
      } else if (char === ',') {
        row.push(field);
        field = '';
        atFieldStart = true;
        recordHasContent = true;
      } else if (char === '\r' || char === '\n') {
        if (char === '\r' && text[i + 1] === '\n') i++;
        finishRecord();
      } else {
        field += char;
        atFieldStart = false;
        recordHasContent = true;
      }
    }

    if (inQuotes) throw new Error('Unclosed quoted field at end of CSV');
    if (recordHasContent || row.length > 0 || field !== '') finishRecord();
    return rows;
  }

  function csvParse(text) {
    if (typeof text !== 'string' || text.length === 0) return [];
    const rows = parseRows(text);
    if (rows.length < 2) return [];

    const headers = rows[0].slice();
    if (headers[0]) headers[0] = headers[0].replace(/^\uFEFF/, '');

    return rows.slice(1).map((values, index) => {
      if (values.length !== headers.length) {
        throw new Error(`Record ${index + 2} has ${values.length} fields; expected ${headers.length}`);
      }
      const record = {};
      headers.forEach((header, column) => {
        record[header] = values[column];
      });
      return record;
    });
  }

  const api = { csvParse, parseRows };
  if (root) {
    root.CsvParser = api;
    root.d3 = root.d3 || {};
    root.d3.csvParse = csvParse;
  }
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : null);
