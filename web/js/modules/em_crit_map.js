/* 瑞希 · 伤害热图：精通词条 × 双暴词条的星扩散直伤热图 + 悬浮卡（直伤 / 单次反应）。 */
(function (global) {
  'use strict';
  var GS = global.GS = global.GS || {};
  var M = GS.modules = GS.modules || {};
  var C = GS.core;
  var Mi = GS.core.mizuki;
  var H = Mi.HM;
  var el = GS.ui.panels.el;

  var GRID = 121;
  var CAP = Mi.ROLL_LIMIT;

  var FOOT =
    '星扩散直伤 = 廓然梦生「辉映·星扩散」额外那一次 <b>1000% 元素精通</b>风伤：' +
    '<code>D = 10 × EM × (1 + 基础提升) × (1 + 6EM/(EM+2000) + 星扩散增伤 + 0.00045 × EM) × 抗性系数 × 暴击区</code>（E Lv10）。' +
    '反应星扩散（单次）= <code>1446.85 × 倍率 × 分摊 × (1 + 基础提升) × 同一括号 × 抗性系数 × 暴击区</code>；默认风路径 0.75 × 3/5。' +
    'EM = 梦浮内终值（含廓然梦生 10%）；无防御区；详见 ' +
    '<code>docs/ai-output/0-mechanism/2-瑞希与配队增益.md</code>。<br>' +
    '<b>归一化梯度</b> = 悬浮点两类词条的相对重要性。';

  M['mizuki/em_crit_map'] = {
    title: '「梦见月瑞希」伤害热图',
    tab: '瑞希·伤害热图',
    intro: '颜色 = 相对基准面板（0 词条）的星扩散直伤倍数；悬浮读直伤与单次反应星扩散伤害，点击固定所选点、复位回最优。',
    controls: [
      {
        key: '', type: 'note',
        html: '<b>基准面板</b>：上完 buff、不含副词条；实战精通含廓然梦生 ×1.1',
      },
      {
        key: '', type: 'note',
        html: '<b>词条口径</b>：1 词条 = ' + C.ROLL.em + ' 精通（梦浮内 ×1.1 ≈ ' +
          (C.ROLL.em * 1.1).toFixed(1) + '）= ' + C.ROLL.cr + '% 暴击 = ' + C.ROLL.cd + '% 暴伤。',
      },
      { key: 'em', type: 'items', label: '基准精通', step: 1, min: 0, items: [
        { n: '瑞希突破', v: 115 },
        { n: '天光的纺琴 R5', v: 200 },
        { n: '精通沙', v: 187 },
        { n: '精通杯', v: 187 },
        { n: '昼想夜梦', v: 100 },
        { n: '冰主 2 命', v: 120 }],
        derived: [
          { n: '廓然梦生 10%', compute: function (base) { return base * 0.1; } },
        ] },
      { key: 'cr', type: 'items', label: '基准暴击率 %', step: 0.1, min: 0, items: [
        { n: '瑞希自身', v: 5 },
        { n: '双冰共鸣', v: 15 },
        { n: '血红 4 件套', v: 16 }] },
      { key: 'cd', type: 'items', label: '基准暴伤 %', step: 0.1, min: 50, items: [
        { n: '角色基础', v: 50 },
        { n: '暴伤头', v: 62.2 }] },
      { key: 'bonus', type: 'items', label: '星扩散增伤 %', step: 5, min: 0, items: [
        { n: '炉火 4 件套', v: 50 },
        { n: '血红 4 件套', v: 40 },
        { n: '冰主 6 命', v: 40 },
        { n: '奥黛塔 华彩', v: 60 }] },
      { key: 'baseUp', type: 'items', label: '基础提升 %', step: 1, min: 0, full: true, items: [
        { n: '奥黛塔 固有天赋', v: 14 },
        { n: '冰主 固有天赋', v: 7 }] },
      { key: 'rxPath', type: 'select', half: true, label: '反应路径', def: 'wind',
        options: [
          { value: 'wind', label: '风（0.75 · 3/5）' },
          { value: 'ice', label: '冰（风涡系数 · 3/10）' },
        ] },
      { key: 'rxCoef', type: 'select', half: true, label: '风涡系数', def: '3',
        options: [
          { value: '2', label: '1–2（倍率 2）' },
          { value: '3', label: '3–6（倍率 3）' },
        ] },
      {
        key: '', type: 'note',
        html: '热图、最优分配、梯度按星扩散直伤；悬浮卡另列单次反应星扩散伤害。' +
          '反应路径与风涡系数只影响反应读数；风涡系数仅冰路径使用。',
      },
      {
        type: 'group', label: '敌人区', open: true,
        items: [
          { key: 'enemyRes', type: 'number', label: '敌人抗性 %', def: 10, step: 1, min: -100, max: 200 },
          { key: 'shredA', type: 'number', label: '风抗削减 %', def: 55, step: 1, min: 0, max: 200 },
          { key: 'shredIce', type: 'number', label: '冰抗削减 %', def: 50, step: 1, min: 0, max: 200 },
        ],
      },
      { key: 'n', type: 'range', label: '词条预算', def: 30, min: 2, max: CAP, step: 1 },
    ],

    create: function (host, ctx) {
      var charts = ctx.charts;

      function segBar(a, b) {
        var g = function (v) { return Math.max(0.04, v).toFixed(3); };
        return '<div class="tip__barlbl"><span class="s-em">精通 ' + a.toFixed(2) + '</span>' +
          '<span class="s-cr">双暴 ' + b.toFixed(2) + '</span></div>' +
          '<div class="tip__seg"><i class="em" style="flex-grow:' + g(a) + '"></i>' +
          '<i class="cr" style="flex-grow:' + g(b) + '"></i></div>';
      }
      function eqItem(v) {
        return '<span class="val"><b class="' + (v >= 1 ? 'hi' : 'lo') + '">' + v.toFixed(2) + '</b></span>';
      }

      var verdict = el('div', 'verdict');
      verdict.innerHTML =
        '<div class="verdict__bar"><span class="verdict__st" id="vState">最优分配</span>' +
        '<span class="verdict__mul" id="vMul">—</span><span>相对基准面板</span>' +
        '<button class="verdict__reset" id="vReset" type="button" hidden>复位</button></div>' +
        '<div class="verdict__dmg"><div class="verdict__cells" id="vdmgRow">—</div></div>' +
        '<div class="verdict__foot"><div class="verdict__vrows">' +
        '<div class="verdict__vrow"><span class="verdict__vk">分配</span>' +
        '<span class="verdict__vv" id="bestSplit">—</span></div>' +
        '<div class="verdict__vrow"><span class="verdict__vk">面板</span>' +
        '<span class="verdict__vv" id="cornerLine">—</span></div></div></div>';

      var card = el('div', 'card chartcard');
      var m = charts.mount(card, { height: 620 });
      var ovl = ctx.overlay.mount(m.wrap, m.geom);
      var tip = ctx.tip.mount(m.wrap, m.geom);
      ctx.overlay.cursor(m.wrap, m.geom, function (e) { return m.pxIn(e); });
      card.appendChild(GS.ui.panels.actionsRow(function () { return m.plot; }));

      host.appendChild(verdict);
      host.appendChild(card);
      host.appendChild(GS.ui.panels.note(FOOT, 'pagenote'));

      var st = null;
      var pinned = null;
      var lastRaw = null;
      var eqRange = null;
      var optMarks = [];

      /** 控件 state → core state（抗性系数由敌人区折算）。 */
      function coreState(s) {
        return {
          emBase: s.em, cr0: s.cr, cd0: s.cd,
          bonus: s.bonus / 100, baseUp: s.baseUp / 100,
          resA: C.kappa((s.enemyRes - s.shredA) / 100),
          resIce: C.kappa((s.enemyRes - s.shredIce) / 100),
          rxPath: s.rxPath, rxCoef: Number(s.rxCoef) || 3,
          n: s.n, nMax: CAP,
        };
      }

      function updateVerdict(rs) {
        var best = H.optAt(rs, rs.n);
        if (pinned && (pinned.x < -1e-9 || pinned.y < -1e-9 || pinned.x + pinned.y > rs.nMax + 1e-9)) {
          pinned = null;
        }
        var p = pinned || best;
        var det = H.directParts(rs, p.x, p.y);
        var mult = det.direct / H.baseline(rs);
        document.getElementById('vState').textContent = pinned ? '所选点' : '最优分配';
        document.getElementById('vMul').textContent = '×' + mult.toFixed(3);
        document.getElementById('vReset').hidden = !pinned;
        document.getElementById('vdmgRow').innerHTML =
          '<div class="dcell" data-part="0"><span class="dcell__k">星扩散直伤</span>' +
          '<b class="dcell__v">' + Math.round(det.direct) + '</b>' +
          '<span class="dcell__c"><span>暴击 <b>' + Math.round(det.crit) + '</b></span>、' +
          '<span>未暴击 <b>' + Math.round(det.noncrit) + '</b></span></span></div>';
        var xr = parseFloat(p.x.toFixed(1)), yr = parseFloat(p.y.toFixed(1));
        document.getElementById('bestSplit').textContent =
          '共 ' + (xr + yr).toFixed(1) + ' 词条：精通 ' + xr.toFixed(1) + ' · 双暴 ' + yr.toFixed(1) +
          '（暴击 ' + det.critRolls.toFixed(1) + '）';
        document.getElementById('cornerLine').textContent =
          '精通 ' + det.em.toFixed(0) + ' · 暴击 ' + det.cr.toFixed(1) + ' / ' + det.cd.toFixed(1);
      }

      function update(s0) {
        lastRaw = s0;
        var rs = coreState(s0);
        st = rs;
        var scan = H.scan(rs, GRID);
        eqRange = H.equivRange(rs, 61);
        updateVerdict(rs);

        var cap = rs.nMax;
        var shapes = [];
        for (var c = 5; c < cap; c += 5) {
          shapes.push({ type: 'line', x0: 0, y0: c, x1: c, y1: 0, line: { color: '#9a9a9a', width: 1, dash: 'dot' } });
        }
        shapes.push({ type: 'line', x0: 0, y0: rs.n, x1: rs.n, y1: 0, line: { color: '#e8710a', width: 1.8, dash: 'dash' } });

        var zFlat = scan.zs.flat().filter(function (v) { return v !== null; });
        var zLo = Math.min.apply(null, zFlat), zHi = Math.max.apply(null, zFlat);
        var traces = [{
          type: 'heatmap', x: scan.xs, y: scan.xs, z: scan.zs,
          colorscale: 'Viridis', zmin: 1, zmax: zHi,
          colorbar: { title: { text: '伤害倍数' }, thickness: 16, len: 0.8 },
          showlegend: false,
        }];
        var lvlStart = Math.ceil((zLo + 1e-9) / 0.2) * 0.2;
        if (lvlStart <= zHi) {
          traces.push({
            type: 'contour', x: scan.xs, y: scan.xs, z: scan.zs,
            contours: { coloring: 'none', showlabels: true, labelfont: { size: 11, color: '#666' }, start: lvlStart, end: zHi, size: 0.2 },
            line: { color: '#555', width: 1.2, smoothing: 1 },
            name: '等高线', showscale: false, showlegend: true, legendrank: 2,
          });
        }
        var line = H.line(rs, 121);
        var lineX = line.xs.map(function (x) { return Math.max(x, cap * 0.002); });
        traces.push({
          type: 'scatter', mode: 'lines', x: lineX, y: line.ys, name: '最优分配线',
          line: { color: '#e8710a', width: 1.6 }, legendrank: 1,
        });
        traces.push({   // 等词条线是 shapes，不会进图例；画一段轴外线段补图例项（裁剪后不可见）
          type: 'scatter', mode: 'lines', x: [-2, -1], y: [-2, -1], name: '等词条线',
          hoverinfo: 'skip', showlegend: true,
          line: { color: '#9a9a9a', width: 1, dash: 'dot' }, legendrank: 3,
        });
        optMarks = [10, 20, 30, 40].map(function (t) {
          var p = H.optAt(rs, t);
          return { n: t, x: p.x, y: p.y, dmg: H.direct(rs, p.x, p.y) };
        });
        traces.push({
          type: 'scatter', mode: 'markers',
          x: optMarks.map(function (p) { return p.x; }), y: optMarks.map(function (p) { return p.y; }),
          cliponaxis: false, showlegend: false,
          marker: { symbol: 'circle', size: 6, color: '#e8710a', line: { color: '#fff', width: 1.2 } },
        });
        var best = H.optAt(rs, rs.n);
        traces.push({
          type: 'scatter', mode: 'markers', x: [best.x], y: [best.y], cliponaxis: false,
          marker: { symbol: 'circle', size: 7, color: '#e8710a', line: { color: '#fff', width: 1.5 } },
          name: '最优',
        });
        if (pinned) {
          traces.push({
            type: 'scatter', mode: 'markers', x: [pinned.x], y: [pinned.y], cliponaxis: false,
            marker: { symbol: 'cross', size: 11, color: '#4a6fa5' },
            name: '所选点',
          });
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
        var cap = s.nMax || s.n;
        var parts = [];
        if (pinned) {
          var px = pinned.x / cap * g.w, py = (cap - pinned.y) / cap * g.h;
          parts.push('<line x1="' + px + '" y1="0" x2="' + px + '" y2="' + g.h + '" stroke="#4a6fa5" stroke-width="1.2" stroke-dasharray="6,4"/>');
          parts.push('<line x1="0" y1="' + py + '" x2="' + g.w + '" y2="' + py + '" stroke="#4a6fa5" stroke-width="1.2" stroke-dasharray="6,4"/>');
          parts.push('<line x1="' + (px - 6) + '" y1="' + py + '" x2="' + (px + 6) + '" y2="' + py + '" stroke="#4a6fa5" stroke-width="2"/>');
          parts.push('<line x1="' + px + '" y1="' + (py - 6) + '" x2="' + px + '" y2="' + (py + 6) + '" stroke="#4a6fa5" stroke-width="2"/>');
        }
        ctx.overlay.text(parts, s.n * 0.78 / cap * g.w, (cap - s.n * 0.22) / cap * g.h,
          '预算 ' + s.n + ' 词', '#e8710a', 'middle');
        for (var mi = 0; mi < optMarks.length; mi++) {
          var mk = optMarks[mi];
          ctx.overlay.text(parts, mk.x / cap * g.w + 7, (cap - mk.y) / cap * g.h + 4,
            Math.round(mk.dmg) + ' (' + mk.n + '词)', '#e8710a');
        }
        return parts;
      });

      m.wrap.addEventListener('mousemove', function (e) {
        var hoverPx = m.pxIn(e);
        if (!hoverPx || !st) { tip.hide(); return; }
        var g = m.geom();
        var cap = st.nMax;
        var x = hoverPx.x / g.w * cap;
        var y = cap - hoverPx.y / g.h * cap;
        var s = st;
        if (x < 0 || y < 0) { tip.hide(); return; }

        var base0 = H.baseline(s);
        if (x + y > cap + 1e-9) {   // 超过容量上限：只列同比例折算到上限的数值
          var sum = x + y;
          var detF = H.directParts(s, x * cap / sum, y * cap / sum);
          tip.show(
            '<div class="tip__hero"><b>' + Math.round(detF.direct) + '</b><span class="u">星扩散直伤</span></div>' +
            '<div class="tip__crit">暴击 ' + Math.round(detF.crit) + '、未暴击 ' + Math.round(detF.noncrit) + '</div>' +
            '<div class="tip__hero tip__hero--sm"><b>×' + (detF.direct / base0).toFixed(3) + '</b><span class="u">相对基准面板</span></div>' +
            '<div class="tip__bad">超过 ' + cap + ' 词条上限</div>',
            hoverPx.x, hoverPx.y);
          return;
        }

        var det = H.directParts(s, x, y);
        var rx = H.reactParts(s, x, y);
        var mult = det.direct / base0;
        var eq = H.equiv(s, x, y);
        var rng = eqRange || H.equivRange(s, 61);
        var al = H.nextAlloc(s, x, y);
        var gr = H.grad(s, x, y);
        var gsum = gr.gx + gr.gy;
        var gEm = gsum > 0 ? gr.gx / gsum : 0.5;
        var xr = x.toFixed(1), yr = y.toFixed(1);
        var totR = (parseFloat(xr) + parseFloat(yr)).toFixed(1);
        var pathName = s.rxPath === 'ice' ? '冰' : '风';

        var eqHTML = '';
        if (isFinite(eq.em)) {
          eqHTML = '<div class="tip__eq"><div style="font-weight:600">单位词条等效（精通 → 双暴）</div>' +
            '<div class="tip__eqr"><span class="lb">精通</span>' + eqItem(eq.em) +
            '<span class="rg">∈ [' + rng.lo.toFixed(2) + ', ' + rng.hi.toFixed(2) + ']</span></div></div>';
        }

        var html =
          '<div class="tip__hero"><b>' + Math.round(det.direct) + '</b><span class="u">星扩散直伤</span></div>' +
          '<div class="tip__crit">暴击 ' + Math.round(det.crit) + '、未暴击 ' + Math.round(det.noncrit) + '</div>' +
          '<div class="tip__hero tip__hero--sm"><b>×' + mult.toFixed(3) + '</b><span class="u">相对基准面板</span></div>' +
          '<div class="tip__div"></div>' +
          '<div class="tip__hd tip__hd--sum"><span class="nm">有效词条</span><span class="rl">' + totR + '</span><span class="vl"></span></div>' +
          '<div class="tip__hd"><span>精通</span><span class="rl">' + xr + ' 词条</span><span class="vl">' + det.em.toFixed(0) + '</span></div>' +
          '<div class="tip__hd"><span>双暴</span><span class="rl">' + yr + ' 词条</span><span class="vl">' + det.cr.toFixed(1) + ' / ' + det.cd.toFixed(1) + '</span></div>' +
          '<div class="tip__hero tip__hero--sm" style="margin-top:7px"><b>' + Math.round(rx.exp) + '</b><span class="u">反应星扩散（' + pathName + '）</span></div>' +
          '<div class="tip__crit">暴击 ' + Math.round(rx.crit) + '、未暴击 ' + Math.round(rx.noncrit) + '</div>' +
          eqHTML +
          '<div class="tip__cap mt" style="font-weight:600">下一词条最优分配</div>' + segBar(al.em, al.crit) +
          '<div class="tip__cap mt" style="font-weight:600">归一化梯度</div>' + segBar(gEm, 1 - gEm);
        tip.show(html, hoverPx.x, hoverPx.y);
      });
      m.wrap.addEventListener('mouseleave', function () {
        tip.hide();
      });

      m.wrap.addEventListener('click', function (e) {
        if (!st || !lastRaw) return;
        var p = m.pxIn(e);
        if (!p) return;
        var g = m.geom();
        var cap = st.nMax;
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
