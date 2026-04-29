(function () {
  'use strict';

  var bookmarkList = document.getElementById('bookmarkList');
  var highlightList = document.getElementById('highlightList');
  var clearBookmarksBtn = document.getElementById('clearBookmarks');
  var clearHighlightsBtn = document.getElementById('clearHighlights');

  function getBookmarks() {
    try { return JSON.parse(localStorage.getItem('sermon_bookmarks') || '[]'); }
    catch (e) { return []; }
  }

  function getHighlights() {
    try { return JSON.parse(localStorage.getItem('sermon_highlights') || '[]'); }
    catch (e) { return []; }
  }

  function escHtml(str) {
    var d = document.createElement('div');
    d.appendChild(document.createTextNode(str));
    return d.innerHTML;
  }

  function renderBookmarks() {
    var list = getBookmarks();
    if (list.length === 0) {
      bookmarkList.innerHTML = '<p class="section-desc">No bookmarked sermons yet. Visit a sermon and click "Bookmark" to save it here.</p>';
      return;
    }
    var html = '';
    list.forEach(function (b) {
      html += '<div class="bookmark-item">' +
        '<a class="bookmark-item__title" href="/sermons/details?id=' + b.id + '">' + escHtml(b.title) + '</a>' +
        '<span class="bookmark-item__date">Saved ' + new Date(b.savedAt).toLocaleDateString() + '</span>' +
        '</div>';
    });
    bookmarkList.innerHTML = html;
  }

  function renderHighlights() {
    var list = getHighlights();
    if (list.length === 0) {
      highlightList.innerHTML = '<p class="section-desc">No highlights saved yet. Select text on a sermon\'s transcription to save passages.</p>';
      return;
    }
    // Group by sermon
    var grouped = {};
    list.forEach(function (h) {
      var key = h.sermonId || 'unknown';
      if (!grouped[key]) grouped[key] = { title: h.sermonTitle || 'Unknown Sermon', id: h.sermonId, items: [] };
      grouped[key].items.push(h);
    });

    var html = '';
    Object.keys(grouped).forEach(function (key) {
      var group = grouped[key];
      html += '<div class="highlight-group">';
      html += '<h3 class="highlight-group__title"><a href="/sermons/details?id=' + group.id + '">' + escHtml(group.title) + '</a></h3>';
      group.items.forEach(function (h) {
        html += '<div class="highlight-item">' +
          '<blockquote class="highlight-item__text">"' + escHtml(h.text) + '"</blockquote>' +
          '<div class="highlight-item__meta"><time>' + new Date(h.savedAt).toLocaleDateString() + '</time></div>' +
          '</div>';
      });
      html += '</div>';
    });
    highlightList.innerHTML = html;
  }

  if (clearBookmarksBtn) {
    clearBookmarksBtn.addEventListener('click', function () {
      if (confirm('Remove all bookmarked sermons?')) {
        localStorage.removeItem('sermon_bookmarks');
        renderBookmarks();
      }
    });
  }

  if (clearHighlightsBtn) {
    clearHighlightsBtn.addEventListener('click', function () {
      if (confirm('Remove all saved highlights?')) {
        localStorage.removeItem('sermon_highlights');
        renderHighlights();
      }
    });
  }

  renderBookmarks();
  renderHighlights();
})();
