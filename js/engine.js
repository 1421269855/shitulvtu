/* ============================================================
 * 《仕途履途》核心引擎
 * 负责：状态推进 / 事件抽取 / 年末八步结算 / 隐患 / 晋升 / 结局
 * ============================================================ */
(function (global) {
  'use strict';

  var D = global.GameData, P = global.GamePosts, E = global.GameEvents;

  /* ---------------- 工具 ---------------- */
  function rnd(a, b) { return a + Math.random() * (b - a); }
  function ri(a, b) { return Math.floor(rnd(a, b + 1)); }
  function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
  function shuffle(arr) {
    var a = arr.slice();
    for (var i = a.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1)); var t = a[i]; a[i] = a[j]; a[j] = t;
    }
    return a;
  }
  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  /* ---------------- 状态 ---------------- */
  var S = null;

  function newGame(bgId) {
    var bg = D.BACKGROUNDS.filter(function (b) { return b.id === bgId; })[0] || D.BACKGROUNDS[0];
    var firstPost = pick(P.byTier('town'));
    var y = D.C.START_YEAR;

    S = {
      ver: 1,
      bg: bg.id, bgName: bg.name,
      year: y, quarter: 0,
      age: D.C.START_AGE, seniority: 0,
      rankIdx: 0, postId: firstPost.id,
      stats: { mz: 0, cg: 0, gj: 0, jl: 100, yx: 30, kb: 30 },
      snap: { mz: 0, cg: 0, gj: 0, jl: 100, yx: 30, kb: 30 },
      hazards: [],
      probation: true, probationYear: 1,
      serviceFreeYear: y + D.C.TOWN_MIN_SERVICE,
      frozen: 0,
      lastGrade: '', gradeHist: [],
      logs: [],
      resume: [],
      counters: {
        choice: 0, hazardBury: 0, hazardBlow: 0, hazardMax: 0,
        secondment: 0, rotation: 0, selection: 0, inspect: 0,
        jlPlus: 0, townYears: 0, provinceYears: 0
      },
      postYears: {}, postHistory: [firstPost.id],
      rankYears: 0, lastPromoteYear: y,
      darkHorse: false, deadEndYears: 0,
      chiefTiers: {}, flags: {}, peakRankIdx: 0,
      phase: 'quarter',
      settle: null, settleIdx: 0,
      ended: false, endingId: null, endReason: '',
      seenDaily: {}, seenPost: {}
    };

    var bonus = bg.bonus || {};
    Object.keys(bonus).forEach(function (k) { S.stats[k] += bonus[k]; S.snap[k] += bonus[k]; });

    log('入职', '经公开招考录用，分配至' + firstPost.name + '工作，试用期一年。');
    log('入职', '个人背景：' + bg.name + '。');
    pushResume(firstPost.id);
    recordPostStats();
    return S;
  }

  /* 记录主官履历层级与历史最高职级（国级晋升校验用） */
  function recordPostStats() {
    var p = curPost();
    if (p && p.chief) S.chiefTiers[p.tier] = true;
    if (S.rankIdx > (S.peakRankIdx || 0)) S.peakRankIdx = S.rankIdx;
  }

  /* 兼容旧存档：补齐新增字段 */
  function ensureFields() {
    if (!S) return;
    if (!S.chiefTiers) S.chiefTiers = {};
    if (!S.flags) S.flags = {};
    if (S.peakRankIdx === undefined) S.peakRankIdx = S.rankIdx || 0;
    if (!S.postYears) S.postYears = {};
    if (!S.postHistory) S.postHistory = [S.postId];
    if (!S.counters) {
      S.counters = {
        choice: 0, hazardBury: 0, hazardBlow: 0, hazardMax: 0,
        secondment: 0, rotation: 0, selection: 0, inspect: 0,
        jlPlus: 0, townYears: 0, provinceYears: 0
      };
    }
    if (!S.gradeHist) S.gradeHist = [];
    if (!S.logs) S.logs = [];
    if (!S.resume) S.resume = [];
    if (!S.hazards) S.hazards = [];
  }

  function curPost() { return P.get(S.postId); }
  function curRank() { return D.RANKS[S.rankIdx]; }

  /* ---------------- 日志 ---------------- */
  function log(type, content) {
    S.logs.push({
      y: S.year, q: S.quarter, type: type, c: content,
      post: curPost() ? curPost().name : ''
    });
  }
  function pushResume(postId) {
    S.resume.push({
      y: S.year, postId: postId, rankName: curRank().name,
      rankIdx: S.rankIdx, endY: null
    });
  }
  function closeResume() {
    if (S.resume.length) {
      var last = S.resume[S.resume.length - 1];
      if (last.endY === null) last.endY = S.year;
    }
  }

  /* ---------------- 属性 ---------------- */
  function applyFx(fx) {
    if (!fx) return;
    Object.keys(fx).forEach(function (k) {
      if (!(k in S.stats)) return;
      S.stats[k] += fx[k];
    });
    S.stats.jl = clamp(S.stats.jl, 0, 130);
    S.stats.yx = clamp(S.stats.yx, 0, 140);
    S.stats.kb = clamp(S.stats.kb, 0, 140);
  }

  /* 埋雷：并非每次冒险都会留下痕迹，等级越高越可能被记住 */
  var HAZARD_BURY_RATE = [0, 0.35, 0.45, 0.60, 0.75];
  var HAZARD_DISSOLVE = [0, 0.55, 0.40, 0.20, 0.05];
  var HAZARD_MAX = 3;

  function buryHazard(h) {
    if (!h) return false;
    var lv = h.lv || 2, min = h.min || 2, max = h.max || 6;
    if (S.hazards.length >= HAZARD_MAX) return false;
    if (Math.random() > (HAZARD_BURY_RATE[lv] || 0.45)) return false;
    S.hazards.push({
      name: pick(D.HAZARD_NAMES),
      lv: lv,
      fire: S.year + ri(min, max),
      src: S.year
    });
    S.counters.hazardBury++;
    return true;
  }

  /* ---------------- 事件抽取 ---------------- */
  function pickQuarterEvent() {
    var post = curPost();
    var roll = Math.random();
    var isNational = (post.tier === 'national_v' || post.tier === 'national');

    /* 国级专属事件：仅副国、正国职级刷出 */
    if (isNational) {
      var npool = E.NATIONAL.filter(function (_, i) { return !S.seenPost['nat_' + i]; });
      if (!npool.length) {
        for (var k = 0; k < E.NATIONAL.length; k++) delete S.seenPost['nat_' + k];
        npool = E.NATIONAL;
      }
      var nev = pick(npool);
      S.seenPost['nat_' + E.NATIONAL.indexOf(nev)] = 1;
      return { kind: 'national', t: nev.t, b: nev.b, o: nev.o };
    }

    if (roll < 0.14) {
      return { kind: 'idle', t: '常规事务', b: pick(E.IDLE_TIPS), o: [] };
    }

    if (roll < 0.66) {
      // 岗位专属事件
      var pool = (post.ev || []).filter(function (_, i) { return !S.seenPost[post.id + '_' + i]; });
      if (!pool.length) { S.seenPost = {}; pool = post.ev || []; }
      if (pool.length) {
        var ev = pick(pool);
        S.seenPost[post.id + '_' + (post.ev.indexOf(ev))] = 1;
        return { kind: 'post', t: ev.t, b: ev.b, o: ev.o };
      }
    }

    // 日常通用事件
    var dpool = E.DAILY.filter(function (_, i) { return !S.seenDaily['d' + i]; });
    if (!dpool.length) { S.seenDaily = {}; dpool = E.DAILY; }
    var dev = pick(dpool);
    S.seenDaily['d' + E.DAILY.indexOf(dev)] = 1;
    return { kind: 'daily', t: dev.t, b: dev.b, o: dev.o };
  }

  /* ---------------- 季度推进 ---------------- */
  function nextQuarterScene() {
    if (S.ended) return { kind: 'ended' };

    if (S.quarter < 4) {
      S.quarter++;
      var ev = pickQuarterEvent();
      return { kind: 'event', ev: ev };
    }
    return null; // 由 UI 触发年末结算
  }

  /* ---------------- 年末八步结算 ---------------- */
  function runYearEnd() {
    var steps = [];
    var post = curPost();

    /* ---- 第 1 步：年度时间更迭 ---- */
    S.seniority++;
    S.age++;
    S.rankYears++;
    S.postYears[S.postId] = (S.postYears[S.postId] || 0) + 1;
    if (post.tier === 'town') S.counters.townYears++;
    if (post.tier === 'province') S.counters.provinceYears++;
    steps.push({
      k: 'time', cls: '',
      t: '一、年度更迭',
      v: '岁月流转，本年履职已满。年龄增至 ' + S.age + ' 岁，工龄 ' + S.seniority + ' 年。'
    });

    /* ---- 第 2 步：试用期判定 ---- */
    if (S.probation) {
      S.probationYear++;
      var g = gradeScore();
      if (S.probationYear > D.C.PROBATION_YEARS && g >= 1) {
        S.probation = false;
        if (S.rankIdx === 0) { S.rankIdx = 1; S.rankYears = 0; }
        steps.push({
          k: 'probation', cls: 'good',
          t: '二、试用期考核',
          v: '试用期满，经考核符合转正条件，予以正式任职为' + curRank().name + '。'
        });
        log('转正', '试用期满考核合格，正式任职为' + curRank().name + '。');
      } else if (S.probationYear > D.C.PROBATION_YEARS + 2) {
        S.probation = false;
        if (S.rankIdx === 0) { S.rankIdx = 1; S.rankYears = 0; }
        steps.push({
          k: 'probation', cls: 'warn',
          t: '二、试用期考核',
          v: '试用期已延长两年，按期转正，但这段经历被记入了档案。'
        });
        log('转正', '经延长试用后转正，延期情况记入档案。');
      } else {
        steps.push({
          k: 'probation', cls: 'warn',
          t: '二、试用期考核',
          v: '试用未满一年，本年度不作转正判定。'
        });
      }
    }

    /* ---- 第 3 步：乡镇最低服务期判定 ---- */
    if (S.year >= S.serviceFreeYear && !S._svcNoted) {
      S._svcNoted = true;
      steps.push({
        k: 'service', cls: 'good',
        t: '三、基层服务期',
        v: '乡镇最低服务年限已满，参加上级机关公开遴选不再受限制。'
      });
      log('重大抉择', '乡镇最低服务年限届满，遴选限制解除。');
    } else if (!S._svcNoted) {
      steps.push({
        k: 'service', cls: '',
        t: '三、基层服务期',
        v: '乡镇最低服务年限未满（至 ' + S.serviceFreeYear + ' 年），参加公开遴选仍受限制。'
      });
    }

    /* ---- 第 4 步：年度考核评定 ---- */
    var grade = gradeScore();
    var gradeName = ['不合格', '合格', '良好', '优秀'][grade];
    S.lastGrade = gradeName;
    S.gradeHist.push(gradeName);
    var gcls = grade >= 3 ? 'good' : (grade === 0 ? 'bad' : (grade === 1 ? 'warn' : ''));
    steps.push({
      k: 'grade', cls: gcls,
      t: '四、年度考核评定',
      v: '经民主测评与组织审核，本年度考核等次：<b class="grade">' + gradeName + '</b>。'
    });
    log('考核', S.year + '年度考核等次：' + gradeName + '。');

    /* ---- 第 5 步：职级晋升判定（含岗位选择） ---- */
    var promo = judgePromotion(grade);
    if (promo.code === 'top') {
      steps.push({
        k: 'promote', cls: '',
        t: '五、职级晋升',
        v: '已在本级序列顶端，本年度无更高职级可晋。'
      });
    } else if (promo.code === 'frozen') {
      S.frozen--;
      steps.push({
        k: 'promote', cls: 'bad',
        t: '五、职级晋升',
        v: '受前期问题影响，本年度暂缓考虑职级晋升。'
      });
    } else if (promo.code === 'young') {
      steps.push({
        k: 'promote', cls: '',
        t: '五、职级晋升',
        v: '本级任职年限不足（已任 ' + S.rankYears + ' 年，需 ' + promo.need + ' 年），本年度不作晋升考虑。'
      });
    } else if (promo.code === 'fail') {
      steps.push({
        k: 'promote', cls: 'warn',
        t: '五、职级晋升',
        v: '任职年限已达要求，但受职数与考核情况限制，本次未能晋升。'
      });
    } else if (promo.code === 'national_fail') {
      steps.push({
        k: 'promote', cls: '',
        t: '五、职级晋升',
        v: '本级任职年限已达要求。经组织综合研判，现任岗位、多段主官履历与一贯表现等条件尚不完全具备更高职级任职资格，本年度不作考虑。'
      });
    } else {
      // 晋升成功：随机 2-3 个同职级岗位
      var nextIdx = Math.min(S.rankIdx + 1, D.RANKS.length - 1);
      var cands = buildCandidates(nextIdx);
      steps.push({
        k: 'promote', cls: 'good',
        t: '五、职级晋升',
        v: '经研究，拟晋升为<b>' + D.RANKS[nextIdx].name + '</b>。现有以下岗位可供选择，请按岗位职责自行权衡。',
        needChoice: 'post',
        choices: cands,
        nextRankIdx: nextIdx
      });
    }

    /* ---- 第 6 步：年度纪律隐患检查 ---- */
    var fired = [];
    for (var i = S.hazards.length - 1; i >= 0; i--) {
      if (S.hazards[i].fire > S.year) continue;
      var hz0 = S.hazards[i];
      S.hazards.splice(i, 1);
      // 一部分早年疏漏就此过去，无人再提起
      if (Math.random() < (HAZARD_DISSOLVE[hz0.lv] || 0.3)) continue;
      fired.push(hz0);
    }
    if (!fired.length) {
      steps.push({
        k: 'hazard', cls: '',
        t: '六、纪律与隐患检查',
        v: '本年度未发现需要指出的问题。'
      });
    } else {
      fired.forEach(function (hz) {
        // 国级阶段：同类问题破坏力上调一级，更易触发高位问责
        var effLv = (S.rankIdx >= 8) ? Math.min(4, hz.lv + 1) : hz.lv;
        var up = effLv > hz.lv;
        var lv = D.HAZARD_LEVELS[effLv - 1];
        S.stats.jl = clamp(S.stats.jl + lv.jl, 0, 130);
        S.counters.hazardBlow++;
        if (effLv > S.counters.hazardMax) S.counters.hazardMax = effLv;

        if (effLv === 2 && S.lastGrade !== '不合格') {
          var idx = ['不合格', '合格', '良好', '优秀'].indexOf(S.lastGrade);
          if (idx > 0) {
            S.lastGrade = ['不合格', '合格', '良好', '优秀'][idx - 1];
            S.gradeHist[S.gradeHist.length - 1] = S.lastGrade;
          }
        }
        if (effLv === 3) { S.frozen = ri(1, 2); }
        if (effLv === 4) { S.ended = true; S.endReason = 'terminate'; }

        steps.push({
          k: 'hazard', cls: 'bad',
          t: '六、纪律与隐患检查（' + lv.name + '）',
          v: '<b>' + esc(hz.name) + '</b>：' + lv.desc +
            (up ? '<div class="quiet" style="margin-top:6px;">位越高，责越重。同一处疏漏，在如今的岗位上不再只是瑕疵。</div>' : '') +
            '<div class="divider"></div>' + (E.HAZARD_BLOW_TEXT[effLv] || '')
        });
        log('隐患', hz.name + '被查实，受到' + lv.name + '处理。');
      });
    }

    /* ---- 第 7 步：随机特殊事件 ---- */
    if (!S.ended) {
      var sp = rollSpecial();
      if (sp) {
        steps.push({
          k: 'special', cls: '',
          t: '七、' + sp.title,
          v: sp.body,
          needChoice: 'special',
          spKey: sp.key,
          // SPECIALS 用 text/fx/hazard/log，其余事件用 x/f/h/lg；此处统一归一为渲染层读取的 x/f/h/log
          choices: sp.opts.map(function (o, i) {
            return {
              i: i,
              x: o.text || o.x || '',
              _opt: {
                x: o.text || o.x || '',
                f: o.fx || o.f,
                h: o.hazard || o.h,
                log: o.log || o.lg,
                special: o.special
              }
            };
          })
        });
      } else {
        steps.push({
          k: 'special', cls: '',
          t: '七、其他事项',
          v: '本年度未出现需要专项报告的事项。'
        });
      }
    }

    /* ---- 第 8 步：退休终判 ---- */
    if (S.ended) {
      steps.push({
        k: 'retire', cls: 'bad',
        t: '八、退休与终止判定',
        v: '因追责问责，公职生涯终止。',
        end: true
      });
    } else if (S.age >= D.C.RETIRE_AGE) {
      S.ended = true; S.endReason = 'force';
      steps.push({
        k: 'retire', cls: '',
        t: '八、退休与终止判定',
        v: '已达退休年龄，按规定办理退休手续。',
        end: true
      });
      log('退休', '达到退休年龄，办理退休手续。');
    } else if (S.age >= D.C.EARLY_RETIRE_AGE) {
      steps.push({
        k: 'retire', cls: '',
        t: '八、退休与终止判定',
        v: '你已年满 ' + S.age + ' 岁，符合提前退休条件。是否申请提前退休？',
        needChoice: 'retire',
        choices: [
          { i: 0, x: '申请提前退休，交出手上的工作', _early: true },
          { i: 1, x: '继续任职，干到规定年龄', _early: false }
        ]
      });
    } else {
      steps.push({
        k: 'retire', cls: '',
        t: '八、退休与终止判定',
        v: '距退休年龄尚有余年，继续任职。'
      });
    }

    /* 快照更新 */
    S.snap = JSON.parse(JSON.stringify(S.stats));
    S.settle = steps; S.settleIdx = 0;
    return steps;
  }

  /* ---------------- 考核计分 ---------------- */
  function gradeScore() {
    var post = curPost();
    var dm = S.stats.mz - S.snap.mz, dc = S.stats.cg - S.snap.cg, dg = S.stats.gj - S.snap.gj;
    var gain = dm * post.mz + dc * post.cg + dg * post.gj;
    var score = gain + (S.stats.jl - 100) * 0.45 + rnd(-4, 4);
    if (S.stats.jl < 70) score -= 6;

    var g;
    if (score >= 36) g = 3;
    else if (score >= 27) g = 2;
    else if (score >= 15) g = 1;
    else g = 0;
    return g;
  }

  /* ---------------- 晋升判定 ---------------- */
  /* 各职级晋升基准成功率，再按岗位与个人情况修正 */
  /* 下标 = 晋升目标职级 idx（rankIdx+1）。
     0 为试用期不晋升；1-7 为常规序列；8/9 副国/正国走 NATIONAL_RATE 独立逻辑。
     上部（正处/副厅/正厅）基准率抬高：审慎玩家可高效爬升至合理年龄，
     否则到位即被年龄杠杆压死，副国/正国前置条件永不触发。 */
  var PROMO_BASE = [0, 0.85, 0.62, 0.45, 0.32, 0.30, 0.26, 0.18];

  /* 国级晋升前置条件校验：奇迹级路径，必须全部满足 */
  var NATIONAL_RATE = { vice: 0.05, top: 0.02 };

  function nationalCheck(level) {
    var ct = S.chiefTiers || {};
    var groups = D.CHIEF_TIER_GROUP;
    function hasGroup(g) {
      return groups[g].some(function (t) { return !!ct[t]; });
    }
    var excellent = (S.gradeHist || []).filter(function (x) { return x === '优秀'; }).length;
    var flags = S.flags || {};
    var cond = {
      chiefPost: !!curPost().chief,
      resume: hasGroup('grassroot') && hasGroup('county') && hasGroup('city') && hasGroup('province'),
      clean: S.counters.hazardBlow === 0 && S.counters.hazardBury === 0 && (S.hazards || []).length === 0,
      excellent: excellent >= (level === 'vice' ? 4 : 6),
      inspect: S.counters.inspect >= (level === 'vice' ? 3 : 4),
      highInspect: !!flags.highInspect
    };
    cond.ok = cond.chiefPost && cond.resume && cond.clean && cond.excellent && cond.inspect && cond.highInspect;
    return cond;
  }

  function judgePromotion(grade) {
    var nextIdx = S.rankIdx + 1;
    if (nextIdx >= D.RANKS.length) return { code: 'top' };

    /* 副国级：必须由正厅级核心主官岗位晋升，严禁跳级 */
    if (nextIdx === 8) {
      if (S.rankIdx !== 7) return { code: 'national_fail', cond: nationalCheck('vice') };
      if (S.rankYears < D.RANKS[8].need) return { code: 'young', need: D.RANKS[8].need };
      if (S.frozen > 0) return { code: 'frozen' };
      var c1 = nationalCheck('vice');
      if (!c1.ok) return { code: 'national_fail', cond: c1 };
      return Math.random() < NATIONAL_RATE.vice ? { code: 'ok' } : { code: 'national_fail', cond: c1 };
    }

    /* 正国级：门槛进一步抬高，概率更低 */
    if (nextIdx === 9) {
      if (S.rankIdx !== 8) return { code: 'national_fail', cond: nationalCheck('top') };
      if (S.rankYears < D.RANKS[9].need) return { code: 'young', need: D.RANKS[9].need };
      if (S.frozen > 0) return { code: 'frozen' };
      var c2 = nationalCheck('top');
      if (!c2.ok) return { code: 'national_fail', cond: c2 };
      return Math.random() < NATIONAL_RATE.top ? { code: 'ok' } : { code: 'national_fail', cond: c2 };
    }

    var need = D.RANKS[nextIdx].need;
    if (S.rankYears < need) return { code: 'young', need: need };
    if (S.frozen > 0) return { code: 'frozen' };
    if (S.probation) return { code: 'young', need: need };

    var post = curPost();
    var rate = PROMO_BASE[nextIdx]
      + (post.hc - 0.6) * 0.35                                  // 职数松紧
      + (grade - 1.5) * 0.12                                     // 考核等次
      + (clamp(S.stats.yx / 100, 0, 1) - 0.5) * 0.15             // 组织印象
      + (clamp(S.stats.gj / 120, 0, 1) - 0.4) * 0.12             // 攻坚实绩
      + (clamp(S.stats.jl / 100, 0, 1) - 0.85) * 0.20            // 纪律状态
      - S.hazards.length * 0.05
      - Math.max(0, S.age - 55) * 0.015;                         // 年龄杠杆（高位微调，避免到位即被压死）

    return Math.random() < clamp(rate, 0.02, 0.95) ? { code: 'ok' } : { code: 'fail' };
  }

  /* 生成 2-3 个同职级候选岗位 */
  function buildCandidates(nextIdx) {
    var rank = D.RANKS[nextIdx];
    var list = [];
    rank.pool.forEach(function (tier) {
      list = list.concat(P.byTier(tier));
    });
    list = list.filter(function (p) { return p.id !== S.postId; });
    list = shuffle(list).slice(0, ri(2, 3));
    if (!list.length) list = [pick(P.byTier(rank.pool[0]))];
    return list.map(function (p) { return { id: p.id, name: p.name, duty: p.duty, tier: p.tier }; });
  }

  /* ---------------- 特殊事件抽取 ---------------- */
  function rollSpecial() {
    var post = curPost();
    var pool = [];
    var r = Math.random();

    if (S.year >= S.serviceFreeYear && S.rankIdx <= 6 && r < 0.18 &&
      (S.lastSelectYear === undefined || S.year - S.lastSelectYear >= 4)) {
      pool.push(D.SPECIALS.selection);
    }
    if (Math.random() < post.sec) pool.push(D.SPECIALS.secondment);
    if (Math.random() < 0.10) pool.push(D.SPECIALS.rotation);
    if (S.rankIdx >= 2 && Math.random() < 0.13) pool.push(D.SPECIALS.inspect);
    /* 高阶专项组织考察：副部级及以上（rankIdx>=6）方有可能被纳入重点考察储备，
       属罕见事件；spec 未限定具体层级，"高层"应覆盖副厅/正厅。 */
    if (S.rankIdx >= 6 && Math.random() < 0.12) pool.push(D.SPECIALS.highInspect);
    if (!pool.length) return null;
    return pick(pool);
  }

  /* ---------------- 岗位变更 ---------------- */
  function assignPost(postId, promote) {
    closeResume();
    var oldPost = curPost();
    S.postId = postId;
    var np = curPost();

    if (promote) {
      S.rankIdx = Math.min(S.rankIdx + 1, D.RANKS.length - 1);
      S.rankYears = 0;
      S.lastPromoteYear = S.year;
      // 明降暗升检测：从城郊岗位走出去后，短期内再次获得晋升
      if (oldPost && oldPost.tier === 'suburb') {
        if (S.suburbPromoteYear !== undefined && (S.year - S.suburbPromoteYear) <= 5) S.darkHorse = true;
        S.suburbPromoteYear = S.year;
      }
    }
    S.postHistory.push(postId);
    S.postYears[postId] = S.postYears[postId] || 0;
    pushResume(postId);
    recordPostStats();
    log(promote ? '晋升' : '轮岗',
      (promote ? '晋升为' + curRank().name + '，' : '') + '交流至' + np.name + '任职。');
  }

  /* 遴选成功：平台向上跃迁（职级不变，岗位层级提升） */
  var TIER_ORDER = ['town', 'suburb', 'county', 'city', 'province'];
  function selectTransfer() {
    var cur = curPost();
    var ci = TIER_ORDER.indexOf(cur.tier);
    var target = null;
    if (ci >= 0) {
      // 一次只向上跃迁一个层级，杜绝无履历空降
      var maxIdx = Math.min(TIER_ORDER.length - 1, ci + 1);
      for (var i = maxIdx; i > ci; i--) {
        var list = P.byTier(TIER_ORDER[i]);
        if (list.length) { target = pick(list); break; }
      }
    }
    if (!target) {
      // 已在序列顶端（如国级岗位），仅在同层级内平调
      var same = P.byTier(cur.tier).filter(function (p) { return p.id !== cur.id; });
      target = same.length ? pick(same) : cur;
    }
    assignPost(target.id, false);
    S.lastSelectYear = S.year;
    return target;
  }

  /* ---------------- 结局评定 ---------------- */
  function evaluateEnding() {
    var c = S.counters;
    var postCount = Object.keys(S.postYears).length;
    var stall = S.year - S.lastPromoteYear;
    var deadEnd = 0;
    Object.keys(S.postYears).forEach(function (pid) {
      var p = P.get(pid);
      if (p && p.hc <= 0.32) deadEnd += S.postYears[pid];
    });
    S.deadEndYears = deadEnd;

    var st = S.stats;
    var total = Math.max(1, st.mz + st.cg + st.gj);
    var gjShare = st.gj / total, mzShare = st.mz / total;

    var id = 'E7'; // 默认：得失并存成长型
    var reason = '';
    var peak = Math.max(S.peakRankIdx || 0, S.rankIdx);

    /* 国级专属结局（15—18）优先判定：到达即定性，无论最终以何种方式离开 */
    if (S.endReason === 'terminate') {
      if (peak >= 9) { id = 'E18'; reason = '正国级岗位上被核查问责，生涯终止。'; }
      else if (peak === 8) { id = 'E17'; reason = '副国级岗位上被核查问责，生涯终止。'; }
      else { id = 'E11'; reason = '四级追责，生涯终止。'; }
    }
    else if (S.rankIdx >= 9) { id = 'E16'; reason = '走完完整多层级主官履历，登上正国级岗位。'; }
    else if (S.rankIdx === 8) { id = 'E15'; reason = '基层、县域、地市、省直多段主官历练后走上副国级岗位。'; }
    else if (S.endReason === 'early') { id = 'E10'; reason = '主动申请提前退休。'; }
    else if (c.hazardBlow >= 3) { id = 'E8'; reason = '生涯中遗留多处未及弥补的瑕疵。'; }
    else if (st.gj >= 85 && gjShare >= 0.35) { id = 'E3'; reason = '多次承担专项攻坚任务。'; }
    else if (st.mz >= 85 && mzShare >= 0.34 && c.townYears >= 4) { id = 'E13'; reason = '长期扎根基层民生一线。'; }
    else if (S.rankIdx <= 3 && c.townYears >= 6) { id = 'E1'; reason = '长期扎根乡镇基层。'; }
    else if (stall >= 8 && S.rankIdx <= 4) { id = 'E6'; reason = '早年晋升顺利，此后长期原地踏步。'; }
    else if (S.darkHorse && S.rankIdx >= 4) { id = 'E5'; reason = '城郊一线历练后连续获得晋升。'; }
    else if (S.rankIdx >= 6 && c.provinceYears >= 5) { id = 'E14'; reason = '长期在省级机关从事宏观研判统筹。'; }
    else if (c.inspect >= 3 && S.rankIdx >= 4) { id = 'E12'; reason = '多次组织考察后获得转折。'; }
    else if (deadEnd >= 4 && S.rankIdx <= 5) { id = 'E4'; reason = '长期在综合文字类岗位平稳守成。'; }
    else if (st.jl >= 108 && c.hazardBlow === 0 && c.hazardBury <= 1) { id = 'E9'; reason = '一生审慎，未留任何瑕疵。'; }
    else if (postCount >= 5) {
      if (Math.random() < 0.55) { id = 'E2'; reason = '历经多个岗位、多个层级锻炼。'; }
      else { id = 'E7'; reason = '得失并存，起伏中走完一生。'; }
    }
    else if (c.hazardBlow >= 2) { id = 'E8'; reason = '生涯中遗留若干未及弥补的瑕疵。'; }

    var ending = D.ENDINGS.filter(function (e2) { return e2.id === id; })[0] || D.ENDINGS[6];
    S.endingId = ending.id;
    return { ending: ending, reason: reason };
  }

  /* ---------------- 存档 ---------------- */
  function slotKey(i) { return D.C.SAVE_KEY + '_' + i; }
  function save(i) {
    try {
      var data = { s: S, t: Date.now() };
      localStorage.setItem(slotKey(i), JSON.stringify(data));
      return true;
    } catch (e) { return false; }
  }
  function readSlot(i) {
    try {
      var raw = localStorage.getItem(slotKey(i));
      if (!raw) return null;
      return JSON.parse(raw);
    } catch (e) { return null; }
  }
  function load(i) {
    var d = readSlot(i);
    if (!d || !d.s) return false;
    S = d.s;
    ensureFields();
    return true;
  }
  function removeSlot(i) { try { localStorage.removeItem(slotKey(i)); } catch (e) { } }

  /* ---------------- 跨年 ---------------- */
  function enterNextYear() {
    S.year++;
    S.quarter = 0;
    S.settle = null;
    S.settleIdx = 0;
    S.phase = 'quarter';
  }

  function finishGame(reason) {
    S.ended = true;
    S.endReason = reason || S.endReason || 'force';
    if (S.endReason === 'early') log('退休', '申请提前退休，离开工作岗位。');
    return evaluateEnding();
  }

  global.Engine = {
    get S() { return S; },
    set S(v) { S = v; },
    newGame: newGame,
    ensureFields: ensureFields,
    nationalCheck: nationalCheck,
    curPost: curPost,
    curRank: curRank,
    log: log,
    applyFx: applyFx,
    buryHazard: buryHazard,
    nextQuarterScene: nextQuarterScene,
    runYearEnd: runYearEnd,
    assignPost: assignPost,
    selectTransfer: selectTransfer,
    buildCandidates: buildCandidates,
    evaluateEnding: evaluateEnding,
    enterNextYear: enterNextYear,
    finishGame: finishGame,
    save: save, load: load, readSlot: readSlot, removeSlot: removeSlot,
    util: { esc: esc, pick: pick, ri: ri, clamp: clamp }
  };
})(window);
