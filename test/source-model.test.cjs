const assert = require('node:assert/strict');
const test = require('node:test');
const { escapeHtml } = require('../src/escape-html.cjs');
const { isExcludedPrPath, isTestPath } = require('../src/excluded-paths.cjs');
const { changedLineSets, isValidRange, sourceSymbols, symbolsByKey } = require('../src/source-model.cjs');

test('changedLineSets lists deleted and added lines on each side', () => {
  const changes = changedLineSets('a\nb\nc', 'a\nB\nc\nd');
  assert.deepEqual([...changes.before], [2]);
  assert.deepEqual([...changes.after], [2, 4]);
  assert.deepEqual([...changedLineSets(null, 'a\nb').after], [1, 2]);
  assert.deepEqual([...changedLineSets('a', null).before], [1]);
});

test('isValidRange accepts one-based inclusive ranges within the line count', () => {
  assert.equal(isValidRange([1, 1], 1), true);
  assert.equal(isValidRange([2, 3], 3), true);
  for (const range of [[0, 1], [2, 1], [1, 4], [1.5, 2], [1], null, '1-2']) {
    assert.equal(isValidRange(range, 3), false, JSON.stringify(range));
  }
});

test('behaviorStart is the first body line, relative to the function', () => {
  const [block, arrow] = sourceSymbols(
    'example.ts',
    'function run(\n  value: string,\n): string {\n  return value;\n}\nconst short = (value: string) =>\n  value.trim();',
  );
  assert.equal(block.behaviorStart, 4);
  assert.equal(arrow.behaviorStart, 2);
});

test('sourceSymbols recognizes constructors and skips non-TypeScript files', () => {
  const symbols = sourceSymbols('example.ts', 'class Worker { constructor() { this.ready = true; } }');
  assert.deepEqual(
    symbols.map(({ symbol, className }) => ({ symbol, className })),
    [{ symbol: 'constructor', className: 'Worker' }],
  );
  assert.deepEqual(sourceSymbols('example.js', 'function run() {}'), []);
});

test('sourceSymbols records each function in a multi-declarator statement with its own span', () => {
  const symbols = sourceSymbols(
    'example.ts',
    'export const onOpen = () => {}, onClose = () => {};\nconst handler = () => x, count = 0;',
  );
  assert.deepEqual(
    symbols.map(({ symbol, line, code }) => ({ symbol, line, code })),
    [
      { symbol: 'onOpen', line: 1, code: 'onOpen = () => {}' },
      { symbol: 'onClose', line: 1, code: 'onClose = () => {}' },
      { symbol: 'handler', line: 2, code: 'handler = () => x' },
    ],
  );
});

test('symbolsByKey rejects two functions with the same owner and name', () => {
  const symbols = sourceSymbols(
    'example.ts',
    'function a() { function inner() {} }\nfunction b() { function inner() {} }',
  );
  assert.throws(
    () => symbolsByKey('example.ts', symbols, 'head'),
    /Unsupported duplicate head symbol in example.ts: inner/,
  );
});

test('isTestPath covers tests, evals and fixtures; isExcludedPrPath adds helper directories', () => {
  for (const file of [
    'test/a.ts',
    'src/__tests__/a.ts',
    'evals/a.ts',
    'src/a.test.ts',
    'src/a.spec.ts',
    'src/a.eval.ts',
    'fixtures/a.ts',
    'src/testHelpers.ts',
  ]) {
    assert.equal(isTestPath(file), true, file);
    assert.equal(isExcludedPrPath(file), true, file);
  }
  for (const file of ['src/helpers/a.ts', 'src/test-helpers/a.ts']) {
    assert.equal(isTestPath(file), false, file);
    assert.equal(isExcludedPrPath(file), true, file);
  }
  for (const file of ['src/service.ts', 'src/testing.ts', 'src/helper.ts', 'src/latest/a.ts']) {
    assert.equal(isExcludedPrPath(file), false, file);
  }
});

test('escapeHtml escapes markup characters and prints null as empty', () => {
  assert.equal(escapeHtml(`<a href="x">'&'</a>`), '&lt;a href=&quot;x&quot;&gt;&#39;&amp;&#39;&lt;/a&gt;');
  assert.equal(escapeHtml(null), '');
});
