# Requirements Document

## Introduction

Samuel Sermons is a memorial website with admin-approved signups, where prospective members submit an access request through a public contact form. The form is being abused by a repeat spammer. This feature adds a blocklist that lets administrators silently drop submitted access requests whose name or email matches a configured pattern. Each entry may be a literal string or a regular expression, may include a reason, and can be added or removed by an admin. Blocked submissions still render the same success page so the sender does not learn that their submission was rejected.

## Glossary

- **Access_Request**: A submission to the public contact form (`POST /contact`) consisting of a name, email, role, and optional message.
- **Access_Request_Handler**: The route handler at `POST /contact` that validates and persists access requests.
- **Blocklist_Entry**: A row in the `request_blocklist` table consisting of `block_type` ("email" or "name"), `pattern` (string up to 500 characters), `is_regex` (boolean), optional `reason` (string up to 500 characters), `created_by` (admin user id), and `created_at` (timestamp).
- **Blocklist_Service**: The server-side module that loads blocklist entries and decides whether a given Access_Request matches any entry.
- **Blocklist_Manager**: The admin-facing routes and views that allow listing, adding, and removing Blocklist_Entries.
- **Admin**: A logged-in user whose role string contains "admin".
- **Match**: For a literal entry, an equality comparison between the Blocklist_Entry pattern and the corresponding Access_Request field, performed case-insensitively after trimming surrounding whitespace. For a regex entry, a successful test of the compiled JavaScript regular expression (with the case-insensitive flag) against the corresponding Access_Request field.
- **Silent_Rejection**: The behavior where a blocked Access_Request is discarded without persisting, no error is shown to the sender, and the same success page is rendered as for an accepted request.

## Requirements

### Requirement 1: Persist Blocklist Entries

**User Story:** As an admin, I want blocklist entries stored in the database, so that blocking decisions persist across application restarts.

#### Acceptance Criteria

1. THE Blocklist_Service SHALL read Blocklist_Entries from the `request_blocklist` table created by migration 011.
2. WHEN an admin adds a Blocklist_Entry, THE Blocklist_Manager SHALL insert a row into the `request_blocklist` table with `block_type`, `pattern`, `is_regex`, optional `reason`, and the admin's user id as `created_by`.
3. IF a submitted Blocklist_Entry has the same `block_type` and `pattern` as an existing row, THEN THE Blocklist_Manager SHALL reject the submission and render an error message identifying the duplicate.
4. THE Blocklist_Manager SHALL accept only `"email"` or `"name"` as values for `block_type`.
5. THE Blocklist_Manager SHALL require `pattern` to be a non-empty string of at most 500 characters after trimming surrounding whitespace.
6. WHERE a `reason` field is provided, THE Blocklist_Manager SHALL accept a string of at most 500 characters.

### Requirement 2: Silently Reject Blocked Access Requests

**User Story:** As an admin, I want submissions matching the blocklist to be discarded silently, so that spammers are not informed that their request was blocked.

#### Acceptance Criteria

1. WHEN an Access_Request is submitted, THE Access_Request_Handler SHALL ask the Blocklist_Service whether the Access_Request matches any Blocklist_Entry before inserting into the `access_requests` table.
2. IF an Access_Request matches at least one Blocklist_Entry, THEN THE Access_Request_Handler SHALL omit the insert into `access_requests`.
3. IF an Access_Request matches at least one Blocklist_Entry, THEN THE Access_Request_Handler SHALL render the same success page that is rendered for an accepted Access_Request, including the same success message text.
4. IF an Access_Request matches at least one Blocklist_Entry, THEN THE Access_Request_Handler SHALL omit the `access_request` event written by `logEvent` for accepted requests.

### Requirement 3: Match Access Requests Against Blocklist Entries

**User Story:** As an admin, I want each blocklist entry to match the right field with the right semantics, so that I can target either an email or a name and choose between literal and regex matching.

#### Acceptance Criteria

1. WHERE a Blocklist_Entry has `block_type = "email"`, THE Blocklist_Service SHALL compare the entry's pattern against the Access_Request `email` field only.
2. WHERE a Blocklist_Entry has `block_type = "name"`, THE Blocklist_Service SHALL compare the entry's pattern against the Access_Request `name` field only.
3. WHERE a Blocklist_Entry has `is_regex = false`, THE Blocklist_Service SHALL declare a Match when the trimmed, lower-cased pattern equals the trimmed, lower-cased value of the targeted Access_Request field.
4. WHERE a Blocklist_Entry has `is_regex = true`, THE Blocklist_Service SHALL compile the pattern as a JavaScript regular expression with the case-insensitive flag and SHALL declare a Match when the compiled expression's `test` method returns true for the targeted Access_Request field.
5. IF a Blocklist_Entry with `is_regex = true` has a pattern that fails to compile as a JavaScript regular expression, THEN THE Blocklist_Service SHALL skip that entry, write an error message to the server log identifying the entry id, and continue evaluating the remaining entries.

### Requirement 4: List Existing Blocklist Entries

**User Story:** As an admin, I want to view every blocklist entry, so that I can audit who is blocked and why.

#### Acceptance Criteria

1. WHEN an Admin requests the blocklist page, THE Blocklist_Manager SHALL render every Blocklist_Entry showing `id`, `block_type`, `pattern`, `is_regex`, `reason`, the display name of the creating Admin, and `created_at`.
2. THE Blocklist_Manager SHALL order rendered Blocklist_Entries by `created_at` in descending order.
3. IF a request to the blocklist page is made by a user whose role string does not contain "admin", THEN THE Blocklist_Manager SHALL respond with HTTP status 403 and render the standard access-denied page.

### Requirement 5: Remove Blocklist Entries

**User Story:** As an admin, I want to remove a blocklist entry, so that I can unblock someone who was blocked in error.

#### Acceptance Criteria

1. WHEN an Admin submits a removal action for a Blocklist_Entry id, THE Blocklist_Manager SHALL delete the matching row from the `request_blocklist` table.
2. WHEN a removal action completes successfully, THE Blocklist_Manager SHALL redirect the Admin back to the blocklist page and display a confirmation message identifying the removed pattern.
3. IF a removal action references a Blocklist_Entry id that does not exist, THEN THE Blocklist_Manager SHALL redirect the Admin back to the blocklist page and display an error message stating that the entry was not found.
4. IF a removal action is requested by a user whose role string does not contain "admin", THEN THE Blocklist_Manager SHALL respond with HTTP status 403 and render the standard access-denied page.

### Requirement 6: Add Blocklist Entries from the Manager Page

**User Story:** As an admin, I want to add a new blocklist entry from the blocklist page, so that I can block a sender without leaving the management view.

#### Acceptance Criteria

1. WHEN an Admin opens the blocklist page, THE Blocklist_Manager SHALL render a form with fields for `block_type`, `pattern`, `is_regex`, and `reason`.
2. WHEN an Admin submits the add form with a valid Blocklist_Entry, THE Blocklist_Manager SHALL persist the entry per Requirement 1 and redirect the Admin back to the blocklist page with a confirmation message identifying the new pattern.
3. IF an Admin submits the add form with `is_regex = true` and a pattern that fails to compile as a JavaScript regular expression, THEN THE Blocklist_Manager SHALL reject the submission, render an error message containing the JavaScript engine's error description, and preserve the Admin's submitted form values.
4. IF an Admin submits the add form with a missing or invalid field per Requirement 1 acceptance criteria 4 through 6, THEN THE Blocklist_Manager SHALL reject the submission, render an error message identifying the invalid field, and preserve the Admin's other submitted values.

### Requirement 7: Pre-Fill the Add Form from a Pending Access Request

**User Story:** As an admin, I want a one-click "Block this requester" action on each pending access request, so that I can block a sender without retyping the email address.

#### Acceptance Criteria

1. THE Manage_Users_Page SHALL render a "Block this requester" control next to each pending Access_Request.
2. WHEN an Admin activates the "Block this requester" control for a pending Access_Request, THE Blocklist_Manager SHALL render the add form with `block_type` pre-set to `"email"`, `pattern` pre-set to the Access_Request email, and `is_regex` pre-set to false.

### Requirement 8: Log Blocked Submissions

**User Story:** As an admin, I want blocked submissions logged, so that I can review blocking activity in the activity log.

#### Acceptance Criteria

1. IF an Access_Request matches at least one Blocklist_Entry, THEN THE Access_Request_Handler SHALL call `logEvent` with `event_type = "access_request_blocked"`, a title identifying the blocked sender, and a description identifying the matched Blocklist_Entry id.

### Requirement 9: Restrict Blocklist Management to Admins

**User Story:** As a site owner, I want only admins to manage the blocklist, so that non-admin users cannot block or unblock other users.

#### Acceptance Criteria

1. THE Blocklist_Manager SHALL apply the `requireRole("admin")` middleware to every route that lists, adds, or removes Blocklist_Entries.
2. IF a user whose role string does not contain "admin" requests any Blocklist_Manager route, THEN THE Blocklist_Manager SHALL respond with HTTP status 403 and render the standard access-denied page.
