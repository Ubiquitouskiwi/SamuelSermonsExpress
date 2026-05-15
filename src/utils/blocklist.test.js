/**
 * Unit tests for the blocklist service.
 */

// Mock the pg pool before requiring the module under test.
jest.mock('../db/pool', () => ({ query: jest.fn() }));

const pool = require('../db/pool');
const { findMatchingBlock, validateRegex } = require('./blocklist');

beforeEach(() => {
  pool.query.mockReset();
  jest.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  console.error.mockRestore();
});

describe('validateRegex', () => {
  test('returns null for a valid regex pattern', () => {
    expect(validateRegex('^foo$')).toBeNull();
    expect(validateRegex('.*@example\\.com')).toBeNull();
    expect(validateRegex('')).toBeNull(); // empty regex compiles to a no-op
  });

  test('returns the engine error message for an invalid pattern', () => {
    const err = validateRegex('[unterminated');
    expect(typeof err).toBe('string');
    expect(err.length).toBeGreaterThan(0);
  });

  test('returns the engine error message for an unbalanced group', () => {
    const err = validateRegex('(unbalanced');
    expect(typeof err).toBe('string');
    expect(err.length).toBeGreaterThan(0);
  });
});

describe('findMatchingBlock', () => {
  test('issues SELECT with deterministic ORDER BY id ASC', async () => {
    pool.query.mockResolvedValue({ rows: [] });
    await findMatchingBlock({ name: 'a', email: 'b@c.com' });
    expect(pool.query).toHaveBeenCalledTimes(1);
    expect(pool.query.mock.calls[0][0]).toMatch(/ORDER BY id ASC/);
  });

  test('returns null when there are no entries', async () => {
    pool.query.mockResolvedValue({ rows: [] });
    const id = await findMatchingBlock({ name: 'Anyone', email: 'a@b.com' });
    expect(id).toBeNull();
  });

  test('matches a literal email entry exactly', async () => {
    pool.query.mockResolvedValue({
      rows: [
        { id: 7, block_type: 'email', pattern: 'spammer@example.com', is_regex: false },
      ],
    });
    const id = await findMatchingBlock({ name: 'whoever', email: 'spammer@example.com' });
    expect(id).toBe(7);
  });

  test('literal email match is case-insensitive', async () => {
    pool.query.mockResolvedValue({
      rows: [
        { id: 7, block_type: 'email', pattern: 'spammer@example.com', is_regex: false },
      ],
    });
    const id = await findMatchingBlock({ name: '', email: 'SPAMMER@Example.COM' });
    expect(id).toBe(7);
  });

  test('literal email match tolerates surrounding whitespace on candidate and pattern', async () => {
    pool.query.mockResolvedValue({
      rows: [
        { id: 7, block_type: 'email', pattern: '  spammer@example.com  ', is_regex: false },
      ],
    });
    const id = await findMatchingBlock({ name: '', email: '  spammer@example.com\t' });
    expect(id).toBe(7);
  });

  test('returns null when the literal email pattern does not match', async () => {
    pool.query.mockResolvedValue({
      rows: [
        { id: 7, block_type: 'email', pattern: 'spammer@example.com', is_regex: false },
      ],
    });
    const id = await findMatchingBlock({ name: '', email: 'someone@else.com' });
    expect(id).toBeNull();
  });

  test('matches a literal name entry case-insensitively', async () => {
    pool.query.mockResolvedValue({
      rows: [
        { id: 12, block_type: 'name', pattern: 'Bad Actor', is_regex: false },
      ],
    });
    const id = await findMatchingBlock({ name: 'bad actor', email: 'foo@bar.com' });
    expect(id).toBe(12);
  });

  test('an email-typed entry does not match against the name field', async () => {
    pool.query.mockResolvedValue({
      rows: [
        // Pattern looks like a name but is typed as email.
        { id: 1, block_type: 'email', pattern: 'Bad Actor', is_regex: false },
      ],
    });
    const id = await findMatchingBlock({ name: 'Bad Actor', email: 'unrelated@x.com' });
    expect(id).toBeNull();
  });

  test('a name-typed entry does not match against the email field', async () => {
    pool.query.mockResolvedValue({
      rows: [
        { id: 1, block_type: 'name', pattern: 'evil@spam.tld', is_regex: false },
      ],
    });
    const id = await findMatchingBlock({ name: 'innocent', email: 'evil@spam.tld' });
    expect(id).toBeNull();
  });

  test('literal pattern with regex metacharacters is matched verbatim', async () => {
    pool.query.mockResolvedValue({
      rows: [
        { id: 9, block_type: 'name', pattern: '.*', is_regex: false },
      ],
    });
    // ".*" should NOT match "anything"; it should only match the literal string ".*".
    expect(await findMatchingBlock({ name: 'anything', email: '' })).toBeNull();
    expect(await findMatchingBlock({ name: '.*', email: '' })).toBe(9);
  });

  test('matches a regex email entry', async () => {
    pool.query.mockResolvedValue({
      rows: [
        { id: 5, block_type: 'email', pattern: '^.*@spam\\.tld$', is_regex: true },
      ],
    });
    const id = await findMatchingBlock({ name: '', email: 'anything@spam.tld' });
    expect(id).toBe(5);
  });

  test('regex match is case-insensitive (default i flag)', async () => {
    pool.query.mockResolvedValue({
      rows: [
        { id: 5, block_type: 'email', pattern: '^.*@spam\\.tld$', is_regex: true },
      ],
    });
    const id = await findMatchingBlock({ name: '', email: 'ANYTHING@SPAM.TLD' });
    expect(id).toBe(5);
  });

  test('returns null when regex does not match', async () => {
    pool.query.mockResolvedValue({
      rows: [
        { id: 5, block_type: 'email', pattern: '^.*@spam\\.tld$', is_regex: true },
      ],
    });
    const id = await findMatchingBlock({ name: '', email: 'real@example.com' });
    expect(id).toBeNull();
  });

  test('regex compile failure logs entry id and continues to next entry', async () => {
    pool.query.mockResolvedValue({
      rows: [
        { id: 1, block_type: 'email', pattern: '[unterminated', is_regex: true },
        { id: 2, block_type: 'email', pattern: 'good@example.com', is_regex: false },
      ],
    });
    const id = await findMatchingBlock({ name: '', email: 'good@example.com' });
    expect(id).toBe(2);
    expect(console.error).toHaveBeenCalledWith(
      expect.stringMatching(/^Blocklist regex compile failed for entry 1: /)
    );
  });

  test('all-bad regex entries with no other matches returns null and logs each', async () => {
    pool.query.mockResolvedValue({
      rows: [
        { id: 1, block_type: 'email', pattern: '[bad', is_regex: true },
        { id: 2, block_type: 'name', pattern: '(bad', is_regex: true },
      ],
    });
    const id = await findMatchingBlock({ name: 'x', email: 'y@z.com' });
    expect(id).toBeNull();
    expect(console.error).toHaveBeenCalledTimes(2);
  });

  test('returns first matching entry id and stops iterating', async () => {
    pool.query.mockResolvedValue({
      rows: [
        { id: 1, block_type: 'email', pattern: 'spammer@example.com', is_regex: false },
        { id: 2, block_type: 'email', pattern: 'spammer@example.com', is_regex: false },
      ],
    });
    const id = await findMatchingBlock({ name: '', email: 'spammer@example.com' });
    expect(id).toBe(1);
  });

  test('handles missing name/email fields without throwing', async () => {
    pool.query.mockResolvedValue({
      rows: [
        { id: 1, block_type: 'name', pattern: 'whatever', is_regex: false },
      ],
    });
    // Empty req object — should treat name and email as ''.
    const id = await findMatchingBlock({});
    expect(id).toBeNull();
  });

  test('handles null req gracefully', async () => {
    pool.query.mockResolvedValue({ rows: [] });
    const id = await findMatchingBlock(null);
    expect(id).toBeNull();
  });

  test('propagates database errors so the caller can render its generic error page', async () => {
    pool.query.mockRejectedValue(new Error('connection refused'));
    await expect(findMatchingBlock({ name: 'a', email: 'b@c.com' })).rejects.toThrow(
      'connection refused'
    );
  });
});
