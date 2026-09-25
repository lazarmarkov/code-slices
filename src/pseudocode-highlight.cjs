const { privateConfig } = require('./private-context.cjs');

const escapeHtml = (value) =>
  String(value).replace(/[&<>"']/g, (character) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character],
  );

const keywords = new Set([
  'append',
  'case',
  'continue',
  'default',
  'each',
  'else',
  'for',
  'if',
  'in',
  'increment',
  'not',
  'next',
  'or',
  'return',
  'starting',
  'switch',
  'throw',
  'typeof',
]);
const types = new Set(['array', 'bool', 'number', 'object', 'readonly', 'string']);
const literals = new Set(['false', 'null', 'true', ...(privateConfig().pseudocodeLiterals || [])]);
const tokenPattern = /(\/\/.*$|"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|\d[\d_,]*(?:\.\d+)?|→|->|!=|==|<=|>=|&&|\|\||[A-Za-z_][A-Za-z0-9_?]*|\s+|.)/g;

function classify(tokens, index) {
  const token = tokens[index];
  if (/^\s+$/.test(token)) return null;
  if (token.startsWith('//')) return 'comment';
  if (/^["']/.test(token) || /^\d/.test(token) || literals.has(token)) return 'literal';
  if (/^[^A-Za-z0-9_]$/.test(token) || /^(?:→|->|!=|==|<=|>=|&&|\|\|)$/.test(token)) return 'punctuation';
  if (keywords.has(token)) return 'keyword';
  if (types.has(token) || /^[A-Z][a-zA-Z0-9]*$/.test(token)) return 'type';
  if (/^[A-Z][A-Z0-9_]+$/.test(token)) return 'literal';
  if (token.endsWith('?')) return 'call';
  const next = tokens.slice(index + 1).find((candidate) => !/^\s+$/.test(candidate));
  const previous = [...tokens.slice(0, index)].reverse().find((candidate) => !/^\s+$/.test(candidate));
  if (next === '(') return 'call';
  if (previous === 'case') return 'literal';
  return 'variable';
}

function highlightLine(line) {
  const tokens = line.match(tokenPattern) || [];
  return tokens
    .map((token, index) => {
      const category = classify(tokens, index);
      const escaped = escapeHtml(token);
      return category ? `<span class="tok-${category}">${escaped}</span>` : escaped;
    })
    .join('');
}

function highlightPseudocode(code) {
  return code.split('\n').map(highlightLine);
}

module.exports = { highlightLine, highlightPseudocode };
