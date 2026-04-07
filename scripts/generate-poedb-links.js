/* eslint-disable no-console */
const fs = require('fs');
const path = require('path');
const axios = require('axios');

const POEDB_BASE = 'https://poedb.tw/us';
const POE_NINJA_BASE = 'https://poe.ninja/api/data';
const OUTPUT_FILE = path.resolve(__dirname, '..', 'src', 'data', 'poedb-item-links.generated.json');
const REPORT_FILE = path.resolve(__dirname, '..', 'scripts', 'poedb-links-report.json');

const CURRENCY_CATEGORIES = ['Currency', 'Fragment'];
const ITEM_CATEGORIES = [
  'Oil',
  'Incubator',
  'Scarab',
  'Fossil',
  'Resonator',
  'Essence',
  'DivinationCard',
  'SkillGem',
  'Tattoo',
  'Omen',
  'UniqueMap',
  'Map',
  'UniqueJewel',
  'UniqueFlask',
  'UniqueWeapon',
  'UniqueArmour',
  'UniqueRelic',
  'UniqueAccessory',
  'DeliriumOrb',
  'Beast',
  'Vial',
  'Invitation',
  'Artifact',
  'Memory',
  'BlightedMap',
  'BlightRavagedMap',
  'Coffin',
  'AllflameEmber',
  'KalguuranRune',
];

function normalizeLookupToken(value) {
  return String(value || '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function toEconomySlug(value) {
  return normalizeLookupToken(value);
}

function buildWikiSlug(value) {
  return encodeURIComponent(String(value || '').replace(/ /g, '_'));
}

function containsEconomyChart(html) {
  return /"name":"volume traded"/i.test(html) && /splitData\(\[/i.test(html);
}

function buildLookupKeyCandidates(item) {
  const keys = new Set();
  const names = [item.name, item.baseType].filter((x) => x && String(x).trim().length > 0);

  names.forEach((name) => {
    keys.add(normalizeLookupToken(name));
    keys.add(normalizeLookupToken(String(name).replace(/'/g, '')));
    keys.add(normalizeLookupToken(String(name).replace(/’/g, '')));
  });

  keys.delete('');
  return Array.from(keys);
}

function buildSlugCandidates(item) {
  const names = [item.name, item.baseType].filter((x) => x && String(x).trim().length > 0);
  const slugs = new Set();

  names.forEach((name) => {
    slugs.add(toEconomySlug(name));
    slugs.add(toEconomySlug(String(name).replace(/'/g, '')));
    slugs.add(toEconomySlug(String(name).replace(/’/g, '')));
  });

  slugs.delete('');
  return Array.from(slugs);
}

async function getHtml(url) {
  const response = await axios.get(url, {
    timeout: 20000,
    headers: {
      'User-Agent': 'Mozilla/5.0 ExilenceCE PoEDB Link Generator',
    },
  });
  return response.data;
}

async function tryGetHtml(url) {
  try {
    return await getHtml(url);
  } catch {
    return undefined;
  }
}

async function resolvePoedbUrl(item) {
  const slugCandidates = buildSlugCandidates(item);

  for (const slug of slugCandidates) {
    const economyUrl = `${POEDB_BASE}/Economy_${slug}`;
    const economyHtml = await tryGetHtml(economyUrl);
    if (economyHtml && containsEconomyChart(economyHtml)) {
      return economyUrl;
    }
  }

  const wikiCandidates = [item.name, item.baseType].filter((x) => x && String(x).trim().length > 0);
  for (const wikiName of wikiCandidates) {
    const wikiUrl = `${POEDB_BASE}/${buildWikiSlug(wikiName)}`;
    const wikiHtml = await tryGetHtml(wikiUrl);
    if (!wikiHtml) {
      continue;
    }

    const economyMatch = wikiHtml.match(/href="(Economy_[^"]+)"/i);
    if (!economyMatch) {
      continue;
    }

    const discovered = `${POEDB_BASE}/${economyMatch[1]}`;
    const discoveredHtml = await tryGetHtml(discovered);
    if (discoveredHtml && containsEconomyChart(discoveredHtml)) {
      return discovered;
    }
  }

  return undefined;
}

async function fetchItemOverview(league, type) {
  const url = `${POE_NINJA_BASE}/itemoverview?league=${encodeURIComponent(league)}&type=${encodeURIComponent(type)}`;
  const response = await axios.get(url, { timeout: 25000 });
  return response.data?.lines || [];
}

async function fetchCurrencyOverview(league, type) {
  const url = `${POE_NINJA_BASE}/currencyoverview?league=${encodeURIComponent(league)}&type=${encodeURIComponent(type)}`;
  const response = await axios.get(url, { timeout: 25000 });
  const lines = response.data?.lines || [];
  return lines.map((line) => ({ name: line.currencyTypeName, baseType: '' }));
}

async function loadItemUniverse(league) {
  const universeByKey = new Map();

  for (const type of CURRENCY_CATEGORIES) {
    console.log(`Fetching currency category: ${type}`);
    const rows = await fetchCurrencyOverview(league, type);
    rows.forEach((row) => {
      const key = normalizeLookupToken(row.name || row.baseType || '');
      if (key && !universeByKey.has(key)) {
        universeByKey.set(key, row);
      }
    });
  }

  for (const type of ITEM_CATEGORIES) {
    console.log(`Fetching item category: ${type}`);
    const rows = await fetchItemOverview(league, type);
    rows.forEach((row) => {
      const entry = { name: row.name || '', baseType: row.baseType || '' };
      const key = normalizeLookupToken(entry.name || entry.baseType || '');
      if (key && !universeByKey.has(key)) {
        universeByKey.set(key, entry);
      }
    });
  }

  return Array.from(universeByKey.values()).sort((a, b) => a.name.localeCompare(b.name));
}

async function runWithConcurrency(items, concurrency, worker) {
  let index = 0;
  const runners = Array.from({ length: Math.max(1, concurrency) }, async () => {
    while (index < items.length) {
      const current = index;
      index += 1;
      await worker(items[current], current);
    }
  });
  await Promise.all(runners);
}

function readExistingMap() {
  if (!fs.existsSync(OUTPUT_FILE)) {
    return {};
  }
  try {
    const raw = fs.readFileSync(OUTPUT_FILE, 'utf8');
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

function readPreviousReport() {
  if (!fs.existsSync(REPORT_FILE)) {
    return undefined;
  }
  try {
    const raw = fs.readFileSync(REPORT_FILE, 'utf8');
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : undefined;
  } catch {
    return undefined;
  }
}

function writeJson(filePath, data) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(data, null, 2)}\n`, 'utf8');
}

function buildSortedMap(mapObject) {
  const sortedEntries = Object.entries(mapObject).sort((a, b) => a[0].localeCompare(b[0]));
  return Object.fromEntries(sortedEntries);
}

function saveCheckpoint(params) {
  const { league, generated, unresolved, universeCount, targetCount, mode } = params;
  const sortedOutput = buildSortedMap(generated);
  writeJson(OUTPUT_FILE, sortedOutput);
  writeJson(REPORT_FILE, {
    league,
    mode,
    generatedAt: new Date().toISOString(),
    universeCount,
    targetCount,
    hardcodedLinks: Object.keys(sortedOutput).length,
    unresolvedCount: unresolved.length,
    unresolved,
  });
}

function parseArgs(argv) {
  const positionals = [];
  const options = {
    mode: 'missing',
    limit: undefined,
  };

  argv.forEach((arg) => {
    if (arg.startsWith('--mode=')) {
      const mode = arg.slice('--mode='.length);
      if (mode === 'all' || mode === 'missing' || mode === 'report') {
        options.mode = mode;
      }
      return;
    }

    if (arg.startsWith('--limit=')) {
      const limit = Number(arg.slice('--limit='.length));
      if (Number.isFinite(limit) && limit > 0) {
        options.limit = Math.floor(limit);
      }
      return;
    }

    positionals.push(arg);
  });

  return {
    league: positionals[0] || 'Standard',
    concurrency: Number(positionals[1] || '4'),
    mode: options.mode,
    limit: options.limit,
  };
}

function getMissingTargets(universe, generatedMap) {
  return universe.filter((item) => {
    const keys = buildLookupKeyCandidates(item);
    return !keys.some((key) => generatedMap[key]);
  });
}

function getReportTargets(report) {
  const unresolved = Array.isArray(report?.unresolved) ? report.unresolved : [];
  return unresolved
    .map((item) => ({
      name: String(item?.name || ''),
      baseType: String(item?.baseType || ''),
    }))
    .filter((item) => item.name || item.baseType);
}

async function main() {
  const args = parseArgs(process.argv.slice(2));

  console.log(`Building PoEDB links for league: ${args.league} | mode: ${args.mode}`);

  const existing = readExistingMap();
  const generated = { ...existing };

  let universe = [];
  let targets = [];

  if (args.mode === 'report') {
    const report = readPreviousReport();
    targets = getReportTargets(report);
    if (targets.length === 0) {
      console.log('No unresolved items in previous report; nothing to do.');
      return;
    }
    universe = targets;
  } else {
    universe = await loadItemUniverse(args.league);
    targets = args.mode === 'all' ? universe : getMissingTargets(universe, generated);
  }

  if (args.limit) {
    targets = targets.slice(0, args.limit);
  }

  console.log(`Universe size: ${universe.length}`);
  console.log(`Targets to resolve now: ${targets.length}`);

  if (targets.length === 0) {
    console.log('Everything already mapped for this mode.');
    return;
  }

  const unresolvedByKey = new Map();

  let done = 0;
  let resolvedNow = 0;

  await runWithConcurrency(targets, args.concurrency, async (item) => {
    const keys = buildLookupKeyCandidates(item);
    const url = await resolvePoedbUrl(item);

    if (url) {
      keys.forEach((key) => {
        generated[key] = url;
      });
      resolvedNow += 1;
    } else {
      const unresolvedKey = normalizeLookupToken(item.name || item.baseType || '');
      if (unresolvedKey && !unresolvedByKey.has(unresolvedKey)) {
        unresolvedByKey.set(unresolvedKey, { name: item.name, baseType: item.baseType });
      }
    }

    done += 1;
    if (done % 25 === 0 || done === targets.length) {
      const unresolved = Array.from(unresolvedByKey.values());
      console.log(`Progress: ${done}/${targets.length} | newly resolved: ${resolvedNow}`);
      saveCheckpoint({
        league: args.league,
        mode: args.mode,
        generated,
        unresolved,
        universeCount: universe.length,
        targetCount: targets.length,
      });
    }
  });

  const unresolved = Array.from(unresolvedByKey.values());
  saveCheckpoint({
    league: args.league,
    mode: args.mode,
    generated,
    unresolved,
    universeCount: universe.length,
    targetCount: targets.length,
  });

  console.log(`Saved: ${OUTPUT_FILE}`);
  console.log(`Report: ${REPORT_FILE}`);
  console.log(`Hardcoded links: ${Object.keys(generated).length} | unresolved in this run: ${unresolved.length}`);
}

main().catch((error) => {
  console.error(error?.message || error);
  process.exit(1);
});
