/* 基础专题 · 抗性区：减抗收益（收益倍数 + 等效血量两张曲线族，另附两张说明图）。 */
(function (global) {
  'use strict';
  var GS = global.GS = global.GS || {};
  var M = GS.modules = GS.modules || {};
  var CC = GS.core;
  var B = GS.core.basics;
  var el = GS.ui.panels.el;

  var KNEE = B.KNEE;
  var XN = 480;
  var Y_TOP = 5;              // 主图纵轴上限：曲线都在 5 以内时固定，超了才放大
  var C_NEG = '#2e8b57', C_LIN = '#2f6f9f', C_HIGH = '#e07b39';
  var C_MAIN = '#d62728';

  var fmtS = function (v) {
    var r = Math.round(v * 10) / 10;
    return Number.isInteger(r) ? String(r) : r.toFixed(1);
  };
  var labelOf = function (v) { return fmtS(v) + '%'; };
  /* 档位标签右对齐（等宽空格补在「减抗」之前），×值 成列，同时「减抗」与数字保持紧贴 */
  function labelPad(v, w) {
    var s = labelOf(v);
    return '<span style="font-family:monospace">' + ' '.repeat(Math.max(0, w - s.length)) + '</span>' +
           '减抗 <span style="font-family:monospace">' + s + '</span>';
  }
  /* 对比档位的色阶：浅 → 深（减抗越多越深） */
  function rampColor(t) {
    return CC.mixHex('#bac5d0', '#4a6680', t);
  }

  var FOOT =
    '术语：\\(r_0\\) = 怪物基础抗性（减抗前）；\\(S\\) = 减抗量；\\(\\kappa\\) = 抗性系数；' +
    '收益倍数 \\(G = \\kappa(r_0 - S) / \\kappa(r_0)\\)；' +
    '等效血量 \\(H = \\kappa(10\\% - S) / \\kappa(r_0 - S)\\)（同一减抗下、相对 10% 抗性敌人的倍数）。' +
    '<div class="formula">$$\\kappa(r) = \\begin{cases}' +
    '1 - \\dfrac{r}{2} & r &lt; 0 \\\\[2mm]' +
    '1 - r & 0 \\le r &lt; 0.75 \\\\[2mm]' +
    '\\dfrac{1}{4r + 1} & r \\ge 0.75' +
    '\\end{cases}$$</div>' +
    '由分段函数可得：固定减抗 \\(S\\) 的最大收益为 \\(1 + 4S\\)，出现在 \\(r_0 = \\max(75\\%,\\ S)\\)' +
    '（小减抗落在 75% 抗性的敌人身上，大减抗落在「恰好被削到 0」的敌人身上）。' +
    '公式与数值为社区 / 解包数据，非官方文本，请酌情参考。';

  M['basics/resistance'] = {
    title: '抗性区：减抗收益',
    tab: '抗性区·减抗收益',
    math: true,
    intro: '横轴是怪物抗性；红曲线 = 当前减抗量，灰蓝曲线 = 对比档位。上图 = 收益倍数（相对不减抗），' +
      '下图 = 等效血量（相对 10% 抗性敌人）；悬浮可一次对照各档数值。',
    controls: [
      {
        key: '', type: 'note',
        html: '<b>收益倍数 = 减抗后的抗性系数 ÷ 减抗前的抗性系数</b>，即相对「不减抗」的伤害倍数。' +
          '<b>怪物抗性不可改变</b> —— 横轴是一排待查的敌人（查你打的那只落在哪）；减抗来自队伍、按整数档处理。' +
          '减抗可以把抗性削成<b>负数</b>，负数区每点只值一半。多个减抗来源的叠加按「直接相加」处理（社区口径，本项目未核实）。',
      },
      { key: 's', type: 'range', label: '减抗量 %', def: 30, min: 0, max: 100, step: 1, box: { min: 0, step: 1 } },
      { key: 'ks', type: 'text', label: '对比档位 %', def: '20, 40, 60, 80, 100' },
      {
        key: 'xr', type: 'custom', defs: { x0: 0, x1: 150 },
        build: function (cell, api) {
          cell.appendChild(el('div', 'field__label', '横轴范围 %'));
          var pair = el('div', 'field__pair');
          pair.style.maxWidth = '220px';
          var x0 = el('input', 'field__input');
          x0.type = 'number'; x0.step = 10; x0.value = api.state.x0;
          var x1 = el('input', 'field__input');
          x1.type = 'number'; x1.step = 10; x1.value = api.state.x1;
          var dash = el('span', 'dash', '~');
          dash.style.color = 'var(--text-dim)';
          pair.appendChild(x0); pair.appendChild(dash); pair.appendChild(x1);
          cell.appendChild(pair);
          /* 两个框都给出合法值（左 < 右）才生效，否则沿用上一次的范围 */
          function commitRange() {
            var lo = parseFloat(x0.value), hi = parseFloat(x1.value);
            if (!Number.isFinite(lo) || !Number.isFinite(hi) || lo >= hi) return;
            api.state.x0 = lo; api.state.x1 = hi;
            api.commit();
          }
          [x0, x1].forEach(function (inp) {
            inp.addEventListener('change', commitRange);
            inp.addEventListener('keydown', function (e) { if (e.key === 'Enter') commitRange(); });
          });
        },
      },
    ],

    create: function (host, ctx) {
      var charts = ctx.charts;

      var verdict = el('div', 'verdict');
      var card1 = el('div', 'card chartcard');
      var m1 = charts.mount(card1, { height: 400 });
      var card2 = el('div', 'card chartcard');
      card2.appendChild(el('div', 'chart-h', '等效血量 —— <b>同一减抗下</b>，各敌人相对 10% 抗性敌人的倍数'));
      var m2 = charts.mount(card2, { height: 400 });
      var grid = el('div', 'grid2');
      var card3 = el('div', 'card chartcard');
      card3.appendChild(el('div', 'chart-h', '抗性系数 κ(r) —— 曲线形状'));
      var m3 = charts.mount(card3, { height: 300 });
      var card4 = el('div', 'card chartcard');
      card4.appendChild(el('div', 'chart-h', '边际收益 —— 每 1 点减抗值多少'));
      var m4 = charts.mount(card4, { height: 300 });
      grid.appendChild(card3);
      grid.appendChild(card4);

      host.appendChild(verdict);
      host.appendChild(card1);
      host.appendChild(card2);
      host.appendChild(grid);
      host.appendChild(GS.ui.panels.note(FOOT, 'pagenote'));

      var tip1 = ctx.tip.mount(m1.wrap, m1.geom);
      var tip2 = ctx.tip.mount(m2.wrap, m2.geom);

      /* ── 状态：横轴范围与采样（两张主图共用） ── */
      var X0 = 0, X1 = 1.5, XS = [];
      function setRange(lo, hi) {
        X0 = lo; X1 = hi;
        XS = [];
        for (var i = 0; i <= XN; i++) XS.push(X0 + (X1 - X0) * i / XN);
      }
      setRange(0, 1.5);

      var inRange = function (x) { return x >= X0 && x <= X1; };

      function parseRefs(txt) {
        var seen = {}, out = [];
        String(txt).split(/[^0-9.]+/).forEach(function (tok) {
          var v = parseFloat(tok);
          if (!Number.isFinite(v) || v < 0 || seen[v]) return;
          seen[v] = 1; out.push(v);
        });
        return out.sort(function (a, b) { return a - b; });
      }

      /* 对比档位的曲线只在档位文本或横轴范围变化时重算，拖滑动条时直接复用 */
      var refKey = null, refCurves = [];
      function refsFor(refs) {
        var key = refs.join(',') + '|' + X0 + '|' + X1;
        if (key !== refKey) {
          refKey = key;
          refCurves = refs.map(function (v) {
            var S = v / 100;
            return {
              S: S,
              ys: XS.map(function (x) { return B.gain(x, S); }),
              eq: XS.map(function (x) { return B.eqHp(x, S); }),
            };
          });
        }
        return refCurves;
      }

      /* 当前档与对比档位合成一条按减抗量升序的列表 */
      function tierEntries(sf, refs) {
        var offs = refsFor(refs).filter(function (c) { return Math.abs(c.S - sf) > 1e-9; });
        var colorOf = {};
        offs.forEach(function (c, i) {
          colorOf[c.S] = rampColor(offs.length === 1 ? 0.5 : i / (offs.length - 1));
        });
        var act = {
          S: sf, active: true,
          ys: XS.map(function (x) { return B.gain(x, sf); }),
          eq: XS.map(function (x) { return B.eqHp(x, sf); }),
        };
        return { list: [act].concat(offs).sort(function (a, b) { return a.S - b.S; }), colorOf: colorOf };
      }
      var colorFor = function (e, colorOf) { return e.active ? C_MAIN : colorOf[e.S]; };

      /* ── 主图：收益倍数随怪物基础抗性 ── */
      function buildMain(sf, tiers) {
        var list = tiers.list, colorOf = tiers.colorOf;
        var peakX = Math.max(KNEE, sf);
        var peakG = 1 + 4 * sf;
        var peakOn = inRange(peakX);
        var commonOn = inRange(B.R_COMMON);
        var top = -Infinity;
        list.forEach(function (e) { top = Math.max(top, Math.max.apply(null, e.ys)); });
        var ymax = top > Y_TOP ? top * 1.06 : Y_TOP;

        var traces = list.map(function (e) {
          return {
            type: 'scatter', mode: 'lines', x: XS, y: e.ys,
            line: { color: colorFor(e, colorOf), width: e.active ? 2.6 : 1.4 },
          };
        });
        if (commonOn) {
          traces.push({
            type: 'scatter', mode: 'markers', x: [B.R_COMMON], y: [B.gain(B.R_COMMON, sf)],
            marker: { color: C_MAIN, size: 8.5, line: { color: '#fff', width: 1.2 } },
          });
        }
        if (peakOn) {
          traces.push({
            type: 'scatter', mode: 'markers', x: [peakX], y: [peakG],
            marker: { color: C_MAIN, size: 10, symbol: 'diamond', line: { color: '#fff', width: 1.3 } },
          });
        }

        var span = X1 - X0;
        var shapes = [{ type: 'line', x0: X0, x1: X1, y0: 1, y1: 1, line: { color: '#bbb', width: 1.1, dash: 'dot' } }];
        var annos = [];
        if (commonOn) {
          shapes.push({ type: 'line', x0: B.R_COMMON, x1: B.R_COMMON, y0: 1, y1: ymax, line: { color: '#9a9a9a', width: 1.1, dash: 'dot' } });
          var labelW = Math.max.apply(null, list.map(function (e) { return labelOf(e.S * 100).length; }));
          var rows = list.map(function (e) {
            return (e.active ? '<span style="color:' + C_MAIN + '">' : '') +
              labelPad(e.S * 100, labelW) + '　×' + B.gain(B.R_COMMON, e.S).toFixed(3) +
              (e.active ? '</span>' : '');
          }).join('<br>');
          annos.push({
            x: 0.01, xref: 'paper', y: 1, yref: 'paper', xanchor: 'left', yanchor: 'top',
            yshift: -6, align: 'left', showarrow: false,
            font: { size: 11.5, color: '#333' }, bgcolor: 'rgba(255,255,255,0.92)',
            bordercolor: '#ddd', borderwidth: 1, borderpad: 6,
            text: '<b>10% 抗性敌人</b><br>' + rows,
          });
        }
        if (inRange(KNEE)) {
          shapes.push({ type: 'line', x0: KNEE, x1: KNEE, y0: 1, y1: ymax, line: { color: '#999', width: 1.2, dash: 'dash' } });
          annos.push({
            x: KNEE, y: ymax, xanchor: 'center', yanchor: 'top', yshift: -3, showarrow: false,
            font: { size: 11.5, color: '#777' }, text: '75%',
          });
        }
        function kink(x, color, label) {
          var atEdge = x > X1 - span * 0.04;
          shapes.push({ type: 'line', x0: x, x1: x, y0: 1, y1: ymax, line: { color: color, width: 1.2, dash: 'dash' } });
          annos.push({
            x: x, y: 1, xanchor: atEdge ? 'right' : 'center', xshift: atEdge ? -3 : 0,
            yanchor: 'bottom', yshift: 4, showarrow: false,
            font: { size: 11, color: color }, text: label,
          });
        }
        if (sf > 0.005 && inRange(sf)) kink(sf, C_NEG, '削到 0');
        if (sf > 0.005 && inRange(KNEE + sf)) kink(KNEE + sf, C_HIGH, '削后 75%');
        if (peakOn) {
          var nearTop = peakG > ymax - 0.14;
          var atRight = peakX > X0 + span * 0.77;
          annos.push({
            x: peakX, y: peakG, xanchor: atRight ? 'right' : 'left', xshift: atRight ? -10 : 10,
            yanchor: nearTop ? 'top' : 'middle',
            yshift: nearTop ? -9 : (peakG <= 1.02 ? 18 : 0), showarrow: false,
            font: { size: 12.5, color: C_MAIN }, bgcolor: 'rgba(255,255,255,0.85)',
            borderpad: 2, text: '峰值 ×' + peakG.toFixed(2),
          });
        }

        return {
          traces: traces,
          layout: {
            xaxis: charts.axis({ title: { text: '怪物基础抗性（减抗前）' }, range: [X0, X1], tickformat: '.0%' }),
            yaxis: charts.axis({ title: { text: '收益倍数（相对不减抗）' }, range: [1, ymax] }),
            shapes: shapes, annotations: annos,
            margin: { t: 22, r: 24, b: 48, l: 64 }, height: 400,
          },
        };
      }

      /* ── 等效血量：同一减抗下各敌人相对 10% 抗性敌人的倍数 ── */
      function buildEq(sf, tiers) {
        var list = tiers.list, colorOf = tiers.colorOf;
        var entries = list.some(function (e) { return e.S === 0; })
          ? list
          : [{ S: 0, baseline: true, eq: XS.map(function (x) { return B.eqHp(x, 0); }) }].concat(list);

        var lo = Infinity, hi = -Infinity;
        entries.forEach(function (e) {
          hi = Math.max(hi, Math.max.apply(null, e.eq));
          lo = Math.min(lo, Math.min.apply(null, e.eq));
        });
        var ylo = Math.min(0.8, lo * 0.97), yhi = Math.max(5.5, hi * 1.06);
        function rowOf(f) {
          var labelW = Math.max.apply(null, entries.map(function (e) { return labelOf(e.S * 100).length; }));
          return entries.map(function (e) {
            return (e.baseline ? '<span style="color:#999">' : e.active ? '<span style="color:' + C_MAIN + '">' : '') +
              labelPad(e.S * 100, labelW) + '　×' + f(e.S).toFixed(3) +
              (e.baseline || e.active ? '</span>' : '');
          }).join('<br>');
        }

        var traces = entries.map(function (e) {
          return {
            type: 'scatter', mode: 'lines', x: XS, y: e.eq,
            line: e.baseline ? { color: '#999', width: 1.4, dash: 'dash' }
                             : { color: colorFor(e, colorOf), width: e.active ? 2.6 : 1.4 },
          };
        });
        var highOn = inRange(B.R_HIGH);
        if (highOn) {
          traces.push({
            type: 'scatter', mode: 'markers', x: [B.R_HIGH], y: [B.eqHp(B.R_HIGH, sf)],
            marker: { color: C_MAIN, size: 8.5, line: { color: '#fff', width: 1.2 } },
          });
        }

        var shapes = [{ type: 'line', x0: X0, x1: X1, y0: 1, y1: 1, line: { color: '#bbb', width: 1.1, dash: 'dot' } }];
        var annos = [];
        function vline(x) {
          shapes.push({ type: 'line', x0: x, x1: x, y0: ylo, y1: yhi, line: { color: '#9a9a9a', width: 1.1, dash: 'dot' } });
        }
        if (inRange(B.R_COMMON)) {
          vline(B.R_COMMON);
          annos.push({
            x: B.R_COMMON, y: ylo, xanchor: 'center', yanchor: 'bottom', yshift: 4, showarrow: false,
            font: { size: 11, color: '#999' }, text: '10%',
          });
        }
        if (highOn) {
          vline(B.R_HIGH);
          annos.push({
            x: 0.01, xref: 'paper', y: 1, yref: 'paper', xanchor: 'left', yanchor: 'top',
            yshift: -6, align: 'left', showarrow: false,
            font: { size: 11.5, color: '#333' }, bgcolor: 'rgba(255,255,255,0.92)',
            bordercolor: '#ddd', borderwidth: 1, borderpad: 6,
            text: '<b>70% 抗性敌人</b><br>' + rowOf(function (S) { return B.eqHp(B.R_HIGH, S); }),
          });
        }

        return {
          traces: traces,
          layout: {
            xaxis: charts.axis({ title: { text: '怪物基础抗性（减抗前）' }, range: [X0, X1], tickformat: '.0%' }),
            yaxis: charts.axis({ title: { text: '等效血量倍数' }, range: [ylo, yhi] }),
            shapes: shapes, annotations: annos,
            margin: { t: 22, r: 24, b: 48, l: 64 }, height: 400,
          },
        };
      }

      /* ── 静态说明图 1：抗性系数曲线 ── */
      function buildKappa() {
        var xs = [], ys = [];
        for (var i = 0; i <= 480; i++) {
          var r = -0.4 + 2.0 * i / 480;
          xs.push(r); ys.push(CC.kappa(r));
        }
        return {
          traces: [
            { type: 'scatter', mode: 'lines', x: xs, y: ys, line: { color: '#333', width: 2.4 } },
            { type: 'scatter', mode: 'lines', x: [KNEE, 1.0], y: [0.25, 0], line: { color: '#aaa', width: 1.4, dash: 'dot' } },
            { type: 'scatter', mode: 'markers', x: [0, KNEE, 1.0], y: [1, 0.25, 0.2],
              marker: { color: '#333', size: 7, line: { color: '#fff', width: 1.1 } } },
          ],
          layout: {
            xaxis: charts.axis({ title: { text: '抗性 r' }, range: [-0.4, 1.6], tickformat: '.0%' }),
            yaxis: charts.axis({ title: { text: 'κ(r)' }, range: [0, 1.35] }),
            shapes: [
              { type: 'rect', x0: -0.4, x1: 0, y0: 0, y1: 1.4, fillcolor: 'rgba(46,139,87,0.07)', line: { width: 0 } },
              { type: 'rect', x0: 0, x1: KNEE, y0: 0, y1: 1.4, fillcolor: 'rgba(47,111,159,0.07)', line: { width: 0 } },
              { type: 'rect', x0: KNEE, x1: 1.6, y0: 0, y1: 1.4, fillcolor: 'rgba(224,123,57,0.09)', line: { width: 0 } },
            ],
            annotations: [
              { x: KNEE, y: 0.25, xanchor: 'right', xshift: -8, yanchor: 'top', yshift: -4, showarrow: false,
                font: { size: 11, color: '#777' }, text: '75% → ×0.25' },
              { x: 1.0, y: 0.2, xanchor: 'left', xshift: 8, yanchor: 'bottom', yshift: 6, showarrow: false,
                font: { size: 11, color: '#777' }, text: '100% → ×0.20' },
              { x: -0.38, y: 0.88, xanchor: 'left', yanchor: 'middle', showarrow: false,
                font: { size: 11, color: C_NEG }, text: '负区：每点半价' },
              { x: 0.08, y: 0.55, xanchor: 'left', yanchor: 'middle', showarrow: false,
                font: { size: 11, color: C_LIN }, text: '线性段 1−r' },
              { x: 0.80, y: 0.55, xanchor: 'left', yanchor: 'middle', showarrow: false,
                font: { size: 11, color: C_HIGH }, text: '高抗段 1/(4r+1)' },
            ],
            margin: { t: 16, r: 14, b: 42, l: 52 }, height: 300,
          },
        };
      }

      /* ── 静态说明图 2：边际收益 ── */
      function buildM() {
        function seg(lo, hi, f) {
          var xs = [], ys = [];
          for (var i = 0; i <= 200; i++) {
            var r = lo + (hi - lo) * i / 200;
            xs.push(r); ys.push(f(r));
          }
          return { xs: xs, ys: ys };
        }
        var a = seg(-0.4, 0, function (r) { return B.marginal(0); }),
            b = seg(0, KNEE, function (r) { return B.marginal(r); }),
            c = seg(KNEE, 1.6, function (r) { return B.marginal(r); });
        return {
          traces: [
            { type: 'scatter', mode: 'lines', x: a.xs, y: a.ys, line: { color: C_NEG, width: 2.4 } },
            { type: 'scatter', mode: 'lines', x: b.xs, y: b.ys, line: { color: C_LIN, width: 2.4 } },
            { type: 'scatter', mode: 'lines', x: c.xs, y: c.ys, line: { color: C_HIGH, width: 2.4 } },
            { type: 'scatter', mode: 'markers', x: [0, 0, KNEE, KNEE, 1.0],
              y: [0.5, 1.0, 4.0, 1.0, 0.8], marker: { color: '#555', size: 6 } },
          ],
          layout: {
            xaxis: charts.axis({ title: { text: '抗性 r' }, range: [-0.4, 1.6], tickformat: '.0%' }),
            yaxis: charts.axis({ title: { text: '每 1 点的相对收益 %' }, range: [0, 4.4] }),
            shapes: [
              { type: 'line', x0: 0, x1: 0, y0: 0, y1: 4.4, line: { color: '#bbb', width: 1.1, dash: 'dash' } },
              { type: 'line', x0: KNEE, x1: KNEE, y0: 0, y1: 4.4, line: { color: '#bbb', width: 1.1, dash: 'dash' } },
            ],
            annotations: [
              { x: 0, y: 0.5, xanchor: 'right', xshift: -8, yanchor: 'middle', showarrow: false,
                font: { size: 11, color: C_NEG }, text: '0.50%' },
              { x: 0, y: 1.0, xanchor: 'left', xshift: 8, yanchor: 'top', yshift: -2, showarrow: false,
                font: { size: 11, color: C_LIN }, text: '1.00%' },
              { x: KNEE, y: 4.0, xanchor: 'right', xshift: -8, yanchor: 'middle', showarrow: false,
                font: { size: 11, color: C_LIN }, text: '4.00%' },
              { x: 1.0, y: 0.8, xanchor: 'left', xshift: 6, yanchor: 'bottom', yshift: 4, showarrow: false,
                font: { size: 11, color: C_HIGH }, text: '100%→0.80%' },
            ],
            margin: { t: 16, r: 14, b: 42, l: 56 }, height: 300,
          },
        };
      }

      /* ── 悬浮卡片：一屏对照各档 ── */
      function bindHover(m, tip, mode) {
        var state = null;
        m.wrap.addEventListener('mousemove', function (e) {
          var p = m.pxIn(e);
          if (!p) { tip.hide(); return; }
          var s = state;
          var sf = Math.max(s.s, 0) / 100;
          var tiers = tierEntries(sf, parseRefs(s.ks));
          var g = m.geom();
          var r0 = X0 + p.x / g.w * (X1 - X0);
          var rows = tiers.list.map(function (en) {
            var color = en.active ? C_MAIN : tiers.colorOf[en.S];
            var v = mode === 'eq' ? B.eqHp(r0, en.S) : B.gain(r0, en.S);
            return [ctx.tip.sw(color) + (en.active ? '当前 · ' : '') + '减抗 ' + labelOf(en.S * 100), '×' + v.toFixed(3)];
          });
          tip.show(ctx.tip.card({ title: '怪物抗性 ' + fmtS(r0 * 100) + '%（减抗前）', rows: rows }), p.x, p.y);
        });
        m.wrap.addEventListener('mouseleave', function () { tip.hide(); });
        return function (s) { state = s; };
      }

      var setHoverState1 = bindHover(m1, tip1, 'gain');
      var setHoverState2 = bindHover(m2, tip2, 'eq');

      function updateVerdict(s) {
        var sf = Math.max(s.s, 0) / 100;
        var peakX = Math.max(KNEE, sf);
        var peakG = 1 + 4 * sf;
        verdict.innerHTML = sf === 0
          ? '<div class="verdict__sub">减抗 0：收益恒为 ×1.000。</div>'
          : '<div class="verdict__hero">峰值 <b>×' + peakG.toFixed(2) + '</b>，出现在怪物抗性 ' + (peakX * 100).toFixed(0) + '%</div>' +
            '<div class="verdict__sub">对 0% 抗性的敌人 ×' + B.gain(0, sf).toFixed(3) + '（削到负区，每点只值一半）。</div>';
      }

      function update(s) {
        setHoverState1(s);
        setHoverState2(s);
        if (s.x0 !== undefined && s.x1 !== undefined && s.x0 < s.x1) {
          if (s.x0 / 100 !== X0 || s.x1 / 100 !== X1) setRange(s.x0 / 100, s.x1 / 100);
        }
        var sf = Math.max(s.s, 0) / 100;
        updateVerdict(s);
        var tiers = tierEntries(sf, parseRefs(s.ks));
        var main = buildMain(sf, tiers);
        charts.draw(m1.plot, main.traces, main.layout);
        var eq = buildEq(sf, tiers);
        charts.draw(m2.plot, eq.traces, eq.layout);
        var k = buildKappa(), mm = buildM();
        charts.draw(m3.plot, k.traces, k.layout);
        charts.draw(m4.plot, mm.traces, mm.layout);
      }

      return {
        plot: m1.plot,
        update: update,
        preview: updateVerdict,   // 拖动滑条时只更新结论条
      };
    },
  };
})(typeof globalThis !== 'undefined' ? globalThis : this);
