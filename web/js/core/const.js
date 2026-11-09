/* 共享口径与纯函数：等效词条 / 双暴分 / 精通项 / 抗性系数。
   纯函数、不碰 DOM —— Node 可直接加载做数值对照。 */
(function (global) {
  'use strict';
  var GS = global.GS = global.GS || {};
  var C = GS.core = GS.core || {};

  /* ── 等效词条口径：副词条四档成长值的均值（米游社数据，只适用于副词条）。
        暴击 2.72/3.11/3.50/3.89、暴伤 5.44/6.22/6.99/7.77、
        大攻击 4.08/4.66/5.25/5.83、小攻击 13.62/15.56/17.51/19.45、
        精通 16.32/18.65/20.98/23.31、充能 4.53/5.18/5.83/6.48、
        大防御 5.10/5.83/6.56/7.29、小防御 16.20/18.52/20.83/23.15、
        大生命 4.08/4.66/5.25/5.83、小生命 209.13/239.00/268.88/298.75。
        全项目的词条换算只引用这张表。── */
  C.ROLL = {
    cr: 3.305,        // 暴击 %
    cd: 6.605,        // 暴伤 %
    atkPct: 4.955,    // 大攻击 %
    atkFlat: 16.535,  // 小攻击
    em: 19.815,       // 精通
    er: 5.505,        // 充能 %
    defPct: 6.195,    // 大防御 %
    defFlat: 19.675,  // 小防御
    hpPct: 4.955,     // 大生命 %
    hpFlat: 253.94,   // 小生命
  };
  C.EM_PER_ROLL = C.ROLL.em;
  C.CR_PER_ROLL = C.ROLL.cr;
  C.CD_PER_ROLL = C.ROLL.cd;
  C.SCORE_PER_ROLL = C.ROLL.cd;   // 1 个双暴词条 = 6.605 双暴分（按暴伤档；暴击档 2×3.305 = 6.61）

  /* ── 精通项（星扩散 / 星超导共用；剧变反应系数是 16，这里不是）── */
  C.EM_COEF = 6.0;
  C.EM_OFFSET = 2000.0;
  C.emTerm = function (em) { return C.EM_COEF * em / (em + C.EM_OFFSET); };

  /* ── 双暴分 = 2 × 暴击率 + 暴伤（等效暴伤；不写百分号）── */
  C.baseScore = function (cr, cd) { return 2 * cr + cd; };

  /* ── 抗性系数 κ(r)，r 为小数：0 / 75% 两个折点 ── */
  C.kappa = function (r) { return r < 0 ? 1 - r / 2 : (r < 0.75 ? 1 - r : 1 / (4 * r + 1)); };

  /* ── 格式化 ── */
  C.f = function (v, d) { return Number(v).toFixed(d === undefined ? 1 : d); };
  C.pct = function (v, d) { return (v * 100).toFixed(d === undefined ? 1 : d) + '%'; };
  C.sign = function (v, d) { return (v >= 0 ? '+' : '') + Number(v).toFixed(d === undefined ? 2 : d); };

  C.clamp = function (v, lo, hi) { return Math.min(Math.max(v, lo), hi); };

  /* 线性插值取样（色带等）；t 会被夹到 [0, 1] */
  C.mixHex = function (a, b, t) {
    var pa = parseInt(a.slice(1), 16), pb = parseInt(b.slice(1), 16);
    var r = Math.round(((pa >> 16) & 255) + (((pb >> 16) & 255) - ((pa >> 16) & 255)) * t);
    var g = Math.round(((pa >> 8) & 255) + (((pb >> 8) & 255) - ((pa >> 8) & 255)) * t);
    var bl = Math.round((pa & 255) + ((pb & 255) - (pa & 255)) * t);
    return 'rgb(' + r + ',' + g + ',' + bl + ')';
  };
})(typeof globalThis !== 'undefined' ? globalThis : this);
