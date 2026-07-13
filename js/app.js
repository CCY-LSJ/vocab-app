/* app.js - 主应用逻辑 */
(function() {
  'use strict';

  var $ = function(id) { return document.getElementById(id); };

  // ===== DOM REFS =====
  var tabBtns = document.querySelectorAll('.tab-btn');
  var tabContents = document.querySelectorAll('.tab-content');

  // Capture tab
  var modeBtns = document.querySelectorAll('.mode-btn');
  var cameraContainer = $('camera-container');
  var cameraVideo = $('camera-video');
  var cameraCanvas = $('camera-canvas');
  var fixedOverlay = $('fixed-range-overlay');
  var rangeBox = $('range-box');
  var btnCapture = $('btn-capture');
  var btnUpload = $('btn-upload');
  var btnSwitchCamera = $('btn-switch-camera');
  var fileInput = $('file-input');
  var resultPanel = $('result-panel');
  var resultImage = $('result-image');
  var resultList = $('result-list');
  var resultStatus = $('result-status');
  var btnSelectAll = $('btn-select-all');
  var btnClearAll = $('btn-clear-all');
  var btnRecapture = $('btn-recapture');
  var btnSaveWords = $('btn-save-words');
  var saveCount = $('save-count');
  // New elements
  var rawTextSection = $('raw-text-section');
  var rawTextList = $('raw-text-list');
  var btnToggleRaw = $('btn-toggle-raw');
  var manualAddInput = $('manual-add-input');
  var btnManualAddWord = $('btn-manual-add-word');

  // Wordlist tab
  var wordList = $('word-list');
  var wordlistCount = $('wordlist-count');
  var searchInput = $('search-input');
  var filterBtns = document.querySelectorAll('.filter-btn');
  var btnManualAdd = $('btn-manual-add');

  // Review tab
  var reviewStats = $('review-stats');
  var reviewSubtitle = $('review-subtitle');
  var statTotal = $('stat-total');
  var statDone = $('stat-done');
  var statStreak = $('stat-streak');
  var reviewEmpty = $('review-empty');
  var reviewEmptyMsg = $('review-empty-msg');
  var flashcardContainer = $('flashcard-container');
  var reviewControls = $('review-controls');
  var reviewProgressBar = $('review-progress-bar');
  var reviewProgressFill = $('review-progress-fill');
  var reviewComplete = $('review-complete');
  var reviewCompleteStats = $('review-complete-stats');
  var btnKnow = $('btn-know');
  var btnForgot = $('btn-forgot');
  var btnBackWordlist = $('btn-back-wordlist');
  var reviewBadge = $('review-badge');

  // Settings tab
  var btnExport = $('btn-export');
  var btnImport = $('btn-import');
  var importFile = $('import-file');
  var btnClearAll = $('btn-clear-all');

  // Modal & Toast
  var modalOverlay = $('modal-overlay');
  var modalContent = $('modal-content');
  var toast = $('toast');

  // ===== STATE =====
  var currentTab = 'capture';
  var captureMode = 'full';
  var currentStream = null;
  var facingMode = 'environment';
  var currentImageData = null;
  var currentOcrResults = [];
  var currentReviewQueue = [];
  var currentReviewIndex = 0;
  var reviewDoneCount = 0;
  var reviewForgotCount = 0;
  var currentFilter = 'all';

  // ===== UTILS =====
  function showToast(msg, duration) {
    toast.textContent = msg;
    toast.style.display = 'block';
    clearTimeout(toast._timeout);
    toast._timeout = setTimeout(function() { toast.style.display = 'none'; }, duration || 2000);
  }

  function showModal(html) {
    modalContent.innerHTML = html;
    modalOverlay.style.display = 'flex';
  }

  function closeModal() { modalOverlay.style.display = 'none'; }

  modalOverlay.addEventListener('click', function(e) {
    if (e.target === modalOverlay) closeModal();
  });

  function escapeHtml(str) {
    var div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  // ===== TAB NAVIGATION =====
  function switchTab(tab) {
    currentTab = tab;
    tabBtns.forEach(function(btn) { btn.classList.toggle('active', btn.dataset.tab === tab); });
    tabContents.forEach(function(s) { s.classList.toggle('active', s.id === 'tab-' + tab); });
    if (tab === 'capture') startCamera();
    else if (tab === 'wordlist') { stopCamera(); renderWordList(); }
    else if (tab === 'review') { stopCamera(); loadReview(); }
    else { stopCamera(); }
  }

  tabBtns.forEach(function(btn) { btn.addEventListener('click', function() { switchTab(btn.dataset.tab); }); });

  // ===== CAMERA =====
  function startCamera() {
    if (currentStream) return;
    var constraints = { video: { facingMode: facingMode, width: { ideal: 1920 }, height: { ideal: 1440 } }, audio: false };
    navigator.mediaDevices.getUserMedia(constraints).then(function(stream) {
      currentStream = stream;
      cameraVideo.srcObject = stream;
      cameraVideo.style.display = 'block';
      var fb = document.getElementById('camera-fallback');
      if (fb) fb.style.display = 'none';
    }).catch(function(err) {
      cameraVideo.style.display = 'none';
      var fb = document.getElementById('camera-fallback');
      if (!fb) {
        fb = document.createElement('div');
        fb.id = 'camera-fallback';
        fb.style.cssText = 'position:absolute;top:0;left:0;right:0;bottom:0;display:flex;flex-direction:column;align-items:center;justify-content:center;background:#1a1a2e;color:#fff;padding:20px;text-align:center;';
        fb.innerHTML = '<div style="font-size:2.5rem;margin-bottom:12px;">📷</div>' +
          '<div style="font-size:1rem;font-weight:700;margin-bottom:6px;">摄像头不可用</div>' +
          '<div style="font-size:0.78rem;color:#aaa;margin-bottom:4px;">' + (location.protocol === 'http:' ? 'iOS 需要 HTTPS 才能使用摄像头' : '请检查浏览器摄像头权限') + '</div>' +
          '<div style="font-size:0.78rem;color:#aaa;margin-bottom:16px;">请使用下方按钮从相册选择图片</div>' +
          '<button id="fb-upload-btn" style="background:#D4783B;color:#fff;border:none;padding:12px 32px;border-radius:8px;font-size:0.9rem;font-weight:600;cursor:pointer;">🖼️ 从相册选择</button>';
        cameraContainer.appendChild(fb);
        fb.querySelector('#fb-upload-btn').addEventListener('click', function() { fileInput.click(); });
      }
      fb.style.display = 'flex';
    });
  }

  function stopCamera() {
    if (currentStream) { currentStream.getTracks().forEach(function(t) { t.stop(); }); currentStream = null; }
    cameraVideo.srcObject = null;
  }

  btnSwitchCamera.addEventListener('click', function() { stopCamera(); facingMode = facingMode === 'environment' ? 'user' : 'environment'; startCamera(); });

  modeBtns.forEach(function(btn) {
    btn.addEventListener('click', function() {
      modeBtns.forEach(function(b) { b.classList.remove('active'); });
      btn.classList.add('active');
      captureMode = btn.dataset.mode;
      fixedOverlay.style.display = captureMode === 'fixed' ? 'block' : 'none';
    });
  });

  // Fixed range box dragging - keep existing code
  (function() {
    var dragging = false, resizing = false, resizeHandle = null;
    var startX, startY, startLeft, startTop, startWidth, startHeight;
    function getPos(e) {
      var touch = e.touches ? e.touches[0] : e;
      var rect = cameraContainer.getBoundingClientRect();
      return { x: touch.clientX - rect.left, y: touch.clientY - rect.top, w: rect.width, h: rect.height };
    }
    rangeBox.addEventListener('touchstart', function(e) {
      if (e.target.classList.contains('range-handle')) { resizing = true; resizeHandle = e.target.className.replace('range-handle ', ''); }
      else { dragging = true; }
      var pos = getPos(e);
      startX = pos.x; startY = pos.y;
      var boxRect = rangeBox.getBoundingClientRect();
      var containerRect = cameraContainer.getBoundingClientRect();
      startLeft = boxRect.left - containerRect.left; startTop = boxRect.top - containerRect.top;
      startWidth = boxRect.width; startHeight = boxRect.height;
      e.preventDefault();
    });
    document.addEventListener('touchmove', function(e) {
      if (!dragging && !resizing) return;
      var pos = getPos(e);
      var dx = pos.x - startX, dy = pos.y - startY;
      if (resizing && resizeHandle) {
        var nl = startLeft, nt = startTop, nw = startWidth, nh = startHeight;
        switch (resizeHandle) {
          case 'tl': nl = startLeft + dx; nt = startTop + dy; nw = startWidth - dx; nh = startHeight - dy; break;
          case 'tr': nt = startTop + dy; nw = startWidth + dx; nh = startHeight - dy; break;
          case 'bl': nl = startLeft + dx; nw = startWidth - dx; nh = startHeight + dy; break;
          case 'br': nw = startWidth + dx; nh = startHeight + dy; break;
        }
        nw = Math.max(60, Math.min(nw, pos.w - nl)); nh = Math.max(20, Math.min(nh, pos.h - nt));
        rangeBox.style.left = nl + 'px'; rangeBox.style.top = nt + 'px'; rangeBox.style.width = nw + 'px'; rangeBox.style.height = nh + 'px';
      } else if (dragging) {
        var nl = startLeft + dx, nt = startTop + dy;
        nl = Math.max(0, Math.min(nl, pos.w - startWidth)); nt = Math.max(0, Math.min(nt, pos.h - startHeight));
        rangeBox.style.left = nl + 'px'; rangeBox.style.top = nt + 'px';
      }
      e.preventDefault();
    });
    document.addEventListener('touchend', function() { dragging = false; resizing = false; resizeHandle = null; });
  })();

  btnCapture.addEventListener('click', function() { captureImage(); });
  btnUpload.addEventListener('click', function() { fileInput.click(); });
  fileInput.addEventListener('change', function(e) {
    if (e.target.files.length > 0) {
      var file = e.target.files[0];
      var reader = new FileReader();
      reader.onload = function(ev) { processImageData(ev.target.result); };
      reader.readAsDataURL(file);
      fileInput.value = '';
    }
  });

  function captureImage() {
    if (!currentStream) { showToast('摄像头不可用，请使用相册上传'); return; }
    var video = cameraVideo, canvas = cameraCanvas;
    canvas.width = video.videoWidth; canvas.height = video.videoHeight;
    var ctx = canvas.getContext('2d');
    ctx.drawImage(video, 0, 0);
    if (captureMode === 'fixed') {
      var containerRect = cameraContainer.getBoundingClientRect();
      var boxRect = rangeBox.getBoundingClientRect();
      var scaleX = canvas.width / containerRect.width, scaleY = canvas.height / containerRect.height;
      processImageData(canvas.toDataURL('image/jpeg', 0.85), {
        x: (boxRect.left - containerRect.left) * scaleX,
        y: (boxRect.top - containerRect.top) * scaleY,
        w: boxRect.width * scaleX,
        h: boxRect.height * scaleY,
      });
    } else {
      processImageData(canvas.toDataURL('image/jpeg', 0.85));
    }
  }

  function processImageData(dataUrl, rangeRect) {
    currentImageData = dataUrl;
    resultPanel.style.display = 'block';
    resultImage.src = dataUrl;
    resultList.innerHTML = '';
    resultStatus.style.display = 'flex';
    resultStatus.innerHTML = '<div class="loading-spinner"></div><span id="ocr-progress">正在加载OCR引擎...</span>';
    saveCount.textContent = '0';
    rawTextSection.style.display = 'none';
    manualAddInput.value = '';

    var img = new Image();
    img.onload = function() {
      var promise = rangeRect
        ? VocabOCR.processFixedRange(img, rangeRect)
        : VocabOCR.processFullImage(img);

      promise.then(function(words) {
        resultStatus.style.display = 'none';
        currentOcrResults = words.map(function(w) {
          var allWords = VocabStorage.getAllWords();
          var existing = allWords.find(function(ew) { return ew.word.toLowerCase() === w.word.toLowerCase(); });
          return {
            word: w.word,
            meaning: w.meaning || '',
            selected: w.selected && !existing,
            existing: !!existing,
            inDict: w.inDict || false,
          };
        });

        // Show raw text
        var rawTexts = VocabOCR.getLastRawTexts ? VocabOCR.getLastRawTexts() : [];
        if (rawTexts.length > 0) {
          rawTextSection.style.display = 'block';
          rawTextList.textContent = rawTexts.join('\n');
          rawTextList.style.display = 'none';
          btnToggleRaw.textContent = '展开';
        }

        if (currentOcrResults.length === 0) {
          resultList.innerHTML = '<div class="empty-state"><p style="color:#999;">未识别到英文单词</p><p class="empty-hint">请确保图片清晰、光线充足<br>也可以展开"识别原文"手动输入单词</p></div>';
          // Still show raw text if available
          if (rawTexts.length > 0) {
            rawTextSection.style.display = 'block';
            rawTextList.textContent = rawTexts.join('\n');
            rawTextList.style.display = 'block';
            btnToggleRaw.textContent = '收起';
          }
        } else {
          renderOcrResults();
        }
      }).catch(function(err) {
        resultStatus.style.display = 'none';
        resultList.innerHTML = '<div class="empty-state"><p style="color:#D32F2F;">识别失败</p><p class="empty-hint">' +
          escapeHtml(err.message || '网络错误') + '</p><p class="empty-hint">提示：请检查网络连接后重试</p></div>';
      });
    };
    img.src = dataUrl;
  }

  // Toggle raw text
  btnToggleRaw.addEventListener('click', function() {
    var isVisible = rawTextList.style.display !== 'none';
    rawTextList.style.display = isVisible ? 'none' : 'block';
    btnToggleRaw.textContent = isVisible ? '展开' : '收起';
  });

  // Manual add word in OCR results
  btnManualAddWord.addEventListener('click', function() {
    var word = manualAddInput.value.trim();
    if (!word) { showToast('请输入单词'); return; }
    // Validate
    if (!/^[a-zA-Z][a-zA-Z\s-]*[a-zA-Z]$/.test(word)) { showToast('请输入有效英文单词'); return; }
    // Check duplicate
    var exists = currentOcrResults.some(function(w) { return w.word.toLowerCase() === word.toLowerCase(); });
    if (exists) { showToast('该单词已在列表中'); return; }
    currentOcrResults.unshift({ word: word, meaning: '', selected: true, existing: false, inDict: false, isManual: true });
    manualAddInput.value = '';
    renderOcrResults();
    showToast('已添加: ' + word);
  });

  manualAddInput.addEventListener('keydown', function(e) {
    if (e.key === 'Enter') { btnManualAddWord.click(); }
  });

  function renderOcrResults() {
    resultList.innerHTML = '';
    var selectedCount = 0;

    currentOcrResults.forEach(function(item, idx) {
      var div = document.createElement('div');
      div.className = 'word-item';
      var tagClass = item.existing ? 'existing' : (item.inDict ? 'has-meaning' : 'no-meaning');
      var tagText = item.existing ? '已收录' : (item.inDict ? '词典' : '待查');
      if (item.isManual) { tagClass = 'has-meaning'; tagText = '手动'; }

      div.innerHTML = '<input type="checkbox" ' + (item.selected ? 'checked' : '') +
        (item.existing ? ' disabled' : '') + ' data-idx="' + idx + '">' +
        '<span class="word-text">' + escapeHtml(item.word) + '</span>' +
        (item.meaning ? '<span class="word-meaning">' + escapeHtml(item.meaning) + '</span>' : '') +
        '<span class="word-tag ' + tagClass + '">' + tagText + '</span>' +
        '<button class="btn-text" data-idx="' + idx + '" style="font-size:0.65rem;padding:2px 4px;color:#999;margin-left:4px;" title="删除此单词">✕</button>';

      if (item.selected && !item.existing) selectedCount++;

      // Click word text → toggle checkbox
      div.addEventListener('click', function(e) {
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'BUTTON') return;
        var cb = div.querySelector('input[type="checkbox"]');
        if (!cb.disabled) { cb.checked = !cb.checked; currentOcrResults[idx].selected = cb.checked; updateSaveCount(); }
      });

      // Delete button
      var delBtn = div.querySelector('button');
      delBtn.addEventListener('click', function(e) {
        e.stopPropagation();
        currentOcrResults.splice(idx, 1);
        renderOcrResults();
      });

      resultList.appendChild(div);
    });

    // Long-press to edit word
    var wordSpans = resultList.querySelectorAll('.word-text');
    wordSpans.forEach(function(span, i) {
      var idx = (function() {
        var cb = span.parentElement.querySelector('input');
        return parseInt(cb ? cb.dataset.idx : i);
      })();
      span.addEventListener('contextmenu', function(e) { e.preventDefault(); });
      span.addEventListener('dblclick', function() {
        editWordInline(span, idx);
      });
      span.style.cursor = 'text';
      span.title = '双击编辑单词';
    });

    updateSaveCount();
  }

  function editWordInline(span, idx) {
    var oldWord = currentOcrResults[idx].word;
    var input = document.createElement('input');
    input.type = 'text';
    input.value = oldWord;
    input.style.cssText = 'font-weight:600;font-size:0.9rem;border:1px solid #2B5797;border-radius:4px;padding:2px 6px;width:150px;outline:none;';
    span.parentElement.replaceChild(input, span);
    input.focus();
    input.select();

    function finish() {
      var newWord = input.value.trim();
      if (newWord && /^[a-zA-Z][a-zA-Z-]*[a-zA-Z]$/.test(newWord)) {
        currentOcrResults[idx].word = newWord;
        currentOcrResults[idx].isManual = true;
        renderOcrResults();
      } else {
        renderOcrResults();
      }
    }

    input.addEventListener('blur', finish);
    input.addEventListener('keydown', function(e) { if (e.key === 'Enter') { input.blur(); } });
  }

  function updateSaveCount() {
    var count = currentOcrResults.filter(function(w) { return w.selected && !w.existing; }).length;
    saveCount.textContent = count;
  }

  btnSelectAll.addEventListener('click', function() {
    currentOcrResults.forEach(function(w) { if (!w.existing) w.selected = true; });
    renderOcrResults();
  });

  btnClearAll.addEventListener('click', function() {
    currentOcrResults.forEach(function(w) { w.selected = false; });
    renderOcrResults();
  });

  btnSaveWords.addEventListener('click', function() {
    var toSave = currentOcrResults.filter(function(w) { return w.selected && !w.existing; });
    if (toSave.length === 0) { showToast('请至少选择一个单词'); return; }
    var needLookup = toSave.filter(function(w) { return !w.meaning; });
    var lookupPromises = needLookup.map(function(w) {
      return VocabDict.lookup(w.word).then(function(meaning) { w.meaning = meaning || ''; return w; });
    });
    Promise.all(lookupPromises).then(function() {
      var added = VocabStorage.addWords(toSave);
      showToast('已录入 ' + added.length + ' 个生词');
      resultPanel.style.display = 'none';
      currentOcrResults = [];
      updateBadge();
    });
  });

  btnRecapture.addEventListener('click', function() {
    resultPanel.style.display = 'none';
    currentOcrResults = [];
  });

  // ===== WORD LIST =====
  function renderWordList() {
    var words;
    var query = searchInput.value.trim().toLowerCase();
    if (query) words = VocabStorage.searchWords(query);
    else if (currentFilter === 'all') words = VocabStorage.getAllWords();
    else words = VocabStorage.getWordsByStatus(currentFilter);
    wordlistCount.textContent = '共 ' + words.length + ' 个单词';

    if (words.length === 0) {
      wordList.innerHTML = '<div class="empty-state"><div class="empty-icon">📖</div>' +
        '<p>' + (query ? '没有找到匹配的单词' : '还没有生词') + '</p>' +
        '<p class="empty-hint">去"拍照取词"录入你的第一个生词吧</p></div>';
      return;
    }
    wordList.innerHTML = '';
    words.forEach(function(w) {
      var card = document.createElement('div');
      card.className = 'word-card';
      var statusName = { new: '新学', learning: '学习中', mastered: '已掌握' }[w.status] || w.status;
      var nextReview = w.nextReviewDate ? '下次复习：' + w.nextReviewDate : '';
      card.innerHTML = '<div class="wc-info">' +
        '<div class="wc-word">' + escapeHtml(w.word) + '</div>' +
        '<div class="wc-meaning">' + escapeHtml(w.meaning) + '</div>' +
        '<div class="wc-meta">' + nextReview + (nextReview ? ' · ' : '') + '第' + (w.reviewCount + 1) + '轮</div></div>' +
        '<span class="wc-status ' + w.status + '">' + statusName + '</span>';
      card.addEventListener('click', function() { showWordDetail(w); });
      wordList.appendChild(card);
    });
  }

  searchInput.addEventListener('input', function() { renderWordList(); });
  filterBtns.forEach(function(btn) {
    btn.addEventListener('click', function() {
      filterBtns.forEach(function(b) { b.classList.remove('active'); });
      btn.classList.add('active');
      currentFilter = btn.dataset.filter;
      renderWordList();
    });
  });

  btnManualAdd.addEventListener('click', function() {
    showModal('<h3>手动添加单词</h3>' +
      '<input type="text" id="modal-word" placeholder="输入英文单词...">' +
      '<textarea id="modal-meaning" placeholder="输入中文释义..."></textarea>' +
      '<button class="btn btn-primary btn-full" id="modal-lookup">自动查询释义</button>' +
      '<button class="btn btn-primary btn-full" id="modal-save" style="margin-top:6px;">确认添加</button>' +
      '<button class="btn btn-secondary btn-full" id="modal-cancel" style="margin-top:6px;">取消</button>');
    var modalWord = $('modal-word');
    var modalMeaning = $('modal-meaning');
    $('modal-lookup').addEventListener('click', function() {
      var word = modalWord.value.trim();
      if (!word) { showToast('请输入单词'); return; }
      VocabDict.lookup(word).then(function(meaning) { modalMeaning.value = meaning || '未找到释义，请手动输入'; });
    });
    $('modal-save').addEventListener('click', function() {
      var word = modalWord.value.trim(), meaning = modalMeaning.value.trim();
      if (!word) { showToast('请输入单词'); return; }
      if (!meaning) { showToast('请输入释义'); return; }
      var result = VocabStorage.addWord(word, meaning, 'manual');
      if (result) { showToast('已添加：' + word); closeModal(); renderWordList(); updateBadge(); }
      else { showToast('该单词已在生词本中'); }
    });
    $('modal-cancel').addEventListener('click', closeModal);
  });

  function showWordDetail(w) {
    showModal('<h3>' + escapeHtml(w.word) + '</h3>' +
      '<p style="color:#888;margin-bottom:10px;">' + escapeHtml(w.meaning) + '</p>' +
      '<p style="font-size:0.8rem;color:#999;">状态：' + ({ new: '新学', learning: '学习中', mastered: '已掌握' }[w.status]) +
      ' · 复习次数：' + (w.reviewCount + 1) + '轮' + (w.nextReviewDate ? ' · 下次复习：' + w.nextReviewDate : '') +
      '<br>录入日期：' + w.createdAt + '</p>' +
      '<button class="btn btn-secondary btn-full" id="modal-edit" style="margin-top:10px;">编辑释义</button>' +
      '<button class="btn btn-danger btn-full" id="modal-delete" style="margin-top:6px;">删除单词</button>' +
      '<button class="btn btn-secondary btn-full" id="modal-cancel" style="margin-top:6px;">关闭</button>');
    $('modal-edit').addEventListener('click', function() {
      closeModal();
      showModal('<h3>编辑 ' + escapeHtml(w.word) + '</h3>' +
        '<textarea id="modal-edit-meaning" style="min-height:80px;">' + escapeHtml(w.meaning) + '</textarea>' +
        '<button class="btn btn-primary btn-full" id="modal-edit-save">保存</button>' +
        '<button class="btn btn-secondary btn-full" id="modal-edit-cancel" style="margin-top:6px;">取消</button>');
      $('modal-edit-save').addEventListener('click', function() {
        VocabStorage.updateWord(w.id, { meaning: $('modal-edit-meaning').value.trim() });
        showToast('已更新'); closeModal(); renderWordList();
      });
      $('modal-edit-cancel').addEventListener('click', function() { closeModal(); showWordDetail(w); });
    });
    $('modal-delete').addEventListener('click', function() {
      if (confirm('确定删除 "' + w.word + '" 吗？')) {
        VocabStorage.deleteWord(w.id); showToast('已删除'); closeModal(); renderWordList(); updateBadge();
      }
    });
    $('modal-cancel').addEventListener('click', closeModal);
  }

  // ===== REVIEW =====
  function loadReview() {
    reviewComplete.style.display = 'none';
    flashcardContainer.innerHTML = '';
    reviewControls.style.display = 'none';
    reviewProgressBar.style.display = 'none';
    reviewEmpty.style.display = 'none';
    currentReviewQueue = VocabStorage.getReviewQueue();
    currentReviewIndex = 0;
    reviewDoneCount = 0;
    reviewForgotCount = 0;
    if (currentReviewQueue.length === 0) {
      reviewEmpty.style.display = 'block';
      reviewEmptyMsg.textContent = '今天没有需要复习的单词';
      reviewStats.style.display = 'none';
      reviewSubtitle.textContent = '';
      return;
    }
    reviewStats.style.display = 'flex';
    reviewSubtitle.textContent = '今日待复习 ' + currentReviewQueue.length + ' 个单词';
    statTotal.textContent = currentReviewQueue.length;
    statDone.textContent = '0';
    var streak = VocabStorage.getStreak();
    statStreak.textContent = streak.count || 0;
    reviewProgressBar.style.display = 'block';
    reviewProgressFill.style.width = '0%';
    showFlashcard();
  }

  function showFlashcard() {
    if (currentReviewIndex >= currentReviewQueue.length) { showReviewComplete(); return; }
    var w = currentReviewQueue[currentReviewIndex];
    flashcardContainer.innerHTML = '';
    var card = document.createElement('div');
    card.className = 'flashcard';
    card.innerHTML = '<div class="flashcard-inner">' +
      '<div class="flashcard-face flashcard-front"><div class="flashcard-word">' + escapeHtml(w.word) + '</div><div class="flashcard-hint">点击翻转查看释义</div></div>' +
      '<div class="flashcard-face flashcard-back"><div class="flashcard-meaning">' + escapeHtml(w.meaning) + '</div><div class="flashcard-review-count">' + VocabReview.getIntervalName(w.reviewCount) + '复习</div></div></div>';
    card.addEventListener('click', function() { card.classList.toggle('flipped'); });
    flashcardContainer.appendChild(card);
    reviewControls.style.display = 'flex';
    var progress = (currentReviewIndex / currentReviewQueue.length) * 100;
    reviewProgressFill.style.width = progress + '%';
    statDone.textContent = currentReviewIndex;
  }

  function doReview(known) {
    var w = currentReviewQueue[currentReviewIndex];
    VocabStorage.markReview(w.id, known);
    if (known) reviewDoneCount++; else reviewForgotCount++;
    currentReviewIndex++;
    showFlashcard();
    if (currentReviewIndex >= currentReviewQueue.length) { VocabStorage.updateStreak(); updateBadge(); showReviewComplete(); }
  }

  btnKnow.addEventListener('click', function() { doReview(true); });
  btnForgot.addEventListener('click', function() { doReview(false); });

  function showReviewComplete() {
    flashcardContainer.innerHTML = '';
    reviewControls.style.display = 'none';
    reviewProgressFill.style.width = '100%';
    statDone.textContent = currentReviewQueue.length;
    reviewComplete.style.display = 'block';
    reviewCompleteStats.textContent = '认识 ' + reviewDoneCount + ' 个，不认识 ' + reviewForgotCount + ' 个';
    reviewBadge.style.display = 'none';
  }

  btnBackWordlist.addEventListener('click', function() { switchTab('wordlist'); });

  // ===== SETTINGS =====
  function loadSettings() {}
  btnExport.addEventListener('click', function() {
    var data = VocabStorage.exportData();
    var blob = new Blob([data], { type: 'application/json' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a'); a.href = url; a.download = 'vocab-backup-' + VocabStorage.getToday() + '.json'; a.click();
    URL.revokeObjectURL(url); showToast('导出成功');
  });
  btnImport.addEventListener('click', function() { importFile.click(); });
  importFile.addEventListener('change', function(e) {
    if (e.target.files.length > 0) {
      var file = e.target.files[0];
      var reader = new FileReader();
      reader.onload = function(ev) {
        try { var count = VocabStorage.importData(ev.target.result); showToast('成功导入 ' + count + ' 个新单词'); updateBadge(); }
        catch (err) { showToast(err.message); }
      };
      reader.readAsText(file); importFile.value = '';
    }
  });
  btnClearAll.addEventListener('click', function() {
    if (confirm('确定要清空所有生词数据吗？此操作不可恢复！\n建议先导出一份备份。')) {
      VocabStorage.clearAll(); showToast('所有数据已清空'); updateBadge(); if (currentTab === 'wordlist') renderWordList();
    }
  });

  // ===== BADGE =====
  function updateBadge() {
    var queue = VocabStorage.getReviewQueue();
    if (queue.length > 0) { reviewBadge.textContent = queue.length; reviewBadge.style.display = 'inline'; }
    else { reviewBadge.style.display = 'none'; }
  }

  // ===== INIT =====
  updateBadge();
  VocabOCR.preload().catch(function(err) { console.log('OCR preload deferred:', err.message); });
  switchTab('capture');
  document.addEventListener('visibilitychange', function() {
    if (document.hidden && currentTab === 'capture') stopCamera();
    else if (!document.hidden && currentTab === 'capture') startCamera();
  });
})();
