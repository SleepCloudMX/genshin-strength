/* 基础专题 · 暴击：波动 —— 一次尝试的 DPS 分布（精确：各段二项分布的卷积）。 */
(function (global) {
  'use strict';
  var GS = global.GS = global.GS || {};
  var M = GS.modules = GS.modules || {};
  var B = GS.core.basics;
  var el = GS.ui.panels.el;

  var W = 1e4;                 // 万：输入与显示的单位
  var S = 1 / W;               // 显示缩放（数据 → w）
  var QPAL = ['#2f6f9f', '#2e8b57', '#e07b39', '#7b5ea7', '#c2453a', '#5a7d9a'];
  var qColor = function (i) { return QPAL[i % QPAL.length]; };

  /** 数值（w 单位）：13680000 → 1,368w；114000 → 11.4w；5842 → 0.58w */
  function fmtW(v) {
    var w = v / W, a = Math.abs(w);
    if (a >= 100) return Math.round(w).toLocaleString('en-US') + 'w';
    if (a >= 10) return parseFloat(w.toFixed(1)) + 'w';
    return parseFloat(w.toFixed(2)) + 'w';
  }
  var pct1 = function (v) { return (v * 100).toFixed(1) + '%'; };
  var qLabel = function (q) {
    var v = q * 100;
    return (Math.abs(v - Math.round(v)) < 1e-9 ? String(Math.round(v)) : v.toFixed(1)) + '%';
  };
  function kRamp(t) { return GS.core.mixHex('#bac5d0', '#2f6f9f', t); }

  /** 分位档 / 次数档：文本解析（非法与重复的忽略；空 = 不画）。 */
  function parseList(str, lo, hi, int) {
    var seen = {}, out = [];
    String(str).split(/[^0-9.]+/).forEach(function (tok) {
      var v = parseFloat(tok);
      if (!Number.isFinite(v) || v <= lo || v >= hi) return;
      var val = int ? Math.round(v) : v;
      if (seen[val]) return;
      seen[val] = 1; out.push(val);
    });
    return out.sort(function (a, b) { return a - b; });
  }

  var SEG0 = { non: 20, cd: 1.6, cr: 0.8, n: 30, t: 120 };

  var FOOT =
    '一次尝试的总 DPS <b>Y = Σ V₀(n + d·B) / T</b>（对段求和），其中 <b>B ~ Binomial(n, p)</b> 为该段的暴击次数（各段独立）；' +
    '分布 = 各段二项分布的卷积，<b>精确</b>，不用正态近似。支撑集 = [全不暴, 全暴]（有限区间）。<br>' +
    '分位：<b>Q_q = min{ x : F(x) ≥ q }</b>（F 为累积分布），<b>「前 α 可达伤害」= Q_(1−α)</b>；' +
    '阅读约定：Q_q 处「不低于它」的概率至少 1 − q。<br>' +
    'K 次尝试取最好：分布 = F(x)^K（精确），<b>中位数 = Q_(0.5^(1/K))</b> —— 打 7 次取最好 ≈ 看前 9.4% 的分位。<br>' +
    '图 1 / 图 2 横轴左端截到 1% 分位（左侧尾几乎不会发生），截断时图内注明。<br>' +
    '数值只是算术演示，不代表任何实际配置；暴击率 / 暴伤怎么分见<a href="#/basics/crit_split">分配</a>页；' +
    '推导见 <code>docs/ai-output/2-basics/2-crit.md</code>。';

  M['basics/crit_dist'] = {
    title: '暴击：波动',
    tab: '暴击·波动',
    intro: '未满暴时反复打，一次尝试的 DPS 是<b>一个分布</b> —— 精确算（不是正态近似）：每段的暴击次数是二项分布，' +
      '总分布是各段的卷积。伤害 / DPS 单位 <b>w = 万</b>；姊妹页见 <a href="#/basics/crit_split">暴击：分配</a>。',
    controls: [
      {
        key: '', type: 'note',
        html: '<b>每段 = 一串伤害实例</b>（同暴击率、同暴伤、同次数）。未暴击 / 暴击伤害两个框按「暴击 = 未暴击 × (1 + 暴伤)」互推，' +
          '<b>以最近编辑的为准</b>；总 DPS = Σ（各段伤害 ÷ 各自时间）。<b>分位档</b>如 90% = 前 10% 的好情况能达到的伤害（越大越看最好情况）；' +
          '<b>尝试次数</b>画「打 K 次取最好」的累积曲线。默认是一组示例常数。两张图横轴左端截到 <b>1% 分位</b> —— 左边的极端不会发生，关注右边高伤害。',
      },
      {
        key: 'segs', type: 'custom',
        build: function (cell, api) {
          var list = el('div', 'segs__list');
          var addBtn = el('button', 'btn', '＋ 添加伤害段');
          addBtn.type = 'button';
          addBtn.style.marginTop = '8px';
          cell.appendChild(list);
          cell.appendChild(addBtn);

          function field(label, cls, attrs, value) {
            var lab = el('label', null, label);
            var inp = el('input', 'field__input ' + cls);
            inp.type = 'number';
            for (var k in attrs) inp.setAttribute(k, attrs[k]);
            inp.value = value;
            lab.appendChild(inp);
            return lab;
          }

          function addSeg(v) {
            v = v || SEG0;
            var card = el('div', 'segcard');
            var head = el('div', 'segcard__head', '<span>伤害段</span>');
            var del = el('button', 'del', '×');
            del.type = 'button';
            del.title = '删除本段';
            head.appendChild(del);
            card.appendChild(head);
            card.appendChild(field('未暴击伤害 w', 'f-non', { step: 1, min: 0 }, v.non));
            card.appendChild(field('暴击伤害 w', 'f-crit', { step: 1, min: 0 },
              parseFloat((v.non * (1 + v.cd)).toFixed(6))));
            card.appendChild(field('暴击率 %', 'f-cr', { step: 1, min: 0, max: 100 }, v.cr * 100));
            card.appendChild(field('暴伤 %', 'f-cd', { step: 1, min: 0 }, v.cd * 100));
            card.appendChild(field('次数', 'f-n', { step: 1, min: 1, max: 500 }, v.n));
            card.appendChild(field('时间 s', 'f-t', { step: 1, min: 0.1 }, v.t));

            var non = card.querySelector('.f-non'), crit = card.querySelector('.f-crit');
            var cd = card.querySelector('.f-cd');
            var anchor = 'non';   // 最近编辑的伤害框：改暴伤时保持它、推另一个
            function num(inp) { return parseFloat(inp.value); }
            function sync() {
              var d = num(cd);
              if (!Number.isFinite(d)) return;
              if (anchor === 'crit') {
                var c = num(crit);
                if (Number.isFinite(c)) non.value = String(parseFloat((c / (1 + d / 100)).toFixed(6)));
              } else {
                var a = num(non);
                if (Number.isFinite(a)) crit.value = String(parseFloat((a * (1 + d / 100)).toFixed(6)));
              }
            }
            function clamp(inp) {
              var x = parseFloat(inp.value), lo = parseFloat(inp.min), hi = parseFloat(inp.max);
              if (!Number.isFinite(x)) return;
              if (Number.isFinite(lo)) x = Math.max(x, lo);
              if (Number.isFinite(hi)) x = Math.min(x, hi);
              inp.value = x;
            }
            function commitAll() { clamp(non); clamp(crit); clamp(cd); sync(); api.hideHint(); api.commit(); }
            [non, crit, cd].forEach(function (inp, i) {
              inp.addEventListener('input', function () {
                if (i === 0) anchor = 'non';
                if (i === 1) anchor = 'crit';
                api.setHint('回车或点别处生效');
              });
              inp.addEventListener('change', commitAll);
              inp.addEventListener('keydown', function (e) {
                if (e.key !== 'Enter') return;
                e.preventDefault();
                commitAll();
              });
            });
            [card.querySelector('.f-cr'), card.querySelector('.f-n'), card.querySelector('.f-t')].forEach(function (inp) {
              inp.addEventListener('input', function () { api.setHint('回车或点别处生效'); });
              inp.addEventListener('change', commitAll);
              inp.addEventListener('keydown', function (e) {
                if (e.key !== 'Enter') return;
                e.preventDefault();
                commitAll();
              });
            });
            del.addEventListener('click', function () {
              card.remove();
              refreshDels();
              api.commit();
            });
            list.appendChild(card);
            refreshDels();
          }

          function refreshDels() {
            var cards = list.querySelectorAll('.segcard');
            for (var i = 0; i < cards.length; i++) {
              cards[i].querySelector('.del').style.visibility = cards.length > 1 ? 'visible' : 'hidden';
            }
          }

          addBtn.addEventListener('click', function () { addSeg(); api.commit(); });
          addSeg(SEG0);
        },
      },
      { key: 'qa', type: 'text', label: '分位档 %', def: '80, 90, 99' },
      { key: 'ka', type: 'text', label: '尝试次数', def: '1, 5, 10' },
    ],

    create: function (host, ctx) {
      var charts = ctx.charts;

      var rd = el('div', 'verdict');
      var card1 = el('div', 'card chartcard');
      var m1 = charts.mount(card1, { height: 340 });
      var card2 = el('div', 'card chartcard');
      var m2 = charts.mount(card2, { height: 340 });

      host.appendChild(rd);
      host.appendChild(card1);
      host.appendChild(card2);
      host.appendChild(GS.ui.panels.note(FOOT, 'pagenote'));

      var tip1 = ctx.tip.mount(m1.wrap, m1.geom);
      var tip2 = ctx.tip.mount(m2.wrap, m2.geom);
      var last1 = null, last2 = null;

      /** 段读取（编辑器在参数面板里；越界的读数按 min / max 夹紧）。 */
      function readSegs() {
        var cards = document.querySelectorAll('.segcard');
        var out = [];
        for (var i = 0; i < cards.length; i++) {
          var g = function (s) {
            var inp = cards[i].querySelector(s);
            var x = parseFloat(inp.value);
            if (!Number.isFinite(x)) return NaN;
            var lo = parseFloat(inp.min), hi = parseFloat(inp.max);
            if (Number.isFinite(lo)) x = Math.max(x, lo);
            if (Number.isFinite(hi)) x = Math.min(x, hi);
            return x;
          };
          var nonW = g('.f-non'), cr = g('.f-cr'), cd = g('.f-cd'), n = g('.f-n'), t = g('.f-t');
          if (![nonW, cr, cd, n, t].every(Number.isFinite)) return null;
          out.push({ non: nonW * W, cd: cd / 100, cr: cr / 100, n: Math.round(n), t: t });
        }
        return out.length ? out : null;
      }

      /* ═══ 图 1：分布 ═══ */
      function build1(dist, qs, xr) {
        var xs = dist.xs, ps = dist.ps, cum = dist.cum, min = dist.min, max = dist.max, mean = dist.mean;
        var n = xs.length;
        var barX, barY, surv, width, binned = false;
        if (n <= 300) {
          barX = Array.from(xs); barY = Array.from(ps);
          surv = new Array(n);
          var s = 0;
          for (var i = n - 1; i >= 0; i--) { s += ps[i]; surv[i] = s; }
          var gap = Infinity;
          for (var j = 1; j < n; j++) gap = Math.min(gap, xs[j] - xs[j - 1]);
          width = n > 1 ? gap * 0.85 : Math.max(Math.abs(xs[0]) * 0.1, 1);
        } else {
          binned = true;
          var NB = 120, w = (max - min) / NB || 1;
          var acc = new Array(NB).fill(0);
          for (var k = 0; k < n; k++) acc[Math.min(NB - 1, Math.floor((xs[k] - min) / w))] += ps[k];
          barX = acc.map(function (_, b) { return min + (b + 0.5) * w; });
          barY = acc;
          surv = new Array(NB);
          var s2 = 0;
          for (var b2 = NB - 1; b2 >= 0; b2--) { s2 += acc[b2]; surv[b2] = s2; }
          width = w * 0.92;
        }

        var shapes = [];
        function clip(x) { return Math.max(xr.lo, Math.min(xr.hi, x)) * S; }
        function band(k, fill) {
          shapes.push({
            type: 'rect', xref: 'x', yref: 'paper', y0: 0, y1: 1,
            x0: clip(mean - k * dist.sd), x1: clip(mean + k * dist.sd), fillcolor: fill, line: { width: 0 },
          });
        }
        band(3, 'rgba(47,111,159,0.06)');
        band(1, 'rgba(47,111,159,0.13)');
        shapes.push({ type: 'line', x0: mean * S, x1: mean * S, yref: 'paper', y0: 0, y1: 1, line: { color: '#333', width: 1.4 } });
        var annos = [{ x: mean * S, y: 1, yref: 'paper', xanchor: 'right', xshift: -4, yanchor: 'top', yshift: -4,
                       showarrow: false, font: { size: 11, color: '#333' }, text: '期望' }];
        qs.forEach(function (q, i) {
          var v = xs[B.firstAtLeast(cum, q)];
          shapes.push({ type: 'line', x0: v * S, x1: v * S, yref: 'paper', y0: 0, y1: 1,
                        line: { color: qColor(i), width: 1.3, dash: 'dash' } });
          annos.push({
            x: v * S, y: 1, yref: 'paper',
            xanchor: v > (xr.lo + xr.hi) / 2 ? 'right' : 'left',
            xshift: v > (xr.lo + xr.hi) / 2 ? -4 : 4, yanchor: 'top', yshift: -4 - i * 15,
            showarrow: false, font: { size: 11, color: qColor(i) },
            text: qLabel(q) + ' → ' + fmtW(v),
          });
        });
        if (xr.trimmed) {
          annos.push({ x: 0.005, xref: 'paper', y: 0, yref: 'paper', xanchor: 'left', yanchor: 'bottom',
                       yshift: 3, showarrow: false, font: { size: 10.5, color: '#888' },
                       bgcolor: 'rgba(255,255,255,0.85)', borderpad: 2, text: '左侧 1% 尾未显示' });
        }

        var traces = [{
          type: 'bar', x: barX.map(function (v) { return v * S; }), y: barY, width: width * S,
          marker: { color: '#3d6f96', line: { width: 0 } },
        }];
        return {
          traces: traces, barX: barX, barY: barY, surv: surv,
          layout: {
            xaxis: charts.axis({ title: { text: 'DPS（w）' }, range: [xr.lo * S, xr.hi * S] }),
            yaxis: charts.axis({ title: { text: '概率（一次尝试）' }, range: [0, Math.max.apply(null, barY) * 1.32] }),
            shapes: shapes, annotations: annos,
            margin: { t: 30, r: 24, b: 44, l: 64 }, height: 340,
          },
        };
      }

      /* ═══ 图 2：累积 ═══ */
      function build2(dist, qs, ks, xr) {
        var xs = dist.xs, cum = dist.cum;
        var x = Array.from(xs, function (v) { return v * S; });
        var f = Array.from(cum);
        var ko = ks.filter(function (k) { return k > 1; });

        var traces = [{
          type: 'scatter', mode: 'lines', x: x, y: f,
          line: { color: '#333', width: 2.4, shape: 'hv' },
        }];
        ko.forEach(function (k, i) {
          traces.push({
            type: 'scatter', mode: 'lines', x: x, y: f.map(function (v) { return Math.pow(v, k); }),
            line: { color: kRamp(ko.length === 1 ? 0.6 : 0.35 + 0.65 * i / (ko.length - 1)), width: 1.5, shape: 'hv', dash: 'dash' },
          });
        });
        qs.forEach(function (q, i) {
          var v = xs[B.firstAtLeast(cum, q)];
          traces.push({
            type: 'scatter', mode: 'markers+text', x: [v * S], y: [q],
            marker: { color: qColor(i), size: 8, line: { color: '#fff', width: 1.2 } },
            text: [fmtW(v)], textposition: q > 0.85 ? 'bottom right' : 'top left',
            textfont: { size: 11, color: qColor(i) }, cliponaxis: false,
          });
        });
        return {
          traces: traces, cum: cum, xs: xs,
          layout: {
            xaxis: charts.axis({ title: { text: 'DPS（w）' }, range: [xr.lo * S, xr.hi * S] }),
            yaxis: charts.axis({ title: { text: '累积概率 / 达到概率' }, range: [0, 1.04], tickformat: '.0%' }),
            margin: { t: 22, r: 24, b: 44, l: 64 }, height: 340,
          },
        };
      }

      function update(s) {
        var segs = readSegs();
        if (!segs) return;
        var qs = parseList(s.qa, 0, 100, false).map(function (v) { return v / 100; });
        var ks = parseList(s.ka, 0, 1e9, true);
        var dist = B.buildDist(segs);
        if (!dist) {
          rd.innerHTML = '<div class="verdict__sub bad">段数 / 次数过多，无法精确展开 —— 请合并段或减少次数。</div>';
          return;
        }
        var xr = B.xRangeOf(dist);
        var mean = dist.mean, sd = dist.sd, min = dist.min, max = dist.max, xs = dist.xs;
        var rows = [];
        if (segs.length > 1) rows.push('共 <b>' + segs.length + '</b> 段');
        rows.push('期望 DPS <b>' + fmtW(mean) + '</b>　σ <b>' + fmtW(sd) + '</b>（' + pct1(sd / mean) + ' of 期望）' +
          '　支撑 ' + fmtW(min) + ' ~ ' + fmtW(max) + '（' + xs.length + ' 点' + (xs.length > 300 ? '，图上显示为分箱' : '') + '）');
        function covLine(k) {
          var lo = mean - k * sd, hi = mean + k * sd;
          var cov = B.covBetween(dist, lo, hi);
          var out = (lo < min ? '，下端超出' : '') + (hi > max ? '，上端超出上限' : '');
          return 'μ ± ' + (k === 1 ? '' : k) + 'σ <b>[' + fmtW(lo) + ', ' + fmtW(hi) + ']</b>，实际覆盖 <b>' + pct1(cov) + '</b>' + out;
        }
        rows.push(covLine(1));
        rows.push(covLine(3));
        if (qs.length) {
          rows.push('分位：' + qs.map(function (q, i) {
            return '<span style="color:' + qColor(i) + '">' + qLabel(q) + ' → <b>' +
              fmtW(xs[B.firstAtLeast(dist.cum, q)]) + '</b></span>';
          }).join('　'));
        }
        var ko = ks.filter(function (k) { return k > 1; });
        if (ko.length) {
          rows.push('K 次取最好（中位数 = 分位 ' + ko.map(function (k) { return '0.5<sup>1/' + k + '</sup>'; }).join(' / ') + '）：' +
            ko.map(function (k) {
              return '打 ' + k + ' 次 → <b>' + fmtW(xs[B.firstAtLeast(dist.cum, Math.pow(0.5, 1 / k))]) + '</b>';
            }).join('　'));
        }
        rd.innerHTML = '<div class="verdict__sub" style="line-height:1.9">' + rows.join('<br>') + '</div>';

        var g1 = build1(dist, qs, xr), g2 = build2(dist, qs, ks, xr);
        last1 = g1; last2 = g2;
        charts.draw(m1.plot, g1.traces, g1.layout);
        charts.draw(m2.plot, g2.traces, g2.layout);
      }

      /* ── 悬浮卡片 ── */
      m1.wrap.addEventListener('mousemove', function (e) {
        var p = m1.pxIn(e);
        if (!p || !last1) { tip1.hide(); return; }
        var fl = m1.plot._fullLayout;
        if (!fl || !fl.xaxis || !fl.xaxis._length) return;
        var xr = fl.xaxis.range;
        var v = (xr[0] + p.x / fl.xaxis._length * (xr[1] - xr[0])) / S;   // 原始单位
        var i = 0, best = Infinity;
        for (var k = 0; k < last1.barX.length; k++) {
          var d = Math.abs(last1.barX[k] - v);
          if (d < best) { best = d; i = k; }
        }
        tip1.show(ctx.tip.card({
          title: 'DPS ' + fmtW(last1.barX[i]),
          rows: [
            ['概率', (last1.barY[i] * 100).toFixed(4) + '%'],
            ['不低于它的概率', (last1.surv[i] * 100).toFixed(1) + '%'],
          ],
        }), p.x, p.y);
      });
      m1.wrap.addEventListener('mouseleave', tip1.hide);

      m2.wrap.addEventListener('mousemove', function (e) {
        var p = m2.pxIn(e);
        if (!p || !last2) { tip2.hide(); return; }
        var fl = m2.plot._fullLayout;
        if (!fl || !fl.xaxis || !fl.xaxis._length) return;
        var xr = fl.xaxis.range;
        var v = xr[0] + p.x / fl.xaxis._length * (xr[1] - xr[0]);
        var ks = parseList(stQa(), 0, 1e9, true);
        var i = B.lastLE(last2.xs, v / S);
        var f = i >= 0 ? last2.cum[i] : 0;
        var rows = [['打 1 次', ((1 - f) * 100).toFixed(1) + '%']];
        ks.filter(function (k) { return k > 1; }).forEach(function (k) {
          rows.push(['打 ' + k + ' 次取最好', ((1 - Math.pow(f, k)) * 100).toFixed(1) + '%']);
        });
        tip2.show(ctx.tip.card({
          title: 'DPS ≥ ' + fmtW(Math.max(v / S, last2.xs[Math.max(i, 0)])) + '（累积概率 ' + (f * 100).toFixed(1) + '%）',
          rows: rows,
        }), p.x, p.y);
      });
      m2.wrap.addEventListener('mouseleave', tip2.hide);

      function stQa() { return GS.app.state.qa || ''; }

      return { plot: m1.plot, update: update };
    },
  };
})(typeof globalThis !== 'undefined' ? globalThis : this);
