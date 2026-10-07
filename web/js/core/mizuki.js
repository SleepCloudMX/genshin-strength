/* 星扩散（梦见月瑞希）模型：词条分配的伤害函数与最优化辅助。
   口径见 docs/ai-output/1-Mizuki/3-em-vs-crit.md（已归档）与页面注释；
   纯函数、不碰 DOM —— Node 可直接加载做数值对照。 */
(function (global) {
  'use strict';
  var GS = global.GS = global.GS || {};
  var C = GS.core = GS.core || {};
  var M = C.mizuki = {};

  M.ROLL_LIMIT = 43;    // 副词条容量上界（满值口径）

  /** b 个双暴词条在暴击率 / 暴伤之间最优拆分后的配比（期望口径；暴击率上限 100%）。b 的单位是词条。 */
  M.allocAt = function (b, cr0, cd0) {
    var aStar = b / 2 + (cd0 / C.CD_PER_ROLL - cr0 / C.CR_PER_ROLL) / 2;
    var a = Math.min(Math.max(aStar, 0), b, (100 - cr0) / C.CR_PER_ROLL);
    return { a: a, cr: cr0 + C.CR_PER_ROLL * a, cd: cd0 + C.CD_PER_ROLL * (b - a) };
  };

  M.critZoneAt = function (b, cr0, cd0) {
    var t = M.allocAt(b, cr0, cd0);
    return 1 + (t.cr / 100) * (t.cd / 100);
  };

  /** n 个等效词条中给双暴 b 个时的伤害（任意单位，只用于比较）。
   *  直伤 ∝ EM·B·C、反应 ∝ W·B·C（两路共用乘区），按基准分配处的直伤占比 d 合成：
   *  [d·EM + (1−d)·EM0]·B·C。d = 1 即纯直伤。 */
  M.damage = function (s, n, b) {
    var em = C.EM_PER_ROLL * (n - b) + s.em;
    var emLinear = s.d * em + (1 - s.d) * s.em;
    return emLinear * (1 + s.bonus + C.emTerm(em)) * M.critZoneAt(b, s.cr, s.cd);
  };

  /** 黄金分割搜索最大值。 */
  M.bestSplit = function (s, n) {
    var phi = 0.6180339887;
    function f(b) { return M.damage(s, n, b); }
    var lo = 0, hi = n;
    var a = hi - phi * (hi - lo), b2 = lo + phi * (hi - lo);
    var fa = f(a), fb = f(b2);
    for (var i = 0; i < 80 && hi - lo > 1e-7; i++) {
      if (fa > fb) { hi = b2; b2 = a; fb = fa; a = hi - phi * (hi - lo); fa = f(a); }
      else { lo = a; a = b2; fa = fb; b2 = lo + phi * (hi - lo); fb = f(b2); }
    }
    var b = (lo + hi) / 2;
    return { b: b, f: f(b) };
  };

  /** 伤害不低于 level × fmax 的双暴词条区间（假定曲线单峰）。 */
  M.plateau = function (s, n, fmax, level) {
    // 格子随 n 加密，保证步长不超过 0.025 词条
    var steps = Math.max(800, Math.ceil(n * 40));
    var lo = null, hi = null;
    for (var i = 0; i <= steps; i++) {
      var b = n * i / steps;
      if (M.damage(s, n, b) >= level * fmax) { if (lo === null) lo = b; hi = b; }
    }
    return { lo: lo, hi: hi };
  };

  /** 解析曲线文本：逗号 / 空格 / 顿号分隔，2 ≤ n ≤ 43，至多 10 条。 */
  M.parseNs = function (txt) {
    var out = [];
    String(txt).split(/[,，\s]+/).forEach(function (tok) {
      var v = parseFloat(tok);
      if (Number.isFinite(v) && v >= 2 && v <= M.ROLL_LIMIT) out.push(v);
    });
    out.sort(function (a, b) { return a - b; });
    return out.slice(0, 10);
  };

  /** 曲线配色：viridis_r 在 [0.28, 1] 上取 11 个采样点（避开最浅的亮黄，白底上看不清）。 */
  M.RAMP = ['#4ec36b', '#2eb37c', '#1fa287', '#20928c', '#27808e', '#2e6f8e',
            '#365c8d', '#3f4889', '#46327e', '#481b6d', '#440154'];
  M.ramp = function (t) {
    var x = Math.min(Math.max(t, 0), 1) * (M.RAMP.length - 1);
    var i = Math.min(Math.floor(x), M.RAMP.length - 2), k = x - i;
    return C.mixHex(M.RAMP[i], M.RAMP[i + 1], k);
  };
})(typeof globalThis !== 'undefined' ? globalThis : this);
