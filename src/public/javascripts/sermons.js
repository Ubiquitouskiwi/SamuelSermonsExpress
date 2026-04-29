(function () {
  'use strict';

  var BATCH_SIZE = 18;
  var allSermons = [];
  var filtered = [];
  var rendered = 0;

  var grid = document.getElementById('sermon-grid');
  var sentinel = document.getElementById('sermon-sentinel');
  var countEl = document.getElementById('sermonCount');
  var searchInput = document.getElementById('sermonSearch');
  var suggestionsEl = document.getElementById('searchSuggestions');
  var typeChipsEl = document.getElementById('typeChips');

  if (!grid || !sentinel) return;

  var userInfo = window.__USER__ || { canTranscribe: false };

  // --- State ---
  var activeCollection = 'all';
  var activeTypes = new Set(); // empty = all types
  var searchQuery = '';

  // --- Badge helpers ---
  var badgeMap = {
    sermon:        { cls: 'badge--sermon',  label: 'Sermon' },
    funeral:       { cls: 'badge--funeral', label: 'Funeral' },
    'special day': { cls: 'badge--special', label: 'Special Day' }
  };

  function badgeFor(type) {
    var b = badgeMap[type] || { cls: '', label: type || 'Other' };
    return '<span class="badge ' + b.cls + '">' + b.label + '</span>';
  }

  function escHtml(str) {
    var d = document.createElement('div');
    d.appendChild(document.createTextNode(str));
    return d.innerHTML;
  }

  // --- Card rendering ---
  function createCard(s) {
    var card = document.createElement('article');
    card.className = 'sermon-card';
    var detailUrl = '/sermons/details?id=' + s.id;

    var actionBtn;
    if (userInfo.canTranscribe) {
      actionBtn = '<a class="btn btn--small btn--outline sermon-card__action-link" href="/admin/transcribe/' + s.id + '">Transcribe</a>';
    } else {
      actionBtn = '<a class="btn btn--small btn--outline sermon-card__action-link" href="mailto:admin@samuelsermons.com?subject=' +
        encodeURIComponent('Transcriber Access Request') +
        '&body=' + encodeURIComponent('I would like to help transcribe sermons. Please grant me transcriber access.') +
        '">Request Access</a>';
    }

    card.innerHTML =
      '<a class="sermon-card__link" href="' + detailUrl + '">' +
        '<div class="sermon-card__badge">' + badgeFor(s.sermonType) + '</div>' +
        '<h3 class="sermon-card__title">' + escHtml(s.title) + '</h3>' +
      '</a>' +
      '<div class="sermon-card__actions">' +
        actionBtn +
        '<button class="btn btn--small btn--primary share-trigger" type="button" data-share-url="' + detailUrl + '" data-share-title="' + escHtml(s.title) + '">Share</button>' +
      '</div>';
    return card;
  }

  function renderBatch() {
    var end = Math.min(rendered + BATCH_SIZE, filtered.length);
    var frag = document.createDocumentFragment();
    for (var i = rendered; i < end; i++) {
      frag.appendChild(createCard(filtered[i]));
    }
    grid.appendChild(frag);
    rendered = end;
    sentinel.hidden = rendered >= filtered.length;
  }

  // --- Filtering ---
  function applyFilters() {
    var q = searchQuery.toLowerCase().trim();

    filtered = allSermons.filter(function (s) {
      if (activeCollection !== 'all' && s.collection !== activeCollection) return false;
      if (activeTypes.size > 0 && !activeTypes.has(s.sermonType)) return false;
      if (q && s.title.toLowerCase().indexOf(q) === -1) return false;
      return true;
    });

    grid.innerHTML = '';
    rendered = 0;
    countEl.textContent = filtered.length;

    if (filtered.length === 0) {
      grid.innerHTML =
        '<div class="sermon-empty">' +
          '<h3 class="sermon-empty__title">No sermons found</h3>' +
          '<p>Try adjusting your filters or search.</p>' +
        '</div>';
      sentinel.hidden = true;
    } else {
      renderBatch();
    }
  }

  // --- Build type chips dynamically from data ---
  function buildTypeChips() {
    var types = {};
    allSermons.forEach(function (s) {
      if (activeCollection !== 'all' && s.collection !== activeCollection) return;
      types[s.sermonType] = (types[s.sermonType] || 0) + 1;
    });

    typeChipsEl.innerHTML = '';
    var sortedTypes = Object.keys(types).sort();

    sortedTypes.forEach(function (type) {
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'filter-chip' + (activeTypes.has(type) ? ' filter-chip--active' : '');
      var b = badgeMap[type];
      btn.textContent = (b ? b.label : type) + ' (' + types[type] + ')';
      btn.setAttribute('data-type', type);
      btn.addEventListener('click', function () {
        if (activeTypes.has(type)) {
          activeTypes.delete(type);
          btn.classList.remove('filter-chip--active');
        } else {
          activeTypes.add(type);
          btn.classList.add('filter-chip--active');
        }
        applyFilters();
      });
      typeChipsEl.appendChild(btn);
    });

    // Remove any active types that no longer exist in current collection
    activeTypes.forEach(function (t) {
      if (!types[t]) activeTypes.delete(t);
    });
  }

  // --- Collection chips ---
  var collectionChips = document.querySelectorAll('[data-collection]');
  collectionChips.forEach(function (chip) {
    chip.addEventListener('click', function () {
      activeCollection = this.getAttribute('data-collection');
      collectionChips.forEach(function (c) { c.classList.remove('filter-chip--active'); });
      this.classList.add('filter-chip--active');
      buildTypeChips();
      applyFilters();
    });
  });

  // --- Search with suggestions ---
  var debounceTimer = null;

  searchInput.addEventListener('input', function () {
    searchQuery = this.value;
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(function () {
      applyFilters();
      showSuggestions(searchQuery);
    }, 200);
  });

  searchInput.addEventListener('focus', function () {
    if (this.value.trim().length > 0) showSuggestions(this.value);
  });

  document.addEventListener('click', function (e) {
    if (!suggestionsEl.contains(e.target) && e.target !== searchInput) {
      suggestionsEl.hidden = true;
    }
  });

  searchInput.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') {
      suggestionsEl.hidden = true;
      this.blur();
    }
  });

  function showSuggestions(q) {
    q = q.toLowerCase().trim();
    if (q.length < 2) { suggestionsEl.hidden = true; return; }

    // Group matches by type
    var groups = {};
    allSermons.forEach(function (s) {
      if (activeCollection !== 'all' && s.collection !== activeCollection) return;
      if (s.title.toLowerCase().indexOf(q) === -1) return;
      var type = s.sermonType;
      if (!groups[type]) groups[type] = [];
      if (groups[type].length < 4) groups[type].push(s); // Max 4 per group
    });

    var keys = Object.keys(groups).sort();
    if (keys.length === 0) { suggestionsEl.hidden = true; return; }

    var html = '';
    keys.forEach(function (type) {
      var b = badgeMap[type];
      var label = b ? b.label : type;
      html += '<div class="suggestions-group">';
      html += '<div class="suggestions-group__label">' + escHtml(label) + '</div>';
      groups[type].forEach(function (s) {
        html += '<a class="suggestions-item" href="/sermons/details?id=' + s.id + '">' + escHtml(s.title) + '</a>';
      });
      html += '</div>';
    });

    suggestionsEl.innerHTML = html;
    suggestionsEl.hidden = false;
  }

  // --- IntersectionObserver for lazy loading ---
  if ('IntersectionObserver' in window) {
    var observer = new IntersectionObserver(function (entries) {
      if (entries[0].isIntersecting && rendered < filtered.length) {
        renderBatch();
      }
    }, { rootMargin: '200px' });
    observer.observe(sentinel);
  }

  // --- Init ---
  var data = window.__SERMONS__ || { ordered: [], unordered: [] };
  data.ordered.forEach(function (s) { s.collection = 'ordered'; allSermons.push(s); });
  data.unordered.forEach(function (s) { s.collection = 'unordered'; allSermons.push(s); });

  buildTypeChips();
  applyFilters();

  // --- Recently viewed ---
  (function() {
    try {
      var recent = JSON.parse(localStorage.getItem('recently_viewed') || '[]');
      if (recent.length === 0) return;
      var container = document.getElementById('recentlyViewed');
      var list = container.querySelector('.recently-viewed__list');
      if (!container || !list) return;
      recent.forEach(function(s) {
        var a = document.createElement('a');
        a.className = 'recently-viewed__item';
        a.href = '/sermons/details?id=' + s.id;
        a.textContent = s.title;
        list.appendChild(a);
      });
      container.hidden = false;
    } catch(e) {}
  })();
})();
