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
  const source = highlightTypeScript(
    'export function parse(value: string): Result { return decode("ok", value); }',
  ).join('\n');
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
  execFileSync(process.execPath, ['src/build-pr.cjs', 'examples/pr-change/manifest.json', output], {
    cwd: path.resolve(__dirname, '..'),
  });
  const html = fs.readFileSync(output, 'utf8');
  const data = JSON.parse(html.match(/<script type="application\/json" id="review-data">(.*?)<\/script>/s)[1]);
  const cards = new Map(data.cards.map((card) => [card.id, card]));
  assert.equal(data.palette.id, 'quiet');
  assert.deepEqual(data.palette, defaultPalette);
  assert.match(cards.get('normalize-message').pseudoRows[0].highlighted, /tok-call/);
  assert.deepEqual(cards.get('normalize-message').markerCounts, { added: 1, removed: 1, modified: 0 });
  assert.deepEqual(cards.get('legacy-slug').markerCounts, { added: 0, removed: 2, modified: 0 });
  assert.deepEqual(cards.get('format-label').markerCounts, { added: 0, removed: 0, modified: 1 });
  // Reworded pseudocode over unchanged source stays neutral, even beside an identical added function.
  assert.equal(cards.get('stable-greeting').status, 'Context');
  assert.deepEqual(cards.get('stable-greeting').markerCounts, { added: 0, removed: 0, modified: 0 });
  // A removed function has no signature edit to report.
  assert.deepEqual(
    cards.get('legacy-slug').pseudoRows.map((row) => row.evidenceKind),
    [null, null],
  );
  assert.deepEqual(
    cards.get('format-label').pseudoRows.map((row) => row.evidenceKind),
    [null, 'implementation'],
  );
  assert.ok(
    data.files[0].unrepresented.some((symbol) => symbol.symbol === 'copiedGreeting'),
    'the adjacent helper remains explicit in the remainder',
  );
});

test('cardOrder puts listed cards first and keeps the rest in input order', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'code-slices-order-'));
  const example = path.resolve(__dirname, '../examples/pr-change');
  const manifest = JSON.parse(fs.readFileSync(path.join(example, 'manifest.json'), 'utf8'));
  manifest.sources = { base: path.join(example, 'base'), head: path.join(example, 'head') };
  manifest.cardOrder = ['stable-greeting', 'format-label'];
  fs.writeFileSync(path.join(root, 'manifest.json'), JSON.stringify(manifest));
  const output = path.join(root, 'report.html');
  execFileSync(process.execPath, ['src/build-pr.cjs', path.join(root, 'manifest.json'), output], {
    cwd: path.resolve(__dirname, '..'),
  });
  const html = fs.readFileSync(output, 'utf8');
  const data = JSON.parse(html.match(/<script type="application\/json" id="review-data">(.*?)<\/script>/s)[1]);
  assert.deepEqual(
    data.cards.map((card) => card.id),
    ['stable-greeting', 'format-label', 'normalize-message', 'legacy-slug'],
  );
});

test('palette preview builds from inline cards', () => {
  const output = path.join(os.tmpdir(), `code-slices-palettes-${process.pid}.html`);
  const stdout = execFileSync(
    process.execPath,
    ['src/build-palette-preview.cjs', 'examples/pr-change/manifest.json', 'normalizeMessage', output],
    { cwd: path.resolve(__dirname, '..'), encoding: 'utf8' },
  );
  assert.equal(JSON.parse(stdout).palettes, palettes.length);
  const html = fs.readFileSync(output, 'utf8');
  for (const palette of palettes) assert.match(html, new RegExp(`data-palette="${palette.id}"`));
  assert.match(html, /tok-call">toLowerCase/);
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

function buildFixture(files, manifest) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'code-slices-pr-fixture-'));
  for (const [file, contents] of Object.entries(files)) {
    fs.mkdirSync(path.dirname(path.join(root, file)), { recursive: true });
    fs.writeFileSync(path.join(root, file), contents);
  }
  fs.writeFileSync(
    path.join(root, 'manifest.json'),
    JSON.stringify({
      title: 'Fixture',
      baseRef: 'before',
      headRef: 'after',
      sources: { base: 'base', head: 'head' },
      cards: [],
      ...manifest,
    }),
  );
  const output = path.join(root, 'report.html');
  execFileSync(process.execPath, ['src/build-pr.cjs', path.join(root, 'manifest.json'), output], {
    cwd: path.resolve(__dirname, '..'),
  });
  const html = fs.readFileSync(output, 'utf8');
  return JSON.parse(html.match(/<script type="application\/json" id="review-data">(.*?)<\/script>/s)[1]);
}

test('report lists functions declared together in one statement', () => {
  const data = buildFixture(
    {
      'base/events.ts': 'export const onOpen = () => {}, onClose = () => {};\nconst handler = () => x, count = 0;\n',
      'head/events.ts': 'export const onOpen = () => {}, onClose = () => 1;\nconst handler = () => y, count = 0;\n',
    },
    { files: ['events.ts'] },
  );
  assert.deepEqual(
    data.files[0].unrepresented.map(({ symbol }) => symbol),
    ['onClose', 'handler'],
  );
  assert.equal(data.files[0].structural, false);
});

test('a change beside a function on the same line is a remaining source change', () => {
  const data = buildFixture(
    {
      'base/events.ts': 'export const onOpen = () => {}, VERSION = 1;\n',
      'head/events.ts': 'export const onOpen = () => {}, VERSION = 2;\n',
    },
    { files: ['events.ts'] },
  );
  assert.deepEqual(data.files[0].changedSymbols, []);
  assert.equal(data.files[0].structural, true);
  assert.equal(data.files[0].showRemainder, true);
});

test('changes inside functions, or whole added functions, are not structural', () => {
  const data = buildFixture(
    {
      'base/worker.ts': 'const alpha = { run() { return 1; } };\n',
      'head/worker.ts': 'const alpha = { run() { return 2; } };\nexport function added() {\n  return 3;\n}\n',
      'head/new.ts': 'export function created() {}\n',
    },
    { files: ['worker.ts', 'new.ts'] },
  );
  assert.deepEqual(
    data.files.map((file) => file.structural),
    [false, false],
  );
});

test('adding or removing a separated object method or declarator is not structural', () => {
  const data = buildFixture(
    {
      'base/api.ts': 'export const api = {\n  run() {\n    return 1;\n  },\n};\n',
      'head/api.ts': 'export const api = {\n  run() {\n    return 1;\n  },\n  stop() {\n    return 0;\n  },\n};\n',
      'base/tail.ts': 'const api = {\n  max: 1,\n  run() {\n    return 1;\n  }\n};\nconst size = 0, last = () => 1;\n',
      'head/tail.ts':
        'const api = {\n  max: 1,\n  run() {\n    return 1;\n  },\n  stop() {\n    return 0;\n  }\n};\nconst size = 0, last = () => 1, other = () => 2;\n',
      'base/inline.ts':
        'const limits = { max: 1, check() { return true; } };\nconst first = () => 1, count = 0;\nconst size = 0, last = () => 1;\n',
      'head/inline.ts':
        'const limits = { max: 1 };\nconst first = () => 1, second = () => 2, count = 0;\nconst size = 0;\n',
    },
    {
      files: ['api.ts', 'tail.ts', 'inline.ts'],
      cards: [
        {
          id: 'api-stop',
          file: 'api.ts',
          symbol: 'stop',
          before: null,
          after: 'stop() → number\n  return 0',
          mappingsBefore: [],
          mappingsAfter: [
            { pseudo: [1, 1], source: [1, 1] },
            { pseudo: [2, 2], source: [2, 3] },
          ],
        },
        {
          id: 'tail-stop',
          file: 'tail.ts',
          symbol: 'stop',
          before: null,
          after: 'stop() → number\n  return 0',
          mappingsBefore: [],
          mappingsAfter: [
            { pseudo: [1, 1], source: [1, 1] },
            { pseudo: [2, 2], source: [2, 3] },
          ],
        },
        {
          id: 'tail-other',
          file: 'tail.ts',
          symbol: 'other',
          before: null,
          after: 'other() → 2',
          mappingsBefore: [],
          mappingsAfter: [{ pseudo: [1, 1], source: [1, 1] }],
        },
      ],
    },
  );
  assert.deepEqual(
    data.files.map(({ path: file, structural, showRemainder }) => ({ file, structural, showRemainder })),
    [
      { file: 'api.ts', structural: false, showRemainder: false },
      { file: 'tail.ts', structural: false, showRemainder: false },
      { file: 'inline.ts', structural: false, showRemainder: true },
    ],
  );
});
