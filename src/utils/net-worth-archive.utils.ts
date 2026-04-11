import moment from 'moment';
import { v4 as uuidv4 } from 'uuid';
import { INetWorthArchive } from '../interfaces/net-worth-archive.interface';
import { INetWorthArchiveItem } from '../interfaces/net-worth-archive-item.interface';
import { INetWorthArchiveSource } from '../interfaces/net-worth-archive-source.interface';
import { IPricedItem } from '../interfaces/priced-item.interface';

export type ParsedArchiveCsv = {
  detectedTitle?: string;
  detectedDate?: string;
  items: INetWorthArchiveItem[];
};

const NUMERIC_FIELDS: (keyof IPricedItem)[] = [
  'frameType',
  'total',
  'calculated',
  'max',
  'mean',
  'median',
  'min',
  'mode',
  'ilvl',
  'stackSize',
  'totalStacksize',
  'links',
  'quality',
  'level',
  'sockets',
  'tier',
];

const BOOLEAN_FIELDS: (keyof IPricedItem)[] = [
  'elder',
  'shaper',
  'blighted',
  'coffin',
  'beast',
  'corrupted',
];

const STRING_FIELDS: (keyof IPricedItem)[] = [
  'uuid',
  'name',
  'itemId',
  'typeLine',
  'icon',
  'variant',
  'inventoryId',
  'detailsUrl',
];

export function createArchiveItemsFromPricedItems(
  items: IPricedItem[],
  sourceLabel: string
): INetWorthArchiveItem[] {
  return items.map((item) => ({
    ...item,
    snapshotCalculated: item.calculated || 0,
    snapshotTotal: item.total || (item.stackSize || 0) * (item.calculated || 0),
    sourceCount: 1,
    sourceLabels: [sourceLabel],
    tab: item.tab || [],
  }));
}

export function mergeArchiveItems(items: INetWorthArchiveItem[]): INetWorthArchiveItem[] {
  const byKey = new Map<string, INetWorthArchiveItem>();

  items.forEach((item) => {
    const key = getArchiveMergeKey(item);
    const existing = byKey.get(key);

    if (!existing) {
      byKey.set(key, {
        ...item,
        tab: [...(item.tab || [])],
        sourceLabels: [...item.sourceLabels],
      });
      return;
    }

    const mergedQuantity = (existing.stackSize || 0) + (item.stackSize || 0);
    const weightedSnapshotValue =
      existing.snapshotCalculated * (existing.stackSize || 0) +
      item.snapshotCalculated * (item.stackSize || 0);

    existing.stackSize = mergedQuantity;
    existing.snapshotCalculated = mergedQuantity > 0 ? weightedSnapshotValue / mergedQuantity : 0;
    existing.snapshotTotal = existing.snapshotCalculated * mergedQuantity;
    existing.calculated = existing.snapshotCalculated;
    existing.total = existing.snapshotTotal;
    existing.sourceCount += item.sourceCount;
    existing.sourceLabels = Array.from(new Set([...existing.sourceLabels, ...item.sourceLabels]));

    if (existing.tab && item.tab) {
      existing.tab = [...existing.tab, ...item.tab].filter(
        (tab, index, array) => array.findIndex((candidate) => candidate.id === tab.id) === index
      );
    }
  });

  return Array.from(byKey.values()).sort((a, b) => b.snapshotTotal - a.snapshotTotal);
}

export function parseArchiveCsv(text: string, sourceLabel: string): ParsedArchiveCsv {
  const rows = parseCsvRows(text);
  if (rows.length === 0) {
    return { items: [] };
  }

  const headerIndex = rows.findIndex((row) => {
    const normalized = row.map(normalizeHeader);
    return normalized.includes('name') && normalized.includes('calculated');
  });

  if (headerIndex === -1) {
    return { items: [] };
  }

  const detectedTitle = headerIndex > 0 ? rows[0].join(' ').trim() : undefined;
  const detectedDate = detectedTitle ? extractDateFromText(detectedTitle) : undefined;
  const header = rows[headerIndex].map(normalizeHeader);
  const dataRows = rows
    .slice(headerIndex + 1)
    .filter((row) => row.some((cell) => cell.trim() !== ''));

  const items = dataRows
    .map((row) => mapCsvRowToArchiveItem(header, row, sourceLabel))
    .filter((item): item is INetWorthArchiveItem => !!item);

  return { detectedTitle, detectedDate, items };
}

export function buildDefaultArchiveName(prefix: string) {
  return `${prefix} ${moment().format('YYYY-MM-DD HH:mm')}`;
}

export function buildArchiveSourceFromPricedItems(
  items: IPricedItem[],
  sourceLabel: string,
  options: {
    createdAt: string;
    origin: 'saved' | 'imported';
    pricingModel: any;
    poedbPricingDate?: string;
    currency: string;
    sourceDate?: string;
  }
): INetWorthArchiveSource {
  return {
    uuid: uuidv4(),
    createdAt: options.createdAt,
    sourceDate: options.sourceDate,
    origin: options.origin,
    pricingModel: options.pricingModel,
    poedbPricingDate: options.poedbPricingDate,
    currency: options.currency,
    sourceLabel,
    items: createArchiveItemsFromPricedItems(items, sourceLabel),
  };
}

export function buildArchiveSourceFromParsedCsv(
  sourceLabel: string,
  parsed: ParsedArchiveCsv,
  options: {
    createdAt: string;
    sourceDate?: string;
    currency: string;
  }
): INetWorthArchiveSource {
  return {
    uuid: uuidv4(),
    createdAt: options.createdAt,
    sourceDate: options.sourceDate || parsed.detectedDate,
    origin: 'imported',
    pricingModel: 'traditional',
    poedbPricingDate: undefined,
    currency: options.currency,
    sourceLabel,
    items: parsed.items,
  };
}

export function summarizeArchive(archive: INetWorthArchive) {
  const items = mergeArchiveItems(getArchiveSources(archive).flatMap((source) => source.items));
  const snapshotTotal = items.reduce((sum, item) => sum + item.snapshotTotal, 0);
  return {
    itemCount: items.length,
    quantity: items.reduce((sum, item) => sum + (item.stackSize || 0), 0),
    snapshotTotal,
  };
}

export function getArchiveSources(archive: INetWorthArchive): INetWorthArchiveSource[] {
  if (archive.sources?.length) {
    return archive.sources;
  }

  if (!archive.items?.length) {
    return [];
  }

  return [
    {
      uuid: uuidv4(),
      createdAt: archive.createdAt,
      sourceDate: archive.sourceDate,
      origin: archive.origin || 'saved',
      pricingModel: archive.pricingModel || 'traditional',
      poedbPricingDate: archive.poedbPricingDate,
      currency: archive.currency,
      sourceLabel: archive.sourceLabels?.[0] || archive.name,
      items: archive.items,
    },
  ];
}

function mapCsvRowToArchiveItem(
  header: string[],
  row: string[],
  sourceLabel: string
): INetWorthArchiveItem | undefined {
  const record = header.reduce<Record<string, string>>((acc, key, index) => {
    acc[key] = row[index] ?? '';
    return acc;
  }, {});

  const name = record.name?.trim();
  if (!name) {
    return undefined;
  }

  const base: Partial<IPricedItem> = {
    uuid: record.uuid || uuidv4(),
    name,
    itemId: record.itemid || record.itemId || uuidv4(),
    typeLine: record.typeline || name,
    tab: [],
  };

  NUMERIC_FIELDS.forEach((field) => {
    const raw = record[normalizeHeader(field)];
    (base as any)[field] = toNumber(raw);
  });

  BOOLEAN_FIELDS.forEach((field) => {
    const raw = record[normalizeHeader(field)];
    (base as any)[field] = toBoolean(raw);
  });

  STRING_FIELDS.forEach((field) => {
    const raw = record[normalizeHeader(field)];
    if (typeof raw === 'string') {
      (base as any)[field] = raw;
    }
  });

  const stackSize = base.stackSize || 0;
  const calculated = base.calculated || 0;
  const total = base.total || stackSize * calculated;

  return {
    ...(base as IPricedItem),
    stackSize,
    calculated,
    total,
    snapshotCalculated: calculated,
    snapshotTotal: total,
    sourceCount: 1,
    sourceLabels: [sourceLabel],
  };
}

function getArchiveMergeKey(
  item: Pick<
    IPricedItem,
    | 'name'
    | 'typeLine'
    | 'quality'
    | 'links'
    | 'level'
    | 'corrupted'
    | 'frameType'
    | 'variant'
    | 'elder'
    | 'shaper'
    | 'ilvl'
    | 'tier'
  >
) {
  const isMap = item.typeLine?.includes(' Map');
  const isSeed = item.typeLine?.includes(' Seed');

  return [
    item.name,
    isMap ? '' : item.quality || 0,
    item.links || 0,
    item.level || 0,
    item.corrupted ? 1 : 0,
    isMap && item.frameType !== 3 ? 'map' : item.frameType || 0,
    item.variant || '',
    item.elder ? 1 : 0,
    item.shaper ? 1 : 0,
    isSeed && !isMap ? item.ilvl || 0 : '',
    item.tier || 0,
  ].join('|');
}

function normalizeHeader(value: string) {
  return value.replace(/[^a-z0-9]+/gi, '').toLowerCase();
}

function toNumber(value?: string) {
  if (!value) {
    return 0;
  }
  const normalized = value.replace(/\s/g, '').replace(',', '.');
  const parsed = +normalized;
  return Number.isFinite(parsed) ? parsed : 0;
}

function toBoolean(value?: string) {
  return `${value || ''}`.trim().toLowerCase() === 'true' || value === '1';
}

function extractDateFromText(value: string) {
  const match = value.match(/\d{4}-\d{2}-\d{2}(?:[ T]\d{2}[:-]\d{2}(?::\d{2})?)?/);
  return match?.[0];
}

function parseCsvRows(text: string): string[][] {
  const rows: string[][] = [];
  let currentRow: string[] = [];
  let currentCell = '';
  let inQuotes = false;

  for (let index = 0; index < text.length; index++) {
    const char = text[index];
    const next = text[index + 1];

    if (char === '"') {
      if (inQuotes && next === '"') {
        currentCell += '"';
        index++;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (!inQuotes && char === ',') {
      currentRow.push(currentCell);
      currentCell = '';
      continue;
    }

    if (!inQuotes && (char === '\n' || char === '\r')) {
      if (char === '\r' && next === '\n') {
        index++;
      }
      currentRow.push(currentCell);
      if (currentRow.some((cell) => cell.length > 0)) {
        rows.push(currentRow);
      }
      currentRow = [];
      currentCell = '';
      continue;
    }

    currentCell += char;
  }

  if (currentCell.length > 0 || currentRow.length > 0) {
    currentRow.push(currentCell);
    if (currentRow.some((cell) => cell.length > 0)) {
      rows.push(currentRow);
    }
  }

  return rows;
}
