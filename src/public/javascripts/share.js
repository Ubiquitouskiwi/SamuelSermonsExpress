(function () {
  'use strict';

  // Create the share popup element once
  var popup = document.createElement('div');
  popup.className = 'share-popup';
  popup.hidden = true;
  popup.innerHTML =
    '<div class="share-popup__inner">' +
      '<button class="share-popup__item" data-action="copy">Copy Link</button>' +
      '<a class="share-popup__item" data-action="facebook" target="_blank" rel="noopener noreferrer">Facebook</a>' +
      '<a class="share-popup__item" data-action="twitter" target="_blank" rel="noopener noreferrer">X (Twitter)</a>' +
      '<a class="share-popup__item" data-action="email">Email</a>' +
    '</div>';
  document.body.appendChild(popup);

  var currentUrl = '';
  var currentTitle = '';
  var copyBtn = popup.querySelector('[data-action="copy"]');
  var fbLink = popup.querySelector('[data-action="facebook"]');
  var twLink = popup.querySelector('[data-action="twitter"]');
  var emLink = popup.querySelector('[data-action="email"]');

  function showPopup(url, title, anchorEl) {
    currentUrl = url;
    currentTitle = title || 'Samuel\'s Sermons';

    var encoded = encodeURIComponent(currentUrl);
    var encodedTitle = encodeURIComponent(currentTitle);

    fbLink.href = 'https://www.facebook.com/sharer/sharer.php?u=' + encoded;
    twLink.href = 'https://twitter.com/intent/tweet?url=' + encoded + '&text=' + encodedTitle;
    emLink.href = 'mailto:?subject=' + encodedTitle + '&body=Check out this sermon: ' + encoded;

    // Position near the button
    var rect = anchorEl.getBoundingClientRect();
    popup.style.position = 'fixed';
    popup.style.top = (rect.bottom + 6) + 'px';
    popup.style.left = rect.left + 'px';
    popup.hidden = false;

    // Flip up if it would go off screen
    var popupRect = popup.getBoundingClientRect();
    if (popupRect.bottom > window.innerHeight) {
      popup.style.top = (rect.top - popupRect.height - 6) + 'px';
    }
    // Flip left if it would go off screen
    if (popupRect.right > window.innerWidth) {
      popup.style.left = (window.innerWidth - popupRect.width - 8) + 'px';
    }
  }

  function hidePopup() {
    popup.hidden = true;
  }

  // Copy link
  copyBtn.addEventListener('click', function () {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(currentUrl).then(function () {
        copyBtn.textContent = 'Copied!';
        setTimeout(function () {
          copyBtn.textContent = 'Copy Link';
          hidePopup();
        }, 1200);
      });
    }
  });

  // Close on outside click
  document.addEventListener('click', function (e) {
    if (!popup.contains(e.target) && !e.target.closest('.share-trigger')) {
      hidePopup();
    }
  });

  // Close on Escape
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') hidePopup();
  });

  // --- Delegated handler for any .share-trigger button ---
  document.addEventListener('click', function (e) {
    var trigger = e.target.closest('.share-trigger');
    if (!trigger) return;
    e.preventDefault();
    e.stopPropagation();

    var url = trigger.getAttribute('data-share-url');
    var title = trigger.getAttribute('data-share-title') || '';

    // Make URL absolute
    if (url && !url.startsWith('http')) {
      url = window.location.origin + url;
    }

    // On mobile, use native share if available
    if (navigator.share) {
      navigator.share({ url: url, title: title }).catch(function () {});
      return;
    }

    // On desktop, show popup
    if (!popup.hidden) {
      hidePopup();
    } else {
      showPopup(url, title, trigger);
    }
  });
})();
