function parseRow(line) {
  const cells = [];
  let value = '';
  let quoted = false;
  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    if (char === '"' && quoted && line[i + 1] === '"') { value += '"'; i += 1; }
    else if (char === '"') quoted = !quoted;
    else if (char === ',' && !quoted) { cells.push(value.trim()); value = ''; }
    else value += char;
  }
  if (quoted) throw new Error('Unclosed quote');
  cells.push(value.trim());
  return cells;
}

export function parseCsv(text) {
  if (typeof text !== 'string' || text.length > 5_000_000 || text.includes('\0')) throw new Error('Invalid CSV');
  const rows = text.replace(/^\uFEFF/, '').split(/\r?\n/).filter(line => line.trim()).map(parseRow);
  if (rows.length < 2 || rows[0].length < 2) throw new Error('Invalid CSV');
  return { headers: rows[0], rows: rows.slice(1) };
}

export function normalizeBalanceCsv(parsed, mapping) {
  const dateIndex = parsed.headers.indexOf(mapping.date);
  const balanceIndex = parsed.headers.indexOf(mapping.balance);
  if (dateIndex < 0 || balanceIndex < 0 || dateIndex === balanceIndex) throw new Error('Invalid mapping');
  return parsed.rows.flatMap(row => {
    const rawDate = row[dateIndex];
    const date = /^\d{4}-\d{2}-\d{2}$/.test(rawDate) ? rawDate : new Date(rawDate).toISOString().slice(0, 10);
    const cleaned = String(row[balanceIndex] ?? '').replace(/[$,\s]/g, '');
    if (!cleaned) return [];
    const balance = Number(cleaned);
    if (!Number.isFinite(balance)) throw new Error('Invalid balance');
    return [{ date, balance }];
  });
}

function normalizedDate(value) {
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) throw new Error('Invalid date');
  return parsed.toISOString().slice(0, 10);
}

export function detectCsvDateOrder(parsed, dateColumn) {
  const dateIndex = parsed.headers.indexOf(dateColumn);
  if (dateIndex < 0) throw new Error('Invalid date mapping');
  const dates = parsed.rows.map(row => normalizedDate(row[dateIndex]));
  let direction = null;
  for (let index = 1; index < dates.length; index += 1) {
    const comparison = dates[index].localeCompare(dates[index - 1]);
    if (!comparison) continue;
    const next = comparison > 0 ? 'ascending' : 'descending';
    if (direction && direction !== next) return 'mixed';
    direction = next;
  }
  return direction || 'ambiguous';
}

export function analyzeDailyBalanceCsv(parsed, mapping, orderOverride = null) {
  const dateIndex = parsed.headers.indexOf(mapping.date);
  const balanceIndex = parsed.headers.indexOf(mapping.balance);
  if (dateIndex < 0 || balanceIndex < 0 || dateIndex === balanceIndex) throw new Error('Invalid mapping');
  const detectedOrder = detectCsvDateOrder(parsed, mapping.date);
  const effectiveOrder = ['ascending', 'descending'].includes(detectedOrder) ? detectedOrder : orderOverride;
  if (!['ascending', 'descending'].includes(effectiveOrder)) return { detectedOrder, effectiveOrder: null, observations: [], ignoredBlankBalances: 0, resolved: false };
  const daily = new Map();
  let ignoredBlankBalances = 0;
  for (const row of parsed.rows) {
    const date = normalizedDate(row[dateIndex]);
    const cleaned = String(row[balanceIndex] ?? '').replace(/[$,\s]/g, '');
    if (!cleaned) { ignoredBlankBalances += 1; continue; }
    const balance = Number(cleaned);
    if (!Number.isFinite(balance)) throw new Error('Invalid balance');
    if (effectiveOrder === 'ascending' || !daily.has(date)) daily.set(date, { date, balance });
  }
  if (!daily.size) throw new Error('No posted balances');
  return { detectedOrder, effectiveOrder, observations: [...daily.values()].sort((a, b) => a.date.localeCompare(b.date)), ignoredBlankBalances, resolved: true };
}
