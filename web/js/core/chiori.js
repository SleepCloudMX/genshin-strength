/* 千织（岩伤 / 「袖」斩切口径）模型：伤害函数与武器表。
   公式与口径见 docs/ai-output/0-mechanism/4-千织伤害机制.md；
   纯函数、不碰 DOM —— Node 可直接加载做数值对照。

   口径：伤害函数只吃「已合成的面板字段」——
   s = { baseAtk, atkPct, baseDef, defPct, fatk, fdef, cr, cd, bonus, n }，
   外加武器附加字段（eFlatDef / eFlatEm / dmgFlat / dmgPerDef…，见 damage 注释）。
   武器 / 圣遗物 / 队友 buff 的贡献由各页自己合成（面板里逐项填写，见「明细」）。 */
(function (global) {
  'use strict';
  var GS = global.GS = global.GS || {};
  var C = GS.core = GS.core || {};
  var S = C.chiori = {};

  S.CHAR_ATK = 300;        // 千织 80 级突破基础攻击力
  S.CHAR_DEF = 886;        // 千织 80 级突破基础防御力
  S.E_COEF_ATK = 1.48;     // 「袖」斩切（10 级）攻击力系数
  S.E_COEF_DEF = 1.85;     // 防御力系数 = 1.48 × 1.25（各部件恒此比例，精确数据下严格成立）

  /* 三个伤害部件（均 10 级）：label = 界面短标签，a / d = 攻击力 / 防御力系数；
     eSkill = 是否吃武器「战技附加伤害」项（eFlatDef / eFlatEm）—— Q 不吃。 */
  S.PARTS = [
    { name: 'E「袖」斩切', label: 'E 每跳', a: S.E_COEF_ATK, d: S.E_COEF_DEF, eSkill: true },
    { name: 'E 上挑',     label: 'E 上挑', a: 2.69, d: 3.36, eSkill: true },
    { name: 'Q 伤害',     label: 'Q 伤害', a: 4.61, d: 5.77, eSkill: false },
  ];

  /* 敌人区固定假设（2026-10-16 用户定；页面公式面板与机制文档均注明）：角色 90 级、敌人 110 级、
     全抗 10%、减防 / 无视防御 0。防御系数按角色 90 级固定，与面板手填基础值的等级无关 ——
     刻意简化：不做等级参数与各等级基础属性表。 */
  S.LV_CHAR = 90;
  S.LV_ENEMY = 110;
  S.ENEMY_RES = 0.10;
  S.DEF_FACTOR = (S.LV_CHAR + 100) / ((S.LV_CHAR + 100) + (S.LV_ENEMY + 100));   // 0.475
  S.RES_FACTOR = 1 - S.ENEMY_RES;                                               // 0.90

  S.PER_ATK = 0.05;        // 1 大攻击词条 = 5% 攻击
  S.PER_DEF = 0.062;       // 1 大防御词条 = 6.2% 防御
  S.PER_FLAT = 16.5;       // 1 小攻击词条
  S.PER_FLAT_DEF = 19.7;   // 1 小防御词条
  S.PER_CR = C.CR_PER_ROLL;   // 1 双暴词条 = 3.3% 暴击 / 6.6% 暴伤
  S.PER_CD = C.CD_PER_ROLL;
  S.N_MAX = 50;            // 词条预算上限（估算见页脚）

  /** 面板攻击力 = 基础攻击力 × (1 + 大攻击 + 攻击词条的大攻击) + 小攻击。 */
  S.panelAtk = function (baseAtk, atkPct, fatk, zRolls) {
    return baseAtk * (1 + (atkPct || 0) + S.PER_ATK * (zRolls || 0)) + (fatk || 0);
  };
  /** 面板防御力 = 基础防御力 × (1 + 大防御 + 防御词条的大防御) + 小防御。 */
  S.panelDef = function (baseDef, defPct, fdef, wRolls) {
    return baseDef * (1 + (defPct || 0) + S.PER_DEF * (wRolls || 0)) + (fdef || 0);
  };

  /** 配平不可达（同桑多涅口径）：双暴词条太少、暴伤被压在基准。
      暴击率顶到 100% 不算配不平。 */
  S.critBand = function (s, y) {
    return y < (s.cd - 2 * s.cr) / S.PER_CD - 1e-9;
  };
  S.bandY = function (s) {
    return Math.max(0, (s.cd - 2 * s.cr) / S.PER_CD);
  };

  /** b 个双暴词条在暴击率 / 暴伤之间最优拆分后的配比（期望口径；暴击率上限 100%）。 */
  S.critSplit = function (cr0, cd0, b) {
    var aStar = b / 2 + (cd0 / S.PER_CD - cr0 / S.PER_CR) / 2;
    var a = Math.min(Math.max(aStar, 0), b, (100 - cr0) / S.PER_CR);
    return { cr: cr0 + S.PER_CR * a, cd: cd0 + S.PER_CD * (b - a) };
  };

  /** 一套分配下某部件的期望 / 暴击 / 未暴击伤害（公共乘区已约掉）。part 取 S.PARTS 之一，默认「袖」斩切。
      x = 防御词条、y = 双暴词条、攻击词条 = 预算剩余；暴击区分别取 1 + 暴击率 × 暴伤 / 1 + 暴伤 / 1。
      武器附加字段（可选）：eFlatDef = 战技附加伤害系数 × 防御力（辰砂）、
      eFlatEm = × 元素精通（裁叶）—— 仅 eSkill 部件；dmgFlat = 额外伤害加成（小数）、
      dmgPerDef / dmgPerDefCap = 按面板防御折算的额外伤害加成（岩峰，含上限）。 */
  S.damageSplit = function (s, x, y, part) {
    part = part || S.PARTS[0];
    var z = s.n - x - y;
    if (z < -1e-9) return null;
    var atk = S.panelAtk(s.baseAtk, s.atkPct, s.fatk, z);
    var def = S.panelDef(s.baseDef, s.defPct, s.fdef, x);
    var base = part.a * atk + part.d * def +
      (part.eSkill ? (s.eFlatDef || 0) * def + (s.eFlatEm || 0) * (s.em || 0) : 0);
    var bonus = s.bonus + (s.dmgFlat || 0) +
      (s.dmgPerDef ? Math.min(s.dmgPerDefCap || Infinity, s.dmgPerDef * def) : 0);
    var crit = S.critSplit(s.cr, s.cd, y);
    var b = base * (1 + bonus);
    return {
      exp: b * (1 + Math.min(crit.cr, 100) / 100 * crit.cd / 100),
      crit: b * (1 + crit.cd / 100),
      noncrit: b,
    };
  };

  /** 一套分配下的伤害指数（期望口径）。 */
  S.damage = function (s, x, y, part) {
    var r = S.damageSplit(s, x, y, part);
    return r === null ? null : r.exp;
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

  /** 各档词条总数下的最优分配（曲线页用）。 */
  S.bestPath = function (s, nmax, step) {
    step = step || 0.25;
    var cnt = Math.round(nmax / step);
    var out = [];
    for (var k = 0; k <= cnt; k++) {
      var n = Math.min(nmax, k * step);
      var sn = Object.assign({}, s, { n: n });
      var b = n > 1e-9 ? S.bestFor(sn) : { x: 0, y: 0, d: S.damage(sn, 0, 0) };
      out.push({ n: n, x: b.x, y: b.y, z: n - b.x - b.y, d: b.d });
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
    var rb = refine(s, best.x, best.y, best.d, s.n / (G - 1));
    best = { x: rb.x, y: rb.y, v: rb.d / base0, d: rb.d };
    return { xs: xs, zs: zs, best: best, base0: base0 };
  };

  /** 词条等效（同桑多涅口径）：1 该词条 = 双暴词条的 d 倍伤害（保留符号）。
      z = 0 时攻击行无定义（NaN）。 */
  function multAt(s, x, y, z) {
    if (z === undefined) z = s.n - x - y;
    if (z < -1e-9) return null;
    var atk = S.panelAtk(s.baseAtk, s.atkPct, s.fatk, z);
    var def = S.panelDef(s.baseDef, s.defPct, s.fdef, x);
    var base = S.E_COEF_ATK * atk + S.E_COEF_DEF * def +
      (s.eFlatDef || 0) * def + (s.eFlatEm || 0) * (s.em || 0);
    var bonus = s.bonus + (s.dmgFlat || 0) +
      (s.dmgPerDef ? Math.min(s.dmgPerDefCap || Infinity, s.dmgPerDef * def) : 0);
    var t = S.critSplit(s.cr, s.cd, y);
    return base * (1 + bonus) * (1 + Math.min(t.cr, 100) / 100 * t.cd / 100);
  }
  S.equiv = function (s, x, y) {
    var z = s.n - x - y;
    if (z < -1e-9) return { def: NaN, atk: NaN };
    var h = 0.05;
    var m0 = multAt(s, x, y, z);
    var gDef = (multAt(s, x + h, y, z) - multAt(s, x - h, y, z)) / (2 * h) / m0;
    var gCr = (multAt(s, x, y + h, z) - multAt(s, x, y - h, z)) / (2 * h) / m0;
    var gAt = z >= h ? ((multAt(s, x, y, z + h) - multAt(s, x, y, z - h)) / (2 * h) / m0) : NaN;
    if (Math.abs(gCr) < 1e-12) return { def: NaN, atk: NaN };
    return { def: gDef / gCr, atk: gAt / gCr };
  };
  /** 全图（x, y ≥ 0、x + y ≤ n）扫描 d 的范围与位置。 */
  S.equivRange = function (s, G) {
    G = G || 141;
    var lo = { def: Infinity, atk: Infinity }, hi = { def: -Infinity, atk: -Infinity };
    for (var i = 0; i <= G; i++) {
      for (var j = 0; j <= G; j++) {
        var x = s.n * i / G, y = s.n * j / G;
        if (x + y > s.n + 1e-9) continue;
        var e = S.equiv(s, x, y);
        if (isFinite(e.def)) {
          if (e.def < lo.def) lo.def = e.def;
          if (e.def > hi.def) hi.def = e.def;
        }
        if (isFinite(e.atk)) {
          if (e.atk < lo.atk) lo.atk = e.atk;
          if (e.atk > hi.atk) hi.atk = e.atk;
        }
      }
    }
    return { lo: lo, hi: hi };
  };

  /** 三类词条各 +1 的边际增益（相对当前点）：下一词条拆三份的候选。 */
  function gains(s, x, y) {
    var z = s.n - x - y;
    if (z < -1e-9) return null;
    var m0 = multAt(s, x, y, z);
    if (m0 === null) return null;
    var g = function (m) { return m === null ? NaN : m / m0 - 1; };
    return {
      def: g(multAt(s, x + 1, y, z - 1)),
      crit: g(multAt(s, x, y + 1, z - 1)),
      atk: g(multAt(s, x, y, z + 1)),
    };
  }
  S.wordGains = gains;
  S.gradWeights = function (s, x, y) {
    var w = gains(s, x, y);
    if (w === null) return null;
    var t = (isFinite(w.def) ? Math.abs(w.def) : 0) + (isFinite(w.crit) ? Math.abs(w.crit) : 0) +
      (isFinite(w.atk) ? Math.abs(w.atk) : 0);
    if (!isFinite(t) || t <= 1e-12) return { def: 1 / 3, crit: 1 / 3, atk: 1 / 3 };
    return { def: Math.abs(w.def) / t, crit: Math.abs(w.crit) / t, atk: Math.abs(w.atk) / t };
  };

  /** 下一词条最优分配：在三角形（三类各占一份）上最大化伤害 —— 直接网格扫描。 */
  S.nextAlloc = function (s, x, y) {
    var z = s.n - x - y;
    if (z < -1e-9) return { def: NaN, crit: NaN, atk: NaN };
    var m0 = multAt(s, x, y, z);
    if (m0 === null) return { def: NaN, crit: NaN, atk: NaN };
    var best = null, bestV = -Infinity;
    var G = 60;
    for (var i = 0; i <= G; i++) {
      for (var j = 0; i + j <= G; j++) {
        var a = i / G, b = j / G, c = 1 - a - b;
        var m = multAt(s, x + a, y + b, z + c);
        if (m !== null && m > bestV) { bestV = m; best = { def: a, crit: b, atk: c }; }
      }
    }
    return best || { def: NaN, crit: NaN, atk: NaN };
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

  /* ── 武器表（对比页用）──────────────────────────────────────────────
     数值为 90 级：五星按精 1、四星 / 三星按精 5（与桑多涅页同一口径）；
     特效只计对「袖」斩切（元素战技伤害）生效的常驻 / 满层部分，按全覆盖建模。 */
  S.WEAPONS = [
    { id: 'uraku', tier: 5, name: '有乐御簾切 R1', base: 542, cd: 88.2, defPct: 0.20, eDmg: 48,
      note: '战技增伤 +48%（岩伤触发后翻倍，按全覆盖）；防御 +20% 常驻' },
    { id: 'peak', tier: 5, name: '岩峰巡歌 R1', base: 542, defPct: 0.827, defStacks: 0.16, dmgSelf: 20,
      teamDmgPerDef: 8, teamDmgCap: 25.6,
      note: '副属性防 +82.7%；普攻 / 下落叠层：自身防 +16%、增伤 +20%，并按面板防御全队增伤 8% / 1000（按满层）' },
    { id: 'foliar', tier: 5, name: '裁叶萃光 R1', base: 542, cd: 88.2, cr: 4, eFlatEm: 1.20,
      note: '暴击 +4%；战技附加伤害 = 120% × 元素精通（面板默认精通 0 时为 0）' },
    { id: 'wolf', tier: 4, name: '狼牙 R5', base: 510, cr: 27.6, eDmg: 32, eCrit: 16,
      note: '战技伤害 +32%；战技命中叠层暴击 +16%（按满层；需前台命中）' },
    { id: 'wolf1', tier: 4, name: '狼牙 R1', base: 510, cr: 27.6, eDmg: 16, eCrit: 8,
      note: '战技伤害 +16%；战技命中叠层暴击 +8%（按满层；需前台命中）' },
    { id: 'cinnabar', tier: 4, name: '辰砂之纺锤 R5', base: 454, defPct: 0.69, eFlatDef: 0.80,
      note: '副属性防 +69%；战技附加伤害 = 80% × 防御力（斩切间隔 3.6s，全覆盖）' },
    { id: 'dawn', tier: 3, name: '黎明神剑 R5', base: 401, cd: 46.9, cr: 28,
      note: '暴击 +28% 需生命 > 90%（按全覆盖）' },
    { id: 'flute', tier: 4, name: '息燧之笛 R5', base: 454, defPct: 0.69, defOnCast: 0.32,
      note: '副属性防 +69%；施放战技后防御 +32%（来源对持续 10 / 15 秒说法不一，按全覆盖）' },
  ];
  S.BASE_W = 'uraku';   // 指数基准：有乐御簾切 R1 = 100

  /** 武器合成进一套完整面板（对比页用）。st =「不含武器」的部分（atkPct / defPct 小数、cr / cd 百分点、bonus 小数）。 */
  S.applyWeapon = function (w, st) {
    var s = Object.assign({}, st);
    s.baseAtk = st.baseAtk + w.base;
    s.atkPct = st.atkPct + (w.atkPct || 0);
    s.defPct = st.defPct + (w.defPct || 0) + (w.defStacks || 0) + (w.defOnCast || 0);
    s.cr = st.cr + (w.cr || 0) + (w.eCrit || 0);
    s.cd = st.cd + (w.cd || 0);
    s.dmgFlat = (st.dmgFlat || 0) + (w.eDmg || 0) / 100 + (w.dmgSelf || 0) / 100;
    s.eFlatDef = w.eFlatDef || 0;
    s.eFlatEm = w.eFlatEm || 0;
    if (w.teamDmgPerDef) {
      s.dmgPerDef = w.teamDmgPerDef / 100 / 1000;
      s.dmgPerDefCap = (w.teamDmgCap || 0) / 100;
    }
    return s;
  };
})(typeof globalThis !== 'undefined' ? globalThis : this);
