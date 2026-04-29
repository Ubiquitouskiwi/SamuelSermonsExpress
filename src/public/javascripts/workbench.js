(function () {
  'use strict';

  var workbench = document.querySelector('.workbench');
  if (!workbench) return;

  var sermonId = workbench.getAttribute('data-sermon-id');
  var editor = document.getElementById('transcriptionEditor');
  var notes = document.getElementById('notesEditor');
  var statusSel = document.getElementById('statusSelect');
  var saveIndicator = document.getElementById('saveIndicator');
  var wordCount = document.getElementById('wordCount');
  var divider = document.getElementById('paneDivider');
  var pdfPane = document.getElementById('pdfPane');
  var editorPane = document.getElementById('editorPane');

  // --- Word count ---
  function updateWordCount() {
    var text = editor.value.trim();
    var count = text ? text.split(/\s+/).length : 0;
    wordCount.textContent = count + ' word' + (count !== 1 ? 's' : '');
  }
  editor.addEventListener('input', updateWordCount);
  updateWordCount();

  // --- Auto-save ---
  var saveTimer = null;
  var dirty = false;
  var saving = false;

  function showSaveState(state) {
    saveIndicator.textContent = state;
    saveIndicator.className = 'workbench__save-indicator workbench__save-indicator--' + state.toLowerCase().replace(/\s/g, '-');
  }

  function save() {
    if (saving) return;
    saving = true;
    dirty = false;
    showSaveState('Saving...');

    var body = {
      text: editor.value,
      notes: notes.value,
      status: statusSel.value,
    };

    fetch('/admin/transcribe/' + sermonId + '/save', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
      .then(function (res) { return res.json(); })
      .then(function (data) {
        saving = false;
        if (data.ok) {
          showSaveState('Saved');
        } else {
          showSaveState('Error');
        }
      })
      .catch(function () {
        saving = false;
        showSaveState('Error');
      });
  }

  function markDirty() {
    dirty = true;
    showSaveState('Unsaved');
    clearTimeout(saveTimer);
    saveTimer = setTimeout(save, 10000); // Auto-save after 10s of inactivity
  }

  editor.addEventListener('input', markDirty);
  notes.addEventListener('input', markDirty);
  statusSel.addEventListener('change', function () {
    markDirty();
    // If status changed to in_progress or complete, save immediately
    save();
  });

  // --- Keyboard shortcuts ---
  document.addEventListener('keydown', function (e) {
    // Ctrl+S / Cmd+S to save
    if ((e.ctrlKey || e.metaKey) && e.key === 's') {
      e.preventDefault();
      save();
    }
    // Ctrl+` to switch focus between editor and PDF
    if ((e.ctrlKey || e.metaKey) && e.key === '`') {
      e.preventDefault();
      if (document.activeElement === editor || document.activeElement === notes) {
        document.getElementById('pdfViewer').focus();
      } else {
        editor.focus();
      }
    }
  });

  // Tab inserts indentation in the editor
  editor.addEventListener('keydown', function (e) {
    if (e.key === 'Tab') {
      e.preventDefault();
      var start = this.selectionStart;
      var end = this.selectionEnd;
      var val = this.value;
      if (e.shiftKey) {
        // Shift+Tab: remove leading spaces/tab from current line
        var lineStart = val.lastIndexOf('\n', start - 1) + 1;
        var line = val.substring(lineStart, end);
        if (line.startsWith('    ')) {
          this.value = val.substring(0, lineStart) + line.substring(4);
          this.selectionStart = this.selectionEnd = start - 4;
        } else if (line.startsWith('\t')) {
          this.value = val.substring(0, lineStart) + line.substring(1);
          this.selectionStart = this.selectionEnd = start - 1;
        }
      } else {
        // Tab: insert 4 spaces at cursor
        this.value = val.substring(0, start) + '    ' + val.substring(end);
        this.selectionStart = this.selectionEnd = start + 4;
      }
      markDirty();
    }
  });

  // --- Draggable divider ---
  var dragging = false;
  var panes = document.querySelector('.workbench__panes');

  divider.addEventListener('mousedown', startDrag);
  divider.addEventListener('touchstart', startDrag, { passive: false });

  function startDrag(e) {
    e.preventDefault();
    dragging = true;
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
    // Disable pointer events on iframe during drag
    document.getElementById('pdfViewer').style.pointerEvents = 'none';
    document.addEventListener('mousemove', onDrag);
    document.addEventListener('touchmove', onDrag, { passive: false });
    document.addEventListener('mouseup', stopDrag);
    document.addEventListener('touchend', stopDrag);
  }

  function onDrag(e) {
    if (!dragging) return;
    var clientX = e.touches ? e.touches[0].clientX : e.clientX;
    var rect = panes.getBoundingClientRect();
    var pct = ((clientX - rect.left) / rect.width) * 100;
    pct = Math.max(20, Math.min(80, pct)); // Clamp between 20% and 80%
    pdfPane.style.flex = '0 0 ' + pct + '%';
    editorPane.style.flex = '0 0 ' + (100 - pct) + '%';
  }

  function stopDrag() {
    dragging = false;
    document.body.style.cursor = '';
    document.body.style.userSelect = '';
    document.getElementById('pdfViewer').style.pointerEvents = '';
    document.removeEventListener('mousemove', onDrag);
    document.removeEventListener('touchmove', onDrag);
    document.removeEventListener('mouseup', stopDrag);
    document.removeEventListener('touchend', stopDrag);
  }

  // Keyboard resize for divider (accessibility)
  divider.addEventListener('keydown', function (e) {
    var currentFlex = parseFloat(pdfPane.style.flex) || 50;
    if (e.key === 'ArrowLeft') { e.preventDefault(); currentFlex = Math.max(20, currentFlex - 2); }
    if (e.key === 'ArrowRight') { e.preventDefault(); currentFlex = Math.min(80, currentFlex + 2); }
    pdfPane.style.flex = '0 0 ' + currentFlex + '%';
    editorPane.style.flex = '0 0 ' + (100 - currentFlex) + '%';
  });

  // --- Warn before leaving with unsaved changes ---
  window.addEventListener('beforeunload', function (e) {
    if (dirty) {
      e.preventDefault();
      e.returnValue = '';
    }
  });

  // --- Auto-set status to in_progress when user starts typing ---
  var hasTyped = false;
  editor.addEventListener('input', function () {
    if (!hasTyped && statusSel.value === 'not_started') {
      hasTyped = true;
      statusSel.value = 'in_progress';
    }
  });
})();
