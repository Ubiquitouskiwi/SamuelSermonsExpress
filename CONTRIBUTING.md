# Contributing

Thanks for your interest in contributing to this project!

## Getting Started

1. Fork the repository
2. Clone your fork locally
3. Run `npm install`
4. Copy `.env.example` to `.env` and fill in your local database credentials
5. Run `npm run db:migrate` and all migration scripts
6. Run `npm run db:seed` to create an admin account
7. Start the dev server with `npm run devstart`

## Development Guidelines

- This is a Node.js/Express app using Pug templates and vanilla CSS/JS (no frameworks)
- Keep CSS modular — each feature gets its own stylesheet imported in `index.css`
- Client-side JS should be vanilla (no build step, no bundler)
- Use the existing patterns for routes, controllers, and middleware
- All database changes need a numbered migration file in `src/db/`

## Submitting Changes

1. Create a feature branch from `main`
2. Make your changes with clear, descriptive commits
3. Test that the app loads and existing features still work
4. Submit a pull request with a description of what you changed and why

## Reporting Issues

Use the built-in issue tracker at `/issues/new` when logged in, or open a GitHub issue.

## Code Style

- 2-space indentation
- Single quotes for strings
- Semicolons
- `var` in client-side JS for broad browser compatibility
- `const`/`let` in server-side Node.js code
- Descriptive variable names over comments

## Architecture Decisions

- No frontend frameworks — keeps it simple, fast, and accessible
- Server-side rendering with Pug — works without JavaScript enabled (except interactive features)
- PostgreSQL for everything (sessions, data, events, points) — one database, no Redis needed
- Client-side OCR — keeps the server lightweight, works on small VPS instances
- CSS custom properties for theming — one set of tokens, dark mode is just variable overrides
