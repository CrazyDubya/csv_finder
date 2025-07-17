// Web Worker for CSV processing to prevent UI blocking
importScripts('https://d3js.org/d3-dsv.v2.min.js');

const CHUNK_SIZE = 1000; // Process 1000 rows at a time

self.onmessage = function(e) {
  const { type, data } = e.data;
  
  switch (type) {
    case 'parseCSV':
      parseCSVInChunks(data.csvText, data.filename);
      break;
    case 'buildFilters':
      buildFilterOptions(data.csvData, data.columns);
      break;
    case 'filterData':
      filterData(data.csvData, data.searchTerm, data.filters, data.columns);
      break;
  }
};

function parseCSVInChunks(csvText, filename) {
  try {
    // Send progress update
    self.postMessage({
      type: 'progress',
      message: 'Parsing CSV structure...',
      progress: 10
    });
    
    // Parse the entire CSV to get structure
    const csvData = d3.csvParse(csvText);
    const totalRows = csvData.length;
    
    if (totalRows === 0) {
      self.postMessage({
        type: 'error',
        message: 'No records found in the CSV.'
      });
      return;
    }
    
    // Get columns from first row
    const columns = Object.keys(csvData[0] || {});
    
    self.postMessage({
      type: 'progress',
      message: `Processing ${totalRows} rows...`,
      progress: 30
    });
    
    // For smaller files, send all data at once
    if (totalRows <= CHUNK_SIZE) {
      self.postMessage({
        type: 'csvParsed',
        data: {
          csvData,
          columns,
          totalRows,
          filename,
          isComplete: true
        }
      });
      return;
    }
    
    // For larger files, send in chunks
    let processedRows = 0;
    const chunks = [];
    
    for (let i = 0; i < totalRows; i += CHUNK_SIZE) {
      const chunk = csvData.slice(i, i + CHUNK_SIZE);
      chunks.push(chunk);
      processedRows += chunk.length;
      
      const progress = 30 + ((processedRows / totalRows) * 60);
      self.postMessage({
        type: 'progress',
        message: `Processing chunk ${Math.ceil((i + 1) / CHUNK_SIZE)} of ${Math.ceil(totalRows / CHUNK_SIZE)}...`,
        progress: Math.round(progress)
      });
      
      // Send chunk
      self.postMessage({
        type: 'csvChunk',
        data: {
          chunk,
          chunkIndex: Math.floor(i / CHUNK_SIZE),
          totalChunks: Math.ceil(totalRows / CHUNK_SIZE),
          isLastChunk: i + CHUNK_SIZE >= totalRows
        }
      });
    }
    
    // Send completion message
    self.postMessage({
      type: 'csvParsed',
      data: {
        csvData,
        columns,
        totalRows,
        filename,
        isComplete: true
      }
    });
    
  } catch (error) {
    self.postMessage({
      type: 'error',
      message: 'Error parsing CSV: ' + error.message
    });
  }
}

function buildFilterOptions(csvData, columns) {
  const filterOptions = {};
  
  columns.forEach(field => {
    const uniqueVals = Array.from(
      new Set(
        csvData
          .map(d => String(d[field] || "").trim())
          .filter(v => v !== "")
      )
    ).sort((a, b) => a.localeCompare(b));
    
    if (uniqueVals.length > 0) {
      filterOptions[field] = uniqueVals;
    }
  });
  
  self.postMessage({
    type: 'filtersBuilt',
    data: filterOptions
  });
}

function filterData(csvData, searchTerm, filters, columns) {
  let filtered = csvData;
  
  // Apply text search if provided
  if (searchTerm && searchTerm.trim() !== '') {
    const term = searchTerm.toLowerCase();
    filtered = filtered.filter(record => {
      return columns.some(col => {
        const value = String(record[col] || '').toLowerCase();
        return value.includes(term);
      });
    });
  }
  
  // Apply column filters
  Object.keys(filters).forEach(field => {
    const selectedVals = filters[field];
    if (selectedVals && selectedVals.length > 0) {
      filtered = filtered.filter(record => {
        return selectedVals.includes(String(record[field]).trim());
      });
    }
  });
  
  self.postMessage({
    type: 'dataFiltered',
    data: filtered
  });
}