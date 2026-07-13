/* ocr.js - Baidu OCR via CORS proxy */
(function() {
  'use strict';

  var state = 'ready';
  var accessToken = null;
  var tokenExpiry = 0;

  var API_KEY = 'UIvmY7Qbb5HDpjl4t1yCO6H6';
  var SECRET_KEY = 'r7ARzJbV60FyKtvGeE7jzJ7RJCAeYWiY';

  // CORS proxy - makes cross-origin requests possible
  var CORS_PROXY = 'https://corsproxy.io/?';

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
    updateStatus('百度 OCR 就绪');
    return Promise.resolve();
  }

  // Get Baidu access_token (cached for 29 days)
  function getAccessToken() {
    if (accessToken && Date.now() < tokenExpiry) {
      return Promise.resolve(accessToken);
    }

    updateStatus('正在获取授权...');

    var url = CORS_PROXY + encodeURIComponent(
      'https://aip.baidubce.com/oauth/2.0/token?grant_type=client_credentials' +
      '&client_id=' + API_KEY +
      '&client_secret=' + SECRET_KEY
    );

    return fetch(url).then(function(r) {
      return r.json();
    }).then(function(data) {
      if (data.access_token) {
        accessToken = data.access_token;
        tokenExpiry = Date.now() + (29 * 24 * 60 * 60 * 1000);
        return accessToken;
      }
      throw new Error('获取授权失败：' + (data.error_description || JSON.stringify(data)));
    });
  }

  // Convert image to base64
  function imageToBase64(imageElement) {
    var canvas = document.createElement('canvas');
    canvas.width = imageElement.naturalWidth || imageElement.width;
    canvas.height = imageElement.naturalHeight || imageElement.height;
    var ctx = canvas.getContext('2d');
    ctx.drawImage(imageElement, 0, 0);
    return canvas.toDataURL('image/jpeg', 0.75);
  }

  // Call Baidu OCR
  function doOCR(imageElement) {
    updateStatus('正在上传图片...');

    var imageData = imageToBase64(imageElement);
    var cleanBase64 = imageData.replace(/^data:image\/\w+;base64,/, '');

    return getAccessToken().then(function(token) {
      updateStatus('正在识别文字...');

      var formData = new URLSearchParams();
      formData.append('access_token', token);
      formData.append('image', cleanBase64);
      formData.append('language_type', 'CHN_ENG');
      formData.append('detect_direction', 'false');
      formData.append('paragraph', 'false');
      formData.append('probability', 'false');

      var proxyUrl = CORS_PROXY + encodeURIComponent(
        'https://aip.baidubce.com/rest/2.0/ocr/v1/accurate_basic'
      );

      return fetch(proxyUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: formData.toString()
      });
    }).then(function(r) {
      return r.json();
    }).then(function(result) {
      if (result.error_code) {
        throw new Error(result.error_msg || '识别失败');
      }
      updateStatus('识别完成');
      return parseResults(result);
    }).catch(function(err) {
      updateStatus('识别失败：' + (err.message || '网络错误'), true);
      throw err;
    });
  }

  // Parse Baidu OCR results into word list
  function parseResults(ocrResult) {
    var words = [];
    var seen = {};

    if (!ocrResult.words_result || !Array.isArray(ocrResult.words_result)) {
      return words;
    }

    ocrResult.words_result.forEach(function(item) {
      var text = (item.words || '').trim();
      if (!text) return;

      var tokens = text.split(/[\s,.;:!?()\[\]{}""''<>\/\\|@#$%^&*+=~`\u3000-\u303F\u2000-\u206F]+/);

      tokens.forEach(function(token) {
        token = token.trim();
        if (token.length < 2 || !/^[a-zA-Z][a-zA-Z-]*[a-zA-Z]$/.test(token)) return;

        var lower = token.toLowerCase();
        if (seen[lower]) return;

        if (isLikelyWord(token)) {
          seen[lower] = true;
          words.push({
            word: token,
            meaning: detectAdjacentChinese(token, text),
            selected: true
          });
        }
      });
    });

    return words;
  }

  function isLikelyWord(word) {
    var lower = word.toLowerCase();
    var shortWords = 'a,an,the,is,am,are,was,were,be,been,being,have,has,had,do,does,did,will,would,can,could,may,might,must,i,me,my,we,us,our,you,he,she,it,they,him,her,his,its,their,this,that,these,those,no,not,yes,if,so,or,and,but,yet,for,nor,to,in,on,at,by,of,from,with,as,up,out,off,go,get,put,set,let,run,use,say';
    if (shortWords.split(',').indexOf(lower) >= 0) return true;
    if (word.length < 3) return false;
    if (word.length <= 4 && /^[A-Z]+$/.test(word)) return false;
    if (word.length <= 3 && /[a-z][A-Z]/.test(word)) return false;
    if (word.length >= 4 && !/[aeiou]/i.test(word)) return false;
    if (/[bcdfghjklmnpqrstvwxyz]{4}/i.test(word)) return false;
    return true;
  }

  function detectAdjacentChinese(word, fullText) {
    var idx = fullText.toLowerCase().indexOf(word.toLowerCase());
    if (idx === -1) return '';
    var after = fullText.substring(idx + word.length, idx + word.length + 100);
    var m = after.match(/[\u4e00-\u9fff\u3400-\u4dbf]{2,30}/);
    if (m) return m[0].trim();
    var before = fullText.substring(Math.max(0, idx - 50), idx);
    var m2 = before.match(/[\u4e00-\u9fff\u3400-\u4dbf]{2,30}/);
    if (m2) return m2[m2.length - 1].trim();
    return '';
  }

  function getState() { return state; }

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