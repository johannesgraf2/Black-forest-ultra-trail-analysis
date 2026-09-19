const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.join(__dirname, '..');
const context = {window: {}};
vm.createContext(context);
for (const file of ['data.js', 'analytics.js']) vm.runInContext(fs.readFileSync(path.join(root,file),'utf8'), context);
const data = context.window.BFUTR_DATA, analytics = context.window.BFUTR_ANALYTICS;
const quantile = (values,q) => {
  const sorted=values.slice().sort((a,b)=>a-b);
  if(!sorted.length)return null;
  const pos=(sorted.length-1)*q, lo=Math.floor(pos), hi=Math.ceil(pos);
  return sorted[lo]*(1-(pos-lo))+sorted[hi]*(pos-lo);
};
const near = (actual,expected) => expected===null ? assert.equal(actual,null) : assert.ok(Math.abs(actual-expected)<1e-7, actual+' != '+expected);
let checks=0;
for (const race of Object.keys(data.raceOrders)) {
  for (const [group,gender] of [['all',null],['men','Männer'],['women','Frauen']]) {
    analytics.setGroup(group);
    const expected=data.participants.filter(p=>p.race===race&&(!gender||p.gender===gender));
    const stats=analytics.raceStats(race);
    assert.equal(stats.participants.length,expected.length);
    const finish=expected.filter(p=>p.officialFinisher).map(p=>p.finalSec);
    assert.equal(stats.finish.count,finish.length);
    for(const [key,q] of [['medianSec',.5],['top10Sec',.1],['winnerSec',0]]) near(stats.finish[key],quantile(finish,q));
    data.raceOrders[race].forEach((cp,index,order)=>{
      const values=expected.filter(p=>cp!=='Ziel'||p.officialFinisher).map(p=>p.splits.find(s=>s.checkpoint===cp)?.sec).filter(x=>typeof x==='number');
      assert.equal(stats.passage[cp].count,values.length);
      for(const [key,q] of [['medianSec',.5],['top10Sec',.1],['winnerSec',0]])near(stats.passage[cp][key],quantile(values,q));
      if(!index)return;
      const before=order[index-1];
      const sections=expected.filter(p=>cp!=='Ziel'||p.officialFinisher).map(p=>{const a=p.splits.find(s=>s.checkpoint===before),b=p.splits.find(s=>s.checkpoint===cp);return a&&b?Math.round((b.sec-a.sec)*10)/10:null;}).filter(x=>typeof x==='number'&&x>=0);
      const actual=stats.section[before+' → '+cp];
      assert.equal(actual.count,sections.length);
      for(const [key,q] of [['medianSec',.5],['top10Sec',.1],['winnerSec',0]])near(actual[key],quantile(sections,q));
      checks++;
    });
  }
}
analytics.setGroup('men');
const male=analytics.raceStats('BFUTR 19');
assert.ok(male.participants.some(p=>p.bib==='4267'));
assert.equal(male.passage['Schützen'].count,148);
assert.equal(male.finish.count,146);
analytics.setGroup('women');assert.equal(analytics.raceStats('BFUTR 19').finish.count,98);
analytics.setGroup('all');assert.equal(analytics.raceStats('BFUTR 19').finish.count,245);
assert.ok(analytics.raceStats('BFUTR 19').participants.some(p=>p.gender==='Nichtbinär'));
analytics.setGroup('__proto__');assert.equal(analytics.getGroup(),'all');
assert.equal(analytics.raceStats('Missing').finish.medianSec,null);
// Ungewertete Zielmessungen dürfen niemals Ziel-Benchmarks beeinflussen.
const synthetic = {window:{BFUTR_DATA:{raceOrders:{Test:['Start','CP','Ziel']},participants:[
  {race:'Test',gender:'Männer',officialFinisher:true,finalSec:100,splits:[{checkpoint:'Start',sec:0},{checkpoint:'CP',sec:50},{checkpoint:'Ziel',sec:100}]},
  {race:'Test',gender:'Männer',officialFinisher:false,finalSec:10,splits:[{checkpoint:'Start',sec:0},{checkpoint:'CP',sec:5},{checkpoint:'Ziel',sec:10}]},
  {race:'Test',gender:'Offen',officialFinisher:false,finalSec:null,splits:[{checkpoint:'Start',sec:0},{checkpoint:'CP',sec:NaN}]}
]}}};
vm.createContext(synthetic);vm.runInContext(fs.readFileSync(path.join(root,'analytics.js'),'utf8'),synthetic);
const test=synthetic.window.BFUTR_ANALYTICS;
assert.equal(test.raceStats('Test').passage.CP.count,2);
assert.equal(test.raceStats('Test').passage.Ziel.winnerSec,100);
assert.equal(test.raceStats('Test').section['CP → Ziel'].winnerSec,50);
assert.equal(test.raceStats('Test').section['Start → CP'].winnerSec,5);
test.setGroup('women');assert.equal(test.raceStats('Test').finish.count,0);
console.log('OK: all five races × three groups, '+checks+' section distributions; finish eligibility, missing data, category handling.');
