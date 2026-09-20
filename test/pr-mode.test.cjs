const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const test = require('node:test');
const { highlightLine } = require('../src/pseudocode-highlight.cjs');
const { findSymbol, sourceSymbols } = require('../src/source-model.cjs');
const { defaultPalette, palettes, roles } = require('../src/code-palettes.cjs');
const { highlightTypeScript } = require('../src/typescript-highlight.cjs');

test('pseudocode highlighting colors semantic token classes', () => {
  const html = highlightLine('return parseReply(reply) -> KnownPattern | null');
  assert.match(html, /tok-keyword">return/);
  assert.match(html, /tok-call">parseReply/);
  assert.match(html, /tok-type">KnownPattern/);
  assert.match(html, /tok-literal">null/);
  const style = fs.readFileSync(path.resolve(__dirname, '../src/style-pr.css'), 'utf8');
  assert.match(style, /\.tok-keyword \{ color: var\(--code-keyword\)/);
  assert.match(style, /\.tok-call \{ color: var\(--code-call\)/);
  assert.match(style, /\.tok-type \{ color: var\(--code-type\)/);
  assert.match(style, /\.tok-literal \{ color: var\(--code-literal\)/);
});

test('palette roles are shared by pseudocode and TypeScript tokenizers', () => {
  assert.equal(palettes.length, 4);
  for (const palette of palettes) {
    for (const role of roles) assert.match(palette[role], /^#[0-9A-F]{6}$/);
  }
  const source = highlightTypeScript('export function parse(value: string): Result { return decode("ok", value); }').join('\n');
  assert.match(source, /tok-keyword">export/);
  assert.match(source, /tok-call">parse/);
  assert.match(source, /tok-type">string/);
  assert.match(source, /tok-type">Result/);
  assert.match(source, /tok-literal">&quot;ok&quot;/);
  assert.match(source, /tok-variable">value/);
  assert.match(source, /tok-punctuation">\(/);
});

test('function variable extraction includes declaration modifiers', () => {
  const [symbol] = sourceSymbols('example.ts', 'export const promoted = () => 1;');
  assert.equal(symbol.code, 'export const promoted = () => 1;');
});

test('object-owned methods have distinct owners', () => {
  const symbols = sourceSymbols(
    'example.ts',
    'const alpha = { run() { return 1; } };\nconst beta = { run() { return 2; } };',
  );
  assert.deepEqual(
    symbols.map(({ symbol, className }) => ({ symbol, className })),
    [
      { symbol: 'run', className: 'alpha' },
      { symbol: 'run', className: 'beta' },
    ],
  );
});

test('explicit null owner selects a top-level function', () => {
  const symbols = sourceSymbols('example.ts', 'function run() {}\nclass Worker { run() {} }');
  assert.equal(findSymbol(symbols, { symbol: 'run', className: null }, 'head').className, null);
  assert.equal(findSymbol(symbols, { symbol: 'run', className: 'Worker' }, 'head').className, 'Worker');
});

test('synthetic report grounds markers in exact extracted functions', () => {
  const output = path.join(os.tmpdir(), `code-slices-pr-${process.pid}.html`);
  execFileSync(
    process.execPath,
    ['src/build-pr.cjs', 'examples/pr-change/manifest.json', output],
    { cwd: path.resolve(__dirname, '..') },
  );
  const html = fs.readFileSync(output, 'utf8');
  const data = JSON.parse(html.match(/<script type="application\/json" id="review-data">(.*?)<\/script>/s)[1]);
  const cards = new Map(data.cards.map((card) => [card.id, card]));
  assert.equal(data.palette.id, 'quiet');
  assert.deepEqual(data.palette, defaultPalette);
  assert.match(cards.get('normalize-message').pseudoRows[0].highlighted, /tok-call/);
  assert.deepEqual(cards.get('normalize-message').markerCounts, { added: 1, removed: 1, modified: 0 });
  assert.deepEqual(cards.get('legacy-slug').markerCounts, { added: 0, removed: 2, modified: 0 });
  assert.deepEqual(cards.get('format-label').markerCounts, { added: 0, removed: 0, modified: 1 });
  assert.deepEqual(cards.get('stable-greeting-grounding-guard').markerCounts, {
    added: 0,
    removed: 0,
    modified: 0,
  });
  assert.ok(
    data.files[0].unrepresented.some((symbol) => symbol.symbol === 'copiedGreeting'),
    'the adjacent helper remains explicit in the remainder',
  );
});

test('report excludes helper files and their source', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'code-slices-helper-report-'));
  const base = path.join(root, 'base', 'src', 'helpers');
  const head = path.join(root, 'head', 'src', 'helpers');
  fs.mkdirSync(base, { recursive: true });
  fs.mkdirSync(head, { recursive: true });
  fs.writeFileSync(path.join(base, 'secret.ts'), 'export function helperSecret() { return "before-private"; }\n');
  fs.writeFileSync(path.join(head, 'secret.ts'), 'export function helperSecret() { return "after-private"; }\n');
  fs.writeFileSync(
    path.join(root, 'manifest.json'),
    JSON.stringify({
      title: 'Helper exclusion',
      baseRef: 'before',
      headRef: 'after',
      sources: { base: 'base', head: 'head' },
      files: ['src/helpers/secret.ts'],
      cards: [],
    }),
  );
  const output = path.join(root, 'report.html');
  execFileSync(process.execPath, ['src/build-pr.cjs', path.join(root, 'manifest.json'), output], {
    cwd: path.resolve(__dirname, '..'),
  });
  const html = fs.readFileSync(output, 'utf8');
  const data = JSON.parse(html.match(/<script type="application\/json" id="review-data">(.*?)<\/script>/s)[1]);
  assert.deepEqual(data.files, []);
  assert.doesNotMatch(html, /helperSecret|before-private|after-private/);
});
