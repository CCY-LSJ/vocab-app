/* review.js - 艾宾浩斯复习模块 */
(function() {
  'use strict';

  var EBBINGHAUS_INTERVALS = [1, 2, 4, 7, 15, 30];
  var EBBINGHAUS_NAMES = ['第1次', '第2次', '第3次', '第4次', '第5次', '第6次'];

  window.VocabReview = {
    intervals: EBBINGHAUS_INTERVALS,
    intervalNames: EBBINGHAUS_NAMES,

    // Get the interval name for a review count
    getIntervalName: function(count) {
      if (count >= EBBINGHAUS_NAMES.length) return '已掌握';
      return EBBINGHAUS_NAMES[count];
    },

    // Get the next interval days
    getNextInterval: function(count) {
      if (count >= EBBINGHAUS_INTERVALS.length) return null;
      return EBBINGHAUS_INTERVALS[count];
    },

    // Calculate the schedule for a word
    getSchedule: function(reviewCount) {
      var schedule = [];
      var today = VocabStorage.getToday();
      var currentDate = VocabStorage.addDays(today, 1); // first review tomorrow

      for (var i = 0; i < Math.min(reviewCount + 3, EBBINGHAUS_INTERVALS.length); i++) {
        schedule.push({
          count: i + 1,
          date: currentDate,
          interval: EBBINGHAUS_INTERVALS[i],
          name: EBBINGHAUS_NAMES[i]
        });
        currentDate = VocabStorage.addDays(currentDate, EBBINGHAUS_INTERVALS[i]);
      }

      return schedule;
    },

    // Clean up text for display
    sanitize: function(text) {
      if (!text) return '';
      var div = document.createElement('div');
      div.textContent = text;
      return div.innerHTML;
    }
  };
})();