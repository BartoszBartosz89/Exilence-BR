/* eslint-disable no-console */
const fs = require('fs');
const path = require('path');
const axios = require('axios');

const POEDB_BASE = 'https://poedb.tw/us';
const POE_NINJA_BASE = 'https://poe.ninja/api/data';
const INPUT_FILE = path.resolve(__dirname, '..', 'src', 'data', 'poedb-item-links.generated.json');
const REPORT_FILE = path.resolve(__dirname, '..', 'scripts', 'poedb-links-validation-report.json');

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
    slugs.add(normalizeLookupToken(name));
    slugs.add(normalizeLookupToken(String(name).replace(/'/g, '')));
    slugs.add(normalizeLookupToken(String(name).replace(/’/g, '')));
  });

  slugs.delete('');
  return Array.from(slugs);
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function getItemNameCandidates(item) {
  const names = [item.name, item.baseType]
    .filter((x) => x && String(x).trim().length > 0)
    .map((x) => String(x).trim());

  return Array.from(new Set(names.flatMap((name) => [name, name.replace(/'/g, ''), name.replace(/’/g, '')])));
}

function containsEconomyChart(html) {
  return /"name":"volume traded"/i.test(html) && /splitData\(\[/i.test(html);
}

function containsExpectedItemName(html, item) {
  const candidates = getItemNameCandidates(item);
  return candidates.some((name) => {
    const normalizedName = escapeRegExp(name);
    return new RegExp(`(^|[>"\\s])${normalizedName}([<"\\s]|$)`, 'i').test(html);
  });
}

function isValidPoedbPage(html, item) {
  return containsEconomyChart(html) && containsExpectedItemName(html, item);
}

function hasExpectedUrlShape(url, item) {
  const expectedSlugs = new Set(buildSlugCandidates(item));
  const economyMatch = url.match(/\/Economy_([^/?#]+)/i);
  if (!economyMatch) {
    return true;
  }
  return expectedSlugs.has(normalizeLookupToken(economyMatch[1]));
}

async function getHtml(url) {
  const response = await axios.get(url, {
    timeout: 20000,
    headers: {
      'User-Agent': 'Mozilla/5.0 ExilenceCE PoEDB Link Validator',
    },
  });
  return response.data;
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
    const rows = await fetchCurrencyOverview(league, type);
    rows.forEach((row) => {
      const key = normalizeLookupToken(row.name || row.baseType || '');
      if (key && !universeByKey.has(key)) {
        universeByKey.set(key, row);
      }
    });
  }

  for (const type of ITEM_CATEGORIES) {
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

function readGeneratedMap() {
  const raw = fs.readFileSync(INPUT_FILE, 'utf8');
  const parsed = JSON.parse(raw);
  return parsed && typeof parsed === 'object' ? parsed : {};
}

function writeJson(filePath, data) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(data, null, 2)}\n`, 'utf8');
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

async function main() {
  const league = process.argv[2] || 'Standard';
  const concurrencyArg = Number(process.argv[3] || '4');
  const concurrency = Number.isFinite(concurrencyArg) && concurrencyArg > 0 ? concurrencyArg : 4;

  const generatedMap = readGeneratedMap();
  const universe = await loadItemUniverse(league);
  const invalid = [];
  const missing = [];
  const checkedUrls = new Map();

  await runWithConcurrency(universe, concurrency, async (item, index) => {
    const keys = buildLookupKeyCandidates(item);
    const mappedUrl = keys.map((key) => generatedMap[key]).find(Boolean);

    if (!mappedUrl) {
      missing.push({ name: item.name, baseType: item.baseType });
      return;
    }

    let html = checkedUrls.get(mappedUrl);
    if (!html) {
      try {
        html = await getHtml(mappedUrl);
        checkedUrls.set(mappedUrl, html);
      } catch (error) {
        invalid.push({
          name: item.name,
          baseType: item.baseType,
          url: mappedUrl,
          reason: error.message || 'Fetch failed',
        });
        return;
      }
    }

    if (!isValidPoedbPage(html, item)) {
      invalid.push({
        name: item.name,
        baseType: item.baseType,
        url: mappedUrl,
        reason: 'Page content does not match item name and chart validation',
      });
      return;
    }

    if (!hasExpectedUrlShape(mappedUrl, item)) {
      invalid.push({
        name: item.name,
        baseType: item.baseType,
        url: mappedUrl,
        reason: 'Economy URL slug does not match expected item slug',
      });
    }

    if ((index + 1) % 100 === 0 || index + 1 === universe.length) {
      console.log(`Validated ${index + 1}/${universe.length}`);
    }
  });

  writeJson(REPORT_FILE, {
    league,
    validatedAt: new Date().toISOString(),
    universeCount: universe.length,
    mappedUrlCount: Object.keys(generatedMap).length,
    missingCount: missing.length,
    invalidCount: invalid.length,
    missing,
    invalid,
  });

  console.log(`Validation report written to ${REPORT_FILE}`);
  console.log(`Universe: ${universe.length} | missing: ${missing.length} | invalid: ${invalid.length}`);
}

main().catch((error) => {
  console.error(error?.message || error);
  process.exit(1);
});
