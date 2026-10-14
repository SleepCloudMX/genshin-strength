/* 桑多涅 · 星超导词条分配（曲线版）：各词条总数下，最优分配给出的面板值。
   四联小图、共享横轴、各自独立纵轴（不标刻度）；基准虚线 + 拐点竖线 + 自绘十字线悬浮卡。 */
(function (global) {
  'use strict';
  var GS = global.GS = global.GS || {};
  var M = GS.modules = GS.modules || {};
  var S = GS.core.sandrone;
  var el = GS.ui.panels.el;

  var NMAX = S.N_MAX;     // 词条预算上限 53
  var STEP = 0.25;        // 曲线扫描步长（词条）
  var COL = { cr: '#d62728', cd: '#ff7f0e', atk: '#8c564b', em: '#2e8b57' };

  var PANELS = [
    { key: 'cr', name: '暴击率 %', color: COL.cr },
    { key: 'cd', name: '暴伤 %', color: COL.cd },
    { key: 'atk', name: '面板攻击力', color: COL.atk },
    { key: 'em', name: '精通', color: COL.em },
  ];
  function axId(i) { return i === 0 ? '' : String(i + 1); }

  var FOOT =
    '四条曲线 = 每个词条总数 n 下最优分配（与伤害热图页同一优化器）给出的面板值，n = 0 处即基准面板；' +
    '竖虚线 = 拐点：暴击率封顶（之后双暴词条全进暴伤）；精通 / 攻击词条进场（该档之前其词条数为 0、面板值持平于基准）。' +
    '<br>面板攻击力 = 基础攻击力 ×（1 + 攻攻主词条 + 大攻击合计 + 攻击词条）+ 羽 + 小攻击；' +
    '词条预算上限 53 的推导、默认参数（七七 · 木偶 · 阿罗夏 队）的来源分解见 ' +
    '<a href="#/sandrone/star_superconduct">伤害热图</a>页页脚。';

  M['sandrone/alloc_curve'] = {
    title: '「桑多涅」星超导词条分配',
    tab: '桑多涅·词条分配',
    intro: '每个词条总数 n 下，最优分配给出的面板值 —— 暴击率 / 暴伤 / 面板攻击力 / 精通四条曲线；' +
      '四格共享横轴、各自独立纵轴（不标刻度，悬浮读数值与词条拆分）；虚线 = 基准值，竖虚线 = 拐点。' +
      '伤害热图见 <a href="#/sandrone/star_superconduct">伤害热图</a>页。',
    controls: [
      {
        key: '', type: 'note',
        html: '<b>基准面板 = 上完 buff、不含副词条</b> —— 全写在参数里（角色自身、武器、队友、圣遗物）；' +
          '攻攻主词条（46.6% × 2）与羽（311）由脚本自动加。',
      },
      {
        key: '', type: 'note',
        html: '<b>词条口径</b>：1 词条 = 20 精通 = 3.3% 暴击 = 6.6% 暴伤 = 5% 大攻击；<b>双暴按 1 : 2 配平</b>' +
          '（先补基准偏斜；暴击率封顶 100% 后全进暴伤），攻击词条按大攻击折算（小攻击见换算行）。',
      },
      { key: 'baseAtk', type: 'number', label: '基础攻击力', def: 828, step: 1, min: 0 },
      { key: 'patk', type: 'number', label: '大攻击 %', def: 109.4, step: 0.1, min: -9999 },
      { key: 'fatk', type: 'number', label: '小攻击', def: 0, step: 1, min: -9999 },
      { key: 'em', type: 'number', label: '基准精通', def: 160, step: 10, min: 0 },
      { key: 'cr', type: 'number', label: '基准暴击率 %', def: 55.2, step: 0.1, min: 0 },
      { key: 'cd', type: 'number', label: '基准暴伤 %', def: 112.2, step: 0.1, min: 50 },
      { key: 'bonus', type: 'number', label: '反应增伤 %', def: 160, step: 1, min: 0 },
      { key: 'panelAtk', type: 'readout', full: true, label: '基准面板攻击力（计入伤害）', compute: function (s) {
        return S.panelAttack(s.baseAtk, s.patk / 100, s.fatk, 0).toFixed(0);
      } },
      { key: 'conv', type: 'readout', full: true, label: '攻击词条换算', compute: function (s) {
        return '大 ' + (s.baseAtk * S.PER_ATK).toFixed(1) + ' · 小 ' + S.PER_FLAT;
      } },
    ],

    create: function (host, ctx) {
      var charts = ctx.charts;

      var card = el('div', 'card chartcard');
      var m = charts.mount(card, { height: 700 });
      var ovl = ctx.overlay.mount(m.wrap, panelGeom);
      var tip = ctx.tip.mount(m.wrap, panelGeom);
      host.appendChild(card);
      host.appendChild(GS.ui.panels.note(FOOT, 'pagenote'));

      var st = null, hover = null;

      /** 四格绘图区的并集几何（相对 wrap）——tip / overlay / 十字线共用这一套。 */
      function panelGeom() {
        var fl = m.plot._fullLayout;
        if (fl && fl.xaxis && fl.xaxis._length && fl.yaxis && fl.yaxis._offset !== undefined && fl.yaxis4) {
          return {
            left: fl.xaxis._offset, top: fl.yaxis._offset,
            w: fl.xaxis._length,
            h: fl.yaxis4._offset + fl.yaxis4._length - fl.yaxis._offset,
          };
        }
        var cw = m.plot.clientWidth || 900, ch = m.plot.clientHeight || 700;
        return { left: 26, top: 18, w: Math.max(cw - 52, 120), h: Math.max(ch - 66, 120) };
      }

      /** 鼠标位置 → 并集几何坐标 + 对应词条数 n（x 四格共用）。 */
      function atMouse(e) {
        var fl = m.plot._fullLayout;
        if (!fl || !fl.xaxis || !fl.xaxis.range) return null;
        var g = panelGeom();
        var r = m.wrap.getBoundingClientRect();
        var px = e.clientX - r.left - g.left, py = e.clientY - r.top - g.top;
        if (px < -4 || px > g.w + 4 || py < -4 || py > g.h + 4) return null;
        px = Math.min(Math.max(px, 0), g.w);
        var xr = fl.xaxis.range;
        return { px: px, py: py, n: xr[0] + px / g.w * (xr[1] - xr[0]) };
      }

      function readState(s) {
        return {
          baseAtk: s.baseAtk,
          atkPct: s.patk / 100,
          fatk: s.fatk,
          em: s.em, cr: s.cr, cd: s.cd,
          bonus: s.bonus / 100,
        };
      }

      /** 逐档最优扫描 → 展开成四条曲线上的点。 */
      function makePoints(rs) {
        return S.bestPath(rs, NMAX, STEP).map(function (p) {
          var t = S.critSplit(rs.cr, rs.cd, p.y);
          return {
            n: p.n, x: p.x, y: p.y, z: Math.max(0, p.z),
            cr: t.cr, cd: t.cd,
            atk: S.panelAttack(rs.baseAtk, rs.atkPct, rs.fatk, Math.max(0, p.z)),
            em: rs.em + S.PER_EM * p.x,
          };
        });
      }

      /** 曲线值的纵轴范围：min–max 加 9% 留白；整条平坦时按量级撑开。 */
      function rangeOf(v) {
        var lo = Math.min.apply(null, v), hi = Math.max.apply(null, v);
        if (hi - lo < 1e-9) { var s = Math.abs(lo) * 0.01 || 1; lo -= s; hi += s; }
        var pad = (hi - lo) * 0.09;
        return [lo - pad, hi + pad];
      }

      /** 拐点：第一个越过阈值的采样点（与前一点线性插值）。 */
      function findKinks(pts) {
        function firstAbove(key, thr) {
          for (var i = 1; i < pts.length; i++) {
            if (pts[i][key] > thr) {
              var a = pts[i - 1][key], b = pts[i][key], d = b - a;
              var t = d > 1e-12 ? (thr - a) / d : 0;
              t = Math.min(Math.max(t, 0), 1);
              return pts[i - 1].n + (pts[i].n - pts[i - 1].n) * t;
            }
          }
          return null;
        }
        var out = [];
        var cap = firstAbove('cr', 99.95);
        if (cap !== null && cap > 0.6 && cap < NMAX - 0.6) {
          out.push({ n: cap, panel: 0, bottom: true, text: '暴击率封顶' });
        }
        var em = firstAbove('x', 0.01);
        if (em !== null && em > 0.6 && em < NMAX - 0.6) {
          out.push({ n: em, panel: 3, bottom: false, text: '精通词条进场' });
        }
        var atk = firstAbove('z', 0.01);
        if (atk !== null && atk > 0.6 && atk < NMAX - 0.6) {
          out.push({ n: atk, panel: 2, bottom: false, text: '攻击词条进场' });
        }
        return out;
      }

      function interpAt(pts, n) {
        var t = Math.min(Math.max(n, 0), NMAX) / STEP;
        var i = Math.min(Math.floor(t), pts.length - 2), f = t - i;
        var a = pts[i], b = pts[i + 1];
        function mix(k) { return a[k] + (b[k] - a[k]) * f; }
        return {
          cr: mix('cr'), cd: mix('cd'), atk: mix('atk'), em: mix('em'),
          x: mix('x'), y: mix('y'), z: Math.max(0, mix('z')),
        };
      }

      function update(s0) {
        var rs = readState(s0);
        var pts = makePoints(rs);
        st = { rs: rs, pts: pts };

        var vals = { cr: [], cd: [], atk: [], em: [] };
        pts.forEach(function (q) {
          vals.cr.push(q.cr); vals.cd.push(q.cd); vals.atk.push(q.atk); vals.em.push(q.em);
        });
        var rngs = [rangeOf(vals.cr), rangeOf(vals.cd), rangeOf(vals.atk), rangeOf(vals.em)];
        var base = [pts[0].cr, pts[0].cd, pts[0].atk, pts[0].em];
        var kinks = findKinks(pts);

        var shapes = [], anns = [];
        PANELS.forEach(function (p, i) {
          shapes.push({
            type: 'line', xref: 'x' + axId(i), yref: 'y' + axId(i),
            x0: 0, x1: NMAX, y0: base[i], y1: base[i],
            layer: 'below',   // 画在曲线下方：持平段不被灰点线叠出虚线感
            line: { color: '#c9c4ba', width: 1, dash: 'dot' },
          });
          anns.push({
            xref: 'x' + axId(i) + ' domain', yref: 'y' + axId(i) + ' domain',
            x: 0.006, y: 0.97, xanchor: 'left', yanchor: 'top',
            text: p.name, showarrow: false, font: { size: 12.5, color: p.color },
          });
        });
        kinks.forEach(function (k) {
          for (var i = 0; i < 4; i++) {
            shapes.push({
              type: 'line', xref: 'x' + axId(i), yref: 'y' + axId(i),
              x0: k.n, x1: k.n, y0: rngs[i][0], y1: rngs[i][1],
              line: { color: '#bdb6a9', width: 1, dash: 'dash' },
            });
          }
          anns.push({
            xref: 'x' + axId(k.panel), yref: 'y' + axId(k.panel) + ' domain',
            x: k.n, y: k.bottom ? 0.15 : 0.92, xanchor: 'left',
            yanchor: k.bottom ? 'bottom' : 'top', xshift: 5,
            text: k.text + ' n ≈ ' + k.n.toFixed(1), showarrow: false,
            font: { size: 11, color: '#8a857c' },
          });
        });
        function inertNote(i, text) {
          anns.push({
            xref: 'x' + axId(i) + ' domain', yref: 'y' + axId(i) + ' domain',
            x: 0.006, y: 0.06, xanchor: 'left', yanchor: 'bottom',
            text: text, showarrow: false, font: { size: 11, color: '#b0a99c' },
          });
        }
        function isInert(key) {
          return !pts.some(function (q) { return q[key] > 0.01; });
        }
        if (isInert('x')) inertNote(3, NMAX + ' 词条内未分配精通词条');
        if (isInert('z')) inertNote(2, NMAX + ' 词条内未分配攻击词条');

        var traces = PANELS.map(function (p, i) {
          return {
            type: 'scatter', mode: 'lines',
            x: pts.map(function (q) { return q.n; }),
            y: vals[p.key],
            line: { color: p.color, width: 2.4 },
            xaxis: 'x' + axId(i), yaxis: 'y' + axId(i),
          };
        });

        var layout = {
          grid: { rows: 4, columns: 1, pattern: 'independent', roworder: 'top to bottom', ygap: 0.05 },
          margin: { t: 18, r: 26, b: 48, l: 26 },
          height: 700,
          shapes: shapes,
          annotations: anns,
        };
        PANELS.forEach(function (p, i) {
          var xo = { range: [0, NMAX] };
          if (i === 3) {
            xo.showticklabels = true;
            xo.title = { text: '等效词条总数 n' };
          } else {
            xo.showticklabels = false;
          }
          layout['xaxis' + axId(i)] = charts.axis(xo);
          layout['yaxis' + axId(i)] = {
            showticklabels: false, showgrid: false, zeroline: false, range: rngs[i],
          };
        });

        charts.draw(m.plot, traces, layout).then(function () { ovl.queue(); });
      }

      /* ── 叠加层：十字准线（贯穿四格）+ 各曲线上的点 ── */
      ovl.draw(function (g) {
        if (!hover || !st) return [];
        var fl = m.plot._fullLayout;
        if (!fl || !fl.xaxis) return [];
        var q = interpAt(st.pts, hover.n);
        var v = [q.cr, q.cd, q.atk, q.em];
        var parts = [];
        for (var i = 0; i < 4; i++) {
          var ya = fl['yaxis' + axId(i)];
          if (!ya || !ya.range) continue;
          var y0 = ya._offset - g.top, y1 = y0 + ya._length;
          parts.push('<line x1="' + hover.px.toFixed(1) + '" y1="' + y0.toFixed(1) +
            '" x2="' + hover.px.toFixed(1) + '" y2="' + y1.toFixed(1) +
            '" stroke="#a29a8e" stroke-width="1" stroke-dasharray="3 3"/>');
          var fr = (v[i] - ya.range[0]) / (ya.range[1] - ya.range[0]);
          var ypx = y0 + (1 - fr) * ya._length;
          parts.push('<circle cx="' + hover.px.toFixed(1) + '" cy="' + ypx.toFixed(1) + '" r="4" fill="' +
            PANELS[i].color + '" stroke="#fff" stroke-width="1.4"/>');
        }
        return parts;
      });

      m.wrap.addEventListener('mousemove', function (e) {
        hover = atMouse(e);
        ovl.queue();
        if (!hover || !st) { tip.hide(); return; }
        var q = interpAt(st.pts, hover.n);
        tip.show(
          ctx.tip.hero('n = ' + hover.n.toFixed(1), '词条') +
          ctx.tip.rows([
            ['暴击率', q.cr.toFixed(1) + '%'],
            ['暴伤', q.cd.toFixed(1) + '%'],
            ['面板攻击力', q.atk.toFixed(0)],
            ['精通', q.em.toFixed(0)],
          ]) +
          ctx.tip.div() +
          ctx.tip.rows([
            ['词条拆分', '精通 ' + q.x.toFixed(1) + ' · 双暴 ' + q.y.toFixed(1) + ' · 攻击 ' + q.z.toFixed(1)],
          ]),
          hover.px, hover.py);
      });
      m.wrap.addEventListener('mouseleave', function () {
        hover = null;
        ovl.queue();
        tip.hide();
      });

      return { plot: m.plot, update: update };
    },
  };
})(typeof globalThis !== 'undefined' ? globalThis : this);
