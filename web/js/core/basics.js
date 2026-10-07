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
})(typeof globalThis !== 'undefined' ? globalThis : this);
