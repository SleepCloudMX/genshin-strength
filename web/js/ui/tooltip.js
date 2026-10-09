/* 全站统一的悬浮卡片：白底、细边框、圆角、浅阴影；标题 + 主读数 + 两列读数 + 说明。
   自绘（不走 Plotly 原生标签），位置自动避让，不遮鼠标。 */
(function (global) {
  'use strict';
  var GS = global.GS = global.GS || {};
  var UI = GS.ui = GS.ui || {};

  function esc(s) { return String(s); }

  var tip = {
    /** 标题行（灰、小号）：位置或口径。 */
    title: function (t) { return '<div class="tip__t">' + esc(t) + '</div>'; },
    /** 主读数：大字 + 右侧口径。 */
    hero: function (v, cap, cls) {
      return '<div class="tip__hero' + (cls ? ' ' + cls : '') + '"><b>' + esc(v) + '</b>' +
             (cap ? '<span class="u">' + esc(cap) + '</span>' : '') + '</div>';
    },
    /** 两列读数（键灰、值等宽右对齐）。 */
    rows: function (rows) {
      return '<table class="tip__rows">' + rows.map(function (r) {
        return '<tr><th>' + esc(r[0]) + '</th><td>' + r[1] + '</td></tr>';
      }).join('') + '</table>';
    },
    cap: function (t, mt) { return '<div class="tip__cap' + (mt ? ' mt' : '') + '">' + esc(t) + '</div>'; },
    /** 比例条：frac ∈ [0, 1]，fill 为填充色，track 为底色。 */
    bar: function (frac, fill, track) {
      return '<div class="tip__bar"' + (track ? ' style="background:' + track + '"' : '') + '>' +
             '<i style="width:' + (Math.min(Math.max(frac, 0), 1) * 100).toFixed(0) + '%' +
             (fill ? ';background:' + fill : '') + '"></i></div>';
    },
    barlbl: function (l, r) {
      return '<div class="tip__barlbl"><span>' + l + '</span><span>' + r + '</span></div>';
    },
    div: function () { return '<div class="tip__div"></div>'; },
    bad: function (t) { return '<div class="tip__bad">' + esc(t) + '</div>'; },
    note: function (t) { return '<div class="tip__note">' + t + '</div>'; },
    sw: function (color) { return '<span class="tip__sw" style="background:' + color + '"></span>'; },

    /** 组装卡片：{ title, hero:{v,cap}, bad, rows, after, note }。 */
    card: function (o) {
      var h = '';
      if (o.title) h += tip.title(o.title);
      if (o.hero) h += tip.hero(o.hero.v, o.hero.cap, o.hero.cls);
      if (o.bad) h += tip.bad(o.bad);
      if (o.rows) h += tip.rows(o.rows);
      if (o.after) h += o.after;
      if (o.note) h += tip.note(o.note);
      return h;
    },
  };

  var GAP = 14, PAD = 6, ARROW_GAP = 6;

  /** 线段 (x1,y1)→(x2,y2) 与矩形 [rx0,ry0,rx1,ry1] 是否相交（slab 法，含边缘）. */
  function segHitsRect(x1, y1, x2, y2, rx0, ry0, rx1, ry1) {
    var dx = x2 - x1, dy = y2 - y1;
    var t0 = 0, t1 = 1;
    var p = [-dx, dx, -dy, dy];
    var q = [x1 - rx0, rx1 - x1, y1 - ry0, ry1 - y1];
    for (var i = 0; i < 4; i++) {
      if (Math.abs(p[i]) < 1e-9) { if (q[i] < 0) return false; continue; }
      var r = q[i] / p[i];
      if (p[i] < 0) { if (r > t1) return false; if (r > t0) t0 = r; }
      else { if (r < t0) return false; if (r < t1) t1 = r; }
    }
    return true;
  }

  /**
   * 挂在图表容器上。geom() 返回绘图区几何（相对 wrap），
   * 卡片坐标也用绘图区坐标（与 charts.mount 的 pxIn 一致）。
   */
  tip.mount = function (wrap, geom) {
    var doc = global.document;
    var el = doc.createElement('div');
    el.className = 'tip';
    wrap.appendChild(el);

    function place(px, py, opt) {
      var g = geom();
      var tw = el.offsetWidth, th = el.offsetHeight;
      var x = g.left + px, y = g.top + py;
      var L = g.left + PAD, T = g.top + PAD;
      var R = g.left + g.w - PAD - tw, B = g.top + g.h - PAD - th;
      // 候选象限：默认 右下 → 左下 → 右上 → 左上；avoidNE 时把右上排到最后
      var order = (opt && opt.avoidNE) ? ['se', 'sw', 'nw', 'ne'] : ['se', 'sw', 'ne', 'nw'];
      var pos = {
        se: [x + GAP, y + GAP],
        sw: [x - GAP - tw, y + GAP],
        ne: [x + GAP, y - GAP - th],
        nw: [x - GAP - tw, y - GAP - th],
      };
      // 箭头线段（像素，相对 wrap）：优先放「不与箭头相交」的象限（稳定排序，保持原偏好序）
      var segs = (opt && opt.segs) || [];
      var hits = function () {   // 当前 pos 里，哪些象限被箭头压住
        return order.map(function (k) {
          var p = pos[k];
          return segs.some(function (s) {
            return segHitsRect(s[0], s[1], s[2], s[3],
              p[0] + g.left - ARROW_GAP, p[1] + g.top - ARROW_GAP,
              p[0] + g.left + tw + ARROW_GAP, p[1] + g.top + th + ARROW_GAP);
          });
        });
      };
      if (segs.length) {
        var free = [], hit = [];
        var h0 = hits();
        order.forEach(function (k, i) { (h0[i] ? hit : free).push(k); });
        order = free.concat(hit);
        if (!free.length) {
          // 全被压：把卡片整体推远（GAP + max(箭头长) + 12），再挑一次
          var Lmax = 0;
          segs.forEach(function (s) { Lmax = Math.max(Lmax, Math.hypot(s[2] - s[0], s[3] - s[1])); });
          var G2 = GAP + Lmax + 12;
          pos = {
            se: [x + G2, y + G2],
            sw: [x - G2 - tw, y + G2],
            ne: [x + G2, y - G2 - th],
            nw: [x - G2 - tw, y - G2 - th],
          };
          free = []; hit = [];
          var h1 = hits();
          order.forEach(function (k, i) { (h1[i] ? hit : free).push(k); });
          order = free.concat(hit);
        }
      }
      var pick = null;
      for (var i = 0; i < order.length; i++) {
        var p = pos[order[i]];
        if (p[0] >= L && p[0] <= R && p[1] >= T && p[1] <= B) { pick = p; break; }
      }
      if (!pick) pick = pos[order[0]];
      el.style.left = Math.min(Math.max(pick[0], L), Math.max(R, L)) + 'px';
      el.style.top = Math.min(Math.max(pick[1], T), Math.max(B, T)) + 'px';
    }

    return {
      el: el,
      show: function (html, px, py, opt) {
        el.innerHTML = html;
        el.style.display = 'block';
        place(px, py, opt);
      },
      hide: function () { el.style.display = 'none'; },
    };
  };

  UI.tip = tip;
})(typeof globalThis !== 'undefined' ? globalThis : this);
