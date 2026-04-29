(function () {
  'use strict';

  var ocrToggle = document.getElementById('ocrToggle');
  var ocrModal = document.getElementById('ocrModal');
  var ocrAccept = document.getElementById('ocrAccept');
  var ocrDecline = document.getElementById('ocrDecline');
  var ocrToolbar = document.getElementById('ocrToolbar');
  var ocrProgress = document.getElementById('ocrProgress');
  var ocrProgressFill = document.getElementById('ocrProgressFill');
  var ocrProgressText = document.getElementById('ocrProgressText');
  var ocrStatus = document.getElementById('ocrStatus');
  var ocrSelectRegion = document.getElementById('ocrSelectRegion');
  var ocrFullPage = document.getElementById('ocrFullPage');
  var ocrRemove = document.getElementById('ocrRemove');
  var ocrCanvas = document.getElementById('ocrCanvas');
  var ocrQualitySel = document.getElementById('ocrQuality');
  var ocrQualityModal = document.getElementById('ocrQualityModal');
  var ocrQualityOk = document.getElementById('ocrQualityOk');
  var ocrQualityDismiss = document.getElementById('ocrQualityDismiss');
  var editor = document.getElementById('transcriptionEditor');
  var workbench = document.querySelector('.workbench');

  if (!ocrToggle || !workbench) return;

  var sermonId = workbench.getAttribute('data-sermon-id');
  var ocrPdfUrl = '/admin/proxy-pdf/' + sermonId;
  var worker = null;
  var engineReady = false;
  var selecting = false;
  var startX, startY;
  var renderedPageCanvas = null;
  var currentScale = 2;
  var pendingScaleChange = null;

  var wasLoaded = localStorage.getItem('ocr_engine_loaded') === 'true';

  // Restore saved quality preference
  var savedQuality = localStorage.getItem('ocr_quality');
  if (savedQuality && ocrQualitySel) {
    ocrQualitySel.value = savedQuality;
    currentScale = parseFloat(savedQuality);
  }

  // --- Toggle button ---
  // If previously loaded, auto-init on page load (toolbar will show permanently)
  if (wasLoaded) {
    initOCR();
  }

  ocrToggle.addEventListener('click', function () {
    if (engineReady) return; // toolbar is already showing
    if (wasLoaded) { initOCR(); return; }
    ocrModal.hidden = false;
    ocrAccept.focus();
  });

  // --- Consent modal ---
  ocrDecline.addEventListener('click', function () { ocrModal.hidden = true; });
  ocrAccept.addEventListener('click', function () { ocrModal.hidden = true; initOCR(); });
  ocrModal.querySelector('.ocr-modal__backdrop').addEventListener('click', function () { ocrModal.hidden = true; });

  // --- Quality selector ---
  ocrQualitySel.addEventListener('change', function () {
    var newScale = parseFloat(this.value);
    var dismissed = localStorage.getItem('ocr_quality_warning_dismissed') === 'true';

    if (!dismissed && newScale !== 2) {
      pendingScaleChange = newScale;
      ocrQualityModal.hidden = false;
      ocrQualityOk.focus();
    } else {
      applyQualityChange(newScale);
    }
  });

  ocrQualityOk.addEventListener('click', function () {
    if (ocrQualityDismiss.checked) {
      localStorage.setItem('ocr_quality_warning_dismissed', 'true');
    }
    ocrQualityModal.hidden = true;
    if (pendingScaleChange !== null) {
      applyQualityChange(pendingScaleChange);
      pendingScaleChange = null;
    }
  });

  ocrQualityModal.querySelector('.ocr-modal__backdrop').addEventListener('click', function () {
    ocrQualityModal.hidden = true;
    // Revert the select to current scale
    ocrQualitySel.value = String(currentScale);
    pendingScaleChange = null;
  });

  function applyQualityChange(newScale) {
    currentScale = newScale;
    localStorage.setItem('ocr_quality', String(newScale));
    if (engineReady) {
      renderPdfPage(1);
    }
  }

  // --- Initialize Tesseract + pdf.js ---
  function initOCR() {
    ocrProgress.hidden = false;
    ocrToggle.disabled = true;
    ocrToggle.textContent = 'Loading OCR...';
    ocrProgressText.textContent = 'Loading libraries...';
    ocrProgressFill.style.width = '10%';

    loadScript('https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js', function () {
      loadScript('https://cdn.jsdelivr.net/npm/pdfjs-dist@4.4.168/build/pdf.min.mjs', function () {
        ocrProgressText.textContent = 'Initializing OCR engine...';
        ocrProgressFill.style.width = '30%';
        pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdn.jsdelivr.net/npm/pdfjs-dist@4.4.168/build/pdf.worker.min.mjs';

        Tesseract.createWorker('eng', 1, {
          logger: function (m) {
            if (m.status === 'loading tesseract core') {
              ocrProgressText.textContent = 'Loading OCR core...';
              ocrProgressFill.style.width = '40%';
            } else if (m.status === 'loading language traineddata') {
              ocrProgressText.textContent = 'Downloading language data...';
              ocrProgressFill.style.width = '60%';
            } else if (m.status === 'initializing api') {
              ocrProgressText.textContent = 'Almost ready...';
              ocrProgressFill.style.width = '90%';
            }
          },
        }).then(function (w) {
          worker = w;
          engineReady = true;
          localStorage.setItem('ocr_engine_loaded', 'true');
          ocrProgress.hidden = true;
          ocrToolbar.hidden = false;
          ocrToggle.hidden = true; // Hide the download button, toolbar is now permanent
          renderPdfPage(1);
        }).catch(function (err) {
          console.error('OCR init failed:', err);
          ocrProgressText.textContent = 'Failed to load OCR engine.';
          ocrToggle.textContent = 'OCR Assist';
          ocrToggle.disabled = false;
        });
      });
    });
  }

  // --- Render PDF page to canvas with grayscale + contrast preprocessing ---
  function renderPdfPage(pageNum) {
    ocrStatus.textContent = 'Rendering page at ' + currentScale + 'x...';
    pdfjsLib.getDocument(ocrPdfUrl).promise.then(function (pdf) {
      return pdf.getPage(pageNum);
    }).then(function (page) {
      var viewport = page.getViewport({ scale: currentScale });
      var canvas = document.createElement('canvas');
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      var ctx = canvas.getContext('2d');
      return page.render({ canvasContext: ctx, viewport: viewport }).promise.then(function () {
        // Preprocess: convert to grayscale and boost contrast
        var imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        var data = imageData.data;
        for (var i = 0; i < data.length; i += 4) {
          // Grayscale using luminance weights
          var gray = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
          // Contrast boost: stretch toward black or white
          gray = gray < 128 ? gray * 0.7 : 255 - (255 - gray) * 0.7;
          data[i] = data[i + 1] = data[i + 2] = gray;
        }
        ctx.putImageData(imageData, 0, 0);
        renderedPageCanvas = canvas;
        ocrStatus.textContent = 'Ready (' + currentScale + 'x)';
      });
    }).catch(function (err) {
      console.error('PDF render error:', err);
      ocrStatus.textContent = 'Failed to render PDF';
    });
  }

  // --- Load external script ---
  function loadScript(src, cb) {
    if (src.includes('tesseract') && window.Tesseract) return cb();
    if (src.includes('pdfjs') && window.pdfjsLib) return cb();
    var s = document.createElement('script');
    s.src = src;
    if (src.endsWith('.mjs')) s.type = 'module';
    s.onload = cb;
    s.onerror = function () { ocrProgressText.textContent = 'Failed to download library.'; };
    document.head.appendChild(s);
  }

  // --- Full page OCR ---
  ocrFullPage.addEventListener('click', function () {
    if (!engineReady || !worker || !renderedPageCanvas) {
      ocrStatus.textContent = 'PDF not ready yet...';
      return;
    }
    ocrStatus.textContent = 'Processing full page...';
    ocrFullPage.disabled = true;
    worker.recognize(renderedPageCanvas).then(function (result) {
      insertAtCursor(result.data.text);
      ocrStatus.textContent = 'Done — text inserted';
      ocrFullPage.disabled = false;
      setTimeout(function () { ocrStatus.textContent = 'Ready (' + currentScale + 'x)'; }, 3000);
    }).catch(function (err) {
      console.error('OCR error:', err);
      ocrStatus.textContent = 'OCR failed';
      ocrFullPage.disabled = false;
    });
  });

  // --- Region selection ---
  ocrSelectRegion.addEventListener('click', function () {
    if (!engineReady || !renderedPageCanvas) {
      ocrStatus.textContent = 'PDF not ready yet...';
      return;
    }
    if (selecting) { cancelSelection(); return; }
    selecting = true;
    ocrSelectRegion.textContent = 'Cancel Selection';
    ocrStatus.textContent = 'Draw a rectangle on the PDF';
    ocrCanvas.hidden = false;
    sizeCanvas();
    ocrCanvas.style.cursor = 'crosshair';
  });

  function cancelSelection() {
    selecting = false;
    ocrSelectRegion.textContent = 'Select Region';
    ocrStatus.textContent = 'Ready (' + currentScale + 'x)';
    ocrCanvas.hidden = true;
    var ctx = ocrCanvas.getContext('2d');
    ctx.clearRect(0, 0, ocrCanvas.width, ocrCanvas.height);
  }

  function sizeCanvas() {
    var container = ocrCanvas.parentElement;
    ocrCanvas.width = container.clientWidth;
    ocrCanvas.height = container.clientHeight;
  }

  ocrCanvas.addEventListener('mousedown', function (e) {
    if (!selecting) return;
    var rect = ocrCanvas.getBoundingClientRect();
    startX = e.clientX - rect.left;
    startY = e.clientY - rect.top;

    function onMove(e2) {
      var ctx = ocrCanvas.getContext('2d');
      var curX = e2.clientX - rect.left;
      var curY = e2.clientY - rect.top;
      ctx.clearRect(0, 0, ocrCanvas.width, ocrCanvas.height);
      ctx.strokeStyle = '#EAAA00';
      ctx.lineWidth = 2;
      ctx.setLineDash([6, 3]);
      ctx.fillStyle = 'rgba(234, 170, 0, 0.15)';
      ctx.beginPath();
      ctx.rect(startX, startY, curX - startX, curY - startY);
      ctx.fill();
      ctx.stroke();
    }

    function onUp(e2) {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
      var endX = e2.clientX - rect.left;
      var endY = e2.clientY - rect.top;
      var x = Math.min(startX, endX);
      var y = Math.min(startY, endY);
      var w = Math.abs(endX - startX);
      var h = Math.abs(endY - startY);
      if (w < 10 || h < 10) { cancelSelection(); return; }
      processRegion(x, y, w, h);
    }

    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  });

  function processRegion(x, y, w, h) {
    ocrStatus.textContent = 'Reading selected region...';
    ocrSelectRegion.disabled = true;
    var cw = ocrCanvas.width;
    var ch = ocrCanvas.height;
    var pw = renderedPageCanvas.width;
    var ph = renderedPageCanvas.height;
    var cropX = Math.round((x / cw) * pw);
    var cropY = Math.round((y / ch) * ph);
    var cropW = Math.round((w / cw) * pw);
    var cropH = Math.round((h / ch) * ph);

    var regionCanvas = document.createElement('canvas');
    regionCanvas.width = cropW;
    regionCanvas.height = cropH;
    var ctx = regionCanvas.getContext('2d');
    ctx.drawImage(renderedPageCanvas, cropX, cropY, cropW, cropH, 0, 0, cropW, cropH);

    worker.recognize(regionCanvas).then(function (result) {
      insertAtCursor(result.data.text);
      ocrStatus.textContent = 'Done — text inserted';
      cancelSelection();
      ocrSelectRegion.disabled = false;
      setTimeout(function () { ocrStatus.textContent = 'Ready (' + currentScale + 'x)'; }, 3000);
    }).catch(function (err) {
      console.error('Region OCR error:', err);
      ocrStatus.textContent = 'Region OCR failed';
      cancelSelection();
      ocrSelectRegion.disabled = false;
    });
  }

  // --- Insert text at cursor ---
  function insertAtCursor(text) {
    if (!text || !text.trim()) return;
    editor.focus();
    var start = editor.selectionStart;
    var end = editor.selectionEnd;
    var val = editor.value;
    editor.value = val.substring(0, start) + text + val.substring(end);
    editor.selectionStart = editor.selectionEnd = start + text.length;
    editor.dispatchEvent(new Event('input', { bubbles: true }));
  }

  // --- Remove OCR data ---
  ocrRemove.addEventListener('click', function () {
    if (worker) { worker.terminate(); worker = null; }
    engineReady = false;
    renderedPageCanvas = null;
    localStorage.removeItem('ocr_engine_loaded');
    localStorage.removeItem('ocr_quality');
    localStorage.removeItem('ocr_quality_warning_dismissed');
    ocrToolbar.hidden = true;
    ocrToggle.hidden = false;
    ocrToggle.textContent = 'OCR Assist';
    ocrToggle.disabled = false;
    alert('OCR engine removed. Clear your browser cache to fully remove downloaded files.');
  });

  window.addEventListener('resize', function () {
    if (!ocrCanvas.hidden) sizeCanvas();
  });
})();
