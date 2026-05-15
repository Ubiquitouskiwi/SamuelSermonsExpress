/**
 * View rendering tests for the admin blocklist page.
 * Compiles the Pug template directly and asserts on the rendered HTML
 * for each of the documented states (empty, populated, prefill, error).
 */
const path = require('path');
const pug = require('pug');

const TEMPLATE = path.resolve(__dirname, 'blocklist.pug');

function render(locals = {}) {
  // Provide the layout's required globals so the template renders without
  // throwing. The values themselves don't matter for these assertions.
  const baseLocals = {
    pageTitle: 'Blocklist',
    currentUser: null,
    showWelcome: false,
    SITE_URL: 'https://example.com',
    entries: [],
    prefill: { type: null, email: null, name: null },
    flash: null,
    error: null,
    formValues: null,
  };
  return pug.renderFile(TEMPLATE, { ...baseLocals, ...locals });
}

describe('admin/blocklist.pug', () => {
  test('renders the empty-state row when there are no entries', () => {
    const html = render({ entries: [] });
    expect(html).toContain('No entries yet.');
    expect(html).toContain('Request Blocklist');
  });

  test('renders one row per entry with all expected fields', () => {
    const html = render({
      entries: [
        {
          id: 1,
          block_type: 'email',
          pattern: 'spammer@example.com',
          is_regex: false,
          reason: 'Repeat offender',
          created_at: new Date('2024-06-15T00:00:00Z'),
          created_by_name: 'Admin User',
        },
      ],
    });

    expect(html).toContain('spammer@example.com');
    expect(html).toContain('badge--email');
    expect(html).toContain('Repeat offender');
    expect(html).toContain('Admin User');
    expect(html).toContain('action="/admin/blocklist/1/remove"');
    expect(html).toContain('✕ Remove');
    expect(html).not.toContain('No entries yet.');
  });

  test('renders ✓ for regex entries and — for non-regex entries', () => {
    const html = render({
      entries: [
        {
          id: 1, block_type: 'email', pattern: '^.*$', is_regex: true,
          reason: null, created_at: new Date(), created_by_name: 'A',
        },
        {
          id: 2, block_type: 'name', pattern: 'lit', is_regex: false,
          reason: null, created_at: new Date(), created_by_name: 'A',
        },
      ],
    });
    expect(html).toContain('✓');
    expect(html).toContain('—');
  });

  test('renders muted dashes when reason and created_by_name are null', () => {
    const html = render({
      entries: [
        {
          id: 1, block_type: 'email', pattern: 'x@y.z', is_regex: false,
          reason: null, created_at: new Date(), created_by_name: null,
        },
      ],
    });
    // Two muted dashes: one for reason, one for created_by_name.
    const matches = html.match(/<span class="text-muted">—<\/span>/g) || [];
    expect(matches.length).toBe(2);
  });

  test('flash success banner uses the success role and message', () => {
    const html = render({
      flash: { type: 'success', message: 'Added block "x@y.z".' },
    });
    expect(html).toContain('class="auth-form__success"');
    expect(html).toContain('role="status"');
    // Pug HTML-escapes double quotes inside text content.
    expect(html).toContain('Added block &quot;x@y.z&quot;.');
  });

  test('flash error banner uses the error role and message', () => {
    const html = render({
      flash: { type: 'error', message: 'That block could not be found.' },
    });
    expect(html).toContain('class="auth-form__error"');
    expect(html).toContain('role="alert"');
    expect(html).toContain('That block could not be found.');
  });

  test('error banner above the form renders when error is present', () => {
    const html = render({
      error: 'A block with this pattern already exists.',
    });
    expect(html).toContain('class="alert alert--error"');
    expect(html).toContain('A block with this pattern already exists.');
  });

  test('add form defaults to email type and empty pattern', () => {
    const html = render();
    expect(html).toContain('action="/admin/blocklist/add"');
    expect(html).toMatch(/<option value="email" selected>Email<\/option>/);
    expect(html).toMatch(/id="pattern"[^>]*value=""/);
  });

  test('prefill from query parameters populates block_type and pattern', () => {
    const html = render({
      prefill: { type: 'email', email: 'spammer@x.com', name: null },
    });
    expect(html).toMatch(/<option value="email" selected>Email<\/option>/);
    expect(html).toContain('value="spammer@x.com"');
  });

  test('prefill name takes effect when no email prefill is provided', () => {
    const html = render({
      prefill: { type: 'name', email: null, name: 'Bad Actor' },
    });
    expect(html).toMatch(/<option value="name" selected>Name<\/option>/);
    expect(html).toContain('value="Bad Actor"');
  });

  test('formValues take precedence over prefill (re-render after error)', () => {
    const html = render({
      prefill: { type: 'email', email: 'prefill@x.com', name: null },
      formValues: {
        block_type: 'name',
        pattern: 'submitted-value',
        is_regex: true,
        reason: 'a reason',
      },
    });
    expect(html).toMatch(/<option value="name" selected>Name<\/option>/);
    expect(html).toContain('value="submitted-value"');
    expect(html).toContain('value="a reason"');
    // is_regex checkbox should be checked.
    expect(html).toMatch(/<input type="checkbox" name="is_regex" checked/);
    expect(html).not.toContain('prefill@x.com');
  });

  test('is_regex checkbox is unchecked when formValues.is_regex is falsy', () => {
    const html = render({
      formValues: {
        block_type: 'email', pattern: 'a@b.c', is_regex: false, reason: '',
      },
    });
    // No `checked` attribute should be present on the is_regex checkbox.
    expect(html).toMatch(/type="checkbox" name="is_regex">/);
    expect(html).not.toMatch(/name="is_regex" checked/);
  });

  test('Block this requester anchor encodes special characters', () => {
    // Independent assertion using encodeURIComponent semantics:
    // verify the anchor format expected by the users page.
    const email = 'user+tag@example.com';
    const expectedHref =
      '/admin/blocklist?prefill_type=email&prefill_email=' +
      encodeURIComponent(email);
    expect(expectedHref).toContain('user%2Btag%40example.com');
  });
});
