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

test('execution-slice reports keep helper files and their cards', () => {
  const manifest = writeFixture(
    {
      'base/src/helpers/format.ts': 'export function format(value: string): string {\n  return value;\n}\n',
      'head/src/helpers/format.ts': 'export function format(value: string): string {\n  return value.trim();\n}\n',
    },
    {
      files: ['src/helpers/format.ts'],
      flows: [
        {
          id: 'format',
          title: 'Format',
          description: '',
          tree: 'format(value)',
          cards: [
            {
              id: 'format-card',
              file: 'src/helpers/format.ts',
              symbol: 'format',
              scenario: 'Any value.',
              before: null,
              after: 'format(value) → string\n  return value.trim()',
              mappingsAfter: [
                { pseudo: [1, 1], source: [1, 1] },
                { pseudo: [2, 2], source: [2, 3] },
              ],
            },
          ],
        },
      ],
    },
  );
  const { data } = build(manifest);
  assert.equal(data.flows[0].cards[0].status, 'Modified');
  assert.deepEqual(data.files[0].changed, [{ symbol: 'format', className: null, card: 'format-card' }]);
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

test('a card with className: null still matches a method', () => {
  const source = 'export class Worker {\n  run(): number {\n    return 1;\n  }\n}\n';
  const manifest = writeFixture(
    { 'base/worker.ts': source, 'head/worker.ts': source },
    {
      files: ['worker.ts'],
      flows: [
        {
          id: 'run',
          title: 'Run',
          description: '',
          tree: 'Worker.run()',
          cards: [
            {
              id: 'run-card',
              file: 'worker.ts',
              symbol: 'run',
              className: null,
              scenario: 'Any worker.',
              before: null,
              after: 'run() → number\n  return 1',
              mappingsAfter: [
                { pseudo: [1, 1], source: [1, 1] },
                { pseudo: [2, 2], source: [2, 3] },
              ],
            },
          ],
        },
      ],
    },
  );
  const { data } = build(manifest);
  const [card] = data.flows[0].cards;
  assert.equal(card.sourceAfter.className, 'Worker');
  assert.equal(card.status, 'Context');
});
