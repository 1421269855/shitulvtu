/* ============================================================
 * 界面渲染层
 * 严格遵守：不显示任何后台数值、选项无视觉好坏区分
 * ============================================================ */
(function (global) {
  'use strict';

  var D = global.GameData, P = global.GamePosts, EN = global.Engine;
  var esc = EN.util.esc, pick = EN.util.pick, ri = EN.util.ri;
  var $ = function (id) { return document.getElementById(id); };

  var UI = { mode: 'intro', curEvent: null, curOpt: null };

  /* ---------------- 定性描述（不展示任何数值） ---------------- */
  function level(v, arr) {
    // arr: [[阈值, 描述], ...] 从低到高
    var r = arr[0][1];
    for (var i = 0; i < arr.length; i++) { if (v >= arr[i][0]) r = arr[i][1]; }
    return r;
  }
  var MERIT_LV = [[0, '尚待积累'], [18, '初有起色'], [45, '稳步积累'], [85, '较为扎实'], [135, '成效明显'], [190, '颇为突出']];
  var JL_LV = [[0, '问题较多'], [65, '存有瑕疵'], [80, '偶有疏失'], [95, '规矩本分'], [110, '严谨自律']];
  var IMP_LV = [[0, '鲜有印象'], [25, '略有印象'], [45, '有所了解'], [70, '印象较好'], [100, '印象深刻']];

  /* ---------------- 顶栏 / 侧栏 ---------------- */
  function renderTop() {
    var S = EN.S; if (!S) return;
    var p = EN.curPost();
    var q = Math.min(S.quarter + 1, 4);
    var qtxt = (S.settle ? '第四季度' : D.C.QUARTERS[q - 1]);
    $('tbStats').innerHTML =
      '<span><span class="tb-k">年份</span> <b>' + S.year + '</b></span>' +
      '<span><span class="tb-k">季度</span> <b>' + qtxt + '</b></span>' +
      '<span><span class="tb-k">年龄</span> <b>' + S.age + '</b></span>' +
      '<span><span class="tb-k">工龄</span> <b>' + S.seniority + '</b></span>' +
      '<span><span class="tb-k">属地</span> <b>' + D.TIER_NAME[p.tier] + '</b></span>' +
      '<span><span class="tb-k">岗位</span> <b>' + esc(p.name) + '</b></span>';
  }

  function renderSide() {
    var S = EN.S; if (!S) return;
    var p = EN.curPost();
    var st = S.stats;

    var prob = S.probation ? '试用期（第 ' + S.probationYear + ' 年）' : '已转正';
    $('spProfile').innerHTML =
      kv('现任岗位', esc(p.name)) +
      kv('所属层级', D.TIER_NAME[p.tier]) +
      kv('现任职级', EN.curRank().name) +
      kv('任职状态', prob) +
      kv('本级任职', S.rankYears + ' 年') +
      kv('起始年份', D.C.START_YEAR + ' 年入职');

    $('spMerit').innerHTML =
      kv('民生政绩', level(st.mz, MERIT_LV)) +
      kv('常规政绩', level(st.cg, MERIT_LV)) +
      kv('攻坚政绩', level(st.gj, MERIT_LV)) +
      kv('纪律状态', level(st.jl, JL_LV)) +
      kv('组织印象', level(st.yx, IMP_LV)) +
      kv('群众口碑', level(st.kb, IMP_LV));

    var recent = S.logs.slice(-3).reverse();
    $('spRecent').innerHTML = recent.length ? recent.map(function (l) {
      return '<div class="li"><div class="lt">' + l.y + ' 年 · ' + esc(l.type) + '</div>' + esc(l.c) + '</div>';
    }).join('') : '<div class="quiet">暂无记录</div>';

    var rs = S.resume.slice(-6).reverse();
    $('spResume').innerHTML = rs.map(function (r) {
      var pp = P.get(r.postId);
      return '<div class="ri"><div class="ry">' + r.y + ' — ' + (r.endY === null ? '至今' : r.endY) + '</div>' +
        esc(pp ? pp.name : '') + '<div class="quiet">' + esc(r.rankName) + '</div></div>';
    }).join('');
  }

  function kv(k, v) { return '<div class="kv"><span>' + k + '</span><span>' + v + '</span></div>'; }

  /* 选项文本兜底：undefined / null / 空串一律显示占位文案，避免界面出现 "undefined" */
  function optText(v) {
    var t = (v === undefined || v === null || String(v).trim() === '') ? '（选项加载异常）' : String(v);
    return esc(t);
  }

  function renderAll() { renderTop(); renderSide(); }

  /* ---------------- 开篇 ---------------- */
  function showIntro() {
    UI.mode = 'intro';
    $('topbar').classList.add('hidden');
    $('app').classList.add('hidden');
    $('botbar').classList.add('hidden');
    var el = document.createElement('div');
    el.style.cssText = 'position:fixed;inset:0;overflow-y:auto;background:#F4F5F5;padding:26px 16px 40px;z-index:50;';
    el.innerHTML =
      '<div style="max-width:600px;margin:0 auto;">' +
      '<div class="doc-head"><div class="t1">仕途履途</div>' +
      '<div class="t2">文 字 模 拟 抉 择 游 戏</div></div>' +
      '<div class="card"><div class="card-h">开篇寄语</div><div class="card-b">' +
      '<p style="margin:0 0 12px;text-indent:2em;">这是一款文字模拟抉择游戏。</p>' +
      '<p style="margin:0 0 12px;text-indent:2em;">你将扮演一名进入体制工作的普通工作人员，从入职起步，历经季度履职、年度考核、岗位选择。</p>' +
      '<p style="margin:0 0 12px;text-indent:2em;">面对基层矛盾、业务抉择、岗位机遇与潜藏风险，你的每一次选择都将塑造属于自己的职业生涯。</p>' +
      '<div class="divider"></div>' +
      '<p style="margin:0;color:#993A3A;font-size:13.5px;line-height:1.9;">⚠ 所有抉择无标准答案。部分看似稳妥的选择可能埋下隐患，看似担当的选择可能带来机遇。风险全部隐藏，需要自行权衡。</p>' +
      '</div></div>' +
      '<div class="card"><div class="card-h">选择你的出身背景<small>不同背景仅有微弱倾向，不锁定任何玩法</small></div><div class="card-b" id="bgList">' +
      D.BACKGROUNDS.map(function (b, i) {
        return '<button class="btn" data-bg="' + b.id + '"><span class="bi">' + (i + 1) + '.</span><b>' + esc(b.name) + '</b><br>' +
          '<span class="quiet">' + esc(b.desc) + '</span><br><span style="color:#8A7858;font-size:12px;">' + esc(b.note) + '</span></button>';
      }).join('') +
      '</div></div>' +
      '<div class="card" id="saveEntry"></div>' +
      '<div style="text-align:center;color:#606868;font-size:12px;line-height:1.9;padding:10px 0;">' +
      '全部数据仅保存在本机浏览器 · 无网络请求 · 可随时存档读档</div>' +
      '</div>';
    document.body.appendChild(el);
    UI.introEl = el;

    el.querySelectorAll('[data-bg]').forEach(function (b) {
      b.onclick = function () {
        EN.newGame(b.getAttribute('data-bg'));
        el.remove();
        startGame();
      };
    });
    renderSaveEntry();
  }

  function renderSaveEntry() {
    var box = $('saveEntry'); if (!box) return;
    var items = [];
    for (var i = 0; i < 3; i++) {
      var d = EN.readSlot(i);
      if (d && d.s) {
        var p = P.get(d.s.postId);
        items.push('<div class="slot"><div class="si"><b>存档 ' + (i + 1) + '</b><br>' +
          d.s.year + ' 年 · ' + esc(p ? p.name : '') + ' · ' + esc(D.RANKS[d.s.rankIdx].name) + '<br>' +
          '<span class="quiet">' + fmtTime(d.t) + '</span></div>' +
          '<div class="sa"><button class="mini" data-load="' + i + '">继续</button></div></div>');
      }
    }
    box.innerHTML = items.length
      ? '<div class="card-h">继续已有生涯</div><div class="card-b">' + items.join('') + '</div>'
      : '';
    box.querySelectorAll('[data-load]').forEach(function (b) {
      b.onclick = function () {
        if (EN.load(parseInt(b.getAttribute('data-load'), 10))) {
          UI.introEl.remove();
          startGame();
        }
      };
    });
  }

  function fmtTime(t) {
    var d = new Date(t);
    return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()) + ' ' + pad(d.getHours()) + ':' + pad(d.getMinutes());
  }
  function pad(n) { return n < 10 ? '0' + n : '' + n; }

  /* ---------------- 进入游戏 ---------------- */
  function startGame() {
    EN.ensureFields();
    $('topbar').classList.remove('hidden');
    $('app').classList.remove('hidden');
    $('botbar').classList.remove('hidden');
    renderAll();
    if (EN.S.ended) { showEnding(); return; }
    if (EN.S.settle) { UI.mode = 'settle'; renderSettleStep(); return; }
    renderStage();
  }

  /* ---------------- 中央主区域 ---------------- */
  function renderStage() {
    var S = EN.S;
    if (S.ended) { showEnding(); return; }
    if (S.settle) { renderSettleStep(); return; }

    if (S.quarter >= 4) { UI.mode = 'yearend'; renderYearEndReady(); return; }
    UI.mode = 'idle';
    renderIdle();
    updateBot();
  }

  function renderIdle() {
    var S = EN.S, p = EN.curPost();
    var q = Math.min(S.quarter + 1, 4);
    $('stage').innerHTML =
      '<div class="card"><div class="card-h">' + D.C.QUARTERS[q - 1] + '<small>' + S.year + ' 年</small></div>' +
      '<div class="card-b">' +
      '<div style="text-align:center;padding:6px 0 2px;color:#1A4748;letter-spacing:.1em;">' + esc(p.name) + '</div>' +
      '<div class="doc-meta"><span>' + D.TIER_NAME[p.tier] + '</span><span>' + EN.curRank().name + '</span><span>' + S.year + ' 年</span></div>' +
      '<div class="quiet" style="text-indent:2em;line-height:1.95;">岗位职责：' + esc(p.duty) + '</div>' +
      '<div class="divider"></div>' +
      '<div class="quiet" style="text-align:center;">本季度事务待推进，点击下方按钮继续。</div>' +
      '</div></div>';
  }

  function renderYearEndReady() {
    $('stage').innerHTML =
      '<div class="card"><div class="card-h">第四季度 · 年度结算<small>' + EN.S.year + ' 年</small></div>' +
      '<div class="card-b"><div class="quiet" style="text-indent:2em;line-height:1.95;">' +
      '本年度三个季度的履职已经结束，接下来进入年末结算：年度考核、职级晋升、纪律检查与其他事项将依次进行。' +
      '</div><div class="divider"></div><div class="center"><button class="btn-plain" id="goSettle">开始年度结算</button></div>' +
      '</div></div>';
    $('goSettle').onclick = function () {
      var steps = EN.runYearEnd();
      UI.mode = 'settle';
      renderSettleStep();
    };
    updateBot();
  }

  /* ---------------- 季度事件 ---------------- */
  function showEvent(ev) {
    UI.mode = 'event'; UI.curEvent = ev;
    var S = EN.S, p = EN.curPost();
    var head = ev.kind === 'idle' ? '日常事务' : (ev.kind === 'post' ? '岗位事务' : '日常事务');
    var showDuty = (ev.kind === 'post' || ev.kind === 'national');
    var body =
      '<div class="card"><div class="card-h">' + esc(ev.t) + '<small>' + S.year + ' 年 ' + D.C.QUARTERS[S.quarter - 1] + ' · ' + esc(p.name) + '</small></div>' +
      '<div class="card-b">' +
      (showDuty ? '<div class="quiet" style="margin-bottom:10px;">岗位职责：' + esc(p.duty) + '</div><div class="divider"></div>' : '') +
      '<div style="text-indent:2em;line-height:2.0;">' + esc(ev.b) + '</div>';

    if (!ev.o || !ev.o.length) {
      body += '<div class="divider"></div><div class="center"><button class="btn-plain" id="evDone">知悉，继续</button></div>';
    } else {
      body += '<div class="divider"></div><div class="quiet" style="margin-bottom:8px;">请选择处置方式：</div>';
      body += ev.o.map(function (o, i) {
        return '<button class="btn-opt" data-opt="' + i + '"><span class="idx">' + (i + 1) + '.</span>' + optText(o.x) + '</button>';
      }).join('');
    }
    body += '</div></div>';
    $('stage').innerHTML = body;

    if (ev.o && ev.o.length) {
      $('stage').querySelectorAll('[data-opt]').forEach(function (b) {
        b.onclick = function () { chooseEvent(parseInt(b.getAttribute('data-opt'), 10)); };
      });
    } else {
      $('evDone').onclick = function () { afterEvent(); };
    }
    updateBot();
  }

  function chooseEvent(i) {
    var ev = UI.curEvent, o = ev.o[i];
    EN.applyFx(o.f);
    if (o.f && o.f.jl > 0) EN.S.counters.jlPlus++;
    EN.buryHazard(o.h);
    EN.log('重大抉择', o.lg || o.x);
    UI.curOpt = o;
    renderEventResult(o);
  }

  function renderEventResult(o) {
    UI.mode = 'result';
    $('stage').innerHTML =
      '<div class="card"><div class="card-h">处置结果</div>' +
      '<div class="card-b">' +
      '<div class="settle-step"><div class="st">你的处置</div><div class="sv">' + esc(o.x) + '</div></div>' +
      '<div class="settle-step ' + (o.h ? 'bad' : '') + '"><div class="st">办理情况</div><div class="sv">' +
      esc(o.lg || '事项已按上述方式办理。') + '。</div></div>' +
      '<div class="quiet" style="text-indent:2em;">事项办结，相关情况已记入个人日志。</div>' +
      '<div class="divider"></div><div class="center"><button class="btn-plain" id="resDone">继续</button></div>' +
      '</div></div>';
    $('resDone').onclick = afterEvent;
    updateBot();
  }

  function afterEvent() {
    UI.mode = 'idle';
    renderAll();
    renderStage();
  }

  /* ---------------- 年末结算逐步展示 ---------------- */
  function renderSettleStep() {
    var S = EN.S, steps = S.settle;
    if (!steps) { renderStage(); return; }
    if (S.settleIdx >= steps.length) { finishSettle(); return; }

    var st = steps[S.settleIdx];
    // 已展示过的步骤以时间轴形式累加显示，营造「一整年结算单」的观感
    var hist = steps.slice(0, S.settleIdx).map(function (h) {
      return '<div class="settle-step ' + (h.cls || '') + '"><div class="st">' + esc(h.t) + '</div><div class="sv">' + h.v + '</div></div>';
    }).join('');

    var cur = '<div class="settle-step ' + (st.cls || '') + '"><div class="st">' + esc(st.t) + '</div><div class="sv">' + st.v + '</div></div>';
    var ctrl = '';

    if (st.needChoice === 'post') {
      ctrl = '<div class="divider"></div><div class="quiet" style="margin-bottom:8px;">请选择任职岗位（仅提供岗位职责，其余自行判断）：</div>' +
        st.choices.map(function (c) {
          return '<div class="post-card" data-post="' + c.id + '">' +
            '<div class="pn">' + esc(c.name) + '</div>' +
            '<div class="pd">' + esc(c.duty) + '</div>' +
            '<div class="pm">' + D.TIER_NAME[c.tier] + '</div></div>';
        }).join('');
    } else if (st.needChoice === 'special') {
      ctrl = '<div class="divider"></div>' + st.choices.map(function (c) {
        return '<button class="btn-opt" data-sp="' + c.i + '"><span class="idx">' + (c.i + 1) + '.</span>' + optText(c.x) + '</button>';
      }).join('');
    } else if (st.needChoice === 'retire') {
      ctrl = '<div class="divider"></div>' + st.choices.map(function (c) {
        return '<button class="btn-opt" data-rt="' + c.i + '"><span class="idx">' + (c.i + 1) + '.</span>' + esc(c.x) + '</button>';
      }).join('');
    } else {
      ctrl = '<div class="divider"></div><div class="center"><button class="btn-plain" id="stepNext">' +
        (S.settleIdx === steps.length - 1 ? '进入下一年' : '继续') + '</button></div>';
    }

    $('stage').innerHTML =
      '<div class="card"><div class="card-h">' + S.year + ' 年度结算<small>第 ' + (S.settleIdx + 1) + ' / ' + steps.length + ' 项</small></div>' +
      '<div class="card-b">' + hist + cur + ctrl + '</div></div>';

    if (st.needChoice === 'post') {
      $('stage').querySelectorAll('[data-post]').forEach(function (b) {
        b.onclick = function () {
          EN.assignPost(b.getAttribute('data-post'), true);
          renderAll();
          nextSettle();
        };
      });
    } else if (st.needChoice === 'special') {
      $('stage').querySelectorAll('[data-sp]').forEach(function (b) {
        b.onclick = function () {
          applySpecial(st, parseInt(b.getAttribute('data-sp'), 10));
          renderAll();
          nextSettle();
        };
      });
    } else if (st.needChoice === 'retire') {
      $('stage').querySelectorAll('[data-rt]').forEach(function (b) {
        b.onclick = function () {
          var i = parseInt(b.getAttribute('data-rt'), 10);
          var early = st.choices.filter(function (c) { return c.i === i; })[0]._early;
          if (early) { EN.S.ended = true; EN.S.endReason = 'early'; EN.log('退休', '申请提前退休，离开工作岗位。'); }
          nextSettle();
        };
      });
    } else {
      $('stepNext').onclick = nextSettle;
    }
    updateBot();
  }

  function nextSettle() {
    EN.S.settleIdx++;
    renderAll();
    if (EN.S.settleIdx >= EN.S.settle.length) finishSettle();
    else renderSettleStep();
  }

  function applySpecial(st, i) {
    var opt = st.choices.filter(function (c) { return c.i === i; })[0]._opt;
    if (!opt) return;
    EN.applyFx(opt.f);
    if (opt.f && opt.f.jl > 0) EN.S.counters.jlPlus++;
    EN.buryHazard(opt.h);
    EN.log(st.spKey, opt.log);

    if (opt.special === 'rotate') {
      var cur = EN.curPost();
      var list = P.byTier(cur.tier).filter(function (p) { return p.id !== cur.id; });
      if (list.length) EN.assignPost(pick(list).id, false);
    } else if (opt.special === 'select') {
      EN.S.counters.selection++;
      var p = 0.20 + EN.S.stats.yx / 500 + EN.S.stats.cg / 700;
      if (Math.random() < p) {
        var t = EN.selectTransfer();
        EN.log('遴选', '通过上级机关公开遴选，交流至' + t.name + '任职。');
        toast('遴选结果已公布');
      } else {
        EN.log('遴选', '参加上级机关公开遴选，未获录用。');
      }
    }
    if (opt.special === 'highInspect') {
      EN.S.flags = EN.S.flags || {};
      EN.S.flags.highInspect = true;
      EN.log('考察', '经高阶专项组织考察，纳入组织重点考察储备人选。');
      toast('已纳入组织重点考察储备人选');
    }
    if (st.spKey === '借调') EN.S.counters.secondment++;
    if (st.spKey === '轮岗') EN.S.counters.rotation++;
    if (st.spKey === '考察') EN.S.counters.inspect++;
  }

  function finishSettle() {
    var S = EN.S;
    if (S.ended) { showEnding(); return; }
    EN.enterNextYear();
    renderAll();
    renderStage();
  }

  /* ---------------- 结局页 ---------------- */
  function showEnding() {
    UI.mode = 'ending';
    var S = EN.S;
    var r = EN.finishGame();
    var e = r.ending;
    var postCount = Object.keys(S.postYears).length;
    var tail = D.RETIRE_TAIL[S.endReason] || D.RETIRE_TAIL.normal;

    var days = S.seniority;
    var body =
      '<div class="ending"><div class="ending-h">' +
      '<div class="eh1">' + esc(e.title) + '</div>' +
      '<div class="eh2">生 涯 结 语</div></div>' +
      '<div class="ending-b">' +
      '<p>' + esc(e.text) + '</p>' +
      '<p>' + esc(tail) + '</p>' +
      (r.reason ? '<p class="quiet" style="text-indent:2em;">评定依据：' + esc(r.reason) + '</p>' : '') +
      '<div class="divider"></div>' +
      '<div class="stat-grid">' +
      '<div><span>入职年份</span><span>' + D.C.START_YEAR + ' 年</span></div>' +
      '<div><span>结束年份</span><span>' + S.year + ' 年</span></div>' +
      '<div><span>在职年限</span><span>' + days + ' 年</span></div>' +
      '<div><span>最终职级</span><span>' + esc(EN.curRank().name) + '</span></div>' +
      '<div><span>最终岗位</span><span>' + esc(EN.curPost().name) + '</span></div>' +
      '<div><span>经历岗位</span><span>' + postCount + ' 个</span></div>' +
      '<div><span>考核优秀</span><span>' + countGrade('优秀') + ' 次</span></div>' +
      '<div><span>考核良好</span><span>' + countGrade('良好') + ' 次</span></div>' +
      '</div>' +
      '<div class="divider"></div>' +
      '<div class="center" style="display:flex;gap:10px;justify-content:center;flex-wrap:wrap;">' +
      '<button class="btn-plain ghost" id="endLog">查看完整履历</button>' +
      '<button class="btn-plain" id="endRestart">重新开始</button>' +
      '</div></div></div>';

    $('stage').innerHTML = body;
    $('endLog').onclick = showLogs;
    $('endRestart').onclick = function () {
      document.body.innerHTML = '<div id="modalRoot"></div><div id="toastRoot"></div>';
      location.reload();
    };
    updateBot();
  }

  function countGrade(g) {
    return EN.S.gradeHist.filter(function (x) { return x === g; }).length;
  }

  /* ---------------- 弹层：日志 / 存档 / 读档 ---------------- */
  function openModal(title, innerHTML, footHTML) {
    var root = $('modalRoot');
    root.innerHTML =
      '<div class="mask"><div class="modal">' +
      '<div class="modal-h">' + esc(title) + '</div>' +
      '<div class="modal-b">' + innerHTML + '</div>' +
      '<div class="modal-f">' + (footHTML || '<button class="xbtn" data-close>关闭</button>') + '</div>' +
      '</div></div>';
    root.querySelectorAll('[data-close]').forEach(function (b) {
      b.onclick = function () { root.innerHTML = ''; };
    });
    root.querySelector('.mask').onclick = function (ev) {
      if (ev.target === this) root.innerHTML = '';
    };
  }

  function showLogs() {
    var S = EN.S;
    var html = S.logs.length
      ? '<div class="tl">' + S.logs.map(function (l) {
        var cls = (l.type === '隐患') ? 'risk' :
          (['晋升', '转正', '遴选', '考察', '退休', '入职'].indexOf(l.type) >= 0 ? 'key' : '');
        return '<div class="tl-item ' + cls + '"><div class="tl-y">' + l.y + ' 年 · ' + esc(l.type) + '</div>' +
          '<div class="tl-c">' + esc(l.c) + '</div></div>';
      }).join('') + '</div>'
      : '<div class="quiet center">暂无记录</div>';
    openModal('完整日志履历（共 ' + S.logs.length + ' 条）', html);
  }

  function showSave() {
    var S = EN.S;
    var items = '';
    for (var i = 0; i < 3; i++) {
      var d = EN.readSlot(i);
      var p = d && d.s ? P.get(d.s.postId) : null;
      items += '<div class="slot"><div class="si"><b>存档 ' + (i + 1) + '</b><br>' +
        (d && d.s ? d.s.year + ' 年 · ' + esc(p ? p.name : '') + ' · ' + esc(D.RANKS[d.s.rankIdx].name) + '<br><span class="quiet">' + fmtTime(d.t) + '</span>'
          : '<span class="quiet">空</span>') + '</div>' +
        '<div class="sa"><button class="mini" data-save="' + i + '">存入</button>' +
        (d && d.s ? '<button class="mini danger" data-del="' + i + '">删除</button>' : '') + '</div></div>';
    }
    openModal('存档', items);
    $('modalRoot').querySelectorAll('[data-save]').forEach(function (b) {
      b.onclick = function () {
        var i = parseInt(b.getAttribute('data-save'), 10);
        if (EN.save(i)) { $('modalRoot').innerHTML = ''; toast('已存入存档 ' + (i + 1)); }
        else toast('存档失败');
      };
    });
    $('modalRoot').querySelectorAll('[data-del]').forEach(function (b) {
      b.onclick = function () {
        EN.removeSlot(parseInt(b.getAttribute('data-del'), 10));
        $('modalRoot').innerHTML = ''; showSave();
      };
    });
  }

  function showLoad() {
    var items = '';
    for (var i = 0; i < 3; i++) {
      var d = EN.readSlot(i);
      var p = d && d.s ? P.get(d.s.postId) : null;
      items += '<div class="slot"><div class="si"><b>存档 ' + (i + 1) + '</b><br>' +
        (d && d.s ? d.s.year + ' 年 · ' + esc(p ? p.name : '') + ' · ' + esc(D.RANKS[d.s.rankIdx].name) + '<br><span class="quiet">' + fmtTime(d.t) + '</span>'
          : '<span class="quiet">空</span>') + '</div>' +
        '<div class="sa">' + (d && d.s ? '<button class="mini" data-load="' + i + '">读取</button>' : '') + '</div></div>';
    }
    openModal('读档', items + '<div class="quiet" style="margin-top:10px;">读取将覆盖当前进度。</div>');
    $('modalRoot').querySelectorAll('[data-load]').forEach(function (b) {
      b.onclick = function () {
        if (EN.load(parseInt(b.getAttribute('data-load'), 10))) {
          $('modalRoot').innerHTML = '';
          startGame();
          toast('读档成功');
        }
      };
    });
  }

  /* ---------------- 自愿问题反馈面板 ---------------- */
  function showFeedback() {
    var S = EN.S;
    if (!S) { toast('请先开始游戏'); return; }

    var TYPES = [
      '时序/季度结算异常',
      '晋升、岗位逻辑错误',
      '事件文案异常',
      '潜伏隐患机制异常',
      '结局匹配错误',
      'UI显示问题',
      '其他体验建议'
    ];
    var opts = TYPES.map(function (t) {
      return '<option value="' + esc(t) + '">' + esc(t) + '</option>';
    }).join('');

    var body =
      '<p class="fb-tip">如果你遇到 BUG、逻辑异常、文案错误或体验建议，可以在此填写。' +
      '内容仅本地页面展示，不会上传任何数据，请复制反馈文本对外提交。</p>' +
      '<div class="fb-field"><label>问题类型</label>' +
      '<select id="fbType" class="fb-sel">' + opts + '</select></div>' +
      '<div class="fb-field"><label>现象描述</label>' +
      '<textarea id="fbDesc" class="fb-ta" rows="6" placeholder="请描述遇到的现象，可填写复现步骤。"></textarea></div>' +
      '<div id="fbWrap" class="fb-out-wrap" style="display:none;">' +
      '<pre id="fbOut" class="fb-out"></pre>' +
      '<div class="fb-copyrow"><button class="xbtn" id="fbCopy" style="padding:5px 14px;font-size:13px;">复制反馈文本</button></div>' +
      '</div>';

    var foot = '<button class="xbtn" id="fbGen">生成反馈文本</button><button class="xbtn" data-close>关闭</button>';
    openModal('游戏问题与体验反馈', body, foot);

    $('fbGen').onclick = function () {
      var type = $('fbType').value;
      var desc = ($('fbDesc').value || '').trim();
      if (!desc) { toast('请先填写现象描述'); return; }

      var q = Math.min(S.quarter + 1, 4);
      var qtxt = (S.settle ? '第四季度（年度结算中）' : D.C.QUARTERS[q - 1]) + '（' + S.year + ' 年）';
      var text = '【游戏问题与体验反馈】\n问题类型：' + type +
        '\n描述：' + desc +
        '\n\n【当前游戏上下文快照】\n年龄：' + S.age +
        '\n工龄：' + S.seniority +
        '\n职级：' + EN.curRank().name +
        '\n岗位：' + EN.curPost().name +
        '\n所处季度：' + qtxt;

      var out = $('fbOut');
      out.textContent = text;
      $('fbWrap').style.display = 'block';
      toast('已生成反馈文本，可复制提交');
    };

    $('fbCopy').onclick = function () {
      var out = $('fbOut');
      if (!out) return;
      var text = out.textContent;
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).then(
          function () { toast('已复制到剪贴板'); },
          function () { selectFallback(out); }
        );
      } else {
        selectFallback(out);
      }
    };
  }

  function selectFallback(el) {
    if (window.getSelection) {
      var r = document.createRange();
      r.selectNodeContents(el);
      var s = window.getSelection();
      s.removeAllRanges();
      s.addRange(r);
    }
    toast('已选中文本，请长按复制');
  }

  function toast(msg) {
    var r = $('toastRoot');
    r.innerHTML = '<div class="toast">' + esc(msg) + '</div>';
    setTimeout(function () { r.innerHTML = ''; }, 1600);
  }

  /* ---------------- 底部按钮状态 ---------------- */
  function updateBot() {
    var S = EN.S, btn = $('btnNext');
    if (!S) return;
    if (S.ended || UI.mode === 'ending') {
      btn.textContent = '生涯已终结'; btn.disabled = true; return;
    }
    if (UI.mode === 'settle') {
      var st = S.settle ? S.settle[S.settleIdx] : null;
      if (st && st.needChoice) { btn.textContent = '请先作出选择'; btn.disabled = true; return; }
      btn.textContent = '继续结算'; btn.disabled = false; return;
    }
    if (UI.mode === 'event') { btn.textContent = '请先作出选择'; btn.disabled = true; return; }
    if (UI.mode === 'result') { btn.textContent = '继续'; btn.disabled = false; return; }
    if (S.quarter >= 4) { btn.textContent = '年度结算'; btn.disabled = false; return; }
    btn.textContent = '推进季度'; btn.disabled = false;
  }

  function onNext() {
    var S = EN.S;
    if (!S || S.ended) return;
    if (UI.mode === 'settle') { nextSettle(); return; }
    if (UI.mode === 'result') { afterEvent(); return; }
    if (S.quarter >= 4) {
      EN.runYearEnd();
      UI.mode = 'settle';
      renderSettleStep();
      return;
    }
    var sc = EN.nextQuarterScene();
    if (sc && sc.kind === 'event') { renderAll(); showEvent(sc.ev); }
    else { renderAll(); renderStage(); }
  }

  /* ---------------- 导出 ---------------- */
  global.UI = {
    get mode() { return UI.mode; },
    init: showIntro,
    renderAll: renderAll,
    renderStage: renderStage,
    showLogs: showLogs,
    showSave: showSave,
    showLoad: showLoad,
    showFeedback: showFeedback,
    toast: toast,
    onNext: onNext,
    startGame: startGame,
    togglePanel: function () {
      var p = $('sidePanel'), m = $('sideMask');
      p.classList.toggle('open');
      m.classList.toggle('show', p.classList.contains('open'));
    }
  };
})(window);
