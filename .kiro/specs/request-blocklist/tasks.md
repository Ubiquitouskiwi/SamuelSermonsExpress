# Implementation Plan: Request Blocklist

## Overview

Implementation proceeds bottom-up. The shared matching module is built first so the contact route and the admin manager can both depend on it. The admin sub-router and its view come next so blocklist entries can be created for testing. The contact handler is wired up last so silent rejection only takes effect once there is a way to manage entries. Finally, the dashboard and users page are updated so admins can discover and reach the new feature. Each task targets a specific file from the design and references the acceptance criteria it satisfies.

Per the user's standing preference, no automated tests are added; the design's manual verification checklist is the test plan. Optional property-based test sub-tasks are not included because the design has no Correctness Properties section.

## Tasks

- [x] 1. Run migration 011 against the local database
  - Execute `node src/db/migrate-011-blocklist.js` so the `request_blocklist` table and `idx_blocklist_type` index exist for development.
  - This is a local dev step only; production deployment of the migration is out of scope for this code change.
  - _Requirements: 1.1_

- [x] 2. Implement the Blocklist_Service module
  - [x] 2.1 Create `src/utils/blocklist.js` with `findMatchingBlock` and `validateRegex`
    - Export `findMatchingBlock({ name, email })` that runs `SELECT id, block_type, pattern, is_regex FROM request_blocklist`, picks the candidate field based on `block_type`, and returns the first matching entry's `id` or `null`.
    - For literal entries (`is_regex = false`), trim and lower-case both the pattern and the candidate, then compare for strict equality.
    - For regex entries (`is_regex = true`), compile with `new RegExp(pattern, 'i')` inside try/catch; on `SyntaxError`, log `console.error('Blocklist regex compile failed for entry ' + id + ': ' + err.message)` and continue with the next row; on success, declare a match when `regex.test(trimmedCandidate)` returns true.
    - Stop iterating on the first match.
    - Export `validateRegex(pattern)` that runs `new RegExp(pattern)` in try/catch and returns the error message on failure or `null` on success.
    - Pull the shared pool from `../db/pool`.
    - _Requirements: 1.1, 3.1, 3.2, 3.3, 3.4, 3.5_

- [x] 3. Build the Blocklist_Manager sub-router
  - [x] 3.1 Scaffold `src/routes/admin/blocklist.js` with `requireRole('admin')` applied to all routes
    - Create the Express router, import `pool` from `../../db/pool`, `requireRole` from `../../middleware/auth`, and `validateRegex` from `../../utils/blocklist`.
    - Apply `router.use(requireRole('admin'))` so every route below is admin-gated and produces the standard 403 page for non-admins.
    - Export the router.
    - _Requirements: 4.3, 5.4, 9.1, 9.2_

  - [x] 3.2 Implement `GET /` to render the management page
    - Query entries with `SELECT b.id, b.block_type, b.pattern, b.is_regex, b.reason, b.created_at, u.display_name AS created_by_name FROM request_blocklist b LEFT JOIN users u ON b.created_by = u.id ORDER BY b.created_at DESC`.
    - Read optional pre-fill query parameters `prefill_email`, `prefill_name`, `prefill_type` and bundle them into a `prefill` object.
    - Read `req.session.flash` and immediately delete it so the message is one-shot.
    - Render `admin/blocklist` with `entries`, `prefill`, `flash`, `error: null`, and `formValues: null` (used when re-rendering after a validation failure).
    - _Requirements: 4.1, 4.2, 7.2_

  - [x] 3.3 Implement `POST /add` to validate and insert a new entry
    - Trim `pattern` and `reason`; coerce `is_regex` to boolean from the form checkbox (`req.body.is_regex === 'on'` or `=== 'true'`).
    - Validate in order: `block_type` must be `'email'` or `'name'`; `pattern` must be 1–500 characters after trim; `reason`, if present, must be at most 500 characters; if `is_regex` is true, call `validateRegex(pattern)` and reject with the engine error message on failure.
    - On any validation failure, re-render `admin/blocklist` (re-fetching `entries`) with an `error` string identifying the invalid field and `formValues` set to the submitted values so the form preserves the admin's input. Do not redirect.
    - On success, run `INSERT INTO request_blocklist (block_type, pattern, is_regex, reason, created_by) VALUES ($1, $2, $3, $4, $5)` with `req.session.userId` as `created_by`.
    - If the insert raises Postgres error code `23505` (unique constraint on `(block_type, pattern)`), re-render with an error stating that a block with this pattern already exists, preserving submitted values.
    - On success, set `req.session.flash = { type: 'success', message: 'Added block "' + pattern + '".' }` and redirect to `/admin/blocklist`.
    - _Requirements: 1.2, 1.3, 1.4, 1.5, 1.6, 6.2, 6.3, 6.4_

  - [x] 3.4 Implement `POST /:id/remove` to delete an entry
    - Parse `id` as an integer; if it is not a valid integer, set an error flash and redirect to `/admin/blocklist`.
    - Run `DELETE FROM request_blocklist WHERE id = $1 RETURNING pattern`.
    - If `rowCount === 0`, set `req.session.flash = { type: 'error', message: 'That block could not be found.' }` and redirect.
    - Otherwise, set `req.session.flash = { type: 'success', message: 'Removed block "' + result.rows[0].pattern + '".' }` and redirect.
    - _Requirements: 5.1, 5.2, 5.3_

- [x] 4. Mount the sub-router from `src/routes/admin.js`
  - Add `router.use('/blocklist', require('./admin/blocklist'));` alongside the other sub-router mounts (`users`, `sermons`, `transcribe`, `reviews`, `misc`).
  - Confirm the new mount sits before the catch-all `router.use('/', require('./admin/misc'))` so its paths are matched first.
  - _Requirements: 4.1, 5.1, 6.2, 9.1_

- [x] 5. Build the Blocklist_Page view
  - [x] 5.1 Create `src/views/admin/blocklist.pug` extending the standard layout
    - Render a header with a title, the standard `hr.divider.divider--center`, and a short description.
    - Render a flash banner at the top using `flash.type` and `flash.message` when `flash` is present, mirroring the `success`/`error` banner pattern used elsewhere in `views/admin`.
    - _Requirements: 5.2, 6.2_

  - [x] 5.2 Render the add form with pre-fill and error handling
    - Build a single `form(method='POST' action='/admin/blocklist/add')` containing: a `block_type` select with `email` and `name` options, a `pattern` text input with `maxlength='500'`, an `is_regex` checkbox, a `reason` text input with `maxlength='500'`, and a submit button.
    - Default `block_type` to `(formValues && formValues.block_type) || prefill.type || 'email'`.
    - Default `pattern` to `(formValues && formValues.pattern) || prefill.email || prefill.name || ''`.
    - Default `is_regex` checked state to `formValues && formValues.is_regex` (false otherwise; pre-fill from the users page never sets this).
    - Default `reason` to `(formValues && formValues.reason) || ''`.
    - Render an `.alert.alert--error` banner above the form when `error` is truthy, showing the validation or duplicate or regex-compile message.
    - _Requirements: 6.1, 6.3, 6.4, 7.2_

  - [x] 5.3 Render the existing-entries table with a remove control per row
    - Iterate `entries` and render a row per entry showing pattern, type (as a badge), regex flag (`✓` or `—`), reason (or `—` when null), `created_by_name` (or `—` when null), and `created_at` formatted with `toLocaleDateString`.
    - In the actions column, render a small `form(method='POST' action='/admin/blocklist/' + entry.id + '/remove')` with a submit button styled like the deactivate/activate buttons in `views/admin/users.pug`.
    - When `entries.length === 0`, render a single empty-state row reading "No entries yet."
    - _Requirements: 4.1, 4.2, 5.1_

- [x] 6. Wire the silent rejection into the contact handler
  - In `src/routes/contact.js`, import `findMatchingBlock` from `../utils/blocklist`.
  - Inside the `POST /` handler, after validation passes and after destructuring `name`, `email`, `role`, and `message`, and inside the existing outer try/catch, call `const matchedId = await findMatchingBlock({ name, email });` before the `INSERT INTO access_requests` call.
  - If `matchedId !== null`: call `await logEvent('access_request_blocked', 'Blocked access request from ' + name, 'Email: ' + email + '; matched blocklist entry ' + matchedId, null, null)` and `return res.render('contact', { error: null, success: 'Thanks! Your request has been sent. We\'ll be in touch soon.', pageTitle: 'Join the Team' });` — using the exact same success message string already in the handler so the rendered page is byte-identical.
  - Do not call the existing `INSERT INTO access_requests` or the `access_request` `logEvent` when `matchedId !== null`.
  - Leave the existing accepted-path code unchanged so non-blocked submissions continue to be inserted and logged as before.
  - _Requirements: 2.1, 2.2, 2.3, 2.4, 8.1_

- [x] 7. Add the "Block this requester" pre-fill link to the users page
  - In `src/views/admin/users.pug`, inside the actions column of each pending Access_Request row (the `each r in requests` loop), add a third action after the existing Approve and Deny forms.
  - Render an anchor: `a.btn.btn--small.btn--outline(href='/admin/blocklist?prefill_type=email&prefill_email=' + encodeURIComponent(r.email) data-tooltip='Pre-fill the blocklist add form with this email') ⛔ Block`.
  - _Requirements: 7.1, 7.2_

- [x] 8. Add the Blocklist link to the admin dashboard
  - In `src/views/admin/dashboard.pug`, inside the Administration card (`.dashboard-card.dashboard-card--admin`, gated by `currentUser.roles.includes('admin')`), add `a.btn.btn--outline(href='/admin/blocklist') Blocklist` to the `.dashboard-card__actions` block alongside Users, Activity Log, Birthday Messages, and Create Account.
  - _Requirements: 4.1_

- [x] 9. Final checkpoint
  - Walk through the manual verification checklist in `design.md` (sections "Manual Verification" and "Edge cases worth probing") and confirm each scenario behaves as designed.
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped. There are no optional sub-tasks in this plan because the user does not want automated tests added and the design includes no formal correctness properties; the design's manual verification checklist is the only test plan.
- Each task references the specific acceptance criteria it satisfies for traceability.
- Task 1 is a one-time local setup step; it must run before tasks 6 and 9 can be exercised.
- Task 4 must follow task 3 so the sub-router exists before it is mounted.
- Task 6 must follow task 2 so `findMatchingBlock` exists before the contact handler imports it; it should follow task 5 in practice so a blocklist entry can be created in the UI for the manual verification scenarios.
