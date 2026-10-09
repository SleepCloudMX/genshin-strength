/* 瑞希 · 精通 × 双暴分的伤害热图：等高线 / 最优分配线 / 等词条线 / 固定点 / 悬浮双箭头。 */
(function (global) {
  'use strict';
  var GS = global.GS = global.GS || {};
  var M = GS.modules = GS.modules || {};
  var C = GS.core;
  var Mi = GS.core.mizuki;
  var el = GS.ui.panels.el;

  var GRID = 201;
  var fmt1 = function (v) { return v.toFixed(1); };
  var pct2 = function (v) { return (v * 100).toFixed(2) + '%'; };

  var FOOT =
    '<b>图上</b>：颜色 = 倍数；灰 = 配不出（只有「超过 43 词条」一种，卡片会红字说明）；细点线 = 1:2 配平可达下界，以下能配但配不平' +
    '（基准的偏斜还没补完）；橙色实线 = 最优分配线（每个词条数 n 的最优位置；线上「词条重要性」恰为 0.50 · 0.50；与「最优分配」页的最优路径一致）；' +
    '橙色虚线 = 等词条线（10 / 20 / 30 / 40 词条的预算线；右上遮罩边的灰虚线是 43 词条上限），与橙色实线的交点 = 该词条数下的精确最优拆分，' +
    '交点标出该点的倍数（相较 0 词条）。<br>' +
    '<b>数值</b>：倍数 = 该点伤害 ÷ 基准面板的伤害，基准点 ×1.00；卡片与固定框里的另一个是固定参照「589 精通、5% 暴击、50% 暴伤、增伤 0%」之比，' +
    '跨配置可比（占比 &lt; 100% 时需在相同占比下比较）。参照面板按「同一敌人、<b>不减抗、无基础提升、不擢升</b>」计，配置级的差由面板底部四项补上、' +
    '只进这个参照数（本配置的减抗收益 = κ(r₀ − S) / κ(r₀)，口径同<a href="#/basics/resistance">「抗性区」页</a>）。' +
    '每点都假设双暴已按约束最优配平；1 词条 = 20 精通 = 3.3% 暴击 = 6.6% 暴伤。<br>' +
    '<b>操作</b>：悬浮即出卡片与双箭头（卡片自动避开箭头）；点击固定该点，chip 两行 —— ' +
    '<b>归一化梯度</b>（钢蓝，即卡片里的「词条重要性」）与<b>最优的分配</b>（黑）。' +
    '<b>黑（主）</b> = 「下一词条」的最优分配方向（只拆新的一条：α·20 精通 + (1−α)·6.6 双暴，已有词条不动）；' +
    '<b>钢蓝（次）</b> = 梯度方向（画面空间每像素增益最大，⊥ 等高线）。两箭头都按两轴刻度映射、长度固定、只指示方向。<br>' +
    '轴的范围 = 基准 → 上限（+420 精通 / +43 词条）。';

  // 色带：viridis（顺序色标）
  var COLORSCALE = [
    [0.000, '#440154'], [0.111, '#482878'], [0.222, '#3e4989'], [0.333, '#31688e'],
    [0.444, '#26828e'], [0.556, '#1f9e89'], [0.667, '#35b779'], [0.778, '#6ece58'],
    [0.889, '#b8de29'], [1.000, '#fde725'],
  ];

  M['mizuki/em_crit_map'] = {
    title: '「梦见月瑞希」精通 & 双暴的伤害热图',
    tab: '瑞希·伤害热图',
    intro: '橙实线 = 最优分配线，橙虚线 = 等词条线，交点 = 该词条数下的最优拆分。悬浮出卡片与双箭头，点击固定该点。',
    controls: [
      {
        key: '', type: 'note',
        html: '<b>基准面板 = 上完 buff、不含副词条</b>（主词条、武器、天赋、队友给的都算在基准里）—— 副词条正是这里要分配的东西。',
      },
      {
        key: '', type: 'note',
        html: '<b>星扩散伤害 = 星扩散直伤（大头）+ 反应星扩散</b>。<b>星扩散直伤占比</b>：给定的假定常数（按基准分配处定义），' +
          '计算中直接采用；本页<b>不</b>根据你的配置推算真实占比（实测约九成，见<a href="#/mizuki/stellar_swirl#share">机制页</a>）。' +
          '默认 90%；拉到 100% = 只看星扩散直伤。',
      },
      { key: 'bonus', type: 'number', label: '星扩散增伤 %', def: 130, step: 5, min: 0 },
      { key: 'em', type: 'number', label: '基准精通', def: 951, step: 10, min: 589 },
      { key: 'cr', type: 'number', label: '基准暴击率 %', def: 36, step: 0.1, min: 5 },
      { key: 'cd', type: 'number', label: '基准暴伤 %', def: 112.2, step: 0.1, min: 50 },
      { key: 'score', type: 'readout', label: '双暴分', compute: function (s) { return C.f(C.baseScore(s.cr, s.cd), 1); } },
      { key: 'd', type: 'range', label: '星扩散直伤占比', def: 90, min: 0, max: 100, step: 1, unit: '%' },
      {
        key: '', type: 'note', sep: true,
        html: '<b>配置级独立乘区</b>：本页的「倍数」（颜色、相较 0 词条）都是同一配置内部的比值，这几项在分子分母里一样、会<b>约掉</b>；' +
          '只有卡片与固定框里那个<b>跨配置参照数</b>用到它们。参照面板按「<b>同一敌人、不减抗、无基础提升、不擢升</b>」计 —— ' +
          '两支减抗不同的队伍各自填上自己的减抗，参照数才可比。抗性系数 κ(r) 的分段口径同<a href="#/basics/resistance">「抗性区」页</a>。',
      },
      { key: 'base', type: 'number', label: '基础提升 %', def: 0, step: 1, min: 0 },
      { key: 'asc', type: 'number', label: '擢升 ×', def: 1, step: 0.05, min: 1 },
      { key: 'shred', type: 'number', label: '减抗 %', def: 0, step: 5, min: 0 },
      { key: 'res', type: 'number', label: '敌人抗性 %', def: 10, step: 10 },
    ],

    create: function (host, ctx) {
      var charts = ctx.charts;

      /* ── 固定点框（结论条，居中列、图上方） ── */
      var verdict = el('div', 'verdict');
      verdict.innerHTML =
        '<div class="verdict__hero" id="pin-mult">—</div>' +
        '<div class="verdict__sub" id="pin-ref"></div>' +
        '<div class="verdict__who" id="pin-who">点图上任意位置，固定一个点。</div>' +
        '<div class="v-grid" id="pin-grid" style="display:none">' +
          '<span class="k">配平后</span><span id="pin-split"></span>' +
          '<span class="k">词条</span><span id="pin-rolls"></span>' +
          '<span class="k">下一词条</span><span id="pin-next"></span>' +
        '</div>' +
        '<div class="verdict__sub" id="pin-note"></div>';

      var card = el('div', 'card chartcard');
      var m = charts.mount(card, { height: 620 });
      var chip = el('div', 'chip');
      var ovl = ctx.overlay.mount(m.wrap, m.geom);
      ovl.el.appendChild(chip);
      var tip = ctx.tip.mount(m.wrap, m.geom);

      host.appendChild(verdict);
      host.appendChild(card);
      host.appendChild(GS.ui.panels.note(FOOT, 'pagenote'));

      var pin = null;        // 固定点（数据坐标）
      var hoverPx = null;    // 悬浮位置（相对绘图区的像素）
      var cache = { key: null, base: null };
      var st = null;

      function readState(s) {
        return {
          bonus: s.bonus / 100, em: s.em, cr: s.cr, cd: s.cd,
          d: s.d / 100,
          base: s.base / 100, asc: s.asc, shred: s.shred / 100, res: s.res / 100,
        };
      }

      /* ── 基础图层（按输入缓存） ── */
      function buildBase(s) {
        var x0 = s.em, x1 = s.em + Mi.EM_ADD_MAX;
        var y0 = C.baseScore(s.cr, s.cd), y1 = y0 + Mi.ROLL_LIMIT * C.SCORE_PER_ROLL;
        var ems = [], scores = [];
        for (var i = 0; i < GRID; i++) ems.push(x0 + (x1 - x0) * i / (GRID - 1));
        for (var j = 0; j < GRID; j++) scores.push(y0 + (y1 - y0) * j / (GRID - 1));

        var raw = [], reasons = [];
        var lo = Infinity, hi = -Infinity;
        scores.forEach(function (y) {
          var rowZ = [], rowR = [];
          ems.forEach(function (x) {
            var reason = Mi.mapInfeasible(x, y, s);
            rowR.push(reason);
            if (reason) { rowZ.push(null); return; }
            var v = Mi.multiplier(x, y, s);
            if (v < lo) lo = v;
            if (v > hi) hi = v;
            rowZ.push(v);
          });
          raw.push(rowZ); reasons.push(rowR);
        });

        var traces = [{
          type: 'heatmap', x: ems, y: scores, z: raw,
          colorscale: COLORSCALE, zmin: lo, zmax: hi,
          colorbar: {
            title: { text: '倍数（相对基准）' }, thickness: 16, len: 0.75,
            tickvals: [lo, (lo + hi) / 2, hi],
            ticktext: [lo, (lo + hi) / 2, hi].map(function (v) { return v.toFixed(2); }),
          },
        }];

        // 等高线：0.2 一档，起点按可达域取整
        var lvlStart = Math.ceil((lo + 1e-9) / 0.2) * 0.2;
        traces.push({
          type: 'contour', x: ems, y: scores, z: raw,
          contours: { coloring: 'none', showlabels: true, labelfont: { size: 11, color: '#666' }, start: lvlStart, end: hi, size: 0.2 },
          line: { color: '#555', width: 1.2, smoothing: 1 },
          name: '等高线', showscale: false, showlegend: true, legendrank: 2,
        });

        // 遮罩层（浅灰）：可配处为 null（透明）
        traces.push({
          type: 'heatmap', x: ems, y: scores,
          z: reasons.map(function (row) { return row.map(function (r) { return r ? 1 : null; }); }),
          colorscale: [[0, '#ededed'], [1, '#ededed']], showscale: false, showlegend: false,
        });

        var lc = Mi.lineAndCrosses(s, GRID);

        // 等词条线（橙色虚线；与橙色实线的交点 = 该词条数下的精确最优拆分）
        var isoX = [], isoY = [];
        Mi.ISO_ROLLS.forEach(function (nR) {
          var xa = x0, ya = y0 + nR * C.SCORE_PER_ROLL;
          var xb = x1, yb = y0 + (nR - (x1 - x0) / C.EM_PER_ROLL) * C.SCORE_PER_ROLL;
          if (yb < y0) { yb = y0; xb = x0 + nR * C.EM_PER_ROLL; }
          isoX.push(xa, xb, null); isoY.push(ya, yb, null);
        });
        traces.push({
          type: 'scatter', mode: 'lines', x: isoX, y: isoY, name: '等词条线',
          line: { color: '#e8710a', width: 1, dash: 'dash' }, legendrank: 3,
        });

        // 最优分配线（实线）与交点
        traces.push({
          type: 'scatter', mode: 'lines', x: lc.revX, y: lc.revY, name: '最优分配线',
          line: { color: '#e8710a', width: 1.6 }, legendrank: 1,
        });
        traces.push({
          type: 'scatter', mode: 'markers', x: lc.crosses.map(function (c) { return c.x; }),
          y: lc.crosses.map(function (c) { return c.y; }),
          marker: { size: 7, color: '#e8710a', line: { color: '#fff', width: 1.5 } },
          showlegend: false,
        });

        // 基准点
        traces.push({
          type: 'scatter', mode: 'markers', x: [s.em], y: [y0],
          marker: { size: 9, color: '#111' }, showlegend: false,
        });

        var shapes = [];
        var annotations = [];

        // 遮罩边界：43 词条斜线
        var yMeet = y0 + (Mi.ROLL_LIMIT - Mi.EM_ADD_MAX / C.EM_PER_ROLL) * C.SCORE_PER_ROLL;
        var edgeX = [], edgeY = [];
        for (var y = yMeet; y <= y1 + 1e-9; y += 2) {
          var x = Mi.xRight(y, s);
          if (x < x0) break;
          edgeX.push(x); edgeY.push(Math.min(y, y1));
        }
        traces.push({
          type: 'scatter', mode: 'lines', x: edgeX, y: edgeY,
          line: { color: '#9a9a9a', width: 1, dash: 'dash' }, showlegend: false,
        });
        var yMid = (yMeet + y1) / 2;
        annotations.push({
          x: Mi.xRight(yMid, s), y: yMid, xanchor: 'left', yanchor: 'bottom',
          text: '43 词条上限', showarrow: false, font: { size: 11, color: '#999' },
        });

        // 配平下界（细点线）
        var yP = Math.max(4 * s.cr, 2 * s.cd);
        if (yP > y0 + 0.5 && yP < y1) {
          traces.push({
            type: 'scatter', mode: 'lines',
            x: [s.em, Mi.xRight(yP, s)], y: [yP, yP],
            line: { color: '#888', width: 1.2, dash: 'dot' }, showlegend: false,
          });
          annotations.push({
            x: Mi.xRight(yP, s), y: yP, xanchor: 'right', yanchor: 'bottom',
            text: '1:2 配平可达下界', showarrow: false, font: { size: 11, color: '#888' },
          });
        }

        return { x0: x0, x1: x1, y0: y0, y1: y1, traces: traces, shapes: shapes, annotations: annotations, crosses: lc.crosses };
      }

      var plotKey = function (s) { return s.bonus + '|' + s.em + '|' + s.cr + '|' + s.cd + '|' + s.d; };

      function draw(s) {
        var key = plotKey(s);
        if (cache.key !== key) cache = { key: key, base: buildBase(s) };
        var b = cache.base;
        charts.draw(m.plot, b.traces, {
          xaxis: charts.axis({
            title: { text: '元素精通' }, range: [b.x0, b.x1],
            tickvals: Mi.niceTicks(b.x0, b.x1, 100),
          }),
          yaxis: charts.axis({
            title: { text: '双暴分' }, range: [b.y0, b.y1],
            tickvals: Mi.niceTicks(b.y0, b.y1, 50),
          }),
          shapes: b.shapes, annotations: b.annotations,
          showlegend: true,
          margin: { t: 24, r: 24, b: 52, l: 66 }, height: 620,
        }).then(function () { ovl.queue(); });
      }

      /* ── 悬浮卡片 ── */
      function tipHTML(x, y, s) {
        var info = Mi.pointInfo(x, y, s);
        var t = ctx.tip;
        if (info.state === 'bad') {
          return t.hero('×' + info.mult.toFixed(3), '相较 0 词条') +
            t.bad('无法配平：' + info.reason) +
            t.rows([['参照 · ' + Mi.REF_CAPTION, '×' + info.ref.toFixed(3)]]);
        }
        var dC = Mi.equivEm(x, y, s);       // 1 精通词条 ≈ d 双暴词条（局部）
        var dR = Mi.equivRange(s, 61);      // 全图范围（随参数现算）
        var al = Mi.nextAlloc(x, y, s);
        var im = Mi.importance(x, y, s);
        var refNote = Mi.refFactorNote(s);
        var html =
          '<div class="tip__hero"><b>×' + info.mult.toFixed(3) + '</b><span class="u">相较 0 词条</span></div>' +
          '<div class="tip__hd" style="grid-template-columns:44px 50px 1fr"><span class="nm">参照</span><span class="rl">589/5/50</span><span class="vl">×' + info.ref.toFixed(3) + '</span></div>' +
          '<div class="tip__hd"><span class="nm">精通</span><span class="rl">' + fmt1(info.emRolls) + ' 词条</span><span class="vl">' + info.x.toFixed(0) + '</span></div>' +
          '<div class="tip__hd"><span class="nm">双暴</span><span class="rl">' + fmt1(info.critRolls) + ' 词条</span><span class="vl">' + fmt1(info.y) + '</span></div>' +
          '<div class="tip__eq"><div><span class="lb">精通：</span><b class="' + (dC >= 1 ? 'hi' : 'lo') + '">' + dC.toFixed(2) +
            '</b><span class="dim"> ∈ [' + dR.lo.toFixed(2) + ', ' + dR.hi.toFixed(2) + ']</span></div></div>' +
          '<div class="tip__cap" style="font-weight:600">下一词条最优分配</div>' + segBar(al.du, al.dv) +
          '<div class="tip__cap mt" style="font-weight:600">归一化梯度</div>' + segBar(im.em, im.crit) +
          '<div class="tip__note">配平后：暴击 ' + fmt1(info.rate) + ' / 暴伤 ' + fmt1(info.dmg) + '</div>' +
          (refNote ? t.note(refNote) : '');
        if (info.state === 'band') {
          var side = Mi.pinnedSide(s);
          html += t.note('1:2 配平不可达：' + side + '压在基准，超额全在' + (side === '暴伤' ? '暴击率' : '暴伤'));
        }
        return html;
      }

      /** 两维度单条分段条：左精通（青）· 右双暴（紫），数值在条上方。
       *  flex-grow 按值分配，每侧保底 0.04 —— 某侧为 0 时也留一丝颜色可见。 */
      function segBar(a, b) {
        var g = function (v) { return Math.max(0.04, v).toFixed(3); };
        return '<div class="tip__barlbl"><span class="s-em">精通 ' + a.toFixed(2) + '</span><span class="s-cr">双暴 ' + b.toFixed(2) + '</span></div>' +
          '<div class="tip__seg"><i class="em" style="flex-grow:' + g(a) + '"></i>' +
          '<i class="cr" style="flex-grow:' + g(b) + '"></i></div>';
      }

      /* ── 叠加层：基准标注、交点倍数、固定点十字与双箭头、悬浮双箭头 ── */
      ovl.draw(function (g) {
        var s = st;
        if (!s || !cache.base) return [];
        var base = cache.base;
        var parts = [ctx.overlay.defs([
          { id: 'ovl-arrow-p', color: '#111' },
          { id: 'ovl-arrow-g', color: '#4a6fa5' },
        ])];
        ctx.overlay.text(parts, 3, g.h - 7, '基准 ×1.00', '#111');
        (base.crosses || []).forEach(function (c) {
          var cx = (c.x - base.x0) / (base.x1 - base.x0) * g.w + 7;
          var cy = (base.y1 - c.y) / (base.y1 - base.y0) * g.h + 4;
          ctx.overlay.text(parts, cx, cy, '×' + c.mult.toFixed(3) + ' (' + c.n + ' 词)', '#e8710a');
        });

        function arrows(px, py, x, y) {
          var al = Mi.nextAlloc(x, y, s);
          var t = ctx.overlay.arrow(parts, px, py,
            al.du * C.EM_PER_ROLL * g.w / (base.x1 - base.x0),
            al.dv * C.SCORE_PER_ROLL * g.h / (base.y1 - base.y0),
            g, { color: '#111', width: 2.2, marker: 'ovl-arrow-p' });
          ctx.overlay.arrow(parts, px, py,
            Mi.dlnFdx(x, s.bonus, s) * (base.x1 - base.x0) / g.w,
            Mi.dlnGdy(y, s.cr, s.cd) * (base.y1 - base.y0) / g.h,
            g, { color: '#4a6fa5', width: 1.6, marker: 'ovl-arrow-g' });
          return t;
        }

        chip.style.display = 'none';
        if (hoverPx) {
          var hx = base.x0 + hoverPx.x / g.w * (base.x1 - base.x0);
          var hy = base.y1 - hoverPx.y / g.h * (base.y1 - base.y0);
          if (Mi.pointInfo(hx, hy, s).state !== 'bad') arrows(hoverPx.x, hoverPx.y, hx, hy);
        }
        if (pin) {
          var X = (pin.x - base.x0) / (base.x1 - base.x0) * g.w;
          var Y = (base.y1 - pin.y) / (base.y1 - base.y0) * g.h;
          var cx = Math.min(Math.max(X, 0), g.w), cy = Math.min(Math.max(Y, 0), g.h);
          parts.push('<line x1="' + cx + '" y1="0" x2="' + cx + '" y2="' + g.h + '" stroke="#111" stroke-width="1" stroke-dasharray="2,3"/>');
          parts.push('<line x1="0" y1="' + cy + '" x2="' + g.w + '" y2="' + cy + '" stroke="#111" stroke-width="1" stroke-dasharray="2,3"/>');
          parts.push('<circle cx="' + cx + '" cy="' + cy + '" r="4.5" fill="#111"/>');
          if (Mi.pointInfo(pin.x, pin.y, s).state !== 'bad') {
            var ti = arrows(cx, cy, pin.x, pin.y);
            var im = Mi.importance(pin.x, pin.y, s);
            var al = Mi.nextAlloc(pin.x, pin.y, s);
            chip.innerHTML =
              '<span class="c-g">归一化梯度：精通 ' + im.em.toFixed(2) + ' · 双暴 ' + im.crit.toFixed(2) + '</span><br>' +
              '<span class="c-p">最优的分配：精通 ' + al.du.toFixed(2) + ' · 双暴 ' + al.dv.toFixed(2) + '</span>';
            chip.style.left = ti.tx + 'px';
            chip.style.top = (ti.ty - 4) + 'px';
            chip.style.display = 'block';
          }
        }
        return parts;
      });

      /* ── 固定点框 ── */
      function updatePinBox(s) {
        var mult = document.getElementById('pin-mult'), who = document.getElementById('pin-who');
        var split = document.getElementById('pin-split'), rollsEl = document.getElementById('pin-rolls');
        var ref = document.getElementById('pin-ref'), next = document.getElementById('pin-next');
        var note = document.getElementById('pin-note'), grid = document.getElementById('pin-grid');
        if (!pin) {
          mult.textContent = '—';
          who.textContent = '点图上任意位置，固定一个点。';
          ref.textContent = ''; note.textContent = '';
          grid.style.display = 'none';
          return;
        }
        var info = Mi.pointInfo(pin.x, pin.y, s);
        if (info.state === 'bad') {
          mult.textContent = '无法配平';
          who.innerHTML = '<span class="bad">原因：' + info.reason + '</span>';
          ref.innerHTML = '×' + info.mult.toFixed(4) + '（相较 0 词条）<br>' +
            '×' + info.ref.toFixed(4) + '（' + Mi.refLabel(s) + '）';
          note.textContent = '目标：精通 ' + info.x.toFixed(0) + '　双暴分 ' + fmt1(info.y);
          grid.style.display = 'none';
          return;
        }
        mult.innerHTML = '<b>×' + info.mult.toFixed(4) + '</b>（相较 0 词条）';
        ref.textContent = '×' + info.ref.toFixed(4) + '（' + Mi.refLabel(s) + '）';
        who.textContent = '精通 ' + info.x.toFixed(0) + '　双暴分 ' + fmt1(info.y);
        split.textContent = '暴击 ' + fmt1(info.rate) + '% / 暴伤 ' + fmt1(info.dmg) + '%';
        rollsEl.textContent = '精通 ' + fmt1(info.emRolls) + ' · 双暴 ' + fmt1(info.critRolls) +
          '（共 ' + fmt1(info.emRolls + info.critRolls) + '）';
        var gains = Mi.nextRollGains(info.x, info.y, s);
        next.innerHTML = '<span class="s-em">精通 ＋' + pct2(gains.em) + '</span> · <span class="s-cr">双暴 ＋' + pct2(gains.crit) + '</span>';
        var side = Mi.pinnedSide(s);
        note.textContent = info.state === 'band'
          ? '注：此双暴分下 1:2 配平不可达，' + side + '压在基准，超额全在' + (side === '暴伤' ? '暴击率' : '暴伤') + '。'
          : '';
        grid.style.display = '';
      }

      function update(s0) {
        var s = readState(s0);
        st = s;
        draw(s);
        updatePinBox(s);
      }

      /* 滑条拖动：只更新读数与固定点框，不碰绘图 */
      function preview(s0) {
        var s = readState(s0);
        st = s;
        updatePinBox(s);
      }

      /* ── 交互 ── */
      m.wrap.addEventListener('mousemove', function (e) {
        hoverPx = m.pxIn(e);
        ovl.queue();
        if (!hoverPx || !st || !cache.base) { tip.hide(); return; }
        var base = cache.base;
        var g = m.geom();
        var hx = base.x0 + hoverPx.x / g.w * (base.x1 - base.x0);
        var hy = base.y1 - hoverPx.y / g.h * (base.y1 - base.y0);
        /* 两条箭头线段（黑 + 钢蓝，与叠加层同一几何）——卡片避开它们放 */
        var segs = [];
        if (Mi.pointInfo(hx, hy, st).state !== 'bad') {
          var al = Mi.nextAlloc(hx, hy, st);
          var t1 = ctx.overlay.arrowTip(hoverPx.x, hoverPx.y,
            al.du * C.EM_PER_ROLL * g.w / (base.x1 - base.x0),
            al.dv * C.SCORE_PER_ROLL * g.h / (base.y1 - base.y0), g, {});
          var t2 = ctx.overlay.arrowTip(hoverPx.x, hoverPx.y,
            Mi.dlnFdx(hx, st.bonus, st) * (base.x1 - base.x0) / g.w,
            Mi.dlnGdy(hy, st.cr, st.cd) * (base.y1 - base.y0) / g.h, g, {});
          segs.push([hoverPx.x, hoverPx.y, t1.tx, t1.ty], [hoverPx.x, hoverPx.y, t2.tx, t2.ty]);
        }
        tip.show(tipHTML(hx, hy, st), hoverPx.x, hoverPx.y, { segs: segs });
      });
      m.wrap.addEventListener('mouseleave', function () {
        hoverPx = null;
        ovl.queue();
        tip.hide();
      });
      m.wrap.addEventListener('click', function (e) {
        var p = m.pxIn(e);
        if (!p || !cache.base) return;
        var base = cache.base;
        var g = m.geom();
        pin = {
          x: base.x0 + p.x / g.w * (base.x1 - base.x0),
          y: base.y1 - p.y / g.h * (base.y1 - base.y0),
        };
        updatePinBox(st);
        ovl.queue();
      });

      return { plot: m.plot, update: update, preview: preview };
    },
  };
})(typeof globalThis !== 'undefined' ? globalThis : this);
