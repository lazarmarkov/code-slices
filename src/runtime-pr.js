import { FileDiff, registerCustomCSSVariableTheme } from 'https://esm.sh/@pierre/diffs@1.2.10?bundle';

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
const theme = { light: sourceThemeName, dark: sourceThemeName };
const state = {
  diffStyle: localStorage.getItem('code-slices-pr-diff-style') || 'unified',
};
const DIFF_STYLES = ['unified', 'split', 'hidden'];
if (!DIFF_STYLES.includes(state.diffStyle)) state.diffStyle = 'unified';
const sourceDiffStyle = () => (state.diffStyle === 'hidden' ? 'unified' : state.diffStyle);

const escapeHtml = (value) =>
  String(value ?? '').replace(
    /[&<>"']/g,
    (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character],
  );

function renderDiff(container, before, after) {
  const withFinalNewline = (contents) => (contents && !contents.endsWith('\n') ? `${contents}\n` : contents || '');
  return new FileDiff({
    theme,
    themeType: 'light',
    overflow: 'wrap',
    disableFileHeader: true,
    diffStyle: sourceDiffStyle(),
  }).render({
    containerWrapper: container,
    oldFile: { name: 'before.ts', contents: withFinalNewline(before) },
    newFile: { name: 'after.ts', contents: withFinalNewline(after) },
  });
}

function compressedLines(lines) {
  if (!lines.length) return '';
  const groups = [];
  let start = lines[0];
  let end = lines[0];
  for (const line of lines.slice(1)) {
    if (line === end + 1) {
      end = line;
    } else {
      groups.push(start === end ? String(start) : `${start}-${end}`);
      start = line;
      end = line;
    }
  }
  groups.push(start === end ? String(start) : `${start}-${end}`);
  return groups.join(', ');
}

function evidenceTitle(row) {
  const parts = [];
  if (row.beforeSourceLines.length) parts.push(`before source ${compressedLines(row.beforeSourceLines)}`);
  if (row.afterSourceLines.length) parts.push(`after source ${compressedLines(row.afterSourceLines)}`);
  return parts.join('; ');
}

function pseudoLine(row) {
  const className = row.marker
    ? `pseudo-line marker-${row.marker === '+' ? 'add' : row.marker === '-' ? 'remove' : 'modify'}`
    : `pseudo-line${row.type === 'equal' ? '' : ' neutral-edit'}`;
  const evidence = row.evidenceKind === 'signature'
    ? `<span class="evidence" title="${escapeHtml(evidenceTitle(row))}">${escapeHtml(row.evidenceKind)}</span>`
    : '';
  const title = row.evidenceKind ? `${row.evidenceKind}: ${evidenceTitle(row)}` : '';
  return `<div class="${className}" data-before-lines="${row.beforeSourceLines.join(',')}" data-after-lines="${row.afterSourceLines.join(',')}"${title ? ` title="${escapeHtml(title)}"` : ''}><span class="marker">${row.marker || ' '}</span><span class="old-number">${row.oldLine || ''}</span><span class="new-number">${row.newLine || ''}</span><code>${row.highlighted || escapeHtml(row.text) || ' '}</code>${evidence}</div>`;
}

function sourceRoot(container) {
  return container.querySelector('diffs-container')?.shadowRoot || null;
}

function decorateEvidence(card) {
  const root = sourceRoot(card.querySelector('.source-diff'));
  if (!root) return;
  const style = document.createElement('style');
  style.textContent = '[data-pr-evidence]{background:#fef3c7!important;box-shadow:inset 3px 0 #d97706}';
  root.append(style);
  const clear = () => root.querySelectorAll('[data-pr-evidence]').forEach((node) => node.removeAttribute('data-pr-evidence'));
  card.querySelector('.pseudo-diff').addEventListener('pointerover', (event) => {
    const line = event.target.closest('.pseudo-line');
    if (!line) return;
    clear();
    const beforeNumbers = line.dataset.beforeLines.split(',').filter(Boolean).map(Number);
    const afterNumbers = line.dataset.afterLines.split(',').filter(Boolean).map(Number);
    for (const number of new Set(beforeNumbers)) {
      root
        .querySelectorAll(`[data-line="${number}"][data-line-type="change-deletion"],[data-column-number="${number}"][data-line-type="change-deletion"]`)
        .forEach((node) => node.setAttribute('data-pr-evidence', ''));
    }
    for (const number of new Set(afterNumbers)) {
      root
        .querySelectorAll(`[data-line="${number}"][data-line-type="change-addition"],[data-column-number="${number}"][data-line-type="change-addition"]`)
        .forEach((node) => node.setAttribute('data-pr-evidence', ''));
    }
  });
  card.querySelector('.pseudo-diff').addEventListener('pointerleave', clear);
}

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
    const sourceLabel = state.diffStyle === 'split'
      ? '<div class="pane-label source-side-labels"><span>Source before</span><span>Source after</span></div>'
      : '<div class="pane-label">Source change</div>';
    const sourcePane = state.diffStyle === 'hidden' ? '' : `<div class="source-pane">${sourceLabel}<div class="source-diff"></div></div>`;
    article.innerHTML = `<div class="fn-header"><span class="card-number">${String(index + 1).padStart(2, '0')}</span><h2>${escapeHtml(name)}</h2><span class="tag status-${card.status.toLowerCase()}">${escapeHtml(card.status)}</span></div><div class="change-panes"><div class="pseudo-pane"><div class="pane-label source-breadcrumb"><code>${escapeHtml(card.file)}</code></div><div class="pseudo-diff" role="table" aria-label="Full-function pseudocode change">${card.pseudoRows.map(pseudoLine).join('')}</div></div>${sourcePane}</div>`;
    container.append(article);
    if (state.diffStyle === 'hidden') continue;
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
    renderCards();
    renderRemainder();
    updateButtons();
  });
});

renderCards();
renderRemainder();
updateButtons();
document.documentElement.dataset.ready = 'true';
