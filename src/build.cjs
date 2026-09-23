#!/usr/bin/env node
// Builds an execution-slice report: selected paths through changed code, as pseudocode beside source.
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const { escapeHtml } = require('./escape-html.cjs');
const { isExcludedPath } = require('./excluded-paths.cjs');
const { loadManifest, writeReport } = require('./manifest.cjs');
const { findSymbol, isTypeScriptFile, isValidRange, lineCount, sourceSymbols } = require('./source-model.cjs');

const args = process.argv.slice(2);
if (args.length !== 2) {
  process.stderr.write('Usage: node src/build.cjs <manifest.json> <output.html>\n');
  process.exit(1);
}

const { manifest, readSource, loadEntries } = loadManifest(args[0]);
const parse = (file, text) => ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true);
// Unlike PR mode, a card without a truthy className matches a function under any owner.
const cardSource = (revision, card) => {
  const symbols = sourceSymbols(card.file, readSource(revision, card.file));
  return findSymbol(symbols, card.className ? card : { symbol: card.symbol }, revision);
};

// Function-relative lines that hold nothing but a complete Logger.log(...) statement.
function loggerLines(revision, file, source) {
  const sourceFile = parse(file, readSource(revision, file));
  const fileLines = sourceFile.text.split('\n');
  const lines = new Set();
  function visit(node) {
    if (
      ts.isExpressionStatement(node) &&
      ts.isCallExpression(node.expression) &&
      node.expression.expression.getText(sourceFile) === 'Logger.log'
    ) {
      const start = sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile));
      const end = sourceFile.getLineAndCharacterOfPosition(node.end);
      for (let line = start.line; line <= end.line; line += 1) {
        const before = line === start.line ? fileLines[line].slice(0, start.character) : '';
        const after = line === end.line ? fileLines[line].slice(end.character) : '';
        // Zero-based file line to one-based function line.
        if (!before.trim() && !after.trim()) lines.add(line + 1 - source.line + 1);
      }
    }
    ts.forEachChild(node, visit);
  }
  visit(sourceFile);
  return lines;
}

// How much of the function no mapping covers. The report flags more than 30% hidden.
function visibility(source, mappings, file, revision) {
  if (!source) return null;
  const represented = new Set();
  for (const mapping of mappings) {
    if (!mapping.source) continue;
    for (let line = mapping.source[0]; line <= mapping.source[1]; line += 1) represented.add(line);
  }
  const ignored = loggerLines(revision, file, source);
  const eligible = source.code
    .split('\n')
    .map((text, index) => ({ text, line: index + 1 }))
    .filter((row) => row.text.trim() && !ignored.has(row.line));
  const hidden = eligible.filter((row) => !represented.has(row.line)).length;
  const total = eligible.length;
  return {
    hidden,
    total,
    percent: total ? Math.round((hidden / total) * 100) : 0,
    show: total > 0 && hidden / total > 0.3,
  };
}

function validateCard(card) {
  for (const [revision, pseudocode, mappings, source] of [
    ['after', card.after, card.mappingsAfter, card.sourceAfter],
    ['before', card.before, card.mappingsBefore, card.sourceBefore],
  ]) {
    if (pseudocode == null) continue;
    if (!source) throw new Error(`Pseudocode has no original source: ${card.id} ${revision}`);
    if (!Array.isArray(mappings)) throw new Error(`Missing mappings for ${card.id} ${revision}`);
    for (const mapping of mappings) {
      if (
        !isValidRange(mapping.pseudo, lineCount(pseudocode)) ||
        !isValidRange(mapping.source, lineCount(source.code))
      ) {
        throw new Error(`Invalid mapping ${card.id} ${revision}`);
      }
    }
  }
}

const flows = loadEntries(manifest.flows, 'flows');
const cards = flows.flatMap((flow) => flow.cards);
const ids = new Set();
const claimId = (kind, id) => {
  if (!/^[\w-]+$/.test(id) || ids.has(id)) throw new Error(`Invalid/duplicate ${kind} id ${id}`);
  ids.add(id);
};
for (const flow of flows) {
  claimId('flow', flow.id);
  for (const card of flow.cards) {
    claimId('card', card.id);
    if (isExcludedPath(card.file)) throw new Error(`Excluded test/eval/helper file: ${card.file}`);
    card.flowId = flow.id;
    card.sourceAfter = cardSource('head', card);
    card.sourceBefore = cardSource('base', card);
    if (!card.sourceAfter) throw new Error(`Missing head function ${card.symbol}`);
    validateCard(card);
    card.status = !card.sourceBefore
      ? 'Added'
      : card.sourceBefore.code === card.sourceAfter.code
        ? 'Context'
        : 'Modified';
    card.visibilityAfter = visibility(card.sourceAfter, card.mappingsAfter || [], card.file, 'head');
    card.visibilityBefore = visibility(card.sourceBefore, card.mappingsBefore || [], card.file, 'base');
  }
}

const sameSymbol = (left, right) => left.symbol === right.symbol && left.className === right.className;
const files = manifest.files
  .map((input) => (typeof input === 'string' ? { path: input } : input))
  .filter((file) => !isExcludedPath(file.path))
  .map((file) => {
    const before = readSource('base', file.path);
    const after = readSource('head', file.path);
    if (before === null && after === null) throw new Error(`Missing file ${file.path}`);
    const oldSymbols = sourceSymbols(file.path, before);
    const newSymbols = sourceSymbols(file.path, after);
    const changed = newSymbols
      .filter((symbol) => !oldSymbols.some((old) => sameSymbol(old, symbol) && old.code === symbol.code))
      .map((symbol) => {
        const card = cards.find(
          (entry) =>
            entry.file === file.path &&
            entry.symbol === symbol.symbol &&
            (!entry.className || entry.className === symbol.className),
        );
        return { symbol: symbol.symbol, className: symbol.className, card: card?.id || null };
      });
    for (const symbol of oldSymbols) {
      if (!newSymbols.some((next) => sameSymbol(next, symbol))) {
        changed.push({ symbol: symbol.symbol, className: symbol.className, card: null, removed: true });
      }
    }
    const covered = [...new Set(cards.filter((card) => card.file === file.path).map((card) => card.flowId))];
    const category = covered.length
      ? 'Slice + remaining changes'
      : changed.length
        ? 'Not covered by a slice'
        : 'Structural/support review';
    return { ...file, before, after, changed, flows: covered, category };
  });

// Top-level type, interface and enum declarations, shown while Alt is held.
const types = { base: {}, head: {} };
for (const revision of ['base', 'head']) {
  for (const file of files) {
    const text = readSource(revision, file.path);
    if (!text || !isTypeScriptFile(file.path)) continue;
    const sourceFile = parse(file.path, text);
    for (const node of sourceFile.statements) {
      if (
        (ts.isTypeAliasDeclaration(node) || ts.isInterfaceDeclaration(node) || ts.isEnumDeclaration(node)) &&
        node.name
      ) {
        types[revision][node.name.text] = { file: file.path, code: node.getText(sourceFile) };
      }
    }
  }
}

const data = {
  title: manifest.title,
  url: manifest.url || '',
  repositoryURL: manifest.repositoryURL || '',
  base: manifest.baseRef,
  head: manifest.headRef,
  flows,
  files,
  types,
};
const readAsset = (name) => fs.readFileSync(path.join(__dirname, name), 'utf8');
const html = [
  '<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">',
  `<title>${escapeHtml(manifest.title)}</title>`,
  `<style>${readAsset('style.css')}</style>`,
  '</head><body>',
  '<header><div class="muted">CODE SLICES / EXECUTION SLICE</div>',
  `<h1>${escapeHtml(manifest.title)}</h1>`,
  `<p>${escapeHtml(manifest.description || 'Explore selected paths through changed code.')}</p>`,
  `<p class="muted">${escapeHtml(manifest.baseRef)} → ${escapeHtml(manifest.headRef)} · ${files.length} implementation ${files.length === 1 ? 'file' : 'files'}</p>`,
  '</header>',
  '<div class="layout"><aside><a href="#coverage">Changed-code index</a>',
  ...flows.map(
    (flow, index) => `<a href="#${flow.id}">${String(index + 1).padStart(2, '0')} ${escapeHtml(flow.title)}</a>`,
  ),
  '<a href="#structural">Supporting changes</a><a href="#guide">Reading guide</a></aside>',
  '<main><div class="toolbar">',
  '<div>Revision <button data-revision="after">After</button><button data-revision="before">Before</button><button data-revision="changes">Changes</button></div>',
  '<div>View <button data-mode="pseudo">Pseudocode</button><button data-mode="split">Split</button></div>',
  '<span class="muted">Hold Alt for types</span></div>',
  '<section class="panel" id="coverage"><h2>Changed-code index</h2>',
  '<p class="muted">Slices explain selected behavior. Changed functions outside the slices are listed here too. Open a file to see its exact diff.</p>',
  '<div id="coverage-content"></div></section>',
  '<div id="flows"></div>',
  '<section class="panel" id="structural"><h2>Supporting changes</h2><div id="structural-content"></div></section>',
  '<section class="panel" id="guide"><h2>Reading guide</h2>',
  '<p>The <code>▹</code> line describes the selected execution. A function added by the PR has no Before implementation. Changes diffs the complete pseudocode of each function; Split also shows the source diff. In After and Before, hover a line to highlight the lines it maps to on the other side.</p>',
  '<p>A yellow dot appears when more than 30% of the nonblank source lines, not counting Logger.log statements, have no mapping. It estimates how much of the source the pseudocode represents; it is not execution coverage. Hold Alt to see type definitions. The report is an authored reading of the source, not a recorded execution.</p>',
  '</section></main></div>',
  `<script type="application/json" id="review-data">${JSON.stringify(data).replace(/</g, '\\u003c')}</script>`,
  `<script type="module">${readAsset('runtime.js')}</script>`,
  '</body></html>',
].join('');

const output = writeReport(args[1], html);
process.stdout.write(`${JSON.stringify({ output, files: files.length, flows: flows.length, cards: cards.length })}\n`);
