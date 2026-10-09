/* 覆盖在绘图区上的自绘层（SVG）：固定点十字、跟随箭头、标注。
   几何一律读 Plotly 渲染后的真实绘图区（见 charts.mount().geom），不按声明边距硬编码。 */
(function (global) {
  'use strict';
  var GS = global.GS = global.GS || {};
  var UI = GS.ui = GS.ui || {};

  var mounted = [];

  /**
   * 挂在图表容器上；draw(fn) 注册绘制函数，fn(g) 返回 svg 片段数组；
   * queue() 合并到一帧里重画（鼠标事件高频）。
   */
  function mount(wrap, geom) {
    var doc = global.document;
    var ovl = doc.createElement('div');
    ovl.className = 'ovl';
    var svg = doc.createElementNS('http://www.w3.org/2000/svg', 'svg');
    ovl.appendChild(svg);
    wrap.appendChild(ovl);

    var drawFn = null, queued = false;

    function flush() {
      queued = false;
      var g = geom();
      ovl.style.left = g.left + 'px';
      ovl.style.top = g.top + 'px';
      ovl.style.width = g.w + 'px';
      ovl.style.height = g.h + 'px';
      svg.setAttribute('width', g.w);
      svg.setAttribute('height', g.h);
      var parts = drawFn ? (drawFn(g) || []) : [];
      svg.innerHTML = parts.join('');
    }

    function queue() {
      if (queued) return;
      queued = true;
      global.requestAnimationFrame(flush);
    }

    var onResize = function () {   // 第二帧等 responsive 重排落定
      queue();
      global.requestAnimationFrame(queue);
    };
    global.addEventListener('resize', onResize);
    mounted.push({ onResize: onResize });

    return {
      el: ovl,
      svg: svg,
      draw: function (fn) { drawFn = fn; },
      queue: queue,
      flush: flush,
    };
  }

  /** 箭头标记的 <defs>。markers = [{id, color}]。 */
  function defs(markers) {
    return '<defs>' + markers.map(function (m) {
      return '<marker id="' + m.id + '" markerWidth="7" markerHeight="7" refX="5.5" refY="3" orient="auto">' +
             '<path d="M0,0 L6,3 L0,6 z" fill="' + m.color + '"/></marker>';
    }).join('') + '</defs>';
  }

  /** 箭头的端点（贴边按比例缩短、方向不变、兜底 30% 长）—— 画箭头与悬浮框避让共用同一套几何. */
  function arrowTip(px, py, ax, ay, g, opts) {
    opts = opts || {};
    var L = opts.len || 31, PAD = 8;
    var len = Math.hypot(ax, ay) || 1;
    var dx = ax / len * L, dy = -ay / len * L;
    var shrink = 1;
    if (dx > 0) shrink = Math.min(shrink, Math.max(g.w - PAD - px, 0) / dx);
    if (dx < 0) shrink = Math.min(shrink, Math.max(px - PAD, 0) / -dx);
    if (dy < 0) shrink = Math.min(shrink, Math.max(py - PAD, 0) / -dy);
    if (dy > 0) shrink = Math.min(shrink, Math.max(g.h - PAD - py, 0) / dy);
    shrink = Math.max(shrink, 0.3);
    return { tx: px + dx * shrink, ty: py + dy * shrink };
  }

  /**
   * 从 (px, py) 沿像素空间方向（ax, ay，向上为正）画箭头；
   * 贴边按比例缩短（方向不变）、兜底 30% 长。返回端点像素。
   */
  function arrow(parts, px, py, ax, ay, g, opts) {
    opts = opts || {};
    var t = arrowTip(px, py, ax, ay, g, opts);
    parts.push('<line x1="' + px + '" y1="' + py + '" x2="' + t.tx + '" y2="' + t.ty + '" stroke="' +
      (opts.color || '#111') + '" stroke-width="' + (opts.width || 2) +
      '" marker-end="url(#' + opts.marker + ')"/>');
    return t;
  }

  UI.overlay = {
    mount: mount,
    defs: defs,
    arrow: arrow,
    arrowTip: arrowTip,
    /** 白描边文字（压过等高线 / 色带仍可读）。 */
    text: function (parts, x, y, str, color, anchor) {
      parts.push('<text x="' + x.toFixed(1) + '" y="' + y.toFixed(1) + '" font-size="11" fill="' +
        (color || '#111') + '" stroke="#fff" stroke-width="3" stroke-linejoin="round"' +
        (anchor ? ' text-anchor="' + anchor + '"' : '') +
        ' style="paint-order:stroke">' + str + '</text>');
    },
    disposeAll: function () {
      mounted.forEach(function (m) { global.removeEventListener('resize', m.onResize); });
      mounted = [];
    },
  };
})(typeof globalThis !== 'undefined' ? globalThis : this);
