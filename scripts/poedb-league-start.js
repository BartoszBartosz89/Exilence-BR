/* eslint-disable no-console */
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const REPORT_FILE = path.resolve(__dirname, 'poedb-links-report.json');
const VALIDATION_REPORT_FILE = path.resolve(__dirname, 'poedb-links-validation-report.json');

function parseArgs(argv) {
  const positionals = [];
  const options = {
    mode: 'missing',
  };

  argv.forEach((arg) => {
    if (arg.startsWith('--mode=')) {
      const mode = arg.slice('--mode='.length);
      if (mode === 'missing' || mode === 'all') {
        options.mode = mode;
      }
      return;
    }

    positionals.push(arg);
  });

  return {
    league: positionals[0] || 'Standard',
    concurrency: positionals[1] || '4',
    mode: options.mode,
  };
}

function runNodeScript(scriptName, args) {
  const scriptPath = path.resolve(__dirname, scriptName);
  const result = spawnSync(process.execPath, [scriptPath, ...args], {
    cwd: ROOT,
    stdio: 'inherit',
  });

  if (result.status !== 0) {
    process.exit(result.status || 1);
  }
}

function readJsonIfExists(filePath) {
  if (!fs.existsSync(filePath)) {
    return undefined;
  }

  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch {
    return undefined;
  }
}

function logSummary(league, mode) {
  const generateReport = readJsonIfExists(REPORT_FILE);
  const validationReport = readJsonIfExists(VALIDATION_REPORT_FILE);

  console.log('');
  console.log('League start summary');
  console.log(`League: ${league}`);
  console.log(`Generate mode: ${mode}`);

  if (generateReport) {
    console.log(
      `Generated links: ${generateReport.hardcodedLinks} | unresolved after generation: ${generateReport.unresolvedCount}`
    );
  }

  if (validationReport) {
    console.log(
      `Validation missing: ${validationReport.missingCount} | validation invalid: ${validationReport.invalidCount}`
    );
  }

  console.log(`Generation report: ${REPORT_FILE}`);
  console.log(`Validation report: ${VALIDATION_REPORT_FILE}`);
}

function main() {
  const args = parseArgs(process.argv.slice(2));

  console.log(`Preparing PoEDB links for league start: ${args.league} (mode: ${args.mode})`);
  runNodeScript('generate-poedb-links.js', [args.league, args.concurrency, `--mode=${args.mode}`]);
  runNodeScript('validate-poedb-links.js', [args.league, args.concurrency]);

  const validationReport = readJsonIfExists(VALIDATION_REPORT_FILE);
  const invalidCount = Number(validationReport?.invalidCount || 0);

  if (invalidCount > 0) {
    console.log('');
    console.log(`Found ${invalidCount} invalid mappings. Pruning them and refilling missing entries...`);
    runNodeScript('prune-invalid-poedb-links.js', []);
    runNodeScript('generate-poedb-links.js', [args.league, args.concurrency, '--mode=missing']);
    runNodeScript('validate-poedb-links.js', [args.league, args.concurrency]);
  }

  logSummary(args.league, args.mode);
}

main();
