const ts = require('typescript');

const isTypeScriptFile = (file) => /\.(?:[cm]?ts|tsx)$/.test(file);

// Lists every function with a body: declarations, class and object methods, constructors and
// function-valued variables. Lines are one-based; behaviorStart is relative to the function.
function sourceSymbols(file, text) {
  if (text === null || !isTypeScriptFile(file)) return [];
  const sourceFile = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true);
  const output = [];

  function ownerName(node) {
    if (ts.isClassDeclaration(node)) return node.name?.getText(sourceFile) || null;
    if (!ts.isObjectLiteralExpression(node)) return null;
    const parent = node.parent;
    if (ts.isVariableDeclaration(parent)) return parent.name.getText(sourceFile);
    if (ts.isPropertyAssignment(parent) || ts.isPropertyDeclaration(parent)) return parent.name.getText(sourceFile);
    return null;
  }

  const lineOf = (position) => sourceFile.getLineAndCharacterOfPosition(position).line + 1;

  function add(node, symbol, className, body) {
    const start = lineOf(node.getStart(sourceFile));
    // The first body statement, or the expression body of an arrow function.
    const behavior = ts.isBlock(body) && body.statements.length ? body.statements[0] : body;
    output.push({
      symbol,
      className,
      line: start,
      end: lineOf(node.end),
      behaviorStart: lineOf(behavior.getStart(sourceFile)) - start + 1,
      code: node.getText(sourceFile),
    });
  }

  function visit(node) {
    if (ts.isFunctionDeclaration(node) && node.name && node.body) {
      add(node, node.name.getText(sourceFile), null, node.body);
    } else if (ts.isMethodDeclaration(node) && node.name && node.body) {
      add(node, node.name.getText(sourceFile), ownerName(node.parent), node.body);
    } else if (ts.isConstructorDeclaration(node) && node.body) {
      add(node, 'constructor', ownerName(node.parent), node.body);
    } else if (
      ts.isVariableDeclaration(node) &&
      node.initializer &&
      (ts.isArrowFunction(node.initializer) || ts.isFunctionExpression(node.initializer))
    ) {
      const declarationList = node.parent;
      const statement = declarationList.parent;
      if (!ts.isVariableStatement(statement) || declarationList.declarations.length !== 1) {
        throw new Error(`Unsupported multi-declaration function variable in ${file}: ${node.name.getText(sourceFile)}`);
      }
      add(statement, node.name.getText(sourceFile), null, node.initializer.body);
    }
    ts.forEachChild(node, visit);
  }

  visit(sourceFile);
  return output;
}

// Omitting card.className matches any owner; className: null selects a top-level function.
function findSymbol(symbols, card, revision) {
  const hasOwner = Object.prototype.hasOwnProperty.call(card, 'className');
  const matches = symbols.filter(
    (entry) => entry.symbol === card.symbol && (!hasOwner || entry.className === (card.className ?? null)),
  );
  if (matches.length > 1) {
    throw new Error(`Ambiguous ${revision} symbol; supply className: ${card.symbol}`);
  }
  return matches[0] || null;
}

const symbolKey = (symbol) => `${symbol.className || ''}\u0000${symbol.symbol}`;

// Maps symbolKey to symbol. Two functions with the same owner and name cannot be told apart.
function symbolsByKey(file, symbols, revision) {
  const output = new Map();
  for (const symbol of symbols) {
    const key = symbolKey(symbol);
    if (output.has(key)) throw new Error(`Unsupported duplicate ${revision} symbol in ${file}: ${symbol.symbol}`);
    output.set(key, symbol);
  }
  return output;
}

// A line-by-line diff from the longest common subsequence. Line numbers are one-based.
function lineOperations(before, after) {
  const oldLines = before === null ? [] : before.split('\n');
  const newLines = after === null ? [] : after.split('\n');
  const rows = Array.from({ length: oldLines.length + 1 }, () => new Uint32Array(newLines.length + 1));

  for (let oldIndex = oldLines.length - 1; oldIndex >= 0; oldIndex -= 1) {
    for (let newIndex = newLines.length - 1; newIndex >= 0; newIndex -= 1) {
      rows[oldIndex][newIndex] =
        oldLines[oldIndex] === newLines[newIndex]
          ? rows[oldIndex + 1][newIndex + 1] + 1
          : Math.max(rows[oldIndex + 1][newIndex], rows[oldIndex][newIndex + 1]);
    }
  }

  const operations = [];
  let oldIndex = 0;
  let newIndex = 0;
  while (oldIndex < oldLines.length || newIndex < newLines.length) {
    if (oldIndex < oldLines.length && newIndex < newLines.length && oldLines[oldIndex] === newLines[newIndex]) {
      operations.push({ type: 'equal', oldLine: oldIndex + 1, newLine: newIndex + 1, text: oldLines[oldIndex] });
      oldIndex += 1;
      newIndex += 1;
    } else if (
      newIndex < newLines.length &&
      (oldIndex === oldLines.length || rows[oldIndex][newIndex + 1] > rows[oldIndex + 1][newIndex])
    ) {
      operations.push({ type: 'add', oldLine: null, newLine: newIndex + 1, text: newLines[newIndex] });
      newIndex += 1;
    } else {
      operations.push({ type: 'delete', oldLine: oldIndex + 1, newLine: null, text: oldLines[oldIndex] });
      oldIndex += 1;
    }
  }
  return operations;
}

// The one-based lines deleted from `before` and added in `after`. Either side may be null.
function changedLineSets(before, after) {
  const changes = { before: new Set(), after: new Set() };
  for (const operation of lineOperations(before, after)) {
    if (operation.type === 'delete') changes.before.add(operation.oldLine);
    if (operation.type === 'add') changes.after.add(operation.newLine);
  }
  return changes;
}

// A mapping range is [first, last]: one-based, inclusive and no later than `lastLine`.
const isValidRange = (range, lastLine) =>
  Array.isArray(range) &&
  range.length === 2 &&
  range.every(Number.isInteger) &&
  range[0] >= 1 &&
  range[0] <= range[1] &&
  range[1] <= lastLine;

const lineCount = (text) => text.split('\n').length;

module.exports = {
  changedLineSets,
  findSymbol,
  isTypeScriptFile,
  isValidRange,
  lineCount,
  lineOperations,
  sourceSymbols,
  symbolKey,
  symbolsByKey,
};
