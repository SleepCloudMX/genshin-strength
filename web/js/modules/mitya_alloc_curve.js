/* 米提亚 · 星超导词条分配：A = 各总词条数下给双暴多少的伤害曲线；B = 最优拆分随词条数。 */
(function (global) {
  'use strict';
  var GS = global.GS = global.GS || {};
  var M = GS.modules = GS.modules || {};
  var C = GS.core;
  var S = C.mitya;
  var el = GS.ui.panels.el;

  /* 曲线配色（同瑞希页的 viridis_r 采样，避开最浅的亮黄） */
  var RAMP = ['#4ec36b', '#2eb37c', '#1fa287', '#20928c', '#27808e', '#2e6f8e',
              '#365c8d', '#3f4889', '#46327e', '#481b6d', '#440154'];
  /* 图 B 下半格三条曲线的颜色（卡片色标与曲线同一来源） */
  var COL_CR = '#d62728', COL_CD = '#ff7f0e', COL_EM = '#2e8b57';

  var FOOT =
    '单段 = 10 级「递变聚爆」消耗 1 枚递变信标的星超导雷伤（403.2% 元素精通），与伤害热图页同一口径。' +
    '1 词条 = ' + C.ROLL.em + ' 精通 = ' + C.ROLL.cr + '% 暴击 = ' + C.ROLL.cd + '% 暴伤。<br>' +
    '<b>图 A</b>：固定总词条数 n，把 b 条给双暴、其余给精通，画伤害相对「词条全给精通」的倍数；菱形 = 该曲线最优（与 <a href="#/mitya/dmg_map">伤害热图</a>同一求解器）。' +
    '<b>图 B</b>：上格 = 最优的双暴词条数随 n 的变化（灰虚线 = 全部给双暴），粉色带 = 伤害 ≥ 阈值（默认 99%）最大值的双暴条数区间；下格 = 最优拆分对应的精通 / 暴击率 / 暴伤面板值。<br>' +
    '抗性、擢升是常数乘子，不改变最优分配，本页不设敌人区；暴击区取期望 <code>1 + 暴击率 × 暴伤</code>，' +
    '双暴只加不减（暴击率封顶后全进暴伤）。K 与 F 不约掉（F 加在核心项后、不随 K 缩放），所以最优拆分随 K 轻微移动。';

  /** 解析曲线文本：逗号 / 空格分隔，2 ≤ n ≤ N_MAX，至多 10 条。 */
  function parseNs(txt) {
    var out = [];
    String(txt).split(/[,，\s]+/).forEach(function (tok) {
      var v = parseFloat(tok);
      if (Number.isFinite(v) && v >= 2 && v <= S.N_MAX) out.push(v);
    });
    out.sort(function (a, b) { return a - b; });
    return out.slice(0, 10);
  }

  /** 曲线颜色：按序号在 RAMP 上取样。 */
  function rampColor(i, n) {
    return RAMP[Math.round(i * (RAMP.length - 1) / Math.max(n - 1, 1))];
  }

  M['mitya/alloc_curve'] = {
    title: '「米提亚」星超导词条分配',
    tab: '米提亚·词条分配',
    intro: 'A = 各总词条数下「给双暴多少」的伤害曲线（× = 该曲线最优）；' +
      'B = 最优拆分随词条数的变化。悬浮读该点的双暴拆分、精通与伤害倍数。',
    controls: [
      {
        key: '', type: 'note',
        html: '<b>基准面板 = 上完 buff、不含副词条</b> —— 全写在参数里（角色、武器、命座、队友、圣遗物主词条与套装）；' +
          '每个数值可点「明细」查看与编辑逐项来源。',
      },
      {
        key: '', type: 'note',
        html: '<b>词条口径</b>：1 词条 = ' + C.ROLL.em + ' 精通 = ' + C.ROLL.cr + '% 暴击 = ' + C.ROLL.cd + '% 暴伤。' +
          '<b>双暴只加不减</b>：不强行凑 1:2，按实际可达的最优算。',
      },
      { key: 'em', type: 'items', label: '基准精通', step: 1, min: 0, items: [
        { n: '米提亚自身', v: 100 },
        { n: '秘星典谕 R1', v: 120 },
        { n: '2 命（过载）', v: 234 },
        { n: '精通沙', v: 187 },
        { n: '精通杯', v: 187 },
        { n: '砂糖', v: 210 },
        { n: '瓦列里 2 命', v: 100 },
        { n: '教官 4 件套', v: 120 }] },
      { key: 'cr', type: 'items', label: '基准暴击率 %', step: 0.1, min: 0, items: [
        { n: '米提亚自身', v: 5 },
        { n: '超限易爆试剂', v: 20 },
        { n: '幻灭 4 件套', v: 16 },
        { n: '暴击头', v: 31.1 }] },
      { key: 'cd', type: 'items', label: '基准暴伤 %', step: 0.1, min: 50, items: [
        { n: '角色基础', v: 50 },
        { n: '突破属性', v: 38.4 },
        { n: '秘星典谕 R1', v: 148.2 },
        { n: '1 命', v: 40 }] },
      { key: 'bonus', type: 'items', label: '星超导增伤 %', step: 1, min: 0, items: [
        { n: '奥黛塔华彩', v: 60 },
        { n: '炉火 4 件套', v: 50 },
        { n: '幻灭 4 件套', v: 40 }] },
      { key: 'bFlat', type: 'items', label: '队友基础提升 %', step: 1, min: 0, items: [
        { n: '奥黛塔天赋', v: 14 }] },
      { key: 'kLayers', type: 'range', label: '星超导层数', def: 6, min: 0, max: 12, step: 1 },
      { key: 'f', type: 'items', label: '额外提升', step: 0.1, min: 0, items: [
        { n: '瓦列里攻斥（单层）', v: 2263.6 }] },
      { key: 'ns', type: 'text', full: true, label: '曲线取哪些 n', def: '10, 20, 30, 40' },
      { key: 'level', type: 'number', label: '平台阈值 %', def: 99, step: 0.5, min: 0, max: 100 },
      { key: 'kReadout', type: 'readout', full: true, label: '星超导系数 K', compute: function (s) {
        return S.kOf(s.kLayers).toFixed(2) + '（' + s.kLayers + ' 层）';
      } },
    ],

    create: function (host, ctx) {
      var charts = ctx.charts;

      var cardA = el('div', 'card chartcard');
      cardA.appendChild(el('div', 'chart-h', '相对「词条全给精通」的伤害倍数'));
      var mA = charts.mount(cardA, { height: 520 });
      cardA.appendChild(GS.ui.panels.actionsRow(function () { return mA.plot; }, 'curves'));

      var cardB = el('div', 'card chartcard');
      var mB = charts.mount(cardB, { height: 620 });
      cardB.appendChild(GS.ui.panels.actionsRow(function () { return mB.plot; }, 'split'));

      host.appendChild(cardA);
      host.appendChild(cardB);
      host.appendChild(GS.ui.panels.note(FOOT, 'pagenote'));

      var tipA = ctx.tip.mount(mA.wrap, mA.geom);
      var tipB = ctx.tip.mount(mB.wrap, mBGeom);
      var tipBs = ctx.tip.mount(mB.wrap, mBGeom);   // 下半格的小卡：内容少，用窄版宽度
      tipBs.el.classList.add('tip--sm');
      ctx.overlay.cursor(mA.wrap, mA.geom, function (e) { return mA.pxIn(e); });
      ctx.overlay.cursor(mB.wrap, mBGeom, function (e) {   // 图 B 上下两格并集：两格都出圆点
        var g = mBGeom();
        var r = mB.wrap.getBoundingClientRect();
        var px = e.clientX - r.left - g.left, py = e.clientY - r.top - g.top;
        if (px < -4 || px > g.w + 4 || py < -4 || py > g.h + 4) return null;
        return { x: Math.min(Math.max(px, 0), g.w), y: Math.min(Math.max(py, 0), g.h) };
      });
      var st = null;

      /** 图 B 是上下两格（双暴词条数 / 精通·双暴）：几何取两格并集。 */
      function mBGeom() {
        var fl = mB.plot._fullLayout;
        if (fl && fl.xaxis && fl.xaxis._length && fl.yaxis && fl.yaxis._offset !== undefined && fl.yaxis2) {
          return {
            left: fl.xaxis._offset, top: fl.yaxis._offset,
            w: fl.xaxis._length,
            h: fl.yaxis2._offset + fl.yaxis2._length - fl.yaxis._offset,
          };
        }
        var cw = mB.plot.clientWidth || 900, ch = mB.plot.clientHeight || 620;
        return { left: 70, top: 28, w: Math.max(cw - 140, 120), h: Math.max(ch - 80, 120) };
      }

      function readState(s) {
        return {
          em: s.em, cr: s.cr, cd: s.cd,
          bFlat: s.bFlat / 100, bonus: s.bonus / 100,
          k: S.kOf(s.kLayers), kLayers: s.kLayers, f: s.f,
          res: 1, asc: 1, nMax: S.N_MAX,
          level: Math.min(Math.max(s.level / 100, 0), 1),
          ns: parseNs(s.ns),
        };
      }

      /** 给定 n 与双暴条数 b 的伤害（其余给精通），相对「词条全给精通」。 */
      function relDamage(s, n, b) {
        return S.damage(s, n - b, b) / S.damage(s, n, 0);
      }

      /** 给定 n 的平台：伤害 ≥ level × 该 n 最大值的双暴条数区间 [lo, hi]。
          伤害对 b 单峰，左右各自二分。 */
      function plateau(s, n, level) {
        var o = S.optAt(s, n);
        var fmax = S.damage(s, o.x, o.y);
        var thr = level * fmax;
        function f(b) { return S.damage(s, n - b, b); }
        var lo, hi, a, b2, m;
        if (f(0) >= thr) lo = 0;
        else {
          a = 0; b2 = o.y;
          for (var i = 0; i < 40; i++) { m = (a + b2) / 2; if (f(m) >= thr) b2 = m; else a = m; }
          lo = (a + b2) / 2;
        }
        if (f(n) >= thr) hi = n;
        else {
          a = o.y; b2 = n;
          for (var j = 0; j < 40; j++) { m = (a + b2) / 2; if (f(m) >= thr) a = m; else b2 = m; }
          hi = (a + b2) / 2;
        }
        return { lo: lo, hi: hi, max: fmax };
      }

      function buildA(s) {
        var traces = [], annos = [];
        var ns = s.ns.length ? s.ns : [10, 20, 30, 40];
        var span = Math.max.apply(null, ns);
        ns.forEach(function (n, i) {
          var color = rampColor(i, ns.length);
          var xs = [], ys = [];
          for (var k = 0; k <= 241; k++) {
            var b = n * k / 241;
            xs.push(b); ys.push(relDamage(s, n, b));
          }
          traces.push({
            type: 'scatter', mode: 'lines', x: xs, y: ys,
            name: '共 ' + n + ' 词条', line: { color: color, width: 2.2 }, hoverinfo: 'skip',
          });
          var o = S.optAt(s, n);
          var v = relDamage(s, n, o.y);
          var pl = plateau(s, n, s.level);
          traces.push({
            type: 'scatter', mode: 'lines', x: [pl.lo, pl.hi],
            y: [relDamage(s, n, pl.lo), relDamage(s, n, pl.hi)],
            line: { color: color, width: 1.4, dash: 'dash' }, showlegend: false, hoverinfo: 'skip',
          });
          [pl.lo, pl.hi].forEach(function (b) {
            traces.push({
              type: 'scatter', mode: 'markers', x: [b], y: [relDamage(s, n, b)], showlegend: false, hoverinfo: 'skip',
              marker: { color: color, size: 8, line: { color: '#fff', width: 1.2 } },
            });
            annos.push({
              x: b, y: relDamage(s, n, b), xshift: 0, yshift: -15, xanchor: 'center', yanchor: 'top',
              text: b.toFixed(1) + ' 词', showarrow: false, font: { size: 11, color: color },
            });
          });
          traces.push({
            type: 'scatter', mode: 'markers', x: [o.y], y: [v], showlegend: false, hoverinfo: 'skip',
            marker: { color: color, size: 9, symbol: 'diamond', line: { color: '#fff', width: 1.2 } },
          });
          annos.push({
            x: o.y, y: v, xshift: 7, yshift: 2, xanchor: 'left', yanchor: 'bottom',
            text: '×' + o.y.toFixed(1) + ' (' + v.toFixed(3) + ')', showarrow: false,
            font: { size: 12, color: color }, bgcolor: 'rgba(255,255,255,0.82)', borderpad: 2,
          });
        });
        return {
          traces: traces,
          layout: {
            xaxis: charts.axis({ title: { text: '给双暴的等效词条数（其余给精通）' }, range: [0, span] }),
            yaxis: charts.axis({ title: { text: '伤害倍数' } }),
            shapes: [{ type: 'line', x0: 0, x1: span, y0: 1, y1: 1, line: { color: '#999', width: 1.2, dash: 'dot' } }],
            annotations: annos,
            legend: { x: 0.01, y: 0.99, bgcolor: 'rgba(255,255,255,0.9)' },
            margin: { t: 44, r: 24, b: 52, l: 66 }, height: 520,
          },
        };
      }

      function buildB(s) {
        var steps = 141, hi0 = S.N_MAX;
        var ns = [], bs = [], los = [], his = [], ems = [], crs = [], cds = [];
        for (var i = 0; i <= steps; i++) {
          var n = hi0 * i / steps;
          var o = S.optAt(s, n);
          var t = S.critSplit(s.cr, s.cd, o.y);
          var pl = plateau(s, n, s.level);
          ns.push(n); bs.push(o.y); los.push(pl.lo); his.push(pl.hi);
          ems.push(s.em + S.EM_PER_ROLL * o.x);
          crs.push(t.cr); cds.push(t.cd);
        }
        var traces = [
          { type: 'scatter', mode: 'lines', x: ns, y: his, showlegend: false,
            line: { color: 'rgba(220,20,60,0)' }, hoverinfo: 'skip' },
          { type: 'scatter', mode: 'lines', x: ns, y: los, name: (s.level * 100).toFixed(0) + '% 平台',
            fill: 'tonexty', fillcolor: 'rgba(220,20,60,0.16)',
            line: { color: 'rgba(220,20,60,0)' }, hoverinfo: 'skip' },
          { type: 'scatter', mode: 'lines', x: ns, y: ns, name: '全部词条给双暴',
            line: { color: '#999', width: 1.4, dash: 'dash' }, hoverinfo: 'skip' },
          { type: 'scatter', mode: 'lines', x: ns, y: bs, name: '最优双暴词条数（图 A 的 ×）',
            line: { color: '#000', width: 2.6 }, hoverinfo: 'skip' },
          { type: 'scatter', mode: 'lines', x: ns, y: ems, name: '元素精通',
            line: { color: COL_EM, width: 2.2 }, xaxis: 'x2', yaxis: 'y2', hoverinfo: 'skip' },
          { type: 'scatter', mode: 'lines', x: ns, y: crs, name: '暴击率',
            line: { color: COL_CR, width: 2.2 }, xaxis: 'x2', yaxis: 'y3', hoverinfo: 'skip' },
          { type: 'scatter', mode: 'lines', x: ns, y: cds, name: '暴伤',
            line: { color: COL_CD, width: 2.2, dash: 'dash' }, xaxis: 'x2', yaxis: 'y3', hoverinfo: 'skip' },
        ];
        return {
          traces: traces,
          layout: {
            grid: { rows: 2, columns: 1, pattern: 'independent', roworder: 'top to bottom' },
            xaxis: charts.axis({ title: { text: '等效词条总数 n' } }),
            yaxis: charts.axis({ title: { text: '给双暴的等效词条数' } }),
            xaxis2: charts.axis({ title: { text: '等效词条总数 n' } }),
            yaxis2: charts.axis({ title: { text: '元素精通' },
              titlefont: { color: COL_EM }, tickfont: { family: charts.MONO, size: 11, color: COL_EM } }),
            yaxis3: charts.axis({ title: { text: '暴击率 / 暴伤 %' }, overlaying: 'y2', side: 'right', showgrid: false }),
            legend: { x: 0.01, y: 0.99, bgcolor: 'rgba(255,255,255,0.9)' },
            margin: { t: 28, r: 70, b: 52, l: 70 }, height: 620,
          },
        };
      }

      function update(s0) {
        var s = readState(s0);
        st = s;
        var a = buildA(s), b = buildB(s);
        charts.draw(mA.plot, a.traces, a.layout);
        charts.draw(mB.plot, b.traces, b.layout);
      }

      /* ── 图 A 悬浮：取屏幕距离最近的曲线 ── */
      mA.wrap.addEventListener('mousemove', function (e) {
        var p = mA.pxIn(e);
        if (!p || !st) { tipA.hide(); return; }
        var fl = mA.plot._fullLayout;
        if (!fl || !fl.xaxis || !fl.xaxis._length) { tipA.hide(); return; }
        var xr = fl.xaxis.range, yr = fl.yaxis.range;
        var b = xr[0] + p.x / fl.xaxis._length * (xr[1] - xr[0]);
        var vy = yr[1] - p.y / fl.yaxis._length * (yr[1] - yr[0]);
        var ns = st.ns.length ? st.ns : [10, 20, 30, 40];
        var pick = null;
        ns.forEach(function (n) {
          if (b < 0 || b > n) return;
          var v = relDamage(st, n, b);
          var d = Math.abs(v - vy);
          if (!pick || d < pick.d) pick = { n: n, b: b, v: v, d: d };
        });
        if (!pick) { tipA.hide(); return; }
        var n = pick.n, bb = pick.b, v = pick.v;
        var t = S.critSplit(st.cr, st.cd, bb);
        var em = st.em + S.EM_PER_ROLL * (n - bb);
        var o = S.optAt(st, n);
        var vmax = relDamage(st, n, o.y);
        tipA.show(ctx.tip.card({
          title: '共 ' + n + ' 词条 · 给双暴 ' + bb.toFixed(1) + ' · 给精通 ' + (n - bb).toFixed(1),
          hero: { v: '×' + v.toFixed(4), cap: '相对「词条全给精通」' },
          rows: [
            ['暴击率 / 暴伤', t.cr.toFixed(1) + '% / ' + t.cd.toFixed(1) + '%'],
            ['精通', em.toFixed(0)],
            ['该曲线最大值的', (100 * v / vmax).toFixed(1) + '%'],
          ],
        }), p.x, p.y);
      });
      mA.wrap.addEventListener('mouseleave', tipA.hide);

      /* ── 图 B 悬浮：上格读最优拆分，下半格读面板三值 ── */
      mB.wrap.addEventListener('mousemove', function (e) {
        if (!st) { tipB.hide(); tipBs.hide(); return; }
        var fl = mB.plot._fullLayout;
        if (!fl || !fl.xaxis || !fl.xaxis._length || !fl.xaxis.range) { tipB.hide(); tipBs.hide(); return; }
        var g = mBGeom();
        var r = mB.wrap.getBoundingClientRect();
        var px = e.clientX - r.left - g.left, py = e.clientY - r.top - g.top;
        if (px < -4 || px > g.w + 4 || py < -4 || py > g.h + 4) { tipB.hide(); tipBs.hide(); return; }
        px = Math.min(Math.max(px, 0), g.w);
        var xr = fl.xaxis.range;
        var n = xr[0] + px / g.w * (xr[1] - xr[0]);
        if (n < -1e-9 || n > S.N_MAX + 1e-9) { tipB.hide(); tipBs.hide(); return; }
        var o = S.optAt(st, n);
        var t = S.critSplit(st.cr, st.cd, o.y);
        var em = st.em + S.EM_PER_ROLL * o.x;

        /* 下半格（精通 / 暴击率 / 暴伤三条曲线）：只读三条曲线在该 n 的值 */
        if (fl.yaxis2 && py > fl.yaxis2._offset - g.top) {
          tipB.hide();
          tipBs.show(ctx.tip.card({
            title: '共 ' + n.toFixed(1) + ' 词条',
            rows: [
              [ctx.tip.sw(COL_CR) + '暴击率', t.cr.toFixed(1) + '%'],
              [ctx.tip.sw(COL_CD) + '暴伤', t.cd.toFixed(1) + '%'],
              [ctx.tip.sw(COL_EM) + '精通', em.toFixed(0)],
            ],
          }), px, py);
          return;
        }
        tipBs.hide();

        /* 上半格（最优双暴词条数） */
        var pl = plateau(st, n, st.level);
        tipB.show(ctx.tip.card({
          title: '共 ' + n.toFixed(1) + ' 词条',
          rows: [
            ['最优双暴词条数', o.y.toFixed(1)],
            ['暴击 / 暴伤词条', t.a.toFixed(1) + ' / ' + (o.y - t.a).toFixed(1)],
            ['暴击率 / 暴伤', t.cr.toFixed(1) + '% / ' + t.cd.toFixed(1) + '%'],
            ['精通', em.toFixed(0)],
            [(st.level * 100).toFixed(0) + '% 平台', pl.lo.toFixed(1) + ' ~ ' + pl.hi.toFixed(1) + ' 条双暴'],
          ],
        }), px, py);
      });
      mB.wrap.addEventListener('mouseleave', function () { tipB.hide(); tipBs.hide(); });

      return { plot: mA.plot, update: update };
    },
  };
})(typeof globalThis !== 'undefined' ? globalThis : this);
