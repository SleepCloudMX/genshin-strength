/* 米提亚 · 武器对比：各武器在自身最优词条分配与最优头部主词条下的伤害指数
   （秘星典谕 R1 = 100）。头部在暴击头 / 精通头之间按各自最优分配取高者，行内标出。 */
(function (global) {
  'use strict';
  var GS = global.GS = global.GS || {};
  var M = GS.modules = GS.modules || {};
  var C = GS.core;
  var S = C.mitya;
  var el = GS.ui.panels.el;

  var BASE_W = 'stargazer';

  /* 武器只填对星超导生效的部分：
     em / cr / cd / bonus 都是「该武器带来的面板增量」（em 含副词条与特效，cd 含特效），
     基础攻击力只用于显示，不进入公式。 */
  var WEAPONS = [
    { id: 'frost1', tier: 4, name: '霜辰 R1', base: 510, sub: '暴伤 +55.1%',
      em: 120, cd: 55.1, note: '重击 +72 / 战技 +48 精通（全覆盖）' },
    { id: 'frost5', tier: 4, name: '霜辰 R5', base: 510, sub: '暴伤 +55.1%',
      em: 240, cd: 55.1, note: '重击 +144 / 战技 +96 精通（全覆盖）' },
    { id: 'winter1', tier: 4, name: '凝雪沉心 R1', base: 510, sub: '暴伤 +55.1%',
      em: 60, cd: 55.1, bonus: 0.18, note: '辉映·星烁：3 名冰雷 → +60 精通 / +18% 星烁增伤' },
    { id: 'winter5', tier: 4, name: '凝雪沉心 R5', base: 510, sub: '暴伤 +55.1%',
      em: 120, cd: 55.1, bonus: 0.36, note: '辉映·星烁：3 名冰雷 → +120 精通 / +36% 星烁增伤' },
    { id: BASE_W, tier: 5, name: '秘星典谕 R1', base: 542, sub: '暴伤 +88.2%（特效后 148.2%）',
      em: 120, cd: 148.2, note: '常驻 +24% 暴伤；战技 +48 精通；3 层 +72 精通 / +36% 星超导暴伤' },
    { id: 'sleep1', tier: 5, name: '寝正月初晴 R1', base: 542, sub: '精通 +265',
      em: 393, note: '战技 +96 / 爆发 +32 精通；扩散层不计（米提亚不能触发）' },
    { id: 'lute5', tier: 4, name: '天光的纺琴 R5', base: 510, sub: '充能 +45.9%',
      em: 200, note: '战技后 +200 精通（20 秒）；充能不计' },
    { id: 'widsith1e', tier: 4, name: '流浪乐章 R1（期望）', base: 510, sub: '暴伤 +55.1%',
      em: 80, cd: 55.1, note: '三选一：精通曲 +240，按 1/3 折算（曲内命中）；攻击 / 增伤曲无效' },
    { id: 'widsith1m', tier: 4, name: '流浪乐章 R1（精通曲）', base: 510, sub: '暴伤 +55.1%',
      em: 240, cd: 55.1, note: '命中间奏曲：+240 精通（上限）' },
    { id: 'widsith5e', tier: 4, name: '流浪乐章 R5（期望）', base: 510, sub: '暴伤 +55.1%',
      em: 160, cd: 55.1, note: '三选一：精通曲 +480，按 1/3 折算（曲内命中）；攻击 / 增伤曲无效' },
    { id: 'widsith5m', tier: 4, name: '流浪乐章 R5（精通曲）', base: 510, sub: '暴伤 +55.1%',
      em: 480, cd: 55.1, note: '命中间奏曲：+480 精通（上限）' },
    { id: 'truth1', tier: 5, name: '真语秘匣 R1', base: 542, sub: '暴伤 +88.2%',
      em: 80, cr: 8, cd: 88.2, note: '暴击 +8%；战技后 +80 精通；月绽放暴伤段不计' },
    { id: 'tome1', tier: 5, name: '万世流涌大典 R1', base: 542, sub: '暴伤 +88.2%',
      cd: 88.2, note: '只计 88.2% 暴伤；生命 / 重击增伤不作用于星超导' },
    { id: 'surf1', tier: 5, name: '冲浪时光 R1', base: 542, sub: '暴伤 +88.2%',
      cd: 88.2, note: '只计 88.2% 暴伤；生命 / 普攻增伤不作用于星超导' },
    { id: 'jade5', tier: 4, name: '遗祀玉珑 R5', base: 454, sub: '暴击 +36.8%',
      em: 80, cr: 36.8, note: '后台 5 秒后 +80 精通（登场 10 秒内有效）' },
    { id: 'dream1', tier: 5, name: '千夜浮梦 R1', base: 542, sub: '精通 +265',
      em: 297, note: '1 名同元素队友 +32 精通；异元素增伤不计' },
    { id: 'starcall1', tier: 5, name: '祭星者之望 R1', base: 542, sub: '精通 +265',
      em: 365, note: '常驻 +100 精通；护盾增伤不计' },
    { id: 'evenstar5', tier: 4, name: '流浪的晚星 R5', base: 510, sub: '精通 +165',
      em: 165, note: '只计 165 精通；精通转攻击无效' },
    { id: 'kings5', tier: 4, name: '群王局戏 R5', base: 510, sub: '暴击 +27.6%',
      em: 200, cr: 27.6, note: '战技后 +200 精通（重击延长，全覆盖）；攻击不计' },
  ];

  var HEADS = {
    cr: { label: '暴击头', em: 0, cr: 31.1 },
    em: { label: '精通头', em: 187, cr: 0 },
  };

  function fmtTrim(v, minDp, maxDp) {
    var s = v.toFixed(maxDp);
    while (s.indexOf('.') >= 0 && s.length - s.indexOf('.') - 1 > minDp && s.charAt(s.length - 1) === '0') {
      s = s.slice(0, -1);
    }
    if (s.charAt(s.length - 1) === '.') s = s.slice(0, -1);
    return s;
  }
  function q(v, minDp, maxDp) { return Number(fmtTrim(v, minDp, maxDp)); }

  /** 公共面板（不含武器、不含头部）：默认幻灭 4 + 精通沙 / 精通杯 + 2 命过载 + 主流队友。 */
  function commonState(s) {
    var net = (s.enemyRes - s.resShred) / 100;
    return {
      em: s.em, cr: s.cr, cd: s.cd,
      bFlat: s.bFlat / 100,
      bonus: s.bonus / 100,
      k: S.kOf(s.kLayers),
      kLayers: s.kLayers,
      f: s.f,
      netRes: net,
      res: q(C.kappa(net), 2, 4),
      asc: 1 + s.asc / 100,
      n: s.n,
      nMax: S.N_MAX,
    };
  }

  function withWeaponHead(cs, w, head) {
    var x = Object.assign({}, cs);
    x.em += (w.em || 0) + (head === 'em' ? HEADS.em.em : 0);
    x.cr += (w.cr || 0) + (head === 'cr' ? HEADS.cr.cr : 0);
    x.cd += w.cd || 0;
    x.bonus += w.bonus || 0;
    return x;
  }

  /** 暴击头 / 精通头各自按自身最优分配算，取伤害高者；gap = 高者 / 低者 − 1。 */
  function bestOf(cs, w) {
    var crHead = S.bestFor(withWeaponHead(cs, w, 'cr'));
    var emHead = S.bestFor(withWeaponHead(cs, w, 'em'));
    var useEm = emHead.d > crHead.d + 1e-9;
    var best = useEm ? emHead : crHead;
    var other = useEm ? crHead : emHead;
    return { best: best, useEm: useEm, gap: (best.d / other.d - 1) * 100 };
  }

  function rowHTML(r) {
    var headLabel = r.useEm ? HEADS.em.label : HEADS.cr.label;
    var otherLabel = r.useEm ? HEADS.cr.label : HEADS.em.label;
    return '<div class="wrow t' + r.w.tier + (r.w.id === BASE_W ? ' base' : '') + '">' +
      '<div><div class="wname">' + r.w.name + '</div><div class="wsub">' + r.w.base + ' 基础 · ' + r.w.sub + '</div></div>' +
      '<div class="wbar"><div class="fill" style="width:' + r.width.toFixed(1) + '%"></div><b>' + r.idx.toFixed(1) + '</b></div>' +
      '<div><div class="wsplit">最优：精通 ' + r.best.x.toFixed(1) + ' · 双暴 ' + r.best.y.toFixed(1) + '</div>' +
      '<div class="whead"><b>' + Math.round(r.best.d).toLocaleString() + '</b> · ' + headLabel +
      '（优于' + otherLabel + ' ' + r.gap.toFixed(2) + '%）</div></div>' +
      '<div class="wnote">' + r.w.note + '</div>' +
    '</div>';
  }

  var FOOT =
    '单段 = 10 级「递变聚爆」消耗 1 枚信标造成的星超导雷伤（403.2% 元素精通）；公式 ' +
    '<code>D = [K × 4.032 × EM × (1+B) × (1+E+S) + F] × R × C</code>。' +
    '米提亚的星超导是元素精通倍率，<b>武器基础攻击力不进入公式</b>；武器只通过元素精通、暴击率、暴伤、星超导增伤影响结果。' +
    '1 词条 = 20 精通 = 3.3% 暴击 = 6.6% 暴伤。<br>' +
    '<b>指数</b> = 该武器在预算 n（默认 30）内、按自身最优副词条分配与最优头部主词条的单段伤害 ÷ 秘星典谕 R1 同口径的最优单段 × 100。' +
    '行内「最优」下方的数字 = 该武器最优分配下的<b>绝对单段伤害</b>；条形上的数字才是指数。' +
    '<b>头部选择</b>：暴击头（+31.1% 暴击率）与精通头（+187 精通）各自按自身最优分配计算，取伤害较高者；' +
    '行内给出该头对另一头的相对优势（%，<code>1 − 较低 / 较高</code>）。公共面板不含头部，由每把武器自行选择。<br>' +
    '<b>公共面板</b>：幻灭 4 件套（+16% 暴击率、+40% 星超导增伤）+ 精通沙 / 精通杯（+374 精通）+ 2 命过载（+234 精通、敌人冰雷抗 −20%）' +
    '+ 砂糖 210 精通 / 风套 40% 减雷抗 + 瓦列里 2 命 100 精通 + 教官 4 件套 120 精通 + 瓦列里攻斥 F = 2263.6；' +
    '合计精通 1138 / 暴击率 41.0% / 暴伤 128.4% / 星超导增伤 150% / B 1.28 / K 1.70 / 抗性系数 1.25，预算 30 词条。<br>' +
    '<b>武器特效</b>只计对星超导生效的常驻 / 满层部分：' +
    '霜辰按重击 + 战技两段精通全覆盖（R1 +72 / +48，R5 +144 / +96）；' +
    '凝雪沉心按「辉映·星烁」3 名冰 / 雷角色（R1 +60 精通 / +18% 星烁增伤，R5 +120 / +36%；攻击力部分对米提亚无效）；' +
    '秘星典谕 = 常驻 +24% 暴伤 + 战技 +48 精通 + 3 层「炬中法度」+72 精通 / +36% 星超导暴伤，合计 120 精通 / 148.2% 暴伤' +
    '（36% 暴伤仅作用于星超导，正好覆盖本页口径）；' +
    '寝正月初晴只计战技 +96 与爆发 +32 精通（R1），扩散层不计（米提亚不能触发扩散）；' +
    '天光的纺琴 R5 = 战技后 +200 精通；' +
    '流浪乐章 = 登场乐三选一，只有「间奏曲」的精通有效：「期望」行按 1/3 × 240（R1）/ 480（R5），' +
    '假定命中落在 10 秒曲内（曲外更低）；「精通曲」行为命中时的上限（三选一概率 1/3）；' +
    '真语秘匣 = +8% 暴击率 + 战技后 +80 精通，月绽放的暴伤段不计；' +
    '万世流涌大典 / 冲浪时光只计 88.2% 暴伤副词条，生命与重击 / 普攻增伤不作用于星超导；' +
    '遗祀玉珑 R5 = +36.8% 暴击率 + 后台 5 秒后 80 精通（登场 10 秒内有效，按命中时生效）；' +
    '千夜浮梦 = 265 精通 + 1 名同元素队友（瓦列里）+32 精通，异元素增伤不计；' +
    '祭星者之望 = 265 + 100 精通，护盾增伤不计；' +
    '流浪的晚星 = 只计 165 精通，精通转攻击无效；' +
    '群王局戏 R5 = +27.6% 暴击率 + 战技后 200 精通（重击延长，按全覆盖），攻击力部分不计。<br>' +
    '抗性、擢升对每把武器相同；K 与 F 在同一页内对所有武器相同，但会移动各自的最优分配' +
    '（K 只缩放核心项，F 加在核心项后并再乘暴击）。' +
    '数据与口径见 <code>docs/ai-output/0-mechanism/5-米提亚伤害机制.md</code>。';

  M['mitya/weapon_compare'] = {
    title: '「米提亚」星超导武器对比',
    tab: '米提亚·武器对比',
    intro: '各武器在<b>各自最优词条分配</b>与<b>各自最优头部主词条</b>下的单段伤害指数，以秘星典谕 R1 = 100' +
      '（五星浅棕底 / 四星浅紫底）；行内标出所带头部及与另一头的差距。默认基底 = 幻灭 4 + 精通沙 + 精通杯 + 2 命过载 + 主流队友；' +
      '数字框失焦 / 回车后重算。词条分配见 <a href="#/mitya/dmg_map">伤害热图</a>，套装 / 主词条见 <a href="#/mitya/set_vs">套装对比</a>。',
    noPlotly: true,
    controls: [
      {
        key: '', type: 'note',
        html: '<b>公共面板</b> = 上完 buff、不含武器与头部：幻灭 4 + 精通沙 + 精通杯 + 2 命过载 + 主流队友。' +
          '每把武器自带面板增量；头部在暴击头 / 精通头中按该武器的最优分配取高者，并在行内标注。',
      },
      {
        key: '', type: 'note',
        html: '<b>口径同伤害热图页</b>：1 词条 = 20 精通 = 3.3% 暴击 = 6.6% 暴伤；' +
          '武器攻击力不进入星超导公式；特效只计对星超导生效的常驻 / 满层部分，行内注明。',
      },
      { key: 'em', type: 'items', label: '公共精通', step: 1, min: 0, items: [
        { n: '米提亚自身', v: 100 },
        { n: '2 命（过载）', v: 234 },
        { n: '砂糖', v: 210 },
        { n: '瓦列里 2 命', v: 100 },
        { n: '教官 4 件套', v: 120 },
        { n: '精通沙', v: 187 },
        { n: '精通杯', v: 187 }] },
      { key: 'cr', type: 'items', label: '公共暴击率 %', step: 0.1, min: 0, items: [
        { n: '米提亚自身', v: 5 },
        { n: '超限易爆试剂', v: 20 },
        { n: '幻灭 4 件套', v: 16 }] },
      { key: 'cd', type: 'items', label: '公共暴伤 %', step: 0.1, min: 50, items: [
        { n: '角色基础', v: 50 },
        { n: '突破属性', v: 38.4 },
        { n: '1 命', v: 40 }] },
      { key: 'bonus', type: 'items', label: '公共星超导增伤 %', step: 1, min: 0, items: [
        { n: '奥黛塔华彩', v: 60 },
        { n: '炉火 4 件套', v: 50 },
        { n: '幻灭 4 件套', v: 40 }] },
      { key: 'bFlat', type: 'items', label: '队友基础提升 %', step: 1, min: 0, items: [
        { n: '奥黛塔天赋', v: 14 }] },
      { key: 'kLayers', type: 'range', label: '星超导层数', def: 6, min: 0, max: 12, step: 1 },
      { key: 'f', type: 'items', label: '额外提升', step: 0.1, min: 0, items: [
        { n: '瓦列里攻斥（单层）', v: 2263.6 }] },
      {
        type: 'group', label: '敌人区',
        items: [
          { key: 'enemyRes', type: 'number', label: '敌人抗性 %', def: 10, step: 1, min: -100, max: 200 },
          { key: 'resShred', type: 'number', label: '减抗合计 %', def: 60, step: 1, min: 0, max: 200 },
          { key: 'asc', type: 'number', label: '擢升 %', def: 0, step: 1, min: 0, max: 100 },
        ],
      },
      { key: 'n', type: 'range', label: '词条预算', def: S.N_DEF, min: 2, max: S.N_MAX, step: 1 },
      { key: 'panel', type: 'readout', full: true, label: '公共精通 / 暴击 / 暴伤', compute: function (s) {
        return Number(s.em).toFixed(0) + ' · ' + Number(s.cr).toFixed(1) + ' / ' + Number(s.cd).toFixed(1);
      } },
      { key: 'panelBonus', type: 'readout', full: true, label: '公共星超导增伤', compute: function (s) {
        return Math.round(s.bonus) + '%';
      } },
    ],

    create: function (host) {
      var list = el('div', 'wlist');
      host.appendChild(list);
      host.appendChild(GS.ui.panels.note(FOOT, 'pagenote'));

      return {
        update: function (s) {
          var cs = commonState(s);
          var rows = WEAPONS.map(function (w) {
            var r = bestOf(cs, w);
            return { w: w, best: r.best, useEm: r.useEm, gap: r.gap };
          });
          var ref = null, maxD = 0;
          rows.forEach(function (r) {
            if (r.w.id === BASE_W) ref = r;
            maxD = Math.max(maxD, r.best.d);
          });
          rows.forEach(function (r) {
            r.idx = 100 * r.best.d / ref.best.d;
            r.width = 100 * r.best.d / maxD;
          });
          rows.sort(function (a, b) { return b.idx - a.idx; });
          list.innerHTML = rows.map(rowHTML).join('');
        },
      };
    },
  };
})(typeof globalThis !== 'undefined' ? globalThis : this);
