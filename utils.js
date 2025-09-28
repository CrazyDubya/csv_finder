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

  // Export for global use
  if (typeof window !== 'undefined') {
    window._ = window._ || {};
    window._.debounce = debounce;
    window._.throttle = throttle;
    window._.clone = clone;
  }

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { debounce, throttle, clone };
  }
})();
