/* 参数面板控件层：一切输入都走这里。
   数字框 = 提交式（失焦 / 回车才生效，越界写回框里）；滑条 = 拖动只更新读数、松手才生效。
   类型：number / range（可带数字框） / select / text / readout / note / custom。 */
(function (global) {
  'use strict';
  var GS = global.GS = global.GS || {};
  var UI = GS.ui = GS.ui || {};
  var el = UI.panels.el;

  var HINT_SLIDER = '松开滑动更新绘图';
  var HINT_INPUT = '回车或点别处生效';

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

    function setHint(text) {
      if (hintEl.textContent !== text) hintEl.textContent = text;
      hintEl.style.visibility = 'visible';
    }
    function hideHint() { hintEl.style.visibility = 'hidden'; }

    (list || []).forEach(function (c) {
      if (!c) return;

      if (c.type === 'note') { host.appendChild(el('p', 'note' + (c.sep ? ' note-sep' : ''), c.html)); return; }
      if (c.type === 'readout') {
        var ro = el('div', 'readout', '<span>' + c.label + '</span><span class="readout__v"></span>');
        var roV = ro.querySelector('.readout__v');
        refreshers.push(function (s) {
          var v = c.compute(s);
          if (typeof v === 'object') { roV.innerHTML = v.v; } else { roV.textContent = v; }
        });
        host.appendChild(ro);
        return;
      }
      if (c.type === 'custom') {
        var cell = el('div', 'field');
        c.build(cell, {
          state: state,
          commit: function () { cb.commit(c.key); },
          refresh: function () { cb.commit(c.key); },
        });
        host.appendChild(cell);
        return;
      }

      var id = 'ctl-' + c.key;
      var field = el('div', 'field');
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
        var commitRange = function (v) {
          if (!Number.isFinite(v)) { syncRange(state[c.key]); return; }
          v = clampTo(numBox || rng, v);   // 数字框只设下界时可填更大的值（如减抗 > 100）
          state[c.key] = v;
          syncRange(v);
          hideHint();
          cb.commit(c.key);
        };
        rng.addEventListener('input', function () {
          var v = parseFloat(rng.value);
          val.textContent = String(v) + (c.unit || '');
          if (numBox) numBox.value = v;
          state[c.key] = v;                 // 拖动中先落进 state：预览读数用的是它
          if (cb.preview) cb.preview(c.key);
        });
        rng.addEventListener('change', function () { commitRange(parseFloat(rng.value)); });
        rng.addEventListener('pointerdown', function () { setHint(HINT_SLIDER); });
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
        bindings.push({ key: c.key, set: function (v) { syncRange(v); } });
      }

      field.insertBefore(label, field.firstChild);
      host.appendChild(field);
    });

    host.appendChild(hintEl);

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
