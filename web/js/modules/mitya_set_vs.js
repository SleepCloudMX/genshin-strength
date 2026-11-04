/* 米提亚 · 套装对比：比值热力图（对比 / 基准），基准 = 幻灭 4 + 精精精。
   同一套副词条分配 (x, y) 下比较两套配置；黑线 = 两套等效。 */
(function (global) {
  'use strict';
  var GS = global.GS = global.GS || {};
  var M = GS.modules = GS.modules || {};
  var C = GS.core;
  var S = C.mitya;
  var el = GS.ui.panels.el;

  var GRID = 121;
  var COLORSCALE = [
    [0.000, '#053061'], [0.167, '#3783bb'], [0.333, '#a7d0e4'], [0.500, '#f7f6f6'],
    [0.667, '#f7b799'], [0.833, '#c94741'], [1.000, '#67001f'],
  ];
  var SETS = { emblem: '幻灭 4 件套', em22: '2+2 精通' };
  var MAINS = { emEmEm: '精精精', emEmCr: '精精暴（暴击头）', emEmCd: '精精暴（暴伤头）' };
  var BASE_SET = 'emblem', BASE_MAIN = 'emEmEm';

  function fmtTrim(v, minDp, maxDp) {
    var s = v.toFixed(maxDp);
    while (s.indexOf('.') >= 0 && s.length - s.indexOf('.') - 1 > minDp && s.charAt(s.length - 1) === '0') {
      s = s.slice(0, -1);
    }
    if (s.charAt(s.length - 1) === '.') s = s.slice(0, -1);
    return s;
  }
  function q(v, minDp, maxDp) { return Number(fmtTrim(v, minDp, maxDp)); }

  /** 公共面板（不含套装 / 主词条贡献）：与热图默认面板一致，只是把幻灭 / 精精精拆出去。 */
  function commonState(s) {
    var net = (s.enemyRes - s.resShred) / 100;
    return {
      em: s.em, cr: s.cr, cd: s.cd,
      bFlat: s.bFlat / 100,
      bonus: s.bonus / 100,
      k: S.kOf(s.kLayers),
      kLayers: s.kLayers,
      f: s.f,
      netRes: net,
      res: q(C.kappa(net), 2, 4),
      asc: 1 + s.asc / 100,
      n: s.n,
    };
  }

  /** 加上套装 / 主词条贡献。 */
  function withSetMain(cs, set, main) {
    var s = Object.assign({}, cs);
    if (set === 'emblem') {
      s.cr += 16;
      s.bonus += 0.40;
    } else if (set === 'em22') {
      s.em += 160;
    }
    if (main === 'emEmEm') {
      s.em += 561;
    } else if (main === 'emEmCr') {
      s.em += 374;
      s.cr += 31.1;
    } else if (main === 'emEmCd') {
      s.em += 374;
      s.cd += 62.2;
    }
    return s;
  }

  function statesOf(s) {
    var cs = commonState(s);
    return {
      common: cs,
      base: withSetMain(cs, BASE_SET, BASE_MAIN),
      comp: withSetMain(cs, s.set, s.main),
    };
  }

  function configLabel(set, main) { return SETS[set] + ' · ' + MAINS[main]; }

  function ratioAt(base, comp, x, y) {
    var db = S.damage(base, x, y);
    var dc = S.damage(comp, x, y);
    return db && dc ? dc / db : null;
  }

  function dividerPoints(zs, xs) {
    var bx = [], by = [];
    for (var j = 0; j < zs.length; j++) {
      var prev = null;
      for (var i = 0; i < zs[j].length; i++) {
        var r = zs[j][i];
        if (r === null) break;
        if (prev !== null && (prev - 1) * (r - 1) < 0) {
          var t = (1 - prev) / (r - prev);
          bx.push(xs[i - 1] + t * (xs[i] - xs[i - 1]));
          by.push(xs[j]);
        }
        prev = r;
      }
    }
    return { bx: bx, by: by };
  }

  /** 全网格：比值、极值、各自最优、两套等效线。 */
  function scanRatio(base, comp, G) {
    G = G || GRID;
    var n = base.n;
    var step = n / (G - 1);
    var xs = Array.from({ length: G }, function (_, i) { return i * step; });
    var lo = Infinity, hi = -Infinity, loAt = null, hiAt = null;
    var zs = xs.map(function (y) {
      return xs.map(function (x) {
        var r = ratioAt(base, comp, x, y);
        if (r === null) return null;
        if (r < lo) { lo = r; loAt = [x, y]; }
        if (r > hi) { hi = r; hiAt = [x, y]; }
        return r;
      });
    });
    return {
      xs: xs, zs: zs, lo: lo, hi: hi, loAt: loAt, hiAt: hiAt,
      bestBase: S.bestFor(base), bestComp: S.bestFor(comp),
      divider: dividerPoints(zs, xs),
    };
  }

  /** Plotly 没有 TwoSlopeNorm，手动分段压缩：1.0 → 色带正中。 */
  function makeColorMap(lo, hi) {
    lo = Math.min(lo, 1 - 1e-9);
    hi = Math.max(hi, 1 + 1e-9);
    return {
      lo: lo, hi: hi,
      toT: function (v) { return v <= 1 ? 0.5 * (v - lo) / (1 - lo) : 0.5 + 0.5 * (v - 1) / (hi - 1); },
    };
  }

  var FOOT =
    '<b>基准 = 幻灭 4 件套 + 精精精</b>；<b>对比</b> = 下拉选择的套装 × 主词条。两者使用同一套副词条分配 ' +
    '（横轴精通词条、纵轴双暴词条），所以比值回答「<b>同样的词条数下谁更强</b>」；> 1 = 对比更强，' +
    '黑线 = 两套等效，橙点 / 蓝菱 = 各自配置下的最优分配。<br>' +
    '<b>套装贡献</b>：幻灭 4 = +16% 暴击率、+40% 星超导增伤；2+2 精通 = +160 精通。' +
    '<b>主词条</b>：精精精 = +561 精通；精精暴（暴击头）= +374 精通、+31.1% 暴击率；' +
    '精精暴（暴伤头）= +374 精通、+62.2% 暴伤。公共面板（角色、武器、命座、队友）与热图页默认一致，' +
    '只是把上述贡献拆出来自动相加。<br>' +
    'K、抗性系数、擢升在两边相同，已在比值中约掉；<b>额外提升 F 不约掉</b>（加在基础项之后），所以比值会受 F 影响。' +
    '色带 1.0 在正中（分段压缩）；精确比值以结论框与悬浮卡为准。';

  M['mitya/set_vs'] = {
    title: '「米提亚」套装对比',
    tab: '米提亚·套装对比',
    noPlotly: false,
    intro: '比较「幻灭 4 + 精精精」与另一套「套装 × 主词条」在<b>同一套副词条分配</b>下的伤害比值：' +
      '颜色 = 对比 / 基准，黑线 = 两套等效；橙点 / 蓝菱 = 各自最优分配。' +
      '悬浮读该点的比值与两套伤害，点击图面把所选点移到该处。',
    controls: [
      {
        key: '', type: 'note',
        html: '<b>基准 = 幻灭 4 件套 + 精精精</b>（与伤害热图默认一致）。' +
          '对比配置由下方两个下拉选择；两套共用同一套副词条分配。',
      },
      {
        key: '', type: 'note',
        html: '<b>公共面板</b> = 上完 buff、不含套装 / 主词条；每个数值可点「明细」查看来源。' +
          '套装 / 主词条的贡献在计算时自动加上（见页脚）。',
      },
      { key: 'set', type: 'select', label: '对比套装', def: 'em22',
        options: [
          { value: 'emblem', label: '幻灭 4 件套' },
          { value: 'em22', label: '2+2 精通' },
        ] },
      { key: 'main', type: 'select', label: '主词条', def: 'emEmEm',
        options: [
          { value: 'emEmEm', label: '精精精' },
          { value: 'emEmCr', label: '精精暴（暴击头）' },
          { value: 'emEmCd', label: '精精暴（暴伤头）' },
        ] },
      { key: 'em', type: 'items', label: '公共精通', step: 1, min: 0, items: [
        { n: '米提亚自身', v: 100 },
        { n: '凝雪沉心 R1', v: 60 },
        { n: '2 命（过载）', v: 234 },
        { n: '砂糖', v: 210 },
        { n: '瓦列里 2 命', v: 100 },
        { n: '教官 4 件套', v: 120 }] },
      { key: 'cr', type: 'items', label: '公共暴击率 %', step: 0.1, min: 0, items: [
        { n: '米提亚自身', v: 5 },
        { n: '超限易爆试剂', v: 20 }] },
      { key: 'cd', type: 'items', label: '公共暴伤 %', step: 0.1, min: 50, items: [
        { n: '角色基础', v: 50 },
        { n: '突破属性', v: 38.4 },
        { n: '凝雪沉心 R1', v: 55.1 },
        { n: '1 命', v: 40 }] },
      { key: 'bonus', type: 'items', label: '公共星超导增伤 %', step: 1, min: 0, items: [
        { n: '凝雪沉心 R1', v: 18 },
        { n: '奥黛塔华彩', v: 60 },
        { n: '炉火 4 件套', v: 50 }] },
      { key: 'bFlat', type: 'items', label: '队友基础提升 %', step: 1, min: 0, items: [
        { n: '奥黛塔天赋', v: 14 }] },
      { key: 'kLayers', type: 'range', label: '星超导层数', def: 6, min: 0, max: 12, step: 1 },
      { key: 'f', type: 'items', label: '额外提升', step: 0.1, min: 0, items: [
        { n: '瓦列里攻斥（单层）', v: 2263.6 }] },
      {
        type: 'group', label: '敌人区',
        items: [
          { key: 'enemyRes', type: 'number', label: '敌人抗性 %', def: 10, step: 1, min: -100, max: 200 },
          { key: 'resShred', type: 'number', label: '减抗合计 %', def: 60, step: 1, min: 0, max: 200 },
          { key: 'asc', type: 'number', label: '擢升 %', def: 0, step: 1, min: 0, max: 100 },
        ],
      },
      { key: 'n', type: 'range', label: '词条预算', def: S.N_DEF, min: 2, max: S.N_MAX, step: 1 },
      { key: 'basePanel', type: 'readout', full: true, label: '基准面板', compute: function (s) {
        var b = statesOf(s).base;
        return '精通 ' + b.em.toFixed(0) + ' · 暴击 ' + b.cr.toFixed(1) + ' / ' + b.cd.toFixed(1) +
          ' · 增伤 ' + Math.round(b.bonus * 100) + '%';
      } },
      { key: 'compPanel', type: 'readout', full: true, label: '对比面板', compute: function (s) {
        var c = statesOf(s).comp;
        return '精通 ' + c.em.toFixed(0) + ' · 暴击 ' + c.cr.toFixed(1) + ' / ' + c.cd.toFixed(1) +
          ' · 增伤 ' + Math.round(c.bonus * 100) + '%';
      } },
    ],

    create: function (host, ctx) {
      var charts = ctx.charts;

      var verdict = el('div', 'verdict');
      verdict.innerHTML =
        '<div class="verdict__bar"><span class="verdict__st">对比 / 基准</span>' +
        '<span class="verdict__mul" id="vRatio">—</span>' +
        '<button class="verdict__reset" id="vReset" type="button" hidden>复位</button></div>' +
        '<div class="verdict__who" id="vWho">—</div>' +
        '<div class="verdict__sub" id="vPoint">—</div>' +
        '<div class="verdict__foot"><div class="verdict__vrows">' +
        '<div class="verdict__vrow"><span class="verdict__vk">基准</span>' +
        '<span class="verdict__vv" id="vBase">—</span></div>' +
        '<div class="verdict__vrow"><span class="verdict__vk">对比</span>' +
        '<span class="verdict__vv" id="vComp">—</span></div>' +
        '<div class="verdict__vrow"><span class="verdict__vk">各自最优</span>' +
        '<span class="verdict__vv" id="vOpt">—</span></div></div>' +
        '<div class="verdict__note" id="vNote">—</div></div>';

      var card = el('div', 'card chartcard');
      var m = charts.mount(card, { height: 620 });
      var tip = ctx.tip.mount(m.wrap, m.geom);
      card.appendChild(GS.ui.panels.actionsRow(function () { return m.plot; }));

      host.appendChild(verdict);
      host.appendChild(card);
      host.appendChild(GS.ui.panels.note(FOOT, 'pagenote'));

      var st = null;
      var pinned = null;
      var lastRaw = null;

      function updateVerdict(states, scan) {
        var n = states.base.n;
        if (pinned && (pinned.x < -1e-9 || pinned.y < -1e-9 || pinned.x + pinned.y > n + 1e-9)) pinned = null;
        var p = pinned || { x: scan.bestBase.x, y: scan.bestBase.y };
        var r = ratioAt(states.base, states.comp, p.x, p.y);
        var db = S.damage(states.base, p.x, p.y);
        var dc = S.damage(states.comp, p.x, p.y);
        var margin = Math.abs(r - 1) * 100;
        var who;
        if (margin.toFixed(2) === '0.00') {
          who = '两套等效';
        } else {
          who = (r > 1 ? '对比更强' : '基准更强') + ' ' + margin.toFixed(2) + '%';
        }
        var color = margin.toFixed(2) === '0.00' ? '' : (r > 1 ? '#a03030' : '#2a6099');
        document.getElementById('vRatio').textContent = r.toFixed(4);
        document.getElementById('vReset').hidden = !pinned;
        document.getElementById('vWho').textContent = who;
        document.getElementById('vWho').style.color = color;
        document.getElementById('vPoint').textContent =
          (pinned ? '所选点：' : '基准最优：') + '精通 ' + p.x.toFixed(1) + ' · 双暴 ' + p.y.toFixed(1) + ' 词条' +
          (pinned ? '（点击「复位」回基准最优）' : '（点击图面移动）');
        document.getElementById('vBase').textContent =
          '幻灭 4 + 精精精 · ' + Math.round(db) + '（精通 ' + (states.base.em + 20 * p.x).toFixed(0) +
          ' · 暴击 ' + S.critSplit(states.base.cr, states.base.cd, p.y).cr.toFixed(1) + ' / ' +
          S.critSplit(states.base.cr, states.base.cd, p.y).cd.toFixed(1) + '）';
        document.getElementById('vComp').textContent =
          configLabel(lastRaw.set, lastRaw.main) + ' · ' + Math.round(dc) +
          '（精通 ' + (states.comp.em + 20 * p.x).toFixed(0) +
          ' · 暴击 ' + S.critSplit(states.comp.cr, states.comp.cd, p.y).cr.toFixed(1) + ' / ' +
          S.critSplit(states.comp.cr, states.comp.cd, p.y).cd.toFixed(1) + '）';
        var baseR = Math.round(scan.bestBase.d), compR = Math.round(scan.bestComp.d);
        var bestDiff = (compR / baseR - 1) * 100;
        var bestDiffTxt = Math.abs(bestDiff) < 0.005 ? '（持平）'
          : '（' + (bestDiff > 0 ? '+' : '') + bestDiff.toFixed(2) + '%）';
        document.getElementById('vOpt').textContent =
          '基准 ' + scan.bestBase.x.toFixed(1) + ' / ' + scan.bestBase.y.toFixed(1) + ' → ' + baseR +
          '；对比 ' + scan.bestComp.x.toFixed(1) + ' / ' + scan.bestComp.y.toFixed(1) + ' → ' +
          compR + bestDiffTxt;
        var range = '全图 ×' + scan.lo.toFixed(3) + ' ~ ×' + scan.hi.toFixed(3);
        if (scan.lo > 1 + 1e-9) range += '（全图对比更强）';
        else if (scan.hi < 1 - 1e-9) range += '（全图基准更强）';
        else range += '（黑线 = 两套等效）';
        document.getElementById('vNote').textContent = range;
      }

      function update(s0) {
        lastRaw = s0;
        var states = statesOf(s0);
        st = states;
        var scan = scanRatio(states.base, states.comp, GRID);
        updateVerdict(states, scan);

        var n = states.base.n;
        var cmap = makeColorMap(scan.lo, scan.hi);
        var zT = scan.zs.map(function (row) {
          return row.map(function (v) { return v === null ? null : cmap.toT(v); });
        });
        var tickVals;
        if (Math.abs(cmap.hi - cmap.lo) < 1e-6) {
          tickVals = [1];
        } else if (cmap.hi <= 1) {
          tickVals = [cmap.lo, cmap.lo + (1 - cmap.lo) / 3, cmap.lo + 2 * (1 - cmap.lo) / 3, 1];
        } else if (cmap.lo >= 1) {
          tickVals = [1, 1 + (cmap.hi - 1) / 3, 1 + 2 * (cmap.hi - 1) / 3, cmap.hi];
        } else {
          tickVals = [cmap.lo, (cmap.lo + 1) / 2, 1, (1 + cmap.hi) / 2, cmap.hi];
        }
        var round2 = function (v) { return Math.round(v * 100) / 100; };

        var traces = [{
          type: 'heatmap', x: scan.xs, y: scan.xs, z: zT,
          colorscale: COLORSCALE, zmin: 0, zmax: 1, showlegend: false,
          colorbar: {
            title: { text: '对比 / 基准' }, thickness: 16, len: 0.8,
            tickvals: tickVals.map(cmap.toT), ticktext: tickVals.map(round2),
          },
        }];
        if (scan.divider.bx.length > 1) {
          traces.push({
            type: 'scatter', mode: 'lines', x: scan.divider.bx, y: scan.divider.by,
            name: '两套等效', line: { color: '#000', width: 2.2 }, hoverinfo: 'skip',
          });
        }
        traces.push({
          type: 'scatter', mode: 'markers', x: [scan.bestBase.x], y: [scan.bestBase.y], cliponaxis: false,
          marker: { symbol: 'circle', size: 7, color: '#e8710a', line: { color: '#fff', width: 1.5 } },
          name: '基准最优',
        });
        traces.push({
          type: 'scatter', mode: 'markers', x: [scan.bestComp.x], y: [scan.bestComp.y], cliponaxis: false,
          marker: { symbol: 'diamond', size: 8, color: '#4a6fa5', line: { color: '#fff', width: 1.5 } },
          name: '对比最优',
        });
        var p = pinned || { x: scan.bestBase.x, y: scan.bestBase.y };
        if (pinned) {
          traces.push({
            type: 'scatter', mode: 'markers', x: [p.x], y: [p.y], cliponaxis: false,
            marker: { symbol: 'cross-thin-open', size: 16, color: '#111', line: { width: 2.2, color: '#111' } },
            name: '所选点',
          });
        }

        var shapes = [
          { type: 'line', x0: 0, y0: n, x1: n, y1: 0, line: { color: '#b9b1b7', width: 1, dash: 'dot' } },
        ];
        if (pinned) {
          shapes.push({ type: 'line', x0: p.x, x1: p.x, y0: 0, y1: n, line: { color: '#111', width: 1.1, dash: 'dot' } });
          shapes.push({ type: 'line', x0: 0, x1: n, y0: p.y, y1: p.y, line: { color: '#111', width: 1.1, dash: 'dot' } });
        }
        var anns = [{
          x: n * 0.58, y: n * 0.58, text: '词条预算', showarrow: false,
          font: { size: 11, color: '#999' },
        }];
        charts.draw(m.plot, traces, {
          xaxis: charts.axis({ title: { text: '精通词条数' }, range: [0, n] }),
          yaxis: charts.axis({ title: { text: '双暴词条数' }, range: [0, n] }),
          shapes: shapes, annotations: anns,
          showlegend: true,
          legend: { orientation: 'h', x: 0, y: 1.06, font: { size: 12, color: charts.DIM } },
          margin: { t: 24, r: 24, b: 52, l: 60 }, height: 620,
        }).then(function () { /* 无叠加层 */ });
      }

      m.wrap.addEventListener('mousemove', function (e) {
        if (!st) { tip.hide(); return; }
        var p = m.pxIn(e);
        if (!p) { tip.hide(); return; }
        var g = m.geom();
        var n = st.base.n;
        var x = p.x / g.w * n;
        var y = n - p.y / g.h * n;
        if (x < 0 || y < 0 || x + y > n + 1e-9) { tip.hide(); return; }
        var r = ratioAt(st.base, st.comp, x, y);
        var db = S.damage(st.base, x, y);
        var dc = S.damage(st.comp, x, y);
        var margin = Math.abs(r - 1) * 100;
        var who = margin.toFixed(2) === '0.00' ? '两套等效'
          : (r > 1 ? '对比更强 ' : '基准更强 ') + margin.toFixed(2) + '%';
        tip.show(ctx.tip.card({
          title: '精通 ' + x.toFixed(1) + ' · 双暴 ' + y.toFixed(1) + ' 词条',
          hero: { v: '×' + r.toFixed(4), cap: '对比 / 基准' },
          rows: [
            ['基准', Math.round(db)],
            ['对比', Math.round(dc)],
            ['该点', who],
          ],
          note: configLabel(lastRaw.set, lastRaw.main),
        }), p.x, p.y);
      });
      m.wrap.addEventListener('mouseleave', tip.hide);

      m.wrap.addEventListener('click', function (e) {
        if (!st || !lastRaw) return;
        var p = m.pxIn(e);
        if (!p) return;
        var g = m.geom();
        var n = st.base.n;
        var x = p.x / g.w * n;
        var y = n - p.y / g.h * n;
        if (x < 0 || y < 0 || x + y > n + 1e-9) return;
        pinned = { x: x, y: y };
        update(lastRaw);
      });
      document.getElementById('vReset').addEventListener('click', function () {
        if (!pinned || !lastRaw) return;
        pinned = null;
        update(lastRaw);
      });

      return { plot: m.plot, update: update };
    },
  };
})(typeof globalThis !== 'undefined' ? globalThis : this);
