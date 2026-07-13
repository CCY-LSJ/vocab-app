/* ocr.js - Baidu OCR via local proxy (no CORS issues) */
(function() {
  'use strict';

  var state = 'ready';
  function updateStatus(msg, isError) {
    var banner = document.getElementById('ocr-engine-banner');
    var statusEl = document.getElementById('ocr-engine-status');
    if (banner && statusEl) {
      statusEl.textContent = msg;
      if (isError) {
        banner.style.background = '#FFEBEE'; banner.style.color = '#C62828';
      } else {
        banner.style.background = '#E8F5E9'; banner.style.color = '#2E7D32';
        setTimeout(function() { banner.style.display = 'none'; }, 3000);
      }
      banner.style.display = 'block';
    }
    var progressEl = document.getElementById('ocr-progress');
    if (progressEl) progressEl.textContent = msg;
  }

  function preload() {
    updateStatus('OCR 服务就绪');
    return Promise.resolve();
  }

  function imageToBase64(imageElement) {
    var canvas = document.createElement('canvas');
    var maxW = 1200, maxH = 1600;
    var w = imageElement.naturalWidth || imageElement.width;
    var h = imageElement.naturalHeight || imageElement.height;
    if (w > maxW || h > maxH) {
      var ratio = Math.min(maxW / w, maxH / h);
      canvas.width = Math.round(w * ratio);
      canvas.height = Math.round(h * ratio);
    } else {
      canvas.width = w; canvas.height = h;
    }
    var ctx = canvas.getContext('2d');
    ctx.drawImage(imageElement, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL('image/jpeg', 0.7);
  }

  function doOCR(imageElement) {
    updateStatus('正在上传图片...');
    var imageData = imageToBase64(imageElement);
    updateStatus('正在识别文字...');

    return fetch('/api/ocr', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ image: imageData })
    }).then(function(r) {
      return r.json();
    }).then(function(result) {
      if (result.error) throw new Error(result.error);
      if (result.success && result.words) {
        updateStatus('识别完成，共 ' + result.words.length + ' 个单词');
        return result.words;
      }
      return [];
    }).catch(function(err) {
      updateStatus('识别失败：' + (err.message || '网络错误'), true);
      throw err;
    });
  }

  function getState() { return state; }

  window.VocabOCR = {
    preload: preload,
    getState: getState,
    processFullImage: function(imageElement) { return doOCR(imageElement); },
    processFixedRange: function(imageElement, rangeRect) {
      var canvas = document.createElement('canvas');
      var imgW = imageElement.naturalWidth || imageElement.width;
      var imgH = imageElement.naturalHeight || imageElement.height;
      canvas.width = imgW; canvas.height = imgH;
      var ctx = canvas.getContext('2d');
      ctx.drawImage(imageElement, 0, 0);
      var scaleX = canvas.width / imageElement.width;
      var scaleY = canvas.height / imageElement.height;
      var x = rangeRect.x * scaleX, y = rangeRect.y * scaleY;
      var w = rangeRect.w * scaleX, h = rangeRect.h * scaleY;
      var padding = 30;
      x = Math.max(0, x - padding); y = Math.max(0, y - padding);
      w = Math.min(canvas.width - x, w + padding * 2);
      h = Math.min(canvas.height - y, h + padding * 2);
      var cropCanvas = document.createElement('canvas');
      cropCanvas.width = w; cropCanvas.height = h;
      var cropCtx = cropCanvas.getContext('2d');
      cropCtx.drawImage(canvas, x, y, w, h, 0, 0, w, h);
      return doOCR(cropCanvas);
    },
    terminate: function() {}
  };
})();