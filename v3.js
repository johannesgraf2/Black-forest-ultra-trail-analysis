(function(){
  'use strict';
  const DATA=window.BFUTR_DATA;
  if(!DATA)return;
  const participants=DATA.participants||[];
  const byId=new Map(participants.map(p=>[p.id,p]));
  const raceCache=new Map();
  const $=sel=>document.querySelector(sel);
  const esc=s=>String(s==null?'':s).replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]));
  const fmtTime=sec=>{if(sec==null||Number.isNaN(sec))return '–';let t=Math.round(sec*10);const d=t%10;t=Math.floor(t/10);const h=Math.floor(t/3600);const m=Math.floor((t%3600)/60);const s=t%60;return (h?h+':':'')+(h?String(m).padStart(2,'0'):m)+':'+String(s).padStart(2,'0')+','+d;};
  const fmtGap=sec=>{if(sec==null)return '–';if(Math.abs(sec)<.5)return 'gleichauf';return sec<0?fmtTime(Math.abs(sec))+' voraus':fmtTime(sec)+' dahinter';};
  const splitMap=p=>Object.fromEntries((p.splits||[]).map(s=>[s.checkpoint,s]));
  const raceOrder=r=>DATA.raceOrders[r]||[];
  const percentile=(rank,field)=>rank&&field?(field-rank+1)/field*100:null;
  const pct=(value,reference)=>reference?((value/reference-1)*100):null;

  function raceParticipants(race){
    if(!raceCache.has(race))raceCache.set(race,participants.filter(p=>p.race===race));
    return raceCache.get(race);
  }

  function quantile(values,q){
    const a=values.filter(v=>v!=null&&Number.isFinite(v)).slice().sort((x,y)=>x-y);
    if(!a.length)return null;
    if(a.length===1)return a[0];
    const pos=(a.length-1)*q;
    const lo=Math.floor(pos),hi=Math.ceil(pos);
    if(lo===hi)return a[lo];
    return a[lo]+(a[hi]-a[lo])*(pos-lo);
  }

  function benchmarkDef(){
    const active=document.querySelector('.benchmark-btn.active[data-benchmark]');
    const key=active?active.dataset.benchmark:(new URLSearchParams(location.search).get('benchmark')||'median');
    if(key==='top10')return {key:'top10',label:'Top 10 %',q:.10};
    if(key==='winner')return {key:'winner',label:'Bestzeit',q:0};
    return {key:'median',label:'Feldmedian',q:.50};
  }

  function checkpointBenchmark(race,checkpoint,def){
    if(checkpoint==='Start')return 0;
    const values=[];
    raceParticipants(race).forEach(p=>{
      const s=splitMap(p)[checkpoint];
      if(s&&s.sec!=null)values.push(s.sec);
    });
    if(!values.length)return null;
    if(def.key==='winner')return Math.min.apply(null,values);
    return quantile(values,def.q);
  }

  function sectionBenchmark(race,from,to,def){
    const entry=DATA.benchmarks&&DATA.benchmarks[race]&&DATA.benchmarks[race].section[from+' → '+to];
    if(entry){
      if(def.key==='top10'&&entry.top10Sec!=null)return entry.top10Sec;
      if(def.key==='winner'&&entry.winnerSec!=null)return entry.winnerSec;
      if(def.key==='median'&&entry.medianSec!=null)return entry.medianSec;
    }
    const values=[];
    raceParticipants(race).forEach(p=>{
      const m=splitMap(p);
      if(m[from]&&m[to]){
        const delta=m[to].sec-m[from].sec;
        if(delta>=0)values.push(delta);
      }
    });
    if(!values.length)return null;
    if(def.key==='winner')return Math.min.apply(null,values);
    return quantile(values,def.q);
  }

  function resolvePerson(param,inputSelector){
    const id=new URLSearchParams(location.search).get(param);
    if(id&&byId.has(id))return byId.get(id);
    const input=$(inputSelector);
    const name=input?input.value.trim():'';
    if(!name)return null;
    const race=$('#raceFilter')?$('#raceFilter').value:'ALL';
    return participants.find(p=>p.displayName===name&&(race==='ALL'||p.race===race))||participants.find(p=>p.displayName===name)||null;
  }

  function timeGapPoints(p,def){
    const m=splitMap(p),pts=[];
    raceOrder(p.race).forEach(cp=>{
      if(!m[cp])return;
      if(cp==='Start'){pts.push({label:cp,value:0,ref:0,own:m[cp].sec});return;}
      const ref=checkpointBenchmark(p.race,cp,def);
      if(ref!=null)pts.push({label:cp,value:m[cp].sec-ref,ref,own:m[cp].sec});
    });
    return pts;
  }

  function gapChart(p){
    const def=benchmarkDef(),pts=timeGapPoints(p,def);
    if(pts.length<2)return '<div class="empty-state">Noch nicht genug Passagezeiten für den Zeitabstands-Verlauf.</div>';
    const w=Math.max(700,pts.length*92),h=330,pad={l:62,r:24,t:35,b:82};
    const maxAbs=Math.max(60,...pts.map(q=>Math.abs(q.value)));
    const x=i=>pad.l+i*((w-pad.l-pad.r)/(pts.length-1));
    const y=v=>pad.t+(maxAbs-v)/(2*maxAbs)*(h-pad.t-pad.b);
    const zero=y(0);
    const line=pts.map((q,i)=>x(i)+','+y(q.value)).join(' ');
    const fill=line+' '+x(pts.length-1)+','+zero+' '+x(0)+','+zero;
    const latest=pts[pts.length-1];
    return '<div class="chart-summary"><span>'+esc(def.label)+'</span><strong>'+esc(fmtGap(latest.value))+'</strong><small>am letzten gemeinsamen Messpunkt</small></div><svg viewBox="0 0 '+w+' '+h+'" role="img" aria-label="Zeitabstand zur Benchmark"><defs><linearGradient id="gapFill" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="#d96c43" stop-opacity=".20"/><stop offset=".5" stop-color="#6f8f78" stop-opacity=".03"/><stop offset="1" stop-color="#2f6b4d" stop-opacity=".18"/></linearGradient></defs><line x1="'+pad.l+'" y1="'+zero+'" x2="'+(w-pad.r)+'" y2="'+zero+'" stroke="#87968a" stroke-width="1.5" stroke-dasharray="5 5"/><text x="'+(pad.l+4)+'" y="'+(zero-8)+'" font-size="10" fill="#657066">Benchmark</text><polygon points="'+fill+'" fill="url(#gapFill)"/><polyline points="'+line+'" fill="none" stroke="#173d2d" stroke-width="3.5" stroke-linejoin="round" stroke-linecap="round"/>'+pts.map((q,i)=>'<g><circle cx="'+x(i)+'" cy="'+y(q.value)+'" r="5.5" fill="'+(q.value<=0?'#2f7a50':'#d96c43')+'" stroke="#fff" stroke-width="2"/><text x="'+x(i)+'" y="'+(y(q.value)+(q.value>=0?20:-12))+'" text-anchor="middle" font-size="10.5" font-weight="800" fill="#172019">'+(q.value===0?'0:00':(q.value<0?'−':'+')+fmtTime(Math.abs(q.value)))+'</text><text transform="translate('+x(i)+' '+(h-pad.b+22)+') rotate(-35)" text-anchor="end" font-size="11" fill="#657066">'+esc(q.label)+'</text></g>').join('')+'</svg><div class="chart-legend"><span><i class="legend-dot ahead"></i> schneller / voraus</span><span><i class="legend-dot behind"></i> langsamer / dahinter</span></div>';
  }

  function heatClass(diff){
    if(diff==null)return 'heat-neutral';
    if(diff<=-15)return 'heat-fast-3';
    if(diff<=-7)return 'heat-fast-2';
    if(diff<0)return 'heat-fast-1';
    if(diff<7)return 'heat-slow-1';
    if(diff<15)return 'heat-slow-2';
    return 'heat-slow-3';
  }

  function heatmap(p){
    const def=benchmarkDef(),m=splitMap(p),tiles=[];
    const order=raceOrder(p.race);
    for(let i=1;i<order.length;i++){
      const from=order[i-1],to=order[i];
      if(!m[from]||!m[to])continue;
      const own=m[to].sec-m[from].sec;
      if(own<0)continue;
      const ref=sectionBenchmark(p.race,from,to,def);
      if(ref==null)continue;
      const diff=pct(own,ref);
      tiles.push({from,to,own,ref,diff});
    }
    if(!tiles.length)return '<div class="empty-state">Noch nicht genug Abschnitte für die Heatmap.</div>';
    return '<div class="heatmap-grid">'+tiles.map(t=>'<div class="heat-tile '+heatClass(t.diff)+'"><span>'+esc(t.from)+' → '+esc(t.to)+'</span><strong>'+fmtTime(t.own)+'</strong><small>'+(t.diff>=0?'+':'')+t.diff.toFixed(1).replace('.',',')+' % vs. '+esc(def.label)+'</small></div>').join('')+'</div><div class="heat-legend"><span>schneller</span><div class="heat-scale"><i class="heat-fast-3"></i><i class="heat-fast-2"></i><i class="heat-fast-1"></i><i class="heat-slow-1"></i><i class="heat-slow-2"></i><i class="heat-slow-3"></i></div><span>langsamer</span></div>';
  }

  function distributionData(race){
    return raceParticipants(race).filter(p=>p.officialFinisher&&p.finalSec!=null).map(p=>p.finalSec).sort((a,b)=>a-b);
  }

  function distributionChart(race,markers){
    const values=distributionData(race);
    if(values.length<3)return '<div class="empty-state">Noch nicht genug Zielzeiten für eine Verteilung.</div>';
    const min=values[0],max=values[values.length-1],median=quantile(values,.5),top10=quantile(values,.1);
    const bins=Math.max(10,Math.min(18,Math.round(Math.sqrt(values.length))));
    const span=Math.max(1,max-min),step=span/bins,counts=Array(bins).fill(0);
    values.forEach(v=>{let i=Math.floor((v-min)/step);if(i>=bins)i=bins-1;if(i<0)i=0;counts[i]++;});
    const w=780,h=320,pad={l:46,r:24,t:32,b:62},plotW=w-pad.l-pad.r,plotH=h-pad.t-pad.b,maxCount=Math.max.apply(null,counts);
    const xVal=v=>pad.l+(v-min)/span*plotW;
    const barW=plotW/bins;
    const bars=counts.map((c,i)=>{const bh=maxCount?c/maxCount*(plotH-18):0;return '<rect x="'+(pad.l+i*barW+2)+'" y="'+(pad.t+plotH-bh)+'" width="'+Math.max(1,barW-4)+'" height="'+bh+'" rx="4" fill="#c9d7cb"/><text x="'+(pad.l+i*barW+barW/2)+'" y="'+(pad.t+plotH-bh-5)+'" text-anchor="middle" font-size="9" fill="#778178">'+(c?c:'')+'</text>';}).join('');
    const markerHtml=(markers||[]).filter(x=>x.person&&x.person.officialFinisher&&x.person.finalSec!=null).map((x,i)=>{const xx=xVal(x.person.finalSec),anchor=xx>w-150?'end':'start',dx=anchor==='end'?-7:7;return '<line x1="'+xx+'" y1="'+(pad.t-4)+'" x2="'+xx+'" y2="'+(pad.t+plotH)+'" stroke="'+x.color+'" stroke-width="3"/><text x="'+(xx+dx)+'" y="'+(pad.t+12+i*16)+'" text-anchor="'+anchor+'" font-size="10.5" font-weight="800" fill="'+x.color+'">'+esc(x.person.displayName)+' · '+fmtTime(x.person.finalSec)+'</text>';}).join('');
    return '<svg viewBox="0 0 '+w+' '+h+'" role="img" aria-label="Verteilung der Zielzeiten"><line x1="'+pad.l+'" y1="'+(pad.t+plotH)+'" x2="'+(w-pad.r)+'" y2="'+(pad.t+plotH)+'" stroke="#b7c1b8"/>'+bars+'<line x1="'+xVal(median)+'" y1="'+pad.t+'" x2="'+xVal(median)+'" y2="'+(pad.t+plotH)+'" stroke="#657066" stroke-width="2" stroke-dasharray="5 4"/><text x="'+xVal(median)+'" y="'+(pad.t+plotH+20)+'" text-anchor="middle" font-size="10" fill="#657066">Median '+fmtTime(median)+'</text><line x1="'+xVal(top10)+'" y1="'+pad.t+'" x2="'+xVal(top10)+'" y2="'+(pad.t+plotH)+'" stroke="#2f6b4d" stroke-width="1.5" stroke-dasharray="3 4"/><text x="'+xVal(top10)+'" y="'+(pad.t+plotH+36)+'" text-anchor="middle" font-size="10" fill="#2f6b4d">Top 10 % '+fmtTime(top10)+'</text><text x="'+pad.l+'" y="'+(h-8)+'" text-anchor="start" font-size="10" fill="#657066">'+fmtTime(min)+'</text><text x="'+(w-pad.r)+'" y="'+(h-8)+'" text-anchor="end" font-size="10" fill="#657066">'+fmtTime(max)+'</text>'+markerHtml+'</svg><div class="distribution-meta"><span><strong>'+values.length+'</strong> Finisher</span><span><strong>'+fmtTime(median)+'</strong> Median</span><span><strong>'+fmtTime(top10)+'</strong> Top-10-%-Grenze</span></div>';
  }

  function comparePercentileChart(a,b){
    const ma=splitMap(a),mb=splitMap(b);
    let order=a.race===b.race?raceOrder(a.race):raceOrder(a.race).filter(cp=>raceOrder(b.race).includes(cp));
    const pts=order.filter(cp=>ma[cp]&&mb[cp]&&ma[cp].rankOverall&&mb[cp].rankOverall).map(cp=>({label:cp,a:percentile(ma[cp].rankOverall,ma[cp].fieldOverall),b:percentile(mb[cp].rankOverall,mb[cp].fieldOverall)}));
    if(pts.length<2)return '<div class="empty-state">Noch nicht genug gemeinsame Rangpunkte.</div>';
    const w=Math.max(700,pts.length*92),h=330,pad={l:50,r:24,t:30,b:78};
    const x=i=>pad.l+i*((w-pad.l-pad.r)/(pts.length-1));
    const y=v=>pad.t+(100-v)/100*(h-pad.t-pad.b);
    const grid=[0,25,50,75,90,100].map(v=>'<g><line x1="'+pad.l+'" y1="'+y(v)+'" x2="'+(w-pad.r)+'" y2="'+y(v)+'" stroke="'+(v===90?'#a9bda9':'#e3e8e1')+'" '+(v===90?'stroke-dasharray="5 5"':'')+'/><text x="'+(pad.l-8)+'" y="'+(y(v)+4)+'" text-anchor="end" font-size="10" fill="#657066">'+v+'</text></g>').join('');
    const la=pts.map((q,i)=>x(i)+','+y(q.a)).join(' '),lb=pts.map((q,i)=>x(i)+','+y(q.b)).join(' ');
    return '<svg viewBox="0 0 '+w+' '+h+'" role="img" aria-label="Perzentile im Vergleich">'+grid+'<polyline points="'+la+'" fill="none" stroke="#173d2d" stroke-width="3.5"/><polyline points="'+lb+'" fill="none" stroke="#d96c43" stroke-width="3.5"/>'+pts.map((q,i)=>'<g><circle cx="'+x(i)+'" cy="'+y(q.a)+'" r="4.5" fill="#173d2d"/><circle cx="'+x(i)+'" cy="'+y(q.b)+'" r="4.5" fill="#d96c43"/><text transform="translate('+x(i)+' '+(h-pad.b+22)+') rotate(-35)" text-anchor="end" font-size="11" fill="#657066">'+esc(q.label)+'</text></g>').join('')+'</svg><div class="chart-legend"><span><i class="legend-dot person-a"></i>'+esc(a.displayName)+'</span><span><i class="legend-dot person-b"></i>'+esc(b.displayName)+'</span><span class="muted">P90 = Top 10 %</span></div>';
  }

  function singleEnhancement(p){
    const def=benchmarkDef();
    return '<div id="v3-single-visuals" class="v3-visuals"><div class="visual-grid"><div class="panel card visual-card"><div class="visual-title"><div><span class="section-kicker">Zeitverlauf</span><h3>Abstand zum '+esc(def.label)+'</h3><p class="panel-sub">Kumulativer Zeitabstand an jedem Messpunkt. Unter der Nulllinie bedeutet schneller als die Referenz.</p></div></div><div class="chart-scroll"><div class="chart-host">'+gapChart(p)+'</div></div></div><div class="panel card visual-card"><div class="visual-title"><div><span class="section-kicker">Feldvergleich</span><h3>Zielzeit-Verteilung · '+esc(p.race)+'</h3><p class="panel-sub">Wo die Zielzeit innerhalb aller offiziellen Finisher dieser Distanz liegt.</p></div></div><div class="chart-scroll"><div class="chart-host">'+distributionChart(p.race,[{person:p,color:'#173d2d'}])+'</div></div>'+(p.officialFinisher?'':'<div class="notice compact">Kein offizielles Zielresultat: Die Feldverteilung bleibt sichtbar, aber es wird keine persönliche Zielmarke eingezeichnet.</div>')+'</div></div><div class="panel card visual-card heat-card"><div class="visual-title"><div><span class="section-kicker">Abschnittsprofil</span><h3>Section Heatmap · vs. '+esc(def.label)+'</h3><p class="panel-sub">Jede Kachel zeigt sofort, welche Abschnitte relativ zur gewählten Referenz besonders stark oder schwach waren.</p></div></div>'+heatmap(p)+'</div></div>';
  }

  function compareEnhancement(a,b){
    let distribution='';
    if(a.race===b.race){
      distribution='<div class="panel card visual-card"><span class="section-kicker">Feldvergleich</span><h3>Beide Zielzeiten im Feld</h3><p class="panel-sub">Gemeinsame Verteilung für '+esc(a.race)+'.</p><div class="chart-scroll"><div class="chart-host">'+distributionChart(a.race,[{person:a,color:'#173d2d'},{person:b,color:'#d96c43'}])+'</div></div></div>';
    }else{
      distribution='<div class="visual-grid"><div class="panel card visual-card"><span class="section-kicker">'+esc(a.race)+'</span><h3>'+esc(a.displayName)+' im Feld</h3><div class="chart-scroll"><div class="chart-host">'+distributionChart(a.race,[{person:a,color:'#173d2d'}])+'</div></div></div><div class="panel card visual-card"><span class="section-kicker">'+esc(b.race)+'</span><h3>'+esc(b.displayName)+' im Feld</h3><div class="chart-scroll"><div class="chart-host">'+distributionChart(b.race,[{person:b,color:'#d96c43'}])+'</div></div></div></div>';
    }
    return '<div id="v3-compare-visuals" class="v3-visuals"><div class="panel card visual-card"><span class="section-kicker">Relative Position</span><h3>Perzentil-Verlauf im direkten Vergleich</h3><p class="panel-sub">Die Kurven vergleichen die Position im jeweiligen Feld, nicht nur die absolute Zeit.</p><div class="chart-scroll"><div class="chart-host">'+comparePercentileChart(a,b)+'</div></div></div>'+distribution+'<div class="visual-grid"><div class="panel card visual-card heat-card"><span class="section-kicker">'+esc(a.displayName)+'</span><h3>Section Heatmap</h3>'+heatmap(a)+'</div><div class="panel card visual-card heat-card"><span class="section-kicker">'+esc(b.displayName)+'</span><h3>Section Heatmap</h3>'+heatmap(b)+'</div></div></div>';
  }

  function enhance(){
    const single=$('#singleView'),compare=$('#compareView');
    if(single&&!single.classList.contains('hidden')&&!$('#v3-single-visuals')){
      const p=resolvePerson('a','#personAInput');
      if(p){const target=single.querySelector('.table-card');if(target)target.insertAdjacentHTML('beforebegin',singleEnhancement(p));else single.insertAdjacentHTML('beforeend',singleEnhancement(p));}
    }
    if(compare&&!compare.classList.contains('hidden')&&!$('#v3-compare-visuals')){
      const a=resolvePerson('a','#personAInput'),b=resolvePerson('b','#personBInput');
      if(a&&b){const target=compare.querySelector('.table-card');if(target)target.insertAdjacentHTML('beforebegin',compareEnhancement(a,b));else compare.insertAdjacentHTML('beforeend',compareEnhancement(a,b));}
    }
  }

  let queued=false;
  const observer=new MutationObserver(()=>{
    if(queued)return;
    queued=true;
    requestAnimationFrame(()=>{queued=false;enhance();});
  });
  observer.observe(document.body,{childList:true,subtree:true});
  window.addEventListener('popstate',()=>setTimeout(enhance,0));
  enhance();
})();
