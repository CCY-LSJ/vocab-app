/* ocr.js - Tesseract.js OCR with preloading */
(function() {
  'use strict';

  var worker = null;
  var state = 'idle'; // idle | loading | ready | error
  var pendingResolvers = [];
  var pendingRejecters = [];

  function updateStatus(msg, isError) {
    // Update the banner at top of page
    var banner = document.getElementById('ocr-engine-banner');
    var statusEl = document.getElementById('ocr-engine-status');
    if (banner && statusEl) {
      statusEl.textContent = msg;
      if (isError) {
        banner.style.background = '#FFEBEE';
        banner.style.color = '#C62828';
      } else if (state === 'ready') {
        banner.style.background = '#E8F5E9';
        banner.style.color = '#2E7D32';
        // Auto-hide after 3 seconds
        setTimeout(function() {
          banner.style.display = 'none';
        }, 3000);
      } else {
        banner.style.background = '#FFF3E0';
        banner.style.color = '#E65100';
      }
      banner.style.display = 'block';
    }
    // Also update the progress text in result panel
    var progressEl = document.getElementById('ocr-progress');
    if (progressEl) {
      progressEl.textContent = msg;
    }
  }

  function resolveAll() {
    var resolvers = pendingResolvers;
    pendingResolvers = [];
    pendingRejecters = [];
    resolvers.forEach(function(r) { r(worker); });
  }

  function rejectAll(err) {
    var rejecters = pendingRejecters;
    pendingResolvers = [];
    pendingRejecters = [];
    rejecters.forEach(function(r) { r(err); });
  }

  // Preload the OCR engine - call this at app startup
  function preload() {
    if (state === 'ready') {
      return Promise.resolve(worker);
    }
    if (state === 'loading') {
      return new Promise(function(resolve, reject) {
        pendingResolvers.push(resolve);
        pendingRejecters.push(reject);
      });
    }
    if (state === 'error') {
      // Retry on error
      state = 'idle';
    }

    state = 'loading';
    updateStatus('正在加载 OCR 引擎...');

    // Create worker with SIMD for better performance
    try {
      worker = Tesseract.createWorker('eng', 1, {
        logger: function(m) {
          if (m.status === 'loading tesseract core') {
            updateStatus('加载核心引擎 (' + Math.round((m.progress || 0) * 100) + '%)');
          } else if (m.status === 'initializing tesseract') {
            updateStatus('初始化引擎...');
          } else if (m.status === 'loading language traineddata') {
            updateStatus('下载英文语言包 (' + Math.round((m.progress || 0) * 100) + '%)');
          } else if (m.status === 'initializing api') {
            updateStatus('初始化 API...');
          } else if (m.status === 'recognizing text') {
            updateStatus('识别中... ' + Math.round((m.progress || 0) * 100) + '%');
          }
        }
      });
    } catch (e) {
      state = 'error';
      updateStatus('OCR 引擎初始化失败', true);
      rejectAll(e);
      return Promise.reject(e);
    }

    return worker.then(function(w) {
      worker = w;
      state = 'ready';
      updateStatus('OCR 引擎就绪');
      resolveAll();
      return w;
    }).catch(function(err) {
      console.error('OCR preload error:', err);
      state = 'error';
      updateStatus('OCR 加载失败，请检查网络后刷新页面', true);
      worker = null;
      rejectAll(err);
      throw err;
    });
  }

  // Extract words from OCR text
  function extractWords(text) {
    if (!text) return [];

    var wordItems = [];
    var tokens = text.split(/[\s,.;:!?()\[\]{}""''<>\/\\|@#$%^&*+=~`\u3000-\u303F\u2000-\u206F]+/);

    var seen = {};
    tokens.forEach(function(token) {
      token = token.trim();
      if (token.length >= 2 && /^[a-zA-Z][a-zA-Z-]*[a-zA-Z]$/.test(token)) {
        var lower = token.toLowerCase();
        if (!seen[lower]) {
          seen[lower] = true;
          wordItems.push({
            word: token,
            meaning: detectAdjacentChinese(token, text),
            selected: true
          });
        }
      }
    });

    return wordItems;
  }

  function detectAdjacentChinese(word, fullText) {
    var idx = fullText.toLowerCase().indexOf(word.toLowerCase());
    if (idx === -1) return '';

    var after = fullText.substring(idx + word.length, idx + word.length + 100);
    var chineseMatch = after.match(/[\u4e00-\u9fff\u3400-\u4dbf]{2,30}/);
    if (chineseMatch) return chineseMatch[0].trim();

    var before = fullText.substring(Math.max(0, idx - 50), idx);
    var chineseBefore = before.match(/[\u4e00-\u9fff\u3400-\u4dbf]{2,30}/);
    if (chineseBefore) return chineseBefore[chineseBefore.length - 1].trim();

    return '';
  }

  function imageToInput(imageElement) {
    var canvas = document.createElement('canvas');
    canvas.width = imageElement.naturalWidth || imageElement.width;
    canvas.height = imageElement.naturalHeight || imageElement.height;
    var ctx = canvas.getContext('2d');
    ctx.drawImage(imageElement, 0, 0);
    return canvas;
  }

  // Main OCR - now uses preloaded worker
  function doOCR(imageElement) {
    var input = imageToInput(imageElement);

    // Ensure worker is preloaded
    return preload().then(function(w) {
      return w.recognize(input);
    }).then(function(result) {
      return extractWords(result.data.text);
    });
  }

  function getState() {
    return state;
  }

  function terminateWorker() {
    if (worker && state === 'ready') {
      try { worker.terminate(); } catch(e) {}
      worker = null;
    }
    state = 'idle';
    pendingResolvers = [];
    pendingRejecters = [];
  }

  window.VocabOCR = {
    preload: preload,
    getState: getState,
    processFullImage: function(imageElement) {
      return doOCR(imageElement);
    },
    processFixedRange: function(imageElement, rangeRect) {
      var canvas = document.createElement('canvas');
      var imgW = imageElement.naturalWidth || imageElement.width;
      var imgH = imageElement.naturalHeight || imageElement.height;
      canvas.width = imgW;
      canvas.height = imgH;
      var ctx = canvas.getContext('2d');
      ctx.drawImage(imageElement, 0, 0);

      var scaleX = canvas.width / imageElement.width;
      var scaleY = canvas.height / imageElement.height;
      var x = rangeRect.x * scaleX;
      var y = rangeRect.y * scaleY;
      var w = rangeRect.w * scaleX;
      var h = rangeRect.h * scaleY;

      var padding = 30;
      x = Math.max(0, x - padding);
      y = Math.max(0, y - padding);
      w = Math.min(canvas.width - x, w + padding * 2);
      h = Math.min(canvas.height - y, h + padding * 2);

      var cropCanvas = document.createElement('canvas');
      cropCanvas.width = w;
      cropCanvas.height = h;
      var cropCtx = cropCanvas.getContext('2d');
      cropCtx.drawImage(canvas, x, y, w, h, 0, 0, w, h);

      return doOCR(cropCanvas);
    },
    extractWords: extractWords,
    terminate: terminateWorker
  };
})();