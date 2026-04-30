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
  var currentPage = 1;
  var totalPages = 1;

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
      loadScript('https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.4.168/pdf.min.mjs', function () {
        ocrProgressText.textContent = 'Initializing OCR engine...';
        ocrProgressFill.style.width = '30%';

        // pdf.js loaded via module — access from globalThis
        var pdfjs = window.pdfjsLib || globalThis.pdfjsLib;
        if (!pdfjs) {
          ocrProgressText.textContent = 'PDF library failed to load.';
          ocrToggle.textContent = 'OCR Assist';
          ocrToggle.disabled = false;
          return;
        }
        pdfjs.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.4.168/pdf.worker.min.mjs';

        Tesseract.createWorker('eng', 1, {
          workerPath: 'https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/worker.min.js',
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
          // Set parameters for better typewriter/scanned document recognition
          return worker.setParameters({
            tessedit_pageseg_mode: '6',  // Assume uniform block of text
            tessedit_ocr_engine_mode: '2', // Legacy + LSTM combined
          });
        }).then(function () {
          engineReady = true;
          localStorage.setItem('ocr_engine_loaded', 'true');
          ocrProgress.hidden = true;
          ocrToolbar.hidden = false;
          ocrToggle.hidden = true;
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

  // --- Render PDF page to canvas ---
  function renderPdfPage(pageNum) {
    ocrStatus.textContent = 'Rendering page ' + pageNum + ' at ' + currentScale + 'x...';
    var pdfjs = window.pdfjsLib || globalThis.pdfjsLib;
    if (!pdfjs) { ocrStatus.textContent = 'PDF library not available'; return; }

    pdfjs.getDocument(ocrPdfUrl).promise.then(function (pdf) {
      totalPages = pdf.numPages;
      currentPage = Math.min(pageNum, totalPages);
      updatePageInfo();
      return pdf.getPage(currentPage);
    }).then(function (page) {
      var viewport = page.getViewport({ scale: currentScale });
      var canvas = document.createElement('canvas');
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      var ctx = canvas.getContext('2d');
      return page.render({ canvasContext: ctx, viewport: viewport }).promise.then(function () {
        // Light preprocessing: grayscale only (no binarization — image is already crisp)
        var imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        var data = imageData.data;
        for (var i = 0; i < data.length; i += 4) {
          var gray = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
          data[i] = data[i + 1] = data[i + 2] = gray;
        }
        ctx.putImageData(imageData, 0, 0);
        renderedPageCanvas = canvas;
        ocrStatus.textContent = 'Ready (' + currentScale + 'x)';
      });
    }).catch(function (err) {
      console.error('PDF render error:', err);
      ocrStatus.textContent = 'Failed to render PDF — ' + err.message;
    });
  }

  // --- Load external script ---
  function loadScript(src, cb) {
    if (src.includes('tesseract') && window.Tesseract) return cb();
    if (src.includes('pdf') && (window.pdfjsLib || globalThis.pdfjsLib)) return cb();
    var s = document.createElement('script');
    s.src = src;
    if (src.endsWith('.mjs')) s.type = 'module';
    s.onload = function() {
      // For module scripts, wait a tick for globals to be set
      setTimeout(cb, 100);
    };
    s.onerror = function () { ocrProgressText.textContent = 'Failed to download library.'; };
    document.head.appendChild(s);
  }

  // --- Preview (debug: shows what OCR sees) ---
  var ocrPreview = document.getElementById('ocrPreview');
  if (ocrPreview) {
    ocrPreview.addEventListener('click', function () {
      if (!renderedPageCanvas) {
        ocrStatus.textContent = 'PDF not rendered yet...';
        return;
      }
      var dataUrl = renderedPageCanvas.toDataURL('image/png');
      var win = window.open();
      if (win) {
        win.document.write('<html><head><title>OCR Preview</title></head><body style="margin:0;background:#333;display:flex;justify-content:center;"><img src="' + dataUrl + '" style="max-width:100%;height:auto;"></body></html>');
      }
    });
  }

  // --- Page navigation ---
  var ocrPrevPage = document.getElementById('ocrPrevPage');
  var ocrNextPage = document.getElementById('ocrNextPage');
  var ocrPageInfo = document.getElementById('ocrPageInfo');

  function updatePageInfo() {
    if (ocrPageInfo) ocrPageInfo.textContent = 'Page ' + currentPage + '/' + totalPages;
    if (ocrPrevPage) ocrPrevPage.disabled = currentPage <= 1;
    if (ocrNextPage) ocrNextPage.disabled = currentPage >= totalPages;
  }

  if (ocrPrevPage) {
    ocrPrevPage.addEventListener('click', function () {
      if (currentPage > 1) renderPdfPage(currentPage - 1);
    });
  }
  if (ocrNextPage) {
    ocrNextPage.addEventListener('click', function () {
      if (currentPage < totalPages) renderPdfPage(currentPage + 1);
    });
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
    var iframe = document.getElementById('pdfViewer');
    if (iframe) {
      ocrCanvas.width = iframe.clientWidth;
      ocrCanvas.height = iframe.clientHeight;
    } else {
      var container = ocrCanvas.parentElement;
      ocrCanvas.width = container.clientWidth;
      ocrCanvas.height = container.clientHeight;
    }
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

    // The overlay canvas covers the PDF container visually.
    // Map selection coordinates to the rendered PDF canvas coordinates.
    var cw = ocrCanvas.width;
    var ch = ocrCanvas.height;
    var pw = renderedPageCanvas.width;
    var ph = renderedPageCanvas.height;

    // Maintain aspect ratio — the PDF might not fill the container exactly
    var containerAspect = cw / ch;
    var pdfAspect = pw / ph;
    var scaleX, scaleY, offsetX, offsetY;

    if (pdfAspect > containerAspect) {
      // PDF is wider — fits width, letterboxed vertically
      scaleX = pw / cw;
      scaleY = scaleX;
      offsetX = 0;
      offsetY = (ch - (ph / scaleX)) / 2;
    } else {
      // PDF is taller — fits height, letterboxed horizontally
      scaleY = ph / ch;
      scaleX = scaleY;
      offsetX = (cw - (pw / scaleY)) / 2;
      offsetY = 0;
    }

    // Simple direct mapping (works when PDF fills the container)
    var cropX = Math.round(Math.max(0, (x / cw) * pw));
    var cropY = Math.round(Math.max(0, (y / ch) * ph));
    var cropW = Math.round(Math.min(pw - cropX, (w / cw) * pw));
    var cropH = Math.round(Math.min(ph - cropY, (h / ch) * ph));

    // Ensure minimum size
    if (cropW < 10 || cropH < 10) {
      ocrStatus.textContent = 'Selection too small';
      ocrSelectRegion.disabled = false;
      cancelSelection();
      return;
    }

    var regionCanvas = document.createElement('canvas');
    regionCanvas.width = cropW;
    regionCanvas.height = cropH;
    var ctx = regionCanvas.getContext('2d');
    ctx.drawImage(renderedPageCanvas, cropX, cropY, cropW, cropH, 0, 0, cropW, cropH);

    // Debug: log what we're sending to OCR
    console.log('OCR region:', { cw: cw, ch: ch, pw: pw, ph: ph, cropX: cropX, cropY: cropY, cropW: cropW, cropH: cropH });

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
