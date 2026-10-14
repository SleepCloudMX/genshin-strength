/* 桑多涅 · 武器对比：8 把双手剑各自最优分配下的伤害指数（超越之匙 R1 = 100）。 */
(function (global) {
  'use strict';
  var GS = global.GS = global.GS || {};
  var M = GS.modules = GS.modules || {};
  var S = GS.core.sandrone;
  var el = GS.ui.panels.el;

  var FOOT =
    '指数 = 该武器在相同词条预算下、把预算按最优分配后的期望伤害 ÷ 超越之匙 R1 同一口径的对应值 × 100。' +
    '<b>「最优分配」列</b> = 各自的最优词条拆分（精通 / 双暴 / 攻击词条数）；词条预算、基准面板改了会挪动最优分配与排名。<br>' +
    '<b>默认参数 = 七七 · 木偶 · 阿罗夏 队不含武器的部分</b>：基础攻击力按桑多涅 80 级突破 318 计，' +
    '大攻击 20.1%、基准双暴 55.2 / 112.2、基准精通 160、反应增伤 160%；各项分解见伤害热图页页脚。<br>' +
    '武器数据（90 级）：超越之匙 674 / 暴伤 44.1%（攻击 +28%、超越满层反应增伤 +48%）；焚曜千阳 741 / 暴击 11.0%' +
    '（焚光：攻击 +28%、暴伤 +20%）；苇海信标 608 / 暴击 33.1%（战技命中 + 受击各 +20% 攻击）；狼的末路 608 / 攻击 49.6%' +
    '（常驻 +20%，斩杀队伍效果不计）；无工之剑 608 / 攻击 49.6%（有盾叠满 +40%）；赤角石溃杵 542 / 暴伤 88.2%' +
    '（特效不作用于星超导，不计）；浪影阔剑 510 / 攻击 41.3%（受治疗 +48% 攻击）；螭骨剑 510 / 暴击 27.6%' +
    '（增伤类特效不作用于星超导，不计）。<br>' +
    '星超导伤害公式见机制文档 <code>docs/ai-output/0-mechanism/3-星超导伤害机制.md</code>；倍率不计入，都是相对指数。';

  function subDesc(w) {
    if (w.atkPct) return '攻击 +' + (w.atkPct * 100).toFixed(1) + '%';
    if (w.cr) return '暴击 +' + w.cr + '%';
    return '暴伤 +' + w.cd + '%';
  }

  function rowHTML(r, s) {
    var z = s.n - r.best.x - r.best.y;
    return '<div class="wrow t' + r.w.tier + (r.w.id === S.BASE_W ? ' base' : '') + '">' +
      '<div><div>' + r.w.name + '</div><div class="wsub">' + r.w.base + ' 基础 · ' + subDesc(r.w) + '</div></div>' +
      '<div class="wbar"><div class="fill" style="width:' + r.width.toFixed(1) + '%"></div><b>' + r.idx.toFixed(1) + '</b></div>' +
      '<div class="wsplit">最优：精通 ' + r.best.x.toFixed(1) + ' · 双暴 ' + r.best.y.toFixed(1) + ' · 攻击 ' + z.toFixed(1) + '</div>' +
      '<div class="wnote">' + r.w.note + '</div>' +
    '</div>';
  }

  M['sandrone/weapon_compare'] = {
    title: '「桑多涅」星超导武器对比',
    tab: '桑多涅·武器对比',
    intro: '各武器在<b>各自最优词条分配</b>下的伤害指数，以超越之匙 R1 = 100（五星浅棕底 / 四星浅紫底）；' +
      '数字框失焦 / 回车后重算。词条分配主图见 <a href="#/sandrone/star_superconduct">伤害热图</a>页，' +
      '逐档最优面板见 <a href="#/sandrone/alloc_curve">词条分配</a>页。',
    noPlotly: true,
    controls: [
      {
        key: '', type: 'note',
        html: '<b>基准面板 = 上完 buff、不含副词条</b> —— 参数里是<b>不含武器</b>的部分（角色自身、队友、圣遗物含幻灭 4 件），' +
          '武器部分由每行武器自带；攻攻主词条（46.6% × 2）与羽（311）由脚本自动加。',
      },
      {
        key: '', type: 'note',
        html: '<b>口径同伤害热图页</b>：1 词条 = 20 精通 = 6.6 双暴分 = 5% 大攻击（攻击词条按大攻击折算）；' +
          '特效<b>只计对星超导生效的常驻部分</b>，按全覆盖 / 满层，行内注明。',
      },
      { key: 'patk', type: 'number', label: '大攻击 %', def: 20.1, step: 0.1, min: -9999 },
      { key: 'fatk', type: 'number', label: '小攻击', def: 0, step: 1, min: -9999 },
      { key: 'em', type: 'number', label: '基准精通', def: 160, step: 10, min: 0 },
      { key: 'bonus', type: 'number', label: '反应增伤 %', def: 160, step: 1, min: 0 },
      { key: 'cr', type: 'number', label: '基准暴击率 %', def: 55.2, step: 0.1, min: 0 },
      { key: 'cd', type: 'number', label: '基准暴伤 %', def: 112.2, step: 0.1, min: 50 },
      { key: 'n', type: 'number', label: '词条预算', def: 30, step: 1, min: 2, max: 53 },
      { key: 'n2', type: 'readout', full: true, label: '基准面板攻击力（基准武器）', compute: function (s) {
        var w = S.weaponById(S.BASE_W);
        return S.panelAttack(S.CHAR_BASE + w.base, s.patk / 100 + w.atkPct + w.extraAtk, s.fatk, 0).toFixed(0) +
          '（' + w.name + '）';
      } },
    ],

    create: function (host) {
      var list = el('div', 'wlist');
      host.appendChild(list);
      host.appendChild(GS.ui.panels.note(FOOT, 'pagenote'));

      /* 参数（角色 / 队友 / 圣遗物，不含武器）+ 该武器部分 → 一份完整 s。 */
      function sFor(w, st) {
        return {
          baseAtk: S.CHAR_BASE + w.base,
          atkPct: st.atkPct + w.atkPct + w.extraAtk,
          fatk: st.fatk,
          em: st.em,
          cr: st.cr + w.cr,
          cd: st.cd + w.cd + w.extraCd,
          bonus: st.bonus + w.reaction,
          n: st.n,
        };
      }

      return {
        update: function (s) {
          var st = {
            n: s.n, em: s.em, cr: s.cr, cd: s.cd,
            atkPct: s.patk / 100, fatk: s.fatk, bonus: s.bonus / 100,
          };
          var rows = S.WEAPONS.map(function (w) { return { w: w, best: S.bestFor(sFor(w, st)) }; });
          var refAbs = 0, maxAbs = 0;
          rows.forEach(function (r) {
            if (r.w.id === S.BASE_W) refAbs = r.best.d;
            maxAbs = Math.max(maxAbs, r.best.d);
          });
          rows.forEach(function (r) {
            r.idx = 100 * r.best.d / refAbs;
            r.width = 100 * r.best.d / maxAbs;
          });
          rows.sort(function (a, b) { return b.idx - a.idx; });
          list.innerHTML = rows.map(function (r) { return rowHTML(r, st); }).join('');
        },
      };
    },
  };
})(typeof globalThis !== 'undefined' ? globalThis : this);
