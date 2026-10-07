/* 瑞希 · 血红之证 4 件套 vs 精通套：比值热力图，同时是计算器（点击图面移动基准）。 */
(function (global) {
  'use strict';
  var GS = global.GS = global.GS || {};
  var M = GS.modules = GS.modules || {};
  var Mi = GS.core.mizuki;
  var el = GS.ui.panels.el;

  var GRID = 201;
  var EM_MAX = Mi.EM_MAX, SCORE_MAX = Mi.SCORE_MAX;

  // 色带取自 matplotlib 的 RdBu_r，与静态图一致
  var COLORSCALE = [
    [0.000, '#053061'], [0.167, '#3783bb'], [0.333, '#a7d0e4'], [0.500, '#f7f6f6'],
    [0.667, '#f7b799'], [0.833, '#c94741'], [1.000, '#67001f'],
  ];
  // 参考配装：双暴分 = 2×暴击 + 暴伤
  var REFERENCES = [
    { score: 100, label: '25/50' },
    { score: 240, label: '60/120' },
  ];

  M['mizuki/scarlet_vs_em'] = {
    title: '「梦见月瑞希」血红之证 4 件套 vs 精通套',
    tab: '瑞希·套装对比',
    intro: '悬浮读该点的比值；<b>点击图面可把基准移到该点</b>（双暴分按 1 : 2 拆成暴击 / 暴伤）。' +
      '改基准三项只移动十字准星与结论条；星扩散增伤、直伤占比、精通套变，图才重算。',
    controls: [
      {
        key: '', type: 'note',
        html: '<b>以下都填「上完 buff」后的实际数值</b>（含副词条；不含套装特效 —— 两套的套装效果由脚本自动加上）。',
      },
      {
        key: '', type: 'note',
        html: '<b>星扩散伤害 = 星扩散直伤（大头）+ 反应星扩散</b>。<b>星扩散直伤占比</b>：给定的假定常数（全图按此假定，' +
          '不随基准精通变化），计算中直接采用；本页<b>不</b>根据你的配置推算真实占比（实测约九成，见' +
          '<a href="#/mizuki/stellar_swirl#share">机制页</a>）。默认 90%；拉到 100% = 只看星扩散直伤。',
      },
      { key: 'bonus', type: 'number', label: '星扩散增伤 %', def: 90, step: 5, min: 0 },
      { key: 'em', type: 'number', label: '基准精通', def: 1000, step: 10, min: 589 },
      { key: 'cr', type: 'number', label: '基准暴击率 %', def: 60, step: 0.1, min: 5 },
      { key: 'cd', type: 'number', label: '基准暴伤 %', def: 120, step: 0.1, min: 50 },
      { key: 'score', type: 'readout', label: '双暴分', compute: function (s) { return (2 * s.cr + s.cd).toFixed(1); } },
      { key: 'd', type: 'range', label: '星扩散直伤占比', def: 90, min: 0, max: 100, step: 1, unit: '%' },
      {
        key: 'eset', type: 'select', label: '精通套', def: 'gild2',
        options: [
          { value: 'gild2', label: '饰金之梦 4 件套（+180 精通）' },
          { value: 'em22', label: '精通 2+2（+160 精通）' },
        ],
      },
    ],

    create: function (host, ctx) {
      var charts = ctx.charts;

      var verdict = el('div', 'verdict');
      var card = el('div', 'card chartcard');
      var m = charts.mount(card, { height: 620 });
      var foot = el('p', 'pagenote');
      foot.innerHTML =
        '<b>双暴分</b> = 2 × 基准暴击 + 基准暴伤（实时算出）。血红之证 4 件套的 +16% 暴击由脚本自己加，' +
        '所以图上血红那一路是「你填的暴击 + 16%」（双暴分 +32）。两套的精通也不同：<span class="foot-set"></span> ' +
        '比你填的基准精通多 <span class="foot-em"></span>。星扩散增伤则是在你填的值上，血红那一路再 +40%。<br>' +
        '比值 = 两套的期望伤害比，&gt; 1 表示血红更优。倍率、(1 + 基础提升)、抗性系数、擢升在同队伍下相同，已约掉。';
      host.appendChild(verdict);
      host.appendChild(card);
      host.appendChild(foot);

      var footSet = foot.querySelector('.foot-set');
      var footEm = foot.querySelector('.foot-em');
      var tip = ctx.tip.mount(m.wrap, m.geom);
      var st = null;
      var cache = { key: null, heat: null, divider: null };

      function state(s) {
        return { bonus: s.bonus / 100, em: s.em, score: 2 * s.cr + s.cd, d: s.d / 100, leg: Mi.EM_SETS[s.eset] || Mi.EM_SETS.gild2 };
      }

      /** Plotly 没有 matplotlib 的 TwoSlopeNorm，手动模拟分段压缩：1.0 → 色带正中。 */
      function makeColorMap(values) {
        var lo = Infinity, hi = -Infinity;
        values.forEach(function (row) {
          row.forEach(function (v) { if (v < lo) lo = v; if (v > hi) hi = v; });
        });
        lo = Math.min(lo, 1 - 1e-9);
        hi = Math.max(hi, 1 + 1e-9);
        return {
          lo: lo, hi: hi,
          toT: function (v) { return v <= 1 ? 0.5 * (v - lo) / (1 - lo) : 0.5 + 0.5 * (v - 1) / (hi - 1); },
        };
      }

      function heatOf(s) {
        var key = s.bonus + '|' + s.d + '|' + s.leg.id;
        if (cache.key === key) return cache;
        var ems = [], scores = [];
        for (var i = 0; i < GRID; i++) ems.push(EM_MAX * i / (GRID - 1));
        for (var j = 0; j < GRID; j++) scores.push(SCORE_MAX * j / (GRID - 1));
        var raw = scores.map(function (sc) {
          return ems.map(function (em) { return Mi.ratio(em, sc / 100, s.bonus, s.d, s.leg); });
        });
        var cmap = makeColorMap(raw);
        var z = raw.map(function (row) { return row.map(cmap.toT); });
        var tickVals = [cmap.lo, (cmap.lo + 1) / 2, 1, (1 + cmap.hi) / 2, cmap.hi];
        var round2 = function (v) { return Math.round(v * 100) / 100; };
        var heat = {
          type: 'heatmap', x: ems, y: scores, z: z,
          colorscale: COLORSCALE, zmin: 0, zmax: 1, showlegend: false,
          colorbar: {
            title: { text: '血红 / ' + s.leg.name }, thickness: 16, len: 0.75,
            tickvals: tickVals.map(cmap.toT), ticktext: tickVals.map(round2),
          },
        };
        cache = { key: key, heat: heat, divider: Mi.dividerPoints(s, GRID) };
        return cache;
      }

      var dividerTrace = function (bx, by) {
        return {
          type: 'scatter', mode: 'lines', x: bx, y: by, name: '两套等效（分界线）',
          line: { color: '#000', width: 2.4 },
        };
      };
      var crossTrace = function (s) {
        return {
          type: 'scatter', mode: 'markers', x: [s.em], y: [s.score], showlegend: false,
          marker: { symbol: 'cross-thin-open', size: 22, color: '#111', line: { width: 2.5, color: '#111' } },
        };
      };

      function layoutFor(s) {
        var shapes = [
          { type: 'line', x0: s.em, x1: s.em, y0: 0, y1: SCORE_MAX, line: { color: '#111', width: 1.2, dash: 'dot' } },
          { type: 'line', x0: 0, x1: EM_MAX, y0: s.score, y1: s.score, line: { color: '#111', width: 1.2, dash: 'dot' } },
        ];
        var annos = [];
        REFERENCES.forEach(function (r) {
          shapes.push({ type: 'line', x0: 0, x1: EM_MAX, y0: r.score, y1: r.score, line: { color: '#999', width: 1, dash: 'dash' } });
          annos.push({
            x: EM_MAX * 0.995, y: r.score, xanchor: 'right', yanchor: 'bottom',
            text: r.label, showarrow: false, font: { size: 11, color: '#888' },
          });
        });
        return {
          xaxis: charts.axis({
            title: { text: '元素精通（刻度 /1000）' }, range: [0, EM_MAX],
            tickvals: [0, 500, 1000, 1500, 2000], ticktext: ['0', '0.5', '1', '1.5', '2'],
          }),
          yaxis: charts.axis({ title: { text: '双暴分（不含套装特效）' }, range: [0, SCORE_MAX] }),
          shapes: shapes, annotations: annos,
          showlegend: true,
          margin: { t: 24, r: 24, b: 52, l: 66 }, height: 620,
        };
      }

      function updateVerdict(s) {
        var r = Mi.ratio(s.em, s.score / 100, s.bonus, s.d, s.leg);
        footSet.textContent = s.leg.name;
        footEm.textContent = s.leg.em.toFixed(0);
        var margin = Math.abs(r - 1) * 100;
        var who;
        if (margin.toFixed(1) === '0.0') {
          who = '血红之证 = ' + s.leg.name;
        } else {
          var better = r > 1 ? '血红之证' : s.leg.name;
          who = better + ' 优 ' + margin.toFixed(1) + '%';
        }
        var color = margin.toFixed(1) === '0.0' ? '' : (r > 1 ? '#a03030' : '#2a6099');
        var be = Mi.breakEven(s.score / 100, s.bonus, s.d, s.leg);
        var split = be.x !== undefined
          ? '双暴分固定在 ' + s.score.toFixed(1) + ' 时，精通 ' + be.x.toFixed(0) + ' 是分界（你现在 ' + s.em.toFixed(0) + '）'
          : be.none === 'scarlet'
            ? '双暴分 ' + s.score.toFixed(1) + ' 下，全区间都是血红之证更优'
            : '双暴分 ' + s.score.toFixed(1) + ' 下，全区间都是' + s.leg.name + '更优';
        verdict.innerHTML =
          '<div class="verdict__hero">血红之证 / ' + s.leg.name + ' = <b>' + r.toFixed(4) + '</b></div>' +
          '<div class="verdict__who"' + (color ? ' style="color:' + color + '"' : '') + '>' + who + '</div>' +
          '<div class="verdict__sub">' + split + '</div>';
      }

      function draw(s, divider) {
        var h = heatOf(s);
        charts.draw(m.plot, [h.heat, dividerTrace(divider.bx, divider.by), crossTrace(s)], layoutFor(s));
      }

      function update(s0) {
        var s = state(s0);
        st = s;
        updateVerdict(s);
        draw(s, heatOf(s).divider);
      }

      /* 拖动滑条：只重算分界线与结论条，热力图保持（引用不变，react 跳过） */
      var queued = false;
      function preview(s0) {
        if (queued) return;
        queued = true;
        global.requestAnimationFrame(function () {
          queued = false;
          if (!st) return;
          var s = state(s0);
          updateVerdict(s);
          draw(s, Mi.dividerPoints(s, GRID));
          st = s;
        });
      }

      /* 悬浮：读数卡片 */
      m.wrap.addEventListener('mousemove', function (e) {
        var p = m.pxIn(e);
        if (!p || !st) { tip.hide(); return; }
        var fl = m.plot._fullLayout;
        if (!fl || !fl.xaxis || !fl.xaxis._length) return;
        var xr = fl.xaxis.range, yr = fl.yaxis.range;
        var em = xr[0] + p.x / fl.xaxis._length * (xr[1] - xr[0]);
        var sc = yr[1] - p.y / fl.yaxis._length * (yr[1] - yr[0]);
        var r = Mi.ratio(em, sc / 100, st.bonus, st.d, st.leg);
        var be = Mi.breakEven(sc / 100, st.bonus, st.d, st.leg);
        var beTxt = be.x !== undefined ? '精通 ' + be.x.toFixed(0)
          : (be.none === 'scarlet' ? '全区间血红更优' : '全区间' + st.leg.name + '更优');
        tip.show(ctx.tip.card({
          title: '精通 ' + em.toFixed(0) + ' · 双暴分 ' + sc.toFixed(1),
          hero: { v: '×' + r.toFixed(4), cap: '血红 / ' + st.leg.name },
          rows: [['该双暴分下的分界', beTxt]],
        }), p.x, p.y);
      });
      m.wrap.addEventListener('mouseleave', tip.hide);

      /* 点击图面 = 把基准移到该点；双暴分按 1 : 2 拆成暴击 / 暴伤 */
      m.wrap.addEventListener('click', function (e) {
        var p = m.pxIn(e);
        if (!p) return;
        var fl = m.plot._fullLayout;
        if (!fl || !fl.xaxis || !fl.xaxis._length) return;
        var xr = fl.xaxis.range, yr = fl.yaxis.range;
        var em = xr[0] + p.x / fl.xaxis._length * (xr[1] - xr[0]);
        var sc = yr[1] - p.y / fl.yaxis._length * (yr[1] - yr[0]);
        GS.app.setValues({
          em: Math.max(Math.round(em), 589),
          cr: Math.max(Math.round(sc / 4 * 10) / 10, 5),
          cd: Math.max(Math.round(sc / 2 * 10) / 10, 50),
        });
      });

      return { plot: m.plot, update: update, preview: preview };
    },
  };
})(typeof globalThis !== 'undefined' ? globalThis : this);
