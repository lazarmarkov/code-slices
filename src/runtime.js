import {File,FileDiff} from 'https://esm.sh/@pierre/diffs@1.2.10?bundle';
const data=JSON.parse(document.getElementById('review-data').textContent);
const theme={light:'github-light',dark:'github-dark'};
const options={theme,themeType:'light',overflow:'wrap',disableFileHeader:true};
const state={revision:localStorage.getItem('code-slices-revision')||'after',mode:localStorage.getItem('code-slices-view')||'pseudo'};
if(!['after','before','changes'].includes(state.revision))state.revision='after';
if(!['pseudo','split'].includes(state.mode))state.mode='pseudo';
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const pathLink=(file,line,rev='after')=>(data.repositoryURL?data.repositoryURL.replace(/\/$/,'')+'/blob/':'#')+(rev==='before'?data.base:data.head)+'/'+file+'#L'+line;
const makeFile=(container,name,contents)=>new File(options).render({containerWrapper:container,file:{name,contents}});
const makeDiff=(container,name,before,after)=>new FileDiff({...options,diffStyle:'split'}).render({containerWrapper:container,oldFile:{name,contents:before||''},newFile:{name,contents:after||''}});
function rootOf(container){return container?.querySelector('diffs-container')?.shadowRoot}
function range(root,lines){return lines.flatMap(line=>[...root.querySelectorAll('[data-line="'+line+'"],[data-column-number="'+line+'"]')])}
function numbers(r){return Array.from({length:r[1]-r[0]+1},(_,i)=>r[0]+i)}
function decorate(root){const style=document.createElement('style');style.textContent='[data-paired]{background:#dcfce7!important;box-shadow:inset 3px 0 #16a34a}';root.append(style)}
function closePreviews(){document.querySelectorAll('.source-preview').forEach(n=>n.remove())}
function preview(card,source,mapping){
 closePreviews();const pane=card.querySelector('.source-pane');if(state.mode!=='split'||!pane)return;
 const rect=pane.getBoundingClientRect();const overlay=document.createElement('section');overlay.className='source-preview';
 const start=Math.max(1,mapping.source[0]-2),end=Math.min(source.code.split('\n').length,mapping.source[1]+2);
 const abs=source.line+mapping.source[0]-1;overlay.style.left=Math.max(8,rect.left)+'px';overlay.style.width=Math.min(rect.width,innerWidth-rect.left-12)+'px';overlay.style.top='90px';
 overlay.innerHTML='<div class="preview-header"><a target="_blank" href="'+pathLink(card.dataset.file,abs,state.revision)+'">'+esc(card.dataset.symbol)+' · '+esc(card.dataset.file)+':'+abs+'</a><button aria-label="Close source preview">Close</button></div><div class="muted">Excerpt starts at source line '+(source.line+start-1)+'</div><div class="preview-code"></div>';
 card.append(overlay);overlay.querySelector('button').onclick=()=>overlay.remove();const container=overlay.querySelector('.preview-code');makeFile(container,card.dataset.file,source.code.split('\n').slice(start-1,end).join('\n'));
 requestAnimationFrame(()=>{const root=rootOf(container);if(!root)return;decorate(root);for(const n of range(root,numbers(mapping.source).map(n=>n-start+1)))n.setAttribute('data-paired','');});
}
function attachPair(card,source,mappings){
 const pseudo=rootOf(card.querySelector('.pseudo-code')),original=rootOf(card.querySelector('.source-code'));if(!pseudo||!original)return;
 decorate(pseudo);decorate(original);
 const style=document.createElement('style');style.textContent='[data-line="1"],[data-line="1"] *{font-family:system-ui,sans-serif!important;font-style:italic;color:#686868!important}[data-line="1"]{padding-bottom:4px}';pseudo.append(style);
 const align=document.createElement('style');align.textContent='[data-line="1"],[data-column-number="1"]{margin-top:calc(1lh + 4px)}';original.append(align);
 pseudo.querySelector('[data-line="1"]')?.setAttribute('title','Describes the conditions and outcome followed in this example. The pseudocode hides parts of the function not exercised by this example.');
 const clear=()=>{for(const root of [pseudo,original])root.querySelectorAll('[data-paired]').forEach(n=>n.removeAttribute('data-paired'));};
 for(const [root,side] of [[pseudo,'pseudo'],[original,'source']])root.addEventListener('pointerover',e=>{
 const row=e.target.closest?.('[data-line],[data-column-number]');if(!row)return;const line=Number(row.dataset.line||row.dataset.columnNumber);clear();closePreviews();
 const matched=(mappings||[]).filter(m=>{const r=m[side];return r&&line>=(side==='pseudo'?r[0]+1:r[0])&&line<=(side==='pseudo'?r[1]+1:r[1]);});
 for(const m of matched){for(const n of range(pseudo,numbers(m.pseudo).map(n=>n+1)))n.setAttribute('data-paired','');if(m.source)for(const n of range(original,numbers(m.source)))n.setAttribute('data-paired','');}
 if(side==='pseudo'&&matched.length){const m=matched.find(m=>m.source&&numbers(m.source).some(n=>{const r=original.querySelector('[data-line="'+n+'"]')?.getBoundingClientRect();return !r||r.top<65||r.bottom>innerHeight-65;}));if(m)preview(card,source,m);}
 });card.addEventListener('pointerleave',()=>{clear();closePreviews()});
}
function rawDiff(details,file){let rendered=false;details.addEventListener('toggle',()=>{if(!details.open||rendered)return;rendered=true;makeDiff(details.querySelector('.raw-diff'),file.path,file.before,file.after);});}
function renderIndex(){
 const el=document.getElementById('coverage-content');el.innerHTML='<table><thead><tr><th>File / changed functions</th><th>Coverage</th></tr></thead><tbody>'+data.files.map((f,i)=>'<tr><td><details id="file-'+i+'"><summary class="file-name">'+esc(f.path)+'</summary><p>'+esc(f.note)+'</p><div class="raw-diff"></div></details>'+(f.changed.length?'<ul class="inventory">'+f.changed.map(s=>'<li>'+(s.card?'<a href="#'+s.card+'">'+esc((s.className?s.className+'.':'')+s.symbol)+'</a>':'<span>'+esc((s.className?s.className+'.':'')+s.symbol)+' <span class="muted">'+(s.removed?'removed · ':'')+'not covered by a slice</span></span>')+'</li>').join('')+'</ul>':'')+'</td><td>'+f.flows.map(id=>'<a href="#'+id+'">'+esc(data.flows.find(x=>x.id===id).title)+'</a>').join('<br>')+(f.flows.length?'':'<span class="muted">'+esc(f.category)+'</span>')+'</td></tr>').join('')+'</tbody></table>';
 data.files.forEach((f,i)=>rawDiff(document.getElementById('file-'+i),f));
 const structural=document.getElementById('structural-content');structural.innerHTML=data.files.filter(f=>f.category==='Structural/support review').map(f=>'<p><a href="#file-'+data.files.indexOf(f)+'" class="file-name">'+esc(f.path)+'</a><br>'+esc(f.note)+'</p>').join('');
}
function renderFlows(){
 closePreviews();document.body.classList.toggle('split',state.mode==='split');const el=document.getElementById('flows');el.replaceChildren();
 for(const [index,flow] of data.flows.entries()){
 const section=document.createElement('section');section.id=flow.id;section.className='flow-heading';section.innerHTML='<h2>'+String(index+1).padStart(2,'0')+' '+esc(flow.title)+'</h2><p>'+esc(flow.description)+'</p><a class="back" href="#coverage">↑ Changed-code index</a><div class="flow-tree"></div><div class="type-layer"></div>';el.append(section);
 const tree=state.revision==='before'?(flow.treeBefore||'Before this PR: '+(flow.cards.some(c=>c.before)?'see the existing function implementations below.':'these model APIs do not exist.')):flow.tree;
 makeFile(section.querySelector('.flow-tree'),flow.id+'.call-tree.txt',tree);
 const typeRev=state.revision==='before'?'base':'head';const content=flow.tree+' '+flow.cards.map(c=>c.after).join(' ');for(const [name,type] of Object.entries(data.types[typeRev]))if(new RegExp('\\b'+name+'\\b').test(content)){const entry=document.createElement('div');section.querySelector('.type-layer').append(entry);makeFile(entry,type.file+' · '+name,type.code);}
 for(const c of flow.cards){const card=document.createElement('article');card.id=c.id;card.className='fn';card.dataset.file=c.file;card.dataset.symbol=c.symbol;const rev=state.revision==='before'?'before':'after',source=rev==='before'?c.sourceBefore:c.sourceAfter;const pseudo=rev==='before'?c.before:c.after;const gauge=rev==='before'?c.visibilityBefore:c.visibilityAfter;
 card.innerHTML='<div class="fn-header"><a target="_blank" href="'+pathLink(c.file,source?.line||c.sourceAfter.line,source?rev:'after')+'">'+esc(c.file)+':'+(source?.line||c.sourceAfter.line)+'</a><span class="tag">'+c.status+'</span>'+(state.revision!=='changes'&&gauge?.show?'<span class="gauge" title="'+gauge.hidden+' of '+gauge.total+' nonblank, non-Logger.log source lines have no mapping. This estimates representation, not execution coverage."><span class="dot"></span>'+gauge.percent+'% hidden · '+gauge.hidden+' LoC</span>':'')+'</div><div class="panes"><div class="code-pane"><div class="pane-label">'+(state.revision==='changes'?'Pseudocode changes':'Pseudocode')+'</div><div class="code pseudo-code"></div></div><div class="code-pane source-pane"><div class="pane-label">'+(state.revision==='changes'?'Source changes':'Original source')+'</div><div class="code source-code"></div></div></div><div class="fn-footer"><span class="muted">'+esc(c.change||c.note||'')+'</span></div>';el.append(card);
 const pseudoNode=card.querySelector('.pseudo-code'),sourceNode=card.querySelector('.source-code');
 if(state.revision==='changes'){makeDiff(pseudoNode,c.symbol+'.pseudo.ts',c.before,c.after);makeDiff(sourceNode,c.file,c.sourceBefore?.code,c.sourceAfter.code);}
 else if(!source||pseudo===null||pseudo===undefined){pseudoNode.innerHTML='<div class="empty">Added in this PR. No Before implementation.</div>';sourceNode.innerHTML='<div class="empty">This function did not exist at the base revision.</div>';}
 else {makeFile(pseudoNode,c.symbol+'.pseudo.ts','▹ '+(rev==='before'?(c.scenarioBefore||c.scenario):c.scenario)+'\n'+pseudo);makeFile(sourceNode,c.file,source.code);requestAnimationFrame(()=>attachPair(card,source,rev==='before'?c.mappingsBefore:c.mappingsAfter));}
 }
 }
 document.querySelectorAll('[data-revision]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.revision===state.revision)));document.querySelectorAll('[data-mode]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.mode===state.mode)));document.documentElement.dataset.ready='true';
}
document.querySelectorAll('[data-revision]').forEach(b=>b.onclick=()=>{state.revision=b.dataset.revision;localStorage.setItem('code-slices-revision',state.revision);renderFlows()});document.querySelectorAll('[data-mode]').forEach(b=>b.onclick=()=>{state.mode=b.dataset.mode;localStorage.setItem('code-slices-view',state.mode);renderFlows()});
window.addEventListener('keydown',e=>{if(e.key==='Alt')document.body.classList.add('types-expanded');if(e.key==='Escape')closePreviews()});window.addEventListener('keyup',e=>{if(e.key==='Alt'||!e.altKey)document.body.classList.remove('types-expanded')});window.addEventListener('blur',()=>document.body.classList.remove('types-expanded'));
renderIndex();renderFlows();
