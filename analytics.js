(function () {
  'use strict';
  const data = window.BFUTR_DATA;
  const groups = {all: 'Alle', men: 'Männer', women: 'Frauen'};
  const cache = new Map();
  let group = 'all';
  const validTime = value => typeof value === 'number' && Number.isFinite(value) && value >= 0;

  function quantile(values, q) {
    const sorted = values.filter(validTime).slice().sort((a, b) => a - b);
    if (!sorted.length) return null;
    const position = (sorted.length - 1) * q;
    const lo = Math.floor(position), hi = Math.ceil(position);
    return sorted[lo] + (sorted[hi] - sorted[lo]) * (position - lo);
  }

  function summarize(values) {
    return {
      count: values.length,
      medianSec: quantile(values, 0.5),
      top10Sec: quantile(values, 0.1),
      winnerSec: quantile(values, 0)
    };
  }

  function raceStats(race) {
    const key = JSON.stringify([race, group]);
    if (cache.has(key)) return cache.get(key);
    const participants = data.participants.filter(p => p.race === race && (group === 'all' || p.gender === groups[group]));
    const order = data.raceOrders[race] || [];
    const records = participants.map(person => ({person, splits: Object.fromEntries(person.splits.map(s => [s.checkpoint, s]))}));
    const passage = {}, section = {};
    // Ziel-Referenzen enthalten nur gewertete Finisher; frühere Messungen bleiben nutzbar.
    function timeAt(record, checkpoint) {
      if (checkpoint === 'Ziel' && !record.person.officialFinisher) return null;
      const split = record.splits[checkpoint];
      return split && validTime(split.sec) ? split.sec : null;
    }
    order.forEach((checkpoint, index) => {
      passage[checkpoint] = summarize(records.map(r => timeAt(r, checkpoint)).filter(validTime));
      if (!index) return;
      const previous = order[index - 1];
      const values = records.map(record => {
        const start = timeAt(record, previous), end = timeAt(record, checkpoint);
        return start !== null && end !== null && end >= start ? Math.round((end - start) * 10) / 10 : null;
      }).filter(validTime);
      section[previous + ' → ' + checkpoint] = summarize(values);
    });
    const finishTimes = participants.filter(p => p.officialFinisher && validTime(p.finalSec)).map(p => p.finalSec).sort((a, b) => a - b);
    const result = {participants, passage, section, finishTimes, finish: summarize(finishTimes)};
    cache.set(key, result);
    return result;
  }

  window.BFUTR_ANALYTICS = {
    groups,
    setGroup(value) { group = Object.hasOwn(groups, value) ? value : 'all'; },
    getGroup() { return group; },
    groupLabel() { return groups[group]; },
    raceStats,
    quantile
  };
})();
