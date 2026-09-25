const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync, spawnSync } = require('node:child_process');
const test = require('node:test');
const { privateConfig, privateNotes } = require('../src/private-context.cjs');

const project = path.resolve(__dirname, '..');

function git(repo, args) {
  return execFileSync('git', ['-C', repo, ...args], { encoding: 'utf8' }).trim();
}

function write(repo, file, contents) {
  const target = path.join(repo, file);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, contents);
}

function commit(repo, message) {
  git(repo, ['add', '.']);
  git(repo, ['-c', 'user.name=Test', '-c', 'user.email=test@example.com', '-c', 'commit.gpgsign=false', 'commit', '-m', message]);
  return git(repo, ['rev-parse', 'HEAD']);
}

test('prepares pinned changed functions and excludes test paths', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'code-slices-prepare-'));
  const repo = path.join(root, 'repo');
  const output = path.join(root, 'prepared');
  const secondOutput = path.join(root, 'prepared-again');
  fs.mkdirSync(repo);
  git(repo, ['init', '--quiet']);
  write(
    repo,
    'src/service.ts',
    'export interface Payload { value: string; }\nexport function modified(input: Payload): string { return input.value; }\nexport function removed(): number { return 1; }\nexport function stable(): number { return 7; }\n',
  );
  write(repo, 'src/service.test.ts', 'export function testOnly(): number { return 1; }\n');
  write(repo, 'fixtures/helper.ts', 'export function fixtureOnly(): number { return 1; }\n');
  write(repo, 'src/helpers/format.ts', 'export function helperOnly(): number { return 1; }\n');
  const base = commit(repo, 'base');

  write(
    repo,
    'src/service.ts',
    'export interface Payload { value: string; }\nexport function modified(input: Payload): string { return input.value.trim(); }\nexport function added(input: Payload): string { return input.value.toUpperCase(); }\nexport function stable(): number { return 7; }\n',
  );
  write(repo, 'src/service.test.ts', 'export function testOnly(): number { return 2; }\n');
  write(repo, 'fixtures/helper.ts', 'export function fixtureOnly(): number { return 2; }\n');
  write(repo, 'src/helpers/format.ts', 'export function helperOnly(): number { return 2; }\n');
  const head = commit(repo, 'head');

  execFileSync(
    process.execPath,
    ['src/prepare-pr.cjs', '--repo', repo, '--base', base, '--head', head, '--output', output],
    { cwd: project },
  );
  execFileSync(
    process.execPath,
    ['src/prepare-pr.cjs', '--repo', repo, '--base', base, '--head', head, '--output', secondOutput],
    { cwd: project },
  );
  for (const file of ['manifest.json', 'cards.json', 'packet.json', 'generation-packet.md']) {
    assert.deepEqual(fs.readFileSync(path.join(output, file)), fs.readFileSync(path.join(secondOutput, file)));
  }
  const manifest = JSON.parse(fs.readFileSync(path.join(output, 'manifest.json'), 'utf8'));
  const cards = JSON.parse(fs.readFileSync(path.join(output, 'cards.json'), 'utf8')).cards;
  const packet = fs.readFileSync(path.join(output, 'generation-packet.md'), 'utf8');
  assert.match(packet, /"pseudo":\[1,2\],"source":\[3,7\]/);

  assert.equal(manifest.baseRef, base);
  assert.equal(manifest.headRef, head);
  assert.deepEqual(manifest.files, ['src/service.ts']);
  assert.deepEqual(
    cards.map(({ symbol, status }) => ({ symbol, status })),
    [
      { symbol: 'added', status: 'Added' },
      { symbol: 'modified', status: 'Modified' },
      { symbol: 'removed', status: 'Removed' },
    ],
  );
  assert.equal(
    fs.readFileSync(path.join(output, 'source', 'head', 'src/service.ts'), 'utf8'),
    execFileSync('git', ['-C', repo, 'show', `${head}:src/service.ts`], { encoding: 'utf8' }),
  );
  assert.equal(
    fs.readFileSync(path.join(output, 'source', 'base', 'src/service.ts'), 'utf8'),
    execFileSync('git', ['-C', repo, 'show', `${base}:src/service.ts`], { encoding: 'utf8' }),
  );
  assert.match(packet, /export interface Payload/);
  assert.match(packet, /\+\s+1 \| export function added/);
  assert.doesNotMatch(packet, /testOnly|fixtureOnly|helperOnly/);

  const skeletonValidation = spawnSync(
    process.execPath,
    ['src/validate-pr-cards.cjs', output, 'cards.json'],
    { cwd: project, encoding: 'utf8' },
  );
  assert.equal(skeletonValidation.status, 1);
  assert.match(skeletonValidation.stdout, /full-function pseudocode is required/);

  const evidence = JSON.parse(fs.readFileSync(path.join(output, 'packet.json'), 'utf8'));
  const byId = new Map(evidence.files.flatMap((file) => file.functions.map((entry) => [entry.card.id, entry])));
  for (const card of cards) {
    const entry = byId.get(card.id);
    if (entry.sourceBefore) {
      card.before = `${card.symbol}()`;
      card.mappingsBefore = [{ pseudo: [1, 1], source: [1, 1] }];
    }
    if (entry.sourceAfter) {
      card.after = `${card.symbol}()`;
      card.mappingsAfter = [{ pseudo: [1, 1], source: [1, 1] }];
    }
  }
  fs.writeFileSync(path.join(output, 'authored.json'), `${JSON.stringify({ cards }, null, 2)}\n`);
  execFileSync(process.execPath, ['src/validate-pr-cards.cjs', output, 'authored.json'], { cwd: project });

  const scopedCards = structuredClone(cards);
  scopedCards[0].after = `${scopedCards[0].symbol}(orgId, tenant_id)`;
  fs.writeFileSync(path.join(output, 'scoped.json'), `${JSON.stringify({ cards: scopedCards }, null, 2)}\n`);
  const repairOutput = path.join(output, 'repair.json');
  const scopedValidation = spawnSync(
    process.execPath,
    ['src/validate-pr-cards.cjs', output, 'scoped.json', '--repair-output', repairOutput],
    { cwd: project, encoding: 'utf8' },
  );
  assert.equal(scopedValidation.status, 0);
  const scopedResult = JSON.parse(scopedValidation.stdout);
  assert.equal(scopedResult.warnings.length, 1);
  assert.match(scopedResult.warnings[0], /remove routine ORM tenant\/organization scope/);
  const repair = JSON.parse(fs.readFileSync(repairOutput, 'utf8'));
  assert.equal(repair.cards.length, 1);
  assert.equal(repair.evidence.length, 1);
  assert.equal(repair.evidence[0].functions.length, 1);
  assert.match(repair.instructions, /complete tool authoring interface/);

  const invalidCards = structuredClone(cards);
  invalidCards[0].mappingsAfter = [{ pseudo: [1, Number.MAX_SAFE_INTEGER], source: [1, 1] }];
  fs.writeFileSync(path.join(output, 'invalid.json'), `${JSON.stringify({ cards: invalidCards }, null, 2)}\n`);
  const invalidValidation = spawnSync(
    process.execPath,
    ['src/validate-pr-cards.cjs', output, 'invalid.json'],
    { cwd: project, encoding: 'utf8', timeout: 2000 },
  );
  assert.equal(invalidValidation.signal, null);
  assert.equal(invalidValidation.status, 1);
  assert.match(invalidValidation.stdout, /mapping 1 has invalid pseudo range/);
});

test('private notes join project files in name order and skip the README', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'code-slices-private-'));
  fs.writeFileSync(path.join(dir, 'README.md'), 'Folder description.');
  fs.writeFileSync(path.join(dir, 'zeta.md'), 'Zeta rules.\n');
  fs.writeFileSync(path.join(dir, 'acme.md'), 'Acme rules.\n');
  fs.writeFileSync(path.join(dir, 'config.json'), JSON.stringify({ scopeIdentifiers: ['accountScope'] }));
  assert.equal(privateNotes(dir), 'Acme rules.\n\nZeta rules.');
  assert.deepEqual(privateConfig(dir).scopeIdentifiers, ['accountScope']);
  assert.equal(privateNotes(path.join(dir, 'missing')), '');
  assert.deepEqual(privateConfig(path.join(dir, 'missing')), {});
});
