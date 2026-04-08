import axios from 'axios';
import poedbItemLinks from '../data/poedb-item-links.generated.json';
import { IExternalPrice } from '../interfaces/external-price.interface';
import { IPoeDbPriceHistoryRow } from '../interfaces/poedb-price-history.interface';

const POEDB_BASE = 'https://poedb.tw/us';
const HARD_CODED_ITEM_LINKS = poedbItemLinks as Record<string, string>;
const historyCache = new Map<string, Promise<IPoeDbPriceHistoryRow[]>>();

export const poeDbService = {
  getPoedbLookupKey,
  getHardcodedUrlForItem,
  getHardcodedLinksCount,
  resolvePoedbUrlForItem,
  fetchHistoryFromUrl,
  POEDB_BASE,
};

export function getPoedbLookupKey(item: Pick<IExternalPrice, 'name' | 'baseType'>): string {
  return normalizeLookupToken(item.name || item.baseType || '');
}

export function getHardcodedUrlForItem(item: Pick<IExternalPrice, 'name' | 'baseType'>) {
  const candidates = getLookupKeyCandidates(item);
  for (const key of candidates) {
    const url = HARD_CODED_ITEM_LINKS[key];
    if (url) {
      return url;
    }
  }
  return undefined;
}

export function getHardcodedLinksCount() {
  return Object.keys(HARD_CODED_ITEM_LINKS).length;
}

export async function resolvePoedbUrlForItem(item: IExternalPrice): Promise<string | undefined> {
  const wikiCandidates = [item.name, item.baseType].filter(
    (x): x is string => !!x && x.trim().length > 0
  );

  for (const wikiName of wikiCandidates) {
    const wikiUrl = `${POEDB_BASE}/${buildWikiSlug(wikiName)}`;
    const wikiHtml = await tryGetHtml(wikiUrl);
    if (wikiHtml && isValidPoedbPage(wikiHtml, item)) {
      return wikiUrl;
    }
  }

  const slugCandidates = buildSlugCandidates(item);

  for (const slug of slugCandidates) {
    const economyUrl = `${POEDB_BASE}/Economy_${slug}`;
    const econHtml = await tryGetHtml(economyUrl);
    if (econHtml && isValidPoedbPage(econHtml, item)) {
      return economyUrl;
    }
  }

  return undefined;
}

export async function fetchHistoryFromUrl(url: string): Promise<IPoeDbPriceHistoryRow[]> {
  const cached = historyCache.get(url);
  if (cached) {
    return cached;
  }

  const pending = fetchHistoryFromUrlInternal(url);
  historyCache.set(url, pending);

  try {
    return await pending;
  } catch (error) {
    historyCache.delete(url);
    throw error;
  }
}

async function fetchHistoryFromUrlInternal(url: string): Promise<IPoeDbPriceHistoryRow[]> {
  const html = await getHtml(url);
  return parseHistory(url, html);
}

async function getHtml(url: string): Promise<string> {
  const response = await axios.get<string>(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 ExilenceCE PoEDB Importer',
    },
  });
  return response.data;
}

async function tryGetHtml(url: string): Promise<string | undefined> {
  try {
    return await getHtml(url);
  } catch {
    return undefined;
  }
}

function containsEconomyChart(html: string) {
  return /"name":"volume traded"/i.test(html) && /splitData\(\[/i.test(html);
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function getItemNameCandidates(item: Pick<IExternalPrice, 'name' | 'baseType'>): string[] {
  const names = [item.name, item.baseType]
    .filter((x): x is string => !!x && x.trim().length > 0)
    .map((x) => x.trim());

  return Array.from(
    new Set(names.flatMap((name) => [name, name.replace(/'/g, ''), name.replace(/’/g, '')]))
  );
}

function containsExpectedItemName(html: string, item: Pick<IExternalPrice, 'name' | 'baseType'>) {
  const candidates = getItemNameCandidates(item);
  return candidates.some((name) => {
    const normalizedName = escapeRegExp(name);
    return new RegExp(`(^|[>"\\s])${normalizedName}([<"\\s]|$)`, 'i').test(html);
  });
}

function isValidPoedbPage(html: string, item: Pick<IExternalPrice, 'name' | 'baseType'>) {
  return containsEconomyChart(html) && containsExpectedItemName(html, item);
}

async function parseHistory(url: string, html: string): Promise<IPoeDbPriceHistoryRow[]> {
  const candleMatch = html.match(/splitData\(\[(.*?)\]\);/s);
  const dayChartMatch = html.match(
    /"xAxis":\[\{"name":"Date","data":\[(.*?)\]\}.*?"series":\[\{"name":"rate".*?"data":\[(.*?)\]\},\{"name":"volume traded".*?"data":\[(.*?)\]\}/s
  );

  if (!candleMatch || !dayChartMatch) {
    throw new Error('Could not parse PoEDB chart payload');
  }

  const candlesByDate = new Map<string, Omit<IPoeDbPriceHistoryRow, 'date' | 'rate' | 'volume'>>();
  const candleRegex = /\["(\d{4}-\d{2}-\d{2})",([0-9.]+),([0-9.]+),([0-9.]+),([0-9.]+)\]/g;
  let candleEntry: RegExpExecArray | null;

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

  const alignedLength = Math.min(dates.length, rates.length, volumes.length);
  const rateByDate = new Map<string, { rate: number; volume: number }>();

  for (let idx = 0; idx < alignedLength; idx++) {
    const date = dates[idx];
    const rate = rates[idx];
    const volume = volumes[idx];
    if (!date || !Number.isFinite(rate) || !Number.isFinite(volume)) {
      continue;
    }
    rateByDate.set(date, { rate, volume });
  }

  const rawRows = Array.from(candlesByDate.entries())
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
      } as IPoeDbPriceHistoryRow;
    })
    .filter((x): x is IPoeDbPriceHistoryRow => !!x);

  return normalizeHistoryToChaos(url, html, rawRows);
}

type PoedbQuoteMode = 'base_per_item' | 'items_per_base' | 'fixed_chaos';
type PoedbExchangeRow = {
  leftAmount: number;
  leftHref: string;
  rightAmount: number;
  rightHref: string;
};

async function normalizeHistoryToChaos(
  url: string,
  html: string,
  rows: IPoeDbPriceHistoryRow[]
): Promise<IPoeDbPriceHistoryRow[]> {
  if (rows.length === 0) {
    return rows;
  }

  const context = await detectQuoteContext(url, html, rows);
  if (!context) {
    return rows;
  }

  if (context.mode === 'fixed_chaos') {
    return rows.map((row) => ({
      ...row,
      open: 1,
      close: 1,
      low: 1,
      high: 1,
      rate: 1,
    }));
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
  const baseHistory = await fetchHistoryFromUrl(baseUrl);
  const baseByDate = new Map(baseHistory.map((row) => [row.date, row]));

  return rows
    .map((row) => ({
      row,
      baseRow: baseByDate.get(row.date),
    }))
    .filter(
      (entry): entry is { row: IPoeDbPriceHistoryRow; baseRow: IPoeDbPriceHistoryRow } =>
        !!entry.baseRow
    )
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

async function detectQuoteContext(
  url: string,
  html: string,
  rows: IPoeDbPriceHistoryRow[]
): Promise<{ mode: PoedbQuoteMode; baseHref: string } | undefined> {
  if (/\/(?:Economy_chaos|Chaos_Orb)(?:[/?#]|$)/i.test(url)) {
    return { mode: 'fixed_chaos', baseHref: 'Economy_chaos' };
  }

  const exchangeRows = parseExchangeRows(html);
  if (exchangeRows.length === 0) {
    return undefined;
  }

  const chartRow = exchangeRows[0];
  const latest = rows[rows.length - 1];
  const latestValue = Number.isFinite(latest.close) ? latest.close : latest.rate;
  const distanceToLeft = relativeDistance(latestValue, chartRow.leftAmount);
  const distanceToRight = relativeDistance(latestValue, chartRow.rightAmount);

  return {
    mode: distanceToLeft <= distanceToRight ? 'base_per_item' : 'items_per_base',
    baseHref: chartRow.leftHref,
  };
}

function parseExchangeRows(html: string): PoedbExchangeRow[] {
  const rowRegex = /<tr><td>([0-9.]+)\s+<a href="([^"]+)".*?<\/a>.*?([0-9.]+)\s+<a href="([^"]+)".*?<\/a><\/td>/gs;
  const rows: PoedbExchangeRow[] = [];

  let match: RegExpExecArray | null;
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

function relativeDistance(actual: number, expected: number) {
  if (!Number.isFinite(actual) || !Number.isFinite(expected)) {
    return Number.POSITIVE_INFINITY;
  }

  const scale = Math.max(Math.abs(expected), 1e-9);
  return Math.abs(actual - expected) / scale;
}

function invertPositiveNumber(value: number) {
  return value > 0 ? 1 / value : 0;
}

function buildSlugCandidates(item: IExternalPrice): string[] {
  const names = [item.name, item.baseType].filter((x): x is string => !!x && x.trim().length > 0);
  const slugs = new Set<string>();
  names.forEach((n) => {
    slugs.add(toEconomySlug(n));
    slugs.add(toEconomySlug(n.replace(/'/g, '')));
    slugs.add(toEconomySlug(n.replace(/’/g, '')));
  });
  return Array.from(slugs).filter((x) => x.length > 0);
}

function toEconomySlug(value: string): string {
  return value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function buildWikiSlug(name: string): string {
  return encodeURIComponent(name.replace(/ /g, '_'));
}

function getLookupKeyCandidates(item: Pick<IExternalPrice, 'name' | 'baseType'>): string[] {
  const keys = new Set<string>();
  const names = [item.name, item.baseType].filter((x): x is string => !!x && x.trim().length > 0);

  names.forEach((name) => {
    keys.add(normalizeLookupToken(name));
    keys.add(normalizeLookupToken(name.replace(/'/g, '')));
    keys.add(normalizeLookupToken(name.replace(/’/g, '')));
  });

  keys.delete('');
  return Array.from(keys);
}

function normalizeLookupToken(value: string): string {
  return value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function extractStringArray(raw: string): string[] {
  return Array.from(raw.matchAll(/"([^"]+)"/g)).map((m) => m[1]);
}

function extractNumberArray(raw: string): number[] {
  return raw
    .split(',')
    .map((v) => v.replace(/"/g, '').trim())
    .filter((v) => v.length > 0)
    .map((v) => +v)
    .filter((v) => Number.isFinite(v));
}
