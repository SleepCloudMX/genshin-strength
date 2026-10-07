/* 共享口径与纯函数：等效词条 / 双暴分 / 精通项 / 抗性系数。
   纯函数、不碰 DOM —— Node 可直接加载做数值对照。 */
(function (global) {
  'use strict';
  var GS = global.GS = global.GS || {};
  var C = GS.core = GS.core || {};

  /* ── 等效词条口径：1 词条 = 20 精通 = 3.3 暴击 = 6.6 暴伤（只适用于副词条）── */
  C.EM_PER_ROLL = 20;
  C.CR_PER_ROLL = 3.3;
  C.CD_PER_ROLL = 6.6;
  C.SCORE_PER_ROLL = 6.6;   // 1 个双暴词条 = 6.6 双暴分

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
