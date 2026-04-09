const axios = require('axios');

const POEDB_BASE = 'https://poedb.tw/us';

async function main() {
  const url = process.argv[2];
  const focusDate = process.argv[3];

  if (!url) {
    console.error('Usage: node scripts/debug-poedb-history.js <poedb-url> [date]');
    process.exit(1);
  }

  const state = new Map();
  const rows = await fetchHistoryWithTrace(url, state);
  const targetRow = focusDate
    ? rows.find((row) => row.date === focusDate) || rows[rows.length - 1]
    : rows[rows.length - 1];

  console.log(`URL: ${url}`);
  console.log(`Rows: ${rows.length}`);
  if (targetRow) {
    console.log(`Selected row (${targetRow.date}):`, targetRow);
  }
}

async function fetchHistoryWithTrace(url, state) {
  if (state.has(url)) {
    return state.get(url);
  }

  const promise = fetchHistoryWithTraceInternal(url, state);
  state.set(url, promise);
  return promise;
}

async function fetchHistoryWithTraceInternal(url, state) {
  const html = await getHtml(url);
  const parsed = parseRawHistory(html);
  const context = detectQuoteContext(url, html, parsed.rows);

  console.log(`\n=== ${url} ===`);
  console.log('chart title:', parsed.chartTitle);
  console.log('exchange rows:', parsed.exchangeRows.slice(0, 5));
  console.log('detected context:', context);
  console.log('latest raw row:', parsed.rows[parsed.rows.length - 1]);

  const normalized = await normalizeHistoryToChaos(url, html, parsed.rows, state);
  console.log('latest normalized row:', normalized[normalized.length - 1]);

  return normalized;
}

async function getHtml(url) {
  const response = await axios.get(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 ExilenceCE PoEDB Debugger',
    },
  });
  return response.data;
}

function parseRawHistory(html) {
  const candleMatch = html.match(/splitData\(\[(.*?)\]\);/s);
  const dayChartMatch = html.match(
    /"xAxis":\[\{"name":"Date","data":\[(.*?)\]\}.*?"series":\[\{"name":"rate".*?"data":\[(.*?)\]\},\{"name":"volume traded".*?"data":\[(.*?)\]\}/s
  );
  const chartTitle = html.match(/title:\s*\{\s*text:\s*"([^"]+)"/s)?.[1] || '(unknown title)';

  if (!candleMatch || !dayChartMatch) {
    throw new Error('Could not parse PoEDB chart payload');
  }

  const candlesByDate = new Map();
  const candleRegex = /\["(\d{4}-\d{2}-\d{2})",([0-9.]+),([0-9.]+),([0-9.]+),([0-9.]+)\]/g;
  let candleEntry;

  while ((candleEntry = candleRegex.exec(candleMatch[1])) !== null) {
    candlesByDate.set(candleEntry[1], {
      open: +candleEntry[2],
      close: +candleEntry[3],
      low: +candleEntry[4],
      high: +candleEntry[5],
    });
  }

  const dates = extractStringArray(dayChartMatch[1]);
  const rates = extractNumberArray(dayChartMatch[2]);
  const volumes = extractNumberArray(dayChartMatch[3]);

  const rateByDate = new Map();
  const alignedLength = Math.min(dates.length, rates.length, volumes.length);
  for (let idx = 0; idx < alignedLength; idx++) {
    const date = dates[idx];
    const rate = rates[idx];
    const volume = volumes[idx];
    if (!date || !Number.isFinite(rate) || !Number.isFinite(volume)) {
      continue;
    }
    rateByDate.set(date, { rate, volume });
  }

  const rows = Array.from(candlesByDate.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([date, candle]) => {
      const rateVolume = rateByDate.get(date);
      if (!rateVolume) {
        return undefined;
      }
      return {
        date,
        open: candle.open,
        close: candle.close,
        low: candle.low,
        high: candle.high,
        rate: rateVolume.rate,
        volume: rateVolume.volume,
      };
    })
    .filter(Boolean);

  return {
    chartTitle,
    rows,
    exchangeRows: parseExchangeRows(html),
  };
}

async function normalizeHistoryToChaos(url, html, rows, state) {
  if (rows.length === 0) {
    return rows;
  }

  const context = detectQuoteContext(url, html, rows);
  if (!context) {
    return rows;
  }

  if (context.mode === 'fixed_chaos') {
    return rows.map((row) => ({ ...row, open: 1, close: 1, low: 1, high: 1, rate: 1 }));
  }

  if (context.baseHref === 'Economy_chaos') {
    if (context.mode === 'base_per_item') {
      return rows;
    }

    return rows.map((row) => ({
      ...row,
      open: invertPositiveNumber(row.open),
      close: invertPositiveNumber(row.close),
      low: invertPositiveNumber(row.high),
      high: invertPositiveNumber(row.low),
      rate: invertPositiveNumber(row.rate),
    }));
  }

  const baseUrl = `${POEDB_BASE}/${context.baseHref}`;
  const baseHistory = await fetchHistoryWithTrace(baseUrl, state);
  const baseByDate = new Map(baseHistory.map((row) => [row.date, row]));

  return rows
    .map((row) => ({ row, baseRow: baseByDate.get(row.date) }))
    .filter((entry) => !!entry.baseRow)
    .map(({ row, baseRow }) => {
      if (context.mode === 'base_per_item') {
        return {
          ...row,
          open: row.open * baseRow.open,
          close: row.close * baseRow.close,
          low: row.low * baseRow.low,
          high: row.high * baseRow.high,
          rate: row.rate * baseRow.rate,
        };
      }

      return {
        ...row,
        open: invertPositiveNumber(row.open) * baseRow.open,
        close: invertPositiveNumber(row.close) * baseRow.close,
        low: invertPositiveNumber(row.high) * baseRow.low,
        high: invertPositiveNumber(row.low) * baseRow.high,
        rate: invertPositiveNumber(row.rate) * baseRow.rate,
      };
    });
}

function detectQuoteContext(url, html, rows) {
  if (/\/(?:Economy_chaos|Chaos_Orb)(?:[/?#]|$)/i.test(url)) {
    return { mode: 'fixed_chaos', baseHref: 'Economy_chaos' };
  }

  const exchangeRows = parseExchangeRows(html);
  if (exchangeRows.length === 0) {
    return undefined;
  }

  const chartRow = exchangeRows[0];
  const latest = rows[rows.length - 1];
  const latestValue = Number.isFinite(latest.rate) ? latest.rate : latest.close;
  const distanceToLeft = relativeDistance(latestValue, chartRow.leftAmount);
  const distanceToRight = relativeDistance(latestValue, chartRow.rightAmount);

  return {
    mode: distanceToLeft <= distanceToRight ? 'base_per_item' : 'items_per_base',
    baseHref: chartRow.leftHref,
  };
}

function parseExchangeRows(html) {
  const rowRegex = /<tr><td>([0-9.]+)\s+<a href="([^"]+)".*?<\/a>.*?([0-9.]+)\s+<a href="([^"]+)".*?<\/a><\/td>/gs;
  const rows = [];
  let match;

  while ((match = rowRegex.exec(html)) !== null) {
    const leftAmount = +match[1];
    const leftHref = match[2];
    const rightAmount = +match[3];
    const rightHref = match[4];
    if (!Number.isFinite(leftAmount) || !Number.isFinite(rightAmount)) {
      continue;
    }
    rows.push({ leftAmount, leftHref, rightAmount, rightHref });
  }

  return rows;
}

function relativeDistance(actual, expected) {
  if (!Number.isFinite(actual) || !Number.isFinite(expected)) {
    return Number.POSITIVE_INFINITY;
  }

  const scale = Math.max(Math.abs(expected), 1e-9);
  return Math.abs(actual - expected) / scale;
}

function invertPositiveNumber(value) {
  return value > 0 ? 1 / value : 0;
}

function extractStringArray(raw) {
  return Array.from(raw.matchAll(/"([^"]+)"/g)).map((m) => m[1]);
}

function extractNumberArray(raw) {
  return raw
    .split(',')
    .map((v) => v.replace(/"/g, '').trim())
    .filter((v) => v.length > 0)
    .map((v) => +v)
    .filter((v) => Number.isFinite(v));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
