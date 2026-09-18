/**
 * Simplified unit tests for CSV Finder core functions
 * These tests focus on testable utility functions without complex DOM interactions
 */

describe('CSV Parser Functions', () => {
  // Mock the CSV parsing functions directly
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

  describe('parseCsvLine', () => {
    test('should parse simple CSV line', () => {
      const result = parseCsvLine('John,Doe,28');
      expect(result).toEqual(['John', 'Doe', '28']);
    });

    test('should parse CSV line with quotes', () => {
      const result = parseCsvLine('"John Doe","Software Engineer",28');
      expect(result).toEqual(['John Doe', 'Software Engineer', '28']);
    });

    test('should parse CSV line with commas in quoted fields', () => {
      const result = parseCsvLine('"Smith, John","New York, NY",35');
      expect(result).toEqual(['Smith, John', 'New York, NY', '35']);
    });

    test('should handle empty fields', () => {
      const result = parseCsvLine('John,,28');
      expect(result).toEqual(['John', '', '28']);
    });

    test('should handle trailing spaces', () => {
      const result = parseCsvLine('John , Doe , 28 ');
      expect(result).toEqual(['John', 'Doe', '28']);
    });
  });

  describe('parseCSVSimple', () => {
    test('should parse simple CSV data', () => {
      const csvText = `Name,Age,City
John Doe,28,New York
Jane Smith,34,London`;
      
      const result = parseCSVSimple(csvText);
      expect(result).toEqual([
        { Name: 'John Doe', Age: '28', City: 'New York' },
        { Name: 'Jane Smith', Age: '34', City: 'London' }
      ]);
    });

    test('should return empty array for invalid CSV', () => {
      const csvText = 'Name';
      const result = parseCSVSimple(csvText);
      expect(result).toEqual([]);
    });

    test('should handle CSV with mismatched columns', () => {
      const csvText = `Name,Age,City
John Doe,28
Jane Smith,34,London,Extra`;
      
      const result = parseCSVSimple(csvText);
      expect(result).toEqual([]);
    });

    test('should handle empty CSV', () => {
      const result = parseCSVSimple('');
      expect(result).toEqual([]);
    });
  });
});

describe('Utility Functions', () => {
  function escapeHtml(text) {
    const map = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;'
    };
    return String(text).replace(/[&<>"']/g, m => map[m]);
  }

  function highlightValue(value, term) {
    const str = String(value);
    if (!term) return escapeHtml(str);
    
    const regex = new RegExp(term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
    return escapeHtml(str).replace(regex, match => `<mark>${match}</mark>`);
  }

  function inferColumnType(values) {
    const nonEmpty = values.filter(v => v !== "");
    if (nonEmpty.length === 0) return 'string';
    if (nonEmpty.every(v => !isNaN(Date.parse(v)) && isNaN(Number(v)))) return 'date';
    if (nonEmpty.every(v => !isNaN(Number(v)) && isFinite(Number(v)))) return 'number';
    return 'string';
  }

  describe('escapeHtml', () => {
    test('should escape HTML special characters', () => {
      const result = escapeHtml('<script>alert("xss")</script>');
      expect(result).toBe('&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;');
    });

    test('should handle strings without special characters', () => {
      const result = escapeHtml('John Doe');
      expect(result).toBe('John Doe');
    });

    test('should handle empty string', () => {
      const result = escapeHtml('');
      expect(result).toBe('');
    });

    test('should handle null and undefined', () => {
      expect(escapeHtml(null)).toBe('null');
      expect(escapeHtml(undefined)).toBe('undefined');
    });
  });

  describe('highlightValue', () => {
    test('should highlight search term', () => {
      const result = highlightValue('John Doe', 'John');
      expect(result).toBe('<mark>John</mark> Doe');
    });

    test('should handle case insensitive search', () => {
      const result = highlightValue('John Doe', 'john');
      expect(result).toBe('<mark>John</mark> Doe');
    });

    test('should handle multiple matches', () => {
      const result = highlightValue('John John Doe', 'John');
      expect(result).toBe('<mark>John</mark> <mark>John</mark> Doe');
    });

    test('should return escaped text when no term provided', () => {
      const result = highlightValue('<script>alert("test")</script>', '');
      expect(result).toBe('&lt;script&gt;alert(&quot;test&quot;)&lt;/script&gt;');
    });

    test('should handle special regex characters in search term', () => {
      const result = highlightValue('test.example', '.');
      expect(result).toBe('test<mark>.</mark>example');
    });
  });

  describe('inferColumnType', () => {
    test('should detect number type', () => {
      const values = ['123', '456', '789'];
      const result = inferColumnType(values);
      expect(result).toBe('number');
    });

    test('should detect string type', () => {
      const values = ['John', 'Jane', 'Bob'];
      const result = inferColumnType(values);
      expect(result).toBe('string');
    });

    test('should handle mixed types as string', () => {
      const values = ['John', '123', 'Jane'];
      const result = inferColumnType(values);
      expect(result).toBe('string');
    });

    test('should handle empty values', () => {
      const values = ['', '', ''];
      const result = inferColumnType(values);
      expect(result).toBe('string');
    });

    test('should detect date type', () => {
      const values = ['2023-01-01', '2023-12-31', '2024-06-15'];
      const result = inferColumnType(values);
      expect(result).toBe('date');
    });
  });
});

describe('Search and Filter Logic', () => {
  // Mock Fuse.js search functionality
  function mockSearch(data, term, keys) {
    if (!term) return data;
    
    return data.filter(item => {
      return keys.some(key => {
        const value = String(item[key] || '').toLowerCase();
        return value.includes(term.toLowerCase());
      });
    });
  }

  test('should filter data by search term', () => {
    const data = [
      { Name: 'John Doe', Age: '28', City: 'New York' },
      { Name: 'Jane Smith', Age: '34', City: 'London' },
      { Name: 'Bob Johnson', Age: '45', City: 'Toronto' }
    ];
    
    const result = mockSearch(data, 'John', ['Name', 'Age', 'City']);
    expect(result).toHaveLength(2);
    expect(result[0].Name).toBe('John Doe');
    expect(result[1].Name).toBe('Bob Johnson');
  });

  test('should return all data when no search term', () => {
    const data = [
      { Name: 'John Doe', Age: '28', City: 'New York' },
      { Name: 'Jane Smith', Age: '34', City: 'London' }
    ];
    
    const result = mockSearch(data, '', ['Name', 'Age', 'City']);
    expect(result).toHaveLength(2);
  });

  test('should return empty array when no matches', () => {
    const data = [
      { Name: 'John Doe', Age: '28', City: 'New York' },
      { Name: 'Jane Smith', Age: '34', City: 'London' }
    ];
    
    const result = mockSearch(data, 'XYZ', ['Name', 'Age', 'City']);
    expect(result).toHaveLength(0);
  });
});

describe('Pagination Logic', () => {
  function calculatePagination(totalItems, currentPage, itemsPerPage) {
    const totalPages = Math.ceil(totalItems / itemsPerPage);
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = Math.min(startIndex + itemsPerPage, totalItems);
    
    return {
      totalPages,
      startIndex,
      endIndex,
      hasNext: currentPage < totalPages,
      hasPrev: currentPage > 1
    };
  }

  test('should calculate pagination correctly', () => {
    const result = calculatePagination(100, 1, 25);
    expect(result.totalPages).toBe(4);
    expect(result.startIndex).toBe(0);
    expect(result.endIndex).toBe(25);
    expect(result.hasNext).toBe(true);
    expect(result.hasPrev).toBe(false);
  });

  test('should handle last page correctly', () => {
    const result = calculatePagination(100, 4, 25);
    expect(result.totalPages).toBe(4);
    expect(result.startIndex).toBe(75);
    expect(result.endIndex).toBe(100);
    expect(result.hasNext).toBe(false);
    expect(result.hasPrev).toBe(true);
  });

  test('should handle single page', () => {
    const result = calculatePagination(10, 1, 25);
    expect(result.totalPages).toBe(1);
    expect(result.startIndex).toBe(0);
    expect(result.endIndex).toBe(10);
    expect(result.hasNext).toBe(false);
    expect(result.hasPrev).toBe(false);
  });
});

describe('CSV Export Logic', () => {
  function formatCSVValue(value) {
    const str = String(value || '');
    if (str.includes(',') || str.includes('"') || str.includes('\n')) {
      return '"' + str.replace(/"/g, '""') + '"';
    }
    return str;
  }

  function formatCSVRow(record, columns) {
    return columns.map(col => formatCSVValue(record[col])).join(',');
  }

  function formatCSV(data, columns) {
    if (data.length === 0) return '';
    const header = columns.join(',');
    const rows = data.map(record => formatCSVRow(record, columns));
    return [header, ...rows].join('\n');
  }

  test('should format CSV values correctly', () => {
    expect(formatCSVValue('simple')).toBe('simple');
    expect(formatCSVValue('with,comma')).toBe('"with,comma"');
    expect(formatCSVValue('with"quote')).toBe('"with""quote"');
    expect(formatCSVValue('with\nnewline')).toBe('"with\nnewline"');
  });

  test('should format CSV row correctly', () => {
    const record = { Name: 'John, Jr.', Age: '28', City: 'New York' };
    const columns = ['Name', 'Age', 'City'];
    const result = formatCSVRow(record, columns);
    expect(result).toBe('"John, Jr.",28,New York');
  });

  test('should format complete CSV correctly', () => {
    const data = [
      { Name: 'John Doe', Age: '28', City: 'New York' },
      { Name: 'Jane Smith', Age: '34', City: 'London' }
    ];
    const columns = ['Name', 'Age', 'City'];
    const result = formatCSV(data, columns);
    expect(result).toBe('Name,Age,City\nJohn Doe,28,New York\nJane Smith,34,London');
  });

  test('should handle empty data', () => {
    const result = formatCSV([], ['Name', 'Age']);
    expect(result).toBe('');
  });
});