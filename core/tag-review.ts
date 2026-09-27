import type { Inventory } from "./tags";

/** Private, self-contained authoring interface. Never copied into the public site. */
export function renderTagReview(inventory: Inventory, selected = "") {
  const generatedAt = new Date().toISOString();
  const data = JSON.stringify({ ...inventory, selected }).replaceAll(
    "<",
    "\\u003c",
  );
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex,nofollow"><title>Tag review · Notes Along the Way</title>
<link rel="icon" href="data:,"><style>
:root{color-scheme:light;--ink:#24221f;--muted:#635f59;--line:#d9d4ca;--blue:#164b88;--paper:#faf8f3}*{box-sizing:border-box}
body{margin:0;background:var(--paper);color:var(--ink);font:16px/1.5 system-ui,sans-serif}main{max-width:1150px;margin:auto;padding:36px 28px 70px}h1,h2{font-family:Georgia,serif;font-weight:400;line-height:1.2}h1{font-size:42px;margin:10px 0}h2{font-size:28px;margin:0 0 15px}.eyebrow{color:var(--blue);font-size:13px;letter-spacing:.06em}p{max-width:78ch}.muted,small{color:var(--muted)}.summary{display:flex;gap:14px;flex-wrap:wrap;margin:28px 0}.summary div{border:1px solid var(--line);border-radius:6px;padding:14px 20px;min-width:125px}.summary strong{display:block;font:32px Georgia,serif}.controls{display:flex;gap:18px;flex-wrap:wrap;margin:24px 0}label{display:grid;gap:6px;font-size:14px}.search{flex:1;min-width:200px}input,select{font:inherit;color:var(--ink);background:white;border:1px solid #aaa397;padding:10px;border-radius:4px;max-width:100%}button{font:inherit;color:var(--blue);border:0;background:none;cursor:pointer;text-decoration:underline;text-underline-offset:3px;padding:2px 0;text-align:left}button:hover{color:var(--ink)}:focus-visible{outline:3px solid #8bafe0;outline-offset:3px}.table-wrap{overflow:auto}table{border-collapse:collapse;width:100%;font-size:14px}th{text-align:left;font-weight:600;white-space:nowrap}td,th{padding:14px 12px;border-bottom:1px solid var(--line);vertical-align:top}td:first-child{min-width:240px}td:last-child{min-width:170px}td p{margin:5px 0}.key{font:12px ui-monospace,monospace;overflow-wrap:anywhere}.count{font-variant-numeric:tabular-nums}.badge{display:inline-block;font-size:12px;color:#765421;margin-left:7px}#review{border:1px solid var(--line);padding:24px;margin:36px 0;background:white;border-radius:6px}#review select{width:100%;max-width:640px}#piece-info{overflow-wrap:anywhere}#findings li{margin:9px 0}#findings strong{text-transform:capitalize}details{margin-top:8px}summary{cursor:pointer}details ul{padding-left:18px}code{font-size:13px}#empty{padding:24px;border:1px solid var(--line)}.piece-links{list-style:none;padding:0;margin:0}.piece-links li{margin:6px 0}a{color:var(--blue)}@media(max-width:600px){main{padding:22px 16px 45px}h1{font-size:34px}.summary{gap:8px}.summary div{flex:1;min-width:100px;padding:12px}.controls>label{width:100%}#review{padding:18px}table,tbody,tr,td{display:block}thead{display:none}tr{border-top:1px solid var(--line);padding:12px 0}td{border:0;padding:5px 0;min-width:0!important}td.count{display:inline-block;margin-right:18px}td.count:before{content:attr(data-label) ": ";color:var(--muted)}.table-wrap{overflow:visible}}
</style></head><body><main>
<header><div class="eyebrow">NOTES ALONG THE WAY · PRIVATE AUTHORING</div><h1>Tag review</h1><p class="muted">Find a useful existing tag before creating another. Counts describe distinct source pieces, not page views or verified live publications.</p><p class="muted">Snapshot: ${generatedAt}</p></header>
<section class="summary" aria-label="Inventory totals" id="totals"></section>
<section id="review" aria-labelledby="review-heading"><h2 id="review-heading">Review a piece</h2><label>Piece<select id="piece" aria-label="Piece"><option value="">Choose a piece…</option></select></label><div id="piece-info"></div><ul id="findings"></ul><p class="muted">Suggestions need editorial judgment. This review never changes tags automatically.</p></section>
<section aria-labelledby="inventory-heading"><h2 id="inventory-heading">Existing vocabulary</h2><div class="controls"><label class="search">Search tags, scope, aliases, or piece titles<input id="search" type="search" placeholder="Try Python or information"></label><label>Usage<select id="status" aria-label="Usage"><option value="active">Published + drafts</option><option value="published">Published</option><option value="draft">Draft</option><option value="retired">Retired</option><option value="all">All, including unused</option></select></label><label>Sort<select id="sort" aria-label="Sort"><option value="name">Name</option><option value="usage">Most used</option></select></label></div>
<p id="result-count" role="status" aria-live="polite"></p><div class="table-wrap"><table><thead><tr><th>Tag and scope</th><th>Published</th><th>Draft</th><th>Retired</th><th>Pieces</th></tr></thead><tbody id="rows"></tbody></table></div><p id="empty" hidden>No matching tags. Try a broader term or include unused tags.</p></section>
<details><summary>Included sources and counting rules</summary><p>Each piece ID counts once per tag. Aliases and spelling/case variants use the same counter. Conflicting copies stop report generation. Collection subjects and repeated placements are not counted as article tags.</p><ul id="sources"></ul><p>Only the selected sources are included. Regenerate this review after changing content.</p></details>
</main><script id="inventory-data" type="application/json">${data}</script><script>
const inventory = JSON.parse(document.getElementById('inventory-data').textContent);
const byId = new Map(inventory.pieces.map(p => [p.id,p]));
const get = id => document.getElementById(id);
const el = (tag,text,cls) => { const e=document.createElement(tag); if(text!==undefined)e.textContent=text;if(cls)e.className=cls;return e; };
const state = {query:'',status:'active',sort:'name'};
const count = row => state.status==='active' ? row.published+row.draft : state.status==='all' ? row.published+row.draft+row.retired : row[state.status];
for(const status of ['published','draft','retired']) {const box=el('div');box.append(el('strong',String(inventory.pieces.filter(p=>p.status===status).length)),el('span',status==='draft'?'Draft pieces':status==='published'?'Published pieces':'Retired pieces'));get('totals').append(box);}
for(const p of inventory.pieces){const option=el('option',p.title+' · '+p.status);option.value=p.id;get('piece').append(option);for(const source of p.sources)get('sources').append(el('li',source));}
function selectPiece(id,scroll=false){
 get('piece').value=id;get('piece-info').replaceChildren();get('findings').replaceChildren();
 const p=byId.get(id);if(!p)return;
 get('piece-info').append(el('p',p.summary),el('p',p.id+' · '+p.status,'key'),el('p','Assigned tags: '+(p.tags.join(', ')||'None')));
 for(const source of p.sources)get('piece-info').append(el('p',source,'key'));
 const findings=inventory.reviews[id];
 if(!findings.length)get('findings').append(el('li',p.tags.length?'No naming or reuse issues found. Confirm that each tag fits the content.':'No tags assigned. Search the vocabulary below for relevant topics.'));
 for(const f of findings){const li=el('li');li.append(el('strong',f.kind.replaceAll('-',' ') + ': '),document.createTextNode(f.message));get('findings').append(li);}
 history.replaceState(null,'','#piece='+encodeURIComponent(id));
 if(scroll){get('review').scrollIntoView({behavior:'auto'});get('piece').focus({preventScroll:true});}
}
function render(){
 const query=state.query.trim().toLowerCase();
 let rows=inventory.rows.filter(r=>(state.status==='all'||count(r)>0)&&[r.id,r.label,r.description,...r.aliases,...r.pieces.map(id=>byId.get(id).title)].join(' ').toLowerCase().includes(query));
 rows.sort((a,b)=>state.sort==='usage'?count(b)-count(a)||a.label.localeCompare(b.label):a.label.localeCompare(b.label));
 get('rows').replaceChildren();
 for(const r of rows){const tr=el('tr');tr.dataset.tag=r.id;const name=el('td');name.append(el('strong',r.label));if(!r.registered)name.append(el('span','Not registered','badge'));name.append(el('p',r.id,'key'),el('p',r.description,'muted'));if(r.aliases.length)name.append(el('small','Aliases: '+r.aliases.join(', ')));tr.append(name);
  for(const s of ['published','draft','retired']){const td=el('td',String(r[s]),'count');td.dataset.label=s[0].toUpperCase()+s.slice(1);tr.append(td);}
  const uses=el('td'),list=el('ul',undefined,'piece-links');
  for(const id of r.pieces){const p=byId.get(id);if(state.status==='active'&&p.status==='retired'||!['all','active'].includes(state.status)&&p.status!==state.status)continue;const li=el('li'),button=el('button',p.title);button.type='button';button.addEventListener('click',()=>selectPiece(id,true));li.append(button,el('small',' · '+p.status));list.append(li);}
  uses.append(list.childElementCount?list:el('span','No pieces in this view','muted'));tr.append(uses);get('rows').append(tr);
 }
 get('result-count').textContent=rows.length+' tag'+(rows.length===1?'':'s')+' shown';get('empty').hidden=rows.length!==0;
}
get('search').addEventListener('input',e=>{state.query=e.target.value;render();});
get('status').addEventListener('change',e=>{state.status=e.target.value;render();});
get('sort').addEventListener('change',e=>{state.sort=e.target.value;render();});
get('piece').addEventListener('change',e=>selectPiece(e.target.value));
const initial=new URLSearchParams(location.hash.slice(1)).get('piece')||inventory.selected;
if(byId.has(initial))selectPiece(initial);render();
</script></body></html>`;
}
