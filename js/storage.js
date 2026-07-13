/* storage.js - 本地存储管理 */
(function() {
  'use strict';

  var STORAGE_KEY = 'vocab_app_data';
  var SETTINGS_KEY = 'vocab_app_settings';
  var STREAK_KEY = 'vocab_app_streak';

  function loadWords() {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEY)) || [];
    } catch (e) {
      return [];
    }
  }

  function saveWords(words) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(words));
    } catch (e) {
      showToast('存储空间不足，请导出生词数据后清理');
    }
  }

  function generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2, 6);
  }

  function getToday() {
    var d = new Date();
    return d.getFullYear() + '-' +
      String(d.getMonth() + 1).padStart(2, '0') + '-' +
      String(d.getDate()).padStart(2, '0');
  }

  function addDays(dateStr, days) {
    var d = new Date(dateStr);
    d.setDate(d.getDate() + days);
    return d.getFullYear() + '-' +
      String(d.getMonth() + 1).padStart(2, '0') + '-' +
      String(d.getDate()).padStart(2, '0');
  }

  // Ebbinghaus intervals: day 1, 2, 4, 7, 15, 30
  var INTERVALS = [1, 2, 4, 7, 15, 30];

  window.VocabStorage = {
    // Add a word
    addWord: function(word, meaning, source) {
      var words = loadWords();
      // Check duplicate
      if (words.some(function(w) { return w.word.toLowerCase() === word.toLowerCase(); })) {
        return null; // already exists
      }
      var newWord = {
        id: generateId(),
        word: word.trim(),
        meaning: meaning.trim(),
        source: source || 'ocr',
        status: 'new', // new | learning | mastered
        reviewCount: 0,
        nextReviewDate: addDays(getToday(), 1), // first review tomorrow
        createdAt: getToday(),
        reviewHistory: []
      };
      words.unshift(newWord);
      saveWords(words);
      return newWord;
    },

    // Batch add words
    addWords: function(wordList) {
      var words = loadWords();
      var added = [];
      wordList.forEach(function(item) {
        if (!item.word) return;
        if (words.some(function(w) { return w.word.toLowerCase() === item.word.toLowerCase(); })) return;
        var newWord = {
          id: generateId(),
          word: item.word.trim(),
          meaning: item.meaning.trim(),
          source: item.source || 'ocr',
          status: 'new',
          reviewCount: 0,
          nextReviewDate: addDays(getToday(), 1),
          createdAt: getToday(),
          reviewHistory: []
        };
        words.unshift(newWord);
        added.push(newWord);
      });
      saveWords(words);
      return added;
    },

    // Get all words
    getAllWords: function() {
      return loadWords();
    },

    // Get words by status
    getWordsByStatus: function(status) {
      return loadWords().filter(function(w) { return w.status === status; });
    },

    // Search words
    searchWords: function(query) {
      var q = query.toLowerCase();
      return loadWords().filter(function(w) {
        return w.word.toLowerCase().includes(q) || w.meaning.includes(q);
      });
    },

    // Update a word
    updateWord: function(id, updates) {
      var words = loadWords();
      var idx = words.findIndex(function(w) { return w.id === id; });
      if (idx === -1) return null;
      Object.assign(words[idx], updates);
      saveWords(words);
      return words[idx];
    },

    // Delete a word
    deleteWord: function(id) {
      var words = loadWords();
      var filtered = words.filter(function(w) { return w.id !== id; });
      saveWords(filtered);
    },

    // Clear all words
    clearAll: function() {
      saveWords([]);
    },

    // Get review queue for today
    getReviewQueue: function() {
      var today = getToday();
      return loadWords().filter(function(w) {
        return w.status !== 'mastered' && w.nextReviewDate <= today;
      }).sort(function(a, b) {
        return a.reviewCount - b.reviewCount;
      });
    },

    // Mark review result
    markReview: function(id, known) {
      var words = loadWords();
      var idx = words.findIndex(function(w) { return w.id === id; });
      if (idx === -1) return null;

      var w = words[idx];
      w.reviewHistory.push({ date: getToday(), result: known ? 'know' : 'forgot' });

      if (known) {
        var nextCount = w.reviewCount + 1;
        if (nextCount >= INTERVALS.length) {
          w.status = 'mastered';
          w.reviewCount = nextCount;
          w.nextReviewDate = null;
        } else {
          w.status = 'learning';
          w.reviewCount = nextCount;
          w.nextReviewDate = addDays(getToday(), INTERVALS[nextCount]);
        }
      } else {
        // Reset to day 1
        w.status = 'learning';
        w.reviewCount = 0;
        w.nextReviewDate = addDays(getToday(), 1);
      }

      saveWords(words);
      return w;
    },

    // Get streak
    getStreak: function() {
      try {
        var data = JSON.parse(localStorage.getItem(STREAK_KEY)) || { lastDate: '', count: 0 };
        return data;
      } catch (e) {
        return { lastDate: '', count: 0 };
      }
    },

    // Update streak (call when review is done)
    updateStreak: function() {
      var today = getToday();
      var data = this.getStreak();
      var yesterday = addDays(today, -1);

      if (data.lastDate === today) return data; // already recorded today
      if (data.lastDate === yesterday) {
        data.count += 1;
      } else {
        data.count = 1;
      }
      data.lastDate = today;
      localStorage.setItem(STREAK_KEY, JSON.stringify(data));
      return data;
    },

    // Get stats
    getStats: function() {
      var words = loadWords();
      return {
        total: words.length,
        newCount: words.filter(function(w) { return w.status === 'new'; }).length,
        learning: words.filter(function(w) { return w.status === 'learning'; }).length,
        mastered: words.filter(function(w) { return w.status === 'mastered'; }).length,
        reviewToday: this.getReviewQueue().length
      };
    },

    // Settings
    getSettings: function() {
      try {
        return JSON.parse(localStorage.getItem(SETTINGS_KEY)) || {};
      } catch (e) {
        return {};
      }
    },

    saveSettings: function(settings) {
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
    },

    // Export
    exportData: function() {
      var data = {
        words: loadWords(),
        streak: this.getStreak(),
        exportedAt: new Date().toISOString(),
        version: '1.0'
      };
      return JSON.stringify(data, null, 2);
    },

    // Import
    importData: function(jsonStr) {
      try {
        var data = JSON.parse(jsonStr);
        if (!data.words || !Array.isArray(data.words)) {
          throw new Error('数据格式不正确');
        }
        var existing = loadWords();
        var existingIds = new Set(existing.map(function(w) { return w.id; }));
        var newWords = data.words.filter(function(w) { return !existingIds.has(w.id); });
        var merged = newWords.concat(existing);
        saveWords(merged);
        if (data.streak) {
          localStorage.setItem(STREAK_KEY, JSON.stringify(data.streak));
        }
        return newWords.length;
      } catch (e) {
        throw new Error('导入失败：' + e.message);
      }
    },

    // Day utilities
    getToday: getToday,
    addDays: addDays,
    INTERVALS: INTERVALS
  };
})();

function showToast(msg) {
  var toast = document.getElementById('toast');
  toast.textContent = msg;
  toast.style.display = 'block';
  setTimeout(function() { toast.style.display = 'none'; }, 2000);
}