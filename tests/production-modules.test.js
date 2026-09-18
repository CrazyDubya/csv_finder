const { csvParse, parseRows } = require('../d3-csv.js');
const { fetchTextWithTimeout, inferColumnType, isValidIsoDate } = require('../utils.js');

describe('production CSV parser', () => {
  test('handles RFC 4180 quoting, commas, escaped quotes, and multiline fields', () => {
    const csv = 'Name,Note\r\nAlice,"first line\r\nsecond, line"\r\nBob,"He said ""hello"""';
    expect(csvParse(csv)).toEqual([
      { Name: 'Alice', Note: 'first line\r\nsecond, line' },
      { Name: 'Bob', Note: 'He said "hello"' }
    ]);
  });

  test('preserves spaces and literal quotes in tolerant unquoted input', () => {
    expect(csvParse('Item,Note\n5" pipe,  keep  ')).toEqual([
      { Item: '5" pipe', Note: '  keep  ' }
    ]);
  });

  test('handles BOM, empty fields, CRLF, LF, and a trailing newline', () => {
    expect(csvParse('\uFEFFName,City,Note\r\nAlice,,x\nBob,NY,\n')).toEqual([
      { Name: 'Alice', City: '', Note: 'x' },
      { Name: 'Bob', City: 'NY', Note: '' }
    ]);
  });

  test('reports malformed input instead of silently dropping records', () => {
    expect(() => csvParse('A,B\n1')).toThrow('Record 2 has 1 fields; expected 2');
    expect(() => parseRows('A,B\n1,"oops')).toThrow('Unclosed quoted field');
  });
});

describe('production date inference', () => {
  test.each(['2024-02-29', '2026-01-01T12:30', '2026-01-01T12:30:59.123Z', '2026-01-01T12:30+05:30'])(
    'accepts valid ISO value %s', value => expect(isValidIsoDate(value)).toBe(true)
  );

  test.each(['2026-02-29', '2026-99-99', '2026-01-01T+', '2026-01-01T25:00', '09/18/2026', 'January'])(
    'rejects invalid or unsupported value %s', value => expect(isValidIsoDate(value)).toBe(false)
  );

  test('only infers dates when every nonempty value is valid', () => {
    expect(inferColumnType(['2024-02-29', '2026-01-01'])).toBe('date');
    expect(inferColumnType(['2026-01-01', '2026-99-99'])).toBe('string');
    expect(inferColumnType(['1', '2.5'])).toBe('number');
  });
});

describe('production URL timeout', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  test('keeps the timeout active while the response body is downloading', async () => {
    const fetchImpl = jest.fn(async (url, { signal }) => ({
      ok: true,
      text: () => new Promise((resolve, reject) => {
        signal.addEventListener('abort', () => reject(Object.assign(new Error('aborted'), { name: 'AbortError' })));
      })
    }));

    const pending = fetchTextWithTimeout('https://example.test/data.csv', 10000, fetchImpl);
    await Promise.resolve();
    jest.advanceTimersByTime(10000);
    await expect(pending).rejects.toMatchObject({ name: 'AbortError' });
  });

  test('returns completed bodies and reports HTTP failures', async () => {
    await expect(fetchTextWithTimeout('ok', 10000, async () => ({
      ok: true,
      text: async () => 'A,B\n1,2'
    }))).resolves.toBe('A,B\n1,2');
    await expect(fetchTextWithTimeout('bad', 10000, async () => ({
      ok: false,
      status: 503
    }))).rejects.toThrow('HTTP error! status: 503');
  });
});
