/* 站点外壳：hash 路由（#/<模块>）、左侧目录、参数面板、页面装配。
   模块接口：{ title, tab, intro, layout?, math?, noPlotly?, controls(state),
              create(host, ctx) → { update(state), preview?(state), plot? } } */
(function (global) {
  'use strict';
  var GS = global.GS = global.GS || {};
  var doc = global.document;
  var UI = GS.ui;
  var el = UI.panels.el;

  var app = { route: 'home', state: {}, current: null, mod: null, controls: null };
  GS.app = app;

  /* --- 图标（内联 SVG，24 格；不用 emoji） --- */
  function icon(paths, size) {
    return '<svg viewBox="0 0 24 24" width="' + (size || 18) + '" height="' + (size || 18) +
           '" fill="none" stroke="currentColor" stroke-width="1.8" ' +
           'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + paths + '</svg>';
  }

  var ICONS = {
    home: icon('<path d="M4 11l8-7 8 7"/><path d="M6 10v9h12v-9"/>'),
    bars: icon('<rect x="4" y="10" width="6" height="10" rx="1"/><rect x="14" y="4" width="6" height="16" rx="1"/>'),
    curve: icon('<path d="M3 17l6-6 4 4 8-8"/><path d="M17 7h4v4"/>'),
    grid: icon('<rect x="4" y="4" width="7" height="7" rx="1"/><rect x="13" y="4" width="7" height="7" rx="1"/>' +
               '<rect x="4" y="13" width="7" height="7" rx="1"/><rect x="13" y="13" width="7" height="7" rx="1"/>'),
    star: icon('<path d="M12 3.6l2.5 5.4 5.9.7-4.4 4 1.2 5.9-5.2-3.1-5.2 3.1 1.2-5.9-4.4-4 5.9-.7z"/>'),
    spark: icon('<path d="M12 4l1.6 6.4L20 12l-6.4 1.6L12 20l-1.6-6.4L4 12l6.4-1.6z"/>'),
    sword: icon('<path d="M14.5 17.5 3 6V3h3l11.5 11.5"/><path d="M13 19l6-6"/>' +
                '<path d="M16 16l4 4"/><path d="M19 21l2-2"/>'),
    shield: icon('<path d="M12 3l7 3v5c0 4.5-3 8-7 10-4-2-7-5.5-7-10V6z"/>'),
    bell: icon('<path d="M3 19c4 0 4-12 9-12s5 12 9 12"/>'),
    split: icon('<circle cx="12" cy="12" r="8"/><path d="M12 4v16"/>'),
    menu: icon('<path d="M4 7h16M4 12h16M4 17h16"/>'),
    github: '<svg viewBox="0 0 16 16" width="18" height="18" fill="currentColor" aria-hidden="true">' +
      '<path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49' +
      '-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82' +
      '.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15' +
      '-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82a7.42 7.42 0 0 1 2-.27c.68 0 1.36.09 2 .27 1.53-1.04 ' +
      '2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95' +
      '.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0 0 16 8c0-4.42-3.58-8-8-8Z"/></svg>',
  };

  /* --- 导航：首页不归组；其余按角色 / 主题分组 --- */
  var NAV = [
    { items: [{ id: 'home', label: '首页', icon: 'home' }] },
    {
      group: '「梦见月瑞希」星扩散',
      items: [
        { id: 'mizuki/scarlet_vs_em', label: '套装对比', icon: 'bars' },
        { id: 'mizuki/em_vs_crit', label: '词条分配', icon: 'curve' },
        { id: 'mizuki/em_crit_map', label: '伤害热图', icon: 'grid' },
        { id: 'mizuki/stellar_swirl', label: '星扩散机制', icon: 'star' },
      ],
    },
    {
      group: '「木偶·桑多涅」星超导',
      items: [
        { id: 'sandrone/star_superconduct', label: '词条分配', icon: 'spark' },
        { id: 'sandrone/weapon_compare', label: '武器对比', icon: 'sword' },
      ],
    },
    {
      group: '基础专题',
      items: [
        { id: 'basics/resistance', label: '抗性区：减抗收益', icon: 'shield' },
        { id: 'basics/crit_dist', label: '暴击：波动', icon: 'bell' },
        { id: 'basics/crit_split', label: '暴击：分配', icon: 'split' },
      ],
    },
  ];

  function navIcon(id) {
    var hit = '';
    NAV.forEach(function (g) {
      g.items.forEach(function (it) { if (it.id === id) hit = it.icon; });
    });
    return ICONS[hit] || '';
  }
  app.navIcon = navIcon;

  function renderNav(activeId) {
    var host = doc.getElementById('navList');
    host.textContent = '';
    NAV.forEach(function (group) {
      if (group.group) host.appendChild(el('p', 'nav__group', group.group));
      group.items.forEach(function (item) {
        var a = el('a', 'nav__item' + (item.id === activeId ? ' is-active' : ''));
        a.href = '#/' + (item.id === 'home' ? '' : item.id);
        a.innerHTML = ICONS[item.icon] + '<span>' + item.label + '</span>';
        if (item.id === activeId) a.setAttribute('aria-current', 'page');
        host.appendChild(a);
      });
    });
  }

  /* --- 路由 --- */
  function parseHash() {
    var raw = global.location.hash.replace(/^#\/?/, '');
    var anchor = '';
    var ai = raw.indexOf('#');
    if (ai >= 0) { anchor = raw.slice(ai + 1); raw = raw.slice(0, ai); }
    return { id: raw || 'home', anchor: anchor };
  }

  function ctx() {
    return {
      state: app.state,
      charts: UI.charts,
      tip: UI.tip,
      overlay: UI.overlay,
      panels: UI.panels,
      el: el,
    };
  }

  function refresh() {
    UI.charts.disposeDetached();
    if (app.current) app.current.update(app.state);
    if (app.controls) app.controls.refresh(app.state);
  }

  function preview() {
    if (app.current && app.current.preview) app.current.preview(app.state);
    if (app.controls) app.controls.refresh(app.state);
  }

  function renderPlaceholder(stage, id) {
    var page = el('div', 'page');
    page.appendChild(el('header', 'page__head',
      '<h1>页面不存在</h1><p class="page__intro">没有「' + id + '」这个页面。</p>'));
    page.appendChild(el('div', 'card placeholder', '<a href="#/">回到首页</a>'));
    stage.appendChild(page);
  }

  /* --- 外部库：进入需要的页才注入（Plotly / KaTeX 都不拖累其他页） --- */
  function lazyScript(url, state, queue, cb, charset) {
    queue.push(cb);
    if (state.phase !== 'idle') return;
    state.phase = 'loading';
    var s = doc.createElement('script');
    s.src = url;
    if (charset) s.charset = charset;
    s.onload = function () {
      state.phase = 'ready';
      var q = queue.splice(0, queue.length);
      q.forEach(function (fn) { fn(); });
    };
    s.onerror = function () { state.phase = 'idle'; };
    doc.head.appendChild(s);
  }

  var plotlyState = { phase: global.Plotly ? 'ready' : 'idle' }, plotlyQueue = [];
  function ensurePlotly(cb) {
    if (global.Plotly) { cb(); return; }
    lazyScript('https://cdn.plot.ly/plotly-2.35.2.min.js', plotlyState, plotlyQueue, cb, 'utf-8');
    UI.panels.toast('正在加载图表库…');
  }

  /* KaTeX：只给声明 math: true 的模块加载（$$ 与 \( 两种定界符） */
  var mathState = { phase: global.renderMathInElement ? 'ready' : 'idle' };
  var mathQueue = [];

  function flushMath() {
    if (!global.renderMathInElement) return;
    var q = mathQueue.splice(0, mathQueue.length);
    q.forEach(function (page) {
      global.renderMathInElement(page, {
        delimiters: [
          { left: '$$', right: '$$', display: true },
          { left: '\\(', right: '\\)', display: false },
        ],
        throwOnError: false,
      });
    });
  }

  function ensureMath(page) {
    mathQueue.push(page);
    if (mathState.phase === 'ready') { flushMath(); return; }
    if (mathState.phase === 'loading') return;
    mathState.phase = 'loading';
    var css = doc.createElement('link');
    css.rel = 'stylesheet';
    css.href = 'https://cdn.jsdelivr.net/npm/katex@0.16.11/dist/katex.min.css';
    doc.head.appendChild(css);
    var s = doc.createElement('script');
    s.src = 'https://cdn.jsdelivr.net/npm/katex@0.16.11/dist/katex.min.js';
    s.onload = function () {
      var auto = doc.createElement('script');
      auto.src = 'https://cdn.jsdelivr.net/npm/katex@0.16.11/dist/contrib/auto-render.min.js';
      auto.onload = function () { mathState.phase = 'ready'; flushMath(); };
      doc.head.appendChild(auto);
    };
    doc.head.appendChild(s);
  }

  /* --- 路由渲染 --- */
  var routeToken = 0;

  function route() {
    var r = parseHash();
    var mod = GS.modules[r.id];
    var stage = doc.getElementById('stage');
    var token = ++routeToken;
    UI.charts.disposeAll();
    UI.overlay.disposeAll();
    stage.textContent = '';
    app.mod = mod || null;
    app.current = null;
    app.controls = null;
    app.route = r.id;
    renderNav(mod ? r.id : '');

    if (!mod) {
      doc.title = '页面不存在 · 原神强度计算';
      renderPlaceholder(stage, r.id);
      return;
    }
    doc.title = (mod.tab || mod.title) + ' · 原神强度计算';

    var page = el('div', 'page' +
      (mod.layout === 'doc' ? ' page--doc' : mod.layout === 'home' ? ' page--home' : ''));
    page.appendChild(el('header', 'page__head',
      '<h1>' + mod.title + '</h1>' + (mod.intro ? '<p class="page__intro">' + mod.intro + '</p>' : '')));

    var main = el('div', 'col-main');
    var list = (typeof mod.controls === 'function' ? mod.controls(app.state) : mod.controls) || [];
    var body = null, inspector = null;

    if (list.length) {
      var grid = el('div', 'stage-grid');
      grid.appendChild(main);
      var params = el('aside', 'col-params');
      inspector = el('div', 'card inspector');
      var head = el('div', 'inspector__head', '<h2>参数</h2>');
      var reset = el('button', 'btn btn--ghost', '重置');
      reset.type = 'button';
      reset.onclick = function () { route(); };
      head.appendChild(reset);
      inspector.appendChild(head);
      body = el('div', 'inspector__body');
      inspector.appendChild(body);
      params.appendChild(inspector);
      grid.appendChild(params);
      page.appendChild(grid);

      app.state = {};
      list.forEach(function (c) { if (c && c.def !== undefined) app.state[c.key] = c.def; });
    } else {
      page.appendChild(main);
      app.state = {};
    }
    stage.appendChild(page);

    function start() {
      if (token !== routeToken) return;   // 等待期间已经切走
      if (main.firstChild) main.textContent = '';   // 占位提示
      app.current = mod.create(main, ctx());
      if (list.length) {
        app.controls = UI.controls.build(body, list, app.state, {
          commit: function () { refresh(); },
          preview: function () { preview(); },
        });
        if (!mod.noChart) {
          var acts = el('div', 'inspector__acts');
          UI.panels.chartActions(function () { return app.current && app.current.plot; })
            .forEach(function (b) { acts.appendChild(b); });
          inspector.appendChild(acts);
        }
      }
      refresh();
      if (mod.math) ensureMath(page);
      if (r.anchor) {
        var target = doc.getElementById(r.anchor);
        if (target) target.scrollIntoView();
      }
    }

    if (mod.noPlotly || global.Plotly) start();
    else {
      main.appendChild(el('p', 'placeholder', '图表库加载中…'));
      ensurePlotly(start);
    }
  }

  /* --- 外壳交互 --- */
  function initShell() {
    var navBtn = doc.getElementById('navToggle');
    navBtn.innerHTML = ICONS.menu;
    doc.getElementById('ghLink').innerHTML = ICONS.github;
    var scrim = doc.getElementById('scrim');
    function closeNav() {
      doc.body.classList.remove('nav-open');
      navBtn.setAttribute('aria-expanded', 'false');
    }
    navBtn.onclick = function () {
      var open = doc.body.classList.toggle('nav-open');
      navBtn.setAttribute('aria-expanded', String(open));
    };
    scrim.onclick = closeNav;
    doc.addEventListener('keydown', function (e) { if (e.key === 'Escape') closeNav(); });
    doc.getElementById('navList').addEventListener('click', function () { closeNav(); });
    global.addEventListener('hashchange', function () {
      route();
      doc.getElementById('stage').focus();
    });
  }

  function boot() {
    initShell();
    route();
  }

  if (doc.readyState === 'loading') doc.addEventListener('DOMContentLoaded', boot);
  else boot();
})(typeof globalThis !== 'undefined' ? globalThis : this);
