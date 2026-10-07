/* 共用展示片段：DOM 小工具、说明块、轻提示、图像导出。 */
(function (global) {
  'use strict';
  var GS = global.GS = global.GS || {};
  var UI = GS.ui = GS.ui || {};
  var doc = global.document;

  function el(tag, cls, html) {
    var node = doc.createElement(tag);
    if (cls) node.className = cls;
    if (html !== undefined) node.innerHTML = html;
    return node;
  }

  var toastTimer = null;

  function chartPng(plot) {
    return global.Plotly.toImage(plot, {
      format: 'png', width: plot.clientWidth, height: plot.clientHeight, scale: 2,
    });
  }

  function fileName() {
    var path = String(global.location.hash || '').replace(/^#\/?/, '').split('?')[0].split('#')[0];
    return 'genshin-strength' + (path ? '-' + path.replace(/\//g, '-') : '') + '.png';
  }

  function download(url) {
    var a = doc.createElement('a');
    a.href = url;
    a.download = fileName();
    doc.body.appendChild(a);
    a.click();
    doc.body.removeChild(a);
  }

  /* data URL → Blob：剪贴板只收 Blob；用 atob 而不是 fetch，file:// 下同样可用 */
  function toBlob(url) {
    var bin = global.atob(url.split(',')[1]);
    var bytes = new Uint8Array(bin.length);
    for (var i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return new global.Blob([bytes], { type: 'image/png' });
  }

  var ICON_IMAGE = '<svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true" fill="none" ' +
    'stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">' +
    '<rect width="18" height="18" x="3" y="3" rx="2"/><circle cx="9" cy="9" r="2"/>' +
    '<path d="m21 15-3.6-3.6a2 2 0 0 0-2.8 0L5 21"/></svg>';
  var ICON_DOWN = '<svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true" fill="none" ' +
    'stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">' +
    '<path d="M12 3v12"/><path d="m7 10 5 5 5-5"/><path d="M4 21h16"/></svg>';

  UI.panels = {
    el: el,

    /** 说明块（页脚详细口径、读图约定）。class 默认 chartnote。 */
    note: function (html, cls) { return el('p', cls || 'chartnote', html); },

    toast: function (msg) {
      var t = doc.getElementById('toast');
      if (!t) return;
      t.textContent = msg;
      t.classList.add('is-on');
      global.clearTimeout(toastTimer);
      toastTimer = global.setTimeout(function () { t.classList.remove('is-on'); }, 1800);
    },

    /** 「复制图像 / 下载图像」两个按钮，作用于 getPlot() 返回的图。 */
    chartActions: function (getPlot) {
      function act(kind) {
        var plot = getPlot();
        if (!plot) { UI.panels.toast('当前页面没有图表'); return; }
        chartPng(plot).then(function (url) {
          if (kind === 'download') { download(url); UI.panels.toast('已开始下载'); return; }
          var clip = global.navigator.clipboard;
          if (!global.ClipboardItem || !clip || !clip.write) {
            download(url); UI.panels.toast('浏览器不支持复制图像，已改为下载'); return;
          }
          clip.write([new global.ClipboardItem({ 'image/png': toBlob(url) })])
            .then(function () { UI.panels.toast('已复制图像'); },
                  function () { download(url); UI.panels.toast('复制失败，已改为下载'); });
        });
      }
      var copy = el('button', 'btn btn--ghost');
      copy.type = 'button';
      copy.innerHTML = ICON_IMAGE + '<span>复制图像</span>';
      copy.onclick = function () { act('copy'); };
      var save = el('button', 'btn btn--ghost');
      save.type = 'button';
      save.innerHTML = ICON_DOWN + '<span>下载图像</span>';
      save.onclick = function () { act('download'); };
      return [copy, save];
    },
  };
})(typeof globalThis !== 'undefined' ? globalThis : this);
