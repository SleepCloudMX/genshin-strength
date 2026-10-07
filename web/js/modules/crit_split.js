/* 基础专题 · 暴击：分配 —— 双暴分固定、按分位数而不是期望分配暴击率 / 暴伤。 */
(function (global) {
  'use strict';
  var GS = global.GS = global.GS || {};
  var M = GS.modules = GS.modules || {};
  var B = GS.core.basics;
  var el = GS.ui.panels.el;

  var W = 1e4;
  var S = 1 / W;
  var QPAL = ['#2f6f9f', '#2e8b57', '#e07b39', '#7b5ea7', '#c2453a', '#5a7d9a'];
  var qColor = function (i) { return QPAL[i % QPAL.length]; };

  function fmtW(v) {
    var w = v / W, a = Math.abs(w);
    if (a >= 100) return Math.round(w).toLocaleString('en-US') + 'w';
    if (a >= 10) return parseFloat(w.toFixed(1)) + 'w';
    return parseFloat(w.toFixed(2)) + 'w';
  }
  var signed = function (v) { return (v >= 0 ? '+' : '−') + (Math.abs(v) * 100).toFixed(2) + '%'; };
  var qLabel = function (q) {
    var v = q * 100;
    return (Math.abs(v - Math.round(v)) < 1e-9 ? String(Math.round(v)) : v.toFixed(1)) + '%';
  };
  function parseList(str, lo, hi) {
    var seen = {}, out = [];
    String(str).split(/[^0-9.]+/).forEach(function (tok) {
      var v = parseFloat(tok);
      if (!Number.isFinite(v) || v <= lo || v >= hi || seen[v]) return;
      seen[v] = 1; out.push(v);
    });
    return out.sort(function (a, b) { return a - b; });
  }

  /* 分位网格（横轴上取 50%–99.9% 与 5%–50% 两侧） */
  var QGRID = [];
  (function () {
    for (var i = 5; i <= 49; i++) QGRID.push(i / 100);
    for (var j = 50; j <= 98; j++) QGRID.push(j / 100);
    for (var k = 990; k <= 999; k++) QGRID.push(k / 1000);
  })();

  /* 分位横轴：按 q/(1−q) 拉开（等距的 80% / 90% / 95% / 99% 不再挤在一起） */
  var LOGIT = function (q) { return Math.log(q / (1 - q)); };
  var QTICKS = [0.05, 0.1, 0.2, 0.5, 0.8, 0.9, 0.95, 0.99, 0.999];
  function qAxis() {
    return GS.ui.charts.axis({
      title: { text: '分位 q（越大越赌）' },
      range: [LOGIT(0.05), LOGIT(0.999)],
      tickvals: QTICKS.map(LOGIT), ticktext: QTICKS.map(qLabel),
    });
  }

  var FOOT =
    '分配：双暴分 V = 2·暴击率 + 暴伤 固定，扫暴击率、暴伤 = V − 2·暴击率。均值最优在暴击率 = V/4（即 1:2）；' +
    '<b>分位增益</b> = Q_q(最优) / Q_q(1:2) − 1，<b>均值代价</b> = E(最优) / E(1:2) − 1 —— 1:2 只是「期望」口径的最优。<br>' +
    '曲线为什么是锯齿：双暴分守恒（暴击率涨 1 点、暴伤必降 2 点）+「前 q 需要几次暴击」是<b>整数</b>：' +
    '齿内同一个暴击数、伤害沿直线缓降，跨齿门槛多要一次暴击、跳升一次。<br>' +
    '分位定义（Q_q = min{ x : F(x) ≥ q }）与分布算法见<a href="#/basics/crit_dist">波动</a>页；' +
    '数值只是算术演示，不代表任何实际配置；推导见 <code>docs/ai-output/2-basics/2-crit.md</code>。';

  M['basics/crit_split'] = {
    title: '暴击：分配',
    tab: '暴击·分配',
    intro: '双暴分固定的前提下，<b>按分位数而不是按期望</b>把暴击率 / 暴伤重新分配：逐档给出「前 q 可达伤害」的最优暴击率 / 暴伤、' +
      '分位增益与均值代价。伤害单位 <b>w = 万</b>；姊妹页见 <a href="#/basics/crit_dist">暴击：波动</a>。',
    controls: [
      {
        key: '', type: 'note',
        html: '<b>双暴分 = 2 × 暴击率 + 暴伤</b>，扫描时它固定不变、只在暴击率与暴伤之间重新分：横轴扫暴击率，暴伤随之由约束推出（顶轴是对应的暴伤）。' +
          '<b>分位 q</b> 越大越赌（看前 1−q 的最好情况），越小越稳（看兜底）。单段模型：单次伤害 × 次数。' +
          '分位最优常是<b>刀锋解</b>（曲线呈锯齿），读数按网格取整。',
      },
      { key: 'bV', type: 'number', label: '双暴分', def: 320, step: 10, min: 10 },
      { key: 'bnon', type: 'number', label: '单次未暴击伤害 w', def: 20, step: 1, min: 0 },
      { key: 'bn', type: 'number', label: '伤害次数', def: 30, step: 1, min: 1, max: 500 },
      { key: 'bq', type: 'text', label: '分位档 %', def: '50, 80, 90, 95, 99' },
    ],

    create: function (host, ctx) {
      var charts = ctx.charts;

      var rd = el('div', 'verdict');
      var card1 = el('div', 'card chartcard');
      var m1 = charts.mount(card1, { height: 420 });
      var grid = el('div', 'grid2');
      var card2 = el('div', 'card chartcard');
      card2.appendChild(el('div', 'chart-h', '最优暴击率随分位 —— 越赌越低、越稳越高'));
      var m2 = charts.mount(card2, { height: 300 });
      var card3 = el('div', 'card chartcard');
      card3.appendChild(el('div', 'chart-h', '偏离 1:2 的收益与代价'));
      var m3 = charts.mount(card3, { height: 300 });
      grid.appendChild(card2);
      grid.appendChild(card3);

      var table = el('div', 'card chartcard');

      host.appendChild(rd);
      host.appendChild(card1);
      host.appendChild(grid);
      host.appendChild(table);
      host.appendChild(GS.ui.panels.note(FOOT, 'pagenote'));

      var tip1 = ctx.tip.mount(m1.wrap, m1.geom);
      var tip2 = ctx.tip.mount(m2.wrap, m2.geom);
      var tip3 = ctx.tip.mount(m3.wrap, m3.geom);
      var cache = null;     // { V, n, V0, sw, idxOf, qs }
      var g2ref = null, g3ref = null;

      /* ═══ 图 1：分位曲线族 ═══ */
      function build1(c) {
        var V = c.V, V0 = c.V0, qs = c.qs, sw = c.sw, idxOf = c.idxOf;
        var cxs = Array.from(sw.cgrid, function (x) { return x * 100; });
        function trac(arr, name, color, width, dash) {
          return {
            type: 'scatter', mode: 'lines', x: cxs,
            y: Array.from(arr, function (v) { return v * V0 * S; }),
            line: { color: color, width: width, dash: dash || 'solid' },
            name: name,
          };
        }
        var traces = qs.map(function (q, i) {
          return trac(sw.qv[idxOf.get(q)], '分位 ' + qLabel(q), qColor(i), 1.8);
        });
        traces.push(trac(sw.mean, '期望', '#333', 2, 'dash'));

        var lo = Infinity, hi = -Infinity;
        traces.forEach(function (t) {
          t.y.forEach(function (v) { if (v < lo) lo = v; if (v > hi) hi = v; });
        });
        var padY = (hi - lo) * 0.05 || 1;

        var shapes = [], annos = [];
        var c12 = Math.min(V / 4, 1) * 100;
        shapes.push({ type: 'line', x0: c12, x1: c12, yref: 'paper', y0: 0, y1: 1,
                      line: { color: '#999', width: 1.2, dash: 'dash' } });
        annos.push({ x: c12, y: 0, yref: 'paper', xanchor: 'left', xshift: 6, yanchor: 'bottom', yshift: 4,
                     showarrow: false, font: { size: 11, color: '#777' }, text: '1:2（均值最优）' });
        qs.forEach(function (q, i) {
          var o = B.optimalOf(sw.qv[idxOf.get(q)], sw.cgrid);
          traces.push({
            type: 'scatter', mode: 'markers', x: [o.c * 100], y: [o.Q * V0 * S],
            marker: { color: qColor(i), size: 9, line: { color: '#fff', width: 1.2 } },
            showlegend: false,
          });
          annos.push({
            x: o.c * 100, y: o.Q * V0 * S, xanchor: 'center',
            yanchor: i % 2 ? 'top' : 'bottom', yshift: i % 2 ? -9 : 9,
            showarrow: false, font: { size: 11.5, color: qColor(i) }, text: qLabel(q),
          });
        });

        return {
          traces: traces,
          layout: {
            xaxis: charts.axis({ title: { text: '暴击率 %' }, range: [0, sw.cmax * 100] }),
            xaxis2: charts.axis({
              title: { text: '暴伤 %' }, overlaying: 'x', side: 'top',
              range: [V * 100, (V - 2 * sw.cmax) * 100], showgrid: false, tickformat: '.0f',
            }),
            yaxis: charts.axis({ title: { text: '伤害（w）' }, range: [lo - padY, hi + padY * 1.6] }),
            shapes: shapes, annotations: annos, showlegend: true,
            legend: { orientation: 'h', x: 0, y: 1.13, font: { size: 11 } },
            margin: { t: 58, r: 24, b: 44, l: 74 }, height: 420,
          },
        };
      }

      /* ═══ 图 2：最优暴击率随分位 ═══ */
      function build2(c) {
        var sw = c.sw, idxOf = c.idxOf, qs = c.qs;
        var xs = [], ys = [];
        for (var i = 0; i < QGRID.length; i++) {
          var o = B.optimalOf(sw.qv[idxOf.get(QGRID[i])], sw.cgrid);
          xs.push(LOGIT(QGRID[i])); ys.push(o.c * 100);
        }
        var c12 = Math.min(c.V / 4, 1) * 100;
        var traces = [
          { type: 'scatter', mode: 'lines', x: xs, y: ys, line: { color: '#2f6f9f', width: 2 } },
          { type: 'scatter', mode: 'markers', x: qs.map(LOGIT),
            y: qs.map(function (q) { return B.optimalOf(sw.qv[idxOf.get(q)], sw.cgrid).c * 100; }),
            marker: { color: '#2f6f9f', size: 7, line: { color: '#fff', width: 1 } } },
        ];
        return {
          traces: traces, logit: xs, crit: ys,
          layout: {
            xaxis: qAxis(),
            yaxis: charts.axis({ title: { text: '最优暴击率 %' }, range: [0, 102] }),
            shapes: [
              { type: 'line', xref: 'paper', x0: 0, x1: 1, y0: c12, y1: c12, line: { color: '#999', width: 1.1, dash: 'dash' } },
              { type: 'line', xref: 'paper', x0: 0, x1: 1, y0: sw.cmax * 100, y1: sw.cmax * 100, line: { color: '#ddd', width: 1 } },
            ],
            annotations: [{ x: 1, xref: 'paper', y: c12, yanchor: 'bottom', xanchor: 'right', yshift: 3,
              showarrow: false, font: { size: 11, color: '#777' }, text: '1:2（' + c12.toFixed(0) + '%）' }],
            margin: { t: 16, r: 24, b: 46, l: 60 }, height: 300,
          },
        };
      }

      /* ═══ 图 3：收益与代价 ═══ */
      function build3(c) {
        var V = c.V, n = c.n, sw = c.sw, idxOf = c.idxOf, qs = c.qs;
        var meanAt = function (cc) { return n * (1 + cc * (V - 2 * cc)); };
        var m12 = meanAt(Math.min(V / 4, 1));
        var xs = [], gain = [], loss = [];
        for (var i = 0; i < QGRID.length; i++) {
          var o = B.optimalOf(sw.qv[idxOf.get(QGRID[i])], sw.cgrid);
          xs.push(LOGIT(QGRID[i]));
          gain.push((o.Q / B.qAt12(V, n, QGRID[i]) - 1) * 100);
          loss.push((meanAt(o.c) / m12 - 1) * 100);
        }
        var traces = [
          { type: 'scatter', mode: 'lines', x: xs, y: gain, line: { color: '#2e8b57', width: 2 }, name: '分位增益' },
          { type: 'scatter', mode: 'lines', x: xs, y: loss, line: { color: '#c2453a', width: 2 }, name: '均值代价' },
          { type: 'scatter', mode: 'markers', x: qs.map(LOGIT),
            y: qs.map(function (q) { return (B.optimalOf(sw.qv[idxOf.get(q)], sw.cgrid).Q / B.qAt12(V, n, q) - 1) * 100; }),
            marker: { color: '#2e8b57', size: 7, line: { color: '#fff', width: 1 } }, showlegend: false },
          { type: 'scatter', mode: 'markers', x: qs.map(LOGIT),
            y: qs.map(function (q) {
              var cc = B.optimalOf(sw.qv[idxOf.get(q)], sw.cgrid).c;
              return (meanAt(cc) / m12 - 1) * 100;
            }),
            marker: { color: '#c2453a', size: 7, line: { color: '#fff', width: 1 } }, showlegend: false },
        ];
        return {
          traces: traces, logit: xs, gain: gain, loss: loss,
          layout: {
            xaxis: qAxis(),
            yaxis: charts.axis({ title: { text: '%（相对 1:2）' }, zeroline: true, zerolinecolor: '#bbb' }),
            showlegend: true,
            legend: { orientation: 'h', x: 0, y: 1.12, font: { size: 11 } },
            margin: { t: 30, r: 24, b: 46, l: 60 }, height: 300,
          },
        };
      }

      function update(s) {
        var V = s.bV / 100;
        var V0 = s.bnon * W, n = Math.round(s.bn);
        if (!Number.isFinite(V) || !Number.isFinite(V0) || !Number.isFinite(n) || V <= 0) return;
        var qs = parseList(s.bq, 0, 100).map(function (v) { return v / 100; });
        var qList = Array.from(new Set(QGRID.concat(qs))).sort(function (a, b) { return a - b; });
        var sw = B.sweepB(V, n, qList);
        var idxOf = new Map(qList.map(function (q, i) { return [q, i]; }));
        var c12 = Math.min(V / 4, 1);
        var meanAt = function (cc) { return n * (1 + cc * (V - 2 * cc)); };
        cache = { V: V, n: n, V0: V0, sw: sw, idxOf: idxOf, qs: qs };

        var rows = qs.map(function (q, i) {
          var o = B.optimalOf(sw.qv[idxOf.get(q)], sw.cgrid);
          var q12 = B.qAt12(V, n, q);
          var gain = o.Q / q12 - 1, loss = meanAt(o.c) / meanAt(c12) - 1;
          return '<tr><td><span class="dot" style="background:' + qColor(i) + '"></span>' + qLabel(q) + '</td>' +
            '<td><b>' + (o.c * 100).toFixed(1) + '%</b></td><td><b>' + ((V - 2 * o.c) * 100).toFixed(1) + '%</b></td>' +
            '<td>' + fmtW(q12 * V0).replace(/w$/, '') + '</td><td>' + signed(gain) + '</td><td>' + signed(loss) + '</td></tr>';
        }).join('');
        rd.innerHTML =
          '<div class="verdict__sub">双暴分 <b>' + (V * 100).toFixed(1) + '</b>　单段：<b>' + n + '</b> 次 × ' + fmtW(V0) +
          '　1:2（均值最优）= <b>' + (c12 * 100).toFixed(1) + '% / ' + ((V - 2 * c12) * 100).toFixed(1) + '%</b></div>';
        table.innerHTML = '<div class="tablewrap"><table class="dtable"><thead><tr><th>分位 q</th><th>最优暴击率</th>' +
          '<th>最优暴伤</th><th>1:2 处的值（w）</th><th>分位增益</th><th>均值代价</th></tr></thead><tbody>' + rows + '</tbody></table></div>';

        var g1 = build1(cache), g2 = build2(cache), g3 = build3(cache);
        g2ref = g2; g3ref = g3;
        charts.draw(m1.plot, g1.traces, g1.layout);
        charts.draw(m2.plot, g2.traces, g2.layout);
        charts.draw(m3.plot, g3.traces, g3.layout);
      }

      /* ── 悬浮卡片 ── */
      function xOf(m, p) {
        var fl = m.plot._fullLayout;
        if (!fl || !fl.xaxis || !fl.xaxis._length) return null;
        var xr = fl.xaxis.range;
        return xr[0] + p.x / fl.xaxis._length * (xr[1] - xr[0]);
      }

      m1.wrap.addEventListener('mousemove', function (e) {
        var p = m1.pxIn(e);
        if (!p || !cache) { tip1.hide(); return; }
        var cPct = xOf(m1, p);
        if (cPct == null) return;
        var c = Math.min(Math.max(cPct / 100, 0), cache.sw.cmax);
        var cum = B.cumOf(B.binomPMF(cache.n, c));
        var d = cache.V - 2 * c;
        var rows = cache.qs.map(function (q, i) {
          return [ctx.tip.sw(qColor(i)) + '分位 ' + qLabel(q), fmtW((cache.n + d * B.firstAtLeast(cum, q)) * cache.V0)];
        });
        rows.push(['期望', fmtW(cache.n * (1 + c * d) * cache.V0)]);
        tip1.show(ctx.tip.card({
          title: '暴击率 ' + (c * 100).toFixed(1) + '% · 暴伤 ' + (d * 100).toFixed(1) + '%',
          rows: rows,
        }), p.x, p.y);
      });
      m1.wrap.addEventListener('mouseleave', tip1.hide);

      function qOf(logit) { return Math.exp(logit) / (1 + Math.exp(logit)); }
      function nearest(logits, x) {
        var best = 0, bd = Infinity;
        for (var i = 0; i < logits.length; i++) {
          var d = Math.abs(logits[i] - x);
          if (d < bd) { bd = d; best = i; }
        }
        return best;
      }

      m2.wrap.addEventListener('mousemove', function (e) {
        var p = m2.pxIn(e);
        if (!p || !g2ref || !cache) { tip2.hide(); return; }
        var x = xOf(m2, p);
        if (x == null) return;
        var i = nearest(g2ref.logit, x);
        var crit = g2ref.crit[i];
        tip2.show(ctx.tip.card({
          title: '分位 ' + qLabel(qOf(g2ref.logit[i])),
          rows: [['最优暴击率', crit.toFixed(1) + '%'], ['对应暴伤', (cache.V * 100 - 2 * crit).toFixed(1) + '%']],
        }), p.x, p.y);
      });
      m2.wrap.addEventListener('mouseleave', tip2.hide);

      m3.wrap.addEventListener('mousemove', function (e) {
        var p = m3.pxIn(e);
        if (!p || !g3ref) { tip3.hide(); return; }
        var x = xOf(m3, p);
        if (x == null) return;
        var i = nearest(g3ref.logit, x);
        tip3.show(ctx.tip.card({
          title: '分位 ' + qLabel(qOf(g3ref.logit[i])),
          rows: [['分位增益', signed(g3ref.gain[i] / 100)], ['均值代价', signed(g3ref.loss[i] / 100)]],
        }), p.x, p.y);
      });
      m3.wrap.addEventListener('mouseleave', tip3.hide);

      return { plot: m1.plot, update: update };
    },
  };
})(typeof globalThis !== 'undefined' ? globalThis : this);
