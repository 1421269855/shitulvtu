/* 国级模块验证：回归对比 + 定向条件测试 */
const fs = require('fs'), vm = require('vm'), path = require('path');
const base = path.join(__dirname, 'js');
const store = {};
const sandbox = {};
sandbox.window = sandbox; sandbox.console = console;
sandbox.localStorage = { getItem: k => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v) }, removeItem: k => { delete store[k] } };
vm.createContext(sandbox);
['data.js', 'posts.js', 'events.js', 'engine.js'].forEach(f =>
  vm.runInContext(fs.readFileSync(path.join(base, f), 'utf8'), sandbox, { filename: f }));

const D = sandbox.GameData, P = sandbox.GamePosts, E = sandbox.Engine;
console.log('岗位总数:', P.POSTS.length, '| 副国级岗位:', P.byTier('national_v').length, '| 正国级岗位:', P.byTier('national').length,
  '| 国级事件:', sandbox.GameEvents.NATIONAL.length, '| 结局总数:', D.ENDINGS.length, '| 职级数:', D.RANKS.length);

/* ---------- 1. 低职级晋升池不得出现国级岗位 ---------- */
E.newGame('town');
let leak = 0;
for (let nextIdx = 1; nextIdx <= 7; nextIdx++) {
  for (let k = 0; k < 300; k++) {
    E.buildCandidates(nextIdx).forEach(c => { if (c.tier === 'national_v' || c.tier === 'national') leak++; });
  }
}
console.log('✅ 低职级晋升池国级岗位泄漏:', leak, leak === 0 ? '(通过)' : '(❌ 失败)');
// 副国/正国池校验
const v8 = E.buildCandidates(8), v9 = E.buildCandidates(9);
console.log('  晋升副国候选:', v8.map(c => c.name + '(' + c.tier + ')').join('、'));
console.log('  晋升正国候选:', v9.map(c => c.name + '(' + c.tier + ')').join('、'));

/* ---------- 2. 定向条件测试：副国/正国晋升概率 ---------- */
function forceState(rankIdx, tier, wantChief) {
  E.newGame('town');
  const S = E.S;
  S.rankIdx = rankIdx;
  S.rankYears = 9;
  S.age = 55;
  S.probation = false;
  const list = P.byTier(tier);
  S.postId = (wantChief ? list.filter(p => p.chief)[0] : list[0]).id;
  S.chiefTiers = { town: true, county: true, city: true, province: true };
  S.flags = { highInspect: true };
  S.gradeHist = ['优秀', '优秀', '优秀', '优秀', '优秀', '优秀', '优秀'];
  S.counters = { hazardBury: 0, hazardBlow: 0, hazardMax: 0, secondment: 0, rotation: 0, selection: 0, inspect: 5, jlPlus: 0, townYears: 5, provinceYears: 5 };
  S.hazards = [];
  S.frozen = 0;
  return S;
}
function tryPromote(rankIdx, tier, n) {
  let ok = 0;
  for (let i = 0; i < n; i++) {
    forceState(rankIdx, tier, true);
    E.runYearEnd();
    const step = E.S.settle.find(s => s.k === 'promote');
    if (step && step.needChoice === 'post') ok++;
  }
  return (ok / n * 100).toFixed(1) + '%';
}
console.log('✅ 条件全满足时晋升成功率  副国:', tryPromote(7, 'province', 1200), '| 正国:', tryPromote(8, 'national_v', 1200));

/* 分项拦截测试 */
function blocked(mut) {
  forceState(7, 'province', true); mut(E.S); E.runYearEnd();
  const st = E.S.settle.find(s => s.k === 'promote');
  return !(st && st.needChoice === 'post');
}
const cases = {
  '缺基层主官履历': s => { s.chiefTiers = { county: true, city: true, province: true }; },
  '缺县域主官履历': s => { s.chiefTiers = { town: true, city: true, province: true }; },
  '缺地市主官履历': s => { s.chiefTiers = { town: true, county: true, province: true }; },
  '缺省直主官履历': s => { s.chiefTiers = { town: true, county: true, city: true }; },
  '有隐患埋雷记录': s => { s.counters.hazardBury = 1; },
  '有隐患爆发记录': s => { s.counters.hazardBlow = 1; },
  '优秀次数不足': s => { s.gradeHist = ['优秀', '优秀', '合格']; },
  '考察次数不足': s => { s.counters.inspect = 1; },
  '未触发高阶专项考察': s => { s.flags = {}; },
  '现任非核心主官岗位': s => { s.postId = P.byTier('province').filter(p => !p.chief)[0].id; }
};
console.log('✅ 前置条件拦截校验（全部应为 true=被拦截）:');
Object.keys(cases).forEach(k => {
  let allBlocked = true;
  for (let i = 0; i < 25; i++) if (!blocked(cases[k])) { allBlocked = false; break; }
  console.log('   ' + (allBlocked ? '✓' : '✗') + ' ' + k + ': ' + allBlocked);
});
// 跳级拦截：正厅以下不得直接晋升副国（层级只能逐级）
(function () {
  let bad = 0, checked = 0;
  for (let r = 0; r <= 6; r++) {
    for (let k = 0; k < 40; k++) {
      forceState(r, 'province', true); E.runYearEnd();
      const st = E.S.settle.find(s => s.k === 'promote');
      if (st && st.needChoice === 'post') { checked++; if (st.nextRankIdx !== r + 1) bad++; }
    }
  }
  console.log('✅ 严禁跳级：' + checked + ' 次晋升中越级次数 =', bad, bad === 0 ? '(通过)' : '(❌)');
})();

/* ---------- 3. 常规模拟回归 ---------- */
function playOne(bgId, strategy) {
  E.newGame(bgId);
  let guard = 0;
  while (!E.S.ended && guard++ < 5000) {
    if (E.S.quarter < 4) {
      const sc = E.nextQuarterScene();
      if (sc && sc.kind === 'event' && sc.ev.o && sc.ev.o.length) {
        let idx = (strategy === 'safe' || strategy === 'ideal') ? 0 : (strategy === 'bold' ? Math.min(1, sc.ev.o.length - 1) : Math.floor(Math.random() * sc.ev.o.length));
        const o = sc.ev.o[idx];
        E.applyFx(o.f); E.buryHazard(o.h); E.log('重大抉择', o.lg || o.x);
      }
    } else {
      const steps = E.runYearEnd();
      for (const st of steps) {
        if (st.needChoice === 'post') {
          let c;
          if (strategy === 'ideal') {
            // 最优玩法：始终优先核心主官岗；在已覆盖层级之外优先补四段履历
            const groups = { town: 'grassroot', suburb: 'county', county: 'county', city: 'city', province: 'province' };
            let best = null, bs = -1;
            st.choices.forEach(x => {
              const p = P.get(x.id); if (!p) return;
              let sc = 0;
              if (p.chief) sc += 100;
              if (p.chief && !E.S.chiefTiers[p.tier]) sc += 50;
              sc += Math.random() * 5;
              if (sc > bs) { bs = sc; best = x; }
            });
            c = best || st.choices[Math.floor(Math.random() * st.choices.length)];
          } else c = st.choices[Math.floor(Math.random() * st.choices.length)];
          E.assignPost(c.id, true);
        } else if (st.needChoice === 'special') {
          const c = st.choices[strategy === 'ideal' ? 0 : Math.floor(Math.random() * st.choices.length)];
          const opt = c._opt;
          E.applyFx(opt.f); E.buryHazard(opt.h); E.log(st.spKey, opt.log);
          if (opt.special === 'rotate') {
            const cur = E.curPost(); const list = P.byTier(cur.tier).filter(p => p.id !== cur.id);
            if (list.length) E.assignPost(list[Math.floor(Math.random() * list.length)].id, false);
          } else if (opt.special === 'select') {
            E.S.counters.selection++;
            if (Math.random() < 0.20 + E.S.stats.yx / 500 + E.S.stats.cg / 700) E.selectTransfer();
          } else if (opt.special === 'highInspect') {
            E.S.flags = E.S.flags || {}; E.S.flags.highInspect = true;
          }
          if (st.spKey === '借调') E.S.counters.secondment++;
          if (st.spKey === '轮岗') E.S.counters.rotation++;
          if (st.spKey === '考察') E.S.counters.inspect++;
        } else if (st.needChoice === 'retire') {
          if (Math.random() < 0.04) { E.S.ended = true; E.S.endReason = 'early'; }
        }
      }
      if (E.S.ended) break;
      E.enterNextYear();
    }
  }
  if (!E.S.ended) { E.S.ended = true; E.S.endReason = 'force'; }
  const r = E.evaluateEnding();
  return { ending: r.ending.title, rank: E.S.rankIdx, rankName: D.RANKS[E.S.rankIdx].name, blow: E.S.counters.hazardBlow, posts: Object.keys(E.S.postYears).length };
}
const N = 900, STR = ['safe', 'bold', 'rand'];
const endCount = {}, rankCount = {}; let blow = 0, natCount = 0;
for (let i = 0; i < N; i++) {
  const r = playOne(D.BACKGROUNDS[i % 4].id, STR[i % 3]);
  endCount[r.ending] = (endCount[r.ending] || 0) + 1;
  rankCount[r.rankName] = (rankCount[r.rankName] || 0) + 1;
  blow += r.blow; if (r.rank >= 8) natCount++;
}
console.log('\n=== ' + N + ' 局回归模拟 ===');
console.log('国级达成:', natCount, '(' + (natCount / N * 100).toFixed(2) + '%)');
console.log('平均隐患爆发:', (blow / N).toFixed(2));
console.log('职级分布:', Object.keys(rankCount).sort((a, b) => rankCount[b] - rankCount[a]).map(k => k + ' ' + rankCount[k]).join(' | '));
console.log('结局分布:');
Object.keys(endCount).sort((a, b) => endCount[b] - endCount[a]).forEach(k => console.log('   ' + k + ': ' + endCount[k]));

/* ---------- 4. 理想玩法（全程审慎 + 优先核心主官岗）下的国级达成率 ---------- */
const M = 4000;
let iv = 0, it = 0; const ir = {}, ie = {};
for (let i = 0; i < M; i++) {
  const r = playOne(D.BACKGROUNDS[i % 4].id, 'ideal');
  ir[r.rankName] = (ir[r.rankName] || 0) + 1;
  ie[r.ending] = (ie[r.ending] || 0) + 1;
  if (r.rank === 8) iv++; else if (r.rank >= 9) it++;
}
console.log('\n=== 理想玩法 ' + M + ' 局 ===');
console.log('副国级达成:', iv, '| 正国级达成:', it, '| 合计:', ((iv + it) / M * 100).toFixed(2) + '%');
console.log('职级分布:', Object.keys(ir).sort((a, b) => ir[b] - ir[a]).map(k => k + ' ' + ir[k]).join(' | '));
console.log('结局:', Object.keys(ie).sort((a, b) => ie[b] - ie[a]).map(k => k + ' ' + ie[k]).join(' | '));
