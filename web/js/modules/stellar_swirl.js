/* 瑞希 · 星扩散机制（doc 页）：开头是共用系数计算器，后面是静态说明。KaTeX 由外壳按需加载。 */
(function (global) {
  'use strict';
  var GS = global.GS = global.GS || {};
  var M = GS.modules = GS.modules || {};
  var C = GS.core;
  var el = GS.ui.panels.el;

  var f3 = function (v) { return v.toFixed(3); };

  var CALC_DEFAULTS = { em: 1100, cr: 80, cd: 160, bonus: 140, base: 14, extra: 0, shred: 0, res: 10, asc: 1 };

  var PROSE = '' +
    '<h2>1. 星扩散是什么</h2>' +
    '<ul>' +
    '<li>星扩散属「<b>星烁反应</b>」体系，是一种<b>异化剧变反应</b>：由<b>冰元素扩散</b>转化而来，队伍里需要有转化角色（奥黛塔 / 桑多涅 / 冰元素旅行者等）；没有转化角色时只会发生普通冰扩散。</li>' +
    '<li>伤害分两条路径，<b>乘区结构完全一致</b>，只有「基础项」不同：' +
      '<ul>' +
      '<li><b>反应星扩散</b> —— 反应本身的伤害：触发星扩散时立刻造成一次（风元素）；风涡引爆时再造成一次（冰元素）。</li>' +
      '<li><b>星扩散直伤</b> —— 由角色天赋倍率决定的伤害（瑞希走这条，属性 = 元素精通）。</li>' +
      '</ul>' +
    '</li>' +
    '<li><b>风涡</b>：每次触发星扩散反应，风涡系数 +1，上限 6；满 6 立即引爆并清零，否则到时自动引爆并清零。冰段（引爆）的倍率随风涡系数变化。</li>' +
    '<li><b>可暴击</b>：传统剧变反应不可暴击，星扩散可以 —— 这是它最特殊的地方。</li>' +
    '</ul>' +

    '<h2>2. 三条公式</h2>' +
    '<div class="formula">$$\\begin{aligned}' +
    '\\text{反应星扩散（风）} = {} & 1446.85 \\times 0.75 \\times (1 + \\text{基础提升}\\%) \\\\' +
    '& \\times \\left(1 + \\frac{6 \\times \\text{元素精通}}{\\text{元素精通} + 2000} + \\text{星扩散增伤}\\%\\right) \\\\' +
    '& \\times \\text{抗性系数} \\times \\text{暴击区} \\times \\text{擢升}' +
    '\\end{aligned}$$</div>' +
    '<div class="formula">$$\\begin{aligned}' +
    '\\text{反应星扩散（冰）} = {} & 1446.85 \\times \\text{基础倍率} \\times (1 + \\text{基础提升}\\%) \\\\' +
    '& \\times \\left(1 + \\frac{6 \\times \\text{元素精通}}{\\text{元素精通} + 2000} + \\text{星扩散增伤}\\%\\right) \\\\' +
    '& \\times \\text{抗性系数} \\times \\text{暴击区} \\times \\text{擢升}' +
    '\\end{aligned}$$' +
    '<div class="chartnote">基础倍率：风涡系数 1 ~ 2 → 2；系数 3 ~ 6 → 3</div></div>' +
    '<div class="formula">$$\\begin{aligned}' +
    '\\text{星扩散直伤基础} = {} & \\text{属性} \\times \\text{倍率} \\times (1 + \\text{基础提升}\\%) \\\\' +
    '& \\times \\left(1 + \\frac{6 \\times \\text{元素精通}}{\\text{元素精通} + 2000} + \\text{星扩散增伤}\\%\\right)' +
    '\\end{aligned}$$' +
    '$$\\text{最终直伤} = (\\text{直伤基础} + \\text{额外提升}) \\times \\text{抗性系数} \\times \\text{暴击区} \\times \\text{擢升}$$</div>' +
    '<p>其中 <b>1446.85</b> 是 90 级剧变反应的等级基数，不是星扩散专属常数 —— <b>直伤不用它</b>，直伤直接取角色天赋倍率（基础系数 1.0）。</p>' +

    '<h2>3. 各乘区</h2>' +
    '<table>' +
    '<tr><th style="width:130px">乘区</th><th>说明</th></tr>' +
    '<tr><td><b>基础提升%</b></td><td>独立乘区，乘在整个倍率区外面，与任何项都不稀释。来源：奥黛塔固有天赋 3（每 100 攻 +0.7%，上限 <b>14%</b>）、冰主固有天赋（每 100 攻 +0.35%，上限 <b>7%</b>）。</td></tr>' +
    '<tr><td><b>精通项</b></td><td>\\(6 \\times \\text{元素精通} / (\\text{元素精通} + 2000)\\) —— 星扩散的精通系数是 <b>6</b>（传统剧变反应是 16）。与「星扩散增伤%」<b>加在同一个括号里</b>，两者互相稀释。</td></tr>' +
    '<tr><td><b>星扩散增伤%</b></td><td>各来源之间<b>加算</b>（不是独立乘区）。例：炉火融炼之心 4 件套 +50%、七七固有天赋 3（谕示强化后）+50%、血红之证 4 件套 +40%、迪奥娜 C6（谕示强化后）+40%、冰主 C6 +5% / 层（上限 40%）、翠绿之影 4 件套 +20%。</td></tr>' +
    '<tr><td><b>抗性系数</b></td><td>通用分段函数（抗性记作 \\(r\\)）：\\(r &lt; 0\\) 时 \\(1 - r/2\\)；\\(0 \\le r &lt; 0.75\\) 时 \\(1 - r\\)；\\(r \\ge 0.75\\) 时 \\(1/(4r+1)\\)。星扩散<b>按伤害元素取抗性</b>（风段用风抗、冰段用冰抗）。<b>反应伤害无防御区</b>。</td></tr>' +
    '<tr><td><b>暴击区</b></td><td>\\(1 + \\text{暴击率} \\times \\text{暴伤}\\)（<b>期望值</b>口径）。暴击率上限 100%，溢出无效。星扩散是可暴击的剧变反应。</td></tr>' +
    '<tr><td><b>额外提升</b></td><td>直伤公式末端的固定加伤项（如某些命座提供），直接加在直伤基础上 —— <b>不吃</b>精通项、也<b>不吃</b>星扩散增伤。</td></tr>' +
    '<tr><td><b>擢升</b></td><td>独立百分比乘区，形态 \\(\\times (1 + \\text{擢升}\\%)\\)。来源只有限定五星命座（常见 10% ~ 45%），没有圣遗物 / 武器 / 天赋来源。</td></tr>' +
    '</table>' +

    '<h2>4. 反应伤害的角色分摊</h2>' +
    '<p>反应星扩散的最终伤害按角色分摊：按各角色造成伤害量从大到小，依次为 <b>3/5、3/10、1/20、1/20</b>。风段的最大份额归风元素角色，冰段的最大份额归冰元素角色。</p>' +

    '<h2>5. 瑞希（本项目的主角）</h2>' +
    '<ul>' +
    '<li>伤害主体是<b>星扩散直伤</b>，来自天赋「<b>廓然梦生</b>」：提升值相当于<b>元素精通的 1000%</b>，每 2.5 秒至多触发一次（内置 CD）。属性 = 元素精通，所以精通在公式里<b>出现两次</b>（一次作线性属性、一次进精通项）—— 这是精通收益很高的原因。</li>' +
    '<li>「廓然梦生」同时给全队精通：梦浮时附近<b>队友</b>获得相当于瑞希自身精通 <b>10%</b> 的精通。</li>' +
    '<li>固有天赋「<b>昼想夜梦</b>」：梦浮状态下，队友的火 / 水 / 冰 / 雷攻击命中敌人时，<b>瑞希自身</b>精通 +100，持续 4 秒。</li>' +
    '<li>「<b>名月浮声</b>」：梦浮期间触发扩散 / 星扩散，梦浮时长 +2.5 秒（不给精通）。</li>' +
    '</ul>' +

    '<h2 id="share">6. 星扩散直伤占比（实测）</h2>' +
    '<ul>' +
    '<li><b>直伤占比</b> = 直伤 ÷（直伤 + 反应）。三个计算页面的滑条按这个比例把反应并入总伤。</li>' +
    '<li>测法：奥黛塔 + 瑞希，自定义满暴、只放 E（不普攻 / 爆发 / 闪避）；每次测完重开关卡，测 3 次取平均。</li>' +
    '<li>数据：瑞希 80 → 90 级，直伤不变、反应 ×1.3429（反应吃角色等级基数），单人总伤 +3.6% —— 解得直伤占比 <b>89.40%</b>（80 级）、<b>86.27%</b>（90 级）。</li>' +
    '<li>结论：直伤约占九成属实 —— 套装差距因此很小：血红之证的期望伤害比精通 2+2 / 饰金高 1% ~ 4%（与基础面板、队友加成有关），配装不必强求。</li>' +
    '<li>同一升级对全队的提升约 2%（随其他角色练度）—— 收益不大，资源有限时可不升级。</li>' +
    '<li>占比随队友与配置变化，以上数据仅供参考。</li>' +
    '</ul>' +

    '<h2>7. 三个计算页面共用的口径</h2>' +
    '<ul>' +
    '<li><b>等效词条</b>：1 词条 = 20 精通 = 3.3% 暴击 = 6.6% 暴伤。<b>只适用于副词条</b> —— 主词条、武器、天赋、队友给的量不能换算。</li>' +
    '<li><b>双暴分</b> = 2 × 暴击率 + 暴伤（等效暴伤）。理之冠的暴击 / 暴伤主词条自由选取，两种冠的双暴分相同，所以用它描述基准面板。</li>' +
    '<li><b>基准面板</b> = 上完 buff、不含副词条 —— 副词条正是三个页面里要分配的对象。</li>' +
    '<li>每个点都假设双暴已按 <b>1:2 配平</b>（先补基准的偏斜），暴击区取期望值。</li>' +
    '<li><b>星扩散伤害 = 星扩散直伤（大头）+ 反应星扩散</b>。两条路径共用乘区，合并后可写成（元素精通 + W）的形式（W = 反应折算成多少点精通）。三个页面上的「星扩散直伤占比」滑条按<b>给定常数</b>把反应并入；页面不根据配置推算真实占比（实测约九成，见上一节）。</li>' +
    '<li>「只换一件装备 / 一套圣遗物」的比值分析里，同队伍下相同的项 —— 倍率、(1 + 基础提升%)、抗性系数、擢升 —— 可以约掉。</li>' +
    '</ul>';

  var FOOT = '整理自本项目的机制文档（源：玉衡杯数据库 7.0v1 解包数据、biligame WIKI、NGA 数据讨论帖；直伤占比为游戏内实测）；' +
    '公式与数值为非官方文本，请酌情参考。';

  M['mizuki/stellar_swirl'] = {
    title: '「梦见月瑞希」星扩散机制',
    tab: '瑞希·星扩散机制',
    layout: 'doc',
    math: true,
    noPlotly: true,
    intro: '先是一个按面板算「共用系数」的计算器，往下是星扩散的机制、三条伤害公式、各乘区与三个计算页面共用的口径。' +
      '公式与数值来自社区解包数据（直伤占比为游戏内实测），非官方文本。',
    create: function (host, ctx) {
      var CALC_FIELDS = [
        { id: 'em', label: '元素精通', step: 10, def: CALC_DEFAULTS.em },
        { id: 'cr', label: '暴击率 %', step: 1, def: CALC_DEFAULTS.cr },
        { id: 'cd', label: '暴伤 %', step: 1, def: CALC_DEFAULTS.cd },
        { id: 'bonus', label: '星扩散增伤 %', step: 5, def: CALC_DEFAULTS.bonus },
        { id: 'base', label: '基础提升 %', step: 1, def: CALC_DEFAULTS.base },
        { id: 'extra', label: '额外提升', step: 1, def: CALC_DEFAULTS.extra },
        { id: 'shred', label: '减抗 %', step: 1, def: CALC_DEFAULTS.shred },
        { id: 'res', label: '敌人抗性 %', step: 10, def: CALC_DEFAULTS.res },
        { id: 'asc', label: '擢升 ×', step: 0.05, def: CALC_DEFAULTS.asc },
      ];

      var calc = el('div', 'calc');
      calc.appendChild(el('p', 'calc-note',
        '默认值是一组常见配置的<b>给定常数</b>（奥黛塔固有天赋满层 14%、炉火 + 七七 + 血红 = 140% 增伤、双暴 80 / 160），' +
        '不是由配置推算的。<b>倍率与基础倍率不确定，这里不算</b> —— 算出来的是三条公式共用的<b>系数</b>，乘上各自的基础项才是伤害。' +
        '数字框失焦 / 回车后重算。'));
      var grid = el('div', 'calc-grid');
      var inputs = {};
      CALC_FIELDS.forEach(function (f) {
        var lab = el('label', null, f.label);
        var inp = el('input', 'field__input');
        inp.type = 'number';
        inp.step = f.step;
        inp.value = f.def;
        lab.appendChild(inp);
        grid.appendChild(lab);
        inputs[f.id] = inp;
      });
      calc.appendChild(grid);

      var out = el('table', 'calc-out');
      out.innerHTML = '<thead><tr><th style="width:150px">项</th><th style="width:130px">值</th><th>说明</th></tr></thead><tbody></tbody>';
      calc.appendChild(out);
      host.appendChild(calc);

      var prose = el('div', 'prose');
      prose.innerHTML = PROSE;
      host.appendChild(prose);
      host.appendChild(GS.ui.panels.note(FOOT, 'pagenote'));

      function n(id) {
        var v = parseFloat(inputs[id].value);
        return Number.isFinite(v) ? v : 0;
      }
      function clamp(inp) {
        var x = parseFloat(inp.value), lo = parseFloat(inp.min), hi = parseFloat(inp.max);
        if (!Number.isFinite(x)) return;
        if (Number.isFinite(lo)) x = Math.max(x, lo);
        if (Number.isFinite(hi)) x = Math.min(x, hi);
        inp.value = x;
      }

      var tbody = out.querySelector('tbody');
      function renderCalc() {
        var em = Math.max(0, n('em'));
        var crRaw = n('cr');
        var cr = Math.min(1, Math.max(0, crRaw / 100));   // 暴击率硬上限 100%
        var cd = Math.max(0, n('cd') / 100);
        var bonus = n('bonus') / 100, base = n('base') / 100, extra = n('extra');
        var shred = n('shred') / 100, res = n('res') / 100, asc = n('asc');

        var emt = C.emTerm(em), bracket = 1 + emt + bonus;
        var crit = 1 + cr * cd;
        var k = C.kappa(res - shred);
        var back = k * crit * asc;                       // 额外提升只吃这三项
        var total = (1 + base) * bracket * back;

        function row(name, val, desc, cls) {
          return '<tr' + (cls ? ' class="' + cls + '"' : '') + '><td>' + name + '</td><td class="v">' + val +
                 '</td><td class="d">' + desc + '</td></tr>';
        }
        tbody.innerHTML =
          row('属性（元素精通）', em.toFixed(0), '线性项：属性 × 倍率 = 基础项（瑞希的天赋值 = 元素精通）') +
          row('基础提升', '×' + f3(1 + base), '独立乘区，乘在整个倍率区外面') +
          row('精通项', '+' + (emt * 100).toFixed(1) + '%', '6 × ' + em.toFixed(0) + ' / (' + em.toFixed(0) + ' + 2000)') +
          row('星扩散增伤', '+' + (bonus * 100).toFixed(1) + '%', '与精通项同一个括号、互相稀释') +
          row('↳ 括号合计', '×' + f3(bracket), '1 + 精通项 + 增伤') +
          row('抗性区', '×' + f3(k), (res * 100).toFixed(0) + '% 抗性、减抗 ' + (shred * 100).toFixed(0) +
            '%；换减抗的收益见 <a href="#/basics/resistance">抗性区页</a>') +
          row('暴击区', '×' + f3(crit),
            '1 + ' + (cr * 100).toFixed(0) + '% × ' + (cd * 100).toFixed(0) + '%（期望值' +
            (crRaw > 100 ? '，暴击率已按上限 100% 截断' : '') + '）') +
          row('擢升', '×' + f3(asc), '独立乘区（多个来源是相加还是相乘未核实，这里按你填的乘数）') +
          (!extra ? '' : row('额外提升', '×' + f3(back) + '（另算）',
            extra.toFixed(0) + ' × 抗性 × 暴击 × 擢升 = <b>' + (extra * back).toFixed(1) +
            '</b>，不吃精通项 / 增伤 / 基础提升')) +
          row('共用系数', '×' + f3(total),
            '乘到基础项上：反应（风）1446.85 × 0.75、反应（冰）1446.85 × 基础倍率、直伤 属性 × 倍率', 'total') +
          row('星扩散直伤', (em * total / 1000).toFixed(1) + 'k',
            '元素精通 × 共用系数（属性 = 元素精通；<b>倍率不计入</b>）');
      }

      Object.keys(inputs).forEach(function (id) {
        var inp = inputs[id];
        function commit() { clamp(inp); renderCalc(); }
        inp.addEventListener('change', commit);
        inp.addEventListener('keydown', function (e) {
          if (e.key !== 'Enter') return;
          e.preventDefault();
          commit();
        });
      });
      renderCalc();

      return { update: function () {} };
    },
  };
})(typeof globalThis !== 'undefined' ? globalThis : this);
