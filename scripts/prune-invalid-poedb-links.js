/* eslint-disable no-console */
const fs = require('fs');
const path = require('path');

const MAP_FILE = path.resolve(__dirname, '..', 'src', 'data', 'poedb-item-links.generated.json');
const VALIDATION_REPORT_FILE = path.resolve(
  __dirname,
  '..',
  'scripts',
  'poedb-links-validation-report.json'
);

function readJson(filePath) {
  const raw = fs.readFileSync(filePath, 'utf8');
  return JSON.parse(raw);
}

function writeJson(filePath, data) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(data, null, 2)}\n`, 'utf8');
}

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

function main() {
  const generatedMap = readJson(MAP_FILE);
  const validationReport = readJson(VALIDATION_REPORT_FILE);
  const invalid = Array.isArray(validationReport.invalid) ? validationReport.invalid : [];

  let removed = 0;

  invalid.forEach((item) => {
    buildLookupKeyCandidates(item).forEach((key) => {
      if (generatedMap[key]) {
        delete generatedMap[key];
        removed += 1;
      }
    });
  });

  writeJson(MAP_FILE, generatedMap);
  console.log(`Removed ${removed} invalid hardcoded mappings from ${MAP_FILE}`);
}

main();
