(function () {
  'use strict';

  // ==========================================================================
  // Tour Engine — lightweight guided tour with spotlight highlighting
  // ==========================================================================

  var overlay, spotlight, tooltip, stepText, stepCount, prevBtn, nextBtn, closeBtn;
  var currentTour = null;
  var currentStep = 0;
  var isActive = false;

  // --- Build the tour UI (once) ---
  function buildUI() {
    if (overlay) return;

    overlay = document.createElement('div');
    overlay.className = 'tour-overlay';
    overlay.innerHTML =
      '<div class="tour-spotlight" id="tourSpotlight"></div>' +
      '<div class="tour-tooltip" id="tourTooltip">' +
        '<div class="tour-tooltip__header">' +
          '<span class="tour-tooltip__count" id="tourCount"></span>' +
          '<button class="tour-tooltip__close" id="tourClose" type="button" aria-label="Close tour">&times;</button>' +
        '</div>' +
        '<div class="tour-tooltip__body" id="tourText"></div>' +
        '<div class="tour-tooltip__footer">' +
          '<button class="btn btn--small btn--outline" id="tourPrev" type="button">Back</button>' +
          '<button class="btn btn--small btn--primary" id="tourNext" type="button">Next</button>' +
        '</div>' +
      '</div>';

    document.body.appendChild(overlay);

    spotlight = document.getElementById('tourSpotlight');
    tooltip = document.getElementById('tourTooltip');
    stepText = document.getElementById('tourText');
    stepCount = document.getElementById('tourCount');
    prevBtn = document.getElementById('tourPrev');
    nextBtn = document.getElementById('tourNext');
    closeBtn = document.getElementById('tourClose');

    prevBtn.addEventListener('click', function () { goToStep(currentStep - 1); });
    nextBtn.addEventListener('click', function () {
      if (currentStep >= currentTour.length - 1) {
        endTour();
      } else {
        goToStep(currentStep + 1);
      }
    });
    closeBtn.addEventListener('click', endTour);
    overlay.addEventListener('click', function (e) {
      if (e.target === overlay) endTour();
    });

    document.addEventListener('keydown', function (e) {
      if (!isActive) return;
      if (e.key === 'Escape') endTour();
      if (e.key === 'ArrowRight' || e.key === 'Enter') nextBtn.click();
      if (e.key === 'ArrowLeft') prevBtn.click();
    });
  }

  // --- Show a step ---
  function goToStep(idx) {
    if (!currentTour || idx < 0 || idx >= currentTour.length) return;
    currentStep = idx;
    var step = currentTour[currentStep];

    stepText.innerHTML = '<h3 class="tour-tooltip__title">' + step.title + '</h3>' +
      '<p class="tour-tooltip__desc">' + step.text + '</p>';
    stepCount.textContent = (currentStep + 1) + ' of ' + currentTour.length;
    prevBtn.style.display = currentStep === 0 ? 'none' : '';
    nextBtn.textContent = currentStep >= currentTour.length - 1 ? 'Finish' : 'Next';

    // Highlight the target element
    var target = step.target ? document.querySelector(step.target) : null;
    if (target) {
      target.scrollIntoView({ behavior: 'smooth', block: 'center' });
      // Wait for scroll to settle
      setTimeout(function () { positionSpotlight(target); positionTooltip(target, step.position); }, 300);
    } else {
      // No target — center the tooltip
      spotlight.style.display = 'none';
      tooltip.style.position = 'fixed';
      tooltip.style.top = '50%';
      tooltip.style.left = '50%';
      tooltip.style.transform = 'translate(-50%, -50%)';
    }
  }

  function positionSpotlight(el) {
    var rect = el.getBoundingClientRect();
    var pad = 8;
    spotlight.style.display = 'block';
    spotlight.style.top = (rect.top - pad + window.scrollY) + 'px';
    spotlight.style.left = (rect.left - pad) + 'px';
    spotlight.style.width = (rect.width + pad * 2) + 'px';
    spotlight.style.height = (rect.height + pad * 2) + 'px';
  }

  function positionTooltip(el, position) {
    var rect = el.getBoundingClientRect();
    tooltip.style.position = 'fixed';
    tooltip.style.transform = 'none';
    tooltip.style.maxWidth = '22rem';

    var pos = position || 'bottom';
    switch (pos) {
      case 'bottom':
        tooltip.style.top = (rect.bottom + 16) + 'px';
        tooltip.style.left = Math.max(8, rect.left) + 'px';
        break;
      case 'top':
        tooltip.style.top = (rect.top - tooltip.offsetHeight - 16) + 'px';
        tooltip.style.left = Math.max(8, rect.left) + 'px';
        break;
      case 'right':
        tooltip.style.top = rect.top + 'px';
        tooltip.style.left = (rect.right + 16) + 'px';
        break;
      case 'left':
        tooltip.style.top = rect.top + 'px';
        tooltip.style.left = (rect.left - tooltip.offsetWidth - 16) + 'px';
        break;
      case 'center':
        tooltip.style.top = '50%';
        tooltip.style.left = '50%';
        tooltip.style.transform = 'translate(-50%, -50%)';
        break;
    }

    // Keep tooltip on screen
    var tr = tooltip.getBoundingClientRect();
    if (tr.right > window.innerWidth - 8) {
      tooltip.style.left = (window.innerWidth - tr.width - 8) + 'px';
    }
    if (tr.bottom > window.innerHeight - 8) {
      tooltip.style.top = (rect.top - tr.height - 16) + 'px';
    }
  }

  // --- Start / End ---
  function startTour(steps) {
    buildUI();
    currentTour = steps;
    currentStep = 0;
    isActive = true;
    overlay.classList.add('tour-overlay--active');
    goToStep(0);
  }

  function endTour() {
    isActive = false;
    overlay.classList.remove('tour-overlay--active');
    spotlight.style.display = 'none';
    currentTour = null;
  }

  // ==========================================================================
  // Tour Definitions
  // ==========================================================================

  var TOURS = {};

  // --- General site tour (everyone) ---
  TOURS.general = [
    { title: 'Welcome to Samuel\'s Sermons', text: 'This quick tour will show you around the site. Use the arrow keys or buttons to navigate.', target: null, position: 'center' },
    { title: 'Navigation', text: 'Use these links to move between the main pages — Home, Sermons, About, and your Saved items.', target: '.site-header__group', position: 'bottom' },
    { title: 'Settings', text: 'Click the gear icon to access settings like theme (light/dark), offline mode, and account options.', target: '.site-header__gear', position: 'bottom' },
    { title: 'Sermons Collection', text: 'The Sermons page shows all available sermons in a card grid. You can search, filter by type, and filter by collection.', target: null, position: 'center' },
    { title: 'Bookmark & Highlight', text: 'On any sermon detail page, you can bookmark the sermon or highlight passages from the transcription — like marking verses in a Bible.', target: null, position: 'center' },
    { title: 'Share', text: 'Use the Share button on any sermon card to copy the link or share via social media.', target: null, position: 'center' },
    { title: 'Activity Feed', text: 'Follow the project\'s progress via the Activity Feed in the footer. You can subscribe via RSS to get notified of new uploads and transcriptions.', target: '.site-footer', position: 'top' },
    { title: 'That\'s it!', text: 'Explore the sermons, save your favorites, and if you\'d like to help transcribe, reach out to admin@samuelsermons.com. Thank you for visiting!', target: null, position: 'center' },
  ];

  // --- Transcriber tour ---
  TOURS.transcriber = [
    { title: 'Transcriber Tour', text: 'As a transcriber, you help digitize Rev. Starling\'s sermons. This tour walks you through the process.', target: null, position: 'center' },
    { title: 'Dashboard', text: 'Your dashboard shows quick links to the transcription workbench, review queue, and sermon management.', target: null, position: 'center' },
    { title: 'Transcription Queue', text: 'The Transcription Workbench link takes you to a list of sermons sorted by priority. Pick one to start transcribing.', target: null, position: 'center' },
    { title: 'The Workbench', text: 'The workbench shows the scanned PDF on the left and a text editor on the right. Type what you see in the scan.', target: null, position: 'center' },
    { title: 'Auto-Save', text: 'Your work saves automatically every 10 seconds. You can also press Ctrl+S to save manually. The indicator shows Saved/Unsaved status.', target: null, position: 'center' },
    { title: 'Keyboard Shortcuts', text: 'Tab inserts indentation. Ctrl+` switches focus between the PDF and editor. These help you work faster.', target: null, position: 'center' },
    { title: 'OCR Assist', text: 'The OCR Assist tool can try to read text from the scanned page. It\'s experimental but can help with typewritten text. Look for the OCR Assist button in the workbench toolbar.', target: null, position: 'center' },
    { title: 'Status & Review', text: 'When you\'re done, set the status to "Needs Review". Another team member will review your work for accuracy before it\'s marked complete.', target: null, position: 'center' },
    { title: 'Points & Badges', text: 'You earn points for every sermon you transcribe. Check your profile to see your badges and achievements. Have fun with it!', target: null, position: 'center' },
  ];

  // --- Uploader tour ---
  TOURS.uploader = [
    { title: 'Uploader Tour', text: 'As an uploader, you help scan and add sermon documents to the archive. Here\'s how the process works.', target: null, position: 'center' },
    { title: 'Upload Sermon', text: 'From the dashboard, click "Upload Sermon" to add a new scan. You\'ll fill in the title, type, collection, and upload the PDF file.', target: null, position: 'center' },
    { title: 'Sermon Types', text: 'Each sermon has a type — Sermon, Funeral, Special Day, or you can type a new category. The system remembers new categories for future uploads.', target: null, position: 'center' },
    { title: 'Pipeline Stages', text: 'Sermons move through stages: Raw (just scanned) → Processed (cleaned up) → Transcribed → Final. You can set the initial stage when uploading.', target: null, position: 'center' },
    { title: 'Manage Sermons', text: 'The Manage Sermons page lets you see all sermons, edit metadata, replace PDFs, and move sermons between pipeline stages.', target: null, position: 'center' },
    { title: 'Points', text: 'You earn 50 points per upload and 15 points per stage move. Check your profile to track your progress!', target: null, position: 'center' },
  ];

  // ==========================================================================
  // Public API — exposed on window for the settings panel to call
  // ==========================================================================

  window.SiteTour = {
    start: function (tourName) {
      var steps = TOURS[tourName];
      if (steps) startTour(steps);
    },
    available: Object.keys(TOURS),
  };
})();
