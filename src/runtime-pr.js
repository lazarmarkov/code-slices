import { File, FileDiff, registerCustomCSSVariableTheme } from 'https://esm.sh/@pierre/diffs@1.2.10?bundle';

const data = JSON.parse(document.getElementById('review-data').textContent);
const sourceThemeName = `code-slices-${data.palette.id}`;
registerCustomCSSVariableTheme(sourceThemeName, {
  background: '#ffffff',
  foreground: data.palette.variable,
  'token-link': data.palette.call,
  'token-string': data.palette.literal,
  'token-comment': data.palette.comment,
  'token-constant': data.palette.type,
  'token-keyword': data.palette.keyword,
  'token-parameter': data.palette.variable,
  'token-function': data.palette.call,
  'token-string-expression': data.palette.literal,
  'token-punctuation': data.palette.punctuation,
  'token-inserted': data.palette.variable,
  'token-deleted': data.palette.variable,
  'token-changed': data.palette.variable,
});
const options = {
  theme: { light: sourceThemeName, dark: sourceThemeName },
  themeType: 'light',
  overflow: 'wrap',
  disableFileHeader: true,
};
// The view: 'hidden' is the Pseudo view (no source pane); 'unified' and 'split' add the source diff.
const DIFF_STYLES = ['unified', 'split', 'hidden'];
const state = { diffStyle: localStorage.getItem('code-slices-pr-diff-style') };
if (!DIFF_STYLES.includes(state.diffStyle)) state.diffStyle = 'unified';
const sourceDiffStyle = () => (state.diffStyle === 'hidden' ? 'unified' : state.diffStyle);

const entities = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
const escapeHtml = (value) => String(value ?? '').replace(/[&<>"']/g, (character) => entities[character]);

const withFinalNewline = (contents) => (contents && !contents.endsWith('\n') ? `${contents}\n` : contents || '');

function renderDiff(container, before, after) {
  return new FileDiff({ ...options, diffStyle: sourceDiffStyle() }).render({
    containerWrapper: container,
    oldFile: { name: 'before.ts', contents: withFinalNewline(before) },
    newFile: { name: 'after.ts', contents: withFinalNewline(after) },
  });
}

// An unchanged function has an empty diff, so it renders as a plain file.
function renderSource(container, card) {
  if (card.status !== 'Context') return renderDiff(container, card.sourceBefore?.code, card.sourceAfter?.code);
  return new File(options).render({
    containerWrapper: container,
    file: { name: 'source.ts', contents: withFinalNewline(card.sourceAfter.code) },
  });
}

// Formats sorted line numbers as ranges: [1, 2, 3, 7] -> "1-3, 7".
function compressedLines(lines) {
  const groups = [];
  for (const line of lines) {
    const last = groups.at(-1);
    if (last && line === last[1] + 1) last[1] = line;
    else groups.push([line, line]);
  }
  return groups.map(([start, end]) => (start === end ? String(start) : `${start}-${end}`)).join(', ');
}

// Describes mapped changed lines, e.g. "before source 3; after source 3-4".
function sourceLinesLabel(before, after) {
  const parts = [];
  if (before.length) parts.push(`before source ${compressedLines(before)}`);
  if (after.length) parts.push(`after source ${compressedLines(after)}`);
  return parts.join('; ');
}

// Reads the changed source lines stored on a rendered pseudocode line.
const lineNumbers = (value) => value.split(',').filter(Boolean).map(Number);
const beforeLines = (line) => lineNumbers(line.dataset.beforeLines);
const afterLines = (line) => lineNumbers(line.dataset.afterLines);

function pseudoLine(row) {
  const className = row.marker
    ? `pseudo-line marker-${row.marker === '+' ? 'add' : row.marker === '-' ? 'remove' : 'modify'}`
    : `pseudo-line${row.type === 'equal' ? '' : ' neutral-edit'}`;
  const sourceLines = sourceLinesLabel(row.beforeSourceLines, row.afterSourceLines);
  const evidence =
    row.evidenceKind === 'signature'
      ? `<span class="evidence" title="${escapeHtml(sourceLines)}">signature</span>`
      : '';
  const title = sourceLines ? `${row.evidenceKind ? `${row.evidenceKind}: ` : ''}${sourceLines}` : '';
  const indent = (row.text.match(/^ */) || [''])[0].length;
  const body = (row.highlighted || escapeHtml(row.text)).replace(/^\s+/, '') || ' ';
  const hanging = `padding-left:calc(5px + ${indent + 2}ch);text-indent:-2ch`;
  return `<div class="${className}" data-before-lines="${row.beforeSourceLines.join(',')}" data-after-lines="${row.afterSourceLines.join(',')}"${title ? ` title="${escapeHtml(title)}"` : ''}><span class="marker">${row.marker || ' '}</span><span class="old-number">${row.oldLine || ''}</span><span class="new-number">${row.newLine || ''}</span><code style="${hanging}">${body}</code>${evidence}</div>`;
}

function sourceRoot(container) {
  return container.querySelector('diffs-container')?.shadowRoot || null;
}

// Highlights source lines inside a rendered Pierre diff. The style lives in its shadow root.
const EVIDENCE_STYLE = '[data-pr-evidence]{background:#fef3c7!important;box-shadow:inset 3px 0 #d97706}';

function addEvidenceStyle(root) {
  if (root.querySelector('style[data-evidence]')) return;
  const style = document.createElement('style');
  style.dataset.evidence = '';
  style.textContent = EVIDENCE_STYLE;
  root.append(style);
}

function clearEvidence(root) {
  root.querySelectorAll('[data-pr-evidence]').forEach((node) => node.removeAttribute('data-pr-evidence'));
}

function markEvidence(root, lines, lineTypes) {
  for (const number of lines) {
    for (const type of lineTypes) {
      root
        .querySelectorAll(
          `[data-line="${number}"][data-line-type="${type}"],[data-column-number="${number}"][data-line-type="${type}"]`,
        )
        .forEach((node) => node.setAttribute('data-pr-evidence', ''));
    }
  }
}

// Hovering a pseudocode line highlights the changed source lines it maps to.
function decorateEvidence(card) {
  const root = sourceRoot(card.querySelector('.source-diff'));
  if (!root) return;
  addEvidenceStyle(root);
  const pseudo = card.querySelector('.pseudo-diff');
  pseudo.addEventListener('pointerover', (event) => {
    const line = event.target.closest('.pseudo-line');
    if (!line) return;
    clearEvidence(root);
    markEvidence(root, beforeLines(line), ['change-deletion']);
    markEvidence(root, afterLines(line), ['change-addition']);
  });
  pseudo.addEventListener('pointerleave', () => clearEvidence(root));
}

// One and a half pseudocode lines (25px each) stay visible between the hovered line and the peek.
const PEEK_GAP = 1.5 * 25 + 8;
const peek = { element: null, diff: null, title: null, cardId: null, hovered: null, pointerInside: false };

function ensurePeek() {
  if (peek.element) return;
  const element = document.createElement('div');
  element.className = 'source-peek';
  element.hidden = true;
  element.innerHTML =
    '<div class="peek-header"><span class="peek-title"></span><button type="button" class="peek-close" aria-label="Close source peek">Esc</button></div><div class="peek-diff"></div>';
  element.addEventListener('pointerenter', () => {
    peek.pointerInside = true;
  });
  element.addEventListener('pointerleave', () => {
    peek.pointerInside = false;
    closePeek();
  });
  element.querySelector('.peek-close').addEventListener('click', closePeek);
  document.body.append(element);
  peek.element = element;
  peek.diff = element.querySelector('.peek-diff');
  peek.title = element.querySelector('.peek-title');
}

function closePeek() {
  if (peek.element) peek.element.hidden = true;
}

function highlightPeekLines(line) {
  const root = sourceRoot(peek.diff);
  if (!root) return;
  addEvidenceStyle(root);
  clearEvidence(root);
  markEvidence(root, beforeLines(line), ['change-deletion']);
  markEvidence(root, afterLines(line), ['change-addition', 'context']);
  const first = root.querySelector('[data-pr-evidence]');
  if (first) first.scrollIntoView({ block: 'center' });
  else peek.diff.scrollTop = 0;
}

function positionPeek(line) {
  const rect = line.getBoundingClientRect();
  const element = peek.element;
  const height = element.offsetHeight;
  const below = rect.bottom + PEEK_GAP + height <= window.innerHeight;
  element.style.top = `${below ? rect.bottom + PEEK_GAP : Math.max(8, rect.top - PEEK_GAP - height)}px`;
  const width = element.offsetWidth;
  element.style.left = `${Math.max(16, Math.min(rect.left + 60, window.innerWidth - width - 16))}px`;
}

function openPeek(line) {
  const article = line.closest('.pr-card');
  const card = data.cards.find((entry) => entry.id === article?.id);
  if (!card) return;
  ensurePeek();
  peek.element.hidden = false;
  const lines = sourceLinesLabel(beforeLines(line), afterLines(line));
  const detail = card.status === 'Context' ? 'source unchanged' : lines || 'no changed source mapped';
  peek.title.textContent = `${card.file} · ${detail}`;
  const rerender = peek.cardId !== card.id;
  if (rerender) {
    peek.cardId = card.id;
    peek.diff.replaceChildren();
    renderSource(peek.diff, card);
  }
  positionPeek(line);
  if (rerender) requestAnimationFrame(() => highlightPeekLines(line));
  else highlightPeekLines(line);
}

function peekActive() {
  return state.diffStyle === 'hidden';
}

document.getElementById('cards').addEventListener('pointerover', (event) => {
  if (!peekActive()) return;
  const line = event.target.closest('.pseudo-line');
  if (!line) return;
  peek.hovered = line;
  if (event.shiftKey) openPeek(line);
});
document.getElementById('cards').addEventListener('pointerleave', () => {
  peek.hovered = null;
});
document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape') closePeek();
  if (event.key === 'Shift' && peekActive() && peek.hovered) openPeek(peek.hovered);
});
document.addEventListener('keyup', (event) => {
  if (event.key === 'Shift' && !peek.pointerInside) closePeek();
});
document.addEventListener('pointerdown', (event) => {
  if (peek.element && !peek.element.hidden && !peek.element.contains(event.target)) closePeek();
});

function renderCards() {
  document.body.classList.toggle('source-split', state.diffStyle === 'split');
  document.body.classList.toggle('source-hidden', state.diffStyle === 'hidden');
  const container = document.getElementById('cards');
  container.replaceChildren();
  for (const [index, card] of data.cards.entries()) {
    const article = document.createElement('article');
    article.id = card.id;
    article.className = 'fn pr-card';
    const name = `${card.className ? `${card.className}.` : ''}${card.symbol}`;
    const sourceLabel =
      state.diffStyle === 'split'
        ? '<div class="pane-label source-side-labels"><span>Source before</span><span>Source after</span></div>'
        : '<div class="pane-label">Source change</div>';
    const sourceBody =
      card.status === 'Context'
        ? '<p class="empty">The source of this function did not change.</p>'
        : '<div class="source-diff"></div>';
    const sourcePane = state.diffStyle === 'hidden' ? '' : `<div class="source-pane">${sourceLabel}${sourceBody}</div>`;
    const pseudoLabel = state.diffStyle === 'hidden' ? '' : '<div class="pane-label">Pseudocode</div>';
    article.innerHTML = `<div class="fn-header"><span class="card-number">${String(index + 1).padStart(2, '0')}</span><h2>${escapeHtml(name)}</h2><span class="tag status-${card.status.toLowerCase()}">${escapeHtml(card.status)}</span><code class="card-file">${escapeHtml(card.file)}</code></div><div class="change-panes"><div class="pseudo-pane">${pseudoLabel}<div class="pseudo-diff" role="table" aria-label="Full-function pseudocode change">${card.pseudoRows.map(pseudoLine).join('')}</div></div>${sourcePane}</div>`;
    container.append(article);
    if (state.diffStyle === 'hidden' || card.status === 'Context') continue;
    renderDiff(article.querySelector('.source-diff'), card.sourceBefore?.code, card.sourceAfter?.code);
    requestAnimationFrame(() => decorateEvidence(article));
  }
}

function renderRemainder() {
  const container = document.getElementById('remainder-content');
  const files = data.files.filter((file) => file.showRemainder);
  if (!files.length) {
    container.innerHTML = '<p>Every changed function is represented, and no structural source changes remain.</p>';
    return;
  }
  container.replaceChildren();
  for (const file of files) {
    const details = document.createElement('details');
    const entries = file.unrepresented
      .map((symbol) => {
        const name = `${symbol.className ? `${symbol.className}.` : ''}${symbol.symbol}`;
        const status = symbol.added ? 'added' : symbol.removed ? 'removed' : 'modified';
        return `<li><code>${escapeHtml(name)}</code> <span class="muted">${status}, no pseudocode card</span></li>`;
      })
      .join('');
    details.innerHTML = `<summary><span class="file-name">${escapeHtml(file.path)}</span></summary>${file.note ? `<p>${escapeHtml(file.note)}</p>` : ''}${entries ? `<ul class="inventory">${entries}</ul>` : ''}${file.structural ? '<p class="muted">This file also has changed lines outside extracted functions.</p>' : ''}<div class="raw-diff"></div>`;
    let rendered = false;
    details.addEventListener('toggle', () => {
      if (!details.open || rendered) return;
      rendered = true;
      renderDiff(details.querySelector('.raw-diff'), file.before, file.after);
    });
    container.append(details);
  }
}

function updateButtons() {
  document
    .querySelectorAll('[data-diff-style]')
    .forEach((button) => button.setAttribute('aria-pressed', String(button.dataset.diffStyle === state.diffStyle)));
}

document.querySelectorAll('[data-diff-style]').forEach((button) => {
  button.addEventListener('click', () => {
    state.diffStyle = button.dataset.diffStyle;
    localStorage.setItem('code-slices-pr-diff-style', state.diffStyle);
    closePeek();
    peek.cardId = null;
    renderCards();
    renderRemainder();
    updateButtons();
  });
});

renderCards();
renderRemainder();
updateButtons();
document.documentElement.dataset.ready = 'true';
