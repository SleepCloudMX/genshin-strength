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
  M.rollDamage = function (s, n, b) {
    var em = C.EM_PER_ROLL * (n - b) + s.em;
    var emLinear = s.d * em + (1 - s.d) * s.em;
    return emLinear * (1 + s.bonus + C.emTerm(em)) * M.critZoneAt(b, s.cr, s.cd);
  };

  /** 黄金分割搜索最大值。 */
  M.bestSplit = function (s, n) {
    var phi = 0.6180339887;
    function f(b) { return M.rollDamage(s, n, b); }
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
      if (M.rollDamage(s, n, b) >= level * fmax) { if (lo === null) lo = b; hi = b; }
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

  /* ── 套装对比（血红之证 4 件套 vs 精通套） ── */
  M.EM_MAX = 2000;
  M.SCORE_MAX = 400;

  M.SCARLET = { em: 0, critRate: 0.16, swirlBonus: 0.40 };   // 血红之证 4 件套（固定的一方）
  /** 可切换的对比方。饰金之梦 4 件套 = 2 件套 80 + 每 1 种异元素队友 50（两种异元素 → +100）。 */
  M.EM_SETS = {
    gild2: { id: 'gild2', name: '饰金之梦', em: 180.0, critRate: 0.0, swirlBonus: 0.0 },
    em22: { id: 'em22', name: '精通 2+2', em: 160.0, critRate: 0.0, swirlBonus: 0.0 },
  };

  /** 双暴分 budget（= 2×暴击率 + 暴伤，小数）下的期望暴击区。 */
  M.critZone = function (budget, extraCritRate) {
    var total = budget + 2 * extraCritRate;
    var rate = Math.min(total / 4, 1.0);   // 暴击率上限 100%
    var dmg = total - 2 * rate;
    return 1 + rate * dmg;
  };

  /** 血红之证 / 精通套 的期望伤害比。score 为双暴分小数，不含套装特效；leg = 选中的精通套。
   *  d = 星扩散直伤占比：给定的假定常数，在图上任意位置都成立，不锚定任何面板值；
   *  反应折算精通 W = em·(1−d)/d（随该点的基准精通取），线性项 = d·(e + W) = d·e + (1−d)·em。 */
  M.ratio = function (em, score, bonus, d, leg) {
    function hit(build) {
      var e = em + build.em;
      var lin = d * e + (1 - d) * em;
      return lin * (1 + C.emTerm(e) + bonus + build.swirlBonus) * M.critZone(score, build.critRate);
    }
    return hit(M.SCARLET) / hit(leg);
  };

  /** 该双暴分下比值为 1 的精通。区间内无交点时返回 { none: 'scarlet' | 'leg' }。 */
  M.breakEven = function (score, bonus, d, leg) {
    function f(em) { return M.ratio(em, score, bonus, d, leg) - 1; }
    if (f(0) > 0) return { none: 'scarlet' };
    if (f(M.EM_MAX) <= 0) return { none: 'leg' };
    var lo = 0, hi = M.EM_MAX;
    for (var i = 0; i < 60; i++) {
      var mid = (lo + hi) / 2;
      if (f(mid) < 0) lo = mid; else hi = mid;
    }
    return { x: (lo + hi) / 2 };
  };

  /** 分界线（逐行求根的参数曲线）的坐标。 */
  M.dividerPoints = function (s, grid) {
    grid = grid || 201;
    var bx = [], by = [];
    for (var j = 0; j <= grid - 1; j++) {
      var sc = M.SCORE_MAX * j / (grid - 1);
      var root = M.breakEven(sc / 100, s.bonus, s.d, s.leg);
      if (root.x !== undefined) { bx.push(root.x); by.push(sc); }
    }
    return { bx: bx, by: by };
  };

  /* ── 伤害热图（精通 × 双暴分；口径见 1-Mizuki/4-em-crit-map.md，已归档） ── */
  M.EM_ADD_MAX = 420;                    // 精通上界：副词条精通最多 18 条 × 满值 23 ≈ 420
  M.ISO_ROLLS = [10, 20, 30, 40];        // 图上画出的等词条线（总词条预算）
  M.REF_EM = 589; M.REF_CR = 5; M.REF_CD = 50;   // 固定参照面板（跨配置比较用的标尺）
  M.REF_CAPTION = '相较精通 589 双暴 5/50 增伤 0';

  /** 参照面板 vs 本配置的抗性 / 独立乘区折算：
   *  分子 = 本配置 (1 + 基础提升) · 擢升 · κ(敌人抗性 − 减抗)，分母 = 参照面板的 κ(敌人抗性)。
   *  默认值下恒等于 1 —— 参照数与加这几项之前完全一致。 */
  M.configFactor = function (s) {
    return (1 + s.base) * s.asc * C.kappa(s.res - s.shred) / C.kappa(s.res);
  };

  /** 伤害（公共常数已约掉）：[d·精通 + (1−d)·基准精通] × (1 + 增伤 + 精通项) × 暴击区。
   *  d = 星扩散直伤占比（按基准面板处定义）；d = 1 即纯直伤。rate / dmg 为百分数。 */
  M.mapDamage = function (em, bonus, rate, dmg, s) {
    return ((1 - s.d) * s.em + s.d * em) * (1 + bonus + C.emTerm(em)) *
           (1 + (rate / 100) * (dmg / 100));
  };

  /** 双暴分 y（总量）按约束下最优拆分 → [暴击率, 暴伤]。仅 y ≥ 基准双暴分 时有解。 */
  M.splitAt = function (y, cr0, cd0) {
    var upper = Math.min(100, (y - cd0) / 2);
    var r = Math.min(Math.max(y / 4, cr0), upper);
    return [r, y - 2 * r];
  };

  /** 配不出的原因；能配返回 null。 */
  M.mapInfeasible = function (x, y, s) {
    if (x < s.em) return '低于基准精通';
    if (y < C.baseScore(s.cr, s.cd)) return '低于基准双暴分';
    if (x - s.em > M.EM_ADD_MAX) return '超过精通上限（+420）';
    var rolls = (x - s.em) / C.EM_PER_ROLL + (y - C.baseScore(s.cr, s.cd)) / C.SCORE_PER_ROLL;
    if (rolls > M.ROLL_LIMIT + 1e-9) return '超过 43 词条上限';
    return null;
  };

  /** 「配不平」：能配，但 1:2 达不到（最优拆分顶在基准一侧）。 */
  M.isPinnedBand = function (y, s) { return y < Math.max(4 * s.cr, 2 * s.cd); };
  /** 配平后顶在基准哪一侧（用于灰字提示）。 */
  M.pinnedSide = function (s) { return s.cd >= 2 * s.cr ? '暴伤' : '暴击率'; };

  /** 倍数 = D(x, y) / D(基准)。仅在能配时调用。 */
  M.multiplier = function (x, y, s) {
    var t = M.splitAt(y, s.cr, s.cd);
    return M.mapDamage(x, s.bonus, t[0], t[1], s) / M.mapDamage(s.em, s.bonus, s.cr, s.cd, s);
  };

  /** 参照倍数 = D(x, y) / D(参照面板) × 配置折算。 */
  M.refMultiplier = function (x, y, s) {
    var t = M.splitAt(y, s.cr, s.cd);
    return M.mapDamage(x, s.bonus, t[0], t[1], s) /
           M.mapDamage(M.REF_EM, 0, M.REF_CR, M.REF_CD, s) * M.configFactor(s);
  };

  /** 词条等效（用户口径，2026-10-09）：1 精通词条 = 双暴词条的 d 倍伤害。
   *  d = ΔD(精通 +1 词条) / ΔD(双暴 +1 词条)，都以「1 词条」的增量算（D 与倍数的比恒定，用倍数即可）。
   *  步进越出轴域时改用单侧差分（贴边仍可算）。 */
  function meq(c, sc, s) {
    var t = M.splitAt(sc, s.cr, s.cd);
    return M.mapDamage(c, s.bonus, t[0], t[1], s);
  }
  function fwd(c0, sc0, dc, dsc, s) {
    var f = function (c, sc) { return meq(c, sc, s); };
    var step = function (a, b) { return [c0 + a, sc0 + b]; };
    var p1 = step(dc, dsc), p0 = step(0, 0), p2 = step(-dc, -dsc);
    if (p1[0] <= s.em + M.EM_ADD_MAX && p1[1] <= C.baseScore(s.cr, s.cd) + M.ROLL_LIMIT * C.SCORE_PER_ROLL) {
      return f(p1[0], p1[1]) - f(p0[0], p0[1]);
    }
    if (p2[0] >= s.em && p2[1] >= C.baseScore(s.cr, s.cd)) {
      return f(p0[0], p0[1]) - f(p2[0], p2[1]);
    }
    return NaN;   // 域太窄（几乎不可能）
  }
  M.equivEm = function (x, y, s) {
    return fwd(x, y, C.EM_PER_ROLL, 0, s) / fwd(x, y, 0, C.SCORE_PER_ROLL, s);
  };

  /** 全图扫描：d 的最小 / 最大值（与位置）。G 为每轴网格数。 */
  M.equivRange = function (s, G) {
    G = G || 141;
    var x0 = s.em, x1 = s.em + M.EM_ADD_MAX;
    var y0 = C.baseScore(s.cr, s.cd), y1 = y0 + M.ROLL_LIMIT * C.SCORE_PER_ROLL;
    var lo = Infinity, hi = -Infinity, loAt = null, hiAt = null;
    for (var i = 0; i <= G; i++) {
      for (var j = 0; j <= G; j++) {
        var x = x0 + (x1 - x0) * i / G, y = y0 + (y1 - y0) * j / G;
        if (M.mapInfeasible(x, y, s)) continue;
        var e = M.equivEm(x, y, s);
        if (!isFinite(e)) continue;
        if (e < lo) { lo = e; loAt = [x, y]; }
        if (e > hi) { hi = e; hiAt = [x, y]; }
      }
    }
    return { lo: lo, hi: hi, loAt: loAt, hiAt: hiAt };
  };

  /** 配置级乘区 ≠ 1 时的补充说明（默认值下没有这句）。 */
  M.refFactorNote = function (s) {
    var f = M.configFactor(s);
    return Math.abs(f - 1) < 1e-4 ? '' : '含配置乘区 ×' + f.toFixed(3);
  };
  M.refLabel = function (s) {
    var n = M.refFactorNote(s);
    return n ? M.REF_CAPTION + ' · ' + n : M.REF_CAPTION;
  };

  /** 悬浮 / 结果框的内容。state: 'ok' | 'band' | 'bad'。 */
  M.pointInfo = function (x, y, s) {
    var y0 = C.baseScore(s.cr, s.cd);
    var rolls = { emRolls: (x - s.em) / C.EM_PER_ROLL, critRolls: (y - y0) / C.SCORE_PER_ROLL };
    var reason = M.mapInfeasible(x, y, s);
    if (reason) {
      return Object.assign({ state: 'bad', reason: reason, x: x, y: y,
        mult: M.multiplier(x, y, s), ref: M.refMultiplier(x, y, s) }, rolls);
    }
    var t = M.splitAt(y, s.cr, s.cd);
    return Object.assign({
      state: M.isPinnedBand(y, s) ? 'band' : 'ok',
      x: x, y: y, rate: t[0], dmg: t[1],
      mult: M.multiplier(x, y, s), ref: M.refMultiplier(x, y, s),
    }, rolls);
  };

  /** 下一个等效词条两个投向的增益（相对当前伤害）。仅在能配时调用。 */
  M.nextRollGains = function (x, y, s) {
    var t = M.splitAt(y, s.cr, s.cd);
    var D0 = M.mapDamage(x, s.bonus, t[0], t[1], s);
    var t2 = M.splitAt(y + C.SCORE_PER_ROLL, s.cr, s.cd);
    return {
      em: M.mapDamage(x + C.EM_PER_ROLL, s.bonus, t[0], t[1], s) / D0 - 1,
      crit: M.mapDamage(x, s.bonus, t2[0], t2[1], s) / D0 - 1,
    };
  };

  /** 「下一词条」的最优分配（已有词条不动）：在 α ∈ [0, 1] 上最大化 D(x + 20α, y + 6.6(1 − α))。
   *  目标沿 α 严格凹：α* = 使落下后的点命中最优分配线（边际相等）的拆分；够不到则整条给更值的一侧。 */
  M.nextAlloc = function (x, y, s) {
    function f(a) {
      return C.EM_PER_ROLL * M.dlnFdx(x + C.EM_PER_ROLL * a, s.bonus, s) -
             C.SCORE_PER_ROLL * M.dlnGdy(y + C.SCORE_PER_ROLL * (1 - a), s.cr, s.cd);
    }
    if (f(0) <= 0) return { du: 0, dv: 1 };
    if (f(1) >= 0) return { du: 1, dv: 0 };
    var lo = 0, hi = 1;
    for (var i = 0; i < 60; i++) {
      var m = (lo + hi) / 2;
      if (f(lo) * f(m) <= 0) hi = m; else lo = m;
    }
    var a = (lo + hi) / 2;
    return { du: a, dv: 1 - a };
  };

  /** 暴击区 G(y) = 1 + r·d/10⁴。 */
  M.mapCritZone = function (y, cr0, cd0) {
    var t = M.splitAt(y, cr0, cd0);
    return 1 + (t[0] / 100) * (t[1] / 100);
  };

  /** d lnF / dx（解析）：F = [d·x + (1−d)·基准精通]·(1 + 增伤 + 6x/(x+2000))。 */
  M.dlnFdx = function (x, bonus, s) {
    var dEm = C.EM_COEF * C.EM_OFFSET / ((x + C.EM_OFFSET) * (x + C.EM_OFFSET));
    return s.d / ((1 - s.d) * s.em + s.d * x) + dEm / (1 + bonus + C.emTerm(x));
  };

  /** d lnG / dy（中心差分，h = 0.1）。 */
  M.dlnGdy = function (y, cr0, cd0) {
    var h = 0.1;
    return (Math.log(M.mapCritZone(y + h, cr0, cd0)) - Math.log(M.mapCritZone(y - h, cr0, cd0))) / (2 * h);
  };

  /** 词条重要性：伤害对精通词条数、双暴词条数的梯度归一化。 */
  M.importance = function (x, y, s) {
    var gu = C.EM_PER_ROLL * M.dlnFdx(x, s.bonus, s);
    var gv = C.SCORE_PER_ROLL * M.dlnGdy(y, s.cr, s.cd);
    var t = gu + gv;
    return { em: gu / t, crit: gv / t };
  };

  /** 可行域在 y 处的右边界（精通上限 与 43 词条斜线 取小）。 */
  M.xRight = function (y, s) {
    var y0 = C.baseScore(s.cr, s.cd);
    return Math.min(
      s.em + M.EM_ADD_MAX,
      s.em + (M.ROLL_LIMIT - (y - y0) / C.SCORE_PER_ROLL) * C.EM_PER_ROLL);
  };

  /** 最优分配线（revX/revY）与等词条线交点（crosses）。只依赖 s 的标量参数、不碰热力图。 */
  M.lineAndCrosses = function (s, grid) {
    grid = grid || 201;
    var y0 = C.baseScore(s.cr, s.cd), y1 = y0 + M.ROLL_LIMIT * C.SCORE_PER_ROLL;
    var scores = [];
    for (var j = 0; j < grid; j++) scores.push(y0 + (y1 - y0) * j / (grid - 1));

    function lineX(y) {
      if (M.mapInfeasible(s.em, y, s)) return null;
      var rhs = C.SCORE_PER_ROLL * M.dlnGdy(y, s.cr, s.cd);
      function f(x) { return C.EM_PER_ROLL * M.dlnFdx(x, s.bonus, s) - rhs; }
      var a = s.em, b = M.xRight(y, s);
      if (b <= a || f(a) * f(b) > 0) return null;
      for (var k = 0; k < 40; k++) {
        var m = (a + b) / 2;
        if (f(a) * f(m) <= 0) b = m; else a = m;
      }
      return (a + b) / 2;
    }

    var revX = [], revY = [];
    scores.forEach(function (y) {
      var x = lineX(y);
      if (x != null) { revX.push(x); revY.push(y); }
    });

    // 等词条线 × 最优分配线 = 该词条数预算下的精确最优拆分（沿预算线的最大值点）
    var crosses = [];
    function nOnLine(y) {
      var x = lineX(y);
      return x == null ? null : (x - s.em) / C.EM_PER_ROLL + (y - y0) / C.SCORE_PER_ROLL;
    }
    M.ISO_ROLLS.forEach(function (nR) {
      var prevY = null, prevN = null;
      for (var y = y0; y <= y1 + 1e-9; y += 0.5) {
        var nv = nOnLine(y);
        if (nv != null && prevN != null && (prevN - nR) * (nv - nR) <= 0) {
          var lo = prevY, hi = y;
          for (var k = 0; k < 60; k++) {
            var m2 = (lo + hi) / 2;
            if ((nOnLine(lo) - nR) * (nOnLine(m2) - nR) <= 0) hi = m2; else lo = m2;
          }
          var yc = (lo + hi) / 2, xc = lineX(yc);
          if (xc >= s.em && xc <= s.em + M.EM_ADD_MAX && yc >= y0 && yc <= y1) {
            crosses.push({ x: xc, y: yc, n: nR, mult: M.multiplier(xc, yc, s) });
          }
        }
        prevY = y; prevN = nv;
      }
    });
    return { revX: revX, revY: revY, crosses: crosses };
  };

  /** [lo, hi] 内以 step 为间隔的整齐刻度。 */
  M.niceTicks = function (lo, hi, step) {
    var out = [];
    for (var v = Math.ceil(lo / step) * step; v <= hi + 1e-9; v += step) out.push(v);
    return out;
  };
})(typeof globalThis !== 'undefined' ? globalThis : this);
