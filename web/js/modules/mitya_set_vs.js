/* 米提亚 · 套装对比：比值热力图（配置 B / 配置 A），两套配置均可自由选择。
   同一套副词条分配 (x, y) 下比较两套配置；黑线 = 两套等效；结论按各自最优伤害。 */
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
  var SETS = { emblem: '幻灭 4 件套', em22: '精通 2+2', gilded: '饰金之梦 4 件套' };
  var MAINS = { emEmEm: '精精精', emEmCr: '精精暴击', emEmCd: '精精暴伤' };

  function fmtTrim(v, minDp, maxDp) {
    var s = v.toFixed(maxDp);
    while (s.indexOf('.') >= 0 && s.length - s.indexOf('.') - 1 > minDp && s.charAt(s.length - 1) === '0') {
      s = s.slice(0, -1);
    }
    if (s.charAt(s.length - 1) === '.') s = s.slice(0, -1);
    return s;
  }
  function q(v, minDp, maxDp) { return Number(fmtTrim(v, minDp, maxDp)); }

  /** 公共面板（不含套装 / 主词条贡献）：与热图默认面板一致，只是把幻灭 / 主词条拆出去。 */
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
      nMax: S.N_MAX,
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
    } else if (set === 'gilded') {
      s.em += 180;
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
      A: withSetMain(cs, s.setA, s.mainA),
      B: withSetMain(cs, s.setB, s.mainB),
    };
  }

  function configLabel(set, main) { return SETS[set] + ' · ' + MAINS[main]; }

  /** 比值 = 配置 B / 配置 A。 */
  function ratioAt(a, b, x, y) {
    var da = S.damage(a, x, y);
    var db = S.damage(b, x, y);
    return da && db ? db / da : null;
  }

  /** 全网格：B/A 比值、极值、各自最优、两套等效线。绘图范围 0 ~ nMax；最优按预算 n。 */
  function scanRatio(a, b, G) {
    G = G || GRID;
    var cap = a.nMax || a.n;
    var step = cap / (G - 1);
    var xs = Array.from({ length: G }, function (_, i) { return i * step; });
    var lo = Infinity, hi = -Infinity, loAt = null, hiAt = null;
    var zs = xs.map(function (y) {
      return xs.map(function (x) {
        var r = ratioAt(a, b, x, y);
        if (r === null) return null;
        if (r < lo) { lo = r; loAt = [x, y]; }
        if (r > hi) { hi = r; hiAt = [x, y]; }
        return r;
      });
    });
    return {
      xs: xs, zs: zs, lo: lo, hi: hi, loAt: loAt, hiAt: hiAt,
      bestA: S.bestFor(a), bestB: S.bestFor(b),
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
    '<b>配置 A 与配置 B 均可自由选择</b>（套装 × 主词条）。两者使用同一套副词条分配（横轴精通词条、纵轴双暴词条）：' +
    '颜色 = <b>B / A</b>，> 1 = B 在该分配更强；黑线 = 两套等效。<br>' +
    '<b>结论按两套各自的最优伤害比较</b> —— 各自在预算 n 内取最优分配；橙点 = A 最优，蓝菱 = B 最优。' +
    '某个固定点的比值只说明该分配下的强弱，不能代替最优比较。' +
    '<b>更强 X% = 1 − 较弱最优 / 较强最优</b>（如 287,891 / 294,216 → 2.15%）。<br>' +
    '<b>绘图范围固定 0–43 词条</b>（副词条容量估算）；细虚线 = 5 / 10 / … / 40 词条，橙线 = 当前预算 n（默认 30）。' +
    '预算只决定最优标记与「各自最优」读数，不是绘图上限。<br>' +
    '<b>套装贡献</b>：幻灭 4 = +16% 暴击率、+40% 星超导增伤；精通 2+2 = +160 精通；' +
    '饰金之梦 4 件套 = +180 精通（双雷队：2 件套 +80，两个异色角色各 +50；同类元素的攻击加成对米提亚无用，不计）。' +
    '<b>主词条</b>：精精精 = +561 精通；精精暴击（暴击头）= +374 精通、+31.1% 暴击率；' +
    '精精暴伤（暴伤头）= +374 精通、+62.2% 暴伤。公共面板（角色、武器、命座、队友）与热图页默认一致，' +
    '只是把上述贡献拆出来自动相加。<br>' +
    '抗性系数、擢升在两边相同，已在比值中约掉；<b>K 与 F 不约掉</b>（K 缩放核心项，F 加在核心项后并再乘暴击），' +
    '所以比值会受 K、F 影响。' +
    '色带 1.0 在正中（分段压缩）；精确比值以结论框与悬浮卡为准。';

  M['mitya/set_vs'] = {
    title: '「米提亚」套装对比',
    tab: '米提亚·套装对比',
    noPlotly: false,
    intro: '自由选择配置 A 与配置 B（各自「套装 × 主词条」），在<b>同一套副词条分配</b>下比较：' +
      '绘图范围固定 0–43 词条（细虚线 = 5 / 10 / … / 40，橙线 = 当前预算 n）；颜色 = <b>B / A</b>，黑线 = 两套等效；' +
      '橙点 = A 最优，蓝菱 = B 最优；<b>结论按两套各自的最优伤害比较</b>（按预算 n，默认 30）。' +
      '悬浮读该点的比值与两套伤害，点击图面把所选点移到该处。',
    controls: [
      {
        key: '', type: 'note',
        html: '<b>配置 A 与配置 B 均可自由选择</b>（套装 × 主词条）；两套共用同一套副词条分配。' +
          '<b>结论按各自最优伤害比较</b>；所选点的比值只说明该分配下的强弱。',
      },
      {
        key: '', type: 'note',
        html: '<b>公共面板</b> = 上完 buff、不含套装 / 主词条；每个数值可点「明细」查看来源。' +
          '套装 / 主词条的贡献在计算时自动加上（见页脚）。',
      },
      { key: 'setA', type: 'select', half: true, label: '套装 A', def: 'emblem',
        options: [
          { value: 'emblem', label: '幻灭' },
          { value: 'gilded', label: '饰金' },
          { value: 'em22', label: '精通 2+2' },
        ] },
      { key: 'mainA', type: 'select', half: true, label: '主词条 A', def: 'emEmCr',
        options: [
          { value: 'emEmEm', label: '精精精' },
          { value: 'emEmCr', label: '精精暴击' },
          { value: 'emEmCd', label: '精精暴伤' },
        ] },
      { key: 'setB', type: 'select', half: true, label: '套装 B', def: 'em22',
        options: [
          { value: 'emblem', label: '幻灭' },
          { value: 'gilded', label: '饰金' },
          { value: 'em22', label: '精通 2+2' },
        ] },
      { key: 'mainB', type: 'select', half: true, label: '主词条 B', def: 'emEmCr',
        options: [
          { value: 'emEmEm', label: '精精精' },
          { value: 'emEmCr', label: '精精暴击' },
          { value: 'emEmCd', label: '精精暴伤' },
        ] },
      { key: 'em', type: 'items', label: '公共精通', step: 1, min: 0, items: [
        { n: '米提亚自身', v: 100 },
        { n: '秘星典谕 R1', v: 120 },
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
        { n: '秘星典谕 R1', v: 148.2 },
        { n: '1 命', v: 40 }] },
      { key: 'bonus', type: 'items', label: '公共星超导增伤 %', step: 1, min: 0, items: [
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
      { key: 'panelA', type: 'readout', full: true, label: '配置 A 面板', compute: function (s) {
        var a = statesOf(s).A;
        return '精通 ' + a.em.toFixed(0) + ' · 暴击 ' + a.cr.toFixed(1) + ' / ' + a.cd.toFixed(1) +
          ' · 增伤 ' + Math.round(a.bonus * 100) + '%';
      } },
      { key: 'panelB', type: 'readout', full: true, label: '配置 B 面板', compute: function (s) {
        var b = statesOf(s).B;
        return '精通 ' + b.em.toFixed(0) + ' · 暴击 ' + b.cr.toFixed(1) + ' / ' + b.cd.toFixed(1) +
          ' · 增伤 ' + Math.round(b.bonus * 100) + '%';
      } },
    ],

    create: function (host, ctx) {
      var charts = ctx.charts;

      var verdict = el('div', 'verdict');
      verdict.innerHTML =
        '<div class="verdict__bar"><span class="verdict__st">所选点 B/A</span>' +
        '<span class="verdict__mul" id="vRatio">—</span>' +
        '<button class="verdict__reset" id="vReset" type="button" hidden>复位</button></div>' +
        '<div class="verdict__who" id="vWho">—</div>' +
        '<div class="verdict__sub" id="vPoint">—</div>' +
        '<div class="verdict__foot"><div class="verdict__vrows">' +
        '<div class="verdict__vrow"><span class="verdict__vk">A</span>' +
        '<span class="verdict__vv" id="vA">—</span></div>' +
        '<div class="verdict__vrow"><span class="verdict__vk">B</span>' +
        '<span class="verdict__vv" id="vB">—</span></div>' +
        '<div class="verdict__vrow"><span class="verdict__vk">各自最优</span>' +
        '<span class="verdict__vv" id="vOpt">—</span></div></div>' +
        '<div class="verdict__note" id="vNote">—</div></div>';

      var card = el('div', 'card chartcard');
      var m = charts.mount(card, { height: 620 });
      var tip = ctx.tip.mount(m.wrap, m.geom);
      var ovl = ctx.overlay.mount(m.wrap, m.geom);
      ctx.overlay.cursor(m.wrap, m.geom, function (e) { return m.pxIn(e); });
      card.appendChild(GS.ui.panels.actionsRow(function () { return m.plot; }));

      host.appendChild(verdict);
      host.appendChild(card);
      host.appendChild(GS.ui.panels.note(FOOT, 'pagenote'));

      var st = null;
      var pinned = null;
      var lastRaw = null;

      function updateVerdict(states, scan) {
        var A = states.A, B = states.B;
        var n = A.n, cap = A.nMax;
        var nameA = configLabel(lastRaw.setA, lastRaw.mainA);
        var nameB = configLabel(lastRaw.setB, lastRaw.mainB);
        if (pinned && (pinned.x < -1e-9 || pinned.y < -1e-9 || pinned.x + pinned.y > cap + 1e-9)) pinned = null;
        var p = pinned || { x: scan.bestA.x, y: scan.bestA.y };
        var r = ratioAt(A, B, p.x, p.y);
        var dA = S.damage(A, p.x, p.y);
        var dB = S.damage(B, p.x, p.y);

        /* 主结论：两套各自最优伤害（不是某个固定点的比值） */
        var bestA = Math.round(scan.bestA.d), bestB = Math.round(scan.bestB.d);
        var winnerIsB = bestB > bestA;
        var winnerD = Math.max(bestA, bestB), loserD = Math.min(bestA, bestB);
        var gap = winnerD > 0 ? (loserD / winnerD - 1) * 100 : 0;
        var bestWho, bestColor;
        if (bestA === bestB || Math.abs(gap) < 0.005) {
          bestWho = '两套最优伤害持平';
          bestColor = '';
        } else {
          bestWho = (winnerIsB ? nameB : nameA) + ' 更强 ' + Math.abs(gap).toFixed(2) + '%（按各自最优）';
          bestColor = winnerIsB ? '#2a6099' : '#c05621';
        }
        document.getElementById('vRatio').textContent = r.toFixed(4);
        document.getElementById('vReset').hidden = !pinned;
        document.getElementById('vWho').textContent = bestWho;
        document.getElementById('vWho').style.color = bestColor;
        var over = p.x + p.y > n + 1e-9;
        document.getElementById('vPoint').textContent =
          (pinned ? '所选点：' : 'A 最优：') + '精通 ' + p.x.toFixed(1) + ' · 双暴 ' + p.y.toFixed(1) + ' 词条' +
          (pinned ? (over ? '（超出预算，仅展示；复位回 A 最优）' : '（点击「复位」回 A 最优）') : '（点击图面移动）');
        var tA = S.critSplit(A.cr, A.cd, p.y);
        var tB = S.critSplit(B.cr, B.cd, p.y);
        document.getElementById('vA').textContent =
          nameA + ' · ' + Math.round(dA) + '（精通 ' + (A.em + 20 * p.x).toFixed(0) +
          ' · 暴击 ' + tA.cr.toFixed(1) + ' / ' + tA.cd.toFixed(1) + '）';
        document.getElementById('vB').textContent =
          nameB + ' · ' + Math.round(dB) + '（精通 ' + (B.em + 20 * p.x).toFixed(0) +
          ' · 暴击 ' + tB.cr.toFixed(1) + ' / ' + tB.cd.toFixed(1) + '）';
        document.getElementById('vOpt').textContent =
          'A ' + scan.bestA.x.toFixed(1) + ' / ' + scan.bestA.y.toFixed(1) + ' → ' + bestA +
          '；B ' + scan.bestB.x.toFixed(1) + ' / ' + scan.bestB.y.toFixed(1) + ' → ' + bestB;
        var range = '预算 ' + n + ' · 绘图 0–' + cap + ' · 全图 B/A ×' + scan.lo.toFixed(3) + ' ~ ×' + scan.hi.toFixed(3);
        if (scan.lo > 1 + 1e-9) range += '（全图 B/A ≥ 1）';
        else if (scan.hi < 1 - 1e-9) range += '（全图 B/A ≤ 1）';
        else range += '（黑线 = 两套等效）';
        document.getElementById('vNote').textContent = range;
      }

      function update(s0) {
        lastRaw = s0;
        var states = statesOf(s0);
        st = states;
        var scan = scanRatio(states.A, states.B, GRID);
        updateVerdict(states, scan);

        var n = states.A.n;
        var cap = states.A.nMax;
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
            title: { text: 'B / A' }, thickness: 16, len: 0.8,
            tickvals: tickVals.map(cmap.toT), ticktext: tickVals.map(round2),
          },
        }];
        /* 两套等效 = B/A = 1 的等值线：用 contour 直接取等级 1，
           两端自然落在可行域边界（不再按行采样、避免端点缺口）。 */
        traces.push({
          type: 'contour', x: scan.xs, y: scan.xs, z: scan.zs,
          contours: { coloring: 'none', showlabels: false, start: 1, end: 1.000001, size: 1 },
          line: { color: '#000', width: 2.2, smoothing: 1 },
          name: '两套等效', hoverinfo: 'skip', showscale: false,
        });
        traces.push({
          type: 'scatter', mode: 'markers', x: [scan.bestA.x], y: [scan.bestA.y], cliponaxis: false,
          marker: { symbol: 'circle', size: 7, color: '#e8710a', line: { color: '#fff', width: 1.5 } },
          name: 'A 最优',
        });
        traces.push({
          type: 'scatter', mode: 'markers', x: [scan.bestB.x], y: [scan.bestB.y], cliponaxis: false,
          marker: { symbol: 'diamond', size: 8, color: '#4a6fa5', line: { color: '#fff', width: 1.5 } },
          name: 'B 最优',
        });
        var p = pinned || { x: scan.bestA.x, y: scan.bestA.y };
        if (pinned) {
          traces.push({
            type: 'scatter', mode: 'markers', x: [p.x], y: [p.y], cliponaxis: false,
            marker: { symbol: 'cross-thin-open', size: 16, color: '#111', line: { width: 2.2, color: '#111' } },
            name: '所选点',
          });
        }

        var shapes = [];
        for (var c = 5; c < cap; c += 5) {
          shapes.push({ type: 'line', x0: 0, y0: c, x1: c, y1: 0, line: { color: '#b9b1b7', width: 1, dash: 'dot' } });
        }
        shapes.push({ type: 'line', x0: 0, y0: n, x1: n, y1: 0, line: { color: '#e8710a', width: 1.8 } });
        if (pinned) {
          shapes.push({ type: 'line', x0: p.x, x1: p.x, y0: 0, y1: cap, line: { color: '#111', width: 1.1, dash: 'dot' } });
          shapes.push({ type: 'line', x0: 0, x1: cap, y0: p.y, y1: p.y, line: { color: '#111', width: 1.1, dash: 'dot' } });
        }
        charts.draw(m.plot, traces, {
          xaxis: charts.axis({ title: { text: '精通词条数' }, range: [0, cap], dtick: 5 }),
          yaxis: charts.axis({ title: { text: '双暴词条数' }, range: [0, cap], dtick: 5 }),
          shapes: shapes,
          showlegend: true,
          legend: { orientation: 'h', x: 0, y: 1.06, font: { size: 12, color: charts.DIM } },
          margin: { t: 24, r: 24, b: 52, l: 60 }, height: 620,
        }).then(function () { ovl.queue(); });
      }

      ovl.draw(function (g) {
        var s = st;
        if (!s) return [];
        var cap = s.A.nMax;
        var parts = [];
        for (var c = 5; c < cap; c += 5) {
          if (Math.abs(c - s.A.n) < 1e-9) continue;
          ctx.overlay.text(parts, c * 0.78 / cap * g.w, (cap - c * 0.22) / cap * g.h, String(c), '#888', 'middle');
        }
        ctx.overlay.text(parts, s.A.n * 0.78 / cap * g.w, (cap - s.A.n * 0.22) / cap * g.h,
          '预算 ' + s.A.n, '#e8710a', 'middle');
        return parts;
      });

      m.wrap.addEventListener('mousemove', function (e) {
        if (!st) { tip.hide(); return; }
        var p = m.pxIn(e);
        if (!p) { tip.hide(); return; }
        var g = m.geom();
        var cap = st.A.nMax;
        var x = p.x / g.w * cap;
        var y = cap - p.y / g.h * cap;
        if (x < 0 || y < 0 || x + y > cap + 1e-9) { tip.hide(); return; }
        var over = x + y > st.A.n + 1e-9;
        var r = ratioAt(st.A, st.B, x, y);
        var dA = S.damage(st.A, x, y);
        var dB = S.damage(st.B, x, y);
        var margin = Math.abs(r - 1) * 100;
        var winSet = r > 1 ? SETS[lastRaw.setB] : SETS[lastRaw.setA];
        var who = margin.toFixed(2) === '0.00' ? '两套等效'
          : winSet + ' 更强 ' + margin.toFixed(2) + '%';
        tip.show(ctx.tip.card({
          title: '精通 ' + x.toFixed(1) + ' · 双暴 ' + y.toFixed(1) + ' 词条',
          hero: { v: '×' + r.toFixed(4), cap: 'B / A' },
          rows: [
            ['A', Math.round(dA)],
            ['B', Math.round(dB)],
            ['该点', who],
          ],
          note: configLabel(lastRaw.setA, lastRaw.mainA) + ' vs ' + configLabel(lastRaw.setB, lastRaw.mainB) +
            (over ? ' · 超出预算（仅展示）' : ''),
        }), p.x, p.y);
      });
      m.wrap.addEventListener('mouseleave', tip.hide);

      m.wrap.addEventListener('click', function (e) {
        if (!st || !lastRaw) return;
        var p = m.pxIn(e);
        if (!p) return;
        var g = m.geom();
        var cap = st.A.nMax;
        var x = p.x / g.w * cap;
        var y = cap - p.y / g.h * cap;
        if (x < 0 || y < 0 || x + y > cap + 1e-9) return;
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
