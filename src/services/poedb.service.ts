import axios from 'axios';
import poedbItemLinks from '../data/poedb-item-links.generated.json';
import { IExternalPrice } from '../interfaces/external-price.interface';
import { IPoeDbPriceHistoryRow } from '../interfaces/poedb-price-history.interface';

const POEDB_BASE = 'https://poedb.tw/us';
const HARD_CODED_ITEM_LINKS = poedbItemLinks as Record<string, string>;

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
  const slugCandidates = buildSlugCandidates(item);

  for (const slug of slugCandidates) {
    const economyUrl = `${POEDB_BASE}/Economy_${slug}`;
    const econHtml = await tryGetHtml(economyUrl);
    if (econHtml && containsEconomyChart(econHtml)) {
      return economyUrl;
    }

    const wikiUrl = `${POEDB_BASE}/${buildWikiSlug(item.name)}`;
    const wikiHtml = await tryGetHtml(wikiUrl);
    if (wikiHtml) {
      const economyMatch = wikiHtml.match(/href="(Economy_[^"]+)"/i);
      if (economyMatch) {
        const discovered = `${POEDB_BASE}/${economyMatch[1]}`;
        const discoveredHtml = await tryGetHtml(discovered);
        if (discoveredHtml && containsEconomyChart(discoveredHtml)) {
          return discovered;
        }
      }
    }
  }

  return undefined;
}

export async function fetchHistoryFromUrl(url: string): Promise<IPoeDbPriceHistoryRow[]> {
  const html = await getHtml(url);
  return parseHistory(html);
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

function parseHistory(html: string): IPoeDbPriceHistoryRow[] {
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

  return Array.from(candlesByDate.entries())
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
