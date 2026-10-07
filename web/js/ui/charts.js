/* Plotly 封装：统一的字体 / 配色 / 边距 / 原生悬浮关闭 / 工具条关闭；
   图的 traces 与 layout 由各模块自己给（各页图形差异大，这里只统一公共部分）。 */
(function (global) {
  'use strict';
  var GS = global.GS = global.GS || {};
  var UI = GS.ui = GS.ui || {};

  var FONT = 'system-ui, -apple-system, "Segoe UI", "Microsoft YaHei", "PingFang SC", sans-serif';
  var MONO = 'Consolas, "Cascadia Mono", ui-monospace, monospace';
  var INK = '#23201a';
  var DIM = '#6e685c';
  var GRID = '#e8e6e0';
  var AXIS = '#d5cfc1';
  var ACCENT = '#e8710a';

  var instances = [];   // { plot }：离开路由 / 重画时统一回收

  function register(plot) {
    instances.push({ plot: plot });
  }

  /** 轴默认值：细网格、无零线、暗灰刻度。 */
  function axis(over) {
    var o = over || {};
    return Object.assign({
      zeroline: false,
      showline: false,
      gridcolor: GRID,
      gridwidth: 1,
      ticks: '',
      tickfont: { family: MONO, size: 11, color: DIM },
      title: { font: { family: FONT, size: 12.5, color: DIM } },
    }, o);
  }

  function baseLayout(over) {
    return Object.assign({
      font: { family: FONT, size: 12, color: INK },
      paper_bgcolor: '#fff',
      plot_bgcolor: '#fff',
      margin: { t: 26, r: 24, b: 50, l: 62 },
      hovermode: false,
      showlegend: false,
      legend: { orientation: 'h', x: 0, y: 1.06, font: { size: 12, color: DIM } },
    }, over);
  }

  /** 画图：原生悬浮一律关掉（全站用自绘卡片），工具条关掉（导出在参数面板里）。 */
  function draw(plot, traces, layout) {
    traces = (traces || []).map(function (t) {
      return 'hoverinfo' in t ? t : Object.assign({ hoverinfo: 'none' }, t);
    });
    return global.Plotly.react(plot, traces, baseLayout(layout),
      { responsive: true, displayModeBar: false });
  }

  /** 在 host 里挂一张图：返回包装节点、绘图节点与几何换算。 */
  function mount(host, opts) {
    opts = opts || {};
    var wrap = global.document.createElement('div');
    wrap.className = 'chartwrap';
    var plot = global.document.createElement('div');
    plot.className = 'chart';
    if (opts.height) plot.style.height = opts.height + 'px';
    wrap.appendChild(plot);
    host.appendChild(wrap);
    register(plot);

    var fbMargin = { t: 26, r: 24, b: 50, l: 62 };   // 首帧兜底：声明边距
    return {
      wrap: wrap,
      plot: plot,
      /** 绘图区真实几何（相对 wrap），读渲染后的实际值（colorbar 等会撑大右边距）。 */
      geom: function () {
        var fl = plot._fullLayout;
        if (fl && fl.xaxis && fl.xaxis._length && fl.yaxis && fl.yaxis._length) {
          return { left: fl.xaxis._offset, top: fl.yaxis._offset, w: fl.xaxis._length, h: fl.yaxis._length };
        }
        var cw = plot.clientWidth || 800, ch = plot.clientHeight || 500;
        return {
          left: fbMargin.l, top: fbMargin.t,
          w: Math.max(cw - fbMargin.l - fbMargin.r, 120),
          h: Math.max(ch - fbMargin.t - fbMargin.b, 120),
        };
      },
      setFallbackMargin: function (m) { fbMargin = m; },
      /** 鼠标位置 → **绘图区坐标**（与 geom 同一套映射；tip / overlay 都用这套）。
       *  在绘图区内返回 {x, y}（y 向下），否则 null。 */
      pxIn: function (e) {
        var r = wrap.getBoundingClientRect();
        var g = this.geom();
        var px = e.clientX - r.left - g.left, py = e.clientY - r.top - g.top;
        if (px < 0 || px > g.w || py < 0 || py > g.h) return null;
        return { x: px, y: py };
      },
    };
  }

  /** 色带取样：colors 为 hex 数组，t ∈ [0, 1]。 */
  function ramp(colors, t) {
    var x = Math.min(Math.max(t, 0), 1) * (colors.length - 1);
    var i = Math.min(Math.floor(x), colors.length - 2), k = x - i;
    return GS.core.mixHex(colors[i], colors[i + 1], k);
  }

  /** 有序数组里离 v 最近的下标（对分）。 */
  function nearest(arr, v) {
    var lo = 0, hi = arr.length - 1;
    while (hi - lo > 1) {
      var m = (lo + hi) >> 1;
      if (arr[m] < v) lo = m; else hi = m;
    }
    return (v - arr[lo]) <= (arr[hi] - v) ? lo : hi;
  }

  var VIRIDIS = [
    '#440154', '#482878', '#3e4989', '#31688e', '#26828e', '#1f9e89',
    '#35b779', '#6ece58', '#b8de29', '#fde725',
  ];

  UI.charts = {
    FONT: FONT, MONO: MONO, INK: INK, DIM: DIM, GRID: GRID, AXIS: AXIS, ACCENT: ACCENT,
    VIRIDIS: VIRIDIS,
    axis: axis,
    baseLayout: baseLayout,
    draw: draw,
    mount: mount,
    ramp: ramp,
    nearest: nearest,

    disposeAll: function () {
      instances.forEach(function (it) {
        if (it.plot) { try { global.Plotly.purge(it.plot); } catch (e) { /* noop */ } }
      });
      instances = [];
    },

    disposeDetached: function () {
      instances = instances.filter(function (it) {
        if (it.plot && it.plot.isConnected) return true;
        if (it.plot) { try { global.Plotly.purge(it.plot); } catch (e) { /* noop */ } }
        return false;
      });
    },
  };
})(typeof globalThis !== 'undefined' ? globalThis : this);
