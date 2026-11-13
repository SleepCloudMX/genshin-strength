/* 米提亚 · 伤害热图：精通 × 双暴热图（单段「递变聚爆」星超导）+ 悬浮卡读数。 */
(function (global) {
  'use strict';
  var GS = global.GS = global.GS || {};
  var M = GS.modules = GS.modules || {};
  var C = GS.core;
  var S = C.mitya;
  var el = GS.ui.panels.el;

  var GRID = 121;

  /* 公式面板配色：同名量同色；深色系、不刺眼 */
  var C_EM = '#2f6f8f',    // 元素精通
      C_B = '#c05621',     // 基础提升
      C_E = '#3f7d4f',     // 精通项
      C_S = '#8f3f5f',     // 星超导增伤
      C_K = '#7a6a55',     // 星超导系数 / 天赋倍率
      C_F = '#6e685c',     // 额外提升
      C_BASE = '#7b4fa0',  // 单段基础伤害
      C_ENEMY = '#6e685c', // 敌人区辅助量（抗性）
      C_RES = '#a0764e',   // 雷抗系数
      C_CR = '#b5453c',    // 暴击率
      C_CD = '#8f3f5f',    // 暴击伤害
      C_ASC = '#5a8ca0',   // 擢升
      C_FINAL = '#23201a'; // 最终伤害

  function fmtTrim(v, minDp, maxDp) {
    var s = v.toFixed(maxDp);
    while (s.indexOf('.') >= 0 && s.length - s.indexOf('.') - 1 > minDp && s.charAt(s.length - 1) === '0') {
      s = s.slice(0, -1);
    }
    if (s.charAt(s.length - 1) === '.') s = s.slice(0, -1);
    return s;
  }
  function q(v, minDp, maxDp) { return Number(fmtTrim(v, minDp, maxDp)); }
  /** 公式面板：量写成「中文名 + 下方数值」（与千织页同式）。 */
  function u(color, name, val) {
    return '\\textcolor{' + color + '}{\\underset{' + val + '}{\\text{' + name + '}}}';
  }
  function h(color, name) { return '\\textcolor{' + color + '}{\\text{' + name + '}}'; }

  /** 控件 state → core state（抗性系数先取显示精度，再进计算）。 */
  function coreState(s) {
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

  var FOOT =
    '单段 = 10 级「递变聚爆」消耗 1 枚递变信标的星超导雷伤 = <b>403.2% 元素精通</b>；前置 302.4% 攻击力的普通雷伤不计。' +
    '公式：<code>D = [K × 4.032 × EM × (1+B) × (1+E+S) + F] × R × C</code>，' +
    '<code>B</code> = 星超导基础提升，<code>E = 6EM/(EM+2000)</code>，<code>S</code> = 星超导增伤，' +
    '<code>F</code> = 额外提升，<code>R</code> = 雷抗系数，<code>C = 1 + 暴击率 × 暴伤</code>。' +
    '星超导无防御区；不吃雷伤杯 / 极星辉域的元素增伤。详见 ' +
    '<code>docs/ai-output/0-mechanism/5-米提亚伤害机制.md</code>。<br>' +
    '<b>归一化梯度</b> = 悬浮点两类词条的相对重要性。';

  M['mitya/dmg_map'] = {
    title: '「米提亚」伤害热图',
    tab: '米提亚·伤害热图',
    math: true,
    intro: '颜色 = 相对基准面板（0 词条）的伤害倍数；鼠标悬浮读数，点击固定所选点、复位回最优。',
    controls: [
      {
        key: '', type: 'note',
        html: '<b>基准面板</b>：上完 buff、不含副词条',
      },
      {
        key: '', type: 'note',
        html: '<b>词条口径</b>：1 词条 = ' + C.ROLL.em + ' 精通 = ' + C.ROLL.cr + '% 暴击 = ' + C.ROLL.cd + '% 暴伤。' +
          '不为配平双暴而取负词条，按实际可达的最优算。',
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
      {
        type: 'group', label: '敌人区', open: true,
        items: [
          { key: 'enemyRes', type: 'number', label: '敌人抗性 %', def: 10, step: 1, min: -100, max: 200 },
          { key: 'resShred', type: 'number', label: '减抗合计 %', def: 60, step: 1, min: 0, max: 200 },
          { key: 'asc', type: 'number', label: '擢升 %', def: 0, step: 1, min: 0, max: 100 },
        ],
      },
      { key: 'n', type: 'range', label: '词条预算', def: S.N_DEF, min: 2, max: S.N_MAX, step: 1 },
    ],

    create: function (host, ctx) {
      var charts = ctx.charts;

      /** 两维度单条分段条：左精通（青）· 右双暴（紫），数值在条上方（同瑞希悬浮卡）。 */
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
      var curP = null;
      var calcActive = null;
      var optMarks = [];   // 10 / 20 / 30 / 40 词条各自的最优点与伤害（与当前预算无关）

      function updateVerdict(rs) {
        var scan = S.scan(rs, GRID);
        var best = scan.best;
        if (pinned && (pinned.x < -1e-9 || pinned.y < -1e-9 || pinned.x + pinned.y > rs.nMax + 1e-9)) {
          pinned = null;
        }
        var p = pinned || { x: best.x, y: best.y };
        curP = { x: p.x, y: p.y };
        var det = S.detail(rs, p.x, p.y);
        var mult = det.exp / scan.base0;
        document.getElementById('vState').textContent = pinned ? '所选点' : '最优分配';
        document.getElementById('vMul').textContent = '×' + mult.toFixed(3);
        document.getElementById('vReset').hidden = !pinned;
        document.getElementById('vdmgRow').innerHTML =
          '<div class="dcell" data-part="0"><span class="dcell__k">递变聚爆</span>' +
          '<b class="dcell__v" data-k="exp">' + Math.round(det.exp) + '</b>' +
          '<span class="dcell__c"><span data-k="crit">暴击 <b>' + Math.round(det.crit) + '</b></span>、' +
          '<span data-k="noncrit">未暴击 <b>' + Math.round(det.noncrit) + '</b></span></span></div>';
        var xr = parseFloat(p.x.toFixed(1)), yr = parseFloat(p.y.toFixed(1));
        document.getElementById('bestSplit').textContent =
          '共 ' + (xr + yr).toFixed(1) + ' 词条：精通 ' + xr.toFixed(1) + ' · 双暴 ' + yr.toFixed(1) +
          '（暴击 ' + det.critRolls.toFixed(1) + '）';
        document.getElementById('cornerLine').textContent =
          '精通 ' + det.em.toFixed(0) + ' · 暴击 ' + det.cr.toFixed(1) + ' / ' + det.cd.toFixed(1);
        return scan;
      }

      function update(s0) {
        lastRaw = s0;
        hideCalc();
        var rs = coreState(s0);
        st = rs;
        var scan = updateVerdict(rs);

        var cap = rs.nMax;
        var shapes = [];
        if (pinned) {
          shapes.push({ type: 'line', x0: pinned.x, y0: 0, x1: pinned.x, y1: cap, line: { color: '#4a6fa5', width: 1.2, dash: 'dash' } });
          shapes.push({ type: 'line', x0: 0, y0: pinned.y, x1: cap, y1: pinned.y, line: { color: '#4a6fa5', width: 1.2, dash: 'dash' } });
        }
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
        var line = S.bestAllocLine(rs, 121);
        var lineX = line.xs.map(function (x) { return Math.max(x, cap * 0.002); });   // 贴左轴时向图内挪 ~1px，避免被轴线压住
        traces.push({
          type: 'scatter', mode: 'lines', x: lineX, y: line.ys, name: '最优分配线',
          line: { color: '#e8710a', width: 1.6 }, legendrank: 1,
        });
        traces.push({   // 等词条线是 shapes，不会进图例；画一段轴外线段补图例项（裁剪后不可见）
          type: 'scatter', mode: 'lines', x: [-2, -1], y: [-2, -1], name: '等词条线',
          hoverinfo: 'skip', showlegend: true,
          line: { color: '#9a9a9a', width: 1, dash: 'dot' }, legendrank: 3,
        });
        /* 10 / 20 / 30 / 40 词条各自的最优点（与当前预算无关）：标记 + 行内伤害标在叠加层 */
        optMarks = [10, 20, 30, 40].map(function (t) {
          var p = S.optAt(rs, t);
          return { n: t, x: p.x, y: p.y, dmg: S.damage(rs, p.x, p.y) };
        });
        traces.push({
          type: 'scatter', mode: 'markers',
          x: optMarks.map(function (p) { return p.x; }), y: optMarks.map(function (p) { return p.y; }),
          cliponaxis: false, showlegend: false,
          marker: { symbol: 'circle', size: 6, color: '#e8710a', line: { color: '#fff', width: 1.2 } },
        });
        traces.push({
          type: 'scatter', mode: 'markers', x: [scan.best.x], y: [scan.best.y], cliponaxis: false,
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

        var base0 = S.damage(Object.assign({}, s, { n: 0 }), 0, 0);
        if (x + y > cap + 1e-9) {   // 超过容量上限：不展示具体点，只列同比例折算到上限的数值
          var sum = x + y;
          var detF = S.detail(s, x * cap / sum, y * cap / sum);
          tip.show(
            '<div class="tip__hero"><b>' + Math.round(detF.exp) + '</b><span class="u">递变聚爆（星超导单段）</span></div>' +
            '<div class="tip__crit">暴击 ' + Math.round(detF.crit) + '、未暴击 ' + Math.round(detF.noncrit) + '</div>' +
            '<div class="tip__hero tip__hero--sm"><b>×' + (detF.exp / base0).toFixed(3) + '</b><span class="u">相对基准面板</span></div>' +
            '<div class="tip__bad">超过 ' + cap + ' 词条上限</div>',
            hoverPx.x, hoverPx.y);
          return;
        }

        var det = S.detail(s, x, y);
        var mult = det.exp / base0;
        var xr = x.toFixed(1), yr = y.toFixed(1);
        var totR = (parseFloat(xr) + parseFloat(yr)).toFixed(1);   // 按显示精度求和，印出的数可复算
        var eq = S.equiv(s, x, y);
        var rng = S.equivRange(s, 41);
        var al = S.nextAlloc(s, x, y);
        var gr = S.grad(x, y, s);
        var gsum = gr.gx + gr.gy;
        var gEm = gsum > 0 ? gr.gx / gsum : 0.5;

        var eqHTML = '';
        if (isFinite(eq.em)) {
          eqHTML = '<div class="tip__eq"><div style="font-weight:600">单位词条等效（精通 → 双暴）</div>' +
            '<div class="tip__eqr"><span class="lb">精通</span>' + eqItem(eq.em) +
            '<span class="rg">∈ [' + rng.lo.toFixed(2) + ', ' + rng.hi.toFixed(2) + ']</span></div></div>';
        }

        var html =
          '<div class="tip__hero"><b>' + Math.round(det.exp) + '</b><span class="u">递变聚爆（星超导单段）</span></div>' +
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

      /* 数字的公式面板：跟随鼠标；按所指数字选型（期望 / 暴击 / 未暴击） */
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
        var det = S.detail(s, x, y);
        if (!det) return;
        var kind = calcActive.kind;
        var kindName = kind === 'crit' ? '暴击' : kind === 'noncrit' ? '未暴击' : '期望';
        var titleVal = Math.round(kind === 'crit' ? det.crit : kind === 'noncrit' ? det.noncrit : det.exp);
        calcpopT.textContent = '递变聚爆 · ' + kindName + ' ' + titleVal;

        /* 各量先取显示精度、再逐级计算：印出的式子乘出来正好等于印出的结果。 */
        var xQ = q(x, 1, 4);
        var emQ = q(s.em + C.EM_PER_ROLL * xQ, 0, 3), emS = fmtTrim(emQ, 0, 3);
        var bOwnPctQ = q(det.bOwn * 100, 2, 4);
        var bFlatPctQ = q((s.bFlat || 0) * 100, 2, 4);
        var bQ = q(1 + bOwnPctQ / 100 + bFlatPctQ / 100, 3, 5), bS = fmtTrim(bQ, 3, 5);
        var eQ = q(C.emTerm(emQ), 3, 5), eS = fmtTrim(eQ, 3, 5);
        var sQ = q(s.bonus || 0, 2, 4);
        var bracketQ = q(1 + eQ + sQ, 3, 5);
        var kQ = q(s.k || 1, 2, 2);
        var coefQ = q(S.COEF, 3, 3);
        var coreQ = q(kQ * coefQ * emQ * bQ * bracketQ, 2, 2);
        var fQ = q(s.f || 0, 0, 2);
        var baseQ = q(coreQ + fQ, 2, 2), baseS = fmtTrim(baseQ, 2, 2);
        var resQ = q(s.res || 1, 2, 4), resS = fmtTrim(resQ, 2, 4);
        var crQ = q(Math.min(det.cr, 100) / 100, 2, 6), crS = fmtTrim(crQ, 2, 6);
        var cdQ = q(det.cd / 100, 2, 6), cdS = fmtTrim(cdQ, 2, 6);
        var zoneQ = kind === 'crit' ? q(1 + cdQ, 3, 6) : kind === 'noncrit' ? 1 : q(1 + crQ * cdQ, 3, 6);
        var ascQ = q(s.asc || 1, 2, 4), ascS = fmtTrim(ascQ, 2, 4);
        var finalQ = q(baseQ * resQ * zoneQ * ascQ, 2, 2);

        var netRes = s.netRes || 0;
        var rMark = u(C_ENEMY, '抗性', fmtTrim(netRes, 0, 4));
        var resCond, resExpr;
        if (netRes < 0) {
          resCond = '\\text{抗性} < 0';
          resExpr = '1 - ' + rMark + ' / 2';
        } else if (netRes < 0.75) {
          resCond = '0 \\le \\text{抗性} < 0.75';
          resExpr = '1 - ' + rMark;
        } else {
          resCond = '\\text{抗性} \\ge 0.75';
          resExpr = '\\frac{1}{4 \\cdot ' + rMark + ' + 1}';
        }

        var zoneTex;
        if (kind === 'crit') {           // 暴击：暴击区省去暴击率，只用 (1 + 暴击伤害)
          zoneTex = '(1+' + u(C_CD, '暴击伤害', cdS) + ')';
        } else if (kind === 'noncrit') { // 未暴击：暴击区为 1
          zoneTex = '1';
        } else {
          zoneTex = '(1+' + u(C_CR, '暴击率', crS) + '\\cdot' + u(C_CD, '暴击伤害', cdS) + ')';
        }

        var tex = '\\begin{aligned}' +
          h(C_EM, '元素精通') + ' &= ' + u(C_EM, '基准精通', fmtTrim(s.em, 0, 1)) +
          ' + ' + u(C_EM, '每条精通', fmtTrim(C.EM_PER_ROLL, 3, 3)) + ' \\times ' + u(C_EM, '精通词条', fmtTrim(xQ, 1, 4)) +
          ' = \\textcolor{' + C_EM + '}{' + emS + '}\\\\[2pt]' +
          h(C_B, '基础提升') + ' &= 1 + \\min\\left(' + u(C_B, '每点精通', fmtTrim(S.B_PER_EM * 100, 2, 4) + '\\%') +
          ' \\times ' + u(C_EM, '元素精通', emS) + ',\\,' + u(C_B, '天赋上限', fmtTrim(S.B_CAP * 100, 0, 2) + '\\%') +
          '\\right) + ' + u(C_B, '队友基础提升', fmtTrim(bFlatPctQ, 0, 4) + '\\%') +
          ' = \\textcolor{' + C_B + '}{' + bS + '}\\\\[2pt]' +
          h(C_E, '精通项') + ' &= \\frac{6 \\times ' + u(C_EM, '元素精通', emS) + '}{' +
          u(C_EM, '元素精通', emS) + ' + 2000} = \\textcolor{' + C_E + '}{' + eS + '}\\\\[2pt]' +
          h(C_BASE, '单段基础伤害') + ' &= ' + u(C_K, '星超导系数', fmtTrim(kQ, 2, 2)) + ' \\cdot ' +
          u(C_K, '天赋倍率', fmtTrim(coefQ, 3, 3)) + ' \\cdot ' + u(C_EM, '元素精通', emS) + ' \\cdot ' +
          u(C_B, '基础提升', bS) + ' \\cdot \\left(1 + ' + u(C_E, '精通项', eS) +
          ' + ' + u(C_S, '星超导增伤', fmtTrim(sQ, 2, 4)) + '\\right) + ' + u(C_F, '额外提升', fmtTrim(fQ, 0, 2)) +
          ' = \\textcolor{' + C_BASE + '}{' + baseS + '}\\\\[2pt]' +
          h(C_RES, '雷抗系数') + ' &= \\begin{cases} ' +
          '1 - \\text{抗性} / 2, & \\text{抗性} < 0, \\\\ ' +
          '1 - \\text{抗性}, & 0 \\le \\text{抗性} < 0.75, \\\\ ' +
          '1 / (4 \\cdot \\text{抗性} + 1), & \\text{抗性} \\ge 0.75. \\end{cases}' +
          '\\quad \\xlongequal{' + resCond + '} ' + resExpr +
          ' = \\textcolor{' + C_RES + '}{' + resS + '}\\\\[2pt]' +
          h(C_FINAL, '最终伤害') + ' &= ' + u(C_BASE, '单段基础伤害', baseS) + ' \\cdot ' +
          u(C_RES, '雷抗系数', resS) + ' \\cdot ' + zoneTex + ' \\cdot ' +
          u(C_ASC, '擢升', ascS) + ' = \\textcolor{' + C_FINAL + '}{' + fmtTrim(finalQ, 0, 0) + '}' +
          '\\end{aligned}';

        calcpop.style.display = 'block';
        global.katex.render(tex, calcpopM, { displayMode: true, throwOnError: false });
        placeCalc(cx, cy);
      }

      verdict.addEventListener('mouseover', function (e) {
        var num = e.target.closest && e.target.closest('[data-k]');
        var cell = num && num.closest('.dcell[data-part]');
        if (num && cell) {
          calcActive = { kind: num.getAttribute('data-k') };
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
