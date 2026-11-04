/* 米提亚（星超导 / 元素精通倍率）模型：伤害函数与分配工具。
   公式与口径见 docs/ai-output/0-mechanism/5-米提亚伤害机制.md；
   纯函数、不碰 DOM —— Node 可直接加载做数值对照。

   口径：单段 = 10 级「递变聚爆」消耗 1 枚信标的星超导雷伤（403.2% 元素精通）。
   s = { em, cr, cd, bFlat, bonus, k, f, res, asc, n }：
     em / cr / cd = 基准面板（不含副词条）；bFlat = 队友的基础提升（奥黛塔 14%）；
     bonus = 星超导增伤 S（小数）；k = 星超导系数；f = 额外提升；res = 抗性系数；
     asc = 擢升乘数（1 + 擢升）；n = 词条预算。
   攻击力不进入公式（米提亚的星超导是精通倍率）。 */
(function (global) {
  'use strict';
  var GS = global.GS = global.GS || {};
  var C = GS.core = GS.core || {};
  var S = C.mitya = {};

  S.COEF = 4.032;             // 403.2% 元素精通（10 级）
  S.EM_PER_ROLL = C.EM_PER_ROLL;
  S.CR_PER_ROLL = C.CR_PER_ROLL;
  S.CD_PER_ROLL = C.CD_PER_ROLL;
  S.B_PER_EM = 0.00028;       // A6：每点精通 +0.028% 星超导基础伤害
  S.B_CAP = 0.14;             // 500 精通吃满
  S.N_DEF = 30;               // 默认词条预算
  S.N_MAX = 50;
  S.K_MAX = 12;

  /** 星超导系数：0 层 = 1.0；1–12 层 = 1.4 + 0.05 × 层数。 */
  S.kOf = function (layers) {
    layers = C.clamp(Number(layers) || 0, 0, S.K_MAX);
    return layers < 1 ? 1 : 1.4 + 0.05 * layers;
  };

  /** 双暴分配：y 个双暴词条在暴击率 / 暴伤之间最优拆分（期望口径）。
      只加不减：暴伤过高时先把暴击率补到 1 : 2 或 100%，不削减基准暴伤；
      1 : 2 不可达不是异常，按实际可达的最优算（页面不画配平警示线）。 */
  S.critSplit = function (cr0, cd0, y) {
    var aStar = y / 2 + (cd0 / S.CD_PER_ROLL - cr0 / S.CR_PER_ROLL) / 2;
    var a = Math.min(Math.max(aStar, 0), y, (100 - cr0) / S.CR_PER_ROLL);
    return { cr: cr0 + S.CR_PER_ROLL * a, cd: cd0 + S.CD_PER_ROLL * (y - a), a: a };
  };

  /** 单点详情：x = 精通词条、y = 双暴词条；域外（x + y > n）返回 null。
      所有中间量都在返回值里，页面读数与公式面板共用同一套口径。 */
  S.detail = function (s, x, y) {
    if (x < -1e-9 || y < -1e-9 || x + y > s.n + 1e-9) return null;
    var em = s.em + S.EM_PER_ROLL * x;
    var bOwn = Math.min(S.B_PER_EM * em, S.B_CAP);
    var b = 1 + bOwn + (s.bFlat || 0);
    var e = C.emTerm(em);
    var bracket = 1 + e + (s.bonus || 0);
    var k = s.k || 1;
    var f = s.f || 0;
    var core = k * S.COEF * em * b * bracket;
    var base = core + f;
    var t = S.critSplit(s.cr, s.cd, y);
    var cr = Math.min(t.cr, 100);
    var res = s.res === undefined ? 1 : s.res;
    var asc = s.asc === undefined ? 1 : s.asc;
    return {
      x: x, y: y, z: s.n - x - y,
      em: em, bOwn: bOwn, b: b, e: e, bracket: bracket,
      k: k, f: f, core: core, base: base,
      res: res, asc: asc,
      cr: cr, cd: t.cd, critRolls: t.a,
      exp: base * res * (1 + cr / 100 * t.cd / 100) * asc,
      crit: base * res * (1 + t.cd / 100) * asc,
      noncrit: base * res * asc,
    };
  };

  S.damage = function (s, x, y) {
    var d = S.detail(s, x, y);
    return d ? d.exp : null;
  };

  /** 局部细化：从 (x0, y0) 出发做模式搜索（8 邻域，无改进则步长减半）。 */
  function refine(s, x0, y0, d0, step0) {
    var step = step0, bx = x0, by = y0, bd = d0;
    for (var k = 0; k < 160 && step > 1e-9; k++) {
      var improved = false;
      for (var ix = -1; ix <= 1; ix++) {
        for (var iy = -1; iy <= 1; iy++) {
          if (!ix && !iy) continue;
          var x = bx + ix * step, y = by + iy * step;
          if (x < -1e-12 || y < -1e-12 || x + y > s.n + 1e-12) continue;
          var d = S.damage(s, x, y);
          if (d !== null && d > bd + 1e-14) { bx = x; by = y; bd = d; improved = true; }
        }
      }
      if (!improved) step *= 0.5;
    }
    return { x: bx, y: by, d: bd };
  }

  /** 给定完整面板的最优分配（141 网格 + 局部细化）。 */
  S.bestFor = function (s) {
    var best = { x: 0, y: 0, d: -1 };
    var G = 141;
    for (var i = 0; i <= G; i++) {
      for (var j = 0; i + j <= G; j++) {
        var x = i * s.n / G, y = j * s.n / G;
        var d = S.damage(s, x, y);
        if (d !== null && d > best.d) best = { x: x, y: y, d: d };
      }
    }
    return refine(s, best.x, best.y, best.d, s.n / G);
  };

  /** 各档词条总数下的最优分配（曲线 / 套装对比页用）。 */
  S.bestPath = function (s, nmax, step) {
    step = step || 0.25;
    var cnt = Math.round(nmax / step), out = [];
    for (var k = 0; k <= cnt; k++) {
      var n = Math.min(nmax, k * step);
      var sn = Object.assign({}, s, { n: n });
      var b = n > 1e-9 ? S.bestFor(sn) : { x: 0, y: 0, d: S.damage(sn, 0, 0) };
      out.push({ n: n, x: b.x, y: b.y, d: b.d });
    }
    return out;
  };

  /** 全网格扫描：相对基准面板的倍数（域外 null）与最优分配。 */
  S.scan = function (s, G) {
    G = G || 121;
    var step = s.n / (G - 1);
    var xs = Array.from({ length: G }, function (_, i) { return i * step; });
    var base0 = S.damage(Object.assign({}, s, { n: 0 }), 0, 0);
    var best = { x: 0, y: 0, v: -1, d: -1 };
    var zs = xs.map(function (y) {
      return xs.map(function (x) {
        var d = S.damage(s, x, y);
        if (d === null) return null;
        var v = d / base0;
        if (v > best.v) best = { x: x, y: y, v: v, d: d };
        return v;
      });
    });
    var rb = refine(s, best.x, best.y, best.d, step);
    return { xs: xs, zs: zs, best: { x: rb.x, y: rb.y, v: rb.d / base0, d: rb.d }, base0: base0 };
  };

  function multAt(s, x, y) {
    var d = S.detail(s, x, y);
    return d ? d.exp : null;
  }

  /** 词条等效：1 个精通词条 = d 个双暴词条（保留符号）。
      按每点相对增益之比，中心差分 h = 0.05 词条；贴边界退化单侧。 */
  S.equiv = function (s, x, y) {
    var h = 0.05;
    var m0 = multAt(s, x, y);
    if (m0 === null) return { em: NaN };
    var xm = x - h >= 0 ? multAt(s, x - h, y) : null;
    var xp = x + y + h <= s.n ? multAt(s, x + h, y) : null;
    var ym = y - h >= 0 ? multAt(s, x, y - h) : null;
    var yp = x + y + h <= s.n ? multAt(s, x, y + h) : null;
    var gEm = xm !== null && xp !== null ? (xp - xm) / (2 * h) / m0 :
      xp !== null ? (xp - m0) / h / m0 : xm !== null ? (m0 - xm) / h / m0 : NaN;
    var gCr = ym !== null && yp !== null ? (yp - ym) / (2 * h) / m0 :
      yp !== null ? (yp - m0) / h / m0 : ym !== null ? (m0 - ym) / h / m0 : NaN;
    if (!isFinite(gEm) || !isFinite(gCr) || Math.abs(gCr) < 1e-12) return { em: NaN };
    return { em: gEm / gCr };
  };

  /** 全图（x, y ≥ 0、x + y ≤ n）扫描 d 的范围与位置。 */
  S.equivRange = function (s, G) {
    G = G || 121;
    var lo = Infinity, hi = -Infinity, loAt = null, hiAt = null;
    for (var i = 0; i <= G; i++) {
      for (var j = 0; i + j <= G; j++) {
        var x = s.n * i / G, y = s.n * j / G;
        var e = S.equiv(s, x, y).em;
        if (isFinite(e)) {
          if (e < lo) { lo = e; loAt = [x, y]; }
          if (e > hi) { hi = e; hiAt = [x, y]; }
        }
      }
    }
    return { lo: lo, hi: hi, loAt: loAt, hiAt: hiAt };
  };

  /** 伤害对数的梯度（中心差分 h = 0.05 词条；贴边界退化为单侧差分）。 */
  S.grad = function (x, y, s) {
    var h = 0.05;
    function f(xx, yy) {
      if (xx < 0 || yy < 0 || xx + yy > s.n) return null;
      var d = S.damage(s, xx, yy);
      return d === null ? null : Math.log(d);
    }
    var f00 = f(x, y);
    function one(a, b) {
      if (a !== null && b !== null) return (b - a) / (2 * h);
      if (b !== null) return (b - f00) / h;
      if (a !== null) return (f00 - a) / h;
      return 0;
    }
    return { gx: one(f(x - h, y), f(x + h, y)), gy: one(f(x, y - h), f(x, y + h)) };
  };

  /** 归一化梯度（两维）：预算未满时看「各加 1 条」；预算已满时看「挪 1 条」。
      只保留能提升伤害的方向（正增益）；两者都为 0 时表示当前点已最优。
      返回 {em, crit, gEm, gCrit, best}，em + crit = 1（best 时两者为 0）。 */
  S.gradWeights = function (s, x, y) {
    var z = s.n - x - y;
    var m0 = multAt(s, x, y);
    if (m0 === null) return null;
    var g = function (m) { return m === null ? NaN : m / m0 - 1; };
    var gEm, gCrit;
    if (z > 1e-9) {
      gEm = g(multAt(s, x + 1, y));
      gCrit = g(multAt(s, x, y + 1));
    } else {
      gEm = y >= 1 ? g(multAt(s, x + 1, y - 1)) : NaN;
      gCrit = x >= 1 ? g(multAt(s, x - 1, y + 1)) : NaN;
    }
    var pEm = isFinite(gEm) && gEm > 0 ? gEm : 0;
    var pCrit = isFinite(gCrit) && gCrit > 0 ? gCrit : 0;
    var t = pEm + pCrit;
    if (t <= 1e-12) return { em: 0, crit: 0, gEm: gEm, gCrit: gCrit, best: true };
    return { em: pEm / t, crit: pCrit / t, gEm: gEm, gCrit: gCrit, best: false };
  };
})(typeof globalThis !== 'undefined' ? globalThis : this);
