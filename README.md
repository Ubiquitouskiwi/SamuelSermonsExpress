# Samuel's Sermons

A community-driven document digitization platform built with Node.js, Express, and PostgreSQL. Originally created to preserve and transcribe the sermon collection of Rev. Samuel Starling, this project can be adapted for any document archive that needs volunteer-powered transcription.

## What It Does

- **Document Archive** — Browse, search, and filter scanned documents in a responsive card grid with lazy loading
- **Transcription Workbench** — Side-by-side PDF viewer and text editor with auto-save, keyboard shortcuts, and client-side OCR assist (Tesseract.js)
- **Peer Review** — Completed transcriptions go through review with inline comments and approve/reject workflow
- **Gamification** — Points, 7 badge tiers, 53 achievements, leaderboard, and public profiles to motivate volunteers
- **Role-Based Access** — Admin, transcriber, uploader, developer, and user roles with multi-role support
- **S3-Compatible Storage** — Upload PDFs directly to DigitalOcean Spaces (or any S3-compatible provider) with pipeline stage management
- **RSS Feed** — Public activity feed for new uploads and completed transcriptions
- **Offline Mode** — Optional service worker for offline browsing
- **Dark/Light Theme** — Manual toggle or auto (follows OS), synced to DB for logged-in users
- **Guided Tours** — Role-specific onboarding tours for new team members
- **Issue Tracker** — Built-in bug/feature reporting

## Tech Stack

- **Runtime:** Node.js 18+
- **Framework:** Express.js
- **Views:** Pug templates
- **Database:** PostgreSQL 14+
- **Storage:** DigitalOcean Spaces (S3-compatible)
- **Auth:** Session-based with bcrypt, connect-pg-simple
- **Security:** Helmet, rate limiting, input validation, CSP
- **OCR:** Tesseract.js (client-side, zero server load)
- **CSS:** Custom modular architecture with CSS variables, no frameworks

## Quick Start

### Prerequisites

- Node.js 18+
- PostgreSQL 14+
- An S3-compatible storage bucket (DigitalOcean Spaces, AWS S3, MinIO, etc.)

### Setup

```bash
git clone https://github.com/Ubiquitouskiwi/SamuelSermonsExpress.git
cd SamuelSermonsExpress
npm install
cp .env.example .env
```

Edit `.env` with your database connection string, session secret, and storage credentials.

### Database Setup

```bash
npm run db:migrate
npm run db:seed
```

This creates all tables and seeds an initial admin account.

### Additional Migrations

Run these in order after the initial migration:

```bash
node src/db/migrate-002-password-change.js
node src/db/migrate-003-events.js
node src/db/migrate-004-preferences.js
node src/db/migrate-005-points.js
node src/db/migrate-006-reviews.js
node src/db/migrate-007-public-profile.js
node src/db/migrate-008-access-requests.js
node src/db/migrate-009-issues.js
```

### Run

```bash
# Development (with auto-reload)
npm run devstart

# Production
npm start
```

The app runs on `http://localhost:3000` by default.

## Environment Variables

| Variable | Description |
|----------|-------------|
| `DATABASE_URL` | PostgreSQL connection string |
| `SESSION_SECRET` | Random string for session encryption |
| `DO_SPACES_KEY` | S3-compatible storage access key |
| `DO_SPACES_SECRET` | Storage secret key |
| `DO_SPACES_ENDPOINT` | Storage endpoint URL |
| `DO_SPACES_BUCKET` | Bucket name |
| `DO_SPACES_CDN` | CDN URL for the bucket |
| `PORT` | Server port (default: 3000) |
| `NODE_ENV` | `development` or `production` |
| `SITE_URL` | Public URL (for RSS, sitemap, OG tags) |
| `ADMIN_EMAIL` | Email for the seeded admin account |
| `ADMIN_PASSWORD` | Temporary password for the seeded admin |
| `CREATOR_EMAIL` | (Optional) Email that gets the unique creator avatar |

## Project Structure

```
src/
├── app.js                  # Express app, middleware, routes
├── bin/www                 # Server entry point
├── controllers/            # Route handlers
├── db/                     # Pool, migrations, seed
├── middleware/             # Auth, upload
├── public/
│   ├── javascripts/        # Client-side JS
│   └── stylesheets/        # Modular CSS
├── routes/                 # Express routes
├── utils/                  # Helpers (points, achievements, avatars, events, spaces)
└── views/                  # Pug templates
    ├── admin/              # Dashboard, management, transcription, reviews
    ├── auth/               # Login, register, change password
    └── issues/             # Issue tracker
```

## Roles & Permissions

| Role | Access |
|------|--------|
| Admin | Full access — user management, all tools, delete |
| Transcriber | Transcription workbench, peer review |
| Uploader | Upload documents, manage pipeline stages |
| Developer | Issue tracker, activity log |
| User | Basic — settings, preferences, bookmarks |

Users can have multiple roles (e.g. `transcriber,uploader`).

## Adapting for Your Project

This was built for a sermon archive but works for any document digitization:

1. Replace sermon-specific language in views
2. Update the data model for your document metadata
3. Configure your S3-compatible storage provider
4. Customize theme colors in `src/public/stylesheets/tokens.css`
5. Update the about page content

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

## License

MIT — see [LICENSE](LICENSE).
