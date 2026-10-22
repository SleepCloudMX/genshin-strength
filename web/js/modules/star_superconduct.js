/* 桑多涅 · 星超导伤害热图：精通 × 双暴热图（攻击吃剩余词条）+ 跟随梯度箭头。 */
(function (global) {
  'use strict';
  var GS = global.GS = global.GS || {};
  var M = GS.modules = GS.modules || {};
  var S = GS.core.sandrone;
  var el = GS.ui.panels.el;

  var GRID = 121;

  var FOOT =
    '星超导伤害 = 反应系数（层数）× 攻击力 × 倍率 × (1 + 天赋加伤) × (1 + 6EM/(EM+2000) + 增伤) × 抗性 × 暴击 × 擢升 —— ' +
    '见机制文档 <code>docs/ai-output/0-mechanism/3-星超导伤害机制.md</code>。<b>倍率不计入</b>，图上都是相对倍数；' +
    '反应系数（层数）、天赋加伤、抗性 / 减抗、擢升都是线性乘子，<b>不改变分配结论</b>；羽毛未计入。<br>' +
    '<b>词条预算上限 53</b> ≈ 桑多涅满档副词条容量（同瑞希 43 的算法：每件 4 条初始 + 5 次强化、满档值折算 —— ' +
    '双暴 41.4 + 大攻击 3.5 + 精通 5.8 + 小攻击 2.3 ≈ 52.9）。<br>' +
    '<b>面板攻击力 = 基础攻击力 ×（1 + 大攻击合计 + 攻击词条）+ 小攻击</b> —— 来源（角色 / 武器 / 队友 / ' +
    '圣遗物主词条与羽）全部写在参数里，逐项见各「明细」；默认参数（七七 · 木偶 · 阿罗夏 队）下基准精通 160 = ' +
    '固有天赋 2（攻击力 > 2000 时 +160，默认面板 2817 恒满足）。';

  M['sandrone/star_superconduct'] = {
    title: '「桑多涅」星超导伤害热图',
    tab: '桑多涅·伤害热图',
    intro: '把 n 个等效词条分给精通 / 双暴 / 攻击（攻击吃剩余）：颜色 = 相对基准面板的伤害倍数，叠加倍数等高线；' +
      '鼠标在图上时，箭头指向该点<b>上升最快</b>的方向（画面空间每像素增益最大），<b>长度反映梯度大小</b>；' +
      '悬浮读该点的面板与倍数；点击图面固定所选点（十字虚线），复位回最优。各词条总数下的最优面板值见 ' +
      '<a href="#/sandrone/alloc_curve">词条分配</a>页，武器横评见 <a href="#/sandrone/weapon_compare">武器对比</a>页。',
    controls: [
      {
        key: '', type: 'note',
        html: '<b>基准面板 = 上完 buff、不含副词条</b> —— 全写在参数里（角色自身、武器、队友、圣遗物）；' +
          '每个数值可点「明细」查看与编辑逐项来源。',
      },
      {
        key: '', type: 'note',
        html: '<b>词条口径</b>：1 词条 = 20 精通 = 3.3% 暴击 = 6.6% 暴伤 = 5% 大攻击（小攻击见换算行）。' +
          '<b>攻击词条按大攻击折算</b> —— 当前基础攻击力下大攻击每词条恒优于小攻击；双暴按 1 : 2 配平（先补基准的偏斜）。',
      },
      { key: 'baseAtk', type: 'items', label: '基础攻击力', step: 1, min: 0, items: [
        { n: '桑多涅 80 级突破', v: 318 },
        { n: '浪影阔剑 90 级', v: 510 }] },
      { key: 'patk', type: 'items', label: '大攻击 %', step: 0.1, min: -9999, items: [
        { n: '浪影阔剑主词条', v: 41.3 },
        { n: '浪影阔剑特效', v: 48 },
        { n: '阿罗夏 Q9', v: 20.1 },
        { n: '攻击沙', v: 46.6 },
        { n: '攻击杯', v: 46.6 }] },
      { key: 'fatk', type: 'items', label: '小攻击', step: 1, min: -9999, items: [
        { n: '羽主词条', v: 311 }] },
      { key: 'em', type: 'items', label: '基准精通', step: 10, min: 0, items: [
        { n: '固有天赋 2', v: 160 }] },
      { key: 'cr', type: 'items', label: '基准暴击率 %', step: 0.1, min: 0, items: [
        { n: '桑多涅自身', v: 24.2 },
        { n: '双冰共鸣', v: 15 },
        { n: '幻灭 4 件套', v: 16 }] },
      { key: 'cd', type: 'items', label: '基准暴伤 %', step: 0.1, min: 50, items: [
        { n: '角色基础', v: 50 },
        { n: '暴伤头', v: 62.2 }] },
      { key: 'bonus', type: 'items', label: '反应增伤 %', step: 1, min: 0, items: [
        { n: '炉火', v: 50 },
        { n: '幻灭 4 件套', v: 40 },
        { n: '阿罗夏', v: 20 },
        { n: '七七', v: 50 }] },
      { key: 'n', type: 'range', label: '词条预算', def: 30, min: 2, max: S.N_MAX, step: 1 },
      { key: 'panelAtk', type: 'readout', full: true, label: '基准面板攻击力（计入伤害）', compute: function (s) {
        return S.panelAttack(s.baseAtk, s.patk / 100, s.fatk, 0).toFixed(0);
      } },
      { key: 'conv', type: 'readout', full: true, label: '攻击词条换算', compute: function (s) {
        return '大 ' + (s.baseAtk * S.PER_ATK).toFixed(1) + ' · 小 ' + S.PER_FLAT;
      } },
    ],

    create: function (host, ctx) {
      var charts = ctx.charts;

      /* 悬浮读数与结论条共用 core 的同一套攻击力 / 伤害口径 */
      function atkOf(s, z) { return S.panelAttack(s.baseAtk, s.atkPct, s.fatk, z); }

      /** 任意 (x, y) 的伤害（不做域检查；z 可为负 —— 超出词条上限时按比例折算，
       *  倍率仍可算，同瑞希热图的域外倍数）。 */
      function dmgAny(s, x, y) {
        var z = s.n - x - y;
        var em = s.em + S.PER_EM * x;
        var bracket = 1 + GS.core.emTerm(em) + s.bonus;
        var t = S.critSplit(s.cr, s.cd, y);
        return atkOf(s, z) * bracket * (1 + Math.min(t.cr, 100) / 100 * t.cd / 100);
      }
      /** 词条上限校验：超限时按比例折算到边界（x+y = n），倍率照常算（同瑞希「超过 43 词条上限」）。 */
      function multOf(s, x, y) {
        var base0 = dmgOf(Object.assign({}, s, { n: 0 }), 0, 0);
        var sum = x + y;
        var x2 = x, y2 = y;
        if (sum > s.n) { x2 = x * s.n / sum; y2 = y * s.n / sum; }
        return dmgAny(s, x2, y2) / base0;
      }

      /* 卡片小件：等效项（≥1 绿 / <1 红棕；grp 为额外容器类）与三维度条（精通 / 双暴 / 攻击） */
      function eqItem(name, v, grp) {
        return '<span class="' + (grp || '') + '"><b class="' + (v >= 1 ? 'hi' : 'lo') + '">' +
          (name ? name + ' ' : '') + v.toFixed(2) + '</b></span>';
      }
      function triBar(w) {
        var one = function (name, cls, val) {
          return '<div class="t"><div class="k"><span class="n">' + name + '</span><span class="v">' + val.toFixed(2) +
            '</span></div><div class="b"><i class="' + cls + '" style="width:' + (Math.max(0, val) * 100).toFixed(1) + '%"></i></div></div>';
        };
        return '<div class="tip__tri">' + one('精通', 'em', w.em) + one('双暴', 'cr', w.crit) + one('攻击', 'at', w.atk) + '</div>';
      }
      function dmgOf(s, x, y) {
        var z = s.n - x - y;
        if (z < -1e-9) return null;
        var em = s.em + S.PER_EM * x;
        var bracket = 1 + GS.core.emTerm(em) + s.bonus;
        var t = S.critSplit(s.cr, s.cd, y);
        return atkOf(s, z) * bracket * (1 + Math.min(t.cr, 100) / 100 * t.cd / 100);
      }

      var verdict = el('div', 'verdict');
      verdict.innerHTML =
        '<div class="verdict__bar"><span class="verdict__st" id="vState">最优分配</span>' +
        '<span class="verdict__mul" id="vMul">—</span><span>相对基准面板</span>' +
        '<button class="verdict__reset" id="vReset" type="button" hidden>复位</button></div>' +
        '<div class="verdict__foot" id="verdict-foot"><div class="verdict__vrows">' +
        '<div class="verdict__vrow"><span class="verdict__vk">分配</span>' +
        '<span class="verdict__vv" id="bestSplit">—</span></div>' +
        '<div class="verdict__vrow"><span class="verdict__vk">面板</span>' +
        '<span class="verdict__vv" id="cornerLine">—</span></div>' +
        '<div class="verdict__vrow"><span class="verdict__vk">极端分配</span>' +
        '<span class="verdict__vv" id="extLine">—</span></div>' +
        '</div><div class="verdict__note" id="vNote"></div></div>';

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
      var pinned = null;   // 点击固定的分配点（数据坐标）；null = 结论框显示最优

      function readState(s) {
        return {
          baseAtk: s.baseAtk,
          atkPct: s.patk / 100,
          fatk: s.fatk,
          em: s.em, cr: s.cr, cd: s.cd,
          bonus: s.bonus / 100,
          n: s.n,
        };
      }

      function updateVerdict(rs) {          // rs = 归一化 state（readState 的输出）
        var scan = S.scan(rs, GRID);
        var best = scan.best;
        if (pinned && (pinned.x < -1e-9 || pinned.y < -1e-9 || pinned.x + pinned.y > rs.n + 1e-9)) {
          pinned = null;   // 预算改小后固定点越界：丢弃
        }
        var p = pinned || { x: best.x, y: best.y };
        var z = Math.max(0, rs.n - p.x - p.y);
        var em = rs.em + S.PER_EM * p.x;
        var t = S.critSplit(rs.cr, rs.cd, p.y);
        var mult = pinned ? multOf(rs, p.x, p.y) : best.v;
        document.getElementById('vState').textContent = pinned ? '所选点' : '最优分配';
        document.getElementById('vMul').textContent = '×' + mult.toFixed(3);
        document.getElementById('vReset').hidden = !pinned;
        document.getElementById('bestSplit').textContent =
          '精通 ' + p.x.toFixed(1) + ' · 双暴 ' + p.y.toFixed(1) + ' · 攻击 ' + z.toFixed(1) + ' 词条';
        document.getElementById('cornerLine').textContent =
          '精通 ' + em.toFixed(0) + ' · 暴击 ' + t.cr.toFixed(1) + ' / ' + t.cd.toFixed(1) +
          ' · 攻击 ' + atkOf(rs, z).toFixed(0);
        document.getElementById('extLine').textContent =
          '全攻击 ×' + (dmgOf(rs, 0, 0) / scan.base0).toFixed(3) +
          '　全精通 ×' + (dmgOf(rs, rs.n, 0) / scan.base0).toFixed(3) +
          '　全双暴 ×' + (dmgOf(rs, 0, rs.n) / scan.base0).toFixed(3);
        document.getElementById('vNote').innerHTML = S.critBand(rs, p.y)
          ? '<span class="bad">此时双暴 1:2 无法配平</span>' : '';
        return scan;
      }

      function update(s0) {
        var s = readState(s0);
        st = s;
        var scan = updateVerdict(s);

        var shapes = [];
        for (var c = 5; Math.ceil(c) < s.n; c += 5) {
          shapes.push({ type: 'line', x0: c, y0: 0, x1: 0, y1: c, line: { color: '#e8710a', width: 1.4, dash: 'dash' } });
        }

        var zFlat = scan.zs.flat().filter(function (v) { return v !== null; });
        var zLo = Math.min.apply(null, zFlat), zHi = Math.max.apply(null, zFlat);
        var traces = [{
          type: 'heatmap', x: scan.xs, y: scan.xs, z: scan.zs,
          colorscale: 'Viridis', zmin: 1, zmax: zHi,
          colorbar: { title: { text: '伤害倍数' }, thickness: 16, len: 0.8 },
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

        /* 配平下界（细点线，同瑞希热图）：y < bandY 时 1:2 配不平（暴伤过 2 倍暴击率、
           被压在基准）。线横贯可行域：x ∈ [0, n − bandY]。 */
        var bandY = S.bandY(s);
        var anns = [];
        if (bandY > 0.05 && bandY < s.n) {
          traces.push({
            type: 'scatter', mode: 'lines', x: [0, s.n - bandY], y: [bandY, bandY],
            line: { color: '#888', width: 1.2, dash: 'dot' }, showlegend: false,
          });
          anns.push({
            x: s.n - bandY, y: bandY, xanchor: 'right', yanchor: 'bottom',
            text: '1:2 配平不可达', showarrow: false, font: { size: 11, color: '#888' },
          });
        }
        traces.push({
          type: 'scatter', mode: 'markers', x: [scan.best.x], y: [scan.best.y],
          marker: { symbol: 'circle', size: 7, color: '#e8710a', line: { color: '#fff', width: 1.5 } },
          name: '最优',
        });

        charts.draw(m.plot, traces, {
          xaxis: charts.axis({ title: { text: '精通词条数' }, range: [0, s.n] }),
          yaxis: charts.axis({ title: { text: '双暴词条数' }, range: [0, s.n] }),
          shapes: shapes,
          annotations: anns,
          showlegend: true,
          legend: { orientation: 'h', x: 0, y: 1.06, font: { size: 12, color: charts.DIM } },
          margin: { t: 24, r: 24, b: 52, l: 60 }, height: 620,
        }).then(function () { ovl.queue(); });
      }

      /* ── 叠加层：等攻击线标签 + 跟随箭头的梯度箭头 ── */
      ovl.draw(function (g) {
        var s = st;
        if (!s) return [];
        var parts = [ctx.overlay.defs([{ id: 'ovl-arrow-g', color: '#4a6fa5' }])];
        if (pinned) {
          var px = pinned.x / s.n * g.w, py = (s.n - pinned.y) / s.n * g.h;
          parts.push('<line x1="' + px + '" y1="0" x2="' + px + '" y2="' + g.h + '" stroke="#4a6fa5" stroke-width="1.2" stroke-dasharray="6,4"/>');
          parts.push('<line x1="0" y1="' + py + '" x2="' + g.w + '" y2="' + py + '" stroke="#4a6fa5" stroke-width="1.2" stroke-dasharray="6,4"/>');
          parts.push('<line x1="' + (px - 6) + '" y1="' + py + '" x2="' + (px + 6) + '" y2="' + py + '" stroke="#4a6fa5" stroke-width="2"/>');
          parts.push('<line x1="' + px + '" y1="' + (py - 6) + '" x2="' + px + '" y2="' + (py + 6) + '" stroke="#4a6fa5" stroke-width="2"/>');
        }
        for (var c = 5; Math.ceil(c) < s.n; c += 5) {
          var lx = c * 0.82 / s.n * g.w;
          var ly = (s.n - c * 0.18) / s.n * g.h;
          ctx.overlay.text(parts, lx, ly, '攻击 ' + (s.n - c).toFixed(0), '#e8710a', 'middle');
        }
        if (hoverPx) {
          var x = hoverPx.x / g.w * s.n;
          var y = s.n - hoverPx.y / g.h * s.n;
          if (x >= 0 && y >= 0 && x + y <= s.n + 1e-9) {
            var grad = S.grad(x, y, s);
            var ax = grad.gx * s.n / g.w, ay = grad.gy * s.n / g.h;   // 每像素的 lnD 增益
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
        var x = hoverPx.x / g.w * st.n;
        var y = st.n - hoverPx.y / g.h * st.n;
        var s = st;
        if (x < 0 || y < 0) { tip.hide(); return; }
        var overLimit = x + y > s.n + 1e-9;
        if (overLimit) {   // 超过词条上限：照瑞希样式，显示倍率（按比例折算）+ 红字
          tip.show('<div class="tip__hero"><b>×' + multOf(s, x, y).toFixed(3) + '</b><span class="u">相对基准面板</span></div>' +
            '<div class="tip__bad">超过 ' + s.n + ' 词条上限</div>', hoverPx.x, hoverPx.y, { segs: [] });
          return;
        }
        var d = dmgOf(s, x, y);
        var base0 = dmgOf(Object.assign({}, s, { n: 0 }), 0, 0);
        var z = s.n - x - y;
        var em = s.em + S.PER_EM * x;
        var t = S.critSplit(s.cr, s.cd, y);
        /* 梯度箭头线段（与叠加层同一算法）——卡片避开它放 */
        var segs = [];
        var grad = S.grad(x, y, s);
        var ax = grad.gx * s.n / g.w, ay = grad.gy * s.n / g.h;
        var mag = Math.hypot(ax, ay);
        if (mag > 1e-9) {
          var tp = ctx.overlay.arrowTip(hoverPx.x, hoverPx.y, ax, ay, g,
            { len: Math.min(Math.max(mag * 60000, 9), 66) });
          segs.push([hoverPx.x, hoverPx.y, tp.tx, tp.ty]);
        }
        /* 区 2：属性 词条数 数值；区 3：单位词条等效（当前值 + 整图范围）；区 4：三维度条 */
        var eq = S.equiv(s, x, y);
        var rng = S.equivRange(s, 61);
        var eqHTML = '';
        if (isFinite(eq.em)) {
          eqHTML += '<div class="tip__eqr"><span class="lb">精通</span>' + eqItem('', eq.em, 'val') +
            '<span class="rg">∈ [' + rng.lo.em.toFixed(2) + ', ' + rng.hi.em.toFixed(2) + ']</span></div>';
        }
        if (isFinite(eq.atk)) {
          eqHTML += '<div class="tip__eqr"><span class="lb">攻击</span>' + eqItem('', eq.atk, 'val') +
            '<span class="rg">∈ [' + rng.lo.atk.toFixed(2) + ', ' + rng.hi.atk.toFixed(2) + ']</span></div>';
        }
        var alw = S.nextAlloc(s, x, y);
        var grw = S.gradWeights(s, x, y);
        var html =
          '<div class="tip__hero"><b>×' + (d / base0).toFixed(3) + '</b><span class="u">相对基准面板</span></div>' +
          '<div class="tip__hd"><span>精通</span><span class="rl">' + x.toFixed(1) + ' 词条</span><span class="vl">' + em.toFixed(0) + '</span></div>' +
          '<div class="tip__hd"><span>双暴</span><span class="rl">' + y.toFixed(1) + ' 词条</span><span class="vl">' + t.cr.toFixed(1) + ' / ' + t.cd.toFixed(1) + '</span></div>' +
          '<div class="tip__hd"><span>攻击</span><span class="rl">' + z.toFixed(1) + ' 词条</span><span class="vl">' + atkOf(s, z).toFixed(0) + '</span></div>' +
          (S.critBand(s, y) ? '<div class="tip__bad">此时双暴 1:2 无法配平</div>' : '') +
          (eqHTML ? '<div class="tip__eq"><div style="font-weight:600">单位词条等效双暴词条</div>' + eqHTML + '</div>' : '') +
          '<div class="tip__cap" style="font-weight:600">下一词条最优分配</div>' + triBar(alw) +
          '<div class="tip__cap mt" style="font-weight:600">归一化梯度</div>' + triBar(grw);
        tip.show(html, hoverPx.x, hoverPx.y, { segs: segs });
      });
      m.wrap.addEventListener('mouseleave', function () {
        hoverPx = null;
        ovl.queue();
        tip.hide();
      });
      /* 点击图面 = 把结论框固定到该点（图上画出十字虚线）；域外 / 超词条上限的点击忽略 */
      m.wrap.addEventListener('click', function (e) {
        if (!st) return;
        var p = m.pxIn(e);
        if (!p) return;
        var g = m.geom();
        var x = p.x / g.w * st.n;
        var y = st.n - p.y / g.h * st.n;
        if (x < 0 || y < 0 || x + y > st.n + 1e-9) return;
        pinned = { x: x, y: y };
        updateVerdict(st);
        ovl.queue();
      });
      document.getElementById('vReset').addEventListener('click', function () {
        if (!pinned) return;
        pinned = null;
        updateVerdict(st);
        ovl.queue();
      });

      return { plot: m.plot, update: update };
    },
  };
})(typeof globalThis !== 'undefined' ? globalThis : this);
