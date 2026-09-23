const ts = require('typescript');
const { isTypeScriptFile } = require('./source-model.cjs');

// The instructions a model receives in generation, verification and repair packets.

const AUTHORING_RULES = `The packet and card skeleton are the complete tool authoring interface. Do not inspect the builder, renderer, source extractor, or tool schema docs. If the supplied application contracts are insufficient, inspect only the missing business contract.

- Edit only pseudocode and mappings in cards.json. Keep card identity fields unchanged. Existing sides need complete full-function pseudocode; absent sides stay null with empty mappings.
- Map every nonblank pseudocode line with one-based inclusive function-relative ranges. Example: {"pseudo":[1,2],"source":[3,7]} means pseudocode lines 1..2 describe source lines 3..7 on that same side.
- Preserve meaningful branches, transformations, side effects, explicit returns, and actual exceptions. Retain real method and function names and explicit call parentheses. Never invent a call or write.
- Omit logging and routine ORM tenant/organization query or write scope, including scope-only orgId, organizationId, and tenantId arguments or fields. Keep organization or tenant identity only when it is the resource behavior itself.
- Preserve null and existence semantics exactly. Do not replace a null or object guard with generic truthiness.
- Omit a parameter or field annotation whose whole type is string, number or bool. Write a parameter or field that may be null or undefined with ? instead of the union (warehouseRaw? for warehouseRaw?: string | null, warehouseRef?: WarehouseRef for warehouseRef: WarehouseRef | null). Keep other unions, arrays, generics, named types and every return type. Use bool. Predicate aliases may end in ?. Use .in?(a, b) for membership; status(a | b) only lists return variants. map(field) is field projection. a..b is inclusive. Express negated guards with if !condition. Use postfix if guards only when they preserve the source guard. Keep explicit assignment and do not use implicit returns or calls.`;

// Identifiers that usually carry routine tenant or organization scope, such as orgId or tenant_id.
const scopeIdentifierPattern = /\b(?:org(?:anization)?_?ids?|tenant_?ids?)\b/gi;

function identifiers(text) {
  return new Set(text.match(/[A-Za-z_$][A-Za-z0-9_$]*/g) || []);
}

// The imports and top-level types and constants of `text` that `functionCode` uses, directly or
// through another selected declaration. Function-valued constants are left out.
function referencedContracts(file, text, functionCode) {
  if (!text || !isTypeScriptFile(file)) return { imports: [], declarations: [] };
  const sourceFile = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true);
  const referenced = identifiers(functionCode);
  const declarations = new Map();
  const imports = [];

  for (const statement of sourceFile.statements) {
    if (
      (ts.isTypeAliasDeclaration(statement) ||
        ts.isInterfaceDeclaration(statement) ||
        ts.isEnumDeclaration(statement)) &&
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

  // Add declarations until no newly selected one references another.
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

// The pseudocode lines that name a scope identifier, with the identifiers found on each.
function scopeIdentifiers(pseudocode) {
  return pseudocode.split('\n').flatMap((line, index) => {
    const found = [...new Set(line.match(scopeIdentifierPattern) || [])];
    return found.length ? [{ line: index + 1, identifiers: found }] : [];
  });
}

module.exports = { AUTHORING_RULES, referencedContracts, scopeIdentifiers };
