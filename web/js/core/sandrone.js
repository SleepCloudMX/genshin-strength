/* 星超导（桑多涅）模型：武器表与伤害函数。
   公式与口径见 docs/ai-output/0-mechanism/3-星超导伤害机制.md；
   纯函数、不碰 DOM —— Node 可直接加载做数值对照。 */
(function (global) {
  'use strict';
  var GS = global.GS = global.GS || {};
  var C = GS.core = GS.core || {};
  var S = C.sandrone = {};

  S.CHAR_BASE = 342;        // 桑多涅 90 级基础攻击力（突破 +19.2% 暴击率）
  S.MAINS_ATK_PCT = 0.932;  // 攻攻主词条（46.6% × 2）
  S.MAINS_FLAT = 311;       // 羽主词条
  S.SET_BONUS = 0.40;       // 幻灭 4 件：星超导反应伤害 +40%
  S.SET_CR = 16;            // 幻灭 4 件：条件 +16% 暴击率（按全覆盖）——百分点，与输入一致

  S.PER_EM = C.EM_PER_ROLL;
  S.PER_CR = C.CR_PER_ROLL;
  S.PER_CD = C.CD_PER_ROLL;
  S.PER_ATK = 0.05;         // 1 个大攻击词条 = 5% 攻击
  S.PER_FLAT = 16.5;        // 1 个小攻击词条
  S.N_MAX = 53;             // 词条预算上限（约 52.9，推导见页面页脚）

  /* 武器：只计对星超导生效的常驻部分；特效按全覆盖 / 满层（note 注明）。
     atkPct = 副词条攻击%（小数）；cr / cd / extraCd = 副词条与特效的暴击率 / 暴伤（百分点，与输入一致）；
     reaction = 反应增伤（小数）。 */
  S.WEAPONS = [
    { id: 'tidal', tier: 4, name: '浪影阔剑 R5', base: 510, atkPct: 0.413, cr: 0, cd: 0, extraAtk: 0.48, extraCd: 0, reaction: 0, note: '受治疗 +48% 攻击（按全覆盖）' },
    { id: 'key', tier: 5, name: '超越之匙 R1', base: 674, atkPct: 0, cr: 0, cd: 44.1, extraAtk: 0.28, extraCd: 0, reaction: 0.48, note: '攻击 +28%；超越满层反应增伤 +48%' },
    { id: 'suns', tier: 5, name: '焚曜千阳 R1', base: 741, atkPct: 0, cr: 11.0, cd: 0, extraAtk: 0.28, extraCd: 20, reaction: 0, note: '焚光：攻击 +28%、暴伤 +20%（按全覆盖）' },
    { id: 'reed', tier: 5, name: '苇海信标 R1', base: 608, atkPct: 0, cr: 33.1, cd: 0, extraAtk: 0.40, extraCd: 0, reaction: 0, note: '战技命中 / 受击各 +20% 攻击（按全覆盖）' },
    { id: 'wolf', tier: 5, name: '狼的末路 R1', base: 608, atkPct: 0.496, cr: 0, cd: 0, extraAtk: 0.20, extraCd: 0, reaction: 0, note: '常驻攻击 +20%（斩杀队伍效果不计）' },
    { id: 'unforged', tier: 5, name: '无工之剑 R1', base: 608, atkPct: 0.496, cr: 0, cd: 0, extraAtk: 0.40, extraCd: 0, reaction: 0, note: '有盾时叠满 +40% 攻击' },
    { id: 'serpent', tier: 4, name: '螭骨剑 R5', base: 510, atkPct: 0, cr: 27.6, cd: 0, extraAtk: 0, extraCd: 0, reaction: 0, note: '增伤类特效不作用于星超导，不计' },
    { id: 'redhorn', tier: 5, name: '赤角石溃杵 R1', base: 542, atkPct: 0, cr: 0, cd: 88.2, extraAtk: 0, extraCd: 0, reaction: 0, note: '普攻 / 重击加成不作用于星超导，不计' },
  ];
  S.BASE_W = 'key';   // 指数基准：超越之匙 R1 = 100

  S.weaponById = function (id) {
    for (var i = 0; i < S.WEAPONS.length; i++) if (S.WEAPONS[i].id === id) return S.WEAPONS[i];
    return S.WEAPONS[0];
  };

  /** 基础攻击力（白值）= 角色基础 + 武器基础。 */
  S.baseAttack = function (w) { return S.CHAR_BASE + w.base; };

  /** 面板攻击力 = 基础攻击力 × (1 + 大攻击合计) + 小攻击合计（攻攻主词条、武器副词条与特效、
      面板填的额外大攻击 / 小攻击，以及攻击词条的大攻击都进利率；羽与面板小攻击进常数项）。 */
  S.panelAttack = function (w, extraPct, extraFlat, zRolls) {
    return S.baseAttack(w) *
      (1 + S.MAINS_ATK_PCT + w.atkPct + w.extraAtk + extraPct + S.PER_ATK * (zRolls || 0)) +
      S.MAINS_FLAT + (extraFlat || 0);
  };

  /** 配平不可达（与瑞希同义）：1:2 拆分被一端卡住。被压的是暴伤还是暴击率（两者相反）。
   *  卡点看拆分端点：暴击率顶 100% → 暴伤被压；暴伤停在基准 → 暴击率侧超额。 */
  S.critBand = function (s, y) {
    var cr0 = s.cr + S.SET_CR + s.weapon.cr, cd0 = s.cd + s.weapon.cd + s.weapon.extraCd;
    var t = S.critSplit(cr0, cd0, y);
    return Math.abs(t.cr - 100) < 1e-6 || Math.abs(t.cd - cd0) < 1e-6;
  };
  /** 不可达时被压在基准的那一侧：'暴伤' / '暴击率'（页卡红字用，与瑞希 pinnedSide 同义）。 */
  S.pinnedSide = function (s, y) {
    var cr0 = s.cr + S.SET_CR + s.weapon.cr, cd0 = s.cd + s.weapon.cd + s.weapon.extraCd;
    var t = S.critSplit(cr0, cd0, y);
    return Math.abs(t.cd - cd0) < 1e-6 ? '暴伤' : '暴击率';
  };

  /** b 个双暴词条在暴击率 / 暴伤之间最优拆分后的配比（期望口径；暴击率上限 100%）。b 的单位是词条。 */
  S.critSplit = function (cr0, cd0, b) {
    var aStar = b / 2 + (cd0 / S.PER_CD - cr0 / S.PER_CR) / 2;
    var a = Math.min(Math.max(aStar, 0), b, (100 - cr0) / S.PER_CR);
    return { cr: cr0 + S.PER_CR * a, cd: cd0 + S.PER_CD * (b - a) };
  };

  /** 一套分配下的伤害指数（倍率 = 1）。x / y = 精通 / 双暴词条数；z（攻击）= 预算里剩余的部分。 */
  S.damage = function (s, x, y) {
    var z = s.n - x - y;
    if (z < 0) return null;
    var w = s.weapon;
    var atk = S.panelAttack(w, s.extraPct, s.extraFlat, z);
    var em = s.em + S.PER_EM * x;
    var bracket = 1 + C.emTerm(em) + s.bonus + w.reaction + S.SET_BONUS;
    var crit = S.critSplit(s.cr + S.SET_CR + w.cr, s.cd + w.cd + w.extraCd, y);
    return atk * bracket * (1 + Math.min(crit.cr, 100) / 100 * crit.cd / 100);
  };

  /** 该武器在给定预算下的最优分配（网格扫描）。 */
  S.bestFor = function (w, s) {
    var sw = Object.assign({}, s, { weapon: w });
    var best = { x: 0, y: 0, d: -1 };
    var G = 141;
    for (var i = 0; i <= G; i++) {
      for (var j = 0; j <= G; j++) {
        var x = i * sw.n / G, y = j * sw.n / G;
        var d = S.damage(sw, x, y);
        if (d !== null && d > best.d) best = { x: x, y: y, d: d };
      }
    }
    return best;
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
    return { xs: xs, zs: zs, best: best, base0: base0 };
  };

  /** 词条等效（用户口径，2026-10-09）：1 该词条 = 双暴词条的 d 倍伤害（保留符号：负值 =
   *  该词条在该点减值，如精通 / 双暴已过饱和）。按「每点相对增益」算，三种词条同一量纲：
   *    d = (∂D/∂该词条 ÷ D) / (∂D/∂双暴词条 ÷ D)，求导用中心差分（h = 0.05 点）。
   *  z = 0（预算已满，攻击词条无空间）时攻击行无定义（NaN）。 */
  function multAt(s, x, y, z) {
    if (z === undefined) z = s.n - x - y;
    if (z < -1e-9) return null;
    var em = s.em + S.PER_EM * x;
    var bracket = 1 + C.emTerm(em) + s.bonus + S.SET_BONUS;
    var t = S.critSplit(s.cr + S.SET_CR + s.weapon.cr, s.cd + s.weapon.cd + s.weapon.extraCd, y);
    return S.panelAttack(s.weapon, s.extraPct, s.extraFlat, z) * bracket *
           (1 + Math.min(t.cr, 100) / 100 * t.cd / 100);
  }
  S.equiv = function (s, x, y) {
    var z = s.n - x - y;
    if (z < -1e-9) return { em: NaN, atk: NaN };
    var h = 0.05;
    var m0 = multAt(s, x, y, z);
    var gEm = (multAt(s, x + h, y, z) - multAt(s, x - h, y, z)) / (2 * h) / m0;   // 精通点边际
    var gCr = (multAt(s, x, y + h, z) - multAt(s, x, y - h, z)) / (2 * h) / m0;   // 双暴点边际
    var gAt = z >= h ? ((multAt(s, x, y, z + h) - multAt(s, x, y, z - h)) / (2 * h) / m0) : NaN;   // 攻击点边际
    if (Math.abs(gCr) < 1e-12) return { em: NaN, atk: NaN };
    return { em: gEm / gCr, atk: gAt / gCr };
  };
  /** 全图（x, y ≥ 0、x + y ≤ n）扫描 d 的范围与位置。 */
  S.equivRange = function (s, G) {
    G = G || 141;
    var lo = { em: Infinity, atk: Infinity }, hi = { em: -Infinity, atk: -Infinity };
    var loAt = {}, hiAt = {};
    for (var i = 0; i <= G; i++) {
      for (var j = 0; j <= G; j++) {
        var x = s.n * i / G, y = s.n * j / G;
        if (x + y > s.n + 1e-9) continue;
        var e = S.equiv(s, x, y);
        if (isFinite(e.em)) {
          if (e.em < lo.em) { lo.em = e.em; loAt.em = [x, y]; }
          if (e.em > hi.em) { hi.em = e.em; hiAt.em = [x, y]; }
        }
        if (isFinite(e.atk)) {
          if (e.atk < lo.atk) { lo.atk = e.atk; loAt.atk = [x, y]; }
          if (e.atk > hi.atk) { hi.atk = e.atk; hiAt.atk = [x, y]; }
        }
      }
    }
    return { lo: lo, hi: hi, loAt: loAt, hiAt: hiAt };
  };

  /** 单点伤害倍数（x + y + z = n），公开给模块与探针用。 */
  S.multAt = function (s, x, y, z) { return multAt(s, x, y, z); };

  /** 三类词条各 +1 的边际增益（相对当前点）：
   *  下一词条分配：精通 x+1（z−1）、双暴 y+1（z−1）、攻击 z+1（其他不动）—— 一整个 k 词条拆三份的候选；
   *  归一化梯度：三类都 +1 词条的大小（z 相对少 1）—— 纯边际，量纲一致。 */
  S.wordGains = function (s, x, y) {
    var z = s.n - x - y;
    if (z < -1e-9) return null;
    var m0 = multAt(s, x, y, z);
    if (m0 === null) return null;
    var g = function (m) { return m === null ? NaN : m / m0 - 1; };
    return {
      em: g(multAt(s, x + 1, y, z - 1)),
      crit: g(multAt(s, x, y + 1, z - 1)),
      atk: g(multAt(s, x, y, z + 1)),
    };
  };
  S.gradWeights = function (s, x, y) {
    var z = s.n - x - y;
    if (z < -1e-9) return null;
    var m0 = multAt(s, x, y, z);
    if (m0 === null) return null;
    var g = function (m) { return m === null ? NaN : m / m0 - 1; };
    var w = { em: g(multAt(s, x + 1, y, z)), crit: g(multAt(s, x, y + 1, z)), atk: g(multAt(s, x, y, z + 1)) };
    var t = (isFinite(w.em) ? Math.abs(w.em) : 0) + (isFinite(w.crit) ? Math.abs(w.crit) : 0) + (isFinite(w.atk) ? Math.abs(w.atk) : 0);
    if (!isFinite(t) || t <= 1e-12) return { em: 1 / 3, crit: 1 / 3, atk: 1 / 3 };
    return { em: Math.abs(w.em) / t, crit: Math.abs(w.crit) / t, atk: Math.abs(w.atk) / t };
  };

  /** 下一词条最优分配：在三角形 x′+y′+z′ = 1（三类各占一份）上最大化伤害 —— 直接网格扫描。 */
  S.nextAlloc = function (s, x, y) {
    var z = s.n - x - y;
    if (z < -1e-9) return { em: NaN, crit: NaN, atk: NaN };
    var m0 = multAt(s, x, y, z);
    if (m0 === null) return { em: NaN, crit: NaN, atk: NaN };
    var best = null, bestV = -Infinity;
    var G = 60;
    for (var i = 0; i <= G; i++) {
      for (var j = 0; i + j <= G; j++) {
        var a = i / G, b = j / G, c = 1 - a - b;
        var m = multAt(s, x + a, y + b, z + c);
        if (m !== null && m > bestV) { bestV = m; best = { em: a, crit: b, atk: c }; }
      }
    }
    return best || { em: NaN, crit: NaN, atk: NaN };
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
})(typeof globalThis !== 'undefined' ? globalThis : this);
