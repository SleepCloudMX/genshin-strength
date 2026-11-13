/* 瑞希 · 武器对比：各武器在自身最优词条分配下的星扩散直伤指数
   （寝正月初晴 R1 = 100）。公共面板 = 伤害热图默认、不含武器。
   默认表固定；配置可额外加一条自定义「武器 + 精炼」对比行。 */
(function (global) {
  'use strict';
  var GS = global.GS = global.GS || {};
  var M = GS.modules = GS.modules || {};
  var C = GS.core;
  var Mi = GS.core.mizuki;
  var H = Mi.HM;
  var el = GS.ui.panels.el;

  var BASE = { family: 'sleep', refine: 1 };
  var N_MAX = Mi.ROLL_LIMIT;

  /* 武器族：refine(r) 返回该精炼下对星扩散直伤有效的面板增量与行内注。
     em 是梦浮前的量，进模型时 ×1.1；基础攻击力只用于显示。 */
  var FAMILIES = [
    { id: 'sleep', name: '寝正月初晴', tier: 5, base: 542, sub: '精通 +265',
      refine: function (r) {
        var swirl = [120, 150, 180, 210, 240][r - 1];
        var e = [96, 120, 144, 168, 192][r - 1];
        var q = [32, 40, 48, 56, 64][r - 1];
        return { em: 265 + swirl + e + q,
          note: '扩散 +' + swirl + ' / 战技 +' + e + ' / 爆发 +' + q + '（全覆盖）' };
      } },
    { id: 'stargazer', name: '秘星典谕', tier: 5, base: 542, sub: '暴伤 +88.2%',
      refine: function (r) {
        var cd = [24, 30, 36, 42, 48][r - 1];
        var e = [48, 60, 72, 84, 96][r - 1];
        var st = [24, 30, 36, 42, 48][r - 1];
        return { em: e + 3 * st, cd: 88.2 + cd,
          note: '战技 +' + e + '、3 层 +' + (3 * st) + ' 精通；常驻 +' + cd + '% 暴伤（星超导暴伤段不计）' };
      } },
    { id: 'truth', name: '真语秘匣', tier: 5, base: 542, sub: '暴伤 +88.2%',
      refine: function (r) {
        var cr = [8, 10, 12, 14, 16][r - 1];
        var e = [80, 100, 120, 140, 160][r - 1];
        return { em: e, cr: cr, cd: 88.2,
          note: '+' + cr + '% 暴击；战技 +' + e + ' 精通（月绽放暴伤段不计）' };
      } },
    { id: 'starcall', name: '祭星者之望', tier: 5, base: 542, sub: '精通 +265',
      refine: function (r) {
        var em = [100, 125, 150, 175, 200][r - 1];
        return { em: 265 + em, note: '+' + em + ' 精通；护盾增伤不计' };
      } },
    { id: 'widsith_m', name: '流浪乐章（精通曲）', tier: 4, base: 510, sub: '暴伤 +55.1%',
      refine: function (r) {
        var em = [240, 300, 360, 420, 480][r - 1];
        return { em: em, cd: 55.1, note: '命中「间奏曲」：+' + em + ' 精通（10 秒）' };
      } },
    { id: 'widsith_e', name: '流浪乐章（期望）', tier: 4, base: 510, sub: '暴伤 +55.1%',
      refine: function (r) {
        var em = [240, 300, 360, 420, 480][r - 1];
        return { em: em / 3, cd: 55.1, note: '三选一，只有精通曲有效：1/3 × ' + em };
      } },
    { id: 'winter', name: '凝雪沉心', tier: 4, base: 510, sub: '暴伤 +55.1%',
      refine: function (r) {
        var per = [20, 25, 30, 35, 40][r - 1];
        var bp = [6, 7.5, 9, 10.5, 12][r - 1];
        return { em: 2 * per, cd: 55.1, bonus: 2 * bp / 100,
          note: '辉映·星烁：2 名冰 → +' + (2 * per) + ' 精通 / +' + (2 * bp) + '% 星烁增伤' };
      } },
    { id: 'dream', name: '千夜浮梦', tier: 5, base: 542, sub: '精通 +265',
      refine: function () { return { em: 265, note: '默认队无同元素队友；异元素增伤不计' }; } },
    { id: 'frost', name: '霜辰', tier: 4, base: 510, sub: '暴伤 +55.1%',
      refine: function (r) {
        var ca = [72, 90, 108, 126, 144][r - 1];
        var e = [48, 60, 72, 84, 96][r - 1];
        return { em: ca + e, cd: 55.1, note: '重击 +' + ca + ' / 战技 +' + e + '（按全覆盖）' };
      } },
    { id: 'sac', name: '祭礼残章', tier: 4, base: 454, sub: '精通 +221.1',
      refine: function () { return { em: 221.1, note: '只计副词条精通；战技重置不计' }; } },
    { id: 'lost', name: '四风原典', tier: 5, base: 608, sub: '暴击 +33.1%',
      refine: function () { return { cr: 33.1, note: '只计 33.1% 暴击；风伤加成未核实，未计' }; } },
    { id: 'lute', name: '天光的纺琴', tier: 4, base: 510, sub: '充能 +45.9%', minR: 5, maxR: 5,
      refine: function () { return { em: 200, note: '战技后 +200 精通（20 秒）' }; } },
  ];

  var BY_ID = {};
  FAMILIES.forEach(function (f) { BY_ID[f.id] = f; });

  var DEFAULT_ROWS = [
    ['sleep', 1], ['sleep', 5],
    ['stargazer', 1], ['truth', 1], ['starcall', 1],
    ['widsith_m', 1], ['widsith_e', 1], ['widsith_m', 5], ['widsith_e', 5],
    ['winter', 1], ['winter', 5],
    ['dream', 1],
    ['frost', 1], ['frost', 5],
    ['sac', 1], ['lost', 1],
    ['lute', 5],
  ];

  /* 公共面板 = 伤害热图默认、不含武器：精通 709 + 廓然梦生 10% = 779.9（终值）；
     武器精通是梦浮前的量，进模型时 ×1.1。 */
  var COMMON = {
    emBase: 779.9,
    cr0: 36, cd0: 112.2,
    bonus: 1.9, baseUp: 0.21,
    resA: C.kappa(-0.45),
    nMax: N_MAX,
  };

  function clampRefine(f, r) {
    return Math.min(Math.max(r, f.minR || 1), f.maxR || 5);
  }

  function makeRow(f, r, n, extra) {
    r = clampRefine(f, r);
    var b = f.refine(r);
    var s = {
      emBase: COMMON.emBase + (b.em || 0) * H.EM_MULT,
      cr0: COMMON.cr0 + (b.cr || 0),
      cd0: COMMON.cd0 + (b.cd || 0),
      bonus: COMMON.bonus + (b.bonus || 0),
      baseUp: COMMON.baseUp,
      resA: COMMON.resA,
      nMax: N_MAX,
    };
    var p = H.optAt(s, n);
    var d = H.direct(s, p.x, p.y);
    var t = Mi.allocAt(p.y, s.cr0, s.cd0);
    return {
      f: f, r: r, extra: !!extra, note: b.note,
      x: p.x, y: p.y, d: d,
      em: H.emAt(s.emBase, p.x),
      cr: Math.min(t.cr, 100), cd: t.cd,
    };
  }

  function rowHTML(r) {
    var isBase = !r.extra && r.f.id === BASE.family && r.r === BASE.refine;
    return '<div class="wrow t' + r.f.tier + (isBase ? ' base' : '') + (r.extra ? ' extra' : '') + '">' +
      '<div><div class="wname">' + r.f.name + ' R' + r.r +
        (r.extra ? '<span class="wtag">附加</span>' : '') + '</div>' +
        '<div class="wsub">' + r.f.base + ' 基础 · ' + r.f.sub + '</div></div>' +
      '<div class="wbar"><div class="fill" style="width:' + r.width.toFixed(1) + '%"></div><b>' + r.idx.toFixed(1) + '</b></div>' +
      '<div><div class="wsplit">最优：精通 ' + r.x.toFixed(1) + ' · 双暴 ' + r.y.toFixed(1) + '</div>' +
      '<div class="whead"><b>' + Math.round(r.d).toLocaleString() + '</b> · 面板 ' + r.em.toFixed(0) +
      ' · ' + r.cr.toFixed(0) + ' / ' + r.cd.toFixed(0) + '</div></div>' +
      '<div class="wnote">' + r.note + '</div>' +
    '</div>';
  }

  var FOOT =
    '武器只计对星扩散直伤生效的部分，基础攻击力不进入公式。' +
    '公共面板 = 伤害热图默认、不含武器：精通 <b>779.9</b>（终值）+ 武器精通 ×1.1，暴击 36% / 暴伤 112.2% / ' +
    '星扩散增伤 190% / 基础提升 21%，敌人风抗 10% − 削减 55%。' +
    '<b>指数</b> = 该武器最优分配下的直伤 ÷ 寝正月初晴 R1 同口径 × 100；行内「最优」下方为绝对伤害，' +
    '面板 = 精通 · 暴击 / 暴伤。' +
    '通用增伤（流浪乐章的增伤曲、千夜浮梦的异元素、祭星者之望的护盾、四风原典的风伤）是否作用于星扩散尚未核实，均未计；' +
    '各武器的特效假设见行内注；天光的纺琴只有 R5。';

  function extraBuilder(cell, api) {
    var wrap = el('div', 'wadd');
    var famLab = el('label', null, '武器');
    var famSel = el('select', 'field__input');
    FAMILIES.forEach(function (f) {
      var o = el('option', null, f.name);
      o.value = f.id;
      famSel.appendChild(o);
    });
    famLab.appendChild(famSel);

    var refLab = el('label', null, '精炼');
    var refSel = el('select', 'field__input');
    refLab.appendChild(refSel);

    function fillRefine() {
      var f = BY_ID[famSel.value], lo = f.minR || 1, hi = f.maxR || 5;
      refSel.innerHTML = '';
      for (var r = lo; r <= hi; r++) {
        var o = el('option', null, 'R' + r);
        o.value = String(r);
        refSel.appendChild(o);
      }
    }
    famSel.addEventListener('change', fillRefine);
    fillRefine();

    var btns = el('div', 'wadd__btns');
    var add = el('button', 'btn btn--ghost', '添加 / 更新');
    var clear = el('button', 'btn btn--ghost', '清除附加行');
    add.type = 'button'; clear.type = 'button';
    var status = el('div', 'wadd__status', '');

    function refresh() {
      var x = api.state.extra;
      status.textContent = x && BY_ID[x.family]
        ? '当前附加：' + BY_ID[x.family].name + ' R' + clampRefine(BY_ID[x.family], x.refine)
        : '当前未附加';
    }
    add.addEventListener('click', function () {
      api.state.extra = { family: famSel.value, refine: Number(refSel.value) };
      refresh();
      api.commit('extra');
    });
    clear.addEventListener('click', function () {
      api.state.extra = null;
      refresh();
      api.commit('extra');
    });
    btns.appendChild(add);
    btns.appendChild(clear);
    wrap.appendChild(famLab);
    wrap.appendChild(refLab);
    wrap.appendChild(btns);
    wrap.appendChild(status);
    cell.appendChild(wrap);
    refresh();
  }

  M['mizuki/weapon_compare'] = {
    title: '「梦见月瑞希」星扩散武器对比',
    tab: '瑞希·武器对比',
    noPlotly: true,
    intro: '各武器在自身最优词条分配下的星扩散直伤指数，以寝正月初晴 R1 = 100；' +
      '公共面板同伤害热图（不含武器），词条预算可调。默认 17 行；需要 R2/3/4 时，' +
      '在「附加对比行」里选武器与精炼，把额外一行加到表里。',
    controls: [
      {
        key: '', type: 'note',
        html: '<b>公共面板 = 伤害热图默认、不含武器</b>：精通 779.9（终值）+ 武器精通 ×1.1，' +
          '暴击 36% / 暴伤 112.2% / 星扩散增伤 190% / 基础提升 21%。武器特效只计对星扩散直伤生效的部分。',
      },
      { key: 'n', type: 'range', label: '词条预算', def: 30, min: 2, max: N_MAX, step: 1 },
      {
        type: 'group', label: '附加对比行', open: false,
        items: [
          { key: 'extra', type: 'custom', build: extraBuilder },
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
          var base = makeRow(BY_ID[BASE.family], BASE.refine, n);
          var rows = DEFAULT_ROWS.map(function (p) { return makeRow(BY_ID[p[0]], p[1], n); });
          if (s.extra && BY_ID[s.extra.family]) {
            rows.push(makeRow(BY_ID[s.extra.family], s.extra.refine, n, true));
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
