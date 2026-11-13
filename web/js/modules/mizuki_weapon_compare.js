/* 瑞希 · 武器对比：各武器在自身最优词条分配下的星扩散直伤指数
   （寝正月初晴 R1 = 100）。公共面板 = 伤害热图默认、不含武器。 */
(function (global) {
  'use strict';
  var GS = global.GS = global.GS || {};
  var M = GS.modules = GS.modules || {};
  var C = GS.core;
  var Mi = GS.core.mizuki;
  var H = Mi.HM;
  var el = GS.ui.panels.el;

  var BASE_ID = 'sleep1';
  var N_MAX = Mi.ROLL_LIMIT;

  /* 武器只填对星扩散直伤生效的部分：
     em = 武器带来的精通（副词条 + 特效，梦浮前，进模型时 ×1.1）；
     cr / cd / bonus = 面板增量；基础攻击力只用于显示。 */
  var WEAPONS = [
    { id: 'sleep1', tier: 5, name: '寝正月初晴 R1', base: 542, sub: '精通 +265',
      em: 513, note: '扩散 +120 / 战技 +96 / 爆发 +32（全覆盖）' },
    { id: 'sleep5', tier: 5, name: '寝正月初晴 R5', base: 542, sub: '精通 +265',
      em: 761, note: '扩散 +240 / 战技 +192 / 爆发 +64（全覆盖）' },
    { id: 'stargazer', tier: 5, name: '秘星典谕 R1', base: 542, sub: '暴伤 +88.2%',
      em: 120, cd: 112.2, note: '战技 +48、3 层 +72 精通；常驻 +24% 暴伤（星超导暴伤段不计）' },
    { id: 'truth1', tier: 5, name: '真语秘匣 R1', base: 542, sub: '暴伤 +88.2%',
      em: 80, cr: 8, cd: 88.2, note: '+8% 暴击；战技 +80 精通（月绽放暴伤段不计）' },
    { id: 'starcall1', tier: 5, name: '祭星者之望 R1', base: 542, sub: '精通 +265',
      em: 365, note: '+100 精通；护盾增伤不计' },
    { id: 'widsith1m', tier: 4, name: '流浪乐章 R1（精通曲）', base: 510, sub: '暴伤 +55.1%',
      em: 240, cd: 55.1, note: '命中「间奏曲」：+240 精通（10 秒）' },
    { id: 'widsith1e', tier: 4, name: '流浪乐章 R1（期望）', base: 510, sub: '暴伤 +55.1%',
      em: 80, cd: 55.1, note: '三选一，只有精通曲有效：1/3 × 240' },
    { id: 'widsith5m', tier: 4, name: '流浪乐章 R5（精通曲）', base: 510, sub: '暴伤 +55.1%',
      em: 480, cd: 55.1, note: '命中「间奏曲」：+480 精通（10 秒）' },
    { id: 'widsith5e', tier: 4, name: '流浪乐章 R5（期望）', base: 510, sub: '暴伤 +55.1%',
      em: 160, cd: 55.1, note: '三选一，只有精通曲有效：1/3 × 480' },
    { id: 'winter1', tier: 4, name: '凝雪沉心 R1', base: 510, sub: '暴伤 +55.1%',
      em: 40, cd: 55.1, bonus: 0.12, note: '辉映·星烁：2 名冰 → +40 精通 / +12% 星烁增伤' },
    { id: 'winter5', tier: 4, name: '凝雪沉心 R5', base: 510, sub: '暴伤 +55.1%',
      em: 80, cd: 55.1, bonus: 0.24, note: '辉映·星烁：2 名冰 → +80 精通 / +24% 星烁增伤' },
    { id: 'dream1', tier: 5, name: '千夜浮梦 R1', base: 542, sub: '精通 +265',
      em: 265, note: '默认队无同元素队友；异元素增伤不计' },
    { id: 'frost1', tier: 4, name: '霜辰 R1', base: 510, sub: '暴伤 +55.1%',
      em: 120, cd: 55.1, note: '重击 +72 / 战技 +48（按全覆盖）' },
    { id: 'frost5', tier: 4, name: '霜辰 R5', base: 510, sub: '暴伤 +55.1%',
      em: 240, cd: 55.1, note: '重击 +144 / 战技 +96（按全覆盖）' },
    { id: 'sac1', tier: 4, name: '祭礼残章 R1', base: 454, sub: '精通 +221.1',
      em: 221.1, note: '只计副词条精通；战技重置不计' },
    { id: 'lost1', tier: 5, name: '四风原典 R1', base: 608, sub: '暴击 +33.1%',
      cr: 33.1, note: '只计 33.1% 暴击；风伤加成未核实，未计' },
    { id: 'lute5', tier: 4, name: '天光的纺琴 R5', base: 510, sub: '充能 +45.9%',
      em: 200, note: '战技后 +200 精通（20 秒）' },

    /* 其他可选（默认不勾） */
    { id: 'evenstar5', tier: 4, name: '流浪的晚星 R5', base: 510, sub: '精通 +165',
      em: 165, note: '只计 165 精通；精通转攻击不计', extra: true },
    { id: 'kings5', tier: 4, name: '群王局戏 R5', base: 510, sub: '暴击 +27.6%',
      em: 200, cr: 27.6, note: '战技后 +200 精通（按全覆盖）；攻击不计', extra: true },
    { id: 'tome1', tier: 5, name: '万世流涌大典 R1', base: 542, sub: '暴伤 +88.2%',
      cd: 88.2, note: '只计 88.2% 暴伤；生命 / 重击增伤不计', extra: true },
    { id: 'surf1', tier: 5, name: '冲浪时光 R1', base: 542, sub: '暴伤 +88.2%',
      cd: 88.2, note: '只计 88.2% 暴伤；生命 / 普攻增伤不计', extra: true },
  ];

  var DEFAULT_IDS = ['sleep1', 'sleep5', 'stargazer', 'truth1', 'starcall1',
    'widsith1m', 'widsith1e', 'widsith5m', 'widsith5e',
    'winter1', 'winter5', 'dream1', 'frost1', 'frost5', 'sac1', 'lost1', 'lute5'];

  var BY_ID = {};
  WEAPONS.forEach(function (w) { BY_ID[w.id] = w; });

  /* 公共面板 = 伤害热图默认、不含武器：精通 709 + 廓然梦生 10% = 779.9（终值）；
     武器精通是梦浮前的量，进模型时 ×1.1。 */
  var COMMON = {
    emBase: 779.9,
    cr0: 36, cd0: 112.2,
    bonus: 1.9, baseUp: 0.21,
    resA: C.kappa(-0.45),
    nMax: N_MAX,
  };

  function withWeapon(w) {
    return {
      emBase: COMMON.emBase + (w.em || 0) * H.EM_MULT,
      cr0: COMMON.cr0 + (w.cr || 0),
      cd0: COMMON.cd0 + (w.cd || 0),
      bonus: COMMON.bonus + (w.bonus || 0),
      baseUp: COMMON.baseUp,
      resA: COMMON.resA,
      nMax: N_MAX,
    };
  }

  function rowOf(w, n) {
    var s = withWeapon(w);
    var p = H.optAt(s, n);
    var d = H.direct(s, p.x, p.y);
    var t = Mi.allocAt(p.y, s.cr0, s.cd0);
    return {
      w: w, x: p.x, y: p.y, d: d,
      em: H.emAt(s.emBase, p.x),
      cr: Math.min(t.cr, 100), cd: t.cd,
    };
  }

  function rowHTML(r) {
    return '<div class="wrow t' + r.w.tier + (r.w.id === BASE_ID ? ' base' : '') + '">' +
      '<div><div class="wname">' + r.w.name + '</div><div class="wsub">' + r.w.base + ' 基础 · ' + r.w.sub + '</div></div>' +
      '<div class="wbar"><div class="fill" style="width:' + r.width.toFixed(1) + '%"></div><b>' + r.idx.toFixed(1) + '</b></div>' +
      '<div><div class="wsplit">最优：精通 ' + r.x.toFixed(1) + ' · 双暴 ' + r.y.toFixed(1) + '</div>' +
      '<div class="whead"><b>' + Math.round(r.d).toLocaleString() + '</b> · 面板 ' + r.em.toFixed(0) +
      ' · ' + r.cr.toFixed(0) + ' / ' + r.cd.toFixed(0) + '</div></div>' +
      '<div class="wnote">' + r.w.note + '</div>' +
    '</div>';
  }

  var FOOT =
    '武器只计对星扩散直伤生效的部分，基础攻击力不进入公式。' +
    '公共面板 = 伤害热图默认、不含武器：精通 <b>779.9</b>（终值）+ 武器精通 ×1.1，暴击 36% / 暴伤 112.2% / ' +
    '星扩散增伤 190% / 基础提升 21%，敌人风抗 10% − 削减 55%。' +
    '<b>指数</b> = 该武器最优分配下的直伤 ÷ 寝正月初晴 R1 同口径 × 100；行内「最优」下方为绝对伤害，' +
    '面板 = 精通 · 暴击 / 暴伤。' +
    '通用增伤（流浪乐章的增伤曲、千夜浮梦的异元素、祭星者之望的护盾、四风原典的风伤）是否作用于星扩散尚未核实，均未计；' +
    '各武器的特效假设见行内注。';

  function weaponPicker(cell, api) {
    var bar = el('div', 'wpick__bar');
    var all = el('button', 'btn btn--ghost', '全选');
    var def = el('button', 'btn btn--ghost', '恢复默认');
    all.type = 'button'; def.type = 'button';
    bar.appendChild(all); bar.appendChild(def);
    cell.appendChild(bar);

    var boxes = [];
    var grid = el('div', 'wpick');
    function addGroup(title, list) {
      if (!list.length) return;
      if (title) grid.appendChild(el('div', 'wpick__hd', title));
      list.forEach(function (w) {
        var lab = el('label');
        var cb = el('input');
        cb.type = 'checkbox';
        cb.checked = current().indexOf(w.id) >= 0;
        cb.addEventListener('change', function () {
          var ids = current().slice();
          if (cb.checked) { if (ids.indexOf(w.id) < 0) ids.push(w.id); }
          else ids = ids.filter(function (id) { return id !== w.id; });
          api.state.weapons = ids;
          api.commit('weapons');
        });
        lab.appendChild(cb);
        lab.appendChild(el('span', null, w.name.replace('流浪乐章 ', '流浪 ').replace('（', ' ').replace('）', '')));
        grid.appendChild(lab);
        boxes.push({ id: w.id, cb: cb });
      });
    }
    function current() {
      return Array.isArray(api.state.weapons) ? api.state.weapons : DEFAULT_IDS.slice();
    }
    function sync(ids) {
      boxes.forEach(function (b) { b.cb.checked = ids.indexOf(b.id) >= 0; });
    }
    all.addEventListener('click', function () {
      var ids = WEAPONS.map(function (w) { return w.id; });
      api.state.weapons = ids; sync(ids); api.commit('weapons');
    });
    def.addEventListener('click', function () {
      api.state.weapons = DEFAULT_IDS.slice(); sync(DEFAULT_IDS); api.commit('weapons');
    });

    addGroup('', WEAPONS.filter(function (w) { return !w.extra; }));
    addGroup('其他可选', WEAPONS.filter(function (w) { return w.extra; }));
    cell.appendChild(grid);
  }

  M['mizuki/weapon_compare'] = {
    title: '「梦见月瑞希」星扩散武器对比',
    tab: '瑞希·武器对比',
    noPlotly: true,
    intro: '各武器在自身最优词条分配下的星扩散直伤指数，以寝正月初晴 R1 = 100；' +
      '公共面板同伤害热图（不含武器），词条预算可调；在「对比武器」里勾选要显示的武器与精炼阶数。',
    controls: [
      {
        key: '', type: 'note',
        html: '<b>公共面板 = 伤害热图默认、不含武器</b>：精通 779.9（终值）+ 武器精通 ×1.1，' +
          '暴击 36% / 暴伤 112.2% / 星扩散增伤 190% / 基础提升 21%。武器特效只计对星扩散直伤生效的部分。',
      },
      { key: 'n', type: 'range', label: '词条预算', def: 30, min: 2, max: N_MAX, step: 1 },
      {
        type: 'group', label: '对比武器', open: false,
        items: [
          { key: 'weapons', type: 'custom', def: DEFAULT_IDS, build: weaponPicker },
        ],
      },
    ],

    create: function (host) {
      var list = el('div', 'wlist');
      host.appendChild(list);
      host.appendChild(GS.ui.panels.note(FOOT, 'pagenote'));

      return {
        update: function (s) {
          var n = Number(s.n) || 30;
          var ids = Array.isArray(s.weapons) ? s.weapons : DEFAULT_IDS;
          var base = rowOf(BY_ID[BASE_ID], n);
          var rows = WEAPONS.filter(function (w) { return ids.indexOf(w.id) >= 0; })
            .map(function (w) { return rowOf(w, n); });
          if (!rows.length) {
            list.innerHTML = '<div class="wnote" style="padding:14px">至少选择一把武器。</div>';
            return;
          }
          var maxD = Math.max.apply(null, rows.map(function (r) { return r.d; }));
          rows.forEach(function (r) {
            r.idx = 100 * r.d / base.d;
            r.width = 100 * r.d / maxD;
          });
          rows.sort(function (a, b) { return b.idx - a.idx; });
          list.innerHTML = rows.map(rowHTML).join('');
        },
      };
    },
  };
})(typeof globalThis !== 'undefined' ? globalThis : this);
