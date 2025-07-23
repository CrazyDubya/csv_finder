// Simple CSV parser to replace d3-dsv
(function() {
  'use strict';
  
  function csvParse(text) {
    const lines = text.trim().split(/\r?\n/);
    if (lines.length === 0) return [];
    
    const headers = parseLine(lines[0]);
    const data = [];
    
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (line === '') continue;
      
      const values = parseLine(line);
      if (values.length !== headers.length) continue;
      
      const record = {};
      headers.forEach((header, index) => {
        record[header] = values[index] || '';
      });
      data.push(record);
    }
    
    return data;
  }
  
  function parseLine(line) {
    const result = [];
    let current = '';
    let inQuotes = false;
    let i = 0;
    
    while (i < line.length) {
      const char = line[i];
      
      if (char === '"') {
        if (inQuotes && line[i + 1] === '"') {
          // Escaped quote
          current += '"';
          i += 2;
        } else {
          // Toggle quote state
          inQuotes = !inQuotes;
          i++;
        }
      } else if (char === ',' && !inQuotes) {
        result.push(current.trim());
        current = '';
        i++;
      } else {
        current += char;
        i++;
      }
    }
    
    result.push(current.trim());
    return result.map(value => {
      // Remove surrounding quotes if present
      if (value.startsWith('"') && value.endsWith('"')) {
        return value.slice(1, -1);
      }
      return value;
    });
  }
  
  // Export for global use
  if (typeof window !== 'undefined') {
    window.d3 = window.d3 || {};
    window.d3.csvParse = csvParse;
  }
  
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { csvParse };
  }
})();