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

  function escHtml(str) {
    var d = document.createElement('div');
    d.appendChild(document.createTextNode(str));
    return d.innerHTML;
  }

  // Ordered sermons carry their number as a "12. " title prefix.
  function splitTitle(title) {
    var m = /^(\d+)\.\s+(.+)$/.exec(title || '');
    return m ? { number: m[1], name: m[2] } : { number: null, name: title || '' };
  }

  var collectionLabels = { ordered: 'Ordered collection', unordered: 'Unordered collection' };

  // Bookmarks live in the browser (the same store the sermon page writes to).
  var savedIds = {};
  try {
    JSON.parse(localStorage.getItem('sermon_bookmarks') || '[]').forEach(function (b) {
      savedIds[String(b.id)] = true;
    });
  } catch (e) {}

  function el(tagName, cls, text) {
    var node = document.createElement(tagName);
    if (cls) node.className = cls;
    if (text) node.textContent = text;
    return node;
  }

  function tagItem(text, cls) {
    var li = el('li');
    li.appendChild(el('span', 'badge' + (cls ? ' ' + cls : ''), text));
    return li;
  }

  // --- Card rendering (DOM APIs, so titles are never parsed as HTML) ---
  function createCard(s) {
    var detailUrl = '/sermons/details?id=' + s.id;
    var t = splitTitle(s.title);
    var card = el('article', 'sermon-card');

    var body = el('div', 'sermon-card__body');
    var heading = el('h3', 'sermon-card__title');
    var link = el('a', 'sermon-card__link', t.name);
    link.href = detailUrl;
    heading.appendChild(link);
    body.appendChild(heading);

    // Metadata line and tags: only fields this sermon actually has
    var details = el('div', 'sermon-card__details');
    var metaParts = [];
    if (t.number) metaParts.push('No. ' + t.number);
    if (collectionLabels[s.collection]) metaParts.push(collectionLabels[s.collection]);
    if (metaParts.length) {
      var meta = el('p', 'sermon-card__meta');
      metaParts.forEach(function (part, i) {
        if (i) {
          var sep = el('span', 'sermon-card__sep', '·');
          sep.setAttribute('aria-hidden', 'true');
          meta.appendChild(sep);
        }
        meta.appendChild(el('span', null, part));
      });
      details.appendChild(meta);
    }
    var tags = el('ul', 'sermon-card__tags');
    var b = badgeMap[s.sermonType];
    if (s.sermonType) tags.appendChild(tagItem(b ? b.label : s.sermonType, b ? b.cls : ''));
    if (savedIds[String(s.id)]) tags.appendChild(tagItem('Saved', 'badge--saved'));
    if (tags.children.length) details.appendChild(tags);
    if (details.children.length) body.appendChild(details);
    card.appendChild(body);

    var actions = el('div', 'sermon-card__actions');
    var action;
    if (userInfo.canTranscribe) {
      action = el('a', 'btn btn--small btn--outline sermon-card__action-link', 'Transcribe');
      action.href = '/admin/transcribe/' + s.id;
    } else {
      action = el('a', 'btn btn--small btn--outline sermon-card__action-link', 'Request Access');
      action.href = 'mailto:admin@samuelsermons.com?subject=' +
        encodeURIComponent('Transcriber Access Request') +
        '&body=' + encodeURIComponent('I would like to help transcribe sermons. Please grant me transcriber access.');
    }
    var share = el('button', 'btn btn--small btn--outline share-trigger', 'Share');
    share.type = 'button';
    share.setAttribute('data-share-url', detailUrl);
    share.setAttribute('data-share-title', s.title);
    // Repeated button labels name their sermon for screen reader users
    share.appendChild(el('span', 'sr-only', ' ' + t.name));
    actions.appendChild(action);
    actions.appendChild(share);
    card.appendChild(actions);
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
      btn.setAttribute('aria-pressed', activeTypes.has(type) ? 'true' : 'false');
      var b = badgeMap[type];
      btn.textContent = (b ? b.label : type) + ' (' + types[type] + ')';
      btn.setAttribute('data-type', type);
      btn.addEventListener('click', function () {
        if (activeTypes.has(type)) {
          activeTypes.delete(type);
          btn.classList.remove('filter-chip--active');
          btn.setAttribute('aria-pressed', 'false');
        } else {
          activeTypes.add(type);
          btn.classList.add('filter-chip--active');
          btn.setAttribute('aria-pressed', 'true');
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
      collectionChips.forEach(function (c) {
        c.classList.remove('filter-chip--active');
        c.setAttribute('aria-pressed', 'false');
      });
      this.classList.add('filter-chip--active');
      this.setAttribute('aria-pressed', 'true');
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
