import { File, FileDiff } from 'https://esm.sh/@pierre/diffs@1.2.10?bundle';

const data = JSON.parse(document.getElementById('review-data').textContent);
const options = {
  theme: { light: 'github-light', dark: 'github-dark' },
  themeType: 'light',
  overflow: 'wrap',
  disableFileHeader: true,
};

// Revision: which pseudocode to show. Mode: pseudocode alone, or split with the source.
const REVISIONS = ['after', 'before', 'changes'];
const MODES = ['pseudo', 'split'];
const state = {
  revision: localStorage.getItem('code-slices-revision'),
  mode: localStorage.getItem('code-slices-view'),
};
if (!REVISIONS.includes(state.revision)) state.revision = 'after';
if (!MODES.includes(state.mode)) state.mode = 'pseudo';

const entities = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
const escapeHtml = (value) => String(value ?? '').replace(/[&<>"']/g, (character) => entities[character]);
const functionName = (entry) => `${entry.className ? `${entry.className}.` : ''}${entry.symbol}`;
const withFinalNewline = (contents) => (contents && !contents.endsWith('\n') ? `${contents}\n` : contents || '');

// A commit-pinned GitHub link when the manifest has repositoryURL; otherwise a local anchor.
function sourceLink(file, line, revision = 'after') {
  const root = data.repositoryURL ? `${data.repositoryURL.replace(/\/$/, '')}/blob/` : '#';
  return `${root}${revision === 'before' ? data.base : data.head}/${file}#L${line}`;
}

function renderFile(container, name, contents) {
  return new File(options).render({ containerWrapper: container, file: { name, contents } });
}

function renderDiff(container, name, before, after) {
  return new FileDiff({ ...options, diffStyle: 'split' }).render({
    containerWrapper: container,
    oldFile: { name, contents: withFinalNewline(before) },
    newFile: { name, contents: withFinalNewline(after) },
  });
}

const shadowRootOf = (container) => container?.querySelector('diffs-container')?.shadowRoot;
const rowsForLines = (root, lines) =>
  lines.flatMap((line) => [...root.querySelectorAll(`[data-line="${line}"],[data-column-number="${line}"]`)]);
const linesOf = ([first, last]) => Array.from({ length: last - first + 1 }, (_, index) => first + index);

function addStyle(root, css) {
  const style = document.createElement('style');
  style.textContent = css;
  root.append(style);
}

const addPairedStyle = (root) =>
  addStyle(root, '[data-paired]{background:#dcfce7!important;box-shadow:inset 3px 0 #16a34a}');

function closePreviews() {
  document.querySelectorAll('.source-preview').forEach((node) => node.remove());
}

// In split view, shows mapped source that is scrolled out of sight in a floating excerpt.
function openPreview(card, source, mapping) {
  closePreviews();
  const pane = card.querySelector('.source-pane');
  if (state.mode !== 'split' || !pane) return;
  const rect = pane.getBoundingClientRect();
  const sourceLines = source.code.split('\n');
  const start = Math.max(1, mapping.source[0] - 2);
  const end = Math.min(sourceLines.length, mapping.source[1] + 2);
  const fileLine = source.line + mapping.source[0] - 1;
  const overlay = document.createElement('section');
  overlay.className = 'source-preview';
  overlay.style.left = `${Math.max(8, rect.left)}px`;
  overlay.style.width = `${Math.min(rect.width, innerWidth - rect.left - 12)}px`;
  overlay.style.top = '90px';
  overlay.innerHTML = `<div class="preview-header"><a target="_blank" href="${sourceLink(card.dataset.file, fileLine, state.revision)}">${escapeHtml(card.dataset.symbol)} · ${escapeHtml(card.dataset.file)}:${fileLine}</a><button aria-label="Close source preview">Close</button></div><div class="muted">Excerpt starts at source line ${source.line + start - 1}</div><div class="preview-code"></div>`;
  card.append(overlay);
  overlay.querySelector('button').onclick = () => overlay.remove();
  const container = overlay.querySelector('.preview-code');
  renderFile(container, card.dataset.file, sourceLines.slice(start - 1, end).join('\n'));
  requestAnimationFrame(() => {
    const root = shadowRootOf(container);
    if (!root) return;
    addPairedStyle(root);
    const excerptLines = linesOf(mapping.source).map((line) => line - start + 1);
    for (const node of rowsForLines(root, excerptLines)) node.setAttribute('data-paired', '');
  });
}

// Pseudocode line 1 is the ▹ caption, so pseudocode line n renders as line n + 1.
function attachPairing(card, source, mappings) {
  const pseudo = shadowRootOf(card.querySelector('.pseudo-code'));
  const original = shadowRootOf(card.querySelector('.source-code'));
  if (!pseudo || !original) return;
  addPairedStyle(pseudo);
  addPairedStyle(original);
  addStyle(
    pseudo,
    '[data-line="1"],[data-line="1"] *{font-family:system-ui,sans-serif!important;font-style:italic;color:#686868!important}[data-line="1"]{padding-bottom:4px}',
  );
  // Push the source down one line so both signatures share a row.
  addStyle(original, '[data-line="1"],[data-column-number="1"]{margin-top:calc(1lh + 4px)}');
  pseudo
    .querySelector('[data-line="1"]')
    ?.setAttribute(
      'title',
      'Describes the conditions and outcome followed in this example. The pseudocode hides parts of the function not exercised by this example.',
    );
  const clear = () => {
    for (const root of [pseudo, original]) {
      root.querySelectorAll('[data-paired]').forEach((node) => node.removeAttribute('data-paired'));
    }
  };
  for (const [root, side] of [
    [pseudo, 'pseudo'],
    [original, 'source'],
  ]) {
    root.addEventListener('pointerover', (event) => {
      const row = event.target.closest?.('[data-line],[data-column-number]');
      if (!row) return;
      const line = Number(row.dataset.line || row.dataset.columnNumber);
      clear();
      closePreviews();
      const offset = side === 'pseudo' ? 1 : 0;
      const matched = (mappings || []).filter((mapping) => {
        const range = mapping[side];
        return range && line >= range[0] + offset && line <= range[1] + offset;
      });
      for (const mapping of matched) {
        for (const node of rowsForLines(
          pseudo,
          linesOf(mapping.pseudo).map((n) => n + 1),
        ))
          node.setAttribute('data-paired', '');
        if (mapping.source)
          for (const node of rowsForLines(original, linesOf(mapping.source))) node.setAttribute('data-paired', '');
      }
      if (side !== 'pseudo') return;
      const offscreen = matched.find(
        (mapping) =>
          mapping.source &&
          linesOf(mapping.source).some((n) => {
            const rect = original.querySelector(`[data-line="${n}"]`)?.getBoundingClientRect();
            return !rect || rect.top < 65 || rect.bottom > innerHeight - 65;
          }),
      );
      if (offscreen) openPreview(card, source, offscreen);
    });
  }
  card.addEventListener('pointerleave', () => {
    clear();
    closePreviews();
  });
}

// Renders a file's exact diff the first time its <details> opens.
function renderDiffOnOpen(details, file) {
  let rendered = false;
  details.addEventListener('toggle', () => {
    if (!details.open || rendered) return;
    rendered = true;
    renderDiff(details.querySelector('.raw-diff'), file.path, file.before, file.after);
  });
}

function renderIndex() {
  const changedItem = (symbol) => {
    const name = escapeHtml(functionName(symbol));
    if (symbol.card) return `<li><a href="#${symbol.card}">${name}</a></li>`;
    return `<li><span>${name} <span class="muted">${symbol.removed ? 'removed · ' : ''}not covered by a slice</span></span></li>`;
  };
  const coverage = (file) =>
    file.flows.length
      ? file.flows
          .map((id) => `<a href="#${id}">${escapeHtml(data.flows.find((flow) => flow.id === id).title)}</a>`)
          .join('<br>')
      : `<span class="muted">${escapeHtml(file.category)}</span>`;
  const rows = data.files.map(
    (file, index) =>
      `<tr><td><details id="file-${index}"><summary class="file-name">${escapeHtml(file.path)}</summary><p>${escapeHtml(file.note)}</p><div class="raw-diff"></div></details>${file.changed.length ? `<ul class="inventory">${file.changed.map(changedItem).join('')}</ul>` : ''}</td><td>${coverage(file)}</td></tr>`,
  );
  document.getElementById('coverage-content').innerHTML =
    `<table><thead><tr><th>File / changed functions</th><th>Coverage</th></tr></thead><tbody>${rows.join('')}</tbody></table>`;
  data.files.forEach((file, index) => renderDiffOnOpen(document.getElementById(`file-${index}`), file));

  const supporting = data.files
    .map((file, index) => ({ file, index }))
    .filter(({ file }) => file.category === 'Structural/support review');
  document.getElementById('structural-content').innerHTML = supporting.length
    ? supporting
        .map(
          ({ file, index }) =>
            `<p><a href="#file-${index}" class="file-name">${escapeHtml(file.path)}</a><br>${escapeHtml(file.note)}</p>`,
        )
        .join('')
    : '<p class="muted">No supporting changes.</p>';
}

function renderTypes(section, flow) {
  const revision = state.revision === 'before' ? 'base' : 'head';
  const content = `${flow.tree} ${flow.cards.map((card) => card.after).join(' ')}`;
  for (const [name, type] of Object.entries(data.types[revision])) {
    if (!new RegExp(`\\b${name}\\b`).test(content)) continue;
    const entry = document.createElement('div');
    section.querySelector('.type-layer').append(entry);
    renderFile(entry, `${type.file} · ${name}`, type.code);
  }
}

function renderCard(container, entry) {
  const changes = state.revision === 'changes';
  const revision = state.revision === 'before' ? 'before' : 'after';
  const source = revision === 'before' ? entry.sourceBefore : entry.sourceAfter;
  const pseudocode = revision === 'before' ? entry.before : entry.after;
  const gauge = revision === 'before' ? entry.visibilityBefore : entry.visibilityAfter;
  const line = source?.line || entry.sourceAfter.line;
  const card = document.createElement('article');
  card.id = entry.id;
  card.className = 'fn';
  card.dataset.file = entry.file;
  card.dataset.symbol = entry.symbol;
  const gaugeHtml =
    !changes && gauge?.show
      ? `<span class="gauge" title="${gauge.hidden} of ${gauge.total} nonblank, non-Logger.log source lines have no mapping. This estimates representation, not execution coverage."><span class="dot"></span>${gauge.percent}% hidden · ${gauge.hidden} LoC</span>`
      : '';
  card.innerHTML = `<div class="fn-header"><a target="_blank" href="${sourceLink(entry.file, line, source ? revision : 'after')}">${escapeHtml(entry.file)}:${line}</a><span class="tag">${entry.status}</span>${gaugeHtml}</div><div class="panes"><div class="code-pane"><div class="pane-label">${changes ? 'Pseudocode changes' : 'Pseudocode'}</div><div class="code pseudo-code"></div></div><div class="code-pane source-pane"><div class="pane-label">${changes ? 'Source changes' : 'Original source'}</div><div class="code source-code"></div></div></div><div class="fn-footer"><span class="muted">${escapeHtml(entry.change || entry.note || '')}</span></div>`;
  container.append(card);

  const pseudoNode = card.querySelector('.pseudo-code');
  const sourceNode = card.querySelector('.source-code');
  if (changes) {
    renderDiff(pseudoNode, `${entry.symbol}.pseudo.ts`, entry.before, entry.after);
    renderDiff(sourceNode, entry.file, entry.sourceBefore?.code, entry.sourceAfter.code);
  } else if (!source || pseudocode == null) {
    pseudoNode.innerHTML = '<div class="empty">Added in this PR. No Before implementation.</div>';
    sourceNode.innerHTML = '<div class="empty">This function did not exist at the base revision.</div>';
  } else {
    const caption = revision === 'before' ? entry.scenarioBefore || entry.scenario : entry.scenario;
    renderFile(pseudoNode, `${entry.symbol}.pseudo.ts`, `▹ ${caption}\n${pseudocode}`);
    renderFile(sourceNode, entry.file, source.code);
    const mappings = revision === 'before' ? entry.mappingsBefore : entry.mappingsAfter;
    requestAnimationFrame(() => attachPairing(card, source, mappings));
  }
}

function renderFlows() {
  closePreviews();
  document.body.classList.toggle('split', state.mode === 'split');
  const container = document.getElementById('flows');
  container.replaceChildren();
  for (const [index, flow] of data.flows.entries()) {
    const section = document.createElement('section');
    section.id = flow.id;
    section.className = 'flow-heading';
    section.innerHTML = `<h2>${String(index + 1).padStart(2, '0')} ${escapeHtml(flow.title)}</h2><p>${escapeHtml(flow.description)}</p><a class="back" href="#coverage">↑ Changed-code index</a><div class="flow-tree"></div><div class="type-layer"></div>`;
    container.append(section);
    const beforeTree =
      flow.treeBefore ||
      `Before this PR: ${flow.cards.some((card) => card.before) ? 'see the existing function implementations below.' : 'these model APIs do not exist.'}`;
    renderFile(
      section.querySelector('.flow-tree'),
      `${flow.id}.call-tree.txt`,
      state.revision === 'before' ? beforeTree : flow.tree,
    );
    renderTypes(section, flow);
    for (const entry of flow.cards) renderCard(container, entry);
  }
  document
    .querySelectorAll('[data-revision]')
    .forEach((button) => button.setAttribute('aria-pressed', String(button.dataset.revision === state.revision)));
  document
    .querySelectorAll('[data-mode]')
    .forEach((button) => button.setAttribute('aria-pressed', String(button.dataset.mode === state.mode)));
  document.documentElement.dataset.ready = 'true';
}

document.querySelectorAll('[data-revision]').forEach((button) => {
  button.onclick = () => {
    state.revision = button.dataset.revision;
    localStorage.setItem('code-slices-revision', state.revision);
    renderFlows();
  };
});
document.querySelectorAll('[data-mode]').forEach((button) => {
  button.onclick = () => {
    state.mode = button.dataset.mode;
    localStorage.setItem('code-slices-view', state.mode);
    renderFlows();
  };
});

// Hold Alt (Option) to show the type definitions used by each flow.
window.addEventListener('keydown', (event) => {
  if (event.key === 'Alt') document.body.classList.add('types-expanded');
  if (event.key === 'Escape') closePreviews();
});
window.addEventListener('keyup', (event) => {
  if (event.key === 'Alt' || !event.altKey) document.body.classList.remove('types-expanded');
});
window.addEventListener('blur', () => document.body.classList.remove('types-expanded'));

renderIndex();
renderFlows();
