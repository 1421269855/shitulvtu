/* 时序冒烟测试：最小 DOM 桩驱动真实 UI 流程，验证「4 季度后才有年末结算」 */
const fs = require('fs'), vm = require('vm'), path = require('path');
const base = path.join(__dirname, 'js');

/* ---- 最小 DOM 桩 ---- */
const els = {};
function makeEl(id) {
  const el = {
    id: id || null, _html: '', onclick: null, textContent: '', disabled: false, dataset: {},
    classList: { _s: {}, add(c){this._s[c]=1;}, remove(c){delete this._s[c];}, toggle(c){this._s[c]?delete this._s[c]:this._s[c]=1;}, contains(c){return !!this._s[c];} },
    _children: [],
    get innerHTML() { return this._html; },
    set innerHTML(v) { this._html = v; this._children = parseChildren(v); this._children.forEach(c => { if (c.id) els[c.id] = c; }); },
    querySelectorAll(sel) { return queryAll(this, sel); },
    appendChild() {}, remove() {}, setAttribute() {},
    getAttribute(k) { const key = k.replace(/^data-/, ''); return this.dataset ? (this.dataset[key] !== undefined ? this.dataset[key] : null) : null; }
  };
  return el;
}
function parseChildren(html) {
  const out = [];
  let m, re = /id="([^"]+)"/g;
  while ((m = re.exec(html))) out.push(makeEl(m[1]));
  re = /data-(opt|post|sp|rt|bg|load|save|del|close)="([^"]*)"/g;
  while ((m = re.exec(html))) { const e = makeEl(null); e.dataset[m[1]] = m[2]; out.push(e); }
  if (/class="mask"|<div class="mask"/.test(html)) { const e = makeEl(null); e.classList.add('mask'); out.push(e); }
  return out;
}
function queryAll(el, sel) {
  if (sel[0] === '[') { const k = sel.slice(6, -1); return el._children.filter(c => c.dataset[k] !== undefined); }
  if (sel[0] === '.') { const k = sel.slice(1); return el._children.filter(c => c.dataset[k] || (c.classList && c.classList.contains(k))); }
  return [];
}
const document = {
  getElementById(id) { if (!els[id]) els[id] = makeEl(id); return els[id]; },
  createElement() { return makeEl(null); },
  body: makeEl('body')
};
const sandbox = {
  window: {}, console,
  document, localStorage: { _d:{}, getItem(k){return k in this._d?this._d[k]:null;}, setItem(k,v){this._d[k]=String(v);}, removeItem(k){delete this._d[k];} },
  setTimeout(){}, location: { reload(){} }, Math, Date, JSON
};
sandbox.window = sandbox;
vm.createContext(sandbox);
['data.js','posts.js','events.js','engine.js','ui.js'].forEach(f =>
  vm.runInContext(fs.readFileSync(path.join(base, f), 'utf8'), sandbox, { filename: f }));
const EN = sandbox.Engine, UI = sandbox.UI, D = sandbox.GameData;

/* ---- 时序探针 ---- */
let qEvents = 0, bad = 0, yearEventCounts = [], curYear = EN.S ? EN.S.year : null;
const origNQS = EN.nextQuarterScene;
EN.nextQuarterScene = function () { const r = origNQS.apply(this, arguments); if (r && r.kind === 'event') qEvents++; return r; };
const origRYE = EN.runYearEnd;
EN.runYearEnd = function () {
  if (EN.S.quarter !== 4) { console.log('❌ 年终结算在 quarter=' + EN.S.quarter + ' 触发（应=4）'); bad++; }
  if (qEvents !== 4) { console.log('❌ 本年季度事件数=' + qEvents + '（应=4）'); bad++; }
  yearEventCounts.push(qEvents); qEvents = 0;
  return origRYE.apply(this, arguments);
};

/* ---- 驱动真实 UI 流程 ---- */
EN.newGame('town');
UI.startGame();
const stage = document.getElementById('stage');
let iter = 0, ended = false;
while (iter++ < 30000) {
  const mode = UI.mode;
  if (mode === 'idle' || mode === 'yearend') { UI.onNext(); }
  else if (mode === 'event') {
    const opts = stage._children.filter(c => c.dataset.opt !== undefined);
    if (opts.length) opts[0].onclick();
    else if (els.evDone && els.evDone.onclick) els.evDone.onclick();
    else { console.log('⚠ 事件无选项且缺 evDone，卡住'); break; }
  }
  else if (mode === 'result') { if (els.resDone && els.resDone.onclick) els.resDone.onclick(); else break; }
  else if (mode === 'settle') {
    const st = EN.S.settle[EN.S.settleIdx];
    if (st.needChoice === 'post') { const ps = stage._children.filter(c => c.dataset.post !== undefined); ps[0].onclick(); }
    else if (st.needChoice === 'special') { const sp = stage._children.filter(c => c.dataset.sp !== undefined); sp[0].onclick(); }
    else if (st.needChoice === 'retire') { const rt = stage._children.filter(c => c.dataset.rt !== undefined); (rt[1] || rt[0]).onclick(); }
    else if (els.stepNext && els.stepNext.onclick) els.stepNext.onclick();
    else break;
  }
  else if (mode === 'ending') { ended = true; break; }
  else { console.log('⚠ 未知 mode:', mode); break; }
  if (EN.S.ended && UI.mode !== 'ending') { /* 结算内可能直接 ended */ }
}

const years = yearEventCounts.length;
const minE = Math.min.apply(null, yearEventCounts), maxE = Math.max.apply(null, yearEventCounts);
const allFour = yearEventCounts.every(c => c === 4);
console.log('=== 时序冒烟结果 ===');
console.log('驱动迭代:', iter, '| 游戏结束:', ended, '| 经历年数:', years);
console.log('每年季度事件数:', yearEventCounts.slice(0, 12).join(','), years > 12 ? ' …' : '');
console.log('最小值/最大值:', minE, '/', maxE, '| 每年均为 4 季度:', allFour);
console.log('违规（提前/错季结算）次数:', bad);
console.log(bad === 0 && allFour && years >= 3 ? '✅ 时序正确：固定 Q1→Q2→Q3→Q4 后才有年末结算' : '❌ 时序仍存在问题');
