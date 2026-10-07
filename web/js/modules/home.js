/* 首页：按主题分区的入口卡片（标题 / 说明 / 结论 take / 配色条）。 */
(function (global) {
  'use strict';
  var GS = global.GS = global.GS || {};
  var M = GS.modules = GS.modules || {};
  var el = GS.ui.panels.el;

  var SECTIONS = [
    {
      h: '「梦见月瑞希」星扩散',
      lead: '三张交互页面 + 一页机制说明。',
      items: [
        {
          route: 'mizuki/scarlet_vs_em', title: '血红之证 4 件套 vs 精通套', strip: 's1',
          desc: '两套圣遗物的比值热力图，同时就是计算器：填面板，图上的十字准星定位，给出比值、谁更优、精通到多少才翻面；对比的精通套可在<b>精通 2+2</b> 与<b>饰金之梦 4 件套</b>之间切换；「星扩散直伤占比」滑条可把反应按给定比例并入。',
          take: '分界线随双暴分与所选精通套在 <b>约 850 ~ 1220 精通</b>之间移动；饰金之梦比 2+2 只多 20 精通，却足以翻面 —— 默认面板几乎压在线上（血红 / 饰金 = 1.0036，分界线 978）。',
        },
        {
          route: 'mizuki/em_vs_crit', title: '精通和双暴的词条分配', strip: 's2',
          desc: '曲线图：悬浮读该点的双暴拆分、精通与伤害倍数；基准面板、星扩散增伤、星扩散直伤占比、曲线取哪几个词条数都可改。',
          take: '最优存在但<b>不敏感</b>：双暴词条先补暴击率到 1 : 2，之后按 1 : 2 同步加。',
        },
        {
          route: 'mizuki/em_crit_map', title: '精通 × 双暴分的伤害热图', strip: 's3',
          desc: '伤害热力图 + 最优分配线 + 等词条线：悬浮给「下一词条」方向，点击固定读数与标注；「星扩散直伤占比」滑条可把反应按给定比例并入。',
          take: '等词条线（10 / 20 / 30 / 40）与最优分配线的交点 = <b>该词条数下的最优拆分</b>。',
        },
        {
          route: 'mizuki/stellar_swirl', title: '星扩散机制', strip: 's4',
          desc: '开头是一个按面板算共用系数的计算器；下面是三条伤害公式与各乘区、风涡与引爆、瑞希相关天赋、实测直伤占比，以及三个计算页共用的口径（等效词条、双暴分、配平）。',
          take: '看计算页面之前，先在这里对齐口径。',
        },
      ],
    },
    {
      h: '「桑多涅」星超导',
      lead: '星超导：三属性词条分配 + 武器横评。',
      items: [
        {
          route: 'sandrone/star_superconduct', title: '星超导词条分配', strip: 's8',
          desc: '把 n 个等效词条分给精通 / 双暴 / 攻击（攻击吃剩余）：热力图上每个点是一套分配，颜色 = 相对基准面板的伤害倍数，叠加倍数等高线；悬浮读该点的面板与倍数、并跟随一支指向<b>上升最快方向</b>的箭头；最优点标记；词条预算上到 53（桑多涅满副词条容量）。',
          take: '默认面板（桑多涅 + 浪影阔剑，30 词条）下最优 ≈ 精通 12 · 双暴 18 · 攻击 0 —— <b>攻攻主词条之后，副词条再堆攻击的边际垫底</b>。',
        },
        {
          route: 'sandrone/weapon_compare', title: '武器对比', strip: 's9',
          desc: '8 把双手剑在各自最优词条分配下的伤害指数，以超越之匙 R1 = 100（五星浅棕底 / 四星浅紫底）；词条预算与基准面板可改；特效只计对星超导生效的常驻部分（假设行内注明）。',
          take: '超越之匙 100 ｜ 苇海信标 85.6 ｜ 焚曜千阳 84.4 ｜ 无工之剑 80.7 ｜ 狼的末路 75.6 ｜ 赤角石溃杵 73.6 ｜ 浪影阔剑 R5 73.2 ｜ 螭骨剑 63.8（默认口径、30 词条）。',
        },
      ],
    },
    {
      h: '基础专题',
      lead: '与具体角色无关的通用分析 —— 某个乘区本身的性质，做新角色时同样适用。',
      items: [
        {
          route: 'basics/resistance', title: '抗性区：减抗收益', strip: 's5',
          desc: '两张曲线图：上为收益倍数（相对不减抗），下为等效血量（相对 10% 抗性敌人）。滑动条设减抗量（也可直接填更大的值），红曲线 = 当前档、灰蓝曲线 = 自填的对比档位；横轴范围可调（默认 0 ~ 150%），并给出 10% / 70% 抗性敌人的逐档读数。下方另有抗性系数 κ(r) 与边际收益两张说明图。',
          take: '固定减抗的收益峰值 = <b>1 + 4S</b>（落在 75% 抗性的敌人身上）；抗性过了 75%，收益反而回落。',
        },
        {
          route: 'basics/crit_dist', title: '暴击：波动 —— 一次尝试的 DPS 分布', strip: 's6',
          desc: '伤害段可增删（次数、时间、暴击率 / 暴伤各自填）：未满暴时反复打，DPS 是一个<b>精确可算的分布</b>（各段二项分布卷积，不用正态近似）。给出期望、σ、μ ± σ / μ ± 3σ 的实际覆盖率、分位档，以及「打 K 次取最好」的累积曲线。',
          take: '「打 7 次取最好」≈ 看<b>前 9.4%</b> 的分位；μ + 3σ 常常超过伤害上限 —— 正态近似在这里会骗人。',
        },
        {
          route: 'basics/crit_split', title: '暴击：分配 —— 以分位数而非期望为目标', strip: 's7',
          desc: '双暴分固定，在暴击率与暴伤之间重新分：逐档给出「前 q 可达伤害」的最优暴击率 / 暴伤、分位增益与均值代价，另有分位曲线族（锯齿如实画）、最优暴击率随分位、收益与代价三张图。',
          take: '1 : 2 只是<b>均值</b>口径的最优 —— 越赌（看前 10%）最优暴击率越低，越稳则越高。',
        },
      ],
    },
  ];

  M.home = {
    title: '原神强度计算',
    tab: '原神强度计算',
    layout: 'home',
    intro: '原神伤害计算与可视化：以梦见月瑞希的星扩散、桑多涅的星超导为例，含抗性区、暴击区等与角色无关的基础乘区分析。',
    create: function (host) {
      SECTIONS.forEach(function (sec) {
        var wrap = el('section', 'home__sec');
        wrap.appendChild(el('h2', null, sec.h));
        wrap.appendChild(el('p', 'home__lead', sec.lead));
        var grid = el('div', 'cardgrid');
        sec.items.forEach(function (it) {
          var a = el('a', 'entry');
          a.href = '#/' + it.route;
          a.innerHTML =
            '<span class="entry__head">' +
              '<span class="entry__ico">' + (GS.app.navIcon ? GS.app.navIcon(it.route) : '') + '</span>' +
              '<h3>' + it.title + '</h3><span class="entry__go">→</span>' +
            '</span>' +
            '<div class="entry__strip ' + it.strip + '"></div>' +
            '<p>' + it.desc + '</p>' +
            '<div class="entry__take">' + it.take + '</div>';
          grid.appendChild(a);
        });
        wrap.appendChild(grid);
        host.appendChild(wrap);
      });
      return { update: function () {} };
    },
  };
})(typeof globalThis !== 'undefined' ? globalThis : this);
