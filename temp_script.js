    try {
      if (localStorage.theme === 'dark') {
        document.documentElement.classList.add('dark');
      }
    } catch (e) {
      console.warn('localStorage is not available. Defaulting to light theme.', e);
    }
  </script>
  <script>
    let csvData = [];
    let columns = [];

    let columnNames = {};
    let fuse = null;

    let currentResults = [];
    const worker = new Worker('worker.js');
    const BUFFER = 5; // number of items to render above/below the viewport
    const ESTIMATED_CARD_HEIGHT = 120; // estimated card height for virtualization
    let approxHeight = ESTIMATED_CARD_HEIGHT;

    let selectedColumns = [];
    let currentPage = 1;

    let resultsPerPage = 25;
    let currentLayout = 'cards'; // 'cards', 'table', 'list', 'compact'
    let csvWorker = null;
    let filterCache = {};
    let columnTypes = {};
    let sortColumn = null;
    let sortAscending = true;

    // DOM Elements
    const dragArea = document.getElementById('dragArea');
    const fileInput = document.getElementById('fileInput');
    const searchInput = document.getElementById('searchInput');
    const fileStatus = document.getElementById('fileStatus');
    const resultsArea = document.getElementById('resultsArea');

    const resultsContainer = document.getElementById('resultsContainer');
    const toggleViewBtn = document.getElementById('toggleViewBtn');
    const resultCount = document.getElementById('resultCount');

    const filterContainer = document.getElementById('filterContainer');
    const filtersDiv = document.getElementById('filters');
    const statsArea = document.getElementById('statsArea');
    const statsContainer = document.getElementById('statsContainer');

    const urlInput = document.getElementById('urlInput');
    const loadUrlBtn = document.getElementById('loadUrlBtn');
    const urlStatus = document.getElementById('urlStatus');

    const sortContainer = document.getElementById('sortContainer');

    const spinner = document.getElementById('spinner');
    const layoutSelect = document.getElementById('layoutSelect');
    const itemsPerPageSelect = document.getElementById('itemsPerPageSelect');
    const exportBtn = document.getElementById('exportBtn');
    const controlsArea = document.getElementById('controlsArea');
    
    // Additional DOM elements
    const prevBtn = document.getElementById('prevBtn');
    const nextBtn = document.getElementById('nextBtn');
    const pageInfo = document.getElementById('pageInfo');
    const pageSizeSelect = document.getElementById('pageSize');
    const columnContainer = document.getElementById('columnContainer');
    const resetFiltersBtn = document.getElementById('resetFiltersBtn');

    function showSpinner() {
      spinner.classList.remove('hidden');
    }

    function hideSpinner() {
      spinner.classList.add('hidden');
    }

    // Initialize web worker
    function initWorker() {
      // Temporarily disable web worker to test fallback
      csvWorker = null;
      /*
      if (typeof Worker !== 'undefined') {
        csvWorker = new Worker('csv-worker.js');
        csvWorker.onmessage = function(e) {
          const { type, data, message, progress } = e.data;

          switch (type) {
            case 'progress':
              fileStatus.textContent = `${message} (${progress}%)`;
              break;
            case 'csvParsed':
              handleCSVParsed(data);
              break;
            case 'csvChunk':
              handleCSVChunk(data);
              break;
            case 'filtersBuilt':
              handleFiltersBuilt(data);
              break;
            case 'dataFiltered':
              handleDataFiltered(data);
              break;
            case 'error':
              fileStatus.textContent = message;
              hideSpinner();
              break;
          }
        };
      }
      */
    }

    // Initialize worker on page load
    initWorker();

    worker.onmessage = function(e) {
      const msg = e.data;
      if (msg.type === 'parsed') {
        csvData = msg.data;
        columns = msg.columns;
        fileStatus.textContent = `Loaded ${msg.total} rows successfully.`;
        searchInput.disabled = false;
        resultsArea.classList.remove('hidden');
        buildFilters();
        currentResults = csvData;
        displayResults();
      } else if (msg.type === 'results') {
        currentResults = msg.results;
        displayResults();
      } else if (msg.type === 'error') {
        fileStatus.textContent = 'Error: ' + msg.message;
      }
    };

    function inferColumnType(values) {
      const nonEmpty = values.filter(v => v !== "");
      if (nonEmpty.every(v => !isNaN(Date.parse(v)))) return 'date';
      if (nonEmpty.every(v => isStrictNumber(v))) return 'number';
      return 'string';
    }

    function isStrictNumber(value) {
      return !isNaN(value) && !isNaN(parseFloat(value)) && isNaN(Date.parse(value));
    }
    function formatDate(d) {
      const pad = n => String(n).padStart(2, '0');
      return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
    }


    // Toggle between card and table views
    toggleViewBtn.addEventListener('click', () => {
      viewMode = viewMode === 'card' ? 'table' : 'card';
      toggleViewBtn.textContent = viewMode === 'card' ? 'Table View' : 'Card View';
      resultsContainer.className = viewMode === 'card' ? cardContainerClass : tableContainerClass;
      renderResults();
    });

    const savedState = JSON.parse(localStorage.getItem('csvViewerState') || '{}');
    let viewMode = savedState.viewMode || 'grid';
    let savedFilters = savedState.filters || {};
    currentPage = savedState.page || 1;
    searchInput.value = savedState.search || '';

    toggleViewBtn.addEventListener('click', () => {
      viewMode = viewMode === 'grid' ? 'list' : 'grid';
      displayResults();
      saveState();
    });

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
        fileStatus.textContent = 'Please upload a valid CSV file.';
      }
    });
    // Open file dialog on click
    dragArea.addEventListener('click', () => fileInput.click());
    fileInput.addEventListener('change', e => {
      const file = e.target.files[0];
      if (file) processFile(file);
    });


    // Process CSV file using web worker for better performance
      function processFile(file) {
        // Reset previous data and show spinner
        csvData = [];
        currentResults = [];
        filterCache = {};
        fileStatus.textContent = 'Reading file...';
        searchInput.disabled = true;
        resultsArea.classList.add('hidden');
        controlsArea.classList.add('hidden');
        filterContainer.classList.add('hidden');
        showSpinner();
        
        const reader = new FileReader();
        reader.onload = function(e) {
          
          const csvText = e.target.result;
          
          if (csvWorker) {
            // Use web worker for processing
            csvWorker.postMessage({
              type: 'parseCSV',
              data: { csvText, filename: file.name }
            });
          } else {
            // Fallback to main thread processing
            fallbackProcessFile(csvText, file.name);
          }
        };
        
        reader.onerror = function(error) {
          fileStatus.textContent = 'Error reading file: ' + error.message;
          hideSpinner();
        };

        
        reader.readAsText(file);
      }

      // Fallback processing for browsers without web worker support
      function fallbackProcessFile(csvText, filename) {
        setTimeout(() => {
          try {
            // Simple CSV parser as fallback if d3 isn't available
            let parsedData;
            if (typeof d3 !== 'undefined' && d3.csvParse) {
              parsedData = d3.csvParse(csvText);
            } else {
              // Simple CSV parsing fallback
              parsedData = parseCSVSimple(csvText);
            }
            
            if (parsedData.length === 0) {
              fileStatus.textContent = 'No records found in the CSV.';
              hideSpinner();
              return;
            }
            
            columns = Object.keys(parsedData[0] || {});
            
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
            fileStatus.textContent = 'Error parsing CSV: ' + error.message;
            hideSpinner();
          }
        }, 50);
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
          fuse = null; // Will use simple search fallback
        }
        
        fileStatus.textContent = `Loaded ${data.totalRows} rows successfully.`;
        searchInput.disabled = false;
        resultsArea.classList.remove('hidden');
        controlsArea.classList.remove('hidden');
        
        // Build filters using worker if available
        if (csvWorker) {
          csvWorker.postMessage({
            type: 'buildFilters',
            data: { csvData, columns }
          });
        } else {
          buildFilters();
          // Build column visibility checkboxes
          buildColumnSelectors();
          buildSortButtons();
          // Set initial results to all records and display first page
          currentResults = csvData;
          currentPage = 1;
          renderResults();
        }
        
        hideSpinner();
      }

      // Build column selector checkboxes
      function buildColumnSelectors() {
        const columnCheckboxes = document.getElementById('columnCheckboxes');
        if (!columnCheckboxes) return;
        
        columnCheckboxes.innerHTML = '';
        selectedColumns = [...columns]; // Initialize with all columns
        
        columns.forEach(col => {
          const wrapper = document.createElement('div');
          wrapper.className = 'flex items-center';
          
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
        
        if (columns.length > 0) {
          columnContainer.classList.remove('hidden');
        }
      }

      // Simple function to highlight search terms
      function highlightValue(text, term) {
        if (!term || term.trim() === '') return text;
        const regex = new RegExp(`(${term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
        return text.replace(regex, '<mark>$1</mark>');
      }

      // Generate result count text
      function generateResultCountText(count) {
        return `Showing ${count} result${count === 1 ? '' : 's'}`;
      }

      // Save application state to localStorage
      function saveState() {
        try {
          const state = {
            viewMode,
            page: currentPage,
            search: searchInput.value,
            filters: getFilterValues(),
            layout: currentLayout,
            itemsPerPage: resultsPerPage
          };
          localStorage.setItem('csvViewerState', JSON.stringify(state));
        } catch (e) {
          console.warn('Failed to save state to localStorage', e);
        }
      }

      // Get current filter values
      function getFilterValues() {
        const filters = {};
        columns.forEach(field => {
          const select = document.getElementById(`filter-${field}`);
          if (select && select.value) {
            filters[field] = select.value;
          }
        });
        return filters;
      }

      // Handle chunk processing (for large files)
      function handleCSVChunk(data) {
        // For now, we'll handle chunks simply by updating progress
        // In a more advanced implementation, we could stream results
        console.log(`Received chunk ${data.chunkIndex + 1}/${data.totalChunks}`);
      }

      // Handle filter options built by worker
      function handleFiltersBuilt(filterOptions) {
        filterCache = filterOptions;
        buildFiltersFromCache();
        filterContainer.classList.remove('hidden');
      }

      // Handle filtered data from worker
      function handleDataFiltered(filteredData) {
        currentResults = filteredData;
        currentPage = 1;
        displayResults();
      }

    // Build filter dropdowns from cached data
    function buildFiltersFromCache() {
      filtersDiv.innerHTML = "";
      Object.keys(filterCache).forEach(field => {
        const uniqueVals = filterCache[field];
        const select = document.createElement('select');
        select.id = `filter-${field}`;
        select.multiple = true;
        select.size = Math.min(5, uniqueVals.length + 1);
        select.className = "border border-blue-300 rounded p-1 h-32";
        
        // Add default option
        const defaultOption = document.createElement('option');
        defaultOption.value = "";
        defaultOption.textContent = field + " (All)";
        defaultOption.selected = true;
        select.appendChild(defaultOption);
        
        uniqueVals.forEach(val => {
          const opt = document.createElement('option');
          opt.value = val;
          opt.textContent = val;
          select.appendChild(opt);
        });
        
        select.addEventListener('change', updateResults);
        
        const wrapper = document.createElement('div');
        wrapper.className = "flex flex-col";
        const label = document.createElement('label');
        label.htmlFor = select.id;
        label.className = "text-blue-800 text-sm font-medium";
        label.textContent = field;
        wrapper.appendChild(label);
        wrapper.appendChild(select);
        filtersDiv.appendChild(wrapper);
      });
    }

    // Fallback filter building for non-worker mode
    function buildFilters() {
      filtersDiv.innerHTML = "";
      columns.forEach(field => {


        const values = csvData.map(d => String(d[field] || '').trim());
        const nonEmptyVals = values.filter(v => v !== '');
        if (nonEmptyVals.length === 0) return;

        const type = inferColumnType(values);
        columnTypes[field] = type;
        const wrapper = document.createElement('div');
        wrapper.className = 'flex flex-col';
        const label = document.createElement('label');
        label.className = 'text-blue-800 text-sm font-medium';
        label.textContent = field;
        wrapper.appendChild(label);

        if (type === 'number') {
          const nums = nonEmptyVals.map(Number).filter(n => !isNaN(n));
          const minVal = Math.min(...nums);
          const maxVal = Math.max(...nums);
          const minRange = document.createElement('input');
          minRange.type = 'range';
          minRange.min = minVal;
          minRange.max = maxVal;
          minRange.value = minVal;
          minRange.id = `filter-${field}-min`;
          const maxRange = document.createElement('input');
          maxRange.type = 'range';
          maxRange.min = minVal;
          maxRange.max = maxVal;
          maxRange.value = maxVal;
          maxRange.id = `filter-${field}-max`;
          const display = document.createElement('div');
          display.className = 'flex justify-between text-xs text-blue-700';
          display.id = `display-${field}`;
          display.innerHTML = `<span>${minVal}</span><span>${maxVal}</span>`;
          const updateDisplay = () => {
            const minValue = parseFloat(minRange.value);
            const maxValue = parseFloat(maxRange.value);
            if (minValue > maxValue) {
              maxRange.value = minRange.value;
            }
            if (maxValue < minValue) {
              minRange.value = maxRange.value;
            }
            display.innerHTML = `<span>${minRange.value}</span><span>${maxRange.value}</span>`;
            updateResults();
          };
          minRange.addEventListener('input', updateDisplay);
          maxRange.addEventListener('input', updateDisplay);
          wrapper.appendChild(minRange);
          wrapper.appendChild(maxRange);
          wrapper.appendChild(display);
        } else if (type === 'date') {
          const dates = nonEmptyVals.map(d => new Date(d));
          const minDate = new Date(Math.min(...dates));
          const maxDate = new Date(Math.max(...dates));
          const fromInput = document.createElement('input');
          fromInput.type = 'date';
          fromInput.id = `filter-${field}-min`;
          fromInput.className = 'border border-blue-300 rounded p-1';
          fromInput.value = formatDate(minDate);
          fromInput.min = formatDate(minDate);
          fromInput.max = formatDate(maxDate);
          const toInput = document.createElement('input');
          toInput.type = 'date';
          toInput.id = `filter-${field}-max`;
          toInput.className = 'border border-blue-300 rounded p-1 mt-1';
          toInput.value = formatDate(maxDate);
          toInput.min = formatDate(minDate);
          toInput.max = formatDate(maxDate);
          const handleChange = e => {
            if (fromInput.value && toInput.value && fromInput.value > toInput.value) {
              if (e.target === fromInput) toInput.value = fromInput.value;
              else fromInput.value = toInput.value;
            }
            updateResults();
          };
          fromInput.addEventListener('change', handleChange);
          toInput.addEventListener('change', handleChange);
          wrapper.appendChild(fromInput);
          wrapper.appendChild(toInput);
        } else {

          const select = document.createElement('select');
          select.id = `filter-${field}`;

          select.multiple = true;
          select.size = Math.min(5, uniqueVals.length + 1);
          select.className = "border border-blue-300 rounded p-1";
          select.style.height = "var(--dropdown-height, 128px)"; // Default height is 128px; configurable via CSS variable
          // Add a default option for "All"

          const defaultOption = document.createElement('option');

          defaultOption.value = "";

          defaultOption.textContent = field + " (All)";
          defaultOption.selected = true;
          select.appendChild(defaultOption);
          const uniqueVals = Array.from(new Set(nonEmptyVals)).sort((a, b) => a.localeCompare(b));
          uniqueVals.forEach(val => {
            const opt = document.createElement('option');
            opt.value = val;
            opt.textContent = val;
            select.appendChild(opt);
          });
          // Update results when the filter changes
          select.addEventListener('change', () => {
            updateResults();
            saveState();
          });
          if (savedFilters[field]) {
            select.value = savedFilters[field];
          }

          // Create a label and wrapper for the select
          const wrapper = document.createElement('div');
          wrapper.className = 'flex flex-col';
          const labelWrapper = document.createElement('div');
          labelWrapper.className = 'flex items-center';
          const label = document.createElement('label');
          label.htmlFor = select.id;
          label.className = 'text-blue-800 text-sm font-medium';
          label.textContent = columnNames[field];
          const edit = document.createElement('span');
          edit.className = 'cursor-pointer text-xs text-gray-500 ml-1';
          edit.textContent = '✏';
          edit.setAttribute('role', 'button');
          edit.setAttribute('aria-label', 'Edit column name');
          edit.addEventListener('click', () => {
            const input = document.createElement('input');
            input.type = 'text';
            input.value = columnNames[field];
            input.className = 'border-b border-blue-400 text-sm w-24';
            input.setAttribute('aria-label', 'Edit column name');
            label.replaceWith(input);
            edit.style.display = 'none';
            input.focus();
            const save = () => {
              const trimmedValue = input.value.trim();
              if (trimmedValue === "") {
                const confirmClear = window.confirm("Are you sure you want to clear the custom name? This will revert to the original field name.");
                if (!confirmClear) {
                  input.focus();
                  return;
                }
              }
              const newVal = trimmedValue || field;
              columnNames[field] = newVal;
              label.textContent = newVal;
              input.replaceWith(label);
              edit.style.display = 'inline';
              defaultOption.textContent = newVal + ' (All)';
              displayResults();
            };
            input.addEventListener('blur', save);
            input.addEventListener('keydown', e => {
              if (e.key === 'Enter') {
                e.preventDefault();
                save();
              } else if (e.key === 'Escape') {
                e.preventDefault();
                input.replaceWith(label);
                edit.style.display = 'inline';
              }
            });
          });
          labelWrapper.appendChild(label);
          labelWrapper.appendChild(edit);
          wrapper.appendChild(labelWrapper);

          wrapper.appendChild(select);

        }

        filtersDiv.appendChild(wrapper);
      });
      buildFiltersFromCache();
      filterContainer.classList.remove('hidden');
    }


    // Build clickable sort buttons for each column
    function buildSortButtons() {

      sortContainer.replaceChildren();

      columns.forEach(field => {
        const btn = document.createElement('button');
        btn.dataset.column = field;
        btn.className = "px-2 py-1 border border-blue-300 rounded text-sm bg-white";
        btn.addEventListener('click', () => {
          if (sortColumn === field) {
            sortAscending = !sortAscending;
          } else {
            sortColumn = field;
            sortAscending = true;
          }
          updateSortUI();
          displayResults();
        });
        sortContainer.appendChild(btn);
      });
      updateSortUI();
    }

    function updateSortUI() {
      Array.from(sortContainer.children).forEach(btn => {
        const col = btn.dataset.column;
        if (col === sortColumn) {
          btn.classList.add('bg-blue-100');

          btn.textContent = col;
          const sortIndicator = document.createElement('span');
          sortIndicator.textContent = sortAscending ? '▲' : '▼';
          sortIndicator.className = "ml-1"; // Optional: Add margin for spacing
          btn.appendChild(sortIndicator);
          btn.setAttribute('aria-label', `${col} sorted ${sortAscending ? 'ascending' : 'descending'}`);

        } else {
          btn.classList.remove('bg-blue-100');
          btn.textContent = col;
        }
      });
    }


    let lastSortColumn = null;
    let lastSortAscending = null;

    function sortResults() {
      if (!sortColumn) return;
      // Skip sorting if the sort criteria haven't changed
      if (sortColumn === lastSortColumn && sortAscending === lastSortAscending) {
        return;
      }
      currentResults.sort((a, b) => {
        const valA = a[sortColumn];
        const valB = b[sortColumn];
        
        const isNumericA = !isNaN(Number(valA));
        const isNumericB = !isNaN(Number(valB));
        
        if (isNumericA && isNumericB) {
          // Numeric comparison
          return sortAscending ? valA - valB : valB - valA;
        } else {
          // String comparison (case-insensitive)
          const strA = String(valA || '').toLowerCase();
          const strB = String(valB || '').toLowerCase();
          if (strA < strB) return sortAscending ? -1 : 1;
          if (strA > strB) return sortAscending ? 1 : -1;
          return 0;
        }
      });


    }

    // Update results based on search input and filter selections
    function updateResults() {
      const term = searchInput.value.trim();

      let filtered;
      
      if (term === "") {
        filtered = csvData;
      } else if (fuse) {
        // Use Fuse.js for fuzzy search if available
        filtered = fuse.search(term).map(r => r.item);
      } else {
        // Simple text search fallback
        filtered = csvData.filter(record => {
          return columns.some(col => {
            const value = String(record[col] || '').toLowerCase();
            return value.includes(term.toLowerCase());
          });
        });
      }
      
      // Apply each filter
      columns.forEach(field => {
        const type = columnTypes[field];
        if (type === 'number') {
          const minInput = document.getElementById(`filter-${field}-min`);
          const maxInput = document.getElementById(`filter-${field}-max`);
          if (minInput && maxInput) {
            const minVal = parseFloat(minInput.value);
            const maxVal = parseFloat(maxInput.value);
            filtered = filtered.filter(record => {
              const val = parseFloat(record[field]);
              return !isNaN(val) && val >= minVal && val <= maxVal;
            });
          }
        } else if (type === 'date') {
          const minInput = document.getElementById(`filter-${field}-min`);
          const maxInput = document.getElementById(`filter-${field}-max`);
          if (minInput && maxInput) {
            const minVal = minInput.value;
            const maxVal = maxInput.value;
            filtered = filtered.filter(record => {
              const v = record[field];
              if (!v) return false;
              const date = new Date(v);
              if (isNaN(date)) return false;
              if (minVal && date < new Date(minVal)) return false;
              if (maxVal && date > new Date(maxVal)) return false;
              return true;
            });
          }
        } else {
          const select = document.getElementById(`filter-${field}`);
          if (select && select.value && select.value !== '') {
            filtered = filtered.filter(record => {
              return String(record[field]).trim() === select.value;
            });
          }
        }
      });

      currentResults = filtered;
      currentPage = 1;
      sortResults();
      displayResults();
      saveState();
    }

    // Escape RegExp special characters for building a search regex
    function escapeRegExp(string) {
      return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }

    // Escape HTML to prevent injection
    function escapeHtml(text) {
      const map = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;'
      };
      return text.replace(/[&<>"']/g, m => map[m]);
    }

    // Highlight the search term within a value if present (case-insensitive)
    function highlightValue(value, term) {
      const str = String(value);
      if (!term) return escapeHtml(str);
      const regex = new RegExp(escapeRegExp(term), 'gi');
      let result = '';
      let lastIndex = 0;
      let match;
      while ((match = regex.exec(str)) !== null) {
        result += escapeHtml(str.slice(lastIndex, match.index));
        result += `<mark>${escapeHtml(match[0])}</mark>`;
        lastIndex = match.index + match[0].length;
      }
      result += escapeHtml(str.slice(lastIndex));
      return result;
    }

    // Display results based on current view mode and pagination
      let result = '';
      let lastIndex = 0;
      let match;
      while ((match = regex.exec(str)) !== null) {
        result += escapeHtml(str.slice(lastIndex, match.index));
        result += `<mark>${escapeHtml(match[0])}</mark>`;
        lastIndex = match.index + match[0].length;
      }
      result += escapeHtml(str.slice(lastIndex));
      return result;
    }

    // Display results as cards for the current page

    function displayResults() {
      applyViewMode();
      resultsContainer.innerHTML = "";

      sortResults();

      const startIdx = (currentPage - 1) * resultsPerPage;
      const endIdx = startIdx + resultsPerPage;
      const pageResults = currentResults.slice(startIdx, endIdx);
      
        pageResults.forEach((record, idx) => {
          const card = document.createElement('div');
          card.className = "bg-white shadow-md rounded-lg p-4 border border-blue-200 cursor-pointer";
          card.addEventListener('click', () => openModal(startIdx + idx));
          const list = document.createElement('ul');
          list.className = "space-y-1";
        // For each column, display it only if the value is non-empty
        columns.forEach(col => {
      // Set container class based on layout
      switch (currentLayout) {
        case 'cards':
          resultsContainer.className = "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6";
          displayCardsLayout(pageResults);
          break;
        case 'table':
          resultsContainer.className = "overflow-x-auto";
          displayTableLayout(pageResults);
          break;
        case 'list':
          resultsContainer.className = "space-y-2";
          displayListLayout(pageResults);
          break;
        case 'compact':
          resultsContainer.className = "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2";
          displayCompactLayout(pageResults);
          break;
      }
      
      updatePaginationInfo();
    }

    function displayCardsLayout(pageResults) {
      const term = searchInput.value.trim();
      pageResults.forEach(record => {
        const card = document.createElement('div');

        card.className = "relative bg-white shadow-md rounded-lg p-4 border border-blue-200";
        const list = document.createElement('ul');
        list.className = "space-y-1";
        // For each column, display it only if the value is non-empty
        const term = searchInput.value.trim();
        columns.forEach(col => {
          const value = record[col] || '';
          if (value.trim() === "") return;
          const item = document.createElement('li');
          const displayValue = highlightValue(String(value), term);

          list.appendChild(item);
        });
        
        card.appendChild(list);

        const copyBtn = document.createElement('button');
        copyBtn.type = 'button';
        copyBtn.textContent = 'Copy';
        copyBtn.className = 'absolute top-2 right-2 text-xs text-blue-600 hover:underline';
        copyBtn.addEventListener('click', () => {
          const rowText = d3.csvFormatRow(columns.map(c => record[c]));
          if (navigator.clipboard && window.isSecureContext) {
            navigator.clipboard.writeText(rowText);
          } else {
            const ta = document.createElement('textarea');
            ta.value = rowText;
            ta.style.position = 'fixed';
            ta.style.left = OFFSCREEN_POSITION;
            document.body.appendChild(ta);
            ta.focus();
            ta.select();
            try { 
              document.execCommand('copy'); 
            } catch (err) {
              console.error('Copy operation failed:', err);
              alert('Failed to copy text. Please try again.');
            }
            document.body.removeChild(ta);
          }
        });
        card.appendChild(copyBtn);

        resultsContainer.appendChild(card);
      });
    }

    function displayTableLayout(pageResults) {
      const table = document.createElement('table');
      table.className = "min-w-full bg-white border border-gray-200 rounded-lg overflow-hidden";
      
      // Create header
      const thead = document.createElement('thead');
      thead.className = "bg-blue-50";
      const headerRow = document.createElement('tr');
      
      columns.forEach(col => {
        const th = document.createElement('th');
        th.className = "px-4 py-2 text-left text-sm font-medium text-blue-800 border-b";
        th.textContent = col;
        headerRow.appendChild(th);
      });
      
      const actionsHeader = document.createElement('th');
      actionsHeader.className = "px-4 py-2 text-left text-sm font-medium text-blue-800 border-b";
      actionsHeader.textContent = "Actions";
      headerRow.appendChild(actionsHeader);
      
      thead.appendChild(headerRow);
      table.appendChild(thead);
      
      // Create body
      const tbody = document.createElement('tbody');
      const term = searchInput.value.trim();
      
      pageResults.forEach((record, index) => {
        const row = document.createElement('tr');
        row.className = index % 2 === 0 ? "bg-white" : "bg-gray-50";
        
        columns.forEach(col => {
          const td = document.createElement('td');
          td.className = "px-4 py-2 text-sm border-b max-w-xs truncate";
          const value = record[col] || '';
          const displayValue = highlightValue(String(value), term);
          td.innerHTML = displayValue;
          td.title = String(value); // Show full text on hover
          row.appendChild(td);
        });
        
        const actionsCell = document.createElement('td');
        actionsCell.className = "px-4 py-2 text-sm border-b";
        actionsCell.appendChild(createCopyButton(record, 'text-xs px-2 py-1 bg-blue-500 text-white rounded hover:bg-blue-600'));
        row.appendChild(actionsCell);
        
        tbody.appendChild(row);
      });
      
      table.appendChild(tbody);
      resultsContainer.appendChild(table);
    }

    function displayListLayout(pageResults) {
      const term = searchInput.value.trim();
      pageResults.forEach(record => {
        const item = document.createElement('div');
        item.className = "bg-white p-3 rounded border border-gray-200 hover:bg-gray-50";
        
        const content = document.createElement('div');
        content.className = "flex justify-between items-start";
        
        const details = document.createElement('div');
        details.className = "flex-1";
        
        const mainInfo = [];
        columns.slice(0, 3).forEach(col => {
          const value = record[col] || '';
          if (value.trim() !== "") {
            const displayValue = highlightValue(String(value), term);
            mainInfo.push(`<span class="font-medium text-blue-800">${col}:</span> ${displayValue}`);
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
      const term = searchInput.value.trim();
      pageResults.forEach(record => {
        const card = document.createElement('div');
        card.className = "bg-white p-2 rounded border border-gray-200 text-sm hover:shadow-md transition-shadow";
        
        const primaryField = columns[0];
        const primaryValue = record[primaryField] || '';
        
        if (primaryValue.trim() !== "") {
          const title = document.createElement('div');
          title.className = "font-medium text-blue-800 truncate";
          title.innerHTML = highlightValue(String(primaryValue), term);
          title.title = String(primaryValue);
          card.appendChild(title);
        }
        
        const secondaryInfo = [];
        columns.slice(1, 3).forEach(col => {
          const value = record[col] || '';
          if (value.trim() !== "") {
            secondaryInfo.push(String(value));
          }
        });
        
        if (secondaryInfo.length > 0) {
          const subtitle = document.createElement('div');
          subtitle.className = "text-gray-600 text-xs truncate mt-1";
          subtitle.textContent = secondaryInfo.join(' • ');
          subtitle.title = secondaryInfo.join(' • ');
          card.appendChild(subtitle);
        }
        
        card.appendChild(createCopyButton(record, 'absolute top-1 right-1 text-xs text-gray-400 hover:text-blue-600'));
        card.classList.add('relative');
        resultsContainer.appendChild(card);
      });
    }

    function createCopyButton(record, className = 'absolute top-2 right-2 text-xs text-blue-600 hover:underline') {
      const copyBtn = document.createElement('button');
      copyBtn.type = 'button';
      copyBtn.textContent = 'Copy';
      copyBtn.className = className;
      copyBtn.addEventListener('click', () => {
        let rowText;
        if (typeof d3 !== 'undefined' && d3.csvFormatRow) {
          rowText = d3.csvFormatRow(columns.map(c => record[c]));
        } else {
          // Simple CSV row formatting fallback
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
          try { document.execCommand('copy'); } catch (err) {}
          document.body.removeChild(ta);
        }
      });
      return copyBtn;
    }

    function updatePaginationInfo() {
      const totalPages = Math.ceil(currentResults.length / resultsPerPage);
      resultCount.textContent = `Showing ${currentResults.length} result${currentResults.length === 1 ? "" : "s"}.`;
      pageInfo.textContent = `Page ${currentPage} of ${totalPages}`;
      
      prevBtn.disabled = currentPage <= 1;
      nextBtn.disabled = currentPage >= totalPages;
    }


    // Display results as a table for the current page
    function displayTableResults() {
      resultsContainer.innerHTML = "";
      const startIdx = (currentPage - 1) * resultsPerPage;
      const endIdx = startIdx + resultsPerPage;
      const pageResults = currentResults.slice(startIdx, endIdx);

      const table = document.createElement('table');
      table.className = 'min-w-full divide-y divide-blue-200 border';
      const thead = document.createElement('thead');
      thead.className = 'bg-blue-50';
      const headerRow = document.createElement('tr');
      columns.forEach(col => {
        const th = document.createElement('th');
        th.textContent = col;
        th.className = 'px-4 py-2 text-left text-blue-700';
        headerRow.appendChild(th);
      });
      thead.appendChild(headerRow);
      table.appendChild(thead);

      const tbody = document.createElement('tbody');
      pageResults.forEach(record => {
        const row = document.createElement('tr');
        columns.forEach(col => {
          const td = document.createElement('td');
          td.textContent = record[col] || '';
          td.className = 'px-4 py-2 border-t';
          row.appendChild(td);
        });
        tbody.appendChild(row);
      });
      table.appendChild(tbody);
      resultsContainer.appendChild(table);

      const totalPages = Math.ceil(currentResults.length / resultsPerPage);
      resultCount.textContent = generateResultCountText(currentResults.length);
      pageInfo.textContent = `Page ${currentPage} of ${totalPages}`;

      prevBtn.disabled = currentPage <= 1;
      nextBtn.disabled = currentPage >= totalPages;
    }

    // Render results based on current view mode
    function renderResults() {
      if (viewMode === 'table') {
        displayTableResults();
      } else {
        displayResults();
      }

    }

    // Pagination controls
    prevBtn.addEventListener('click', () => {
      if (currentPage > 1) {
        currentPage--;
        displayResults();
        saveState();
      }

    });


    // Change page size
    pageSizeSelect.addEventListener('change', () => {
      const newSize = parseInt(pageSizeSelect.value, 10);
      if (!isNaN(newSize) && newSize >= 1 && newSize <= 1000) {
        resultsPerPage = newSize;
        currentPage = 1;
        displayResults();

        saveState();

      }
    });


    // Reset all filters and search input
    resetFiltersBtn.addEventListener('click', () => {
      columns.forEach(field => {
        const select = document.getElementById(`filter-${field}`);
        if (select) {
          Array.from(select.options).forEach(opt => {
            opt.selected = opt.value === '';
          });
        }
      });
      searchInput.value = '';
      updateResults();
    });

    // Handle search input (debounced)

    searchInput.addEventListener('input', _.debounce(updateResults, 300));

    // Layout switcher event listener
    layoutSelect.addEventListener('change', (e) => {
      currentLayout = e.target.value;
      displayResults();
    });

    // Items per page event listener
    itemsPerPageSelect.addEventListener('change', (e) => {
      resultsPerPage = parseInt(e.target.value);
      currentPage = 1;
      displayResults();
    });

    // Export functionality
    exportBtn.addEventListener('click', () => {
      if (currentResults.length === 0) {
        alert('No data to export');
        return;
      }
      
      let csvContent;
      if (typeof d3 !== 'undefined' && d3.csvFormat) {
        csvContent = d3.csvFormat(currentResults.map(record => {
          const cleanRecord = {};
          columns.forEach(col => {
            cleanRecord[col] = record[col] || '';
          });
          return cleanRecord;
        }));
      } else {
        // Simple CSV formatting fallback
        csvContent = formatCSVSimple(currentResults);
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
      }
    });

    // Simple CSV formatting fallback
    function formatCSVSimple(data) {
      const header = columns.join(',');
      const rows = data.map(record => {
        return columns.map(col => {
          const value = String(record[col] || '');
          // Quote values that contain commas, quotes, or newlines
          if (value.includes(',') || value.includes('"') || value.includes('\n')) {
            return '"' + value.replace(/"/g, '""') + '"';
          }
          return value;
        }).join(',');
      });
      return [header, ...rows].join('\n');
    }

  </script>
  <script>
    const themeToggle = document.getElementById('themeToggle');
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

