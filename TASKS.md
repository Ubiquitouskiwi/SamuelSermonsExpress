# Samuel's Sermons — Development Task List

## Phase 1 — Database + Auth + Security ✅

- [x] PostgreSQL schema (users, sermons, session, permissions, sermon_events, user_points, sermon_reviews, review_comments)
- [x] Migration scripts (001–006) + seed script
- [x] Sermon controller queries DB with hardcoded fallback
- [x] Session-based auth with bcrypt + connect-pg-simple
- [x] Multi-role system: admin, transcriber, uploader, developer (comma-separated)
- [x] Extensible permissions table
- [x] Helmet, rate limiting (relaxed in dev), input validation
- [x] Fixed null sermon crash, removed dead routes, fixed port mismatch

## Phase 1.5 — User Management ✅

- [x] `/admin/users` — list, edit, activate/deactivate with icon actions
- [x] Force password change flow (must_change_password flag + middleware)
- [x] New accounts auto-require password change on first login
- [x] Login records last_login_at
- [x] Multi-role support (checkboxes in register + edit forms)
- [x] Role display sorted by permission level (most permissive first)
- [x] Truncated table rows with hover tooltips
- [x] User preferences saved to DB (JSONB column) for logged-in users

## Phase 2 — Admin Portal + Spaces Integration ✅

- [x] DigitalOcean Spaces utility (list, upload, move, delete via @aws-sdk/client-s3)
- [x] PDF upload with multer (50MB max, PDF-only filter)
- [x] Sermon CRUD: list, add, edit, delete with standardized table rows
- [x] Pipeline stage management (raw → processed → transcribed → final)
- [x] Dynamic sermon type categories (datalist with DB-driven suggestions)
- [x] Dashboard with stats (sermon count, transcribed count, team members)

## Phase 3 — Transcription Workbench ✅

- [x] Split-pane layout: PDF viewer (left) + text editor (right)
- [x] Draggable divider (mouse, touch, keyboard accessible)
- [x] Full viewport width for maximum workspace
- [x] Auto-save every 10s + Ctrl+S manual save
- [x] Save state indicator (Saved/Unsaved/Saving/Error)
- [x] Live word count
- [x] Tab inserts indentation, Shift+Tab removes it
- [x] Ctrl+` switches focus between PDF and editor
- [x] Auto-sets status to "In Progress" when typing starts
- [x] Collapsible notes panel
- [x] Unsaved changes warning on page leave
- [x] Transcription queue with priority sorting
- [x] Responsive: stacks vertically on mobile/tablet

### OCR Assist ✅
- [x] Consent modal with experimental disclaimer + opt-in download
- [x] Progress bar with descriptive status messages
- [x] Client-side Tesseract.js + pdf.js (zero server load)
- [x] PDF-to-canvas rendering with grayscale + contrast preprocessing
- [x] Quality selector: Low (1.5x), Standard (2x), High (3x), Ultra (4x)
- [x] Quality change warning modal with "don't show again" option
- [x] "Select Region" + "Full Page OCR" tools
- [x] Toolbar stays visible permanently once engine is loaded
- [x] "Remove OCR Data" button restores download prompt
- [x] Server-side PDF proxy to avoid CORS issues

### Peer Review System ✅
- [x] Review queue (`/admin/reviews`) — shows sermons needing review (excludes own work)
- [x] Review workbench: split-pane with read-only transcription + comment panel
- [x] Inline comments with passage references (auto-filled from text selection)
- [x] Resolve individual comments
- [x] Approve (→ Complete) or Request Changes (→ back to In Progress)
- [x] Points awarded for reviews (75 pts) and comments (5 pts)
- [x] Review achievements: Peer Reviewer, Quality Guardian

## Points & Achievements System ✅

### Points
- [x] Points table with event log (user_points)
- [x] Cached total on user row for fast display
- [x] Upload: 50 pts + 25 bonus for first upload
- [x] Stage move: 15 pts
- [x] Transcription started: 10 pts + 25 bonus for first
- [x] Transcription complete: 100 pts + 50 bonus for long sermons (2000+ words)
- [x] Review complete: 75 pts + 25 bonus for first review
- [x] Review comment: 5 pts

### Badge Tiers (point-based)
- [x] 🌱 First Steps (1) → ⭐ Contributor (100) → 🔥 Dedicated (500) → 💎 Devoted (1,000) → 🏛️ Pillar (2,500) → 📜 Legacy Keeper (5,000) → ✝️ Samuel's Scribe (10,000)

### Competitive Achievements (shift based on leader)
- [x] 📤 Top Uploader — most sermon uploads
- [x] ✍️ Top Transcriber — most completed transcriptions
- [x] 📝 Wordsmith — most total words transcribed

### Milestone Achievements
- [x] 🔥 On Fire — 5+ sermons in one day
- [x] ⛪ Sunday Scholar — transcribed on a Sunday
- [x] 🦉 Night Owl — worked midnight–5 AM
- [x] 🐦 Early Bird — worked 5–7 AM
- [x] 📅 Consistent — 3-day streak
- [x] 🗓️ Devoted Worker — 7-day streak
- [x] 🔟 Double Digits — 10 transcriptions
- [x] 🏅 Quarter Century — 25 transcriptions
- [x] 🏃 Marathon — 3,000+ word sermon
- [x] 🔍 Peer Reviewer — first review
- [x] 🛡️ Quality Guardian — 10 reviews

### Profile Page ✅
- [x] `/profile` — user info, point total, stats cards
- [x] Earned badges with gold borders
- [x] Progress bar toward next badge
- [x] All badges reference (earned vs locked)
- [x] Achievements split by Leaderboard + Milestones
- [x] Point history with recent activity

## UI / UX ✅

- [x] Classic memorial design: navy + gold, Lora serif headings, Source Sans body
- [x] Modular CSS architecture (14 stylesheet modules)
- [x] Light/dark/auto theme toggle with localStorage + DB sync for logged-in users
- [x] Settings gear dropdown (role-aware links)
- [x] Navbar: public links | divider | auth links | gear icon
- [x] Monogram brand mark: italic serif "S" in gold circle
- [x] Full-width sermon card grid with lazy loading (IntersectionObserver)
- [x] Advanced filter toolbar: search with grouped suggestions, collection chips, multi-select type chips with counts
- [x] Clickable sermon cards + share popup (Copy Link, Facebook, X, Email + native share on mobile)
- [x] Role-aware Transcribe / Request Access buttons on cards
- [x] Full-width sermon detail page with taller PDF viewer
- [x] Transcription status badge in transcription text box
- [x] Bookmark sermons + highlight passages (localStorage)
- [x] Bookmarks page (`/bookmarks`)
- [x] Back-to-top button, skip-to-content link, gold ribbon
- [x] WCAG AA contrast, focus-visible outlines, semantic HTML, prefers-reduced-motion
- [x] Responsive mobile nav with hamburger

## Content & Community ✅

- [x] RSS feed (`/feed/rss`) — public: newly uploaded + newly transcribed only
- [x] Activity feed page with subscribe instructions
- [x] Event logging on all sermon actions
- [x] "What's New" section on about page
- [x] Transcriber recruitment CTA (email admin@samuelsermons.com)

---

## Phase 4 — Search + AI (Future)

### Full-Text Search
- [ ] Add `tsvector` column to sermons table
- [ ] Create search endpoint and UI on public site
- [ ] Search across titles and transcribed text
- [ ] Highlight matching terms in results

### Sermon Chatbot
- [ ] Install `pgvector` extension in PostgreSQL
- [ ] Generate embeddings from transcribed sermon text
- [ ] RAG pipeline: user question → find relevant passages → send to LLM
- [ ] Chat UI on the public site
- [ ] Cite which sermon(s) the answer came from

### Nice-to-Have
- [ ] Reading mode: clean typeset view of transcribed text
- [ ] Sermon collections/tags: browse by theme
- [ ] Audio: text-to-speech of transcribed sermons
- [ ] Favorites/bookmarks synced to DB for logged-in users
- [ ] Public transcription contributions (moderated)
