#!/usr/bin/env node
const fs = require('node:fs');
const path = require('node:path');
const { palettes, paletteCss, roles } = require('./code-palettes.cjs');
const { highlightPseudocode } = require('./pseudocode-highlight.cjs');
const { findSymbol, sourceSymbols } = require('./source-model.cjs');
const { highlightTypeScript } = require('./typescript-highlight.cjs');

const args = process.argv.slice(2);
if (args.length !== 3) {
  process.stderr.write('Usage: node src/build-palette-preview.cjs <manifest.json> <symbol-or-id> <output.html>\n');
  process.exit(1);
}

const escapeHtml = (value) =>
  String(value).replace(/[&<>"']/g, (character) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character],
  );

const [manifestInput, target, outputInput] = args;
const manifestPath = path.resolve(manifestInput);
const manifestDirectory = path.dirname(manifestPath);
const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
const cards = manifest.cards.flatMap((entry) => {
  const input = JSON.parse(fs.readFileSync(path.resolve(manifestDirectory, entry), 'utf8'));
  return input.cards || [input];
});
const matches = cards.filter((card) => card.symbol === target || card.id === target);
if (matches.length !== 1) throw new Error(`Expected one card for ${target}; found ${matches.length}`);
const card = matches[0];
if (!card.after) throw new Error(`Card ${card.id} has no after pseudocode`);

const sourcePath = path.resolve(manifestDirectory, manifest.sources.head, card.file);
const sourceText = fs.readFileSync(sourcePath, 'utf8');
const source = findSymbol(sourceSymbols(card.file, sourceText), card, 'head');
if (!source) throw new Error(`Could not extract ${card.symbol} from ${sourcePath}`);

const pseudoLines = highlightPseudocode(card.after);
const sourceLines = highlightTypeScript(source.code);
const rows = (lines) =>
  lines
    .map(
      (line, index) =>
        `<div class="code-line"><span class="line-number">${index + 1}</span><code>${line || ' '}</code></div>`,
    )
    .join('');
const swatches = () =>
  roles.map((role) => `<span><i style="background:var(--${role})"></i>${role}</span>`).join('');
const paletteRules = palettes.map(paletteCss).join('');
const paletteData = Object.fromEntries(palettes.map((palette) => [palette.id, palette]));

const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${escapeHtml(card.symbol)} palette comparison</title>
<style>
:root{--page:#f6f7f8;--card:#fff;--ink:#24292f;--muted:#667085;--line:#d0d7de;--added:#e6ffec;--added-line:#aceebb}*{box-sizing:border-box}body{margin:0;background:var(--page);color:var(--ink);font:14px/1.45 system-ui,-apple-system,sans-serif}header,main{width:min(1840px,100%);margin:auto;padding:18px 24px}header{padding-bottom:8px}h1{margin:0 0 4px;font-size:24px;letter-spacing:-.35px}p{margin:0;color:var(--muted)}.breadcrumb{margin-top:7px;font:12px ui-monospace,SFMono-Regular,Menlo,monospace}.review{border:1px solid var(--line);background:var(--card)}.toolbar{display:flex;align-items:center;justify-content:space-between;gap:14px;min-height:52px;padding:9px 12px;border-bottom:1px solid var(--line)}.tabs{display:flex;gap:5px;flex-wrap:wrap}.tabs button{border:1px solid var(--line);border-radius:5px;background:#fff;padding:6px 10px;color:var(--ink);font:600 12px system-ui;cursor:pointer}.tabs button[aria-pressed=true]{background:#24292f;color:#fff;border-color:#24292f}.palette-note{color:var(--muted);font-size:12px}.swatches{display:flex;gap:10px;flex-wrap:wrap;padding:8px 12px;border-bottom:1px solid var(--line);color:var(--muted);font-size:11px}.swatches span{display:flex;align-items:center;gap:4px}.swatches i{width:9px;height:9px;border-radius:2px}.panes{display:grid;grid-template-columns:repeat(2,minmax(0,1fr))}.pane{min-width:0;overflow:hidden}.pane:first-child{border-right:1px solid var(--line)}.pane-label{padding:8px 12px;border-bottom:1px solid var(--line);background:#fafafa;color:var(--muted);font:600 11px ui-monospace,SFMono-Regular,Menlo,monospace;text-transform:uppercase}.code-scroll{max-height:calc(100vh - 205px);min-height:620px;overflow:auto;background:var(--added)}.code{min-width:max-content;padding:8px 0;font:14px/1.5 ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;font-variant-ligatures:none}.code-line{display:grid;grid-template-columns:42px minmax(max-content,1fr);min-height:22px}.code-line:hover{background:#dcfce7}.line-number{padding:0 8px;color:#758195;text-align:right;user-select:none;border-right:1px solid var(--added-line)}code{display:block;padding:0 11px;white-space:pre;color:var(--variable)}.tok-keyword{color:var(--keyword);font-weight:650}.tok-call{color:var(--call)}.tok-type{color:var(--type)}.tok-literal{color:var(--literal)}.tok-variable{color:var(--variable)}.tok-punctuation{color:var(--punctuation)}.tok-comment{color:var(--comment);font-style:italic}${paletteRules}@media(max-width:950px){header,main{padding-left:12px;padding-right:12px}.toolbar{align-items:flex-start;flex-direction:column}.panes{grid-template-columns:1fr}.pane:first-child{border-right:0;border-bottom:1px solid var(--line)}.code-scroll{max-height:560px;min-height:360px}}
</style>
</head>
<body>
<header><h1>Softer code palette comparison</h1><p>The pseudocode and exact TypeScript use the same token colors in each option.</p><div class="breadcrumb">${escapeHtml(card.file)} · ${escapeHtml(card.symbol)}</div></header>
<main>
<section class="review palette-${palettes[0].id}" id="review">
  <div class="toolbar"><div class="tabs">${palettes.map((palette, index) => `<button data-palette="${palette.id}" aria-pressed="${index === 0}">${palette.name}</button>`).join('')}</div><span class="palette-note" id="palette-note">${palettes[0].description}</span></div>
  <div class="swatches">${swatches()}</div>
  <div class="panes">
    <section class="pane pseudo-pane"><div class="pane-label">Pseudocode</div><div class="code-scroll"><div class="code">${rows(pseudoLines)}</div></div></section>
    <section class="pane source-pane"><div class="pane-label">Exact TypeScript</div><div class="code-scroll"><div class="code">${rows(sourceLines)}</div></div></section>
  </div>
</section>
</main>
<script>
const palettes=${JSON.stringify(paletteData)};
const review=document.getElementById('review');
document.querySelectorAll('[data-palette]').forEach(button=>button.addEventListener('click',()=>{
  const palette=palettes[button.dataset.palette];
  review.className='review palette-'+palette.id;
  document.querySelectorAll('[data-palette]').forEach(item=>item.setAttribute('aria-pressed',String(item===button)));
  document.getElementById('palette-note').textContent=palette.description;
}));
</script>
</body>
</html>`;

const output = path.resolve(outputInput);
fs.mkdirSync(path.dirname(output), { recursive: true });
fs.writeFileSync(output, html);
process.stdout.write(
  `${JSON.stringify({ output, symbol: card.symbol, pseudocodeLines: pseudoLines.length, sourceLines: sourceLines.length, palettes: palettes.length })}\n`,
);
