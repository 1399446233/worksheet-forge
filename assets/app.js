/* 界面控制与状态管理 */
(function (WF) {
  'use strict';

  /* 出错时在页面上直接提示，便于离线排查（正常使用不会出现） */
  window.addEventListener('error', function (e) {
    try {
      var d = document.createElement('div');
      d.style.cssText = 'position:fixed;left:8px;bottom:8px;z-index:9999;background:#fee2e2;color:#991b1b;border:1px solid #fca5a5;padding:8px 12px;border-radius:8px;font:12px/1.5 monospace;max-width:90vw;white-space:pre-wrap;';
      d.textContent = 'JS 错误：' + (e.message || e.type);
      document.body.appendChild(d);
    } catch (err) { }
  });

  var DEFAULTS = {
    mode: 'oral',
    auto: false,
    grade: 1,
    ops: ['+', '-'],
    mixed: false,
    remainder: false,
    cols: 4,
    rows: 10,
    pages: 1,
    answers: false,
    seed: 20261109,
    title: '',
    showHeader: true,
    hanziPreset: 'jingyesi',
    hanziText: '',
    hanziRows: 9,
    cells: 8,
    trace: 1,
    showPinyin: true,
    grid: 'tian',
    dedupe: true,
    wordsList: 'grade3',
    wordsDir: 'cn2en',
    wordsPerPage: 12,
    customWords: ''
  };

  var state = null;
  var preview = document.getElementById('preview');
  var controls = document.getElementById('controls');
  var tabs = document.getElementById('tabs');
  var renderTimer = null;

  /* ---------------- URL ---------------- */
  function readURL() {
    var s = {};
    for (var k in DEFAULTS) s[k] = Array.isArray(DEFAULTS[k]) ? DEFAULTS[k].slice() : DEFAULTS[k];
    var q;
    try { q = new URLSearchParams(location.search); } catch (e) { return s; }
    function str(name, key) { var v = q.get(name); if (v != null && v !== '') s[key] = v; }
    function num(name, key, min, max) {
      var v = q.get(name);
      if (v == null || v === '') return;
      var n = parseInt(v, 10);
      if (!isNaN(n)) { if (min != null) n = Math.max(min, n); if (max != null) n = Math.min(max, n); s[key] = n; }
    }
    function bool(name, key) {
      var v = q.get(name);
      if (v == null || v === '') return;
      s[key] = (v === '1' || v === 'true');
    }
    str('mode', 'mode'); if (['oral', 'vertical', 'hanzi', 'words'].indexOf(s.mode) < 0) s.mode = 'oral';
    str('title', 'title');
    str('preset', 'hanziPreset');
    str('text', 'hanziText');
    str('grid', 'grid');
    str('list', 'wordsList');
    str('dir', 'wordsDir');
    str('custom', 'customWords');
    num('grade', 'grade', 1, 6);
    num('cols', 'cols', 1, 6);
    num('rows', 'rows', 1, 30);
    num('pages', 'pages', 1, 200);
    num('seed', 'seed', 0, 999999999);
    num('hrows', 'hanziRows', 1, 30);
    num('cells', 'cells', 1, 20);
    num('trace', 'trace', 0, 10);
    num('per', 'wordsPerPage', 1, 30);
    bool('mix', 'mixed');
    bool('rem', 'remainder');
    bool('ans', 'answers');
    bool('header', 'showHeader');
    bool('py', 'showPinyin');
    bool('dedupe', 'dedupe');
    bool('auto', 'auto');
    var opsRaw = q.get('ops');
    if (opsRaw) {
      var ops = [];
      ['+', '-', '×', '÷'].forEach(function (o) { if (opsRaw.indexOf(o) >= 0) ops.push(o); });
      if (ops.length) s.ops = ops;
    }
    if (s.hanziText) s.hanziText = s.hanziText.replace(/\\n/g, '\n');
    /* 各模式的默认排版参数（URL 未显式指定时） */
    if (s.mode === 'vertical') {
      if (!q.get('cols')) s.cols = 3;
      if (!q.get('rows')) s.rows = 5;
    } else if (s.mode === 'oral') {
      if (!q.get('cols')) s.cols = 4;
      if (!q.get('rows')) s.rows = 10;
    }
    return s;
  }

  function writeURL() {
    var q = [];
    function add(k, v) { if (v !== '' && v != null) q.push(k + '=' + encodeURIComponent(v)); }
    add('mode', state.mode);
    if (state.mode === 'oral' || state.mode === 'vertical') {
      add('grade', state.grade);
      add('cols', state.cols);
      add('rows', state.rows);
      add('pages', state.pages);
      add('ans', state.answers ? 1 : 0);
      add('ops', state.ops.join(''));
      if (state.mode === 'oral') { add('mix', state.mixed ? 1 : 0); add('rem', state.remainder ? 1 : 0); }
      if (!state.showHeader) add('header', 0);
    } else if (state.mode === 'hanzi') {
      add('preset', state.hanziPreset);
      if (state.hanziText.trim()) add('text', state.hanziText);
      add('hrows', state.hanziRows);
      add('cells', state.cells);
      add('trace', state.trace);
      add('grid', state.grid);
      add('py', state.showPinyin ? 1 : 0);
      add('dedupe', state.dedupe ? 1 : 0);
      if (!state.showHeader) add('header', 0);
    } else {
      add('list', state.wordsList);
      add('dir', state.wordsDir);
      add('per', state.wordsPerPage);
      add('pages', state.pages);
      add('ans', state.answers ? 1 : 0);
      if (state.customWords.trim()) add('custom', state.customWords);
      if (!state.showHeader) add('header', 0);
    }
    add('seed', state.seed);
    if (state.title.trim()) add('title', state.title);
    if (state.auto) add('auto', 1);
    var url = location.pathname + '?' + q.join('&');
    try { history.replaceState(null, '', url); } catch (e) { /* file:// 下部分浏览器不允许 */ }
  }

  /* ---------------- 控件片段 ---------------- */
  function escA(s) {
    return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
  }
  function group(label, inner, hint) {
    return '<div class="control-group"><span class="control-label">' + label + '</span>' + inner +
      (hint ? '<div class="control-hint">' + hint + '</div>' : '') + '</div>';
  }
  function segmented(key, items, current) {
    return '<div class="segmented">' + items.map(function (it) {
      var on = String(it.v) === String(current);
      return '<button type="button" data-set="' + key + '" data-val="' + escA(it.v) + '" class="' + (on ? 'on' : '') + '">' + it.label + '</button>';
    }).join('') + '</div>';
  }
  function rangeCtl(key, min, max, step, val) {
    return '<div class="range-row">' +
      '<input type="range" data-range="' + key + '" min="' + min + '" max="' + max + '" step="' + step + '" value="' + val + '">' +
      '<span class="range-val" data-range-val="' + key + '">' + val + '</span></div>';
  }
  function checkCtl(key, label, checked, disabled) {
    return '<label class="check-row"><input type="checkbox" data-check="' + key + '"' +
      (checked ? ' checked' : '') + (disabled ? ' disabled' : '') + '> ' + label + '</label>';
  }
  function selectCtl(key, options, val) {
    return '<select data-select="' + key + '">' + options.map(function (o) {
      return '<option value="' + escA(o.v) + '"' + (String(o.v) === String(val) ? ' selected' : '') + '>' + o.label + '</option>';
    }).join('') + '</select>';
  }
  function textCtl(key, val, placeholder) {
    return '<input type="text" data-text="' + key + '" value="' + escA(val) + '" placeholder="' + escA(placeholder) + '">';
  }
  function areaCtl(key, val, placeholder) {
    return '<textarea data-text="' + key + '" placeholder="' + escA(placeholder) + '">' + escA(val) + '</textarea>';
  }
  function opButtons() {
    var disabled = state.mixed && state.grade >= 4;
    var html = '<div class="segmented" style="' + (disabled ? 'opacity:.45;pointer-events:none' : '') + '">';
    ['+', '-', '×', '÷'].forEach(function (o) {
      var supported = state.grade >= 2 || o === '+' || o === '-';
      var on = state.ops.indexOf(o) >= 0;
      html += '<button type="button" data-op="' + o + '" class="' + (on ? 'on' : '') + '"' +
        (supported ? '' : ' disabled style="opacity:.35"') + '>' + o + '</button>';
    });
    return html + '</div>';
  }
  function seedGroup() {
    return '<div class="inline-fields">' +
      textCtl('seed', state.seed, '随机种子') +
      '<button type="button" class="btn ghost" data-shuffle="1" style="padding:6px 10px">换一批</button>' +
      '</div>';
  }
  function pageGroup() {
    return group('多页 / 打包', rangeCtl('pages', 1, 60, 1, state.pages), '页数 > 1 适合一次生成整套练习；打包导出 PDF 时可配合浏览器打印。') +
      group('答案页', checkCtl('answers', '附加答案页（单独成页）', state.answers));
  }

  /* ---------------- 各模式控件 ---------------- */
  function controlsOral() {
    return group('年级', segmented('grade', [1, 2, 3, 4, 5, 6].map(function (n) { return { v: n, label: WF.GRADE_LABEL[n] }; }), state.grade)) +
      group('运算类型', opButtons(), '按年级自动选择数字范围；一年级为 20 以内加减。') +
      group('混合运算', checkCtl('mixed', '混合运算（含括号、先乘除后加减）', state.mixed, state.grade < 4),
        state.grade < 4 ? '四年级及以上可用。' : '') +
      group('每列题数', rangeCtl('rows', 5, 20, 1, state.rows)) +
      group('列数', rangeCtl('cols', 2, 5, 1, state.cols)) +
      pageGroup() +
      (state.grade >= 4 ? group('除法选项', checkCtl('remainder', '有余数除法（答案带余数）', state.remainder)) : '') +
      group('随机种子', seedGroup(), '同一种子可生成完全相同的题目，便于出 A/B 卷。') +
      group('自定义标题', textCtl('title', state.title, '留空使用默认标题')) +
      group('页眉信息', checkCtl('showHeader', '显示姓名 / 班级 / 日期栏', state.showHeader));
  }

  function controlsVertical() {
    var opsDisabled = state.grade < 2;
    return group('年级', segmented('grade', [1, 2, 3, 4, 5, 6].map(function (n) { return { v: n, label: WF.GRADE_LABEL[n] }; }), state.grade)) +
      group('运算类型', opButtons().replace(/data-op="÷"[\s\S]*?<\/button>/, ''), '竖式练习仅支持加、减、乘；除法竖式请使用教材专用格式。' + (opsDisabled ? '' : '')) +
      group('每列题数', rangeCtl('rows', 3, 8, 1, state.rows)) +
      group('列数', rangeCtl('cols', 2, 3, 1, state.cols)) +
      pageGroup() +
      group('随机种子', seedGroup()) +
      group('自定义标题', textCtl('title', state.title, '留空使用默认标题')) +
      group('页眉信息', checkCtl('showHeader', '显示姓名 / 班级 / 日期栏', state.showHeader));
  }

  function presetOptions() {
    var opts = [{ v: 'custom', label: '自定义内容（在下方输入）' }];
    (window.WF_PRESETS.poems || []).forEach(function (p) {
      opts.push({ v: p.id, label: p.title + ' · ' + p.author });
    });
    if (window.WF_PRESETS.common) opts.push({ v: window.WF_PRESETS.common.id, label: window.WF_PRESETS.common.title });
    return opts;
  }

  function controlsHanzi() {
    return group('练习内容', selectCtl('hanziPreset', presetOptions(), state.hanziPreset),
        '选择古诗或常用字会自动填入内容；也可以直接在下方粘贴课文、生字表。') +
      group('自定义文字', areaCtl('hanziText', state.hanziText, '例如：床前明月光，疑是地上霜。（仅汉字会被排入字帖）')) +
      group('每页行数', rangeCtl('hanziRows', 6, 12, 1, state.hanziRows)) +
      group('每行格数', rangeCtl('cells', 6, 12, 1, state.cells)) +
      group('描红格数', rangeCtl('trace', 0, 3, 1, state.trace), '每字第一格为浅红描红，其余为空格外形临写。') +
      group('格子类型', selectCtl('grid', [
        { v: 'tian', label: '田字格' }, { v: 'mi', label: '米字格' }, { v: 'none', label: '空白格' }
      ], state.grid)) +
      group('显示选项', checkCtl('showPinyin', '在格子上方标注拼音', state.showPinyin) +
        checkCtl('dedupe', '重复的字只出现一次', state.dedupe)) +
      group('自定义标题', textCtl('title', state.title, '留空使用古诗名或「汉字字帖」')) +
      group('页眉信息', checkCtl('showHeader', '显示姓名 / 日期栏', state.showHeader));
  }

  function wordListOptions() {
    var opts = [];
    ['grade3', 'grade4', 'grade5', 'grade6'].forEach(function (k) {
      var g = window.WF_WORDS[k];
      if (g) opts.push({ v: k, label: g.label + '（' + g.words.length + ' 词）· ' + g.theme });
    });
    opts.push({ v: 'all', label: '全部年级混合（' + (window.WF_WORDS.grade3.words.length + window.WF_WORDS.grade4.words.length + window.WF_WORDS.grade5.words.length + window.WF_WORDS.grade6.words.length) + ' 词）' });
    return opts;
  }

  function controlsWords() {
    return group('词表', selectCtl('wordsList', wordListOptions(), state.wordsList), '词表为小学英语基础常用词，可替换为任意自定义词表。') +
      group('默写方向', segmented('wordsDir', [
        { v: 'cn2en', label: '看中文写英文' }, { v: 'en2cn', label: '看英文写中文' }
      ], state.wordsDir)) +
      group('每页词数', rangeCtl('wordsPerPage', 6, 13, 1, state.wordsPerPage)) +
      pageGroup() +
      group('自定义词表', areaCtl('customWords', state.customWords, '每行一个词：apple 苹果（英文在前，中文在后）'), '填写后将忽略上面的内置词表。') +
      group('随机种子', seedGroup()) +
      group('自定义标题', textCtl('title', state.title, '留空使用默认标题')) +
      group('页眉信息', checkCtl('showHeader', '显示姓名 / 日期栏', state.showHeader));
  }

  function renderControls() {
    var html = '<h2>练习设置</h2>';
    if (state.mode === 'oral') html += controlsOral();
    else if (state.mode === 'vertical') html += controlsVertical();
    else if (state.mode === 'hanzi') html += controlsHanzi();
    else html += controlsWords();
    controls.innerHTML = html;
    syncTabs();
  }

  function syncTabs() {
    Array.prototype.forEach.call(tabs.querySelectorAll('.tab'), function (b) {
      b.classList.toggle('active', b.getAttribute('data-mode') === state.mode);
    });
  }

  function syncControls() {
    Array.prototype.forEach.call(controls.querySelectorAll('[data-set]'), function (b) {
      var key = b.getAttribute('data-set');
      b.classList.toggle('on', String(state[key]) === b.getAttribute('data-val'));
    });
    Array.prototype.forEach.call(controls.querySelectorAll('[data-op]'), function (b) {
      b.classList.toggle('on', state.ops.indexOf(b.getAttribute('data-op')) >= 0);
    });
    Array.prototype.forEach.call(controls.querySelectorAll('[data-range]'), function (el) {
      var key = el.getAttribute('data-range');
      if (document.activeElement !== el) el.value = state[key];
      var lab = controls.querySelector('[data-range-val="' + key + '"]');
      if (lab) lab.textContent = state[key];
    });
    Array.prototype.forEach.call(controls.querySelectorAll('[data-check]'), function (el) {
      el.checked = !!state[el.getAttribute('data-check')];
    });
    Array.prototype.forEach.call(controls.querySelectorAll('[data-select]'), function (el) {
      el.value = state[el.getAttribute('data-select')];
    });
  }

  /* ---------------- 渲染预览 ---------------- */
  function renderPages() {
    var sheets = WF.buildPages(state);
    var info = '';
    if (!state.auto) {
      info = '<div class="preview-info no-print">共 ' + sheets.length + ' 页 · A4 纵向 · ' +
        '<a href="#" id="link-print">打印 / 保存为 PDF</a> · 浏览器打印时选择「另存为 PDF、A4、100%」</div>';
    }
    preview.innerHTML = info + sheets.join('');
    var lp = document.getElementById('link-print');
    if (lp) lp.addEventListener('click', function (e) { e.preventDefault(); window.print(); });
    window.WF_READY = true;
  }

  function scheduleRender() {
    if (renderTimer) clearTimeout(renderTimer);
    renderTimer = setTimeout(function () { renderPages(); }, 60);
  }

  /* ---------------- 状态变更 ---------------- */
  function normalize() {
    if (state.grade <= 1) {
      state.mixed = false;
      state.remainder = false;
      state.ops = state.ops.filter(function (o) { return o === '+' || o === '-'; });
      if (!state.ops.length) state.ops = ['+', '-'];
    } else if (state.mixed) {
      /* 混合运算不限制 ops */
    }
    if (state.mode === 'vertical') {
      state.ops = state.ops.filter(function (o) { return o !== '÷'; });
      if (!state.ops.length) state.ops = ['+', '-'];
    }
    if (!state.ops.length) state.ops = WF.DEFAULT_OPS[state.grade].slice();
    state.pages = Math.max(1, Math.min(60, state.pages | 0 || 1));
    state.cols = Math.max(1, Math.min(6, state.cols | 0 || 1));
    state.rows = Math.max(1, Math.min(30, state.rows | 0 || 1));
    state.hanziRows = Math.max(1, Math.min(30, state.hanziRows | 0 || 1));
    state.cells = Math.max(1, Math.min(20, state.cells | 0 || 1));
    state.trace = Math.max(0, Math.min(state.cells, state.trace | 0 || 0));
    state.wordsPerPage = Math.max(1, Math.min(13, state.wordsPerPage | 0 || 1));
    if (typeof state.hanziText !== 'string') state.hanziText = '';
    if (typeof state.customWords !== 'string') state.customWords = '';
    if (typeof state.title !== 'string') state.title = '';
  }

  function setState(key, val) {
    state[key] = val;
    if (key === 'grade') {
      var allowed = WF.DEFAULT_OPS[val] ? WF.DEFAULT_OPS[val].slice() : ['+', '-'];
      state.ops = state.ops.filter(function (o) { return allowed.indexOf(o) >= 0; });
      if (!state.ops.length) state.ops = allowed;
      state.mixed = state.mixed && val >= 4;
      state.remainder = state.remainder && val >= 4;
    }
    if (key === 'hanziPreset') {
      state.hanziPreset = val;
      if (val !== 'custom') { state.hanziText = ''; }
    }
    if (key === 'mixed' && val) {
      state.mixed = true;
      state.cols = Math.min(state.cols, 2);
      state.rows = Math.max(state.rows, 12);
    }
    if (key === 'remainder' && val) state.remainder = true;
    normalize();
    syncControls();
    scheduleRender();
    writeURL();
  }

  /* ---------------- 事件 ---------------- */
  function bind() {
    tabs.addEventListener('click', function (e) {
      var b = e.target.closest('.tab');
      if (!b) return;
      state.mode = b.getAttribute('data-mode');
      state.pages = 1;
      state.answers = false;
      if (state.mode === 'oral') { state.cols = 4; state.rows = 10; state.mixed = false; }
      if (state.mode === 'vertical') { state.cols = 3; state.rows = 5; state.mixed = false; }
      if (state.mode === 'words') { state.wordsPerPage = 12; }
      if (state.mode === 'hanzi') { state.hanziRows = 9; state.cells = 8; state.trace = 1; }
      normalize();
      renderControls();
      renderPages();
      writeURL();
    });

    controls.addEventListener('click', function (e) {
      var t = e.target;
      var opBtn = t.closest('[data-op]');
      if (opBtn) {
        var op = opBtn.getAttribute('data-op');
        if (state.grade < 2 && op !== '+' && op !== '-') return;
        var idx = state.ops.indexOf(op);
        if (idx >= 0) { if (state.ops.length > 1) state.ops.splice(idx, 1); }
        else state.ops.push(op);
        state.mixed = false;
        syncControls();
        scheduleRender();
        writeURL();
        return;
      }
      var setBtn = t.closest('[data-set]');
      if (setBtn) {
        var key = setBtn.getAttribute('data-set');
        var raw = setBtn.getAttribute('data-val');
        var val = (key === 'grade' || key === 'hanziRows' || key === 'cells' || key === 'trace') ? parseInt(raw, 10) : raw;
        if (key === 'wordsDir' || key === 'grid' || key === 'hanziPreset' || key === 'wordsList') val = raw;
        setState(key, val);
        return;
      }
      var sh = t.closest('[data-shuffle]');
      if (sh) {
        state.seed = Math.floor(Math.random() * 999999999);
        var seedInput = controls.querySelector('[data-text="seed"]');
        if (seedInput) seedInput.value = state.seed;
        scheduleRender();
        writeURL();
        return;
      }
    });

    controls.addEventListener('change', function (e) {
      var t = e.target;
      if (t.matches('[data-check]')) {
        state[t.getAttribute('data-check')] = t.checked;
        normalize();
        scheduleRender();
        writeURL();
        return;
      }
      if (t.matches('[data-select]')) {
        setState(t.getAttribute('data-select'), t.value);
        renderControls();
        return;
      }
    });

    controls.addEventListener('input', function (e) {
      var t = e.target;
      if (t.matches('[data-range]')) {
        var key = t.getAttribute('data-range');
        state[key] = parseInt(t.value, 10);
        var lab = controls.querySelector('[data-range-val="' + key + '"]');
        if (lab) lab.textContent = t.value;
        if (key === 'trace') state.trace = Math.min(state.trace, state.cells);
        scheduleRender();
        writeURL();
        return;
      }
      if (t.matches('[data-text]')) {
        var k = t.getAttribute('data-text');
        state[k] = (k === 'seed') ? parseInt(t.value, 10) || 1 : t.value;
        scheduleRender();
        writeURL();
      }
    });

    document.getElementById('btn-print').addEventListener('click', function () { window.print(); });
    document.getElementById('btn-shuffle').addEventListener('click', function () {
      state.seed = Math.floor(Math.random() * 999999999);
      var seedInput = controls.querySelector('[data-text="seed"]');
      if (seedInput) seedInput.value = state.seed;
      scheduleRender();
      writeURL();
    });
  }

  function init() {
    state = readURL();
    normalize();
    if (state.auto) {
      document.body.classList.add('auto');
    }
    if (state.auto) {
      renderPages();
      document.title = '习题工坊 · 导出模式';
      return;
    }
    renderControls();
    renderPages();
    bind();
    writeURL();
  }

  window.WF = WF;
  WF.state = function () { return state; };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})(window.WF || (window.WF = {}));
