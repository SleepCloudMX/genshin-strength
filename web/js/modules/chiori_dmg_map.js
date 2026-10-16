/* 千织 · 伤害热图：防御 × 双暴热图（攻击吃剩余词条）+ 跟随梯度箭头。 */
(function (global) {
  'use strict';
  var GS = global.GS = global.GS || {};
  var M = GS.modules = GS.modules || {};
  var S = GS.core.chiori;
  var el = GS.ui.panels.el;

  var GRID = 121;

  var FOOT =
    '「袖」斩切 10 级伤害 = (1.48 × 攻击力 + 1.85 × 防御力) × (1 + 伤害加成) × 暴击区；' +
    '各部件（斩切 / 上挑 / 大招）的防御系数恒为攻击系数的 1.25 倍，只看斩切即可代表整体 —— ' +
    '见机制文档 <code>docs/ai-output/0-mechanism/4-千织伤害机制.md</code>。<b>敌人防御 / 岩抗系数是公共乘数，不计入</b>，图上都是相对倍数。<br>' +
    '<b>词条预算上限 50</b> ≈ 千织满档副词条容量（逐件按主词条占用后的可用副词条满值折算，估算 ≈ 50.6，取 50）。<br>' +
    '<b>默认参数（千织 80 级突破 + 黎明神剑 R5 + 剧团防岩爆）</b>：来源逐项见各「明细」；' +
    '伤害加成 136.6% = 锦上添花 20% + 黄金剧团 4 件套 70%（后台满层）+ 岩伤杯 46.6%。';

  M['chiori/dmg_map'] = {
    title: '「千织」伤害热图',
    tab: '千织·伤害热图',
    intro: '把 n 个等效词条分给防御 / 双暴 / 攻击（攻击吃剩余）：颜色 = 相对基准面板的伤害倍数，叠加倍数等高线；' +
      '鼠标在图上时，箭头指向该点<b>上升最快</b>的方向（画面空间每像素增益最大），<b>长度反映梯度大小</b>；' +
      '悬浮读该点的面板与倍数。各词条总数下的最优面板值见 ' +
      '<a href="#/chiori/alloc_curve">词条分配</a>页，武器横评见 <a href="#/chiori/weapon_compare">武器对比</a>页。',
    controls: [
      {
        key: '', type: 'note',
        html: '<b>基准面板 = 上完 buff、不含副词条</b> —— 全写在参数里（角色自身、武器、队友、圣遗物）；' +
          '每个数值可点「明细」查看与编辑逐项来源。',
      },
      {
        key: '', type: 'note',
        html: '<b>词条口径</b>：1 词条 = 5% 大攻击 = 6.2% 大防御 = 3.3% 暴击 = 6.6% 暴伤（小攻击 / 小防御见换算行）。' +
          '<b>攻击 / 防御词条按各自大词条折算</b>；双暴按 1 : 2 配平（先补基准的偏斜）。',
      },
      { key: 'baseAtk', type: 'items', label: '基础攻击力', step: 1, min: 0, items: [
        { n: '千织 80 级突破', v: 300 },
        { n: '黎明神剑 R5', v: 401 }] },
      { key: 'baseDef', type: 'items', label: '基础防御力', step: 1, min: 0, items: [
        { n: '千织 80 级突破', v: 886 }] },
      { key: 'patk', type: 'items', label: '大攻击 %', step: 0.1, min: -9999, items: [] },
      { key: 'pdef', type: 'items', label: '大防御 %', step: 0.1, min: -9999, items: [
        { n: '防御沙', v: 58.3 }] },
      { key: 'fatk', type: 'items', label: '小攻击', step: 1, min: -9999, items: [
        { n: '羽主词条', v: 311 }] },
      { key: 'fdef', type: 'items', label: '小防御', step: 1, min: -9999, items: [] },
      { key: 'cr', type: 'items', label: '基准暴击率 %', step: 0.1, min: 0, items: [
        { n: '千织自身', v: 5 },
        { n: '80 级突破', v: 19.2 },
        { n: '黎明神剑特效', v: 28 }] },
      { key: 'cd', type: 'items', label: '基准暴伤 %', step: 0.1, min: 50, items: [
        { n: '角色基础', v: 50 },
        { n: '暴伤头', v: 62.2 },
        { n: '黎明神剑', v: 46.9 }] },
      { key: 'bonus', type: 'items', label: '伤害加成 %', step: 1, min: 0, items: [
        { n: '锦上添花', v: 20 },
        { n: '黄金剧团 4 件套', v: 70 },
        { n: '岩伤杯', v: 46.6 }] },
      { key: 'n', type: 'range', label: '词条预算', def: 30, min: 2, max: S.N_MAX, step: 1 },
      { key: 'panelAtk', type: 'readout', full: true, label: '基准面板攻击力（计入伤害）', compute: function (s) {
        return S.panelAtk(s.baseAtk, s.patk / 100, s.fatk, 0).toFixed(0);
      } },
      { key: 'panelDef', type: 'readout', full: true, label: '基准面板防御力', compute: function (s) {
        return S.panelDef(s.baseDef, s.pdef / 100, s.fdef, 0).toFixed(0);
      } },
      { key: 'convA', type: 'readout', full: true, label: '攻击词条换算', compute: function (s) {
        return '大 ' + (s.baseAtk * S.PER_ATK).toFixed(1) + ' · 小 ' + S.PER_FLAT;
      } },
      { key: 'convD', type: 'readout', full: true, label: '防御词条换算', compute: function (s) {
        return '大 ' + (s.baseDef * S.PER_DEF).toFixed(1) + ' · 小 ' + S.PER_FLAT_DEF;
      } },
    ],

    create: function (host, ctx) {
      var charts = ctx.charts;

      /* 悬浮读数与结论条共用 core 的同一套面板 / 伤害口径 */
      function atkOf(s, z) { return S.panelAtk(s.baseAtk, s.atkPct, s.fatk, z); }
      function defOf(s, w) { return S.panelDef(s.baseDef, s.defPct, s.fdef, w); }

      /** 任意 (x, y) 的伤害（不做域检查；z 可为负 —— 超出词条上限时按比例折算，倍率仍可算）。 */
      function dmgAny(s, x, y) {
        var z = s.n - x - y;
        var crit = S.critSplit(s.cr, s.cd, y);
        return (S.E_COEF_ATK * atkOf(s, z) + S.E_COEF_DEF * defOf(s, x)) * (1 + s.bonus) *
          (1 + Math.min(crit.cr, 100) / 100 * crit.cd / 100);
      }
      /** 词条上限校验：超限时按比例折算到边界（x + y = n）。 */
      function multOf(s, x, y) {
        var base0 = dmgOf(Object.assign({}, s, { n: 0 }), 0, 0);
        var sum = x + y;
        var x2 = x, y2 = y;
        if (sum > s.n) { x2 = x * s.n / sum; y2 = y * s.n / sum; }
        return dmgAny(s, x2, y2) / base0;
      }

      /* 卡片小件：等效项（≥1 绿 / <1 红棕）与三维度条（防御 / 双暴 / 攻击） */
      function eqItem(name, v) {
        return '<span class="val"><b class="' + (v >= 1 ? 'hi' : 'lo') + '">' +
          (name ? name + ' ' : '') + v.toFixed(2) + '</b></span>';
      }
      function triBar(w) {
        var one = function (name, cls, val) {
          return '<div class="t"><div class="k"><span class="n">' + name + '</span><span class="v">' + val.toFixed(2) +
            '</span></div><div class="b"><i class="' + cls + '" style="width:' + (Math.max(0, val) * 100).toFixed(1) + '%"></i></div></div>';
        };
        return '<div class="tip__tri">' + one('防御', 'em', w.def) + one('双暴', 'cr', w.crit) + one('攻击', 'at', w.atk) + '</div>';
      }
      function dmgOf(s, x, y) {
        var z = s.n - x - y;
        if (z < -1e-9) return null;
        var crit = S.critSplit(s.cr, s.cd, y);
        return (S.E_COEF_ATK * atkOf(s, z) + S.E_COEF_DEF * defOf(s, x)) * (1 + s.bonus) *
          (1 + Math.min(crit.cr, 100) / 100 * crit.cd / 100);
      }

      var verdict = el('div', 'verdict');
      verdict.innerHTML =
        '<div class="verdict__hero">最优分配下的伤害 = 基准面板 × <b id="bestMul">—</b></div>' +
        '<div class="verdict__who" id="bestSplit">—</div>' +
        '<div class="verdict__sub" id="cornerLine">—</div>';

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

      function readState(s) {
        return {
          baseAtk: s.baseAtk,
          atkPct: s.patk / 100,
          baseDef: s.baseDef,
          defPct: s.pdef / 100,
          fatk: s.fatk, fdef: s.fdef,
          cr: s.cr, cd: s.cd,
          bonus: s.bonus / 100,
          n: s.n,
        };
      }

      function updateVerdict(rs) {          // rs = 归一化 state
        var scan = S.scan(rs, GRID);
        var best = scan.best;
        var bz = Math.max(0, rs.n - best.x - best.y);
        document.getElementById('bestMul').textContent = best.v.toFixed(3);
        document.getElementById('bestSplit').textContent =
          '防御 ' + best.x.toFixed(1) + ' · 双暴 ' + best.y.toFixed(1) + ' · 攻击 ' + bz.toFixed(1) + ' 词条';
        var t = S.critSplit(rs.cr, rs.cd, best.y);
        var defBest = defOf(rs, best.x);
        document.getElementById('cornerLine').textContent =
          '最优处：防御力 ' + defBest.toFixed(0) + '、双暴 ' + t.cr.toFixed(1) + ' / ' + t.cd.toFixed(1) +
          '、攻击词条 ' + bz.toFixed(1) + '（+' + (rs.baseAtk * S.PER_ATK * bz).toFixed(0) + ' 攻击）' +
          ' ｜ 全防御 ×' + (dmgOf(rs, rs.n, 0) / scan.base0).toFixed(3) +
          '　全双暴 ×' + (dmgOf(rs, 0, rs.n) / scan.base0).toFixed(3) +
          '　全攻击 ×' + (dmgOf(rs, 0, 0) / scan.base0).toFixed(3);
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
          xaxis: charts.axis({ title: { text: '防御词条数' }, range: [0, s.n] }),
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
            var ax = grad.gx * s.n / g.w, ay = grad.gy * s.n / g.h;
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
        if (overLimit) {   // 超过词条上限：显示倍率（按比例折算）+ 红字
          tip.show('<div class="tip__hero"><b>×' + multOf(s, x, y).toFixed(3) + '</b><span class="u">相对基准面板</span></div>' +
            '<div class="tip__bad">超过 ' + s.n + ' 词条上限</div>', hoverPx.x, hoverPx.y, { segs: [] });
          return;
        }
        var d = dmgOf(s, x, y);
        var base0 = dmgOf(Object.assign({}, s, { n: 0 }), 0, 0);
        var z = s.n - x - y;
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
        if (isFinite(eq.def)) {
          eqHTML += '<div class="tip__eqr"><span class="lb">防御</span>' + eqItem('', eq.def) +
            '<span class="rg">∈ [' + rng.lo.def.toFixed(2) + ', ' + rng.hi.def.toFixed(2) + ']</span></div>';
        }
        if (isFinite(eq.atk)) {
          eqHTML += '<div class="tip__eqr"><span class="lb">攻击</span>' + eqItem('', eq.atk) +
            '<span class="rg">∈ [' + rng.lo.atk.toFixed(2) + ', ' + rng.hi.atk.toFixed(2) + ']</span></div>';
        }
        var alw = S.nextAlloc(s, x, y);
        var grw = S.gradWeights(s, x, y);
        var html =
          '<div class="tip__hero"><b>×' + (d / base0).toFixed(3) + '</b><span class="u">相对基准面板</span></div>' +
          '<div class="tip__hd"><span>防御</span><span class="rl">' + x.toFixed(1) + ' 词条</span><span class="vl">' + defOf(s, x).toFixed(0) + '</span></div>' +
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

      return { plot: m.plot, update: update };
    },
  };
})(typeof globalThis !== 'undefined' ? globalThis : this);
