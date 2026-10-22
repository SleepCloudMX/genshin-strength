/* 瑞希 · 精通和双暴的词条分配：A = 各词条数下给双暴多少的伤害曲线；B = 最优拆分随词条数。 */
(function (global) {
  'use strict';
  var GS = global.GS = global.GS || {};
  var M = GS.modules = GS.modules || {};
  var C = GS.core;
  var Mi = GS.core.mizuki;
  var el = GS.ui.panels.el;

  var FOOT = '1 等效词条 = 20 精通 = 3.3% 暴击 = 6.6% 暴伤。<b>星扩散直伤</b> = 瑞希天赋「廓然梦生」的精通倍率伤害。';

  /* 图 B 下半格三条曲线的颜色（卡片色标与曲线同一来源） */
  var COL_CR = '#d62728', COL_CD = '#ff7f0e', COL_EM = '#2e8b57';

  M['mizuki/em_vs_crit'] = {
    title: '「梦见月瑞希」精通和双暴的词条分配',
    tab: '瑞希·词条分配',
    intro: 'A = 各词条数下「给双暴多少」的伤害曲线（× = 该曲线最优，虚线 = 平台区）；' +
      'B = 最优拆分随词条数的变化。悬浮读该点的双暴拆分、精通与伤害倍数。',
    controls: [
      {
        key: '', type: 'note',
        html: '<b>基准面板 = 上完 buff、不含副词条</b>（主词条、武器、天赋、队友给的都算在基准里）—— 副词条正是这里要分配的东西；' +
          '每个数值可点「明细」查看与编辑逐项来源。',
      },
      {
        key: '', type: 'note',
        html: '<b>星扩散伤害 = 星扩散直伤（大头）+ 反应星扩散</b>。<b>星扩散直伤占比</b>：给定的假定常数（按基准分配处定义），' +
          '计算中直接采用；本页<b>不</b>根据你的配置推算真实占比（实测约九成，见<a href="#/mizuki/stellar_swirl#share">机制页</a>）。' +
          '默认 90%；拉到 100% = 只看星扩散直伤。',
      },
      { key: 'bonus', type: 'items', label: '星扩散增伤 %', step: 1, min: 0, items: [
        { n: '冰主 6 命', v: 40 },
        { n: '炉火', v: 50 },
        { n: '血红 4 件套', v: 40 }] },
      { key: 'em', type: 'items', label: '基准精通', step: 1, min: 589, items: [
        { n: '总数', v: 1000 }] },
      { key: 'cr', type: 'items', label: '基准暴击率 %', step: 0.1, min: 5, items: [
        { n: '总数', v: 36 }] },
      { key: 'cd', type: 'items', label: '基准暴伤 %', step: 0.1, min: 50, items: [
        { n: '角色基础', v: 50 },
        { n: '暴伤头', v: 62.2 }] },
      { key: 'score', type: 'readout', label: '双暴分', compute: function (s) { return C.f(C.baseScore(s.cr, s.cd), 1); } },
      { key: 'd', type: 'range', label: '星扩散直伤占比', def: 90, min: 0, max: 100, step: 1, unit: '%', live: 100 },
      { key: 'ns', type: 'text', full: true, label: '曲线取哪些 n', def: '15, 20, 25, 30, 35' },
      { key: 'level', type: 'number', label: '平台阈值 %', def: 99, step: 0.5, min: 0, max: 100 },
    ],

    create: function (host, ctx) {
      var charts = ctx.charts;

      var cardA = el('div', 'card chartcard');
      cardA.appendChild(el('div', 'chart-h', '相对「词条全给精通」的伤害倍数'));
      var mA = charts.mount(cardA, { height: 520 });
      var lossNote = el('p', 'chartnote');
      cardA.appendChild(lossNote);
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
      var st = null;

      /** 图 B 是上下两格（双暴词条数 / 精通·双暴）：几何取两格并集 ——
       *  悬浮落在任何一格都要出卡片（mB.geom 只覆盖上格，下半格会判成图外）。 */
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
          bonus: s.bonus / 100, d: s.d / 100,
          ns: Mi.parseNs(s.ns),
          level: s.level / 100,
        };
      }

      function buildA(s) {
        var traces = [], annos = [];
        var ns = s.ns.length ? s.ns : [15, 20, 25, 30, 35];
        var span = Math.max.apply(null, ns);
        var lossMax = 0;

        ns.forEach(function (n, i) {
          var color = Mi.ramp(i / Math.max(ns.length - 1, 1));
          var base = Mi.rollDamage(s, n, 0);
          var best = Mi.bestSplit(s, n);
          var pl = Mi.plateau(s, n, best.f, s.level);
          if (s.d < 1) {
            var bDirect = Mi.bestSplit(Object.assign({}, s, { d: 1 }), n).b;
            lossMax = Math.max(lossMax, 1 - Mi.rollDamage(s, n, bDirect) / best.f);
          }

          var xs = [], ys = [];
          for (var k = 0; k <= 401; k++) {
            var b = n * k / 401;
            xs.push(b); ys.push(Mi.rollDamage(s, n, b) / base);
          }
          traces.push({
            type: 'scatter', mode: 'lines', x: xs, y: ys,
            name: '共 ' + n + ' 词条', line: { color: color, width: 2.2 },
          });

          if (pl.lo !== null) {
            traces.push({
              type: 'scatter', mode: 'lines', x: [pl.lo, pl.hi],
              y: [Mi.rollDamage(s, n, pl.lo) / base, Mi.rollDamage(s, n, pl.hi) / base],
              line: { color: color, width: 1.4, dash: 'dash' },
            });
            [pl.lo, pl.hi].forEach(function (x) {
              traces.push({
                type: 'scatter', mode: 'markers', x: [x], y: [Mi.rollDamage(s, n, x) / base],
                marker: { color: color, size: 8, line: { color: '#fff', width: 1.2 } },
              });
            });
          }
          traces.push({
            type: 'scatter', mode: 'markers', x: [best.b], y: [best.f / base],
            marker: { color: color, size: 9, symbol: 'diamond', line: { color: '#fff', width: 1.2 } },
          });

          var common = { showarrow: false, font: { size: 12, color: color },
                         bgcolor: 'rgba(255,255,255,0.82)', borderpad: 2 };
          annos.push(Object.assign({}, common, {
            x: best.b, y: best.f / base, xshift: 7, yshift: 2,
            xanchor: 'left', yanchor: 'bottom',
            text: '×' + best.b.toFixed(1) + ' (' + (best.f / base).toFixed(3) + ')',
          }));
          if (pl.lo !== null) {
            [pl.lo, pl.hi].forEach(function (x) {
              annos.push(Object.assign({}, common, {
                x: x, y: Mi.rollDamage(s, n, x) / base, xshift: 0, yshift: -15,
                xanchor: 'center', yanchor: 'top', font: { size: 11, color: color },
                text: x.toFixed(1) + ' 词',
              }));
            });
          }
        });

        return {
          traces: traces, lossMax: lossMax,
          layout: {
            xaxis: charts.axis({ title: { text: '给双暴的等效词条数（其余给精通）' }, range: [0, span] }),
            yaxis: charts.axis({ title: { text: '星扩散直伤倍数' } }),
            shapes: [{ type: 'line', x0: 0, x1: span, y0: 1, y1: 1, line: { color: '#999', width: 1.2, dash: 'dot' } }],
            annotations: annos,
            legend: { x: 0.01, y: 0.99, bgcolor: 'rgba(255,255,255,0.9)' },
            margin: { t: 44, r: 24, b: 52, l: 66 }, height: 520,
          },
        };
      }

      function buildB(s) {
        var steps = 121, lo0 = 5, hi0 = Math.max(45, Math.max.apply(null, s.ns.length ? s.ns : [45]));
        var ns = [], bs = [], los = [], his = [], ems = [], crs = [], cds = [];
        for (var i = 0; i <= steps; i++) {
          var n = lo0 + (hi0 - lo0) * i / steps;
          var best = Mi.bestSplit(s, n);
          var pl = Mi.plateau(s, n, best.f, s.level);
          ns.push(n); bs.push(best.b); los.push(pl.lo); his.push(pl.hi);
          var t = Mi.allocAt(best.b, s.cr, s.cd);
          ems.push(C.EM_PER_ROLL * (n - best.b) + s.em);
          crs.push(t.cr); cds.push(t.cd);
        }

        var traces = [
          { type: 'scatter', mode: 'lines', x: ns, y: his, line: { color: 'rgba(220,20,60,0)' } },
          { type: 'scatter', mode: 'lines', x: ns, y: los, name: (s.level * 100).toFixed(0) + '% 平台',
            fill: 'tonexty', fillcolor: 'rgba(220,20,60,0.16)', line: { color: 'rgba(220,20,60,0)' } },
          { type: 'scatter', mode: 'lines', x: ns, y: bs, name: '最优双暴词条数（图 A 的 ×）',
            line: { color: '#000', width: 2.6 } },
          { type: 'scatter', mode: 'lines', x: ns, y: ns, name: '全部词条给双暴',
            line: { color: '#999', width: 1.4, dash: 'dash' } },
          { type: 'scatter', mode: 'lines', x: ns, y: ems, name: '元素精通',
            line: { color: COL_EM, width: 2.2 }, xaxis: 'x2', yaxis: 'y2' },
          { type: 'scatter', mode: 'lines', x: ns, y: crs, name: '暴击率',
            line: { color: COL_CR, width: 2.2 }, xaxis: 'x2', yaxis: 'y3' },
          { type: 'scatter', mode: 'lines', x: ns, y: cds, name: '暴伤',
            line: { color: COL_CD, width: 2.2, dash: 'dash' }, xaxis: 'x2', yaxis: 'y3' },
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

        if (s.d >= 1) {
          lossNote.style.display = 'none'; lossNote.textContent = '';
        } else {
          var p = a.lossMax * 100;
          lossNote.style.display = '';
          lossNote.textContent = p < 0.005
            ? '参考：词条按「纯直伤最优」分配时，总伤害损失 ＜ 0.01%。'
            : '参考：词条按「纯直伤最优」分配时，总伤害损失 ≤ ' + p.toFixed(2) + '%。';
        }

        charts.draw(mA.plot, a.traces, a.layout);
        charts.draw(mB.plot, b.traces, b.layout);
      }

      /* ── 悬浮：图 A 取屏幕距离最近的曲线；图 B 按 n 取一列读数 ── */
      function curveAt(s, n, b) {
        var base = Mi.rollDamage(s, n, 0);
        return { v: Mi.rollDamage(s, n, b) / base, base: base };
      }

      mA.wrap.addEventListener('mousemove', function (e) {
        var p = mA.pxIn(e);
        if (!p || !st) { tipA.hide(); return; }
        var fl = mA.plot._fullLayout;
        if (!fl || !fl.xaxis || !fl.xaxis._length) { tipA.hide(); return; }
        var xr = fl.xaxis.range, yr = fl.yaxis.range;
        var b = xr[0] + p.x / fl.xaxis._length * (xr[1] - xr[0]);
        var vy = yr[1] - p.y / fl.yaxis._length * (yr[1] - yr[0]);
        var ns = st.ns.length ? st.ns : [15, 20, 25, 30, 35];
        var pick = null;
        ns.forEach(function (n) {
          if (b < 0 || b > n) return;
          var v = curveAt(st, n, b).v;
          var d = Math.abs(v - vy);
          if (!pick || d < pick.d) pick = { n: n, v: v, d: d };
        });
        if (!pick) { tipA.hide(); return; }

        var n = pick.n, v = pick.v;
        var t = Mi.allocAt(b, st.cr, st.cd);
        var em = C.EM_PER_ROLL * (n - b) + st.em;
        var fMax = Mi.bestSplit(st, n).f / Mi.rollDamage(st, n, 0);
        tipA.show(ctx.tip.card({
          title: '共 ' + n + ' 词条 · 给双暴 ' + b.toFixed(1) + ' · 给精通 ' + (n - b).toFixed(1),
          hero: { v: '×' + v.toFixed(4), cap: '相对「词条全给精通」' },
          rows: [
            ['暴击率 / 暴伤', t.cr.toFixed(1) + '% / ' + t.cd.toFixed(1) + '%'],
            ['精通', em.toFixed(0)],
            ['该曲线最大值的', (100 * v / fMax).toFixed(1) + '%'],
          ],
        }), p.x, p.y);
      });
      mA.wrap.addEventListener('mouseleave', tipA.hide);

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
        var best = Mi.bestSplit(st, n);
        var t = Mi.allocAt(best.b, st.cr, st.cd);
        var em = C.EM_PER_ROLL * (n - best.b) + st.em;

        /* 下半格（精通 / 暴击率 / 暴伤 三条曲线）：只读三条曲线在该 n 的值，色标 = 曲线颜色 */
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

        /* 上半格（最优双暴词条数 + 平台带） */
        var pl = Mi.plateau(st, n, best.f, st.level);
        var pct = (st.level * 100).toFixed(0) + '% 平台';
        var after;
        if (pl.lo === null) {
          after = ctx.tip.div() + ctx.tip.cap(pct + '：—');
        } else {
          var loT = Mi.allocAt(pl.lo, st.cr, st.cd);
          var hiT = Mi.allocAt(pl.hi, st.cr, st.cd);
          after = ctx.tip.div() +
            ctx.tip.cap(pct + '两端（双暴 ' + pl.lo.toFixed(1) + ' ~ ' + pl.hi.toFixed(1) + ' 词条）') +
            ctx.tip.rows([
              ['左端', '双暴 ' + loT.cr.toFixed(1) + '% / ' + loT.cd.toFixed(1) + '% · 精通 ' + (C.EM_PER_ROLL * (n - pl.lo) + st.em).toFixed(0)],
              ['右端', '双暴 ' + hiT.cr.toFixed(1) + '% / ' + hiT.cd.toFixed(1) + '% · 精通 ' + (C.EM_PER_ROLL * (n - pl.hi) + st.em).toFixed(0)],
            ]);
        }
        tipB.show(ctx.tip.card({
          title: '共 ' + n.toFixed(1) + ' 词条',
          rows: [
            ['最优双暴词条数', best.b.toFixed(1)],
            ['暴击率 / 暴伤', t.cr.toFixed(1) + '% / ' + t.cd.toFixed(1) + '%'],
            ['精通', em.toFixed(0)],
          ],
          after: after,
        }), px, py);
      });
      mB.wrap.addEventListener('mouseleave', function () { tipB.hide(); tipBs.hide(); });

      return { plot: mA.plot, update: update };
    },
  };
})(typeof globalThis !== 'undefined' ? globalThis : this);
