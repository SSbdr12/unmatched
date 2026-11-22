// Unmatched Table for Vercel: api/index.js. Needs an Upstash Redis store (env KV_REST_API_URL / KV_REST_API_TOKEN).
const U=process.env.KV_REST_API_URL||process.env.UPSTASH_REDIS_REST_URL,TK=process.env.KV_REST_API_TOKEN||process.env.UPSTASH_REDIS_REST_TOKEN,KEY=process.env.ADMIN_KEY||'';
const R=async(...c)=>{const j=await(await fetch(U,{method:'POST',headers:{Authorization:'Bearer '+TK},body:JSON.stringify(c)})).json();if(j.error)throw new Error(j.error);return j.result};
const slug=s=>String(s||'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');
const all=async k=>{const ids=await R('SMEMBERS',k);if(!ids.length)return[];return(await R('MGET',...ids.map(i=>k+':'+i))).filter(Boolean).map(s=>JSON.parse(s))};
const put=(k,o)=>Promise.all([R('SET',k+':'+o.id,JSON.stringify(o)),R('SADD',k,o.id)]);
const getDeck=async id=>{const s=await R('GET','decks:'+slug(id));return s?JSON.parse(s):null};
const T=(count,type,value,boost,title,text)=>({count,type,value,boost,title,text});
async function getLib(){let d=await all('decks'),m=await all('maps');
  if(!d.length){d=[{id:'sample-hero',name:'Sample Hero',color:'#7a3b8f',hero:{name:'Sample Hero',hp:16,move:2},side:{name:'Squire',hp:1,count:1},cards:[T(4,'a',4,2,'Heavy Blow','Deal damage equal to value if not blocked.'),T(4,'d',3,1,'Parry','Prevent damage equal to value.'),T(5,'v',2,2,'Quick Feint','Use as attack or defense.'),T(3,'s',0,1,'Rally','Draw 2 cards.'),T(3,'a',2,3,'Lunge','Attack from 2 spaces away.')]}];await put('decks',d[0])}
  if(!m.length){m=[{id:'sample-arena',name:'Sample Arena',zones:[[15,20],[40,15],[65,20],[85,30],[20,50],[50,50],[80,60],[15,80],[45,82],[75,85]],links:[[0,1],[1,2],[2,3],[0,4],[1,5],[2,5],[3,6],[4,5],[5,6],[4,7],[5,8],[6,9],[7,8],[8,9]]}];await put('maps',m[0])}
  if(!(await R('GET','seed:leshen'))){await R('SET','seed:leshen','1');if(!d.find(x=>x.id==='ancient-leshen')){const l={id:'ancient-leshen',name:'Ancient Leshen',color:'#3f6b3a',hero:{name:'Ancient Leshen',hp:13,move:1},side:{name:'Wolf',hp:1,count:2,move:3},cards:[]};await put('decks',l);d.push(l)}}
  return{decks:d,maps:m}}
const uid=()=>Math.random().toString(36).slice(2,9);
const shuffle=a=>{for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]]}return a};
const makeDeck=d=>{const o=[];d.cards.forEach((c,i)=>{for(let k=0;k<(c.count||1);k++)o.push({u:uid(),d:d.id,i})});return shuffle(o)};

function view(r,pid){
  const me=r.players.findIndex(p=>p.pid===pid);
  return{v:r.v,decks:r.decks,code:r.code,map:r.map,turn:r.turn,me,log:r.log.slice(-40),pieces:r.pieces,
    players:r.players.map((p,i)=>({name:p.name,color:p.color,deckId:p.deckId,hc:p.hand.length,dc:p.deck.length,discard:p.discard,pips:p.pips,
      played:p.played.map(x=>(x.up||i===me)?x:{u:x.u,d:x.d,hidden:true})})),
    hand:me>=0?r.players[me].hand:[]};
}
function act(r,pid,a,deck){
  let pi=r.players.findIndex(p=>p.pid===pid),p=r.players[pi];
  const L=t=>{r.log.push(t);if(r.log.length>100)r.log.shift()};
  const take=(z,u)=>{const i=z.findIndex(c=>c.u===u);return i<0?null:z.splice(i,1)[0]};
  const nm=c=>{const d=r.decks[c.d];return d&&d.cards[c.i]?d.cards[c.i].title:'a card'};
  if(a.t==='join'&&!p){
    if(r.players.length>=4)return;const d=deck;if(!d)return;r.decks[d.id]=d;
    p={pid,name:String(a.name||'Player').slice(0,16),color:String(a.color||'#e0b040'),deckId:d.id,hand:[],deck:makeDeck(d),discard:[],played:[],pips:2};
    pi=r.players.length;r.players.push(p);
    const ps=[{k:'h',n:d.hero.name,img:d.hero.img,hp:d.hero.hp}],sc=d.side?(d.side.count===undefined?1:d.side.count):0;
    for(let k=0;k<sc;k++)ps.push({k:'s',n:d.side.name,img:d.side.img,hp:d.side.hp});
    ps.forEach((s,k)=>r.pieces.push({id:uid(),o:pi,k:s.k,n:s.n,img:s.img,hp:s.hp,max:s.hp,x:12+pi*22,y:18+k*12}));
    for(let k=0;k<5;k++)if(p.deck.length)p.hand.push(p.deck.pop());
    L(p.name+' joined as '+d.hero.name);return;
  }
  if(!p)return;
  const dis=(c)=>{delete c.up;p.discard.push(c)};
  switch(a.t){
    case'draw':{const n=Math.min(+a.n||1,10);for(let k=0;k<n;k++)if(p.deck.length)p.hand.push(p.deck.pop());L(p.name+' drew '+n);break}
    case'play':{const c=take(p.hand,a.u);if(!c)return;c.up=a.down!=='1';p.played.push(c);L(c.up?p.name+' played '+nm(c):p.name+' played a card face-down');break}
    case'flip':{const c=p.played.find(c=>c.u===a.u);if(c){c.up=!c.up;if(c.up)L(p.name+' revealed '+nm(c))}break}
    case'back':{const c=take(p.played,a.u);if(c){delete c.up;p.hand.push(c)}break}
    case'disc':{const c=take(a.z==='p'?p.played:p.hand,a.u);if(c){dis(c);L(p.name+' discarded '+nm(c))}break}
    case'take':{const c=take(p.discard,a.u);if(c)p.hand.push(c);break}
    case'shuf':{if(a.all)p.deck.push(...p.discard.splice(0));shuffle(p.deck);L(p.name+' shuffled'+(a.all?' (with discard)':''));break}
    case'clear':{p.played.splice(0).forEach(dis);L(p.name+' cleared played cards');break}
    case'move':{const q=r.pieces.find(x=>x.id===a.id);if(q){q.x=Math.max(0,Math.min(100,+a.x));q.y=Math.max(0,Math.min(100,+a.y))}break}
    case'hp':{const q=r.pieces.find(x=>x.id===a.id);if(q){q.hp=Math.max(0,Math.min(q.max,q.hp+(+a.d||0)));L(q.n+' HP '+q.hp+'/'+q.max)}break}
    case'turn':{r.turn=(r.turn+1)%r.players.length;r.players[r.turn].pips=2;L('Turn: '+r.players[r.turn].name);break}
    case'pip':p.pips=Math.max(0,Math.min(2,+a.v));break;
    case'chat':L(p.name+': '+String(a.m||'').slice(0,200));break;
    case'map':r.map=String(a.id);break;
  }
}

const HTML_CSS=`
:root{--bg:#151a25;--pn:#202738;--ln:#344058;--tx:#e9e5db}
*{box-sizing:border-box}body{margin:0;height:100vh;display:flex;flex-direction:column;background:var(--bg);color:var(--tx);font:14px/1.4 "Trebuchet MS",system-ui,sans-serif}
button,input,select,textarea{font:inherit;color:inherit;background:#2b3550;border:1px solid var(--ln);border-radius:6px;padding:4px 9px}
button{cursor:pointer}button:hover{background:#3a4a74}button:disabled{opacity:.5;cursor:default}button.on{background:#e0b040;color:#111}
a{color:#8fb4ff;cursor:pointer}.c{text-align:center;margin:20vh 0}
#app{display:flex;flex-direction:column;flex:1;min-height:0}
header{display:flex;gap:10px;align-items:center;padding:6px 10px;background:var(--pn);flex-wrap:wrap}
main{flex:1;min-height:0;display:grid;grid-template-columns:1fr 340px;gap:10px;padding:8px}
.bw{display:flex;align-items:center;justify-content:center;min-height:0}
#bd{position:relative;width:min(100%,calc((100vh - 380px)*1.4));aspect-ratio:7/5;background:#25304a center/100% 100%;border:2px solid var(--ln);border-radius:8px}
#bd svg{position:absolute;inset:0;width:100%;height:100%}#bd line{stroke:#ffffff40;stroke-width:.6}
.z{position:absolute;width:9%;aspect-ratio:1;border-radius:50%;border:2px solid #ffffff55;background:#ffffff14;transform:translate(-50%,-50%)}
.pc{position:absolute;width:6.5%;aspect-ratio:1;transform:translate(-50%,-50%);border:3px solid;border-radius:50%;background:#2c3550 center/cover;display:grid;place-items:center;font-weight:bold;cursor:grab;touch-action:none;user-select:none}
.pc.h{width:8%;border-width:5px}.pc s{position:absolute;bottom:-6px;right:-6px;background:#000c;border-radius:9px;padding:0 5px;font-size:11px;text-decoration:none}
#side{overflow-y:auto;display:flex;flex-direction:column;gap:8px}
.pn{background:var(--pn);border:2px solid;border-radius:8px;padding:6px 8px}.st{font-size:12px;opacity:.85}
.pips{display:flex;gap:4px;align-items:center;font-size:12px}.pips button{padding:0 7px}
.wh{display:flex;align-items:center;gap:3px;font-size:12px}.wh svg{width:52px;height:52px}.wh button{padding:0 8px}
.tr,.ar{fill:none;stroke-width:8}.tr{stroke:#34405c}.wh text{fill:#fff;font:bold 22px sans-serif;text-anchor:middle}
.pl{display:flex;flex-wrap:wrap;gap:6px;margin-top:6px}.pc2 .bt{display:flex;gap:2px}.pc2 .bt button{padding:0 4px;font-size:10px}
.pl .card:hover{transform:scale(2.4);transform-origin:100% 0;z-index:9;position:relative}
#lg{background:#0003;border-radius:8px;padding:6px;height:130px;overflow-y:auto;font-size:12px}
footer{background:var(--pn);padding:4px 10px}.tools{display:flex;gap:6px;flex-wrap:wrap;padding:4px 0}
#hand{display:flex;gap:8px;overflow-x:auto;padding:80px 10px 4px;min-height:270px}.hc{flex:none}.hc .bt{display:flex;gap:3px;margin-top:3px}.hc .bt button{padding:1px 7px;font-size:12px}
.hc .card:hover{transform:scale(1.45);transform-origin:50% 100%;z-index:9;position:relative}
.card{--t:#888;position:relative;font-size:10px;width:12em;height:17em;flex:none;border:.4em solid var(--t);border-radius:.9em;background:#f2e9d5;color:#1d1d1d;padding:2.8em .7em 1.8em;overflow:hidden;display:flex;flex-direction:column;gap:.2em;transition:transform .1s}
.card.sm{font-size:6.5px}.card h4{margin:0;font-size:1.15em;line-height:1.1}.card em{font-size:.9em;color:var(--t);font-style:normal;font-weight:bold}.card p{margin:0;font-size:.95em;line-height:1.25}
.card img{width:100%;height:5em;object-fit:cover;border-radius:.3em}
.card .v,.card .b{position:absolute;min-width:2.2em;height:2.2em;border-radius:50%;background:var(--t);color:#fff;font:bold 1.3em/2.2em sans-serif;text-align:center}.card .v{left:.3em;top:.3em}.card .b{right:.3em;bottom:.3em}
.card small{position:absolute;left:.7em;bottom:.5em;font-size:.8em;opacity:.7}.card.fd{opacity:.65;outline:2px dashed #fff}
.back{background:repeating-linear-gradient(45deg,var(--c,#555) 0 8px,#0003 8px 16px);border-color:#eee;display:grid;place-items:center;padding:0}.back b{font-size:3.5em;color:#fff9}
.lob,.lib{max-width:900px;margin:8vh auto;padding:0 14px;display:flex;flex-direction:column;gap:12px}.lib{margin:10px auto;overflow-y:auto}
.lib label{display:flex;flex-direction:column;gap:2px;margin:6px 0}.lib textarea{min-height:200px;font-family:monospace;font-size:12px}
.modal{position:fixed;inset:0;background:#000b;display:flex;flex-wrap:wrap;gap:8px;padding:30px;overflow:auto;align-content:flex-start}
`;

function client(){
  const $=s=>document.querySelector(s);
  const esc=s=>String(s==null?'':s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
  let lib={decks:[],maps:[]},S=null,es,modal=null,screen='lobby',ed=null,room=location.hash.slice(1).toUpperCase();
  const pid=localStorage.pid||(localStorage.pid=Math.random().toString(36).slice(2)+Date.now().toString(36));
  let key=sessionStorage.key||'';
  const F={name:localStorage.nm||'',deck:'',color:'#e0b040',code:''};
  const api=(p,b)=>fetch(p,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(Object.assign({},b,{key}))}).then(r=>r.json());
  const admin=async(p,b)=>{let r=await api(p,b);if(r.err==='key'){key=prompt('Admin key')||'';sessionStorage.key=key;r=await api(p,b)}return r};
  const send=a=>api('/api?r=act',{room,pid,a}).then(()=>poll());
  const dk=id=>(S&&S.decks&&S.decks[id])||lib.decks.find(d=>d.id===id);
  const TC={a:'#c4473a',d:'#3b6fb4',v:'#d4a03a',s:'#4d9a5c'},TN={a:'Attack',d:'Defense',v:'Versatile',s:'Scheme'};
  const col=o=>S.players[o]?S.players[o].color:'#888';

  function card(c,sm,own){
    const d=dk(c.d);if(!d)return'<div class="card back"></div>';
    if(c.hidden)return'<div class="card back'+(sm?' sm':'')+'" style="--c:'+esc(d.color)+'"><b>'+esc((d.hero.name||'?')[0])+'</b></div>';
    const k=d.cards[c.i];if(!k)return'';
    return'<div class="card'+(sm?' sm':'')+(own&&!c.up?' fd':'')+'" style="--t:'+TC[k.type]+'">'+(k.img?'<img src="'+esc(k.img)+'">':'')+(k.type==='s'?'':'<i class=v>'+k.value+'</i>')+'<h4>'+esc(k.title)+'</h4><em>'+TN[k.type]+'</em><p>'+esc(k.text)+'</p><i class=b>'+k.boost+'</i><small>'+esc(d.hero.name)+'</small></div>';
  }
  function wheel(p){
    const C=163.4,f=p.max?p.hp/p.max:0;
    return'<div class=wh><button data-t=hp data-id='+p.id+' data-d=-1>−</button><svg viewBox="0 0 64 64"><circle class=tr cx=32 cy=32 r=26 /><circle class=ar cx=32 cy=32 r=26 stroke="'+col(p.o)+'" stroke-dasharray="'+(C*f)+' '+C+'" transform="rotate(-90 32 32)" /><text x=32 y=39>'+p.hp+'</text></svg><button data-t=hp data-id='+p.id+' data-d=1>+</button><span>'+esc(p.n)+'</span></div>';
  }
  const opts=(arr,sel)=>arr.map(x=>'<option value="'+esc(x.id)+'"'+(x.id===sel?' selected':'')+'>'+esc(x.name)+'</option>').join('');

  function lobbyHTML(){return'<div class=lob><h1>Unmatched Table</h1><button data-t=new>Create room</button><div><input data-f=code placeholder="Room code" maxlength=4 value="'+esc(F.code)+'"> <button data-t=go>Join</button></div><button data-t=lib>Deck &amp; map library</button></div>'}
  function joinHTML(){
    return'<div class=lob><h2>Room '+room+'</h2><p>'+S.players.map(p=>esc(p.name)).join(', ')+(S.players.length?' already here':'Nobody here yet')+'</p>'
    +'<input data-f=name placeholder="Your name" value="'+esc(F.name)+'"><select data-f=deck>'+opts(lib.decks,F.deck)+'</select><input type=color data-f=color value="'+F.color+'">'
    +(S.players.length>=4?'<p>Room is full.</p>':'<button data-t=jn>Sit down</button>')+'<a data-t=home>Leave</a></div>';
  }
  function gameHTML(){
    const m=lib.maps.find(x=>x.id===S.map)||lib.maps[0]||{},zs=m.zones||[],me=S.me;
    const board='<div id=bd style="'+(m.img?'background-image:url('+esc(m.img)+')':'')+'"><svg viewBox="0 0 100 100" preserveAspectRatio="none">'
      +(m.links||[]).map(l=>zs[l[0]]&&zs[l[1]]?'<line x1='+zs[l[0]][0]+' y1='+zs[l[0]][1]+' x2='+zs[l[1]][0]+' y2='+zs[l[1]][1]+' />':'').join('')+'</svg>'
      +zs.map(z=>'<i class=z style="left:'+z[0]+'%;top:'+z[1]+'%"></i>').join('')
      +S.pieces.map(p=>'<div class="pc'+(p.k==='h'?' h':'')+'" data-id='+p.id+' style="left:'+p.x+'%;top:'+p.y+'%;border-color:'+col(p.o)+(p.img?';background-image:url('+esc(p.img)+')':'')+'">'+(p.img?'':esc((p.n||'?')[0]))+'<s>'+p.hp+'</s></div>').join('')+'</div>';
    const side=S.players.map((q,i)=>{const mine=i===me;
      return'<section class=pn style="border-color:'+q.color+'"><b>'+esc(q.name)+(S.turn===i?' ◀ turn':'')+'</b> <small>'+esc((dk(q.deckId)||{}).name)+'</small><div class=st>Hand '+q.hc+' · Deck '+q.dc+' · <a data-t=dis data-i='+i+'>Discard '+q.discard.length+'</a></div>'
      +'<div class=pips>'+[1,2].map(n=>'<button class="'+(q.pips>=n?'on':'')+'" '+(mine?'data-t=pip data-v='+(q.pips>=n?n-1:n):'disabled')+'>●</button>').join('')+' actions</div>'
      +S.pieces.filter(p=>p.o===i).map(wheel).join('')
      +'<div class=pl>'+q.played.map(c=>'<div class=pc2>'+card(c,1,mine)+(mine?'<div class=bt><button data-t=flip data-u='+c.u+'>'+(c.up?'Hide':'Reveal')+'</button><button data-t=back data-u='+c.u+'>↩</button><button data-t=disc data-z=p data-u='+c.u+'>✕</button></div>':'')+'</div>').join('')+'</div></section>';
    }).join('');
    const hand=S.hand.map(c=>'<div class=hc>'+card(c)+'<div class=bt><button data-t=play data-u='+c.u+'>Play</button><button data-t=play data-down=1 data-u='+c.u+'>Face-down</button><button data-t=disc data-z=h data-u='+c.u+'>✕</button></div></div>').join('');
    const md=modal===null?'':'<div class=modal><div style="width:100%"><button data-t=x>Close</button> '+esc(S.players[modal].name)+' discard pile</div>'+S.players[modal].discard.map(c=>'<div>'+card(c)+(modal===S.me?'<br><button data-t=take data-u='+c.u+'>Take to hand</button>':'')+'</div>').join('')+'</div>';
    return'<header><b>Room '+room+'</b><button data-t=copy>Copy invite link</button><select data-sel=map>'+opts(lib.maps,S.map||(m.id))+'</select><span>Turn: '+esc((S.players[S.turn]||{}).name||'-')+'</span><button data-t=turn>End turn</button></header>'
      +'<main><div class=bw>'+board+'</div><div id=side>'+side+'<div id=lg>'+S.log.map(esc).join('<br>')+'</div><input id=ci placeholder="Chat…"></div></main>'
      +'<footer><div class=tools><button data-t=draw data-n=1>Draw</button><button data-t=draw data-n=2>Draw 2</button><button data-t=shuf>Shuffle deck</button><button data-t=shuf data-all=1>Reshuffle with discard</button><button data-t=clear>Discard played cards</button></div><div id=hand>'+hand+'</div></footer>'+md;
  }

  // ---- library ----
  const inp=(id,l,v,up)=>'<label>'+l+'<input id=f_'+id+' value="'+esc(v)+'">'+(up?'<input type=file accept="image/png,image/jpeg,image/webp,image/gif" data-up=f_'+id+'>':'')+'</label>';
  const ser=cs=>cs.map(k=>[k.count,k.type,k.value,k.boost,k.title,k.text].join(' | ')).join('\n');
  const parse=(t,old)=>t.split('\n').map(l=>l.trim()).filter(l=>l&&l[0]!=='#').map(l=>{const p=l.split('|').map(s=>s.trim()),ty=(p[1]||'a')[0].toLowerCase(),o=old.find(x=>x.title===p[4]);return{count:+p[0]||1,type:'adsv'.includes(ty)?ty:'a',value:+p[2]||0,boost:+p[3]||0,title:p[4]||'?',text:p.slice(5).join('|'),img:o&&o.img}});
  function libHTML(){
    let f='';
    if(ed&&ed.k==='decks'){const d=ed.v;f='<h3>Deck</h3>'+inp('name','Deck name',d.name)+'<label>Color<input type=color id=f_color value="'+esc(d.color)+'"></label>'+inp('hn','Hero name',d.hero.name)+inp('hh','Hero HP',d.hero.hp)+inp('hm','Hero move',d.hero.move)+inp('hi','Hero token image',d.hero.img||'',1)+inp('sn','Sidekick name',d.side.name)+inp('sh','Sidekick HP',d.side.hp)+inp('sc','Sidekick count',d.side.count)+inp('si','Sidekick token image',d.side.img||'',1)
      +'<label>Cards, one per line: count | type (a/d/v/s) | value | boost | title | text<textarea id=f_cards>'+esc(ser(d.cards))+'</textarea></label><button data-t=sd>Save deck</button> '+(d.id?'<button data-t=xd>Delete</button>':'')
      +'<div class=pl>'+d.cards.map((k,i)=>card({d:d.id,i})).join('')+'</div>'}
    if(ed&&ed.k==='maps'){const m=ed.v;f='<h3>Map</h3>'+inp('name','Map name',m.name)+inp('img','Board image',m.img||'',1)
      +'<label>Zones: "x y" per line (0-100)<textarea id=f_zones>'+esc((m.zones||[]).map(z=>z.join(' ')).join('\n'))+'</textarea></label><label>Links: "a b" zone numbers per line (1 = first zone)<textarea id=f_links>'+esc((m.links||[]).map(l=>(l[0]+1)+' '+(l[1]+1)).join('\n'))+'</textarea></label><button data-t=sm>Save map</button> '+(m.id?'<button data-t=xm>Delete</button>':'')}
    return'<div class=lib><a data-t=back>← Back</a><h2>Library</h2><div>Decks: '+lib.decks.map(d=>'<a data-t=ld data-id='+d.id+'>'+esc(d.name)+'</a>').join(' · ')+' · <button data-t=nd>New deck</button></div><div>Maps: '+lib.maps.map(d=>'<a data-t=lm data-id='+d.id+'>'+esc(d.name)+'</a>').join(' · ')+' · <button data-t=nm>New map</button></div>'+f+'</div>';
  }
  const g=id=>$('#f_'+id).value;
  async function reload(){lib=await(await fetch('/api?r=lib')).json()}
  async function save(k,item){const r=await admin('/api?r=save',{kind:k,item});if(r.err){alert(r.err);return}await reload();ed={k,v:lib[k].find(x=>x.id===r.id)};render()}

  function render(){
    const A=$('#app');
    if(screen==='lib')return A.innerHTML=libHTML();
    if(!room)return A.innerHTML=lobbyHTML();
    if(!S)return A.innerHTML='<p class=c>Connecting…</p>';
    if(S.me<0)return A.innerHTML=joinHTML();
    const ci=$('#ci'),cv=ci?ci.value:'',cf=ci&&document.activeElement===ci;
    const ks=['#side','#hand','.modal'].map(q=>{const e=$(q);return e?[q,e.scrollTop,e.scrollLeft]:null}).filter(Boolean),wy=scrollY;A.innerHTML=gameHTML();ks.forEach(k=>{const e=$(k[0]);if(e){e.scrollTop=k[1];e.scrollLeft=k[2]}});scrollTo(0,wy);
    const n=$('#ci');if(n){n.value=cv;if(cf)n.focus({preventScroll:true})}const lg=$('#lg');if(lg)lg.scrollTop=1e9;
  }
  let ver=-1,tm;
  function connect(){clearTimeout(tm);S=null;ver=-1;if(!room)return render();poll()}
  async function poll(){
    clearTimeout(tm);if(!room)return;
    try{const r=await api('/api?r=state',{room,pid,v:ver});
      if(r.err){if(!S){$('#app').innerHTML='<p class=c>Room not found. <a data-t=home>Back</a></p>';return}}
      else if(!r.same&&!dr){S=r;ver=r.v;if(screen==='game')render()}}catch(e){}
    tm=setTimeout(poll,1200);
  }
  document.addEventListener('click',async e=>{
    const b=e.target.closest('[data-t]');if(!b)return;const a=Object.assign({},b.dataset),t=a.t;
    if(t==='new'){const r=await api('/api?r=room',{});location.hash=r.code;return}
    if(t==='go'){if(F.code)location.hash=F.code.toUpperCase();return}
    if(t==='home'){room='';history.replaceState(null,'',location.pathname);clearTimeout(tm);S=null;screen='lobby';return render()}
    if(t==='lib'){await reload();screen='lib';ed=null;return render()}
    if(t==='back'){screen=room?'game':'lobby';return render()}
    if(t==='copy'){navigator.clipboard.writeText(location.href);return}
    if(t==='dis'){modal=+a.i;return render()}
    if(t==='x'){modal=null;return render()}
    if(t==='jn'){send({t:'join',name:F.name,deck:F.deck||(lib.decks[0]||{}).id,color:F.color});return}
    if(t==='ld'||t==='lm'){const k=t==='ld'?'decks':'maps';ed={k,v:JSON.parse(JSON.stringify(lib[k].find(x=>x.id===a.id)))};return render()}
    if(t==='nd'){ed={k:'decks',v:{name:'New Deck',color:'#3b6fb4',hero:{name:'Hero',hp:15,move:2},side:{name:'Sidekick',hp:5,count:1},cards:[]}};return render()}
    if(t==='nm'){ed={k:'maps',v:{name:'New Map',zones:[],links:[]}};return render()}
    if(t==='sd'){const o=ed.v;return save('decks',{id:o.id||'',name:g('name'),color:g('color'),hero:{name:g('hn'),hp:+g('hh')||10,move:+g('hm')||2,img:g('hi')},side:{name:g('sn'),hp:+g('sh')||1,count:g('sc')===''?1:+g('sc'),img:g('si')},cards:parse(g('cards'),o.cards||[])})}
    if(t==='sm'){const num=s=>s.split('\n').map(l=>l.trim().split(/[\s,]+/).map(Number)).filter(r=>r.length>=2&&!r.some(isNaN));return save('maps',{id:ed.v.id||'',name:g('name'),img:g('img'),zones:num(g('zones')),links:num(g('links')).map(l=>[l[0]-1,l[1]-1])})}
    if(t==='xd'||t==='xm'){if(!confirm('Delete?'))return;const k=t==='xd'?'decks':'maps';await admin('/api?r=del',{kind:k,id:ed.v.id});await reload();ed=null;return render()}
    send(a);
  });
  document.addEventListener('input',e=>{const f=e.target.dataset.f;if(f){F[f]=e.target.value;if(f==='name')localStorage.nm=F.name}});
  document.addEventListener('change',async e=>{
    const t=e.target;
    if(t.dataset.f==='deck')F.deck=t.value;
    if(t.dataset.sel==='map')send({t:'map',id:t.value});
    if(t.dataset.up&&t.files[0]){const im=new Image();im.onload=async()=>{let w=1400,q=.85,d;const c=document.createElement('canvas');do{const k=Math.min(1,w/Math.max(im.width,im.height));c.width=im.width*k;c.height=im.height*k;c.getContext('2d').drawImage(im,0,0,c.width,c.height);d=c.toDataURL('image/webp',q);w*=.85;q-=.05}while(d.length>9e5&&w>200);const r=await admin('/api?r=upload',{data:d});if(r.url)$('#'+t.dataset.up).value=r.url;else alert(r.err||'Upload failed')};im.src=URL.createObjectURL(t.files[0])}
  });
  document.addEventListener('keydown',e=>{if(e.target.id==='ci'&&e.key==='Enter'&&e.target.value.trim()){send({t:'chat',m:e.target.value});e.target.value=''}});
  let dr=null;
  document.addEventListener('pointerdown',e=>{const p=e.target.closest('.pc');if(!p)return;dr={p,r:$('#bd').getBoundingClientRect()};p.setPointerCapture(e.pointerId)});
  document.addEventListener('pointermove',e=>{if(!dr)return;dr.x=Math.min(100,Math.max(0,(e.clientX-dr.r.left)/dr.r.width*100));dr.y=Math.min(100,Math.max(0,(e.clientY-dr.r.top)/dr.r.height*100));dr.p.style.left=dr.x+'%';dr.p.style.top=dr.y+'%'});
  document.addEventListener('pointerup',()=>{if(dr&&dr.x!=null)send({t:'move',id:dr.p.dataset.id,x:dr.x,y:dr.y});dr=null});
  window.onhashchange=()=>{room=location.hash.slice(1).toUpperCase();screen='game';connect()};
  reload().then(()=>{F.deck=(lib.decks[0]||{}).id||'';if(room){screen='game';connect()}render()});
}
const HTML='<!doctype html><meta charset=utf-8><meta name=viewport content="width=device-width,initial-scale=1"><title>Unmatched Table</title><style>'+HTML_CSS+'</style><div id=app></div><script>('+client+')()</script>';

const getRoom=async c=>{const s=await R('GET','room:'+c);return s?JSON.parse(s):null};
const putRoom=r=>R('SET','room:'+r.code,JSON.stringify(r),'EX',86400);
module.exports=async(req,res)=>{
  const u=new URL(req.url,'http://x'),r=u.searchParams.get('r'),b=req.body||{};
  const send=(o,c)=>res.status(c||200).json(o);
  try{
    if(!r){res.setHeader('Content-Type','text/html; charset=utf-8');return res.status(200).send(HTML)}
    if(r==='lib')return send(await getLib());
    if(r==='img'){const m=/^data:(image\/[a-z]+);base64,(.+)$/.exec(await R('GET','img:'+slug(u.searchParams.get('id')))||'');if(!m)return res.status(404).end();res.setHeader('Content-Type',m[1]);res.setHeader('Cache-Control','public,max-age=31536000,immutable');return res.status(200).send(Buffer.from(m[2],'base64'))}
    if(req.method!=='POST')return res.status(404).end();
    if(r==='room'){let c,x=1;while(x){c=Array.from({length:4},()=>'ABCDEFGHJKLMNPQRSTUVWXYZ'[Math.floor(Math.random()*24)]).join('');x=await R('EXISTS','room:'+c)}
      await putRoom({code:c,players:[],pieces:[],map:((await getLib()).maps[0]||{}).id||'',turn:0,log:[],decks:{},v:1});return send({code:c})}
    if(r==='state'){const m=await getRoom(b.room);if(!m)return send({err:'no room'},404);return b.v===m.v?send({same:1}):send(view(m,String(b.pid)))}
    if(r==='act'){const m=await getRoom(b.room);if(!m)return send({err:'no room'},404);const a=b.a||{};
      act(m,String(b.pid),a,a.t==='join'?await getDeck(a.deck):null);m.v++;await putRoom(m);return send({ok:1})}
    if(KEY&&b.key!==KEY)return send({err:'key'},403);
    if(r==='save'){if(!['decks','maps'].includes(b.kind)||!b.item)return send({err:'bad request'},400);
      const id=slug(b.item.id||b.item.name);if(!id)return send({err:'Name required'},400);b.item.id=id;await put(b.kind,b.item);return send({ok:1,id})}
    if(r==='del'){if(!['decks','maps'].includes(b.kind))return send({err:'bad request'},400);const id=slug(b.id);await Promise.all([R('DEL',b.kind+':'+id),R('SREM',b.kind,id)]);return send({ok:1})}
    if(r==='upload'){const d=String(b.data||'');if(!/^data:image\/(png|jpeg|webp|gif);base64,/.test(d)||d.length>95e4)return send({err:'PNG, JPG, WEBP or GIF under about 700 KB'},400);
      const id=uid()+uid();await R('SET','img:'+id,d);return send({url:'/api?r=img&id='+id})}
    res.status(404).end();
  }catch(e){send({err:String(e.message)},500)}
};
