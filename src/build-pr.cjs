#!/usr/bin/env node
// Builds a PR-change report: authored full-function pseudocode beside the exact TypeScript diff.
const fs = require('node:fs');
const path = require('node:path');
const { defaultPalette, roles } = require('./code-palettes.cjs');
const { escapeHtml } = require('./escape-html.cjs');
const { isExcludedPrPath } = require('./excluded-paths.cjs');
const { loadManifest, writeReport } = require('./manifest.cjs');
const {
  changedLineSets,
  findSymbol,
  isValidRange,
  lineCount,
  lineOperations,
  sourceSymbols,
  symbolKey,
  symbolsByKey,
} = require('./source-model.cjs');
const { highlightLine } = require('./pseudocode-highlight.cjs');

const args = process.argv.slice(2);
if (args.length !== 2) {
  process.stderr.write('Usage: node src/build-pr.cjs <manifest.json> <output.html>\n');
  process.exit(1);
}

const { manifest, readSource, loadEntries } = loadManifest(args[0]);

// The file text with every extracted function cut out, along with the comma that separates it
// from the object member or declarator before it (or after it, for the first in a list). A line
// that held only function text is dropped, so adding or removing a whole function leaves the rest
// unchanged.
function textOutsideSymbols(text, symbols) {
  const source = text ?? '';
  const cut = '\u0000';
  let kept = '';
  let cursor = 0;
  for (let [start, end] of symbols.map((symbol) => symbol.span).sort((left, right) => left[0] - right[0])) {
    if (end <= cursor) continue;
    start = Math.max(cursor, start);
    const preceding = source.slice(cursor, start).match(/,\s*$/);
    const following = source.slice(end).match(/^\s*,[^\S\n]*/);
    if (preceding) start -= preceding[0].length;
    else if (following) end += following[0].length;
    kept += `${source.slice(cursor, start)}${cut}`;
    cursor = end;
  }
  kept += source.slice(cursor);
  return kept
    .split('\n')
    .filter((line) => !line.includes(cut) || line.replaceAll(cut, '').trim())
    .map((line) => line.replaceAll(cut, ''))
    .join('\n');
}

function validateMappings(card, revision, pseudocode, mappings, source) {
  if (pseudocode === null) {
    if (source) throw new Error(`${card.id} has ${revision} source but no full-function pseudocode`);
    return;
  }
  if (!source) throw new Error(`${card.id} has ${revision} pseudocode but no source function`);
  if (!Array.isArray(mappings)) throw new Error(`Missing ${revision} mappings for ${card.id}`);
  for (const mapping of mappings) {
    if (!isValidRange(mapping.pseudo, lineCount(pseudocode)) || !isValidRange(mapping.source, lineCount(source.code))) {
      throw new Error(`Invalid ${revision} mapping for ${card.id}`);
    }
  }
}

// The changed source lines that a pseudocode line maps to, or null when it maps to none.
// The kind is set only when both revisions of the function exist, since an added or removed
// function has no signature edit to tell apart from an implementation edit.
function evidenceFor(pseudoLine, mappings, source, changedLines, bothSides) {
  if (!pseudoLine || !source) return null;
  const lines = new Set();
  for (const mapping of mappings || []) {
    if (pseudoLine < mapping.pseudo[0] || pseudoLine > mapping.pseudo[1]) continue;
    for (let line = mapping.source[0]; line <= mapping.source[1]; line += 1) {
      if (changedLines.has(line)) lines.add(line);
    }
  }
  if (!lines.size) return null;
  const sorted = [...lines].sort((left, right) => left - right);
  const reachesBody = sorted.some((line) => line >= source.behaviorStart);
  return { kind: bothSides ? (reachesBody ? 'implementation' : 'signature') : null, lines: sorted };
}

// Diffs the two pseudocode revisions and marks each line only when its mapped source changed.
function pseudoRows(card, changes) {
  const bothSides = Boolean(card.sourceBefore && card.sourceAfter);
  return lineOperations(card.before, card.after).map((operation) => {
    const before = evidenceFor(operation.oldLine, card.mappingsBefore, card.sourceBefore, changes.before, bothSides);
    const after = evidenceFor(operation.newLine, card.mappingsAfter, card.sourceAfter, changes.after, bothSides);
    let marker = '';
    if (operation.type === 'delete' && before) marker = '-';
    if (operation.type === 'add' && after) marker = '+';
    if (operation.type === 'equal' && (before || after)) marker = '~';
    const kinds = [before?.kind, after?.kind];
    return {
      ...operation,
      highlighted: highlightLine(operation.text),
      marker,
      // An implementation change on either side outranks a signature change.
      evidenceKind: ['implementation', 'signature'].find((kind) => kinds.includes(kind)) ?? null,
      beforeSourceLines: before?.lines || [],
      afterSourceLines: after?.lines || [],
    };
  });
}

// Cards listed in manifest.cardOrder lead; the rest keep their input order (sort is stable).
const cardOrder = new Map((manifest.cardOrder || []).map((id, index) => [id, index]));
const rank = (card) => cardOrder.get(card.id) ?? cardOrder.size;
const authoredCards = loadEntries(manifest.cards, 'cards').sort((left, right) => rank(left) - rank(right));

const fileInputs = (manifest.files || []).map((input) => (typeof input === 'string' ? { path: input } : input));
for (const card of authoredCards) {
  if (!fileInputs.some((entry) => entry.path === card.file)) fileInputs.push({ path: card.file });
}

const fileData = new Map();
for (const input of fileInputs) {
  if (isExcludedPrPath(input.path)) continue;
  const before = readSource('base', input.path);
  const after = readSource('head', input.path);
  if (before === null && after === null) throw new Error(`Missing file ${input.path}`);
  fileData.set(input.path, {
    ...input,
    before,
    after,
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
  if (isExcludedPrPath(input.file)) throw new Error(`Excluded test/eval/helper file: ${input.file}`);
  const file = fileData.get(input.file);
  if (!file) throw new Error(`Card file is unavailable: ${input.file}`);
  const sourceBefore = findSymbol(file.symbolsBefore, input, 'base');
  const sourceAfter = findSymbol(file.symbolsAfter, input, 'head');
  if (!sourceBefore && !sourceAfter) throw new Error(`Missing source function ${input.symbol}`);
  const card = { ...input, before: input.before ?? null, after: input.after ?? null, sourceBefore, sourceAfter };
  validateMappings(card, 'before', card.before, card.mappingsBefore, sourceBefore);
  validateMappings(card, 'after', card.after, card.mappingsAfter, sourceAfter);
  const rows = pseudoRows(card, changedLineSets(sourceBefore?.code ?? null, sourceAfter?.code ?? null));
  const countMarker = (marker) => rows.filter((row) => row.marker === marker).length;
  return {
    ...card,
    className: sourceAfter?.className ?? sourceBefore?.className ?? null,
    pseudoRows: rows,
    status: !sourceBefore
      ? 'Added'
      : !sourceAfter
        ? 'Removed'
        : sourceBefore.code === sourceAfter.code
          ? 'Context'
          : 'Modified',
    markerCounts: { added: countMarker('+'), removed: countMarker('-'), modified: countMarker('~') },
  };
});

const representedKeys = new Set(cards.map((card) => `${card.file}\u0000${symbolKey(card)}`));
const files = [...fileData.values()].map((file) => {
  const beforeByKey = symbolsByKey(file.path, file.symbolsBefore, 'base');
  const afterByKey = symbolsByKey(file.path, file.symbolsAfter, 'head');
  const changedSymbols = [];
  for (const key of new Set([...beforeByKey.keys(), ...afterByKey.keys()])) {
    const before = beforeByKey.get(key);
    const after = afterByKey.get(key);
    if (before?.code === after?.code) continue;
    const source = after || before;
    changedSymbols.push({
      symbol: source.symbol,
      className: source.className,
      removed: !after,
      added: !before,
      represented: representedKeys.has(`${file.path}\u0000${key}`),
    });
  }

  // A change outside every extracted function, such as an import or a constant.
  const structural =
    textOutsideSymbols(file.before, file.symbolsBefore) !== textOutsideSymbols(file.after, file.symbolsAfter);
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

const readAsset = (name) => fs.readFileSync(path.join(__dirname, name), 'utf8');
const paletteCss = `.pr-review{${roles.map((role) => `--code-${role}:${defaultPalette[role]}`).join(';')}}`;
const functionName = (card) => `${card.className ? `${card.className}.` : ''}${card.symbol}`;
const html = [
  '<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">',
  `<title>${escapeHtml(manifest.title)}</title>`,
  `<style>${readAsset('style.css')}\n${paletteCss}\n${readAsset('style-pr.css')}</style>`,
  '</head><body class="pr-review">',
  '<header><div class="muted">CODE SLICES / PR CHANGES</div>',
  `<h1>${escapeHtml(manifest.title)}</h1>`,
  `<p>${escapeHtml(manifest.description || 'Pseudocode for each changed function, beside its exact source diff.')}</p>`,
  `<p class="muted">${escapeHtml(manifest.baseRef)} → ${escapeHtml(manifest.headRef)} · ${cards.length} ${cards.length === 1 ? 'card' : 'cards'} · ${representedCount} of ${changedSymbolCount} changed functions have a card</p>`,
  '</header>',
  '<div class="layout"><aside><a href="#changes">Changed functions</a>',
  ...cards.map(
    (card, index) =>
      `<a href="#${card.id}">${String(index + 1).padStart(2, '0')} ${escapeHtml(functionName(card))}</a>`,
  ),
  '<a href="#remainder">Remaining source changes</a><a href="#guide">Reading guide</a></aside>',
  '<main><div class="toolbar"><div>View ',
  '<button data-diff-style="hidden">Pseudo</button>',
  '<button data-diff-style="unified">Pseudo + unified</button>',
  '<button data-diff-style="split">Pseudo + split</button></div>',
  '<span class="peek-hint"><kbd>Shift</kbd> + hover a line to peek at its source</span></div>',
  '<section id="changes"><div id="cards"></div></section>',
  '<section class="panel remainder" id="remainder"><h2>Remaining source changes</h2>',
  '<p class="muted">Changed functions without a pseudocode card, and changes outside any function. Open a file to see its exact diff.</p>',
  '<div id="remainder-content"></div></section>',
  '<section class="panel" id="guide"><h2>Reading guide</h2>',
  '<p>The pseudocode describes each whole function. A line gets a marker only when it maps to a source line that Git reports as changed: <code>+</code> added, <code>-</code> removed, and <code>~</code> for unchanged pseudocode whose mapped source changed. A <code>~</code> does not claim that behavior changed. Pseudocode that was reworded over unchanged source gets no marker.</p>',
  '<p>A <code>signature</code> badge marks a line whose only mapped change is in the function declaration. The source pane shows the exact TypeScript diff of the function. Pseudo shows the pseudocode alone; the other two views add the source diff, unified or split. In Pseudo, hold Shift and hover a line to peek at the function source with the mapped lines highlighted. Release Shift, press Escape or click elsewhere to close the peek; move the pointer into it to keep it open.</p>',
  '<p>Test, eval, fixture and helper files are left out of the report.</p>',
  '</section></main></div>',
  `<script type="application/json" id="review-data">${JSON.stringify(data).replace(/</g, '\\u003c')}</script>`,
  `<script type="module">${readAsset('runtime-pr.js')}</script>`,
  '</body></html>',
].join('');

const output = writeReport(args[1], html);
process.stdout.write(
  `${JSON.stringify({ output, files: files.length, cards: cards.length, changedSymbolCount, representedCount })}\n`,
);
