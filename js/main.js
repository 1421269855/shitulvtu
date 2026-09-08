/* 启动与事件绑定 */
(function () {
  'use strict';

  /* 在线反馈：复制游戏状态快照 → 弹窗引导前往 WPS 表单 */
  function openFeedback() {
    // 读取项目已有的全局游戏状态（Engine），逐层 typeof 兜底，取不到一律显示"未知"，避免 ReferenceError
    var EN = (typeof window !== 'undefined' && window.Engine) ? window.Engine : null;
    var S = (EN && EN.S) ? EN.S : null;
    var UI = (typeof window !== 'undefined' && window.UI) ? window.UI : null;
    var mode = (UI && typeof UI.mode === 'string') ? UI.mode : '';

    var vAge = (S && typeof S.age === 'number') ? String(S.age) : '未知';
    var vWork = (S && typeof S.seniority === 'number') ? String(S.seniority) : '未知';
    var vRank = (EN && S && typeof EN.curRank === 'function' && EN.curRank() && EN.curRank().name) ? EN.curRank().name : '未知';
    var vPost = (EN && S && typeof EN.curPost === 'function' && EN.curPost() && EN.curPost().name) ? EN.curPost().name : '未知';
    var vYear = (S && typeof S.year === 'number') ? String(S.year) : '未知';

    // 季度：S.quarter 为 0-based；事件/结果界面时季度已自增，真实季度为 S.quarter，其余为 S.quarter+1
    var qRaw = (S && typeof S.quarter === 'number') ? S.quarter : -1;
    var qReal = (mode === 'event' || mode === 'result') ? qRaw : qRaw + 1;
    var vQuarter = (qRaw >= 0) ? ('Q' + Math.min(Math.max(qReal, 1), 4)) : '未知';

    // 组装快照文本
    const snapshot = `=====《仕途履途》游戏快照信息=====
年龄：${vAge}
工龄：${vWork}
当前职级：${vRank}
当前岗位：${vPost}
所处年份：${vYear}
所处季度：${vQuarter}
游戏版本：v1.0
时间戳：${new Date().toLocaleString()}
浏览器：${navigator.userAgent}
请在此下方描述你的问题：
`;

    // 复制结果提示文案（红色内联样式，不改动外部 CSS）
    var TIP_OK = '✅ 游戏状态快照已复制到剪贴板！<br>你可以直接粘贴到反馈表单中，再描述遇到的bug、界面问题或者想法。';
    var TIP_FAIL = '<span style="color:#DC2626;">⚠️ 当前环境无法自动复制快照，请手动记录下方游戏状态填写到表单。<br>' +
      '你可以继续前往反馈表单描述遇到的bug、界面问题或者想法。</span>';

    // 复制结果只写日志，不再单独弹 alert；失败时改由弹窗内文案提示
    var clipboardOk = false;
    function applyCopyTip(okFlag) {
      var tip = document.getElementById('feedbackTip');
      if (tip) tip.innerHTML = okFlag ? TIP_OK : TIP_FAIL;
    }
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        clipboardOk = true;
        navigator.clipboard.writeText(snapshot).catch(function (err) {
          console.log("快照复制失败：", err);
          applyCopyTip(false);   // 异步失败：弹窗内改为红色提示
        });
      } else {
        console.log("快照复制失败： 当前环境不支持剪贴板 API（file:// 或浏览器限制）");
      }
    } catch (err) {
      console.log("快照复制失败：", err);
      clipboardOk = false;
    }

    // 创建弹窗DOM
    const modal = document.createElement('div');
    modal.id = "feedbackSnapshotModal";
    modal.style = `
position:fixed;inset:0;background:rgba(0,0,0,0.6);
display:flex;align-items:center;justify-content:center;z-index:9999;
`;
    modal.innerHTML = `
<div style="background:#fff;padding:24px;border-radius:12px;max-width:420px;width:90%;">
<h3 style="margin-top:0;">提交问题反馈</h3>
<p id="feedbackTip">${clipboardOk ? TIP_OK : TIP_FAIL}</p>
<div style="display:flex;gap:12px;justify-content:flex-end;margin-top:20px;">
<button id="feedbackCancelBtn" style="padding:8px 16px;">取消</button>
<button id="feedbackGoBtn" style="padding:8px 16px;background:#2563eb;color:white;border:none;border-radius:6px;">前往填写反馈表单</button>
</div>
</div>
`;
    document.body.appendChild(modal);

    // 取消按钮：关闭弹窗
    modal.querySelector("#feedbackCancelBtn").onclick = () => {
      modal.remove();
    };
    // 跳转表单按钮
    modal.querySelector("#feedbackGoBtn").onclick = () => {
      window.open("https://f.wps.cn/g/OKPujzAG/", "_blank");
      modal.remove();
    };
    // 点击弹窗背景关闭
    modal.onclick = (e) => {
      if (e.target === modal) modal.remove();
    };
  }

  /* 底部功能栏：单一数据源，先清空容器再全新生成，杜绝任何残留/重复/幽灵按钮
   * 固定 5 个，顺序严格：推进季度 → 存档 → 读档 → 完整日志 → 问题与反馈
   * 每个按钮仅生成 1 份，文案不重复，且都绑定对应点击事件。 */
  var BOTBAR = [
    { id: 'btnNext',      label: '推进季度',   cls: 'bb-btn bb-primary', fn: function () { window.UI.onNext(); } },
    { id: 'btnSave',      label: '存档',       cls: 'bb-btn',           fn: function () { window.UI.showSave(); } },
    { id: 'btnLoad',      label: '读档',       cls: 'bb-btn',           fn: function () { window.UI.showLoad(); } },
    { id: 'btnLog',       label: '完整日志',   cls: 'bb-btn',           fn: function () { window.UI.showLogs(); } },
    { id: 'btnFeedback',  label: '问题与反馈', cls: 'bb-btn',           fn: openFeedback }
  ];

  /* 渲染底部按钮组件：执行最开始先清空全部旧节点，再生成全新一套 */
  function ensureBotbar() {
    var bar = document.getElementById('botbar');
    if (!bar) return;

    // 1) 清空容器：销毁所有旧按钮节点，杜绝残留重复
    while (bar.children.length) bar.removeChild(bar.children[0]);

    // 2) 全新生成固定 5 个按钮（顺序严格、每按钮仅 1 份、文案不重复）
    BOTBAR.forEach(function (d) {
      var el = document.createElement('button');
      el.id = d.id;
      el.className = d.cls;
      el.textContent = d.label;
      el.onclick = d.fn;
      bar.appendChild(el);
    });
  }

  function bind() {
    ensureBotbar();
    document.getElementById('btnPanel').onclick = function () { window.UI.togglePanel(); };
    document.getElementById('sideMask').onclick = function () { window.UI.togglePanel(); };

    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') document.getElementById('modalRoot').innerHTML = '';
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () { bind(); window.UI.init(); });
  } else {
    bind(); window.UI.init();
  }
})();
