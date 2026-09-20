#!/usr/bin/env node
const fs = require('node:fs');
const path = require('node:path');
const { findSymbol, sourceSymbols } = require('./source-model.cjs');
const { AUTHORING_RULES, referencedContracts, scopeIdentifiers } = require('./pr-generation-contract.cjs');

const arguments = process.argv.slice(2);
const preparedInput = arguments.shift();
if (!preparedInput) {
  process.stderr.write(
    'Usage: node src/validate-pr-cards.cjs <prepared-directory> [cards.json] [--repair-output repair-packet.json]\n',
  );
  process.exit(1);
}
const cardsInput = arguments[0] && !arguments[0].startsWith('--') ? arguments.shift() : 'cards.json';
let repairOutput = null;
while (arguments.length) {
  const name = arguments.shift();
  const value = arguments.shift();
  if (name !== '--repair-output' || !value) throw new Error(`Unknown or incomplete option: ${name}`);
  repairOutput = path.resolve(value);
}

const prepared = path.resolve(preparedInput);
const manifest = JSON.parse(fs.readFileSync(path.join(prepared, 'manifest.json'), 'utf8'));
const packet = JSON.parse(fs.readFileSync(path.join(prepared, 'packet.json'), 'utf8'));
const cardsPath = path.isAbsolute(cardsInput) ? cardsInput : path.join(prepared, cardsInput);
const authored = JSON.parse(fs.readFileSync(cardsPath, 'utf8')).cards;
const expected = packet.files.flatMap((file) => file.functions.map((entry) => entry.card));
const errors = [];
const warnings = [];
const warningDetails = [];
const affectedIds = new Set();

function addError(cardId, message) {
  errors.push(message);
  if (cardId) affectedIds.add(cardId);
}

function addWarning(cardId, message, detail) {
  warnings.push(message);
  warningDetails.push(detail);
  if (cardId) affectedIds.add(cardId);
}

function readSource(revision, file) {
  const target = path.join(prepared, manifest.sources[revision], file);
  return fs.existsSync(target) ? fs.readFileSync(target, 'utf8') : null;
}

function validateSide(card, revision, pseudocode, mappings, source) {
  if (!source) {
    if (pseudocode !== null) addError(card.id, `${card.id} ${revision}: absent source requires null pseudocode`);
    if (!Array.isArray(mappings) || mappings.length) {
      addError(card.id, `${card.id} ${revision}: absent source requires empty mappings`);
    }
    return;
  }
  if (typeof pseudocode !== 'string' || !pseudocode.trim()) {
    addError(card.id, `${card.id} ${revision}: full-function pseudocode is required`);
    return;
  }
  for (const leak of scopeIdentifiers(pseudocode)) {
    addWarning(
      card.id,
      `${card.id} ${revision}: pseudocode line ${leak.line} contains ${leak.identifiers.join(', ')}; remove routine ORM tenant/organization scope, or retain it only when organization identity is the behavior under review`,
      { cardId: card.id, revision, line: leak.line, identifiers: leak.identifiers },
    );
  }
  if (!Array.isArray(mappings) || !mappings.length) {
    addError(card.id, `${card.id} ${revision}: at least one mapping is required`);
    return;
  }
  const pseudoLines = pseudocode.split('\n');
  const sourceLineCount = source.code.split('\n').length;
  const covered = new Set();
  for (const [index, mapping] of mappings.entries()) {
    let validPseudoRange = false;
    for (const [name, range, maximum] of [
      ['pseudo', mapping?.pseudo, pseudoLines.length],
      ['source', mapping?.source, sourceLineCount],
    ]) {
      const invalid =
        !Array.isArray(range) ||
        range.length !== 2 ||
        !range.every(Number.isInteger) ||
        range[0] < 1 ||
        range[1] < range[0] ||
        range[1] > maximum;
      if (invalid) {
        addError(card.id, `${card.id} ${revision}: mapping ${index + 1} has invalid ${name} range`);
      } else if (name === 'pseudo') {
        validPseudoRange = true;
      }
    }
    if (validPseudoRange) {
      for (let line = mapping.pseudo[0]; line <= mapping.pseudo[1]; line += 1) covered.add(line);
    }
  }
  for (const [index, line] of pseudoLines.entries()) {
    if (line.trim() && !covered.has(index + 1)) {
      addError(card.id, `${card.id} ${revision}: pseudocode line ${index + 1} is unmapped`);
    }
  }
}

const expectedById = new Map(expected.map((card) => [card.id, card]));
const authoredById = new Map();
for (const card of authored) {
  if (authoredById.has(card.id)) addError(card.id, `duplicate card id: ${card.id}`);
  authoredById.set(card.id, card);
}
for (const expectedCard of expected) {
  const card = authoredById.get(expectedCard.id);
  if (!card) {
    addError(expectedCard.id, `missing card: ${expectedCard.id}`);
    continue;
  }
  for (const field of ['file', 'symbol', 'className', 'status']) {
    if ((card[field] ?? null) !== (expectedCard[field] ?? null)) {
      addError(card.id, `${card.id}: ${field} differs from prepared identity`);
    }
  }
  const sourceBefore = findSymbol(sourceSymbols(card.file, readSource('base', card.file)), card, 'base');
  const sourceAfter = findSymbol(sourceSymbols(card.file, readSource('head', card.file)), card, 'head');
  validateSide(card, 'before', card.before, card.mappingsBefore, sourceBefore);
  validateSide(card, 'after', card.after, card.mappingsAfter, sourceAfter);
}
for (const card of authored) {
  if (!expectedById.has(card.id)) addError(card.id, `unexpected card: ${card.id}`);
}

if (repairOutput && affectedIds.size) {
  const evidence = packet.files
    .map((file) => {
      const functions = file.functions.filter((entry) => affectedIds.has(entry.card.id));
      if (!functions.length) return null;
      const beforeCode = functions.map((entry) => entry.sourceBefore?.code || '').join('\n');
      const afterCode = functions.map((entry) => entry.sourceAfter?.code || '').join('\n');
      return {
        path: file.path,
        status: file.status,
        contracts: {
          base: referencedContracts(file.path, readSource('base', file.path), beforeCode),
          head: referencedContracts(file.path, readSource('head', file.path), afterCode),
        },
        functions: functions.map((entry) => ({
          id: entry.card.id,
          before: entry.sourceBefore ? { code: entry.sourceBefore.code, changedLines: entry.changedBefore } : null,
          after: entry.sourceAfter ? { code: entry.sourceAfter.code, changedLines: entry.changedAfter } : null,
        })),
      };
    })
    .filter(Boolean);
  fs.mkdirSync(path.dirname(repairOutput), { recursive: true });
  fs.writeFileSync(
    repairOutput,
    `${JSON.stringify({
      version: 1,
      instructions: AUTHORING_RULES,
      diagnostics: {
        errors,
        scopeWarnings: warningDetails,
        scopeWarningAction:
          'Remove routine ORM tenant/organization scope. Retain an identifier only when organization identity is the behavior under review.',
      },
      cards: authored.filter((card) => affectedIds.has(card.id)),
      evidence,
    })}\n`,
  );
}

const result = {
  cards: authored.length,
  expected: expected.length,
  errors,
  warnings,
  repairOutput: repairOutput && affectedIds.size ? repairOutput : null,
};
process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
if (errors.length) process.exit(1);
