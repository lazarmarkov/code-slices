#!/usr/bin/env node
// Prepares a PR for pseudocode authoring: copies the changed source blobs of two Git revisions,
// extracts the changed functions and writes the packets, a card skeleton and a manifest.
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync, spawnSync } = require('node:child_process');
const { changedLineSets, sourceSymbols, symbolsByKey } = require('./source-model.cjs');
const { AUTHORING_RULES, referencedContracts } = require('./pr-generation-contract.cjs');
const { isExcludedPrPath } = require('./excluded-paths.cjs');

const USAGE =
  'Usage: node src/prepare-pr.cjs --repo <repository> --base <base-ref> --head <head-ref> --output <empty-directory> [--title <report title>]';

const OPTIONS = ['repo', 'base', 'head', 'output', 'title'];

function usageError(message) {
  process.stderr.write(`${message}\n${USAGE}\n`);
  process.exit(1);
}

function parseArguments(argv) {
  const values = {};
  for (let index = 0; index < argv.length; index += 2) {
    const name = argv[index];
    const value = argv[index + 1];
    if (!name?.startsWith('--') || value === undefined) usageError('Arguments must be --name value pairs.');
    if (!OPTIONS.includes(name.slice(2))) usageError(`Unknown option: ${name}`);
    values[name.slice(2)] = value;
  }
  for (const name of ['repo', 'base', 'head', 'output']) {
    if (!values[name]) usageError(`Missing --${name}.`);
  }
  return values;
}

function git(repo, args, options = {}) {
  return execFileSync('git', ['-C', repo, ...args], {
    encoding: options.buffer ? null : 'utf8',
    maxBuffer: 128 * 1024 * 1024,
  });
}

function blobExists(repo, revision, file) {
  return spawnSync('git', ['-C', repo, 'cat-file', '-e', `${revision}:${file}`]).status === 0;
}

function readBlob(repo, revision, file) {
  return blobExists(repo, revision, file) ? git(repo, ['show', `${revision}:${file}`], { buffer: true }) : null;
}

function parseChangedFiles(repo, base, head) {
  const fields = git(repo, ['diff', '--name-status', '--no-renames', '-z', base, head]).split('\0');
  const files = [];
  for (let index = 0; index < fields.length - 1; index += 2) {
    const status = fields[index][0];
    const file = fields[index + 1];
    if (!file || isExcludedPrPath(file)) continue;
    files.push({ file, status: status === 'A' ? 'Added' : status === 'D' ? 'Removed' : 'Modified' });
  }
  return files.sort((left, right) => left.file.localeCompare(right.file));
}

function slug(value) {
  return value
    .replace(/[^A-Za-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .toLowerCase();
}

function uniqueId(file, symbol, used) {
  const fileStem = file.replace(/\.[^./]+$/, '');
  const base = slug(`${fileStem}-${symbol.className ? `${symbol.className}-` : ''}${symbol.symbol}`);
  let id = base;
  let suffix = 2;
  while (used.has(id)) {
    id = `${base}-${suffix}`;
    suffix += 1;
  }
  used.add(id);
  return id;
}

// Numbers each source line and puts `marker` in front of the changed ones.
function numbered(code, changed, marker) {
  if (code === null) return '<absent>';
  const lines = code.split('\n');
  const width = String(lines.length).length;
  return lines
    .map((line, index) => `${changed.has(index + 1) ? marker : ' '} ${String(index + 1).padStart(width)} | ${line}`)
    .join('\n');
}

function packetBody(packet) {
  return packet.files
    .map((file) => {
      const contracts = ['base', 'head']
        .map((revision) => {
          const value = file.contracts[revision];
          if (!value.imports.length && !value.declarations.length) return '';
          return `#### ${revision} contracts\n\n\`\`\`ts\n${[...value.imports, ...value.declarations].join('\n\n')}\n\`\`\``;
        })
        .filter(Boolean)
        .join('\n\n');
      const functions = file.functions
        .map(
          (entry) =>
            `### ${entry.order}. ${entry.card.id} - ${entry.card.status}\n\nSymbol: \`${entry.card.className ? `${entry.card.className}.` : ''}${entry.card.symbol}\`\n\nBefore source (\`-\` marks deleted lines):\n\n\`\`\`ts\n${numbered(entry.sourceBefore?.code ?? null, new Set(entry.changedBefore), '-')}\n\`\`\`\n\nAfter source (\`+\` marks added lines):\n\n\`\`\`ts\n${numbered(entry.sourceAfter?.code ?? null, new Set(entry.changedAfter), '+')}\n\`\`\``,
        )
        .join('\n\n');
      return `## ${file.path}\n\n${contracts ? `${contracts}\n\n` : ''}${functions || '_No extractable changed function; retained for exact file-level review._'}`;
    })
    .join('\n\n');
}

function writeJson(target, value) {
  fs.writeFileSync(target, `${JSON.stringify(value, null, 2)}\n`);
}

const options = parseArguments(process.argv.slice(2));
const repo = path.resolve(options.repo);
const output = path.resolve(options.output);
if (!fs.statSync(repo).isDirectory()) throw new Error(`Repository is not a directory: ${repo}`);
if (fs.existsSync(output) && fs.readdirSync(output).length) {
  throw new Error(`Output directory must be empty: ${output}`);
}
fs.mkdirSync(output, { recursive: true });

const base = git(repo, ['rev-parse', `${options.base}^{commit}`]).trim();
const head = git(repo, ['rev-parse', `${options.head}^{commit}`]).trim();
const changedFiles = parseChangedFiles(repo, base, head);
const usedIds = new Set();
const cards = [];
const packetFiles = [];
let order = 1;

for (const changedFile of changedFiles) {
  const beforeBuffer = readBlob(repo, base, changedFile.file);
  const afterBuffer = readBlob(repo, head, changedFile.file);
  for (const [revision, buffer] of [
    ['base', beforeBuffer],
    ['head', afterBuffer],
  ]) {
    if (!buffer) continue;
    const target = path.join(output, 'source', revision, changedFile.file);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, buffer);
  }
  const beforeText = beforeBuffer?.toString('utf8') ?? null;
  const afterText = afterBuffer?.toString('utf8') ?? null;
  const beforeSymbols = symbolsByKey(changedFile.file, sourceSymbols(changedFile.file, beforeText), 'base');
  const afterSymbols = symbolsByKey(changedFile.file, sourceSymbols(changedFile.file, afterText), 'head');
  const entries = [];
  for (const key of [...new Set([...beforeSymbols.keys(), ...afterSymbols.keys()])].sort()) {
    const sourceBefore = beforeSymbols.get(key) || null;
    const sourceAfter = afterSymbols.get(key) || null;
    if (sourceBefore?.code === sourceAfter?.code) continue;
    const source = sourceAfter || sourceBefore;
    const changes = changedLineSets(sourceBefore?.code ?? null, sourceAfter?.code ?? null);
    const card = {
      id: uniqueId(changedFile.file, source, usedIds),
      file: changedFile.file,
      symbol: source.symbol,
      ...(source.className ? { className: source.className } : {}),
      status: !sourceBefore ? 'Added' : !sourceAfter ? 'Removed' : 'Modified',
      before: sourceBefore ? '' : null,
      after: sourceAfter ? '' : null,
      mappingsBefore: [],
      mappingsAfter: [],
    };
    cards.push(card);
    entries.push({
      order,
      card,
      sourceBefore,
      sourceAfter,
      changedBefore: [...changes.before],
      changedAfter: [...changes.after],
    });
    order += 1;
  }
  const beforeFunctionCode = entries.map((entry) => entry.sourceBefore?.code || '').join('\n');
  const afterFunctionCode = entries.map((entry) => entry.sourceAfter?.code || '').join('\n');
  packetFiles.push({
    path: changedFile.file,
    status: changedFile.status,
    contracts: {
      base: referencedContracts(changedFile.file, beforeText, beforeFunctionCode),
      head: referencedContracts(changedFile.file, afterText, afterFunctionCode),
    },
    functions: entries,
  });
}

const manifest = {
  title: options.title || `PR changes ${base.slice(0, 8)}..${head.slice(0, 8)}`,
  description: 'Prepared from exact Git blobs. Author full-function pseudocode and source mappings in cards.json.',
  baseRef: base,
  headRef: head,
  sources: { base: 'source/base', head: 'source/head' },
  files: changedFiles.map(({ file }) => file),
  cards: ['cards.json'],
};
const packet = {
  version: 1,
  repository: repo,
  base,
  head,
  excludedPathRule: 'tests, evals, fixtures, helpers, test helpers, and *.test/spec/eval.*',
  files: packetFiles,
};
const body = packetBody(packet);
const generation = `# PR pseudocode generation packet\n\nPinned base: \`${base}\`\nPinned head: \`${head}\`\n\n${AUTHORING_RULES}\n\n${body}\n`;
const verification = `# PR pseudocode verification packet\n\nPinned base: \`${base}\`\nPinned head: \`${head}\`\n\n${AUTHORING_RULES}\n\nVerify the authored cards against the evidence below, then run \`node src/validate-pr-cards.cjs ${output} cards.json --repair-output repair-packet.json\`. Resolve errors and review scope warnings. The repair packet contains only affected cards and evidence.\n\n${body}\n`;

writeJson(path.join(output, 'manifest.json'), manifest);
writeJson(path.join(output, 'cards.json'), { cards });
writeJson(path.join(output, 'packet.json'), packet);
fs.writeFileSync(path.join(output, 'generation-packet.md'), generation);
fs.writeFileSync(path.join(output, 'verification-packet.md'), verification);
process.stdout.write(
  `${JSON.stringify({ output, base, head, files: changedFiles.length, cards: cards.length, excluded: 'tests/evals/fixtures/helpers' })}\n`,
);
