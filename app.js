(function(){
  const DATA=window.BFUTR_DATA;
  const participants=DATA.participants;
  const analytics=window.BFUTR_ANALYTICS;
  const groupLabel=()=>analytics.groupLabel();
  const byId=new Map(participants.map(p=>[p.id,p]));
  const state={mode:'single',race:'ALL',a:null,b:null,benchmark:'median',group:'all'};
  const benchmarkDefs={
    median:{key:'medianSec',label:'Feldmedian'},
    top10:{key:'top10Sec',label:'Top 10 %'},
    winner:{key:'winnerSec',label:'Schnellste Zeit'}
  };
  const $=sel=>document.querySelector(sel);
  const esc=s=>String(s==null?'':s).replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]));
  const fmtTime=sec=>{if(sec==null||Number.isNaN(sec))return '–';let t=Math.round(sec*10);const d=t%10;t=Math.floor(t/10);const h=Math.floor(t/3600);const m=Math.floor((t%3600)/60);const s=t%60;return (h?h+':':'')+(h?String(m).padStart(2,'0'):m)+':'+String(s).padStart(2,'0')+','+d;};
  const fmtDelta=sec=>{if(sec==null)return '–';const sign=sec>0?'+':sec<0?'−':'';return sign+fmtTime(Math.abs(sec));};
  const splitMap=p=>Object.fromEntries(p.splits.map(s=>[s.checkpoint,s]));
  const raceOrder=r=>DATA.raceOrders[r]||[];
  const pct=(a,b)=>b?((a/b-1)*100):null;
  const topPct=(rank,field)=>rank&&field?rank/field*100:null;
  const percentile=(rank,field)=>rank&&field?(field-rank+1)/field*100:null;
  const fmtPct=value=>value==null?'–':value.toFixed(1).replace('.',',')+' %';
  const statusBadge=p=>p.status==='Finish'?'<span class="badge">Finish</span>':p.status==='Kein Zielresultat'?'<span class="badge warn">Kein Zielresultat</span>':'<span class="badge muted">Keine Messzeit</span>';
  const rankText=(rank,field)=>rank?('#'+rank+' / '+field):'–';
  const lastSplit=p=>{const m=splitMap(p);const order=raceOrder(p.race);for(let i=order.length-1;i>=0;i--){if(m[order[i]])return m[order[i]];}return null;};
  const lastRankedSplit=p=>{const m=splitMap(p);const order=raceOrder(p.race);for(let i=order.length-1;i>=0;i--){const s=m[order[i]];if(s&&s.rankOverall)return s;}return null;};

  function positionContext(p){
    if(p.officialFinisher&&p.finishRankOverall){return {rank:p.finishRankOverall,field:p.finishFieldOverall,label:'Ziel'};}
    const s=lastRankedSplit(p);
    if(s)return {rank:s.rankOverall,field:s.fieldOverall,label:s.checkpoint};
    return null;
  }

  function sectionRows(p){
    const order=raceOrder(p.race),m=splitMap(p),rows=[];
    for(let i=1;i<order.length;i++){
      const a=order[i-1],b=order[i];
      if(!m[a]||!m[b])continue;
      const sec=m[b].sec-m[a].sec;
      if(sec<0)continue;
      const bench=analytics.raceStats(p.race).section[a+' → '+b];
      if(!bench)continue;
      rows.push({label:a+' → '+b,from:a,to:b,sec,bench,diffPctMedian:pct(sec,bench.medianSec)});
    }
    return rows;
  }

  function consistencyMetrics(p){
    const vals=sectionRows(p).map(r=>r.diffPctMedian).filter(v=>v!=null);
    if(vals.length<2)return {score:null,sd:null,mean:null};
    const mean=vals.reduce((a,b)=>a+b,0)/vals.length;
    const variance=vals.reduce((sum,v)=>sum+Math.pow(v-mean,2),0)/vals.length;
    const sd=Math.sqrt(variance);
    const score=Math.max(0,Math.min(100,Math.round(100-2*sd)));
    return {score,sd,mean};
  }

  function profileStats(p){
    const pos=positionContext(p),last=lastSplit(p),cons=consistencyMetrics(p);
    const posText=pos?('Top '+fmtPct(topPct(pos.rank,pos.field))):'–';
    return [
      ['Zielzeit',p.officialFinisher?fmtTime(p.finalSec):'–'],
      ['Rang gesamt',p.officialFinisher?rankText(p.finishRankOverall,p.finishFieldOverall):'–'],
      ['Einordnung'+(pos?' · '+pos.label:'')+' · Gesamt',posText],
      [p.gender==='Offen'?'Kategorie':p.gender,p.officialFinisher?rankText(p.finishRankGender,p.finishFieldGender):'–'],
      ['Letzter Messpunkt',last?(last.checkpoint+' · '+fmtTime(last.sec)):'–'],
      ['Pacing-Konstanz',cons.score==null?'–':cons.score+' / 100']
    ];
  }

  function renderProfileHeader(p){
    return '<div class="profile-card card"><div class="profile-top"><div class="profile-name"><span class="section-kicker">'+esc(p.race)+' · Startnr. '+esc(p.bib)+'</span><h2>'+esc(p.displayName)+'</h2><div class="meta-line">'+esc(p.gender)+(p.club?' · '+esc(p.club):'')+'</div></div>'+statusBadge(p)+'</div><div class="stats-grid">'+profileStats(p).map(x=>'<div class="stat"><span>'+esc(x[0])+'</span><strong>'+esc(x[1])+'</strong></div>').join('')+'</div></div>';
  }

  function renderInsights(p){
    const rows=sectionRows(p).filter(r=>r.diffPctMedian!=null);
    if(!rows.length)return '<div class="card empty-state">Noch nicht genug Abschnittsdaten für automatische Insights.</div>';
    const strongest=rows.reduce((a,b)=>a.diffPctMedian<b.diffPctMedian?a:b);
    const weakest=rows.reduce((a,b)=>a.diffPctMedian>b.diffPctMedian?a:b);
    const cons=consistencyMetrics(p);
    const strengthText=(strongest.diffPctMedian<=0?Math.abs(strongest.diffPctMedian).toFixed(1).replace('.',',')+' % schneller':strongest.diffPctMedian.toFixed(1).replace('.',',')+' % langsamer')+' als Median · '+groupLabel();
    const weakText=(weakest.diffPctMedian<=0?Math.abs(weakest.diffPctMedian).toFixed(1).replace('.',',')+' % schneller':weakest.diffPctMedian.toFixed(1).replace('.',',')+' % langsamer')+' als Median · '+groupLabel();
    const score=cons.score==null?'–':cons.score;
    const sd=cons.sd==null?'–':cons.sd.toFixed(1).replace('.',',')+' Prozentpunkte Streuung';
    return '<div class="insight-card card"><span class="section-kicker">Automatische Rennanalyse · '+esc(groupLabel())+'</span><div class="insight-grid"><div class="insight"><span class="label">Stärkster Abschnitt</span><strong>'+esc(strongest.label)+'</strong><small>'+esc(strengthText)+'</small></div><div class="insight"><span class="label">Schwächster Abschnitt</span><strong>'+esc(weakest.label)+'</strong><small>'+esc(weakText)+'</small></div><div class="insight"><span class="label">Pacing-Konstanz</span><div class="score-ring" style="--score:'+esc(score)+'"><b>'+esc(score)+'</b></div><small>'+esc(sd)+' · misst Gleichmäßigkeit, nicht absolute Geschwindigkeit.</small></div></div></div>';
  }

  function renderBenchmarkBars(p){
    const def=benchmarkDefs[state.benchmark],rows=sectionRows(p).map(r=>{const ref=r.bench[def.key];return Object.assign({},r,{ref,diffPct:ref?pct(r.sec,ref):null,diffSec:ref?r.sec-ref:null});}).filter(r=>r.ref!=null&&r.ref>0);
    if(!rows.length)return '<div class="empty-state">Noch nicht genug aufeinanderfolgende Messpunkte für diese Benchmark.</div>';
    const max=Math.max(10,...rows.map(r=>Math.abs(r.diffPct||0)));
    return '<div class="section-bars">'+rows.map(r=>{const width=Math.min(48,Math.abs(r.diffPct||0)/max*48);const cls=(r.diffPct||0)<=0?'faster':'slower';const pctText=(r.diffPct>0?'+':'')+r.diffPct.toFixed(1).replace('.',',')+' %';return '<div class="section-row"><div class="section-label">'+esc(r.label)+'</div><div class="bar-track"><div class="bar-fill '+cls+'" style="width:'+width+'%"></div></div><div class="section-value '+((r.diffPct||0)<=0?'positive':'negative')+'">'+pctText+'<br><span class="muted">'+fmtDelta(r.diffSec)+'</span></div></div>';}).join('')+'</div>';
  }

  function renderPercentileChart(p){
    const pts=p.splits.filter(s=>s.rankOverall&&s.fieldOverall).map(s=>({label:s.checkpoint,value:percentile(s.rankOverall,s.fieldOverall),rank:s.rankOverall,field:s.fieldOverall}));
    if(pts.length<2)return '<div class="empty-state">Noch nicht genug Rangpunkte vorhanden.</div>';
    const w=Math.max(640,pts.length*90),h=310,pad={l:52,r:20,t:24,b:72};
    const x=i=>pad.l+i*((w-pad.l-pad.r)/(pts.length-1));
    const y=v=>pad.t+(100-v)/100*(h-pad.t-pad.b);
    const grid=[0,25,50,75,90,100].map(v=>'<g><line x1="'+pad.l+'" y1="'+y(v)+'" x2="'+(w-pad.r)+'" y2="'+y(v)+'" stroke="'+(v===90?'#a9bda9':'#e3e8e1')+'" '+(v===90?'stroke-dasharray="5 5"':'')+'/><text x="'+(pad.l-8)+'" y="'+(y(v)+4)+'" text-anchor="end" font-size="10" fill="#657066">'+v+'</text></g>').join('');
    const line=pts.map((q,i)=>x(i)+','+y(q.value)).join(' ');
    return '<svg viewBox="0 0 '+w+' '+h+'" role="img" aria-label="Perzentil im Rennverlauf">'+grid+'<text x="'+(w-pad.r)+'" y="'+(y(90)-7)+'" text-anchor="end" font-size="10" fill="#657066">Top 10 %</text><polyline points="'+line+'" fill="none" stroke="#2f6b4d" stroke-width="3" stroke-linejoin="round"/>'+pts.map((q,i)=>'<g><circle cx="'+x(i)+'" cy="'+y(q.value)+'" r="5" fill="#173d2d"/><text x="'+x(i)+'" y="'+(y(q.value)-10)+'" text-anchor="middle" font-size="11" font-weight="700" fill="#172019">P'+Math.round(q.value)+'</text><text transform="translate('+x(i)+' '+(h-pad.b+20)+') rotate(-35)" text-anchor="end" font-size="11" fill="#657066">'+esc(q.label)+'</text></g>').join('')+'</svg>';
  }

  function placeChangeMap(p){
    const m=splitMap(p),order=raceOrder(p.race),ranked=[];
    order.forEach(cp=>{const s=m[cp];if(s&&s.rankOverall)ranked.push(s);});
    const out={};
    for(let i=0;i<ranked.length;i++)out[ranked[i].checkpoint]=i===0?null:ranked[i-1].rankOverall-ranked[i].rankOverall;
    return out;
  }

  function renderSplitTable(p){
    const order=raceOrder(p.race),m=splitMap(p),changes=placeChangeMap(p);let prev=null;
    const rows=order.map(cp=>{
      const s=m[cp];if(!s)return '';
      let section='–',vs='–';
      if(prev&&m[prev]){const sec=s.sec-m[prev].sec,bench=analytics.raceStats(p.race).section[prev+' → '+cp];section=fmtTime(sec);if(bench&&bench.medianSec){const d=pct(sec,bench.medianSec);vs='<span class="'+(d<=0?'positive':'negative')+'">'+(d>0?'+':'')+d.toFixed(1).replace('.',',')+' %</span>';}}
      prev=cp;
      const tp=s.rankOverall?topPct(s.rankOverall,s.fieldOverall):null;
      const per=s.rankOverall?percentile(s.rankOverall,s.fieldOverall):null;
      const change=changes[cp];
      let changeHtml='–';
      if(change!=null){const cls=change>0?'gain':change<0?'loss':'';changeHtml='<span class="place-pill '+cls+'">'+(change>0?'+':'')+change+'</span>';}
      return '<tr><td><strong>'+esc(cp)+'</strong></td><td class="num">'+fmtTime(s.sec)+'</td><td class="num">'+section+'</td><td class="num">'+rankText(s.rankOverall,s.fieldOverall)+'</td><td class="num">'+fmtPct(tp)+'</td><td class="num">'+(per==null?'–':'P'+per.toFixed(1).replace('.',','))+'</td><td class="num">'+changeHtml+'</td><td class="num">'+vs+'</td></tr>';
    }).join('');
    return '<div class="table-card card"><div class="table-head"><h3>Alle Zwischenzeiten</h3><p class="panel-sub">„Δ Plätze“ zeigt den Gewinn oder Verlust gegenüber dem vorherigen Checkpoint mit gültigem Rang.</p></div><div class="table-wrap"><table class="data-table"><thead><tr><th>Messpunkt</th><th>Passage</th><th>Abschnitt</th><th>Rang gesamt</th><th>Top %</th><th>Perzentil</th><th>Δ Plätze</th><th>Abschnitt vs. Median · '+esc(groupLabel())+'</th></tr></thead><tbody>'+rows+'</tbody></table></div></div>';
  }

  function renderSingle(){
    const root=$('#singleView'),p=byId.get(state.a);
    if(!p){root.innerHTML='<div class="card empty-state">Wähle eine Person aus, um die Analyse zu öffnen.</div>';return;}
    const def=benchmarkDefs[state.benchmark];
    root.innerHTML=renderProfileHeader(p)+renderInsights(p)+'<div class="grid-2"><div class="panel card"><h3>Perzentil im Rennverlauf · Gesamtfeld</h3><p class="panel-sub">Je höher, desto weiter vorne im Feld. P90 entspricht ungefähr Top 10 %.</p><div class="chart-scroll"><div class="chart-host">'+renderPercentileChart(p)+'</div></div></div><div class="panel card"><div class="panel-head-row"><div><h3>Abschnitte vs. '+esc(def.label)+' · '+esc(groupLabel())+'</h3><p class="panel-sub">Grün = schneller als Benchmark, orange = langsamer.</p></div><div class="benchmark-tabs"><button class="benchmark-btn '+(state.benchmark==='median'?'active':'')+'" data-benchmark="median">Median</button><button class="benchmark-btn '+(state.benchmark==='top10'?'active':'')+'" data-benchmark="top10">Top 10 %</button><button class="benchmark-btn '+(state.benchmark==='winner'?'active':'')+'" data-benchmark="winner">Schnellste</button></div></div>'+renderBenchmarkBars(p)+'</div></div>'+renderSplitTable(p);
  }

  function compareCard(p,label){
    const pos=positionContext(p);const top=pos?fmtPct(topPct(pos.rank,pos.field)):'–';
    return '<div class="compare-person card"><span class="section-kicker">'+label+' · '+esc(p.race)+'</span><h2>'+esc(p.displayName)+'</h2>'+statusBadge(p)+'<div class="compare-kpis"><div><span>Zielzeit</span><strong>'+(p.officialFinisher?fmtTime(p.finalSec):'–')+'</strong></div><div><span>Gesamtrang</span><strong>'+rankText(p.finishRankOverall,p.finishFieldOverall)+'</strong></div><div><span>Einordnung · Gesamtfeld</span><strong>'+(pos?'Top '+top:'–')+'</strong></div><div><span>Letzter Punkt</span><strong>'+(lastSplit(p)?esc(lastSplit(p).checkpoint):'–')+'</strong></div></div></div>';
  }

  function renderDeltaChart(a,b,common){
    if(common.length<2)return '<div class="empty-state">Zu wenige gemeinsame Messpunkte.</div>';
    const ma=splitMap(a),mb=splitMap(b),pts=common.map(cp=>({label:cp,value:mb[cp].sec-ma[cp].sec}));
    const w=Math.max(640,pts.length*90),h=300,pad={l:54,r:20,t:30,b:72};const maxAbs=Math.max(30,...pts.map(q=>Math.abs(q.value)));const x=i=>pad.l+i*((w-pad.l-pad.r)/(pts.length-1));const y=v=>pad.t+(maxAbs-v)/(2*maxAbs)*(h-pad.t-pad.b);const zero=y(0);
    return '<svg viewBox="0 0 '+w+' '+h+'" role="img" aria-label="Zeitabstand"><line x1="'+pad.l+'" y1="'+zero+'" x2="'+(w-pad.r)+'" y2="'+zero+'" stroke="#9ba69c" stroke-dasharray="4 4"/><polyline points="'+pts.map((q,i)=>x(i)+','+y(q.value)).join(' ')+'" fill="none" stroke="#2f6b4d" stroke-width="3"/>'+pts.map((q,i)=>'<g><circle cx="'+x(i)+'" cy="'+y(q.value)+'" r="5" fill="#173d2d"/><text x="'+x(i)+'" y="'+(y(q.value)+(q.value>=0?-11:19))+'" text-anchor="middle" font-size="11" font-weight="700" fill="#172019">'+fmtDelta(q.value)+'</text><text transform="translate('+x(i)+' '+(h-pad.b+20)+') rotate(-35)" text-anchor="end" font-size="11" fill="#657066">'+esc(q.label)+'</text></g>').join('')+'</svg>';
  }

  function renderCompare(){
    const root=$('#compareView'),a=byId.get(state.a),b=byId.get(state.b);
    if(!a||!b){root.innerHTML='<div class="card empty-state">Wähle zwei Personen für den Vergleich aus.</div>';return;}
    const ma=splitMap(a),mb=splitMap(b);let order=a.race===b.race?raceOrder(a.race):raceOrder(a.race).concat(raceOrder(b.race).filter(x=>!raceOrder(a.race).includes(x)));const common=order.filter(cp=>ma[cp]&&mb[cp]);
    const passageRows=common.map(cp=>{const d=mb[cp].sec-ma[cp].sec;return '<tr><td><strong>'+esc(cp)+'</strong></td><td class="num">'+fmtTime(ma[cp].sec)+'</td><td class="num">'+fmtTime(mb[cp].sec)+'</td><td class="num '+(d>=0?'positive':'negative')+'">'+(d>=0?esc(a.displayName)+' '+fmtTime(d)+' voraus':esc(b.displayName)+' '+fmtTime(-d)+' voraus')+'</td></tr>';}).join('');
    const secRows=[];for(let i=1;i<common.length;i++){const p=common[i-1],c=common[i],sa=ma[c].sec-ma[p].sec,sb=mb[c].sec-mb[p].sec,d=sb-sa;secRows.push('<tr><td><strong>'+esc(p+' → '+c)+'</strong></td><td class="num">'+fmtTime(sa)+'</td><td class="num">'+fmtTime(sb)+'</td><td class="num '+(d>=0?'positive':'negative')+'">'+(d>=0?esc(a.displayName)+' '+fmtTime(d)+' schneller':esc(b.displayName)+' '+fmtTime(-d)+' schneller')+'</td></tr>');}
    root.innerHTML='<div class="compare-summary">'+compareCard(a,'Person A')+'<div class="versus">VS</div>'+compareCard(b,'Person B')+'</div>'+(a.race!==b.race?'<div class="notice">Die beiden Personen liefen unterschiedliche Distanzen. Verglichen werden nur Messpunkte, die in beiden Datensätzen vorkommen.</div>':'')+'<div class="panel card"><h3>Zeitabstand im Rennverlauf</h3><p class="panel-sub">Positive Werte bedeuten: '+esc(a.displayName)+' liegt vor '+esc(b.displayName)+'.</p><div class="chart-scroll"><div class="chart-host">'+renderDeltaChart(a,b,common)+'</div></div></div><div class="table-card card"><div class="table-head"><h3>Gemeinsame Passagezeiten</h3></div><div class="table-wrap"><table class="data-table"><thead><tr><th>Messpunkt</th><th>'+esc(a.displayName)+'</th><th>'+esc(b.displayName)+'</th><th>Abstand</th></tr></thead><tbody>'+passageRows+'</tbody></table></div></div><div class="table-card card"><div class="table-head"><h3>Abschnitt für Abschnitt</h3></div><div class="table-wrap"><table class="data-table"><thead><tr><th>Abschnitt</th><th>'+esc(a.displayName)+'</th><th>'+esc(b.displayName)+'</th><th>Schneller</th></tr></thead><tbody>'+secRows.join('')+'</tbody></table></div></div>';
  }

  function picker(rootSel,key){
    const root=$(rootSel),input=root.querySelector('input'),box=root.querySelector('.picker-results');
    function list(q){q=(q||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim();const arr=participants.filter(p=>(state.race==='ALL'||p.race===state.race)&&(!q||p.search.includes(q))).slice(0,10);box.innerHTML=arr.map(p=>'<div class="picker-option" role="option" data-id="'+p.id+'"><strong>'+esc(p.displayName)+'</strong><span>'+esc(p.race)+' · #'+esc(p.bib)+' · '+esc(p.status)+'</span></div>').join('')||'<div class="picker-option"><span>Keine Treffer</span></div>';box.classList.add('open');input.setAttribute('aria-expanded','true');}
    input.addEventListener('input',()=>list(input.value));input.addEventListener('focus',()=>list(input.value));box.addEventListener('mousedown',e=>{const opt=e.target.closest('[data-id]');if(!opt)return;e.preventDefault();state[key]=opt.dataset.id;input.value=byId.get(state[key]).displayName;box.classList.remove('open');input.setAttribute('aria-expanded','false');syncUrl();render();});document.addEventListener('click',e=>{if(!root.contains(e.target)){box.classList.remove('open');input.setAttribute('aria-expanded','false');}});return {set(id){const p=byId.get(id);input.value=p?p.displayName:'';}};
  }

  const pickerA=picker('#personAPicker','a'),pickerB=picker('#personBPicker','b');

  function syncUrl(){const u=new URL(location.href);u.searchParams.set('mode',state.mode);if(state.race==='ALL')u.searchParams.delete('race');else u.searchParams.set('race',state.race);state.a?u.searchParams.set('a',state.a):u.searchParams.delete('a');state.b?u.searchParams.set('b',state.b):u.searchParams.delete('b');if(state.benchmark==='median')u.searchParams.delete('benchmark');else u.searchParams.set('benchmark',state.benchmark);if(state.group==='all')u.searchParams.delete('group');else u.searchParams.set('group',state.group);history.replaceState(null,'',u);}

  function render(){const compare=state.mode==='compare';$('#singleTab').classList.toggle('active',!compare);$('#compareTab').classList.toggle('active',compare);$('#singleTab').setAttribute('aria-selected',String(!compare));$('#compareTab').setAttribute('aria-selected',String(compare));$('#pickerGrid').classList.toggle('single-mode',!compare);$('#singleView').classList.toggle('hidden',compare);$('#compareView').classList.toggle('hidden',!compare);pickerA.set(state.a);pickerB.set(state.b);if(compare)renderCompare();else renderSingle();renderReferenceControls();document.dispatchEvent(new CustomEvent('bfutr:render'));}

  function renderReferenceControls(){
    $('#groupFilter').value=state.group;
    $('#benchmarkFilter').value=state.benchmark;
    const selected=[byId.get(state.a),state.mode==='compare'?byId.get(state.b):null].filter(Boolean);
    const races=[...new Set(selected.map(p=>p.race))];
    $('#referenceSummary').textContent=races.map(race=>{const stats=analytics.raceStats(race);return race+' · '+groupLabel()+' · '+stats.finish.count+' Finisher';}).join(' | ');
  }

  // Ein gemeinsamer Zustand hält Hauptansicht und Diagramme synchron.
  analytics.viewState=()=>({...state});
  function init(){
    const races=Object.keys(DATA.raceMeta);$('#raceFilter').innerHTML='<option value="ALL">Alle Distanzen</option>'+races.map(r=>'<option value="'+esc(r)+'">'+esc(r)+'</option>').join('');$('#metricParticipants').textContent=DATA.participantCount.toLocaleString('de-DE');$('#metricRaces').textContent=races.length;$('#metricSplits').textContent=participants.reduce((n,p)=>n+p.splits.length,0).toLocaleString('de-DE');$('#dataNote').textContent=DATA.dataNote;
    const params=new URLSearchParams(location.search);analytics.setGroup(params.get('group'));state.group=analytics.getGroup();state.mode=params.get('mode')==='compare'?'compare':'single';state.race=races.includes(params.get('race'))?params.get('race'):'ALL';state.benchmark=Object.hasOwn(benchmarkDefs,params.get('benchmark'))?params.get('benchmark'):'median';const fav=DATA.favorites.map(id=>byId.get(id)).filter(Boolean);state.a=byId.has(params.get('a'))?params.get('a'):(fav[0]&&fav[0].id);state.b=byId.has(params.get('b'))?params.get('b'):(fav[1]&&fav[1].id);$('#raceFilter').value=state.race;
    $('#favoriteButtons').innerHTML=fav.map(p=>'<button type="button" data-id="'+p.id+'">'+esc(p.displayName)+'</button>').join('');$('#favoriteButtons').addEventListener('click',e=>{const btn=e.target.closest('[data-id]');if(!btn)return;if(state.mode==='compare'){if(!state.a||state.a===state.b)state.a=btn.dataset.id;else state.b=btn.dataset.id;}else state.a=btn.dataset.id;syncUrl();render();});
    $('#raceFilter').addEventListener('change',e=>{state.race=e.target.value;if(state.race!=='ALL'){if(state.a&&byId.get(state.a).race!==state.race)state.a=null;if(state.b&&byId.get(state.b).race!==state.race)state.b=null;}syncUrl();render();});$('#singleTab').addEventListener('click',()=>{state.mode='single';syncUrl();render();});$('#compareTab').addEventListener('click',()=>{state.mode='compare';syncUrl();render();});$('#groupFilter').addEventListener('change',e=>{analytics.setGroup(e.target.value);state.group=analytics.getGroup();syncUrl();render();});$('#benchmarkFilter').addEventListener('change',e=>{state.benchmark=e.target.value;syncUrl();render();});$('#singleView').addEventListener('click',e=>{const btn=e.target.closest('[data-benchmark]');if(!btn)return;state.benchmark=btn.dataset.benchmark;syncUrl();render();});render();
  }
  init();
})();

