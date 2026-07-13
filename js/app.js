/* app.js - 主应用逻辑 */
(function() {
  'use strict';

  // ===== DOM REFS =====
  var $ = function(id) { return document.getElementById(id); };

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
  var captureMode = 'full'; // 'full' | 'fixed'
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

  function closeModal() {
    modalOverlay.style.display = 'none';
  }

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
    tabBtns.forEach(function(btn) {
      btn.classList.toggle('active', btn.dataset.tab === tab);
    });
    tabContents.forEach(function(section) {
      section.classList.toggle('active', section.id === 'tab-' + tab);
    });

    if (tab === 'capture') {
      startCamera();
    } else if (tab === 'wordlist') {
      stopCamera();
      renderWordList();
    } else if (tab === 'review') {
      stopCamera();
      loadReview();
    } else if (tab === 'settings') {
      stopCamera();
      loadSettings();
    }
  }

  tabBtns.forEach(function(btn) {
    btn.addEventListener('click', function() {
      switchTab(btn.dataset.tab);
    });
  });

  // ===== CAMERA =====
  function startCamera() {
    if (currentStream) return; // already running

    var constraints = {
      video: { facingMode: facingMode, width: { ideal: 1920 }, height: { ideal: 1440 } },
      audio: false
    };

    navigator.mediaDevices.getUserMedia(constraints).then(function(stream) {
      currentStream = stream;
      cameraVideo.srcObject = stream;
      cameraVideo.style.display = 'block';
      // Hide fallback if previously shown
      var fb = document.getElementById('camera-fallback');
      if (fb) fb.style.display = 'none';
    }).catch(function(err) {
      console.log('Camera error:', err);
      cameraVideo.style.display = 'none';
      // Show fallback UI
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
        fb.querySelector('#fb-upload-btn').addEventListener('click', function() {
          fileInput.click();
        });
      }
      fb.style.display = 'flex';
    });
  }

  function stopCamera() {
    if (currentStream) {
      currentStream.getTracks().forEach(function(track) { track.stop(); });
      currentStream = null;
    }
    cameraVideo.srcObject = null;
  }

  // Switch camera
  btnSwitchCamera.addEventListener('click', function() {
    stopCamera();
    facingMode = facingMode === 'environment' ? 'user' : 'environment';
    startCamera();
  });

  // Capture mode toggle
  modeBtns.forEach(function(btn) {
    btn.addEventListener('click', function() {
      modeBtns.forEach(function(b) { b.classList.remove('active'); });
      btn.classList.add('active');
      captureMode = btn.dataset.mode;
      fixedOverlay.style.display = captureMode === 'fixed' ? 'block' : 'none';
    });
  });

  // Fixed range box dragging
  (function() {
    var dragging = false;
    var resizing = false;
    var resizeHandle = null;
    var startX, startY, startLeft, startTop, startWidth, startHeight;

    function getPos(e) {
      var touch = e.touches ? e.touches[0] : e;
      var rect = cameraContainer.getBoundingClientRect();
      return {
        x: touch.clientX - rect.left,
        y: touch.clientY - rect.top,
        w: rect.width,
        h: rect.height
      };
    }

    rangeBox.addEventListener('touchstart', function(e) {
      if (e.target.classList.contains('range-handle')) {
        resizing = true;
        resizeHandle = e.target.className.replace('range-handle ', '');
      } else {
        dragging = true;
      }
      var pos = getPos(e);
      startX = pos.x;
      startY = pos.y;
      var boxRect = rangeBox.getBoundingClientRect();
      var containerRect = cameraContainer.getBoundingClientRect();
      startLeft = boxRect.left - containerRect.left;
      startTop = boxRect.top - containerRect.top;
      startWidth = boxRect.width;
      startHeight = boxRect.height;
      e.preventDefault();
    });

    document.addEventListener('touchmove', function(e) {
      if (!dragging && !resizing) return;
      var pos = getPos(e);
      var dx = pos.x - startX;
      var dy = pos.y - startY;

      if (resizing && resizeHandle) {
        var newLeft = startLeft, newTop = startTop, newW = startWidth, newH = startHeight;
        switch (resizeHandle) {
          case 'tl': newLeft = startLeft + dx; newTop = startTop + dy; newW = startWidth - dx; newH = startHeight - dy; break;
          case 'tr': newTop = startTop + dy; newW = startWidth + dx; newH = startHeight - dy; break;
          case 'bl': newLeft = startLeft + dx; newW = startWidth - dx; newH = startHeight + dy; break;
          case 'br': newW = startWidth + dx; newH = startHeight + dy; break;
        }
        // Constrain
        newW = Math.max(60, Math.min(newW, pos.w - newLeft));
        newH = Math.max(20, Math.min(newH, pos.h - newTop));
        rangeBox.style.left = newLeft + 'px';
        rangeBox.style.top = newTop + 'px';
        rangeBox.style.width = newW + 'px';
        rangeBox.style.height = newH + 'px';
      } else if (dragging) {
        var newLeft = startLeft + dx;
        var newTop = startTop + dy;
        newLeft = Math.max(0, Math.min(newLeft, pos.w - startWidth));
        newTop = Math.max(0, Math.min(newTop, pos.h - startHeight));
        rangeBox.style.left = newLeft + 'px';
        rangeBox.style.top = newTop + 'px';
      }
      e.preventDefault();
    });

    document.addEventListener('touchend', function() {
      dragging = false;
      resizing = false;
      resizeHandle = null;
    });
  })();

  // Capture button
  btnCapture.addEventListener('click', function() {
    captureImage();
  });

  // Upload button
  btnUpload.addEventListener('click', function() {
    fileInput.click();
  });

  fileInput.addEventListener('change', function(e) {
    if (e.target.files.length > 0) {
      var file = e.target.files[0];
      var reader = new FileReader();
      reader.onload = function(ev) {
        processImageData(ev.target.result);
      };
      reader.readAsDataURL(file);
      fileInput.value = '';
    }
  });

  function captureImage() {
    if (!currentStream) {
      showToast('摄像头不可用，请使用相册上传');
      return;
    }

    var video = cameraVideo;
    var canvas = cameraCanvas;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    var ctx = canvas.getContext('2d');
    ctx.drawImage(video, 0, 0);

    if (captureMode === 'fixed') {
      // Get range box position relative to video
      var containerRect = cameraContainer.getBoundingClientRect();
      var boxRect = rangeBox.getBoundingClientRect();
      var scaleX = canvas.width / containerRect.width;
      var scaleY = canvas.height / containerRect.height;

      var rangeRect = {
        x: (boxRect.left - containerRect.left) * scaleX,
        y: (boxRect.top - containerRect.top) * scaleY,
        w: boxRect.width * scaleX,
        h: boxRect.height * scaleY
      };

      processImageData(canvas.toDataURL('image/jpeg', 0.85), rangeRect);
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

    var img = new Image();
    img.onload = function() {
      var promise;
      if (rangeRect) {
        var scaleX = img.naturalWidth / img.width;
        var scaleY = img.naturalHeight / img.height;
        var scaledRect = {
          x: rangeRect.x * scaleX,
          y: rangeRect.y * scaleY,
          w: rangeRect.w * scaleX,
          h: rangeRect.h * scaleY
        };
        promise = VocabOCR.processFixedRange(img, scaledRect);
      } else {
        promise = VocabOCR.processFullImage(img);
      }

      promise.then(function(words) {
        resultStatus.style.display = 'none';
        currentOcrResults = words.map(function(w) {
          // Check if already in word list
          var allWords = VocabStorage.getAllWords();
          var existing = allWords.find(function(ew) {
            return ew.word.toLowerCase() === w.word.toLowerCase();
          });
          return {
            word: w.word,
            meaning: w.meaning || '',
            selected: w.selected && !existing,
            existing: !!existing,
            noMeaning: !w.meaning
          };
        });

        // If no words found, try mock
        if (currentOcrResults.length === 0) {
          showNoWordsResult();
          return;
        }

        renderOcrResults();
      }).catch(function(err) {
        resultStatus.style.display = 'none';
        resultList.innerHTML = '<div class="empty-state"><p style="color:#D32F2F;">识别失败</p><p class="empty-hint">' +
          escapeHtml(err.message) + '</p><p class="empty-hint" style="margin-top:8px;">提示：请确保图片清晰、光线充足<br>OCR引擎首次加载可能需要几秒</p></div>';
      });
    };
    img.src = dataUrl;
  }

  function showNoWordsResult() {
    resultStatus.style.display = 'none';
    resultList.innerHTML = '<div class="empty-state"><p>未识别到英文单词</p><p class="empty-hint">请确保图片清晰、光线充足，英文占主要部分</p></div>';
  }

  function renderOcrResults() {
    resultList.innerHTML = '';
    var selectedCount = 0;

    currentOcrResults.forEach(function(item, idx) {
      var div = document.createElement('div');
      div.className = 'word-item';
      div.innerHTML = '<input type="checkbox" ' + (item.selected ? 'checked' : '') +
        (item.existing ? ' disabled' : '') + ' data-idx="' + idx + '">' +
        '<span class="word-text">' + escapeHtml(item.word) + '</span>' +
        (item.meaning ? '<span class="word-meaning">' + escapeHtml(item.meaning) + '</span>' : '') +
        (item.existing ? '<span class="word-tag existing">已收录</span>' :
         item.noMeaning ? '<span class="word-tag no-meaning">待补充</span>' :
         '<span class="word-tag has-meaning">有释义</span>');

      if (item.selected && !item.existing) selectedCount++;
      div.addEventListener('click', function(e) {
        if (e.target.tagName === 'INPUT') return;
        var cb = div.querySelector('input[type="checkbox"]');
        if (!cb.disabled) {
          cb.checked = !cb.checked;
          currentOcrResults[idx].selected = cb.checked;
          updateSaveCount();
        }
      });
      resultList.appendChild(div);
    });

    updateSaveCount();
  }

  function updateSaveCount() {
    var count = currentOcrResults.filter(function(w) { return w.selected && !w.existing; }).length;
    saveCount.textContent = count;
  }

  // Select all / clear all
  btnSelectAll.addEventListener('click', function() {
    currentOcrResults.forEach(function(w) {
      if (!w.existing) w.selected = true;
    });
    renderOcrResults();
  });

  btnClearAll.addEventListener('click', function() {
    currentOcrResults.forEach(function(w) { w.selected = false; });
    renderOcrResults();
  });

  // Save words
  btnSaveWords.addEventListener('click', function() {
    var toSave = currentOcrResults.filter(function(w) { return w.selected && !w.existing; });
    if (toSave.length === 0) {
      showToast('请至少选择一个单词');
      return;
    }

    // Look up meanings for words without one
    var needLookup = toSave.filter(function(w) { return !w.meaning; });
    var lookupPromises = needLookup.map(function(w) {
      return VocabDict.lookup(w.word).then(function(meaning) {
        w.meaning = meaning || '';
        return w;
      });
    });

    Promise.all(lookupPromises).then(function() {
      var added = VocabStorage.addWords(toSave);
      showToast('已录入 ' + added.length + ' 个生词');
      resultPanel.style.display = 'none';
      currentOcrResults = [];
      updateBadge();
    });
  });

  // Re-capture
  btnRecapture.addEventListener('click', function() {
    resultPanel.style.display = 'none';
    currentOcrResults = [];
  });

  // ===== WORD LIST =====
  function renderWordList() {
    var words;
    var query = searchInput.value.trim().toLowerCase();

    if (query) {
      words = VocabStorage.searchWords(query);
    } else if (currentFilter === 'all') {
      words = VocabStorage.getAllWords();
    } else {
      words = VocabStorage.getWordsByStatus(currentFilter);
    }

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
      var statusClass = w.status;
      var statusName = { new: '新学', learning: '学习中', mastered: '已掌握' }[w.status] || w.status;
      var nextReview = w.nextReviewDate ? '下次复习：' + w.nextReviewDate : '';
      card.innerHTML = '<div class="wc-info">' +
        '<div class="wc-word">' + escapeHtml(w.word) + '</div>' +
        '<div class="wc-meaning">' + escapeHtml(w.meaning) + '</div>' +
        '<div class="wc-meta">' + nextReview + (nextReview ? ' · ' : '') + '第' + (w.reviewCount + 1) + '轮</div>' +
        '</div>' +
        '<span class="wc-status ' + statusClass + '">' + statusName + '</span>';

      card.addEventListener('click', function() {
        showWordDetail(w);
      });
      wordList.appendChild(card);
    });
  }

  searchInput.addEventListener('input', function() {
    renderWordList();
  });

  filterBtns.forEach(function(btn) {
    btn.addEventListener('click', function() {
      filterBtns.forEach(function(b) { b.classList.remove('active'); });
      btn.classList.add('active');
      currentFilter = btn.dataset.filter;
      renderWordList();
    });
  });

  // Manual add
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
      VocabDict.lookup(word).then(function(meaning) {
        modalMeaning.value = meaning || '未找到释义，请手动输入';
      });
    });

    $('modal-save').addEventListener('click', function() {
      var word = modalWord.value.trim();
      var meaning = modalMeaning.value.trim();
      if (!word) { showToast('请输入单词'); return; }
      if (!meaning) { showToast('请输入释义'); return; }
      var result = VocabStorage.addWord(word, meaning, 'manual');
      if (result) {
        showToast('已添加：' + word);
        closeModal();
        renderWordList();
        updateBadge();
      } else {
        showToast('该单词已在生词本中');
      }
    });

    $('modal-cancel').addEventListener('click', closeModal);
  });

  function showWordDetail(w) {
    showModal('<h3>' + escapeHtml(w.word) + '</h3>' +
      '<p style="color:#888;margin-bottom:10px;">' + escapeHtml(w.meaning) + '</p>' +
      '<p style="font-size:0.8rem;color:#999;">状态：' +
      ({ new: '新学', learning: '学习中', mastered: '已掌握' }[w.status]) +
      ' · 复习次数：' + (w.reviewCount + 1) + '轮' +
      (w.nextReviewDate ? ' · 下次复习：' + w.nextReviewDate : '') +
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
        showToast('已更新');
        closeModal();
        renderWordList();
      });
      $('modal-edit-cancel').addEventListener('click', function() {
        closeModal();
        showWordDetail(w);
      });
    });

    $('modal-delete').addEventListener('click', function() {
      if (confirm('确定删除 "' + w.word + '" 吗？')) {
        VocabStorage.deleteWord(w.id);
        showToast('已删除');
        closeModal();
        renderWordList();
        updateBadge();
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
    if (currentReviewIndex >= currentReviewQueue.length) {
      showReviewComplete();
      return;
    }

    var w = currentReviewQueue[currentReviewIndex];
    flashcardContainer.innerHTML = '';

    var card = document.createElement('div');
    card.className = 'flashcard';
    card.innerHTML = '<div class="flashcard-inner">' +
      '<div class="flashcard-face flashcard-front">' +
      '<div class="flashcard-word">' + escapeHtml(w.word) + '</div>' +
      '<div class="flashcard-hint">点击翻转查看释义</div>' +
      '</div>' +
      '<div class="flashcard-face flashcard-back">' +
      '<div class="flashcard-meaning">' + escapeHtml(w.meaning) + '</div>' +
      '<div class="flashcard-review-count">' + VocabReview.getIntervalName(w.reviewCount) + '复习</div>' +
      '</div>' +
      '</div>';

    card.addEventListener('click', function() {
      card.classList.toggle('flipped');
    });

    flashcardContainer.appendChild(card);
    reviewControls.style.display = 'flex';

    // Update progress
    var progress = (currentReviewIndex / currentReviewQueue.length) * 100;
    reviewProgressFill.style.width = progress + '%';
    statDone.textContent = currentReviewIndex;
  }

  function doReview(known) {
    var w = currentReviewQueue[currentReviewIndex];
    VocabStorage.markReview(w.id, known);

    if (known) {
      reviewDoneCount++;
    } else {
      reviewForgotCount++;
    }

    currentReviewIndex++;
    showFlashcard();

    if (currentReviewIndex >= currentReviewQueue.length) {
      // Update streak
      VocabStorage.updateStreak();
      updateBadge();
      showReviewComplete();
    }
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

  btnBackWordlist.addEventListener('click', function() {
    switchTab('wordlist');
  });

  // ===== SETTINGS =====
  function loadSettings() {
    // No settings to load currently - Tesseract.js is built-in
  }

  btnExport.addEventListener('click', function() {
    var data = VocabStorage.exportData();
    var blob = new Blob([data], { type: 'application/json' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = 'vocab-backup-' + VocabStorage.getToday() + '.json';
    a.click();
    URL.revokeObjectURL(url);
    showToast('导出成功');
  });

  btnImport.addEventListener('click', function() {
    importFile.click();
  });

  importFile.addEventListener('change', function(e) {
    if (e.target.files.length > 0) {
      var file = e.target.files[0];
      var reader = new FileReader();
      reader.onload = function(ev) {
        try {
          var count = VocabStorage.importData(ev.target.result);
          showToast('成功导入 ' + count + ' 个新单词');
          updateBadge();
        } catch (err) {
          showToast(err.message);
        }
      };
      reader.readAsText(file);
      importFile.value = '';
    }
  });

  btnClearAll.addEventListener('click', function() {
    if (confirm('确定要清空所有生词数据吗？此操作不可恢复！\n建议先导出一份备份。')) {
      VocabStorage.clearAll();
      showToast('所有数据已清空');
      updateBadge();
      if (currentTab === 'wordlist') renderWordList();
    }
  });

  // ===== BADGE =====
  function updateBadge() {
    var queue = VocabStorage.getReviewQueue();
    if (queue.length > 0) {
      reviewBadge.textContent = queue.length;
      reviewBadge.style.display = 'inline';
    } else {
      reviewBadge.style.display = 'none';
    }
  }

  // ===== INIT =====
  updateBadge();
  switchTab('capture');

  // Handle page visibility (stop camera when hidden)
  document.addEventListener('visibilitychange', function() {
    if (document.hidden && currentTab === 'capture') {
      stopCamera();
    } else if (!document.hidden && currentTab === 'capture') {
      startCamera();
    }
  });

})();