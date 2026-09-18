// Simple utilities to replace Lodash
(function() {
  'use strict';

  function debounce(func, wait, immediate) {
    let timeout;
    return function executedFunction(...args) {
      const later = () => {
        timeout = null;
        if (!immediate) func.apply(this, args);
      };
      const callNow = immediate && !timeout;
      clearTimeout(timeout);
      timeout = setTimeout(later, wait);
      if (callNow) func.apply(this, args);
    };
  }

  function throttle(func, limit) {
    let inThrottle;
    return function(...args) {
      if (!inThrottle) {
        func.apply(this, args);
        inThrottle = true;
        setTimeout(() => inThrottle = false, limit);
      }
    };
  }

  function clone(obj) {
    if (obj === null || typeof obj !== 'object') return obj;
    if (obj instanceof Date) return new Date(obj);
    if (obj instanceof Array) return obj.map(item => clone(item));
    if (typeof obj === 'object') {
      const cloned = {};
      Object.keys(obj).forEach(key => {
        cloned[key] = clone(obj[key]);
      });
      return cloned;
    }
  }

  function isValidIsoDate(value) {
    const match = /^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2})(?::(\d{2})(?:\.\d+)?)?(?:Z|([+-])(\d{2}):(\d{2}))?)?$/.exec(value);
    if (!match) return false;

    const year = Number(match[1]);
    const month = Number(match[2]);
    const day = Number(match[3]);
    if (month < 1 || month > 12) return false;
    const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
    if (day < 1 || day > daysInMonth) return false;

    if (match[4] !== undefined) {
      if (Number(match[4]) > 23 || Number(match[5]) > 59) return false;
      if (match[6] !== undefined && Number(match[6]) > 59) return false;
      if (match[8] !== undefined && (Number(match[8]) > 23 || Number(match[9]) > 59)) return false;
    }
    return true;
  }

  function inferColumnType(values) {
    const nonEmpty = values.filter(value => value !== '');
    if (nonEmpty.length === 0) return 'string';
    if (nonEmpty.every(isValidIsoDate)) return 'date';
    if (nonEmpty.every(value => !isNaN(Number(value)) && isFinite(Number(value)))) return 'number';
    return 'string';
  }

  async function fetchTextWithTimeout(url, timeoutMs, fetchImpl) {
    const request = fetchImpl || fetch;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await request(url, { signal: controller.signal });
      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
      return await response.text();
    } finally {
      clearTimeout(timeoutId);
    }
  }

  // Export for global use
  if (typeof window !== 'undefined') {
    window._ = window._ || {};
    window._.debounce = debounce;
    window._.throttle = throttle;
    window._.clone = clone;
    window._.isValidIsoDate = isValidIsoDate;
    window._.inferColumnType = inferColumnType;
    window._.fetchTextWithTimeout = fetchTextWithTimeout;
  }

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { debounce, throttle, clone, isValidIsoDate, inferColumnType, fetchTextWithTimeout };
  }
})();
