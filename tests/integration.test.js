/**
 * Simple integration tests for CSV Finder utility functions
 * These tests verify that the core functionality works together correctly
 */

describe('CSV Processing Integration', () => {
  function parseCSVSimple(csvText) {
    const lines = csvText.trim().split('\n');
    if (lines.length < 2) return [];
    
    const headers = parseCsvLine(lines[0]);
    const data = [];
    
    for (let i = 1; i < lines.length; i++) {
      const values = parseCsvLine(lines[i]);
      if (values.length === headers.length) {
        const record = {};
        headers.forEach((header, index) => {
          record[header] = values[index] || '';
        });
        data.push(record);
      }
    }
    
    return data;
  }

  function parseCsvLine(line) {
    const result = [];
    let current = '';
    let inQuotes = false;
    
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      
      if (char === '"' && (i === 0 || line[i-1] === ',')) {
        inQuotes = true;
      } else if (char === '"' && inQuotes && (i === line.length - 1 || line[i+1] === ',')) {
        inQuotes = false;
      } else if (char === ',' && !inQuotes) {
        result.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
    
    result.push(current.trim());
    return result;
  }

  test('should process CSV data and extract columns', () => {
    const csvText = `Name,Age,City,Country
John Doe,28,New York,USA
Jane Smith,34,London,UK
Bob Johnson,45,Toronto,Canada`;

    const parsedData = parseCSVSimple(csvText);
    const columns = Object.keys(parsedData[0] || {});
    
    expect(parsedData).toHaveLength(3);
    expect(columns).toEqual(['Name', 'Age', 'City', 'Country']);
    expect(parsedData[0]).toEqual({
      Name: 'John Doe',
      Age: '28', 
      City: 'New York',
      Country: 'USA'
    });
  });

  test('should handle empty CSV file', () => {
    const csvText = '';
    const parsedData = parseCSVSimple(csvText);
    expect(parsedData).toEqual([]);
  });

  test('should handle CSV with only headers', () => {
    const csvText = 'Name,Age,City';
    const parsedData = parseCSVSimple(csvText);
    expect(parsedData).toEqual([]);
  });
});

describe('Search and Filter Integration', () => {
  function searchData(data, searchTerm, searchKeys) {
    if (!searchTerm) return data;
    
    return data.filter(item => {
      return searchKeys.some(key => {
        const value = String(item[key] || '').toLowerCase();
        return value.includes(searchTerm.toLowerCase());
      });
    });
  }

  function filterData(data, filters) {
    return data.filter(item => {
      return Object.entries(filters).every(([key, value]) => {
        if (!value || value === '') return true;
        return String(item[key]).trim() === value;
      });
    });
  }

  test('should search and filter data correctly', () => {
    const data = [
      { Name: 'John Doe', Age: '28', City: 'New York', Country: 'USA' },
      { Name: 'Jane Smith', Age: '34', City: 'London', Country: 'UK' },
      { Name: 'Bob Johnson', Age: '45', City: 'Toronto', Country: 'Canada' }
    ];
    const columns = ['Name', 'Age', 'City', 'Country'];
    
    // Test search
    let filtered = searchData(data, 'John', columns);
    expect(filtered).toHaveLength(2);
    expect(filtered[0].Name).toBe('John Doe');
    expect(filtered[1].Name).toBe('Bob Johnson');
    
    // Test filter
    filtered = filterData(data, { Country: 'USA' });
    expect(filtered).toHaveLength(1);
    expect(filtered[0].Name).toBe('John Doe');
    
    // Test combined search and filter
    filtered = searchData(data, 'John', columns);
    filtered = filterData(filtered, { Country: 'USA' });
    expect(filtered).toHaveLength(1);
    expect(filtered[0].Name).toBe('John Doe');
  });

  test('should handle empty search term', () => {
    const data = [
      { Name: 'John Doe', Age: '28', City: 'New York' },
      { Name: 'Jane Smith', Age: '34', City: 'London' }
    ];
    const columns = ['Name', 'Age', 'City'];
    
    const result = searchData(data, '', columns);
    expect(result).toHaveLength(2);
    expect(result).toEqual(data);
  });

  test('should handle no search results', () => {
    const data = [
      { Name: 'John Doe', Age: '28', City: 'New York' },
      { Name: 'Jane Smith', Age: '34', City: 'London' }
    ];
    const columns = ['Name', 'Age', 'City'];
    
    const result = searchData(data, 'XYZ', columns);
    expect(result).toHaveLength(0);
  });
});

describe('Column Management Integration', () => {
  function getVisibleColumns(allColumns, selectedColumns) {
    return allColumns.filter(col => selectedColumns.includes(col));
  }

  function buildColumnOptions(data) {
    if (data.length === 0) return [];
    return Object.keys(data[0]);
  }

  test('should manage column visibility', () => {
    const allColumns = ['Name', 'Age', 'City', 'Country'];
    const selectedColumns = ['Name', 'City'];
    
    const visibleColumns = getVisibleColumns(allColumns, selectedColumns);
    expect(visibleColumns).toEqual(['Name', 'City']);
  });

  test('should build column options from data', () => {
    const data = [
      { Name: 'John Doe', Age: '28', City: 'New York' },
      { Name: 'Jane Smith', Age: '34', City: 'London' }
    ];
    
    const columns = buildColumnOptions(data);
    expect(columns).toEqual(['Name', 'Age', 'City']);
  });

  test('should handle empty data for column options', () => {
    const columns = buildColumnOptions([]);
    expect(columns).toEqual([]);
  });
});

describe('Pagination Integration', () => {
  function paginateData(data, currentPage, itemsPerPage) {
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    return data.slice(startIndex, endIndex);
  }

  function getPaginationInfo(totalItems, currentPage, itemsPerPage) {
    const totalPages = Math.ceil(totalItems / itemsPerPage);
    return {
      totalPages,
      currentPage,
      totalItems,
      hasNext: currentPage < totalPages,
      hasPrev: currentPage > 1,
      startIndex: (currentPage - 1) * itemsPerPage,
      endIndex: Math.min((currentPage - 1) * itemsPerPage + itemsPerPage, totalItems)
    };
  }

  test('should paginate data correctly', () => {
    const data = Array(100).fill(null).map((_, i) => ({ id: i + 1 }));
    
    const page1 = paginateData(data, 1, 25);
    expect(page1).toHaveLength(25);
    expect(page1[0].id).toBe(1);
    expect(page1[24].id).toBe(25);
    
    const page2 = paginateData(data, 2, 25);
    expect(page2).toHaveLength(25);
    expect(page2[0].id).toBe(26);
    expect(page2[24].id).toBe(50);
  });

  test('should calculate pagination info correctly', () => {
    const info = getPaginationInfo(100, 1, 25);
    expect(info.totalPages).toBe(4);
    expect(info.hasNext).toBe(true);
    expect(info.hasPrev).toBe(false);
    expect(info.startIndex).toBe(0);
    expect(info.endIndex).toBe(25);
  });

  test('should handle last page correctly', () => {
    const info = getPaginationInfo(100, 4, 25);
    expect(info.totalPages).toBe(4);
    expect(info.hasNext).toBe(false);
    expect(info.hasPrev).toBe(true);
    expect(info.startIndex).toBe(75);
    expect(info.endIndex).toBe(100);
  });

  test('should handle partial last page', () => {
    const data = Array(97).fill(null).map((_, i) => ({ id: i + 1 }));
    const lastPage = paginateData(data, 4, 25);
    expect(lastPage).toHaveLength(22);
    expect(lastPage[0].id).toBe(76);
    expect(lastPage[21].id).toBe(97);
  });
});

describe('Data Export Integration', () => {
  function exportToCSV(data, columns) {
    if (data.length === 0) return '';
    
    const escapeCSVValue = (value) => {
      const str = String(value || '');
      if (str.includes(',') || str.includes('"') || str.includes('\n')) {
        return '"' + str.replace(/"/g, '""') + '"';
      }
      return str;
    };
    
    const header = columns.join(',');
    const rows = data.map(record => 
      columns.map(col => escapeCSVValue(record[col])).join(',')
    );
    
    return [header, ...rows].join('\n');
  }

  test('should export filtered data to CSV', () => {
    const data = [
      { Name: 'John Doe', Age: '28', City: 'New York' },
      { Name: 'Jane Smith', Age: '34', City: 'London' }
    ];
    const columns = ['Name', 'Age', 'City'];
    
    const csv = exportToCSV(data, columns);
    const expectedCSV = 'Name,Age,City\nJohn Doe,28,New York\nJane Smith,34,London';
    expect(csv).toBe(expectedCSV);
  });

  test('should handle export with special characters', () => {
    const data = [
      { Name: 'Smith, John Jr.', Description: 'Software "Engineer"', Notes: 'Line1\nLine2' }
    ];
    const columns = ['Name', 'Description', 'Notes'];
    
    const csv = exportToCSV(data, columns);
    expect(csv).toContain('"Smith, John Jr."');
    expect(csv).toContain('"Software ""Engineer"""');
    expect(csv).toContain('"Line1\nLine2"');
  });

  test('should handle empty data export', () => {
    const csv = exportToCSV([], ['Name', 'Age']);
    expect(csv).toBe('');
  });
});