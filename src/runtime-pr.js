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
  const indent = (row.text.match(/^ */) || [''])[0].length;
  const body = (row.highlighted || escapeHtml(row.text)).replace(/^\s+/, '') || ' ';
  const hanging = `padding-left:calc(5px + ${indent + 2}ch);text-indent:-2ch`;
  return `<div class="${className}" data-before-lines="${row.beforeSourceLines.join(',')}" data-after-lines="${row.afterSourceLines.join(',')}"${title ? ` title="${escapeHtml(title)}"` : ''}><span class="marker">${row.marker || ' '}</span><span class="old-number">${row.oldLine || ''}</span><span class="new-number">${row.newLine || ''}</span><code style="${hanging}">${body}</code>${evidence}</div>`;
}

function sourceRoot(container) {
  return container.querySelector('diffs-container')?.shadowRoot || null;
}

function decorateEvidence(card) {
  const root = sourceRoot(card.querySelector('.source-diff'));
  if (!root) return;
  const style = document.createElement('style');
  style.textContent = PEEK_STYLE;
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

const PEEK_STYLE = '[data-pr-evidence]{background:#fef3c7!important;box-shadow:inset 3px 0 #d97706}';
// One and a half pseudocode lines (25px each) stay visible between the hovered line and the peek.
const PEEK_GAP = 1.5 * 25 + 8;
const peek = { element: null, diff: null, title: null, cardId: null, hovered: null, pointerInside: false };

function ensurePeek() {
  if (peek.element) return;
  const element = document.createElement('div');
  element.className = 'source-peek';
  element.hidden = true;
  element.innerHTML = '<div class="peek-header"><span class="peek-title"></span><button type="button" class="peek-close" aria-label="Close source peek">Esc</button></div><div class="peek-diff"></div>';
  element.addEventListener('pointerenter', () => { peek.pointerInside = true; });
  element.addEventListener('pointerleave', () => { peek.pointerInside = false; closePeek(); });
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
  if (!root.querySelector('style[data-peek]')) {
    const style = document.createElement('style');
    style.dataset.peek = '';
    style.textContent = PEEK_STYLE;
    root.append(style);
  }
  root.querySelectorAll('[data-pr-evidence]').forEach((node) => node.removeAttribute('data-pr-evidence'));
  const select = (numbers, types) => {
    for (const number of new Set(numbers)) {
      for (const type of types) {
        root
          .querySelectorAll(`[data-line="${number}"][data-line-type="${type}"],[data-column-number="${number}"][data-line-type="${type}"]`)
          .forEach((node) => node.setAttribute('data-pr-evidence', ''));
      }
    }
  };
  select(line.dataset.beforeLines.split(',').filter(Boolean).map(Number), ['change-deletion']);
  select(line.dataset.afterLines.split(',').filter(Boolean).map(Number), ['change-addition', 'context']);
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
  const element = peek.element;
  element.hidden = false;
  const lines = [...line.dataset.beforeLines.split(',').filter(Boolean).map((n) => `before ${n}`), ...line.dataset.afterLines.split(',').filter(Boolean).map((n) => `after ${n}`)];
  peek.title.textContent = `${card.file} · source ${compressedLines(line.dataset.afterLines.split(',').filter(Boolean).map(Number)) || compressedLines(line.dataset.beforeLines.split(',').filter(Boolean).map(Number)) || 'unmapped'}`;
  const rerender = peek.cardId !== card.id;
  if (rerender) {
    peek.cardId = card.id;
    peek.diff.replaceChildren();
    renderDiff(peek.diff, card.sourceBefore?.code, card.sourceAfter?.code);
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

function inlineText(value) {
  return escapeHtml(value).replace(/`([^`]+)`/g, '<code>$1</code>');
}

// A paragraph whose every line starts with "1. " or "- " renders as a list.
function introBlock(paragraph) {
  const lines = paragraph.split('\n').map((line) => line.trim());
  const ordered = lines.every((line) => /^\d+\.\s/.test(line));
  const bulleted = lines.every((line) => /^-\s/.test(line));
  if (!ordered && !bulleted) return `<p>${inlineText(paragraph)}</p>`;
  const tag = ordered ? 'ol' : 'ul';
  const items = lines.map((line) => `<li>${inlineText(line.replace(/^(\d+\.|-)\s+/, ''))}</li>`).join('');
  return `<${tag}>${items}</${tag}>`;
}

function sectionHeading(section, number) {
  const heading = document.createElement('section');
  heading.id = section.id;
  heading.className = 'stage-heading';
  const paragraphs = section.intro
    .split(/\n\s*\n/)
    .filter((paragraph) => paragraph.trim())
    .map((paragraph) => introBlock(paragraph.trim()))
    .join('');
  const terms = section.terms.length
    ? `<dl class="stage-terms">${section.terms.map(([term, meaning]) => `<dt><code>${escapeHtml(term)}</code></dt><dd>${inlineText(meaning)}</dd>`).join('')}</dl>`
    : '';
  heading.innerHTML = `<div class="stage-number">Stage ${number}</div><h2>${escapeHtml(section.title)}</h2>${paragraphs}${terms}`;
  return heading;
}

function relationLinks(label, ids) {
  if (!ids?.length) return '';
  const links = ids
    .map((id) => {
      const index = cardIndexById.get(id);
      const target = data.cards[index];
      const name = `${target.className ? `${target.className}.` : ''}${target.symbol}`;
      return `<a href="#${id}">${String(index + 1).padStart(2, '0')} ${escapeHtml(name)}</a>`;
    })
    .join('');
  return `<div class="relation"><span>${label}</span><div class="relation-links">${links}</div></div>`;
}

const cardIndexById = new Map(data.cards.map((card, index) => [card.id, index]));
const sectionByStart = new Map((data.sections || []).map((section, index) => [section.start, { section, number: index + 1 }]));

function renderCards() {
  document.body.classList.toggle('source-split', state.diffStyle === 'split');
  document.body.classList.toggle('source-hidden', state.diffStyle === 'hidden');
  const container = document.getElementById('cards');
  container.replaceChildren();
  for (const [index, card] of data.cards.entries()) {
    const start = sectionByStart.get(index);
    if (start) container.append(sectionHeading(start.section, start.number));
    const article = document.createElement('article');
    article.id = card.id;
    article.className = 'fn pr-card';
    const name = `${card.className ? `${card.className}.` : ''}${card.symbol}`;
    const sourceLabel = state.diffStyle === 'split'
      ? '<div class="pane-label source-side-labels"><span>Source before</span><span>Source after</span></div>'
      : '<div class="pane-label">Source change</div>';
    const sourcePane = state.diffStyle === 'hidden' ? '' : `<div class="source-pane">${sourceLabel}<div class="source-diff"></div></div>`;
    const pseudoLabel = state.diffStyle === 'hidden' ? '' : '<div class="pane-label">Pseudocode</div>';
    article.innerHTML = `<div class="fn-header"><span class="card-number">${String(index + 1).padStart(2, '0')}</span><h2>${escapeHtml(name)}</h2><span class="tag status-${card.status.toLowerCase()}">${escapeHtml(card.status)}</span><code class="card-file">${escapeHtml(card.file)}</code></div>${card.calledBy?.length || card.calls?.length ? `<div class="relations">${relationLinks('Called by', card.calledBy)}${relationLinks('Calls', card.calls)}</div>` : ''}<div class="change-panes"><div class="pseudo-pane">${pseudoLabel}<div class="pseudo-diff" role="table" aria-label="Full-function pseudocode change">${card.pseudoRows.map(pseudoLine).join('')}</div></div>${sourcePane}</div>`;
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
