const ts = require('typescript');

const AUTHORING_RULES = `The packet and card skeleton are the complete tool authoring interface. Do not inspect the builder, renderer, source extractor, or tool schema docs. If the supplied application contracts are insufficient, inspect only the missing business contract.

- Edit only pseudocode and mappings in cards.json. Keep card identity fields unchanged. Existing sides need complete full-function pseudocode; absent sides stay null with empty mappings.
- Map every nonblank pseudocode line with one-based inclusive function-relative ranges. Example: {"pseudo":[1,2],"source":[3,7]} means pseudocode lines 1..2 describe source lines 3..7 on that same side.
- Preserve meaningful branches, transformations, side effects, explicit returns, and actual exceptions. Retain real method and function names and explicit call parentheses. Never invent a call or write.
- Omit logging and routine ORM tenant/organization query or write scope, including scope-only orgId, organizationId, and tenantId arguments or fields. Keep organization or tenant identity only when it is the resource behavior itself.
- Preserve null and existence semantics exactly. Do not replace a null or object guard with generic truthiness.
- Omit a parameter or field annotation whose whole type is string, number or bool; keep unions, arrays, generics, named types and return types. Use bool. Predicate aliases may end in ?. Use .in?(a, b) for membership; status(a | b) only lists return variants. map(field) is field projection. a..b is inclusive. Express negated guards with if !condition. Use postfix if guards only when they preserve the source guard. Keep explicit assignment and do not use implicit returns or calls.`;

const scopeIdentifierPattern = /\b(?:org(?:anization)?_?ids?|tenant_?ids?)\b/gi;

function identifiers(text) {
  return new Set(text.match(/[A-Za-z_$][A-Za-z0-9_$]*/g) || []);
}

function referencedContracts(file, text, functionCode) {
  if (!text || !/\.(?:[cm]?ts|tsx)$/.test(file)) return { imports: [], declarations: [] };
  const sourceFile = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true);
  const referenced = identifiers(functionCode);
  const declarations = new Map();
  const imports = [];

  for (const statement of sourceFile.statements) {
    if (
      (ts.isTypeAliasDeclaration(statement) || ts.isInterfaceDeclaration(statement) || ts.isEnumDeclaration(statement)) &&
      statement.name
    ) {
      declarations.set(statement.name.text, statement.getText(sourceFile));
      continue;
    }
    if (ts.isVariableStatement(statement)) {
      const functionValued = statement.declarationList.declarations.some(
        (declaration) =>
          declaration.initializer &&
          (ts.isArrowFunction(declaration.initializer) || ts.isFunctionExpression(declaration.initializer)),
      );
      if (functionValued) continue;
      for (const declaration of statement.declarationList.declarations) {
        if (ts.isIdentifier(declaration.name)) declarations.set(declaration.name.text, statement.getText(sourceFile));
      }
      continue;
    }
    if (ts.isImportDeclaration(statement) && statement.importClause) {
      const names = [];
      if (statement.importClause.name) names.push(statement.importClause.name.text);
      const bindings = statement.importClause.namedBindings;
      if (bindings && ts.isNamedImports(bindings)) names.push(...bindings.elements.map((element) => element.name.text));
      if (bindings && ts.isNamespaceImport(bindings)) names.push(bindings.name.text);
      imports.push({ names, code: statement.getText(sourceFile) });
    }
  }

  const selected = new Map();
  let changed = true;
  while (changed) {
    changed = false;
    for (const [name, code] of declarations) {
      if (!referenced.has(name) || selected.has(name)) continue;
      selected.set(name, code);
      for (const identifier of identifiers(code)) referenced.add(identifier);
      changed = true;
    }
  }
  return {
    imports: imports.filter((entry) => entry.names.some((name) => referenced.has(name))).map((entry) => entry.code),
    declarations: [...new Set(selected.values())],
  };
}

function scopeIdentifiers(pseudocode) {
  const matches = [];
  for (const [index, line] of pseudocode.split('\n').entries()) {
    scopeIdentifierPattern.lastIndex = 0;
    const identifiers = new Set();
    for (const match of line.matchAll(scopeIdentifierPattern)) {
      identifiers.add(match[0]);
    }
    if (identifiers.size) matches.push({ line: index + 1, identifiers: [...identifiers] });
  }
  return matches;
}

module.exports = { AUTHORING_RULES, referencedContracts, scopeIdentifiers };
