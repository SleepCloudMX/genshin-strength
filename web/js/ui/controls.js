/* 参数面板控件层：一切输入都走这里。
   数字框 = 提交式（失焦 / 回车才生效，越界写回框里）；滑条 = 拖动只更新读数、松手才生效；
   重绘快的页可给滑条加 live: ms —— 拖动中停顿 ms 后自动提交，松手不重复重绘。
   类型：number / items（总数 + 可展开明细）/ range（可带数字框） / select / text / readout / note / custom /
         group（可折叠组，items 为子控件，默认收起）。 */
(function (global) {
  'use strict';
  var GS = global.GS = global.GS || {};
  var UI = GS.ui = GS.ui || {};
  var el = UI.panels.el;

  var HINT_SLIDER = '松开滑动更新绘图';
  var HINT_LIVE = '停顿片刻更新绘图';   // 带 c.live 的轻量滑条：停顿 ms 后自动重绘
  var HINT_INPUT = '回车或点别处生效';
  var currentPopClose = null;   // 同一时刻只开一个明细悬浮框

  function clampTo(elIn, v) {
    var lo = parseFloat(elIn.min), hi = parseFloat(elIn.max);
    if (Number.isFinite(lo)) v = Math.max(v, lo);
    if (Number.isFinite(hi)) v = Math.min(v, hi);
    return v;
  }

  function build(host, list, state, cb) {
    host.innerHTML = '';
    var hintEl = el('div', 'hint');
    var refreshers = [];
    var bindings = [];   // { key, set(v) }：外部改 state 后写回控件
    var notes = [];      // 说明块统一收在面板底部（控件两列排，说明不占前面）

    function setHint(text) {
      if (hintEl.textContent !== text) hintEl.textContent = text;
      hintEl.style.visibility = 'visible';
    }
    function hideHint() { hintEl.style.visibility = 'hidden'; }

    function addControl(c, container) {
      if (!c) return;

      if (c.type === 'note') { notes.push(el('p', 'note', c.html)); return; }
      if (c.type === 'group') {
        var grp = el('details', 'ctlgrp');
        if (c.open) grp.open = true;
        grp.appendChild(el('summary', 'ctlgrp__hd', c.label));
        var grpBody = el('div', 'ctlgrp__body');
        grp.appendChild(grpBody);
        (c.items || []).forEach(function (cc) { addControl(cc, grpBody); });
        container.appendChild(grp);
        return;
      }
      if (c.type === 'readout') {
        var ro = el('div', 'readout readout--full',
          '<span>' + c.label + '</span><span class="readout__v"></span>');
        var roV = ro.querySelector('.readout__v');
        refreshers.push(function (s) {
          var v = c.compute(s);
          if (typeof v === 'object') { roV.innerHTML = v.v; } else { roV.textContent = v; }
        });
        container.appendChild(ro);
        return;
      }
      if (c.type === 'custom') {
        var cell = el('div', 'field field--full');
        c.build(cell, {
          state: state,
          commit: function () { cb.commit(c.key); },
          refresh: function () { cb.commit(c.key); },
          setHint: setHint,
          hideHint: hideHint,
        });
        container.appendChild(cell);
        return;
      }

      var id = 'ctl-' + c.key;
      /* 下拉 / 滑条 / 自定义占整行；数字与短文本默认半行（c.full 可强制整行） */
      var wide = c.full || c.type === 'select' || c.type === 'range';
      var field = el('div', 'field' + (wide ? ' field--full' : ''));
      var label = el('label', 'field__label', c.label);
      label.setAttribute('for', id);

      if (c.type === 'number' || c.type === 'text') {
        var inp = el('input', 'field__input');
        inp.type = c.type;
        inp.id = id;
        if (c.chars) inp.size = c.chars;
        if (c.type === 'number') {
          if (c.step !== undefined) inp.step = c.step;
          if (c.min !== undefined) inp.min = c.min;
          if (c.max !== undefined) inp.max = c.max;
        }
        inp.value = state[c.key];
        var commitInput = function () {
          var v = c.type === 'number' ? parseFloat(inp.value) : inp.value;
          if (c.type === 'number') {
            if (!Number.isFinite(v)) { inp.value = state[c.key]; hideHint(); return; }
            v = clampTo(inp, v);
            inp.value = v;
          }
          hideHint();
          state[c.key] = v;
          cb.commit(c.key);
        };
        inp.addEventListener('input', function () { setHint(HINT_INPUT); });
        inp.addEventListener('change', commitInput);
        inp.addEventListener('keydown', function (e) {
          if (e.key !== 'Enter' || c.type !== 'number') return;
          e.preventDefault();
          commitInput();
        });
        bindings.push({ key: c.key, set: function (v) { inp.value = v; } });
        field.appendChild(inp);
      } else if (c.type === 'items') {
        /* 总数框 + 「明细」悬浮编辑器。明细（逐条：名称 + 数值）是唯一真源，总数恒为 Σ明细；
           直接在总数框里改 → 差额自动记成一条「手动调整」明细（为零则移除）。 */
        field.classList.add('field--items');
        var items = (c.items || []).map(function (it) { return { n: it.n, v: it.v, manual: false }; });
        var itInp = el('input', 'field__input');
        itInp.type = 'number';
        itInp.id = id;
        if (c.step !== undefined) itInp.step = c.step;
        if (c.min !== undefined) itInp.min = c.min;
        if (c.max !== undefined) itInp.max = c.max;
        var moreBtn = el('button', 'field__more', '明细');
        moreBtn.type = 'button';
        moreBtn.setAttribute('aria-haspopup', 'dialog');
        moreBtn.setAttribute('aria-expanded', 'false');
        var row = el('div', 'field__row');
        row.appendChild(itInp);
        row.appendChild(moreBtn);

        var pop = null, rowsBox = null, sumEl = null, popOpen = false;

        var round4 = function (v) { return +v.toFixed(4); };
        var total = function () {
          return items.reduce(function (a, it) { return a + it.v; }, 0);
        };
        var namedTotal = function () {
          return items.reduce(function (a, it) { return a + (it.manual ? 0 : it.v); }, 0);
        };
        var manualRow = function () {
          for (var i = 0; i < items.length; i++) if (items[i].manual) return items[i];
          return null;
        };
        var updateSum = function () { if (sumEl) sumEl.textContent = '合计 ' + String(round4(total())); };
        /** 明细 → 总数框 / state / 合计读数；rows = true 时重建悬浮框行（行集合变了）。 */
        var sync = function (rows) {
          var v = round4(total());
          itInp.value = String(v);
          state[c.key] = v;
          if (popOpen) {
            if (rows) renderRows();
            else updateSum();
          }
          cb.commit(c.key);
        };
        var commitInput = function () {
          var v = parseFloat(itInp.value);
          if (!Number.isFinite(v)) { itInp.value = String(round4(total())); hideHint(); return; }
          v = clampTo(itInp, v);
          var man = manualRow();
          var delta = round4(v - namedTotal());
          if (Math.abs(delta) < 1e-9) {
            if (man) { items.splice(items.indexOf(man), 1); sync(true); }
            else { itInp.value = String(round4(total())); sync(false); }
          } else {
            if (man) { man.v = delta; } else { items.push({ n: '手动调整', v: delta, manual: true }); }
            sync(true);
          }
          hideHint();
        };
        itInp.addEventListener('input', function () { setHint(HINT_INPUT); });
        itInp.addEventListener('change', commitInput);
        itInp.addEventListener('keydown', function (e) {
          if (e.key !== 'Enter') return;
          e.preventDefault();
          commitInput();
        });

        var mkRow = function (it) {
          var r = el('div', 'iprow');
          var name = el('input', 'iprow__name');
          name.type = 'text';
          name.placeholder = '名称';
          name.value = it.n;
          var val = el('input', 'iprow__val');
          val.type = 'number';
          val.step = c.step !== undefined ? c.step : 'any';
          val.value = String(round4(it.v));
          var del = el('button', 'iprow__del', '×');
          del.type = 'button';
          del.title = '删除此项';
          name.addEventListener('change', function () { it.n = name.value.trim(); });
          name.addEventListener('keydown', function (e) {
            if (e.key === 'Enter') { e.preventDefault(); name.blur(); }
          });
          var commitVal = function () {
            var v = parseFloat(val.value);
            if (!Number.isFinite(v)) { val.value = String(round4(it.v)); hideHint(); return; }
            it.v = round4(v);
            val.value = String(round4(it.v));
            hideHint();
            sync(false);
          };
          val.addEventListener('input', function () { setHint(HINT_INPUT); });
          val.addEventListener('change', commitVal);
          val.addEventListener('keydown', function (e) {
            if (e.key === 'Enter') { e.preventDefault(); commitVal(); }
          });
          del.addEventListener('click', function () {
            items.splice(items.indexOf(it), 1);
            sync(true);
          });
          r.appendChild(name);
          r.appendChild(val);
          r.appendChild(del);
          return r;
        };

        var renderRows = function () {
          rowsBox.textContent = '';
          items.forEach(function (it) { rowsBox.appendChild(mkRow(it)); });
          updateSum();
        };

        var closePop = function () {
          if (!popOpen) return;
          var ae = global.document.activeElement;
          if (ae && pop && pop.contains(ae) && ae.blur) ae.blur();   // 先落掉正在编辑的值（触发 change），再拆
          popOpen = false;
          global.document.removeEventListener('mousedown', onDocDown, true);
          global.document.removeEventListener('keydown', onDocKey);
          global.removeEventListener('hashchange', closePop);
          if (pop && pop.parentNode) pop.parentNode.removeChild(pop);
          pop = null; rowsBox = null; sumEl = null;
          moreBtn.setAttribute('aria-expanded', 'false');
          if (currentPopClose === closePop) currentPopClose = null;
        };
        var onDocDown = function (e) {
          if (pop && !pop.contains(e.target) && e.target !== moreBtn) closePop();
        };
        var onDocKey = function (e) { if (e.key === 'Escape') closePop(); };

        var openPop = function () {
          if (popOpen) return;
          if (currentPopClose) currentPopClose();   // 同一时刻只开一个明细框
          popOpen = true;
          pop = el('div', 'items-pop');
          pop.appendChild(el('div', 'items-pop__hd', c.label + ' 明细'));
          rowsBox = el('div', 'items-pop__rows');
          pop.appendChild(rowsBox);
          var ft = el('div', 'items-pop__ft');
          var add = el('button', 'iprow__add', '+ 添加一项');
          add.type = 'button';
          add.addEventListener('click', function () {
            items.push({ n: '', v: 0, manual: false });   // 0 值不改变总数，无需 commit
            renderRows();
            var lastRow = rowsBox.lastChild;
            if (lastRow && lastRow.firstChild) lastRow.firstChild.focus();
          });
          sumEl = el('span', 'items-pop__sum');
          ft.appendChild(add);
          ft.appendChild(sumEl);
          pop.appendChild(ft);
          renderRows();
          field.appendChild(pop);
          var rect = pop.getBoundingClientRect();   // 贴着视口底就向上翻
          if (rect.bottom > (global.innerHeight || 0) - 8 && rect.top > rect.height + 8) {
            pop.classList.add('items-pop--up');
          }
          moreBtn.setAttribute('aria-expanded', 'true');
          global.document.addEventListener('mousedown', onDocDown, true);
          global.document.addEventListener('keydown', onDocKey);
          global.addEventListener('hashchange', closePop);
          currentPopClose = closePop;
        };

        moreBtn.addEventListener('click', function () { if (popOpen) closePop(); else openPop(); });

        itInp.value = String(round4(total()));   // 明细为准：首帧就把 Σ 写进框（覆盖路由按 c.def 的初始化）
        state[c.key] = round4(total());
        field.appendChild(row);
      } else if (c.type === 'select') {
        var sel = el('select', 'field__input');
        sel.id = id;
        sel.innerHTML = c.options.map(function (o) {
          return '<option value="' + o.value + '">' + o.label + '</option>';
        }).join('');
        sel.value = state[c.key];
        sel.addEventListener('change', function () {
          state[c.key] = sel.value;
          cb.commit(c.key);
        });
        bindings.push({ key: c.key, set: function (v) { sel.value = v; } });
        field.appendChild(sel);
      } else if (c.type === 'range') {
        var val = el('span', 'field__val', String(state[c.key]) + (c.unit || ''));
        label.appendChild(val);
        var rng = el('input');
        rng.type = 'range';
        rng.id = id;
        if (c.step !== undefined) rng.step = c.step;
        rng.min = c.min;
        rng.max = c.max;
        rng.value = state[c.key];
        var numBox = null;
        if (c.box) {
          numBox = el('input', 'field__input');
          numBox.type = 'number';
          if (c.box.step !== undefined) numBox.step = c.box.step;
          if (c.box.min !== undefined) numBox.min = c.box.min;
          if (c.box.max !== undefined) numBox.max = c.box.max;
          numBox.value = state[c.key];
          var pair = el('div', 'field__pair');
          pair.appendChild(rng);
          pair.appendChild(numBox);
          field.appendChild(pair);
        } else {
          field.appendChild(rng);
        }
        var syncRange = function (v) {
          val.textContent = String(v) + (c.unit || '');
          rng.value = Math.min(Math.max(v, parseFloat(rng.min)), parseFloat(rng.max));
          if (numBox) numBox.value = v;
        };
        var liveMs = Number(c.live) || 0;   // >0：拖动中停顿这么久就提交（只给重绘快的页开）
        var liveTimer = null;
        var lastCommitted = Number(state[c.key]);
        var cancelLive = function () {
          if (liveTimer) { global.clearTimeout(liveTimer); liveTimer = null; }
        };
        var commitRange = function (v, keepHint) {
          cancelLive();
          if (!Number.isFinite(v)) { syncRange(state[c.key]); return; }
          v = clampTo(numBox || rng, v);   // 数字框只设下界时可填更大的值（如减抗 > 100）
          state[c.key] = v;
          syncRange(v);
          if (!keepHint) hideHint();
          if (v === lastCommitted) return;   // 停顿提交后再松手，不重复重绘
          lastCommitted = v;
          cb.commit(c.key);
        };
        rng.addEventListener('input', function () {
          var v = parseFloat(rng.value);
          val.textContent = String(v) + (c.unit || '');
          if (numBox) numBox.value = v;
          state[c.key] = v;                 // 拖动中先落进 state：预览读数用的是它
          if (cb.preview) cb.preview(c.key);
          if (liveMs > 0) {
            cancelLive();
            liveTimer = global.setTimeout(function () {
              liveTimer = null;
              if (!global.document.body.contains(rng)) return;   // 已切页
              commitRange(parseFloat(rng.value), true);
            }, liveMs);
          }
        });
        rng.addEventListener('change', function () { commitRange(parseFloat(rng.value)); });
        rng.addEventListener('pointerdown', function () { setHint(liveMs > 0 ? HINT_LIVE : HINT_SLIDER); });
        global.addEventListener('pointerup', hideHint);
        global.addEventListener('pointercancel', hideHint);
        if (numBox) {
          numBox.addEventListener('input', function () { setHint(HINT_INPUT); });
          numBox.addEventListener('change', function () { commitRange(parseFloat(numBox.value)); });
          numBox.addEventListener('keydown', function (e) {
            if (e.key !== 'Enter') return;
            e.preventDefault();
            commitRange(parseFloat(numBox.value));
          });
        }
        bindings.push({ key: c.key, set: function (v) { cancelLive(); lastCommitted = Number(v); syncRange(v); } });
      }

      field.insertBefore(label, field.firstChild);
      container.appendChild(field);
    }
    (list || []).forEach(function (c) { addControl(c, host); });

    host.appendChild(hintEl);
    if (notes.length) {
      var notesBox = el('div', 'inspector__notes');
      notes.forEach(function (n) { notesBox.appendChild(n); });
      host.appendChild(notesBox);
    }

    return {
      refresh: function (s) { refreshers.forEach(function (fn) { fn(s); }); },
      /** 外部改了 state（如点击图面移动基准）后写回各控件 */
      sync: function (s) {
        bindings.forEach(function (b) { if (b.key in s) b.set(s[b.key]); });
      },
      setHint: setHint,
      hideHint: hideHint,
    };
  }

  UI.controls = { build: build };
})(typeof globalThis !== 'undefined' ? globalThis : this);
