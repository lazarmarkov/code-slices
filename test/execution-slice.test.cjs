const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const test = require('node:test');

const project = path.resolve(__dirname, '..');

function build(manifest) {
  const output = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'code-slices-slice-')), 'report.html');
  execFileSync(process.execPath, ['src/build.cjs', manifest, output], { cwd: project });
  const html = fs.readFileSync(output, 'utf8');
  const data = JSON.parse(html.match(/<script type="application\/json" id="review-data">(.*?)<\/script>/s)[1]);
  return { html, data };
}

function writeFixture(files, manifest) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'code-slices-slice-fixture-'));
  for (const [file, contents] of Object.entries(files)) {
    fs.mkdirSync(path.dirname(path.join(root, file)), { recursive: true });
    fs.writeFileSync(path.join(root, file), contents);
  }
  const manifestPath = path.join(root, 'manifest.json');
  fs.writeFileSync(
    manifestPath,
    JSON.stringify({
      title: 'Fixture',
      baseRef: 'before',
      headRef: 'after',
      sources: { base: 'base', head: 'head' },
      ...manifest,
    }),
  );
  return manifestPath;
}

test('the execution-slice example lists covered and uncovered changed functions', () => {
  const { html, data } = build('examples/execution-slice/manifest.json');
  assert.match(html, /before → after · 1 implementation file</);
  const [card] = data.flows[0].cards;
  assert.equal(card.status, 'Modified');
  assert.equal(card.sourceAfter.line, 1);
  // Three of four after lines are mapped: the closing brace is below the 30% threshold.
  assert.deepEqual(card.visibilityAfter, { hidden: 1, total: 4, percent: 25, show: false });
  assert.deepEqual(card.visibilityBefore, { hidden: 1, total: 3, percent: 33, show: true });
  assert.deepEqual(data.files[0].changed, [
    { symbol: 'normalizeMessage', className: null, card: 'normalize-message-function' },
    { symbol: 'isEmptyMessage', className: null, card: null },
  ]);
  assert.equal(data.files[0].category, 'Slice + remaining changes');
});

test('Logger.log statements do not count as hidden source lines', () => {
  const source = 'export function run(value: string): string {\n  Logger.log(\n    value,\n  );\n  return value;\n}\n';
  const manifest = writeFixture(
    { 'base/run.ts': source, 'head/run.ts': source },
    {
      files: ['run.ts'],
      flows: [
        {
          id: 'run',
          title: 'Run',
          description: '',
          tree: 'run(value)',
          cards: [
            {
              id: 'run-card',
              file: 'run.ts',
              symbol: 'run',
              scenario: 'Any value.',
              before: null,
              after: 'run(value) → string\n  return value',
              mappingsAfter: [
                { pseudo: [1, 1], source: [1, 1] },
                { pseudo: [2, 2], source: [5, 6] },
              ],
            },
          ],
        },
      ],
    },
  );
  const { data } = build(manifest);
  const [card] = data.flows[0].cards;
  assert.equal(card.status, 'Context');
  assert.deepEqual(card.visibilityAfter, { hidden: 0, total: 3, percent: 0, show: false });
});

test('execution-slice reports leave out helper files', () => {
  const manifest = writeFixture(
    {
      'base/src/helpers/secret.ts': 'export function helperSecret() { return "before-private"; }\n',
      'head/src/helpers/secret.ts': 'export function helperSecret() { return "after-private"; }\n',
    },
    { files: ['src/helpers/secret.ts'], flows: [] },
  );
  const { html, data } = build(manifest);
  assert.deepEqual(data.files, []);
  assert.doesNotMatch(html, /helperSecret|before-private|after-private/);
});

test('execution-slice reports list functions declared together in one statement', () => {
  const manifest = writeFixture(
    {
      'base/events.ts': 'export const onOpen = () => {}, onClose = () => {};\nconst handler = () => x, count = 0;\n',
      'head/events.ts': 'export const onOpen = () => {}, onClose = () => 1;\nconst handler = () => y, count = 0;\n',
    },
    { files: ['events.ts'], flows: [] },
  );
  const { data } = build(manifest);
  assert.deepEqual(data.files[0].changed, [
    { symbol: 'onClose', className: null, card: null },
    { symbol: 'handler', className: null, card: null },
  ]);
});
