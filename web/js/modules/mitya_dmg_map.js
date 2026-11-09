/* 米提亚 · 伤害热图：精通 × 双暴热图（单段「递变聚爆」星超导）+ 跟随梯度箭头。 */
(function (global) {
  'use strict';
  var GS = global.GS = global.GS || {};
  var M = GS.modules = GS.modules || {};
  var C = GS.core;
  var S = C.mitya;
  var el = GS.ui.panels.el;

  var GRID = 121;

  /* 公式面板配色：同名量同色 */
  var C_EM = '#2f6f8f',
      C_B = '#7b4fa0',
      C_E = '#c05621',
      C_S = '#8f3f5f',
      C_K = '#7a6a55',
      C_BASE = '#23201a',
      C_RES = '#a0764e',
      C_CR = '#b5453c',
      C_CD = '#8f3f5f',
      C_FINAL = '#23201a';

  function fmtTrim(v, minDp, maxDp) {
    var s = v.toFixed(maxDp);
    while (s.indexOf('.') >= 0 && s.length - s.indexOf('.') - 1 > minDp && s.charAt(s.length - 1) === '0') {
      s = s.slice(0, -1);
    }
    if (s.charAt(s.length - 1) === '.') s = s.slice(0, -1);
    return s;
  }
  function q(v, minDp, maxDp) { return Number(fmtTrim(v, minDp, maxDp)); }

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
    '其中 <code>B = 1 + min(0.028% × EM, 14%) + 14%</code>（米提亚 A6 + 奥黛塔），' +
    '<code>E = 6EM/(EM+2000)</code>，<code>S</code> = 星超导增伤，<code>F</code> = 瓦列里攻斥，' +
    '<code>R</code> = 雷抗分段系数，<code>C = 1 + 暴击率 × 暴伤</code>。' +
    '星超导无防御区；不吃雷伤杯 / 极星辉域的元素增伤。详见 ' +
    '<code>docs/ai-output/0-mechanism/5-米提亚伤害机制.md</code>。<br>' +
    '<b>默认面板（幻灭 4 + 精精暴（暴击头）+ 2 命过载 + 主流队友）</b>：精通 1198 / 暴击 72.1% / 暴伤 183.5% / ' +
    '星超导增伤 168% / B 1.28 / K 1.70（6 层）/ F 2264 / 抗性系数 1.25；各项来源见参数「明细」。' +
    '基准单段伤害按 0 词条计，图上颜色与倍率均为相对该基准的倍数。<br>' +
    '<b>双暴分配</b>：只加不减；暴伤过高时先把暴击率补到 1:2 或 100%，<b>不标「配平不可达」</b>，' +
    '按实际可达的最优计算（例：基准 5% / 88.4% 只有 1 个双暴词条 → 8.3% / 88.4%）。' +
    '<b>绘图范围固定 0–47 词条</b>（花 / 羽 / 沙 / 杯 / 头的副词条容量估算 ≈ 47）；' +
    '细虚线 = 5 / 10 / … / 45 词条，橙线 = 当前预算 n（默认 30）。预算只用于最优分配与悬浮卡数值，<b>不是绘图上限</b>；' +
    '预算内外的点读数方式相同。超过 47 词条的悬浮只列同比例折算到 47 词条的数值。' +
    'K 主要缩放绝对伤害，但 F 不随 K 缩放、且会再乘暴击，K 变化会让最优分配轻微移动' +
    '（K = 1.7 → 1.0：8.9 / 21.1 → 8.1 / 21.9）。';

  M['mitya/dmg_map'] = {
    title: '「米提亚」伤害热图',
    tab: '米提亚·伤害热图',
    math: true,
    intro: '绘图范围固定 0–47 词条（细虚线 = 5 / 10 / … / 45，橙线 = 当前预算 n）：' +
      '颜色 = 相对基准面板的伤害倍数，叠加倍数等高线；最优分配按预算 n 计算（默认 30），预算只决定橙线与最优标记，不限制绘图与读数。' +
      '鼠标在图上时，箭头指向该点<b>上升最快</b>的方向，悬浮读该点的面板、倍数与词条等效；' +
      '点击图面固定所选点（十字虚线），复位回最优。单段口径 = 10 级「递变聚爆」的星超导部分（403.2% 元素精通）。',
    controls: [
      {
        key: '', type: 'note',
        html: '<b>基准面板 = 上完 buff、不含副词条</b> —— 全写在参数里（角色、武器、命座、队友、圣遗物主词条与套装）；' +
          '每个数值可点「明细」查看与编辑逐项来源。',
      },
      {
        key: '', type: 'note',
        html: '<b>词条口径</b>：1 词条 = 20 精通 = 3.3% 暴击 = 6.6% 暴伤。<b>双暴只加不减</b>：' +
          '不强行凑 1:2，不削减基准暴伤；按实际可达的最优算。',
      },
      { key: 'em', type: 'items', label: '基准精通', step: 1, min: 0, items: [
        { n: '米提亚自身', v: 100 },
        { n: '凝雪沉心 R1', v: 60 },
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
        { n: '凝雪沉心 R1', v: 55.1 },
        { n: '1 命', v: 40 }] },
      { key: 'bonus', type: 'items', label: '星超导增伤 %', step: 1, min: 0, items: [
        { n: '凝雪沉心 R1', v: 18 },
        { n: '奥黛塔华彩', v: 60 },
        { n: '炉火 4 件套', v: 50 },
        { n: '幻灭 4 件套', v: 40 }] },
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
      { key: 'kReadout', type: 'readout', full: true, label: '星超导系数 K', compute: function (s) {
        return S.kOf(s.kLayers).toFixed(2) + '（' + s.kLayers + ' 层）';
      } },
      { key: 'resReadout', type: 'readout', full: true, label: '抗性系数', compute: function (s) {
        return q(C.kappa((s.enemyRes - s.resShred) / 100), 2, 4).toFixed(4);
      } },
      { key: 'baseDmg', type: 'readout', full: true, label: '基准单段伤害（0 词条）', compute: function (s) {
        return S.damage(coreState(s), 0, 0).toFixed(0);
      } },
    ],

    create: function (host, ctx) {
      var charts = ctx.charts;

      function twoBar(w) {
        var one = function (name, cls, val) {
          return '<div class="t"><div class="k"><span class="n">' + name + '</span><span class="v">' + val.toFixed(2) +
            '</span></div><div class="b"><i class="' + cls + '" style="width:' + (Math.max(0, val) * 100).toFixed(1) + '%"></i></div></div>';
        };
        return '<div class="tip__tri">' + one('精通', 'em', w.em) + one('双暴', 'cr', w.crit) + '</div>';
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
      card.appendChild(GS.ui.panels.actionsRow(function () { return m.plot; }));

      host.appendChild(verdict);
      host.appendChild(card);
      host.appendChild(GS.ui.panels.note(FOOT, 'pagenote'));

      var st = null;
      var hoverPx = null;
      var pinned = null;
      var lastRaw = null;
      var curP = null;
      var calcActive = null;

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
        document.getElementById('bestSplit').textContent =
          '精通 ' + p.x.toFixed(1) + ' · 双暴 ' + p.y.toFixed(1) + ' 词条';
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
          shapes.push({ type: 'line', x0: 0, y0: c, x1: c, y1: 0, line: { color: '#b9b1b7', width: 1, dash: 'dot' } });
        }
        shapes.push({ type: 'line', x0: 0, y0: rs.n, x1: rs.n, y1: 0, line: { color: '#e8710a', width: 1.8 } });

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

      /** 可行的上升方向：在物理边界（nMax）上时投影到 (1,−1) / (−1,1)；否则直接用梯度。 */
      function feasibleGrad(s, x, y) {
        var g = S.grad(x, y, s);
        var gx = g.gx, gy = g.gy;
        var cap = s.nMax || s.n;
        if (x + y >= cap - 1e-9) {
          var d = gx - gy;
          if (Math.abs(d) < 1e-12) return { gx: 0, gy: 0 };
          var dirX = d > 0 ? 1 : -1;
          var dirY = -dirX;
          if ((dirX < 0 && x <= 1e-9) || (dirY < 0 && y <= 1e-9)) return { gx: 0, gy: 0 };
          return { gx: dirX * Math.abs(d), gy: dirY * Math.abs(d) };
        }
        return { gx: gx, gy: gy };
      }

      ovl.draw(function (g) {
        var s = st;
        if (!s) return [];
        var cap = s.nMax || s.n;
        var parts = [ctx.overlay.defs([{ id: 'ovl-arrow-g', color: '#4a6fa5' }])];
        if (pinned) {
          var px = pinned.x / cap * g.w, py = (cap - pinned.y) / cap * g.h;
          parts.push('<line x1="' + px + '" y1="0" x2="' + px + '" y2="' + g.h + '" stroke="#4a6fa5" stroke-width="1.2" stroke-dasharray="6,4"/>');
          parts.push('<line x1="0" y1="' + py + '" x2="' + g.w + '" y2="' + py + '" stroke="#4a6fa5" stroke-width="1.2" stroke-dasharray="6,4"/>');
          parts.push('<line x1="' + (px - 6) + '" y1="' + py + '" x2="' + (px + 6) + '" y2="' + py + '" stroke="#4a6fa5" stroke-width="2"/>');
          parts.push('<line x1="' + px + '" y1="' + (py - 6) + '" x2="' + px + '" y2="' + (py + 6) + '" stroke="#4a6fa5" stroke-width="2"/>');
        }
        for (var c = 5; c < cap; c += 5) {
          if (Math.abs(c - s.n) < 1e-9) continue;
          var lx = c * 0.78 / cap * g.w, ly = (cap - c * 0.22) / cap * g.h;
          ctx.overlay.text(parts, lx, ly, String(c), '#888', 'middle');
        }
        ctx.overlay.text(parts, s.n * 0.78 / cap * g.w, (cap - s.n * 0.22) / cap * g.h,
          '预算 ' + s.n, '#e8710a', 'middle');
        if (hoverPx) {
          var x = hoverPx.x / g.w * cap;
          var y = cap - hoverPx.y / g.h * cap;
          if (x >= 0 && y >= 0 && x + y <= cap + 1e-9) {
            var grad = feasibleGrad(s, x, y);
            var ax = grad.gx * cap / g.w, ay = grad.gy * cap / g.h;
            var mag = Math.hypot(ax, ay);
            if (mag > 1e-9) {
              ctx.overlay.arrow(parts, hoverPx.x, hoverPx.y, ax, ay, g, {
                color: '#4a6fa5', width: 1.8, marker: 'ovl-arrow-g',
                len: Math.min(Math.max(mag * 60000, 9), 66),
              });
            }
          }
        }
        return parts;
      });

      m.wrap.addEventListener('mousemove', function (e) {
        hoverPx = m.pxIn(e);
        ovl.queue();
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
            hoverPx.x, hoverPx.y, { segs: [] });
          return;
        }

        var det = S.detail(s, x, y);
        var mult = det.exp / base0;
        var eq = S.equiv(s, x, y);
        var rng = S.equivRange(s, 41);
        var gw = S.gradWeights(s, x, y);

        /* 梯度箭头线段（与叠加层同一算法）——卡片避开它放 */
        var segs = [];
        var gr = feasibleGrad(s, x, y);
        var ax = gr.gx * cap / g.w, ay = gr.gy * cap / g.h;
        var mag = Math.hypot(ax, ay);
        if (mag > 1e-9) {
          var tp = ctx.overlay.arrowTip(hoverPx.x, hoverPx.y, ax, ay, g,
            { len: Math.min(Math.max(mag * 60000, 9), 66) });
          segs.push([hoverPx.x, hoverPx.y, tp.tx, tp.ty]);
        }

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
          '<div class="tip__hd"><span>精通</span><span class="rl">' + x.toFixed(1) + ' 词条</span><span class="vl">' + det.em.toFixed(0) + '</span></div>' +
          '<div class="tip__hd"><span>双暴</span><span class="rl">' + y.toFixed(1) + ' 词条</span><span class="vl">' + det.cr.toFixed(1) + ' / ' + det.cd.toFixed(1) + '</span></div>' +
          (S.critSplit(s.cr, s.cd, y).cr >= 100 - 1e-9 ? '<div class="tip__cap">暴击率已封顶；超出部分全进暴伤</div>' : '') +
          eqHTML +
          (gw && !gw.best
            ? '<div class="tip__cap mt" style="font-weight:600">可提升方向</div>' + twoBar(gw)
            : '<div class="tip__cap mt" style="font-weight:600">当前点已最优</div>');
        tip.show(html, hoverPx.x, hoverPx.y, { segs: segs });
      });
      m.wrap.addEventListener('mouseleave', function () {
        hoverPx = null;
        ovl.queue();
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

        var emQ = q(det.em, 0, 1);
        var bOwnPctQ = q(det.bOwn * 100, 2, 4);
        var bFlatPctQ = q((s.bFlat || 0) * 100, 2, 4);
        var bQ = q(det.b, 3, 5);
        var eQ = q(det.e, 3, 5);
        var sQ = q(s.bonus || 0, 2, 4);
        var bracketQ = q(1 + eQ + sQ, 3, 5);
        var kQ = q(s.k || 1, 2, 2);
        var coefQ = q(S.COEF, 3, 3);
        var coreQ = q(kQ * coefQ * emQ * bQ * bracketQ, 2, 2);
        var fQ = q(s.f || 0, 0, 2);
        var baseQ = q(coreQ + fQ, 2, 2);
        var resQ = q(s.res || 1, 2, 4);
        var crQ = q(det.cr / 100, 2, 5);
        var cdQ = q(det.cd / 100, 2, 5);
        var critQ = kind === 'crit' ? q(1 + cdQ, 3, 5) : kind === 'noncrit' ? 1 : q(1 + crQ * cdQ, 3, 5);
        var ascQ = q(s.asc || 1, 2, 4);
        var finalQ = q(baseQ * resQ * critQ * ascQ, 2, 2);
        var netRes = s.netRes || 0;
        var netResPct = q(netRes * 100, 0, 2);
        var resTex;
        if (netRes < 0) {
          resTex = '1 - \\frac{' + fmtTrim(netResPct, 0, 2) + '\\%}{2}';
        } else if (netRes < 0.75) {
          resTex = '1 - ' + fmtTrim(netResPct, 0, 2) + '\\%';
        } else {
          resTex = '\\frac{1}{4 \\times ' + fmtTrim(q(netRes, 2, 4), 2, 4) + ' + 1}';
        }

        var critTex;
        if (kind === 'crit') {
          critTex = '1 + \\textcolor{' + C_CD + '}{' + fmtTrim(cdQ, 2, 5) + '} = \\textcolor{' + C_FINAL + '}{' + fmtTrim(critQ, 3, 5) + '}';
        } else if (kind === 'noncrit') {
          critTex = '1';
        } else {
          critTex = '1 + \\textcolor{' + C_CR + '}{' + fmtTrim(crQ, 2, 5) + '} \\times \\textcolor{' + C_CD + '}{' + fmtTrim(cdQ, 2, 5) + '} = \\textcolor{' + C_FINAL + '}{' + fmtTrim(critQ, 3, 5) + '}';
        }

        var tex = '\\begin{aligned}' +
          '\\textcolor{' + C_EM + '}{EM} &= ' + fmtTrim(s.em, 0, 1) + ' + 20 \\times ' + fmtTrim(x, 1, 2) +
          ' = \\textcolor{' + C_EM + '}{' + fmtTrim(emQ, 0, 1) + '}\\\\[2pt]' +
          '\\textcolor{' + C_B + '}{B} &= 1 + \\textcolor{' + C_B + '}{' + fmtTrim(bOwnPctQ, 2, 4) + '\\%} + ' +
          fmtTrim(bFlatPctQ, 2, 4) + '\\% = \\textcolor{' + C_B + '}{' + fmtTrim(bQ, 3, 5) + '}\\\\[2pt]' +
          '\\textcolor{' + C_E + '}{E} &= \\frac{6 \\times ' + fmtTrim(emQ, 0, 1) + '}{' + fmtTrim(emQ, 0, 1) + ' + 2000} = ' +
          '\\textcolor{' + C_E + '}{' + fmtTrim(eQ, 3, 5) + '}\\\\[2pt]' +
          '\\textcolor{' + C_S + '}{S} &= \\textcolor{' + C_S + '}{' + fmtTrim(sQ, 2, 4) + '}' +
          '\\quad \\textcolor{' + C_K + '}{K} = \\textcolor{' + C_K + '}{' + fmtTrim(kQ, 2, 2) + '}' +
          '\\quad \\text{倍率} = ' + fmtTrim(coefQ, 3, 3) + '\\\\[2pt]' +
          '\\textcolor{' + C_BASE + '}{基础} &= K \\times 4.032 \\times EM \\times (1+B) \\times (1+E+S) + F\\\\' +
          '&= ' + fmtTrim(kQ, 2, 2) + ' \\times ' + fmtTrim(coefQ, 3, 3) + ' \\times ' + fmtTrim(emQ, 0, 1) +
          ' \\times ' + fmtTrim(bQ, 3, 5) + ' \\times ' + fmtTrim(bracketQ, 3, 5) +
          ' + ' + fmtTrim(fQ, 0, 2) + ' = \\textcolor{' + C_BASE + '}{' + fmtTrim(baseQ, 2, 2) + '}\\\\[2pt]' +
          '\\textcolor{' + C_RES + '}{R} &= ' + resTex + ' = ' +
          '\\textcolor{' + C_RES + '}{' + fmtTrim(resQ, 2, 4) + '}\\\\[2pt]' +
          '\\textcolor{' + C_FINAL + '}{C} &= ' + critTex + '\\\\[2pt]' +
          '\\textcolor{' + C_FINAL + '}{最终} &= \\textcolor{' + C_BASE + '}{' + fmtTrim(baseQ, 2, 2) + '} \\times ' +
          '\\textcolor{' + C_RES + '}{' + fmtTrim(resQ, 2, 4) + '} \\times ' +
          '\\textcolor{' + C_FINAL + '}{' + fmtTrim(critQ, 3, 5) + '} \\times ' + fmtTrim(ascQ, 2, 4) +
          ' = \\textcolor{' + C_FINAL + '}{' + fmtTrim(finalQ, 2, 2) + '}' +
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
