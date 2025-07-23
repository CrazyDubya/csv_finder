// Simple fuzzy search to replace Fuse.js
(function() {
  'use strict';
  
  class SimpleFuse {
    constructor(list, options = {}) {
      this.list = list;
      this.options = {
        keys: options.keys || [],
        threshold: options.threshold || 0.6,
        distance: options.distance || 100,
        ...options
      };
    }
    
    search(pattern) {
      if (!pattern || pattern.trim() === '') {
        return this.list.map((item, index) => ({ item, refIndex: index }));
      }
      
      const searchTerm = pattern.toLowerCase();
      const results = [];
      
      for (let i = 0; i < this.list.length; i++) {
        const item = this.list[i];
        let score = 0;
        let matches = 0;
        
        // Search in specified keys or all properties
        const keysToSearch = this.options.keys.length > 0 
          ? this.options.keys 
          : Object.keys(item);
        
        for (const key of keysToSearch) {
          const value = String(item[key] || '').toLowerCase();
          
          if (value.includes(searchTerm)) {
            matches++;
            // Exact match gets highest score
            if (value === searchTerm) {
              score += 1.0;
            }
            // Starts with term gets high score
            else if (value.startsWith(searchTerm)) {
              score += 0.8;
            }
            // Contains term gets medium score
            else {
              score += 0.6;
            }
          } else {
            // Try fuzzy matching for approximate matches
            const fuzzyScore = this.fuzzyMatch(searchTerm, value);
            if (fuzzyScore > this.options.threshold) {
              matches++;
              score += fuzzyScore * 0.4;
            }
          }
        }
        
        if (matches > 0) {
          results.push({
            item,
            refIndex: i,
            score: score / keysToSearch.length
          });
        }
      }
      
      // Sort by score (highest first)
      return results.sort((a, b) => b.score - a.score);
    }
    
    fuzzyMatch(pattern, text) {
      const patternLength = pattern.length;
      const textLength = text.length;
      
      if (patternLength === 0) return 1.0;
      if (textLength === 0) return 0.0;
      
      let patternIndex = 0;
      let textIndex = 0;
      let matches = 0;
      
      while (patternIndex < patternLength && textIndex < textLength) {
        if (pattern[patternIndex] === text[textIndex]) {
          matches++;
          patternIndex++;
        }
        textIndex++;
      }
      
      return matches / patternLength;
    }
  }
  
  // Export for global use
  if (typeof window !== 'undefined') {
    window.Fuse = SimpleFuse;
  }
  
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = SimpleFuse;
  }
})();