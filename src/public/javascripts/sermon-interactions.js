(function () {
  'use strict';

  // ==========================================================================
  // Bookmark toggle
  // ==========================================================================
  var bookmarkBtn = document.getElementById('bookmarkBtn');
  if (bookmarkBtn) {
    var sermonId = bookmarkBtn.getAttribute('data-sermon-id');
    var sermonTitle = bookmarkBtn.getAttribute('data-sermon-title');

    function getBookmarks() {
      try { return JSON.parse(localStorage.getItem('sermon_bookmarks') || '[]'); }
      catch (e) { return []; }
    }

    function saveBookmarks(list) {
      localStorage.setItem('sermon_bookmarks', JSON.stringify(list));
    }

    function isBookmarked() {
      return getBookmarks().some(function (b) { return String(b.id) === String(sermonId); });
    }

    function updateBtn() {
      if (isBookmarked()) {
        bookmarkBtn.textContent = 'Bookmarked ✓';
        bookmarkBtn.classList.remove('btn--accent');
        bookmarkBtn.classList.add('btn--outline');
      } else {
        bookmarkBtn.textContent = 'Bookmark';
        bookmarkBtn.classList.remove('btn--outline');
        bookmarkBtn.classList.add('btn--accent');
      }
    }

    bookmarkBtn.addEventListener('click', function () {
      var list = getBookmarks();
      if (isBookmarked()) {
        saveBookmarks(list.filter(function (b) { return String(b.id) !== String(sermonId); }));
      } else {
        list.push({ id: sermonId, title: sermonTitle, savedAt: new Date().toISOString() });
        saveBookmarks(list);
      }
      updateBtn();
    });

    updateBtn();
  }

  // ==========================================================================
  // Text highlight saving (like Bible verse highlighting)
  // ==========================================================================
  var sermonText = document.getElementById('sermonText');
  var highlightPopup = document.getElementById('highlightPopup');
  var saveHighlightBtn = document.getElementById('saveHighlight');
  var highlightsContainer = document.getElementById('sermonHighlights');

  if (sermonText && highlightPopup && saveHighlightBtn) {
    var hSermonId = sermonText.getAttribute('data-sermon-id');
    var hSermonTitle = sermonText.getAttribute('data-sermon-title');
    var pendingText = '';

    function getHighlights() {
      try { return JSON.parse(localStorage.getItem('sermon_highlights') || '[]'); }
      catch (e) { return []; }
    }

    function saveHighlights(list) {
      localStorage.setItem('sermon_highlights', JSON.stringify(list));
    }

    // Show popup near selection
    sermonText.addEventListener('mouseup', function (e) {
      var sel = window.getSelection();
      var text = sel.toString().trim();
      if (text.length < 3) {
        highlightPopup.hidden = true;
        return;
      }
      pendingText = text;
      highlightPopup.hidden = false;
      highlightPopup.style.position = 'absolute';
      var rect = sel.getRangeAt(0).getBoundingClientRect();
      var containerRect = sermonText.closest('.sermon-detail__viewer').getBoundingClientRect();
      highlightPopup.style.top = (rect.bottom - containerRect.top + 8) + 'px';
      highlightPopup.style.left = (rect.left - containerRect.left) + 'px';
    });

    saveHighlightBtn.addEventListener('click', function () {
      if (!pendingText) return;
      var list = getHighlights();
      list.push({
        sermonId: hSermonId,
        sermonTitle: hSermonTitle,
        text: pendingText,
        savedAt: new Date().toISOString(),
      });
      saveHighlights(list);
      highlightPopup.hidden = true;
      pendingText = '';
      renderHighlights();
    });

    // Hide popup on click elsewhere
    document.addEventListener('mousedown', function (e) {
      if (!highlightPopup.contains(e.target) && e.target !== sermonText) {
        highlightPopup.hidden = true;
      }
    });

    // Render highlights for this sermon
    function renderHighlights() {
      var all = getHighlights();
      var mine = all.filter(function (h) { return String(h.sermonId) === String(hSermonId); });
      if (mine.length === 0) {
        highlightsContainer.innerHTML = '<p class="section-desc">No highlights saved for this sermon.</p>';
        return;
      }
      var html = '';
      mine.forEach(function (h, i) {
        html += '<div class="highlight-item">' +
          '<blockquote class="highlight-item__text">"' + escHtml(h.text) + '"</blockquote>' +
          '<div class="highlight-item__meta">' +
            '<time>' + new Date(h.savedAt).toLocaleDateString() + '</time>' +
            '<button class="btn btn--small btn--outline highlight-remove" data-index="' + i + '">Remove</button>' +
          '</div></div>';
      });
      highlightsContainer.innerHTML = html;

      // Wire up remove buttons
      highlightsContainer.querySelectorAll('.highlight-remove').forEach(function (btn) {
        btn.addEventListener('click', function () {
          var all = getHighlights();
          var mine = all.filter(function (h) { return String(h.sermonId) === String(hSermonId); });
          var idx = parseInt(this.getAttribute('data-index'), 10);
          var toRemove = mine[idx];
          if (toRemove) {
            var updated = all.filter(function (h) { return h !== toRemove; });
            // Compare by text + savedAt since objects won't be same reference
            updated = all.filter(function (h) {
              return !(String(h.sermonId) === String(toRemove.sermonId) && h.text === toRemove.text && h.savedAt === toRemove.savedAt);
            });
            saveHighlights(updated);
            renderHighlights();
          }
        });
      });
    }

    renderHighlights();
  }

  function escHtml(str) {
    var d = document.createElement('div');
    d.appendChild(document.createTextNode(str));
    return d.innerHTML;
  }
})();
