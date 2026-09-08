/* 启动与事件绑定 */
(function () {
  'use strict';

  /* 底部功能栏：单一数据源，先清空容器再全新生成，杜绝任何残留/重复/幽灵按钮
   * 固定 5 个，顺序严格：推进季度 → 存档 → 读档 → 完整日志 → 问题与反馈
   * 每个按钮仅生成 1 份，文案不重复，且都绑定对应点击事件。 */
  var BOTBAR = [
    { id: 'btnNext',      label: '推进季度',   cls: 'bb-btn bb-primary', fn: function () { window.UI.onNext(); } },
    { id: 'btnSave',      label: '存档',       cls: 'bb-btn',           fn: function () { window.UI.showSave(); } },
    { id: 'btnLoad',      label: '读档',       cls: 'bb-btn',           fn: function () { window.UI.showLoad(); } },
    { id: 'btnLog',       label: '完整日志',   cls: 'bb-btn',           fn: function () { window.UI.showLogs(); } },
    { id: 'btnFeedback',  label: '问题与反馈', cls: 'bb-btn',           fn: function () { window.UI.showFeedback(); } }
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
