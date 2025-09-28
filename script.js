// CSV Finder Application - Fixed JavaScript
let csvData = [];
let columns = [];
let columnNames = {};
let fuse = null;
let currentResults = [];
let selectedColumns = [];
let currentPage = 1;
let resultsPerPage = 25;
let currentLayout = 'cards'; // 'cards', 'table', 'list', 'compact'
// let csvWorker = null; // Commented out - not used in current implementation
// let filterCache = {}; // Commented out - not used in current implementation
let columnTypes = {};
// let sortColumn = null; // Commented out - not implemented yet
// let sortAscending = true; // Commented out - not implemented yet

// DOM Elements
const dragArea = document.getElementById('dragArea');
const fileInput = document.getElementById('fileInput');
const searchInput = document.getElementById('searchInput');
const fileStatus = document.getElementById('fileStatus');
const resultsArea = document.getElementById('resultsArea');
const resultsContainer = document.getElementById('resultsContainer');
// const toggleViewBtn = document.getElementById('toggleViewBtn'); // Commented out - not used
const resultCount = document.getElementById('resultCount');
const filterContainer = document.getElementById('filterContainer');
const filtersDiv = document.getElementById('filters');
const urlInput = document.getElementById('urlInput');
const loadUrlBtn = document.getElementById('loadUrlBtn');
const urlStatus = document.getElementById('urlStatus');
const spinner = document.getElementById('spinner');
const layoutSelect = document.getElementById('layoutSelect');
const itemsPerPageSelect = document.getElementById('itemsPerPageSelect');
const exportBtn = document.getElementById('exportBtn');
const controlsArea = document.getElementById('controlsArea');
const prevBtn = document.getElementById('prevBtn');
const nextBtn = document.getElementById('nextBtn');
const pageInfo = document.getElementById('pageInfo');
const pageSizeSelect = document.getElementById('pageSize');
const columnContainer = document.getElementById('columnContainer');
const resetFiltersBtn = document.getElementById('resetFiltersBtn');

// Initialize column names
function initColumnNames() {
  columnNames = {};
  columns.forEach(col => {
    columnNames[col] = col;
  });
}

function showSpinner() {
  if (spinner) spinner.classList.remove('hidden');
}

function hideSpinner() {
  if (spinner) spinner.classList.add('hidden');
}

// Initialize the application
function initApp() {
  // csvWorker = null; // Disable worker for now - use fallback

  // Load saved state
  try {
    const savedState = JSON.parse(localStorage.getItem('csvViewerState') || '{}');
    currentPage = savedState.page || 1;
    currentLayout = savedState.layout || 'cards';
    resultsPerPage = savedState.itemsPerPage || 25;
    if (searchInput) searchInput.value = savedState.search || '';
    if (layoutSelect) layoutSelect.value = currentLayout;
    if (itemsPerPageSelect) itemsPerPageSelect.value = resultsPerPage.toString();
  } catch (e) {
    console.warn('Failed to load saved state', e);
  }
}

// File upload handling
function setupFileHandlers() {
  if (!dragArea || !fileInput) return;

  // Prevent default drag behaviors
  ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
    dragArea.addEventListener(eventName, e => {
      e.preventDefault();
      e.stopPropagation();
    });
  });

  // Highlight drag area when file is over it
  ['dragenter', 'dragover'].forEach(eventName => {
    dragArea.addEventListener(eventName, () => dragArea.classList.add('dragover'));
  });

  // Remove highlight on dragleave/drop
  ['dragleave', 'drop'].forEach(eventName => {
    dragArea.addEventListener(eventName, () => dragArea.classList.remove('dragover'));
  });

  // Handle file drop
  dragArea.addEventListener('drop', e => {
    const file = e.dataTransfer.files[0];
    if (file && file.name.toLowerCase().endsWith('.csv')) {
      processFile(file);
    } else {
      if (fileStatus) fileStatus.textContent = 'Please upload a valid CSV file.';
    }
  });

  // Open file dialog on click
  dragArea.addEventListener('click', () => fileInput.click());

  fileInput.addEventListener('change', e => {
    const file = e.target.files[0];
    if (file) processFile(file);
  });
}

// Process CSV file
function processFile(file) {
  csvData = [];
  currentResults = [];
  // filterCache = {}; // Reset filter cache if needed in future

  if (fileStatus) fileStatus.textContent = 'Reading file...';
  if (searchInput) searchInput.disabled = true;
  if (resultsArea) resultsArea.classList.add('hidden');
  if (controlsArea) controlsArea.classList.add('hidden');
  if (filterContainer) filterContainer.classList.add('hidden');
  showSpinner();

  const reader = new FileReader();
  reader.onload = function(e) {
    const csvText = e.target.result;
    fallbackProcessFile(csvText, file.name);
  };

  reader.onerror = function(error) {
    if (fileStatus) fileStatus.textContent = 'Error reading file: ' + error.message;
    hideSpinner();
  };

  reader.readAsText(file);
}

// Simple CSV parser fallback
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

// Parse a single CSV line handling quotes
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

// Fallback processing for browsers without web worker support
function fallbackProcessFile(csvText, filename) {
  setTimeout(() => {
    try {
      let parsedData;
      if (typeof d3 !== 'undefined' && d3.csvParse) {
        parsedData = d3.csvParse(csvText);
      } else {
        parsedData = parseCSVSimple(csvText);
      }

      if (parsedData.length === 0) {
        if (fileStatus) fileStatus.textContent = 'No records found in the CSV.';
        hideSpinner();
        return;
      }

      columns = Object.keys(parsedData[0] || {});
      initColumnNames();

      // Initialize Fuse.js if available
      if (typeof Fuse !== 'undefined') {
        fuse = new Fuse(parsedData, {
          keys: columns,
          threshold: 0.4,
          distance: 100
        });
      }

      handleCSVParsed({
        csvData: parsedData,
        columns,
        totalRows: parsedData.length,
        filename,
        isComplete: true
      });
    } catch (error) {
      if (fileStatus) fileStatus.textContent = 'Error parsing CSV: ' + error.message;
      hideSpinner();
    }
  }, 50);
}

// Handle CSV parsing completion
function handleCSVParsed(data) {
  csvData = data.csvData;
  columns = data.columns;

  // Initialize Fuse.js for search if available
  if (typeof Fuse !== 'undefined') {
    fuse = new Fuse(csvData, {
      keys: columns,
      threshold: 0.4,
      distance: 100
    });
  } else {
    fuse = null;
  }

  if (fileStatus) fileStatus.textContent = `Loaded ${data.totalRows} rows successfully.`;
  if (searchInput) searchInput.disabled = false;
  if (resultsArea) resultsArea.classList.remove('hidden');
  if (controlsArea) controlsArea.classList.remove('hidden');

  buildFilters();
  buildColumnSelectors();

  currentResults = csvData;
  currentPage = 1;
  displayResults();

  hideSpinner();
}

// Infer column type for filtering
function inferColumnType(values) {
  const nonEmpty = values.filter(v => v !== '');
  if (nonEmpty.length === 0) return 'string';
  if (nonEmpty.every(v => !isNaN(Date.parse(v)) && isNaN(Number(v)))) return 'date';
  if (nonEmpty.every(v => !isNaN(Number(v)) && isFinite(Number(v)))) return 'number';
  return 'string';
}

// Build filter controls
function buildFilters() {
  if (!filtersDiv) return;

  filtersDiv.innerHTML = '';
  columns.forEach(field => {
    const values = csvData.map(d => String(d[field] || '').trim());
    const nonEmptyVals = values.filter(v => v !== '');
    if (nonEmptyVals.length === 0) return;

    const type = inferColumnType(values);
    columnTypes[field] = type;

    const wrapper = document.createElement('div');
    wrapper.className = 'flex flex-col mb-4';

    const label = document.createElement('label');
    label.className = 'text-blue-800 text-sm font-medium mb-1';
    label.textContent = columnNames[field] || field;
    wrapper.appendChild(label);

    if (type === 'string') {
      const uniqueVals = Array.from(new Set(nonEmptyVals)).sort();
      const select = document.createElement('select');
      select.id = `filter-${field}`;
      select.className = 'border border-blue-300 rounded p-2';

      const defaultOption = document.createElement('option');
      defaultOption.value = '';
      defaultOption.textContent = 'All';
      select.appendChild(defaultOption);

      uniqueVals.forEach(val => {
        const opt = document.createElement('option');
        opt.value = val;
        opt.textContent = val;
        select.appendChild(opt);
      });

      select.addEventListener('change', updateResults);
      wrapper.appendChild(select);
    }

    filtersDiv.appendChild(wrapper);
  });

  if (columns.length > 0 && filterContainer) {
    filterContainer.classList.remove('hidden');
  }
}

// Build column selector checkboxes
function buildColumnSelectors() {
  const columnCheckboxes = document.getElementById('columnCheckboxes');
  if (!columnCheckboxes) return;

  columnCheckboxes.innerHTML = '';
  selectedColumns = [...columns];

  columns.forEach(col => {
    const wrapper = document.createElement('div');
    wrapper.className = 'flex items-center mb-2';

    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.id = `col-${col}`;
    checkbox.checked = true;
    checkbox.addEventListener('change', () => {
      if (checkbox.checked) {
        if (!selectedColumns.includes(col)) {
          selectedColumns.push(col);
        }
      } else {
        selectedColumns = selectedColumns.filter(c => c !== col);
      }
      displayResults();
    });

    const label = document.createElement('label');
    label.htmlFor = checkbox.id;
    label.textContent = col;
    label.className = 'ml-2 text-sm';

    wrapper.appendChild(checkbox);
    wrapper.appendChild(label);
    columnCheckboxes.appendChild(wrapper);
  });

  if (columns.length > 0 && columnContainer) {
    columnContainer.classList.remove('hidden');
  }
}

// Update results based on search and filters
function updateResults() {
  if (!searchInput) return;

  const term = searchInput.value.trim();
  let filtered;

  if (term === '') {
    filtered = csvData;
  } else if (fuse) {
    filtered = fuse.search(term).map(r => r.item);
  } else {
    filtered = csvData.filter(record => {
      return columns.some(col => {
        const value = String(record[col] || '').toLowerCase();
        return value.includes(term.toLowerCase());
      });
    });
  }

  // Apply filters
  columns.forEach(field => {
    const select = document.getElementById(`filter-${field}`);
    if (select && select.value && select.value !== '') {
      filtered = filtered.filter(record => {
        return String(record[field]).trim() === select.value;
      });
    }
  });

  currentResults = filtered;
  currentPage = 1;
  displayResults();
  saveState();
}

// Escape HTML to prevent injection
function escapeHtml(text) {
  const map = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    '\'': '&#39;'
  };
  return String(text).replace(/[&<>"']/g, m => map[m]);
}

// Highlight search terms
function highlightValue(value, term) {
  const str = String(value);
  if (!term) return escapeHtml(str);

  const regex = new RegExp(term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
  return escapeHtml(str).replace(regex, match => `<mark>${match}</mark>`);
}

// Main display function
function displayResults() {
  if (!resultsContainer || currentResults.length === 0) {
    if (resultsContainer) {
      resultsContainer.innerHTML = '<div class="text-center text-gray-500 py-8">No results found</div>';
    }
    updatePaginationInfo();
    return;
  }

  const startIdx = (currentPage - 1) * resultsPerPage;
  const endIdx = startIdx + resultsPerPage;
  const pageResults = currentResults.slice(startIdx, endIdx);

  // Set container class based on layout
  switch (currentLayout) {
  case 'cards':
    resultsContainer.className = 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6';
    displayCardsLayout(pageResults);
    break;
  case 'table':
    resultsContainer.className = 'overflow-x-auto';
    displayTableLayout(pageResults);
    break;
  case 'list':
    resultsContainer.className = 'space-y-2';
    displayListLayout(pageResults);
    break;
  case 'compact':
    resultsContainer.className = 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2';
    displayCompactLayout(pageResults);
    break;
  default:
    resultsContainer.className = 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6';
    displayCardsLayout(pageResults);
  }

  updatePaginationInfo();
}

function displayCardsLayout(pageResults) {
  const term = searchInput ? searchInput.value.trim() : '';
  resultsContainer.innerHTML = '';

  pageResults.forEach(record => {
    const card = document.createElement('div');
    card.className = 'relative bg-white shadow-md rounded-lg p-4 border border-blue-200';

    const list = document.createElement('ul');
    list.className = 'space-y-1';

    columns.forEach(col => {
      const value = record[col] || '';
      if (value.trim() === '') return;

      const item = document.createElement('li');
      item.className = 'text-sm';

      const label = document.createElement('span');
      label.className = 'font-medium text-blue-800';
      label.textContent = (columnNames[col] || col) + ': ';

      const valueSpan = document.createElement('span');
      valueSpan.innerHTML = highlightValue(String(value), term);

      item.appendChild(label);
      item.appendChild(valueSpan);
      list.appendChild(item);
    });

    card.appendChild(list);
    card.appendChild(createCopyButton(record, 'absolute top-2 right-2 text-xs text-blue-600 hover:underline'));
    resultsContainer.appendChild(card);
  });
}

function displayTableLayout(pageResults) {
  resultsContainer.innerHTML = '';
  const table = document.createElement('table');
  table.className = 'min-w-full bg-white border border-gray-200 rounded-lg overflow-hidden';

  // Create header
  const thead = document.createElement('thead');
  thead.className = 'bg-blue-50';
  const headerRow = document.createElement('tr');

  columns.forEach(col => {
    const th = document.createElement('th');
    th.className = 'px-4 py-2 text-left text-sm font-medium text-blue-800 border-b';
    th.textContent = columnNames[col] || col;
    headerRow.appendChild(th);
  });

  const actionsHeader = document.createElement('th');
  actionsHeader.className = 'px-4 py-2 text-left text-sm font-medium text-blue-800 border-b';
  actionsHeader.textContent = 'Actions';
  headerRow.appendChild(actionsHeader);

  thead.appendChild(headerRow);
  table.appendChild(thead);

  // Create body
  const tbody = document.createElement('tbody');
  const term = searchInput ? searchInput.value.trim() : '';

  pageResults.forEach((record, index) => {
    const row = document.createElement('tr');
    row.className = index % 2 === 0 ? 'bg-white' : 'bg-gray-50';

    columns.forEach(col => {
      const td = document.createElement('td');
      td.className = 'px-4 py-2 text-sm border-b max-w-xs truncate';
      const value = record[col] || '';
      td.innerHTML = highlightValue(String(value), term);
      td.title = String(value);
      row.appendChild(td);
    });

    const actionsCell = document.createElement('td');
    actionsCell.className = 'px-4 py-2 text-sm border-b';
    actionsCell.appendChild(createCopyButton(record, 'text-xs px-2 py-1 bg-blue-500 text-white rounded hover:bg-blue-600'));
    row.appendChild(actionsCell);

    tbody.appendChild(row);
  });

  table.appendChild(tbody);
  resultsContainer.appendChild(table);
}

function displayListLayout(pageResults) {
  resultsContainer.innerHTML = '';
  const term = searchInput ? searchInput.value.trim() : '';

  pageResults.forEach(record => {
    const item = document.createElement('div');
    item.className = 'bg-white p-3 rounded border border-gray-200 hover:bg-gray-50';

    const content = document.createElement('div');
    content.className = 'flex justify-between items-start';

    const details = document.createElement('div');
    details.className = 'flex-1';

    const mainInfo = [];
    columns.slice(0, 3).forEach(col => {
      const value = record[col] || '';
      if (value.trim() !== '') {
        const displayValue = highlightValue(String(value), term);
        mainInfo.push(`<span class="font-medium text-blue-800">${columnNames[col] || col}:</span> ${displayValue}`);
      }
    });

    details.innerHTML = mainInfo.join(' • ');
    content.appendChild(details);
    content.appendChild(createCopyButton(record, 'text-xs text-blue-600 hover:underline'));

    item.appendChild(content);
    resultsContainer.appendChild(item);
  });
}

function displayCompactLayout(pageResults) {
  resultsContainer.innerHTML = '';
  const term = searchInput ? searchInput.value.trim() : '';

  pageResults.forEach(record => {
    const card = document.createElement('div');
    card.className = 'relative bg-white p-2 rounded border border-gray-200 text-sm hover:shadow-md transition-shadow';

    const primaryField = columns[0];
    const primaryValue = record[primaryField] || '';

    if (primaryValue.trim() !== '') {
      const title = document.createElement('div');
      title.className = 'font-medium text-blue-800 truncate';
      title.innerHTML = highlightValue(String(primaryValue), term);
      title.title = String(primaryValue);
      card.appendChild(title);
    }

    const secondaryInfo = [];
    columns.slice(1, 3).forEach(col => {
      const value = record[col] || '';
      if (value.trim() !== '') {
        secondaryInfo.push(String(value));
      }
    });

    if (secondaryInfo.length > 0) {
      const subtitle = document.createElement('div');
      subtitle.className = 'text-gray-600 text-xs truncate mt-1';
      subtitle.textContent = secondaryInfo.join(' • ');
      subtitle.title = secondaryInfo.join(' • ');
      card.appendChild(subtitle);
    }

    card.appendChild(createCopyButton(record, 'absolute top-1 right-1 text-xs text-gray-400 hover:text-blue-600'));
    resultsContainer.appendChild(card);
  });
}

function createCopyButton(record, className = 'absolute top-2 right-2 text-xs text-blue-600 hover:underline') {
  const copyBtn = document.createElement('button');
  copyBtn.type = 'button';
  copyBtn.textContent = 'Copy';
  copyBtn.className = className;
  copyBtn.addEventListener('click', (e) => {
    e.stopPropagation();

    let rowText;
    if (typeof d3 !== 'undefined' && d3.csvFormatRow) {
      rowText = d3.csvFormatRow(columns.map(c => record[c]));
    } else {
      rowText = columns.map(c => {
        const value = String(record[c] || '');
        if (value.includes(',') || value.includes('"') || value.includes('\n')) {
          return '"' + value.replace(/"/g, '""') + '"';
        }
        return value;
      }).join(',');
    }

    if (navigator.clipboard && window.isSecureContext) {
      navigator.clipboard.writeText(rowText);
    } else {
      const ta = document.createElement('textarea');
      ta.value = rowText;
      ta.style.position = 'fixed';
      ta.style.left = '-9999px';
      document.body.appendChild(ta);
      ta.focus();
      ta.select();
      try {
        document.execCommand('copy');
      } catch (err) {
        console.error('Copy failed:', err);
      }
      document.body.removeChild(ta);
    }
  });
  return copyBtn;
}

function updatePaginationInfo() {
  const totalPages = Math.ceil(currentResults.length / resultsPerPage);

  if (resultCount) {
    resultCount.textContent = `Showing ${currentResults.length} result${currentResults.length === 1 ? '' : 's'}.`;
  }

  if (pageInfo) {
    pageInfo.textContent = `Page ${currentPage} of ${totalPages}`;
  }

  if (prevBtn) prevBtn.disabled = currentPage <= 1;
  if (nextBtn) nextBtn.disabled = currentPage >= totalPages;
}

// Save application state to localStorage
function saveState() {
  try {
    const state = {
      page: currentPage,
      search: searchInput ? searchInput.value : '',
      layout: currentLayout,
      itemsPerPage: resultsPerPage
    };
    localStorage.setItem('csvViewerState', JSON.stringify(state));
  } catch (e) {
    console.warn('Failed to save state to localStorage', e);
  }
}

// Event Listeners Setup
function setupEventListeners() {
  // Search input with simple debounce
  if (searchInput) {
    let searchTimeout;
    searchInput.addEventListener('input', () => {
      clearTimeout(searchTimeout);
      searchTimeout = setTimeout(updateResults, 300);
    });
  }

  // Pagination controls
  if (prevBtn) {
    prevBtn.addEventListener('click', () => {
      if (currentPage > 1) {
        currentPage--;
        displayResults();
        saveState();
      }
    });
  }

  if (nextBtn) {
    nextBtn.addEventListener('click', () => {
      const totalPages = Math.ceil(currentResults.length / resultsPerPage);
      if (currentPage < totalPages) {
        currentPage++;
        displayResults();
        saveState();
      }
    });
  }

  // Layout switcher
  if (layoutSelect) {
    layoutSelect.addEventListener('change', (e) => {
      currentLayout = e.target.value;
      displayResults();
      saveState();
    });
  }

  // Items per page
  if (itemsPerPageSelect) {
    itemsPerPageSelect.addEventListener('change', (e) => {
      resultsPerPage = parseInt(e.target.value);
      currentPage = 1;
      displayResults();
      saveState();
    });
  }

  if (pageSizeSelect) {
    pageSizeSelect.addEventListener('change', (e) => {
      resultsPerPage = parseInt(e.target.value);
      currentPage = 1;
      displayResults();
      saveState();
    });
  }

  // Reset filters
  if (resetFiltersBtn) {
    resetFiltersBtn.addEventListener('click', () => {
      columns.forEach(field => {
        const select = document.getElementById(`filter-${field}`);
        if (select) {
          select.value = '';
        }
      });
      if (searchInput) searchInput.value = '';
      updateResults();
    });
  }

  // Export functionality
  if (exportBtn) {
    exportBtn.addEventListener('click', () => {
      if (currentResults.length === 0) {
        alert('No data to export');
        return;
      }

      let csvContent;
      if (typeof d3 !== 'undefined' && d3.csvFormat) {
        csvContent = d3.csvFormat(currentResults);
      } else {
        const header = columns.join(',');
        const rows = currentResults.map(record => {
          return columns.map(col => {
            const value = String(record[col] || '');
            if (value.includes(',') || value.includes('"') || value.includes('\n')) {
              return '"' + value.replace(/"/g, '""') + '"';
            }
            return value;
          }).join(',');
        });
        csvContent = [header, ...rows].join('\n');
      }

      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');

      if (link.download !== undefined) {
        const url = URL.createObjectURL(blob);
        link.setAttribute('href', url);
        link.setAttribute('download', 'filtered_results.csv');
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
      }
    });
  }

  // URL loading
  if (loadUrlBtn && urlInput && urlStatus) {
    loadUrlBtn.addEventListener('click', async () => {
      const url = urlInput.value.trim();
      if (!url) {
        urlStatus.textContent = 'Please enter a valid URL';
        return;
      }

      try {
        urlStatus.textContent = 'Loading CSV from URL...';
        const response = await fetch(url);
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        const csvText = await response.text();

        fallbackProcessFile(csvText, url.split('/').pop() || 'remote.csv');

        urlStatus.textContent = '';
        urlInput.value = '';
      } catch (error) {
        urlStatus.textContent = 'Error loading CSV: ' + error.message;
      }
    });
  }
}

// Theme toggle (separate from main script to avoid conflicts)
function setupThemeToggle() {
  const themeToggle = document.getElementById('themeToggle');
  if (!themeToggle) return;

  function updateToggle() {
    const isDark = document.documentElement.classList.contains('dark');
    themeToggle.textContent = isDark ? 'Light Mode' : 'Dark Mode';
  }

  themeToggle.addEventListener('click', () => {
    document.documentElement.classList.toggle('dark');
    try {
      localStorage.setItem('theme', document.documentElement.classList.contains('dark') ? 'dark' : 'light');
    } catch (error) {
      console.error('Failed to save theme to localStorage:', error);
    }
    updateToggle();
  });

  updateToggle();
}

// Initialize everything when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  initApp();
  setupFileHandlers();
  setupEventListeners();
  setupThemeToggle();
});

// Also initialize if script loads after DOM
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    initApp();
    setupFileHandlers();
    setupEventListeners();
    setupThemeToggle();
  });
} else {
  initApp();
  setupFileHandlers();
  setupEventListeners();
  setupThemeToggle();
}
