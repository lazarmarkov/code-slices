#!/usr/bin/env node
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { defaultPalette, roles } = require('./code-palettes.cjs');
const { isExcludedReviewPath } = require('./pr-paths.cjs');
const { findSymbol, lineOperations, sourceSymbols } = require('./source-model.cjs');
const { highlightLine } = require('./pseudocode-highlight.cjs');

const args = process.argv.slice(2);
if (args.length !== 2) {
  process.stderr.write('Usage: node src/build-pr.cjs <manifest.json> <output.html>\n');
  process.exit(1);
}

const manifestPath = path.resolve(args[0]);
const manifestDirectory = path.dirname(manifestPath);
const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
const escapeHtml = (value) =>
  String(value ?? '').replace(/[&<>"']/g, (character) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character],
  );

function sourcePath(revision, file) {
  const root = path.resolve(manifestDirectory, manifest.sources[revision]);
  const target = path.resolve(root, file);
  if (!target.startsWith(`${root}${path.sep}`)) throw new Error(`Source path escapes snapshot: ${file}`);
  return target;
}

function readSource(revision, file) {
  const target = sourcePath(revision, file);
  return fs.existsSync(target) ? fs.readFileSync(target, 'utf8') : null;
}

function changedLines(beforePath, afterPath) {
  const oldTarget = fs.existsSync(beforePath) ? beforePath : '/dev/null';
  const newTarget = fs.existsSync(afterPath) ? afterPath : '/dev/null';
  const result = spawnSync(
    'git',
    ['diff', '--no-index', '--no-ext-diff', '--no-color', '--unified=0', '--', oldTarget, newTarget],
    { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 },
  );
  if (result.status !== 0 && result.status !== 1) {
    throw new Error(`git diff failed for ${beforePath}: ${result.stderr || `exit ${result.status}`}`);
  }
  const before = new Set();
  const after = new Set();
  for (const line of result.stdout.split('\n')) {
    const match = line.match(/^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@/);
    if (!match) continue;
    const oldStart = Number(match[1]);
    const oldCount = match[2] === undefined ? 1 : Number(match[2]);
    const newStart = Number(match[3]);
    const newCount = match[4] === undefined ? 1 : Number(match[4]);
    for (let index = 0; index < oldCount; index += 1) before.add(oldStart + index);
    for (let index = 0; index < newCount; index += 1) after.add(newStart + index);
  }
  return { before, after };
}

function loadCards(inputs) {
  return (inputs || []).flatMap((input) => {
    if (typeof input !== 'string') return input.cards || [input];
    const loaded = JSON.parse(fs.readFileSync(path.resolve(manifestDirectory, input), 'utf8'));
    return loaded.cards || [loaded];
  });
}

function keyOf(entry) {
  return `${entry.file}\u0000${entry.className || ''}\u0000${entry.symbol}`;
}

function validateMappings(card, revision, pseudocode, mappings, source) {
  if (pseudocode === null) {
    if (source) throw new Error(`${card.id} has ${revision} source but no full-function pseudocode`);
    return;
  }
  if (!source) throw new Error(`${card.id} has ${revision} pseudocode but no source function`);
  if (!Array.isArray(mappings)) throw new Error(`Missing ${revision} mappings for ${card.id}`);
  const pseudoLines = pseudocode.split('\n').length;
  const sourceLines = source.code.split('\n').length;
  for (const mapping of mappings) {
    for (const [range, maximum] of [
      [mapping.pseudo, pseudoLines],
      [mapping.source, sourceLines],
    ]) {
      if (
        !Array.isArray(range) ||
        range.length !== 2 ||
        !range.every(Number.isInteger) ||
        range[0] < 1 ||
        range[1] < range[0] ||
        range[1] > maximum
      ) {
        throw new Error(`Invalid ${revision} mapping for ${card.id}`);
      }
    }
  }
}

function functionChanges(sourceBefore, sourceAfter) {
  const before = new Set();
  const after = new Set();
  for (const operation of lineOperations(sourceBefore?.code ?? null, sourceAfter?.code ?? null)) {
    if (operation.type === 'delete') before.add(operation.oldLine);
    if (operation.type === 'add') after.add(operation.newLine);
  }
  return { before, after };
}

function evidenceFor(pseudoLine, mappings, source, changes) {
  if (!pseudoLine || !source) return null;
  const changed = new Set();
  for (const mapping of mappings || []) {
    if (pseudoLine < mapping.pseudo[0] || pseudoLine > mapping.pseudo[1]) continue;
    for (let line = mapping.source[0]; line <= mapping.source[1]; line += 1) {
      if (changes.has(line)) changed.add(line);
    }
  }
  if (!changed.size) return null;
  const lines = [...changed].sort((left, right) => left - right);
  return {
    kind: lines.some((line) => line >= source.behaviorStart) ? 'implementation' : 'signature',
    lines,
  };
}

function pseudoRows(card, beforeChanges, afterChanges) {
  return lineOperations(card.before, card.after).map((operation) => {
    const beforeEvidence = evidenceFor(
      operation.oldLine,
      card.mappingsBefore,
      card.sourceBefore,
      beforeChanges,
    );
    const afterEvidence = evidenceFor(
      operation.newLine,
      card.mappingsAfter,
      card.sourceAfter,
      afterChanges,
    );
    let marker = '';
    if (operation.type === 'delete' && beforeEvidence) marker = '-';
    if (operation.type === 'add' && afterEvidence) marker = '+';
    if (operation.type === 'equal' && (beforeEvidence || afterEvidence)) marker = '~';
    const kinds = new Set([beforeEvidence?.kind, afterEvidence?.kind].filter(Boolean));
    return {
      ...operation,
      highlighted: highlightLine(operation.text),
      marker,
      evidenceKind: kinds.has('implementation') ? 'implementation' : kinds.has('signature') ? 'signature' : null,
      beforeSourceLines: beforeEvidence?.lines || [],
      afterSourceLines: afterEvidence?.lines || [],
    };
  });
}

const loadedCards = loadCards(manifest.cards);
const requestedOrder = new Map((manifest.cardOrder || []).map((id, index) => [id, index]));
const authoredCards = loadedCards
  .map((card, index) => ({ card, index }))
  .sort((left, right) => {
    const leftOrder = requestedOrder.has(left.card.id) ? requestedOrder.get(left.card.id) : Number.MAX_SAFE_INTEGER;
    const rightOrder = requestedOrder.has(right.card.id) ? requestedOrder.get(right.card.id) : Number.MAX_SAFE_INTEGER;
    return leftOrder - rightOrder || left.index - right.index;
  })
  .map(({ card }) => card);
const fileInputs = (manifest.files || []).map((input) => (typeof input === 'string' ? { path: input } : input));
for (const card of authoredCards) {
  if (!fileInputs.some((entry) => entry.path === card.file)) fileInputs.push({ path: card.file });
}

const fileData = new Map();
for (const input of fileInputs) {
  if (isExcludedReviewPath(input.path)) continue;
  const before = readSource('base', input.path);
  const after = readSource('head', input.path);
  if (before === null && after === null) throw new Error(`Missing file ${input.path}`);
  const changes = changedLines(sourcePath('base', input.path), sourcePath('head', input.path));
  fileData.set(input.path, {
    ...input,
    before,
    after,
    changes,
    symbolsBefore: sourceSymbols(input.path, before),
    symbolsAfter: sourceSymbols(input.path, after),
  });
}

const ids = new Set();
const cards = authoredCards.map((input) => {
  if (!input.id || !/^[\w-]+$/.test(input.id) || ids.has(input.id)) {
    throw new Error(`Invalid or duplicate card id ${input.id}`);
  }
  ids.add(input.id);
  if (isExcludedReviewPath(input.file)) throw new Error(`Excluded test/eval/helper file: ${input.file}`);
  const file = fileData.get(input.file);
  if (!file) throw new Error(`Card file is unavailable: ${input.file}`);
  const sourceBefore = findSymbol(file.symbolsBefore, input, 'base');
  const sourceAfter = findSymbol(file.symbolsAfter, input, 'head');
  if (!sourceBefore && !sourceAfter) throw new Error(`Missing source function ${input.symbol}`);
  const before = input.before === undefined ? null : input.before;
  const after = input.after === undefined ? null : input.after;
  validateMappings(input, 'before', before, input.mappingsBefore, sourceBefore);
  validateMappings(input, 'after', after, input.mappingsAfter, sourceAfter);
  const exactChanges = functionChanges(sourceBefore, sourceAfter);
  const beforeChanges = exactChanges.before;
  const afterChanges = exactChanges.after;
  const rows = pseudoRows(
    { ...input, before, after, sourceBefore, sourceAfter },
    beforeChanges,
    afterChanges,
  );
  return {
    ...input,
    className: sourceAfter?.className ?? sourceBefore?.className ?? null,
    before,
    after,
    sourceBefore,
    sourceAfter,
    pseudoRows: rows,
    status: !sourceBefore ? 'Added' : !sourceAfter ? 'Removed' : sourceBefore.code === sourceAfter.code ? 'Context' : 'Modified',
    markerCounts: {
      added: rows.filter((row) => row.marker === '+').length,
      removed: rows.filter((row) => row.marker === '-').length,
      modified: rows.filter((row) => row.marker === '~').length,
    },
  };
});

const represented = new Set(cards.map(keyOf));
const files = [...fileData.values()].map((file) => {
  const mapSymbols = (symbols, revision) => {
    const output = new Map();
    for (const symbol of symbols) {
      const symbolKey = keyOf({ ...symbol, file: file.path });
      if (output.has(symbolKey)) {
        throw new Error(`Unsupported duplicate ${revision} symbol in ${file.path}: ${symbol.symbol}`);
      }
      output.set(symbolKey, symbol);
    }
    return output;
  };
  const beforeByKey = mapSymbols(file.symbolsBefore, 'base');
  const afterByKey = mapSymbols(file.symbolsAfter, 'head');
  const changedSymbols = [];
  for (const symbolKey of new Set([...beforeByKey.keys(), ...afterByKey.keys()])) {
    const before = beforeByKey.get(symbolKey) || null;
    const after = afterByKey.get(symbolKey) || null;
    if (before?.code === after?.code) continue;
    const source = after || before;
    changedSymbols.push({
      symbol: source.symbol,
      className: source.className,
      removed: !after,
      added: !before,
      represented: represented.has(symbolKey),
    });
  }

  const inAnySymbol = (line, symbols) => symbols.some((symbol) => line >= symbol.line && line <= symbol.end);
  const structural =
    [...file.changes.before].some((line) => !inAnySymbol(line, file.symbolsBefore)) ||
    [...file.changes.after].some((line) => !inAnySymbol(line, file.symbolsAfter));
  const unrepresented = changedSymbols.filter((symbol) => !symbol.represented);
  return {
    path: file.path,
    note: file.note || '',
    before: file.before,
    after: file.after,
    changedSymbols,
    unrepresented,
    structural,
    showRemainder: Boolean(unrepresented.length || structural),
  };
});

const changedSymbolCount = files.reduce((total, file) => total + file.changedSymbols.length, 0);
const representedCount = files.reduce(
  (total, file) => total + file.changedSymbols.filter((symbol) => symbol.represented).length,
  0,
);
const data = {
  title: manifest.title,
  description: manifest.description || '',
  url: manifest.url || '',
  repositoryURL: manifest.repositoryURL || '',
  base: manifest.baseRef,
  head: manifest.headRef,
  cards,
  files,
  palette: defaultPalette,
  coverage: { changedSymbolCount, representedCount },
};

const baseCss = fs.readFileSync(path.join(__dirname, 'style.css'), 'utf8');
const prCss = fs.readFileSync(path.join(__dirname, 'style-pr.css'), 'utf8');
const runtime = fs.readFileSync(path.join(__dirname, 'runtime-pr.js'), 'utf8');
const paletteCss = `.pr-review{${roles.map((role) => `--code-${role}:${defaultPalette[role]}`).join(';')}}`;
const html = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(manifest.title)}</title><style>${baseCss}\n${paletteCss}\n${prCss}</style></head><body class="pr-review"><header><div class="muted">CODE SLICES / PR CHANGES</div><h1>${escapeHtml(manifest.title)}</h1><p>${escapeHtml(manifest.description || 'Review source-grounded function changes.')}</p><p class="muted">${escapeHtml(manifest.baseRef)} → ${escapeHtml(manifest.headRef)} · ${cards.length} full-function translations · ${representedCount}/${changedSymbolCount} changed symbols represented</p></header><div class="layout"><aside><a href="#changes">Changed functions</a>${cards.map((card, index) => `<a href="#${card.id}">${String(index + 1).padStart(2, '0')} ${escapeHtml((card.className ? `${card.className}.` : '') + card.symbol)}</a>`).join('')}<a href="#remainder">Remaining source changes</a><a href="#guide">Reading guide</a></aside><main><div class="toolbar"><div>View <button data-diff-style="hidden">Pseudo</button><button data-diff-style="unified">Pseudo + unified</button><button data-diff-style="split">Pseudo + split</button></div><span class="peek-hint"><kbd>Shift</kbd> + hover a line to peek at its source</span></div><section id="changes"><div id="cards"></div></section><section class="panel remainder" id="remainder"><h2>Remaining source changes</h2><p class="muted">Changed symbols without a pseudocode card and structural changes are explicit here. Exact file diffs stay collapsed until opened.</p><div id="remainder-content"></div></section><section class="panel" id="guide"><h2>Reading guide</h2><p>The left pane is full-function pseudocode. Its markers appear only when that pseudocode line maps to an exact line changed by Git. A <code>~</code> means the mapped implementation changed while the pseudocode wording stayed the same; it does not claim a behavior change.</p><p>The evidence label distinguishes a declaration or signature edit from an implementation edit. The right pane is the exact TypeScript function diff rendered from the pinned snapshots; the Pseudo view shows the pseudocode alone, and the other two views add the source diff unified or split. In the Pseudo view, holding Shift while hovering a pseudocode line opens a floating peek at that function's source with the mapped lines highlighted; release Shift, press Escape or click elsewhere to close it, or move the pointer into the peek to keep it open. Test, eval, fixture and helper files are excluded from cards, evidence and remaining changes.</p></section></main></div><script type="application/json" id="review-data">${JSON.stringify(data).replace(/</g, '\\u003c')}</script><script type="module">${runtime}</script></body></html>`;

const output = path.resolve(args[1]);
fs.mkdirSync(path.dirname(output), { recursive: true });
fs.writeFileSync(output, html);
process.stdout.write(
  `${JSON.stringify({ output, files: files.length, cards: cards.length, changedSymbolCount, representedCount })}\n`,
);
