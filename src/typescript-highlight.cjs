const ts = require('typescript');
const { escapeHtml } = require('./escape-html.cjs');

const commentKinds = new Set([ts.SyntaxKind.SingleLineCommentTrivia, ts.SyntaxKind.MultiLineCommentTrivia]);
const literalKinds = new Set([
  ts.SyntaxKind.BigIntLiteral,
  ts.SyntaxKind.FalseKeyword,
  ts.SyntaxKind.FirstTemplateToken,
  ts.SyntaxKind.HeadTemplateToken,
  ts.SyntaxKind.LastTemplateToken,
  ts.SyntaxKind.MiddleTemplateToken,
  ts.SyntaxKind.NoSubstitutionTemplateLiteral,
  ts.SyntaxKind.NullKeyword,
  ts.SyntaxKind.NumericLiteral,
  ts.SyntaxKind.RegularExpressionLiteral,
  ts.SyntaxKind.StringLiteral,
  ts.SyntaxKind.TemplateHead,
  ts.SyntaxKind.TemplateMiddle,
  ts.SyntaxKind.TemplateTail,
  ts.SyntaxKind.TrueKeyword,
]);
const typeKeywordKinds = new Set([
  ts.SyntaxKind.AnyKeyword,
  ts.SyntaxKind.BigIntKeyword,
  ts.SyntaxKind.BooleanKeyword,
  ts.SyntaxKind.NeverKeyword,
  ts.SyntaxKind.NumberKeyword,
  ts.SyntaxKind.ObjectKeyword,
  ts.SyntaxKind.StringKeyword,
  ts.SyntaxKind.SymbolKeyword,
  ts.SyntaxKind.UndefinedKeyword,
  ts.SyntaxKind.UnknownKeyword,
  ts.SyntaxKind.VoidKeyword,
]);
const triviaKinds = new Set([
  ts.SyntaxKind.ConflictMarkerTrivia,
  ts.SyntaxKind.MultiLineCommentTrivia,
  ts.SyntaxKind.NewLineTrivia,
  ts.SyntaxKind.ShebangTrivia,
  ts.SyntaxKind.SingleLineCommentTrivia,
  ts.SyntaxKind.WhitespaceTrivia,
]);

function scan(code) {
  const scanner = ts.createScanner(ts.ScriptTarget.Latest, false, ts.LanguageVariant.Standard, code);
  const tokens = [];
  for (let kind = scanner.scan(); kind !== ts.SyntaxKind.EndOfFileToken; kind = scanner.scan()) {
    tokens.push({ kind, text: scanner.getTokenText() });
  }
  return tokens;
}

function category(tokens, index) {
  const { kind, text } = tokens[index];
  if (kind === ts.SyntaxKind.WhitespaceTrivia || kind === ts.SyntaxKind.NewLineTrivia) return null;
  if (commentKinds.has(kind)) return 'comment';
  if (literalKinds.has(kind)) return 'literal';
  if (typeKeywordKinds.has(kind)) return 'type';
  if (kind >= ts.SyntaxKind.FirstKeyword && kind <= ts.SyntaxKind.LastKeyword) return 'keyword';
  if (kind !== ts.SyntaxKind.Identifier && kind !== ts.SyntaxKind.PrivateIdentifier) return 'punctuation';
  if (/^[A-Z]/.test(text)) return 'type';
  const next = tokens.slice(index + 1).find((token) => !triviaKinds.has(token.kind));
  const previous = [...tokens.slice(0, index)].reverse().find((token) => !triviaKinds.has(token.kind));
  if (next?.kind === ts.SyntaxKind.OpenParenToken) return 'call';
  if (previous?.kind === ts.SyntaxKind.ColonToken || previous?.kind === ts.SyntaxKind.AsKeyword) return 'type';
  return 'variable';
}

function tokenizeTypeScriptLines(code) {
  const tokens = scan(code);
  const lines = [[]];
  for (const [index, token] of tokens.entries()) {
    const role = category(tokens, index);
    const parts = token.text.split('\n');
    for (const [partIndex, text] of parts.entries()) {
      if (text) lines.at(-1).push({ text, role });
      if (partIndex < parts.length - 1) lines.push([]);
    }
  }
  return lines;
}

function highlightTypeScript(code) {
  return tokenizeTypeScriptLines(code).map((line) =>
    line
      .map(({ text, role }) => {
        const escaped = escapeHtml(text);
        return role ? `<span class="tok-${role}">${escaped}</span>` : escaped;
      })
      .join(''),
  );
}

module.exports = { highlightTypeScript, tokenizeTypeScriptLines };
