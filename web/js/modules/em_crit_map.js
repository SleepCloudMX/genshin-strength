/* 瑞希 · 伤害热图：精通词条 × 双暴词条的星扩散直伤热图；结论框列直伤 + 两条反应，悬浮卡只读直伤。 */
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
    '反应星扩散（单次）= <code>1446.85 × 倍率 × 分摊 × (1 + 基础提升) × 同一括号 × 抗性系数 × 暴击区</code>：风 0.75 × 3/5，冰（风涡系数 2 / 3）× 3/10。' +
    '热图、最优分配、梯度按直伤；结论框另列两条反应。EM = 梦浮内终值（含廓然梦生 10%）；无防御区；详见 ' +
    '<code>docs/ai-output/0-mechanism/2-瑞希与配队增益.md</code>。<br>' +
    '<b>归一化梯度</b> = 悬浮点两类词条的相对重要性。';

  M['mizuki/em_crit_map'] = {
    title: '「梦见月瑞希」伤害热图',
    tab: '瑞希·伤害热图',
    math: true,
    intro: '颜色 = 相对基准面板（0 词条）的星扩散直伤倍数；结论框列直伤与两条反应，悬浮读直伤，点击固定所选点、复位回最优。',
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
      { key: 'rxCoef', type: 'select', half: true, label: '风涡系数', def: '3',
        options: [
          { value: '2', label: '1–2（倍率 2）' },
          { value: '3', label: '3–6（倍率 3）' },
        ] },
      {
        key: '', type: 'note',
        html: '热图、最优分配、梯度按星扩散直伤；结论框另列风 / 冰两条单次反应。' +
          '风涡系数只影响冰反应读数。',
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
      function fmtTrim(v, minDp, maxDp) {
        var s = Number(v).toFixed(maxDp);
        while (s.indexOf('.') >= 0 && s.length - s.indexOf('.') - 1 > minDp && s.charAt(s.length - 1) === '0') {
          s = s.slice(0, -1);
        }
        if (s.charAt(s.length - 1) === '.') s = s.slice(0, -1);
        return s;
      }
      function q(v, minDp, maxDp) { return Number(fmtTrim(v, minDp, maxDp)); }

      /* 公式面板配色：同名量同色 */
      var C_EM = '#2f6f8f', C_K = '#7a6a55', C_BASE = '#23201a',
          C_RES = '#a0764e', C_CR = '#b5453c', C_CD = '#8f3f5f', C_FINAL = '#23201a';

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
      var calcpop = el('div', 'calcpop');
      var calcpopT = el('div', 'calcpop__t');
      var calcpopM = el('div', 'calcpop__m');
      calcpop.appendChild(calcpopT);
      calcpop.appendChild(calcpopM);
      verdict.appendChild(calcpop);

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
      var curP = null;
      var calcActive = null;

      /** 控件 state → core state（抗性系数由敌人区折算）。 */
      function coreState(s) {
        return {
          emBase: s.em, cr0: s.cr, cd0: s.cd,
          bonus: s.bonus / 100, baseUp: s.baseUp / 100,
          resA: C.kappa((s.enemyRes - s.shredA) / 100),
          resIce: C.kappa((s.enemyRes - s.shredIce) / 100),
          rxCoef: Number(s.rxCoef) || 3,
          n: s.n, nMax: CAP,
        };
      }

      function dcell(part, label, exp, crit, noncrit) {
        return '<div class="dcell" data-part="' + part + '"><span class="dcell__k">' + label + '</span>' +
          '<b class="dcell__v" data-k="exp">' + Math.round(exp) + '</b>' +
          '<span class="dcell__c"><span data-k="crit">暴击 <b>' + Math.round(crit) + '</b></span>、' +
          '<span data-k="noncrit">未暴击 <b>' + Math.round(noncrit) + '</b></span></span></div>';
      }

      function updateVerdict(rs) {
        var best = H.optAt(rs, rs.n);
        if (pinned && (pinned.x < -1e-9 || pinned.y < -1e-9 || pinned.x + pinned.y > rs.nMax + 1e-9)) {
          pinned = null;
        }
        var p = pinned || best;
        curP = { x: p.x, y: p.y };
        var det = H.directParts(rs, p.x, p.y);
        var rxw = H.reactParts(rs, p.x, p.y, 'wind');
        var rxi = H.reactParts(rs, p.x, p.y, 'ice');
        var mult = det.direct / H.baseline(rs);
        document.getElementById('vState').textContent = pinned ? '所选点' : '最优分配';
        document.getElementById('vMul').textContent = '×' + mult.toFixed(3);
        document.getElementById('vReset').hidden = !pinned;
        document.getElementById('vdmgRow').innerHTML =
          dcell(0, '星扩散直伤', det.direct, det.crit, det.noncrit) +
          dcell(1, '反应星扩散（风）', rxw.exp, rxw.crit, rxw.noncrit) +
          dcell(2, '反应星扩散（冰）', rxi.exp, rxi.crit, rxi.noncrit);
        var xr = parseFloat(p.x.toFixed(1)), yr = parseFloat(p.y.toFixed(1));
        document.getElementById('bestSplit').textContent =
          '共 ' + (xr + yr).toFixed(1) + ' 词条：精通 ' + xr.toFixed(1) + ' · 双暴 ' + yr.toFixed(1) +
          '（暴击 ' + det.critRolls.toFixed(1) + '）';
        document.getElementById('cornerLine').textContent =
          '精通 ' + det.em.toFixed(0) + ' · 暴击 ' + det.cr.toFixed(1) + ' / ' + det.cd.toFixed(1);
      }

      function update(s0) {
        lastRaw = s0;
        hideCalc();
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
        var mult = det.direct / base0;
        var eq = H.equiv(s, x, y);
        var rng = eqRange || H.equivRange(s, 61);
        var al = H.nextAlloc(s, x, y);
        var gr = H.grad(s, x, y);
        var gsum = gr.gx + gr.gy;
        var gEm = gsum > 0 ? gr.gx / gsum : 0.5;
        var xr = x.toFixed(1), yr = y.toFixed(1);
        var totR = (parseFloat(xr) + parseFloat(yr)).toFixed(1);

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

      /* 结论框数字的计算过程：跟随鼠标；按所指格子选直伤 / 风反应 / 冰反应，按所指数字选期望 / 暴击 / 未暴击。 */
      function hideCalc() { calcActive = null; calcpop.style.display = 'none'; }
      function placeCalc(cx, cy) {
        var w = calcpop.offsetWidth, h = calcpop.offsetHeight;
        var left = cx + 16, top = cy + 16;
        if (left + w > global.innerWidth - 8) left = cx - w - 16;
        if (top + h > global.innerHeight - 8) top = cy - h - 16;
        calcpop.style.left = left + 'px';
        calcpop.style.top = top + 'px';
      }
      function showCalc(cx, cy) {
        if (!st || !curP || !calcActive || !global.katex) return;
        var s = st, x = curP.x, y = curP.y;
        var part = calcActive.part, kind = calcActive.kind;
        var isDirect = part === 0;
        var d = isDirect ? H.directParts(s, x, y) : H.reactParts(s, x, y, part === 1 ? 'wind' : 'ice');
        if (!d) return;
        var expV = isDirect ? d.direct : d.exp;
        var kindName = kind === 'crit' ? '暴击' : kind === 'noncrit' ? '未暴击' : '期望';
        var titleVal = Math.round(kind === 'crit' ? d.crit : kind === 'noncrit' ? d.noncrit : expV);
        var label = isDirect ? '星扩散直伤' : (part === 1 ? '反应星扩散（风）' : '反应星扩散（冰）');
        calcpopT.textContent = label + ' · ' + kindName + ' ' + titleVal;

        var xQ = q(x, 1, 4);
        var emQ = q(s.emBase + C.EM_PER_ROLL * H.EM_MULT * xQ, 1, 3);
        var bQ = q(1 + (s.baseUp || 0), 2, 2);
        var sQ = q(s.bonus || 0, 2, 2);
        var eTermQ = q(C.emTerm(emQ), 3, 5);
        var eBonusQ = q(H.E_COEF * emQ, 3, 5);
        var kQ = q(1 + eTermQ + sQ + eBonusQ, 3, 5);
        var coreQ, baseTex;
        if (isDirect) {
          coreQ = q(10 * emQ * bQ * kQ, 2, 2);
          baseTex = '10 \\times ' + fmtTrim(emQ, 1, 3) + ' \\times ' + fmtTrim(bQ, 2, 2) + ' \\times ' +
            fmtTrim(kQ, 3, 5) + ' = \\textcolor{' + C_BASE + '}{' + fmtTrim(coreQ, 2, 2) + '}';
        } else {
          var multQ = q(d.mult, 2, 2), shareQ = q(d.share, 2, 2);
          coreQ = q(H.REACT_LEVEL * multQ * shareQ * bQ * kQ, 2, 2);
          baseTex = fmtTrim(H.REACT_LEVEL, 2, 2) + ' \\times ' + fmtTrim(multQ, 2, 2) + ' \\times ' +
            fmtTrim(shareQ, 2, 2) + ' \\times ' + fmtTrim(bQ, 2, 2) + ' \\times ' +
            fmtTrim(kQ, 3, 5) + ' = \\textcolor{' + C_BASE + '}{' + fmtTrim(coreQ, 2, 2) + '}';
        }
        var resQ = q(d.res, 2, 4);
        var crQ = q(d.cr / 100, 2, 5), cdQ = q(d.cd / 100, 2, 5);
        var critQ = kind === 'crit' ? q(1 + cdQ, 3, 5) : kind === 'noncrit' ? 1 : q(1 + crQ * cdQ, 3, 5);
        var finalQ = q(coreQ * resQ * critQ, 2, 2);

        var netRes = part === 2
          ? (lastRaw.enemyRes - lastRaw.shredIce) / 100
          : (lastRaw.enemyRes - lastRaw.shredA) / 100;
        var netResPct = q(netRes * 100, 0, 2);
        var resTex;
        if (netRes < 0) resTex = '1 - \\frac{' + fmtTrim(netResPct, 0, 2) + '\\%}{2}';
        else if (netRes < 0.75) resTex = '1 - ' + fmtTrim(netResPct, 0, 2) + '\\%';
        else resTex = '\\frac{1}{4 \\times ' + fmtTrim(q(netRes, 2, 4), 2, 4) + ' + 1}';

        var critTex;
        if (kind === 'crit') {
          critTex = '1 + \\textcolor{' + C_CD + '}{' + fmtTrim(cdQ, 2, 5) + '} = \\textcolor{' + C_FINAL + '}{' + fmtTrim(critQ, 3, 5) + '}';
        } else if (kind === 'noncrit') {
          critTex = '1';
        } else {
          critTex = '1 + \\textcolor{' + C_CR + '}{' + fmtTrim(crQ, 2, 5) + '} \\times \\textcolor{' + C_CD + '}{' +
            fmtTrim(cdQ, 2, 5) + '} = \\textcolor{' + C_FINAL + '}{' + fmtTrim(critQ, 3, 5) + '}';
        }

        var tex = '\\begin{aligned}' +
          '\\textcolor{' + C_EM + '}{EM} &= ' + fmtTrim(s.emBase, 1, 1) + ' + ' + fmtTrim(C.EM_PER_ROLL, 3, 3) +
          ' \\times 1.1 \\times ' + fmtTrim(xQ, 1, 4) + ' = \\textcolor{' + C_EM + '}{' + fmtTrim(emQ, 1, 3) + '}\\\\[2pt]' +
          '\\textcolor{' + C_K + '}{K} &= 1 + \\frac{6 \\times ' + fmtTrim(emQ, 1, 3) + '}{' + fmtTrim(emQ, 1, 3) +
          ' + 2000} + ' + fmtTrim(sQ, 2, 2) + ' + 0.00045 \\times ' + fmtTrim(emQ, 1, 3) +
          ' = \\textcolor{' + C_K + '}{' + fmtTrim(kQ, 3, 5) + '}\\\\[2pt]' +
          '\\textcolor{' + C_BASE + '}{基础} &= ' + baseTex + '\\\\[2pt]' +
          '\\textcolor{' + C_RES + '}{R} &= ' + resTex + ' = \\textcolor{' + C_RES + '}{' + fmtTrim(resQ, 2, 4) + '}\\\\[2pt]' +
          '\\textcolor{' + C_FINAL + '}{C} &= ' + critTex + '\\\\[2pt]' +
          '\\textcolor{' + C_FINAL + '}{最终} &= \\textcolor{' + C_BASE + '}{' + fmtTrim(coreQ, 2, 2) + '} \\times ' +
          '\\textcolor{' + C_RES + '}{' + fmtTrim(resQ, 2, 4) + '} \\times ' +
          '\\textcolor{' + C_FINAL + '}{' + fmtTrim(critQ, 3, 5) + '} = \\textcolor{' + C_FINAL + '}{' + fmtTrim(finalQ, 0, 0) + '}' +
          '\\end{aligned}';

        calcpop.style.display = 'block';
        global.katex.render(tex, calcpopM, { displayMode: true, throwOnError: false });
        placeCalc(cx, cy);
      }
      verdict.addEventListener('mouseover', function (e) {
        var num = e.target.closest && e.target.closest('[data-k]');
        var cell = num && num.closest('.dcell[data-part]');
        if (num && cell) {
          calcActive = { part: Number(cell.getAttribute('data-part')), kind: num.getAttribute('data-k') };
          showCalc(e.clientX, e.clientY);
        } else {
          hideCalc();
        }
      });
      verdict.addEventListener('mouseout', function (e) {
        var num = e.target.closest && e.target.closest('[data-k]');
        if (num && !num.contains(e.relatedTarget)) hideCalc();
      });
      verdict.addEventListener('mousemove', function (e) {
        if (calcActive) placeCalc(e.clientX, e.clientY);
      });

      return { plot: m.plot, update: update };
    },
  };
})(typeof globalThis !== 'undefined' ? globalThis : this);
