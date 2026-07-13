/* ocr.js - Tesseract.js 浏览器端 OCR 识别 */
(function() {
  'use strict';

  var worker = null;
  var workerReady = false;

  // Initialize Tesseract worker (lazy, called once)
  function initWorker() {
    if (workerReady) return Promise.resolve(worker);
    if (worker) return worker;

    worker = Tesseract.createWorker('eng', 1, {
      logger: function(m) {
        if (m.status === 'recognizing text') {
          var el = document.getElementById('ocr-progress');
          if (el) {
            el.textContent = '识别中... ' + Math.round(m.progress * 100) + '%';
          }
        }
      }
    });

    return worker.then(function(w) {
      worker = w;
      workerReady = true;
      return w;
    });
  }

  // Extract words from OCR text
  function extractWords(text) {
    if (!text) return [];

    var wordItems = [];
    // Split by whitespace and punctuation
    var tokens = text.split(/[\s,.;:!?()\[\]{}""''<>\/\\|@#$%^&*+=~`\u3000-\u303F\u2000-\u206F]+/);

    var seen = {};
    tokens.forEach(function(token) {
      token = token.trim();
      // Only keep English words (2+ characters, pure letters)
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

  // Try to detect Chinese meaning adjacent to the word
  function detectAdjacentChinese(word, fullText) {
    var idx = fullText.toLowerCase().indexOf(word.toLowerCase());
    if (idx === -1) return '';

    // Look after the word
    var after = fullText.substring(idx + word.length, idx + word.length + 100);
    var chineseMatch = after.match(/[\u4e00-\u9fff\u3400-\u4dbf]{2,30}/);
    if (chineseMatch) return chineseMatch[0].trim();

    // Look before
    var before = fullText.substring(Math.max(0, idx - 50), idx);
    var chineseBefore = before.match(/[\u4e00-\u9fff\u3400-\u4dbf]{2,30}/);
    if (chineseBefore) return chineseBefore[chineseBefore.length - 1].trim();

    return '';
  }

  // Convert image element to something Tesseract can use
  function imageToInput(imageElement) {
    var canvas = document.createElement('canvas');
    canvas.width = imageElement.naturalWidth || imageElement.width;
    canvas.height = imageElement.naturalHeight || imageElement.height;
    var ctx = canvas.getContext('2d');
    ctx.drawImage(imageElement, 0, 0);
    return canvas;
  }

  // Main OCR
  function doOCR(imageElement) {
    var input = imageToInput(imageElement);
    return initWorker().then(function(w) {
      return w.recognize(input);
    }).then(function(result) {
      return extractWords(result.data.text);
    });
  }

  // Cleanup
  function terminateWorker() {
    if (worker && workerReady) {
      worker.terminate();
      worker = null;
      workerReady = false;
    }
  }

  window.VocabOCR = {
    processFullImage: function(imageElement) {
      return doOCR(imageElement);
    },

    processFixedRange: function(imageElement, rangeRect) {
      // Crop the image to the range area
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