(function () {
  'use strict';

  var tip = document.createElement('div');
  tip.className = 'tooltip';
  tip.setAttribute('role', 'tooltip');
  tip.hidden = true;
  document.body.appendChild(tip);

  var currentTarget = null;
  var showTimeout = null;

  function show(el) {
    var text = el.getAttribute('data-tooltip');
    if (!text) return;
    tip.textContent = text;
    tip.hidden = false;
    position(el);
    currentTarget = el;
  }

  function hide() {
    tip.hidden = true;
    currentTarget = null;
  }

  function position(el) {
    var rect = el.getBoundingClientRect();
    var tipRect = tip.getBoundingClientRect();
    var top = rect.bottom + 6;
    var left = rect.left + (rect.width / 2) - (tipRect.width / 2);

    // Keep on screen
    if (left < 8) left = 8;
    if (left + tipRect.width > window.innerWidth - 8) left = window.innerWidth - tipRect.width - 8;
    if (top + tipRect.height > window.innerHeight - 8) {
      top = rect.top - tipRect.height - 6;
    }

    tip.style.top = top + 'px';
    tip.style.left = left + 'px';
  }

  document.addEventListener('mouseover', function (e) {
    var target = e.target.closest('[data-tooltip]');
    if (!target) return;
    clearTimeout(showTimeout);
    showTimeout = setTimeout(function () { show(target); }, 400);
  });

  document.addEventListener('mouseout', function (e) {
    var target = e.target.closest('[data-tooltip]');
    if (target || e.target === currentTarget) {
      clearTimeout(showTimeout);
      hide();
    }
  });

  // Hide on scroll
  window.addEventListener('scroll', hide, { passive: true });
})();
