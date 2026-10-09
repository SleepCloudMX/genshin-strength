/* 桑多涅 · 星超导词条分配：精通 × 双暴热图（攻击吃剩余词条）+ 跟随梯度箭头。 */
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
    '武器数据（90 级）：浪影阔剑 510 / 攻击 41.3%（受治疗 +48% 攻击）；超越之匙 674 / 暴伤 44.1%（攻击 +28%、超越满层反应增伤 +48%）；' +
    '焚曜千阳 741 / 暴击 11.0%（焚光：攻击 +28%、暴伤 +20%）；苇海信标 608 / 暴击 33.1%（战技命中 + 受击各 +20% 攻击）；' +
    '狼的末路 608 / 攻击 49.6%（常驻 +20%）；无工之剑 608 / 攻击 49.6%（有盾叠满 +40%）；' +
    '螭骨剑 510 / 暴击 27.6%、赤角石溃杵 542 / 暴伤 88.2%（特效不作用于星超导，不计）。';

  M['sandrone/star_superconduct'] = {
    title: '「桑多涅」星超导词条分配',
    tab: '桑多涅·星超导分配',
    intro: '把 n 个等效词条分给精通 / 双暴 / 攻击（攻击吃剩余）：颜色 = 相对基准面板的伤害倍数，叠加倍数等高线；' +
      '鼠标在图上时，箭头指向该点<b>上升最快</b>的方向（画面空间每像素增益最大），<b>长度反映梯度大小</b>；' +
      '悬浮读该点的面板与倍数。武器横评见 <a href="#/sandrone/weapon_compare">武器对比</a>页。',
    controls: [
      {
        key: '', type: 'note',
        html: '<b>基准面板 = 上完 buff、不含副词条</b>（桑多涅 + 武器 + 攻攻暴主词条 + 羽 + 队友都算在里面）；' +
          '<b>不含套装特效</b> —— 幻灭 4 件的 +40% 增伤与条件 +16% 暴击（按全覆盖）由脚本自动加。',
      },
      {
        key: '', type: 'note',
        html: '<b>词条口径</b>：1 词条 = 20 精通 = 3.3% 暴击 = 6.6% 暴伤 = 5% 大攻击（小攻击见换算行）。' +
          '<b>攻击词条按大攻击折算</b> —— 当前基础攻击力下大攻击每词条恒优于小攻击；双暴按 1 : 2 配平（先补基准的偏斜）。',
      },
      {
        key: 'weapon', type: 'select', label: '武器', def: 'tidal',
        options: S.WEAPONS.map(function (w) {
          return { value: w.id, label: w.name + '（' + w.base + ' 基础）' };
        }),
      },
      { key: 'bonus', type: 'number', label: '反应增伤 %', def: 0, step: 1, min: 0 },
      { key: 'em', type: 'number', label: '基准精通', def: 0, step: 10, min: 0 },
      { key: 'cr', type: 'number', label: '基准暴击率 %', def: 24.2, step: 0.1, min: 0 },
      { key: 'cd', type: 'number', label: '基准暴伤 %', def: 112.2, step: 0.1, min: 50 },
      { key: 'patk', type: 'number', label: '大攻击 %', def: 0, step: 1, min: -9999 },
      { key: 'fatk', type: 'number', label: '小攻击', def: 0, step: 1, min: -9999 },
      { key: 'n', type: 'range', label: '词条预算', def: 30, min: 2, max: S.N_MAX, step: 1 },
      { key: 'baseAtk', type: 'readout', full: true, label: '基础攻击力（白值）', compute: function (s) {
        var w = S.weaponById(s.weapon);
        return (S.CHAR_BASE + w.base).toFixed(0) + '（' + S.CHAR_BASE + ' + ' + w.base + '）';
      } },
      { key: 'panelAtk', type: 'readout', full: true, label: '基准面板攻击力（计入伤害）', compute: function (s) {
        var w = S.weaponById(s.weapon);
        return S.panelAttack(w, s.patk / 100, s.fatk, 0).toFixed(0);
      } },
      { key: 'conv', type: 'readout', full: true, label: '攻击词条换算', compute: function (s) {
        var w = S.weaponById(s.weapon);
        var gain = (S.CHAR_BASE + w.base) * S.PER_ATK;
        return '大 ' + gain.toFixed(1) + ' · 小 ' + S.PER_FLAT;
      } },
      { key: 'critDisp', type: 'readout', full: true, label: '有效双暴', compute: function (s) {
        var w = S.weaponById(s.weapon);
        var cr = s.cr + S.SET_CR + w.cr, cd = s.cd + w.cd + w.extraCd;
        return cr.toFixed(1) + ' / ' + cd.toFixed(1);
      } },
    ],

    create: function (host, ctx) {
      var charts = ctx.charts;

      /* 悬浮读数与结论条共用 core 的同一套攻击力 / 伤害口径 */
      function atkOf(s, z) { return S.panelAttack(s.weapon, s.extraPct, s.extraFlat, z); }

      /** 任意 (x, y) 的伤害（不做域检查；z 可为负 —— 超出词条上限时按比例折算，
       *  倍率仍可算，同瑞希热图的域外倍数）。 */
      function dmgAny(s, x, y) {
        var z = s.n - x - y;
        var em = s.em + S.PER_EM * x;
        var bracket = 1 + GS.core.emTerm(em) + s.bonus + S.SET_BONUS;
        var t = S.critSplit(s.cr + S.SET_CR + s.weapon.cr, s.cd + s.weapon.cd + s.weapon.extraCd, y);
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

      /* 卡片小件：等效项（≥1 绿 / <1 红棕）与三维度条（精通 / 双暴 / 攻击） */
      function eqItem(name, v) {
        return '<b class="' + (v >= 1 ? 'hi' : 'lo') + '">' + (name ? name + ' ' : '') + v.toFixed(2) + '</b>';
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
        var bracket = 1 + GS.core.emTerm(em) + s.bonus + S.SET_BONUS;
        var t = S.critSplit(s.cr + S.SET_CR + s.weapon.cr, s.cd + s.weapon.cd + s.weapon.extraCd, y);
        return atkOf(s, z) * bracket * (1 + Math.min(t.cr, 100) / 100 * t.cd / 100);
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

      host.appendChild(verdict);
      host.appendChild(card);
      host.appendChild(GS.ui.panels.note(FOOT, 'pagenote'));

      var st = null;
      var hoverPx = null;

      function readState(s) {
        return {
          weapon: S.weaponById(s.weapon),
          extraPct: s.patk / 100,
          extraFlat: s.fatk,
          em: s.em, cr: s.cr, cd: s.cd,
          bonus: s.bonus / 100,
          n: s.n,
        };
      }

      function updateVerdict(rs) {          // rs = 归一化 state（readState 的输出）
        var scan = S.scan(rs, GRID);
        var best = scan.best;
        var bigGain = (S.CHAR_BASE + rs.weapon.base) * S.PER_ATK;
        var bz = rs.n - best.x - best.y;
        document.getElementById('bestMul').textContent = best.v.toFixed(3);
        document.getElementById('bestSplit').textContent =
          '精通 ' + best.x.toFixed(1) + ' · 双暴 ' + best.y.toFixed(1) + ' · 攻击 ' + bz.toFixed(1) + ' 词条';
        var t = S.critSplit(rs.cr + S.SET_CR + rs.weapon.cr, rs.cd + rs.weapon.cd + rs.weapon.extraCd, best.y);
        var emBest = rs.em + S.PER_EM * best.x;
        document.getElementById('cornerLine').textContent =
          '最优处：精通 ' + emBest.toFixed(0) + '（增伤项 ' + (GS.core.emTerm(emBest) * 100).toFixed(1) + '%）、' +
          '双暴 ' + t.cr.toFixed(1) + ' / ' + t.cd.toFixed(1) + '、攻击词条 ' + bz.toFixed(1) +
          '（+' + (bigGain * bz).toFixed(0) + ' 攻击）' +
          ' ｜ 全攻击 ×' + (dmgOf(rs, 0, 0) / scan.base0).toFixed(3) +
          '　全精通 ×' + (dmgOf(rs, rs.n, 0) / scan.base0).toFixed(3) +
          '　全双暴 ×' + (dmgOf(rs, 0, rs.n) / scan.base0).toFixed(3);
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
            '<div class="tip__bad">无法配平：超过 ' + s.n + ' 词条上限</div>', hoverPx.x, hoverPx.y, { segs: [] });
          return;
        }
        var d = dmgOf(s, x, y);
        var base0 = dmgOf(Object.assign({}, s, { n: 0 }), 0, 0);
        var z = s.n - x - y;
        var em = s.em + S.PER_EM * x;
        var t = S.critSplit(s.cr + S.SET_CR + s.weapon.cr, s.cd + s.weapon.cd + s.weapon.extraCd, y);
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
          eqHTML += '<div class="tip__eqr"><span><span class="lb">精通：</span>' + eqItem('', eq.em) + '</span>' +
            '<span class="rg">∈ [' + rng.lo.em.toFixed(2) + ', ' + rng.hi.em.toFixed(2) + ']</span></div>';
        }
        if (isFinite(eq.atk)) {
          eqHTML += '<div class="tip__eqr"><span><span class="lb">攻击：</span>' + eqItem('', eq.atk) + '</span>' +
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

      return { plot: m.plot, update: update };
    },
  };
})(typeof globalThis !== 'undefined' ? globalThis : this);
