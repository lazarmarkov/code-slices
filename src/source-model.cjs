const ts = require('typescript');

function sourceSymbols(file, text) {
  if (text === null || !/\.(?:[cm]?ts|tsx)$/.test(file)) return [];
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

  function add(node, symbol, className, body) {
    const start = sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile)).line + 1;
    const end = sourceFile.getLineAndCharacterOfPosition(node.end).line + 1;
    let behaviorStart = sourceFile.getLineAndCharacterOfPosition(body.getStart(sourceFile)).line + 1 - start + 1;
    if (ts.isBlock(body) && body.statements.length) {
      behaviorStart = sourceFile.getLineAndCharacterOfPosition(body.statements[0].getStart(sourceFile)).line + 1 - start + 1;
    }
    output.push({
      symbol,
      className,
      line: start,
      end,
      behaviorStart,
      code: node.getText(sourceFile),
    });
  }

  function visit(node) {
    if (ts.isFunctionDeclaration(node) && node.name && node.body) {
      add(node, node.name.getText(sourceFile), null, node.body);
    } else if (ts.isMethodDeclaration(node) && node.name && node.body) {
      const className = ownerName(node.parent);
      add(node, node.name.getText(sourceFile), className, node.body);
    } else if (ts.isConstructorDeclaration(node) && node.body) {
      const className = ts.isClassDeclaration(node.parent) ? node.parent.name?.getText(sourceFile) || null : null;
      add(node, 'constructor', className, node.body);
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
    if (
      oldIndex < oldLines.length &&
      newIndex < newLines.length &&
      oldLines[oldIndex] === newLines[newIndex]
    ) {
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

module.exports = { findSymbol, lineOperations, sourceSymbols };
