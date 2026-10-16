/* 千织 · 武器对比：7 把单手剑各自最优分配下的伤害指数（有乐御簾切 R1 = 100）。 */
(function (global) {
  'use strict';
  var GS = global.GS = global.GS || {};
  var M = GS.modules = GS.modules || {};
  var S = GS.core.chiori;
  var el = GS.ui.panels.el;

  var FOOT =
    '指数 = 该武器在相同词条预算下、把预算按最优分配后的伤害 ÷ 有乐御簾切 R1 同一口径的对应值 × 100。' +
    '<b>「最优分配」列</b> = 各自的最优词条拆分（防御 / 双暴 / 攻击词条数）；词条预算、基准面板改了会挪动最优分配与排名。<br>' +
    '<b>默认参数 = 「千织 80 级突破 + 剧团防岩爆」不含武器的部分</b>：基础攻击力按 300 计、大防御 58.3%（防御沙）、' +
    '小攻击 311（羽）、基准双暴 24.2 / 112.2、伤害加成 136.6%、词条预算 30；各项分解见伤害热图页。<br>' +
    '武器数据（90 级，五星按精 1、四星 / 三星按精 5；特效只计对「袖」斩切生效的常驻 / 满层部分）：' +
    '有乐御簾切 542 / 暴伤 88.2%（战技增伤 +48%、防御 +20%）；岩峰巡歌 542 / 防御 82.7%（叠层：自身防 +16%、' +
    '增伤 +20%，并按防御给全队增伤）；裁叶萃光 542 / 暴伤 88.2%（暴击 +4%、战技附加伤害 = 120% × 精通）；' +
    '狼牙 510 / 暴击 27.6%（战技伤害 +32%、暴击 +16% 叠层）；辰砂之纺锤 454 / 防御 69%（战技附加伤害 = 80% × 防御）；' +
    '黎明神剑 401 / 暴伤 46.9%（暴击 +28%）；息燧之笛 454 / 防御 69%（施放战技后防御 +32%）。<br>' +
    '「袖」斩切伤害公式见机制文档 <code>docs/ai-output/0-mechanism/4-千织伤害机制.md</code>；公共乘区不计入，都是相对指数。';

  function subDesc(w) {
    if (w.defPct) return '防御 +' + (w.defPct * 100).toFixed(1) + '%';
    if (w.cd) return '暴伤 +' + w.cd + '%';
    return '暴击 +' + w.cr + '%';
  }

  function rowHTML(r, s) {
    var z = Math.max(0, s.n - r.best.x - r.best.y);
    return '<div class="wrow t' + r.w.tier + (r.w.id === S.BASE_W ? ' base' : '') + '">' +
      '<div><div>' + r.w.name + '</div><div class="wsub">' + r.w.base + ' 基础 · ' + subDesc(r.w) + '</div></div>' +
      '<div class="wbar"><div class="fill" style="width:' + r.width.toFixed(1) + '%"></div><b>' + r.idx.toFixed(1) + '</b></div>' +
      '<div class="wsplit">最优：防御 ' + r.best.x.toFixed(1) + ' · 双暴 ' + r.best.y.toFixed(1) + ' · 攻击 ' + z.toFixed(1) + '</div>' +
      '<div class="wnote">' + r.w.note + '</div>' +
    '</div>';
  }

  M['chiori/weapon_compare'] = {
    title: '「千织」武器对比',
    tab: '千织·武器对比',
    intro: '各武器在<b>各自最优词条分配</b>下的伤害指数，以有乐御簾切 R1 = 100（五星浅棕底 / 四星浅紫底 / 三星浅灰底）；' +
      '数字框失焦 / 回车后重算。伤害热图见 <a href="#/chiori/dmg_map">伤害热图</a>页，逐档最优面板见 <a href="#/chiori/alloc_curve">词条分配</a>页。',
    noPlotly: true,
    controls: [
      {
        key: '', type: 'note',
        html: '<b>基准面板 = 上完 buff、不含副词条</b> —— 参数里是<b>不含武器</b>的部分（角色自身、圣遗物含主词条与羽）；' +
          '武器部分由每行武器自带；每个数值可点「明细」查看与编辑逐项来源。',
      },
      {
        key: '', type: 'note',
        html: '<b>口径同伤害热图页</b>：1 词条 = 5% 大攻击 = 6.2% 大防御 = 3.3% 暴击 = 6.6% 暴伤；' +
          '特效<b>只计对「袖」斩切（元素战技伤害）生效的常驻 / 满层部分</b>，行内注明；五星按精 1、四星 / 三星按精 5。',
      },
      { key: 'baseAtk', type: 'items', label: '基础攻击力', step: 1, min: 0, items: [
        { n: '千织 80 级突破', v: 300 }] },
      { key: 'baseDef', type: 'items', label: '基础防御力', step: 1, min: 0, items: [
        { n: '千织 80 级突破', v: 886 }] },
      { key: 'patk', type: 'items', label: '大攻击 %', step: 0.1, min: -9999, items: [] },
      { key: 'pdef', type: 'items', label: '大防御 %', step: 0.1, min: -9999, items: [
        { n: '防御沙', v: 58.3 }] },
      { key: 'fatk', type: 'items', label: '小攻击', step: 1, min: -9999, items: [
        { n: '羽主词条', v: 311 }] },
      { key: 'fdef', type: 'items', label: '小防御', step: 1, min: -9999, items: [] },
      { key: 'em', type: 'items', label: '元素精通', step: 10, min: 0, items: [] },
      { key: 'cr', type: 'items', label: '基准暴击率 %', step: 0.1, min: 0, items: [
        { n: '千织自身', v: 5 },
        { n: '80 级突破', v: 19.2 }] },
      { key: 'cd', type: 'items', label: '基准暴伤 %', step: 0.1, min: 50, items: [
        { n: '角色基础', v: 50 },
        { n: '暴伤头', v: 62.2 }] },
      { key: 'bonus', type: 'items', label: '伤害加成 %', step: 1, min: 0, items: [
        { n: '锦上添花', v: 20 },
        { n: '黄金剧团 4 件套', v: 70 },
        { n: '岩伤杯', v: 46.6 }] },
      { key: 'n', type: 'number', label: '词条预算', def: 30, step: 1, min: 2, max: 50 },
      { key: 'n2', type: 'readout', full: true, label: '基准面板（基准武器）', compute: function (s) {
        var w = null;
        S.WEAPONS.forEach(function (x) { if (x.id === S.BASE_W) w = x; });
        var atk = S.panelAtk(s.baseAtk + w.base, s.patk / 100 + (w.atkPct || 0), s.fatk, 0);
        var def = S.panelDef(s.baseDef, s.pdef / 100 + (w.defPct || 0), s.fdef, 0);
        return '攻 ' + atk.toFixed(0) + ' · 防 ' + def.toFixed(0) + '（' + w.name + '）';
      } },
    ],

    create: function (host) {
      var list = el('div', 'wlist');
      host.appendChild(list);
      host.appendChild(GS.ui.panels.note(FOOT, 'pagenote'));

      /** 参数（角色 / 圣遗物，不含武器）+ 该武器部分 → 一份完整 s。 */
      function sFor(w, st) {
        return S.applyWeapon(w, {
          baseAtk: st.baseAtk, atkPct: st.atkPct,
          baseDef: st.baseDef, defPct: st.defPct,
          fatk: st.fatk, fdef: st.fdef,
          cr: st.cr, cd: st.cd, bonus: st.bonus, em: st.em, n: st.n,
        });
      }

      return {
        update: function (s) {
          var st = {
            baseAtk: s.baseAtk, atkPct: s.patk / 100,
            baseDef: s.baseDef, defPct: s.pdef / 100,
            fatk: s.fatk, fdef: s.fdef, em: s.em,
            cr: s.cr, cd: s.cd, bonus: s.bonus / 100, n: s.n,
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
