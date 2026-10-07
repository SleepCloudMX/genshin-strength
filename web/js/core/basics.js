/* 基础专题（与角色无关）的模型：抗性区。暴击两页的模型见同文件下方。
   纯函数、不碰 DOM —— Node 可直接加载做数值对照。 */
(function (global) {
  'use strict';
  var GS = global.GS = global.GS || {};
  var C = GS.core = GS.core || {};
  var B = C.basics = {};

  /* ── 抗性区 ── */
  B.KNEE = 0.75;          // 分段折点
  B.R_COMMON = 0.10;      // 多数敌人的抗性（等效血量的基准）
  B.R_HIGH = 0.70;        // 常见高抗敌人

  /** 收益倍数 = 减抗后的抗性系数 ÷ 减抗前的抗性系数。 */
  B.gain = function (r0, S) { return C.kappa(r0 - S) / C.kappa(r0); };

  /** 等效血量 = 同一减抗下，r0 抗性敌人相对 10% 抗性敌人的倍数。 */
  B.eqHp = function (r0, S) { return C.kappa(B.R_COMMON - S) / C.kappa(r0 - S); };

  /** 每 1 点减抗的相对收益（分段导数；乘 100 即百分比）。 */
  B.marginal = function (r) {
    if (r < 0) return 0.5 / (1 - r / 2);
    if (r < B.KNEE) return 1 / (1 - r);
    return 4 / (4 * r + 1);
  };

  /* ── 暴击：波动（一次尝试的 DPS 分布） ── */
  // 每段：n 次独立判定，暴击次数 ~ Binomial(n, p)；损伤 = V0 × (n + d·b)
  // 多段：各段分布的卷积（精确）。读数为概率质量的直接求和。

  /** 二项 PMF：log 空间递推（(1-p)^n 在 n 大 / p 高时下溢）。 */
  B.binomPMF = function (n, p) {
    var a = new Float64Array(n + 1);
    if (p <= 0) { a[0] = 1; return a; }
    if (p >= 1) { a[n] = 1; return a; }
    var lg = new Float64Array(n + 1);
    lg[0] = n * Math.log1p(-p);
    var step = Math.log(p) - Math.log1p(-p);
    var mx = lg[0];
    for (var k = 0; k < n; k++) {
      lg[k + 1] = lg[k] + Math.log((n - k) / (k + 1)) + step;
      if (lg[k + 1] > mx) mx = lg[k + 1];
    }
    var s = 0;
    for (var i = 0; i <= n; i++) { a[i] = Math.exp(lg[i] - mx); s += a[i]; }
    for (var j = 0; j <= n; j++) a[j] /= s;
    return a;
  };

  B.cumOf = function (pmf) {
    var c = new Float64Array(pmf.length);
    var acc = 0;
    for (var i = 0; i < pmf.length; i++) { acc += pmf[i]; c[i] = acc; }
    return c;
  };

  /** 最小 b 使 F(b) ≥ q（F 单调，二分；离散分布的分位约定见页面页脚）。 */
  B.firstAtLeast = function (cum, q) {
    if (q <= 0) return 0;
    var lo = 0, hi = cum.length - 1;
    while (lo < hi) {
      var mid = (lo + hi) >> 1;
      if (cum[mid] >= q - 1e-12) hi = mid; else lo = mid + 1;
    }
    return lo;
  };

  /** 一次尝试的 DPS 分布：segs = [{non, cd, cr, n, t}] → 值 / 概率 / 累积 / 期望 / σ。 */
  B.buildDist = function (segs) {
    var map = new Map([[0, 1]]);
    for (var si = 0; si < segs.length; si++) {
      var s = segs[si];
      var pmf = B.binomPMF(s.n, s.cr);
      var base = (s.non * s.n) / s.t, step = (s.non * s.cd) / s.t;
      var next = new Map();
      map.forEach(function (p, k) {
        for (var b = 0; b <= s.n; b++) {
          var w = pmf[b];
          if (w === 0) continue;
          var key = k + Math.round((base + step * b) * 1e6);
          next.set(key, (next.get(key) || 0) + p * w);
        }
      });
      if (next.size > 2e6) return null;
      map = next;
    }
    var keys = Array.from(map.keys()).sort(function (a, b) { return a - b; });
    var xs = new Float64Array(keys.length), ps = new Float64Array(keys.length);
    for (var i = 0; i < keys.length; i++) { xs[i] = keys[i] / 1e6; ps[i] = map.get(keys[i]); }
    var cum = new Float64Array(keys.length);
    var acc = 0;
    for (var j = 0; j < keys.length; j++) { acc += ps[j]; cum[j] = acc; }
    var mean = 0, v2 = 0;
    for (var m = 0; m < xs.length; m++) mean += xs[m] * ps[m];
    for (var q = 0; q < xs.length; q++) v2 += ps[q] * (xs[q] - mean) * (xs[q] - mean);
    return { xs: xs, ps: ps, cum: cum, mean: mean, sd: Math.sqrt(v2), min: xs[0], max: xs[xs.length - 1] };
  };

  /** 最后一个 ≤ x 的下标（没有则 −1）。 */
  B.lastLE = function (xs, x) {
    var lo = 0, hi = xs.length - 1, ans = -1;
    while (lo <= hi) {
      var mid = (lo + hi) >> 1;
      if (xs[mid] <= x) { ans = mid; lo = mid + 1; } else hi = mid - 1;
    }
    return ans;
  };

  /** [lo, hi] 上的概率质量（容差：μ±kσ 与支撑点常恰好重合）。 */
  B.covBetween = function (dist, lo, hi) {
    var xs = dist.xs, cum = dist.cum, ps = dist.ps;
    var eps = (xs[xs.length - 1] - xs[0]) * 1e-9 + 1e-12;
    var hiI = B.lastLE(xs, hi + eps), loI = B.lastLE(xs, lo - eps);
    var c = (hiI >= 0 ? cum[hiI] : 0) - (loI >= 0 ? cum[loI] : 0);
    if (loI >= 0 && xs[loI] >= lo - eps) c += ps[loI];
    return Math.min(1, Math.max(0, c));
  };

  /** 分布图的横轴范围（原始单位）：左端截到 1% 分位、右端到全暴。 */
  B.xRangeOf = function (dist) {
    var xs = dist.xs, cum = dist.cum, min = dist.min, max = dist.max;
    var loRaw = xs[B.firstAtLeast(cum, 0.01)];
    var span = max - loRaw;
    if (span <= 0) {
      var p = Math.max(Math.abs(max) * 0.1, 1);
      return { lo: max - p / 2, hi: max + p / 2, trimmed: false };
    }
    return { lo: loRaw - span * 0.01, hi: max + span * 0.03, trimmed: loRaw > min + 1e-9 };
  };

  /* ── 暴击：分配（固定双暴分、按分位数分配） ── */

  /** 分配扫描：固定双暴分 V（小数），扫暴击率 = c，暴伤 = V − 2c；返回每个 q 的 Q(c)（单位为 V0）。 */
  B.sweepB = function (V, n, qList) {
    var cmax = Math.min(1, V / 2), M = 4000;
    var cgrid = new Float64Array(M + 1), mean = new Float64Array(M + 1);
    var qv = qList.map(function () { return new Float64Array(M + 1); });
    for (var i = 0; i <= M; i++) {
      var c = cmax * i / M, d = V - 2 * c;
      cgrid[i] = c;
      mean[i] = n * (1 + c * d);
      var cum = B.cumOf(B.binomPMF(n, c));
      for (var j = 0; j < qList.length; j++) qv[j][i] = n + d * B.firstAtLeast(cum, qList[j]);
    }
    return { cmax: cmax, cgrid: cgrid, mean: mean, qv: qv };
  };

  /** 单个 (c = V/4) 处的 Q，用于「1:2 的对照」。 */
  B.qAt12 = function (V, n, q) {
    var c = Math.min(V / 4, 1), d = V - 2 * c;
    var cum = B.cumOf(B.binomPMF(n, c));
    return n + d * B.firstAtLeast(cum, q);
  };

  /** 网格上取最大（并列时取更小的暴击率）。 */
  B.optimalOf = function (arr, cgrid) {
    var best = -Infinity, c = 0;
    for (var i = 0; i < arr.length; i++) if (arr[i] > best + 1e-12) { best = arr[i]; c = cgrid[i]; }
    return { Q: best, c: c };
  };
})(typeof globalThis !== 'undefined' ? globalThis : this);
