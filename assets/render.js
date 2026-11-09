/* 版面渲染：把题目数据渲染成 A4 页面 HTML */
window.WF = window.WF || {};
(function (WF) {
  'use strict';

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  WF.esc = esc;

  var ANSWER_PER_PAGE = 96; /* 4 列 × 24 行 */

  function metaHTML(kind) {
    if (!kind || kind === 'none') return '';
    var items = kind === 'basic' ? ['姓名', '日期'] : ['姓名', '班级', '日期', '用时', '得分'];
    return items.map(function (x) { return '<span>' + x + '：<i></i></span>'; }).join('');
  }

  function sheetHTML(o) {
    var page = (o.pageNo && o.total) ? '第 ' + o.pageNo + ' 页 / 共 ' + o.total + ' 页' : '';
    return '<article class="sheet">' +
      '<header class="sheet-head">' +
        '<div class="sheet-title">' + esc(o.title) +
          (o.subtitle ? '<small>' + esc(o.subtitle) + '</small>' : '') +
        '</div>' +
        '<div class="sheet-meta">' + metaHTML(o.metaKind) + '</div>' +
      '</header>' +
      '<div class="sheet-body">' + o.body + '</div>' +
      '<footer class="sheet-foot">' +
        '<span>' + esc(o.foot || '习题工坊 · 免费开源 · 可自行打印') + '</span>' +
        (o.tip ? '<span class="sheet-tip">' + esc(o.tip) + '</span>' : '<span></span>') +
        '<span>' + page + '</span>' +
      '</footer>' +
    '</article>';
  }

  function uniqChars(arr) {
    var seen = {};
    return arr.filter(function (c) {
      if (seen[c]) return false;
      seen[c] = 1;
      return true;
    });
  }

  function chunk(arr, n) {
    var out = [];
    for (var i = 0; i < arr.length; i += n) out.push(arr.slice(i, i + n));
    return out;
  }

  function opsLabel(state, grade) {
    if (state.mixed && grade >= 4) return '混合运算';
    var ops = state.ops && state.ops.length ? state.ops : WF.DEFAULT_OPS[grade];
    return ops.map(function (o) { return WF.OP_LABEL[o]; }).join(' · ');
  }

  function qSize(state, count) {
    if (state.mixed) return '12pt';
    if (state.grade >= 5) return '13pt';
    if (state.cols >= 5) return '12.5pt';
    if (count <= 0) return '13pt';
    return '13.5pt';
  }

  /* ================= 口算 ================= */
  function buildOral(state) {
    var perPage = state.cols * state.rows;
    var pages = Math.max(1, state.pages | 0);
    var sets = [];
    var p;
    for (p = 0; p < pages; p++) {
      sets.push(WF.genQuestions({
        grade: state.grade, ops: state.ops, count: perPage,
        mixed: state.mixed, remainder: state.remainder,
        seed: (state.seed + p * 7919)
      }));
    }
    var answerChunks = state.answers ? chunk([].concat.apply([], sets.map(function (s) { return s; })), ANSWER_PER_PAGE) : [];
    var total = pages + answerChunks.length;
    var title = state.title || (WF.GRADE_LABEL[state.grade] + '口算练习');
    var sub = opsLabel(state, state.grade) + ' · 每页 ' + perPage + ' 题';
    var size = qSize(state, perPage);
    var rows = Math.max(1, state.rows);
    var gap = Math.max(3.6, Math.min(16, 215 / rows - 5));
    var sheets = [];

    for (p = 0; p < pages; p++) {
      var qs = sets[p];
      var body = '<div class="oral-grid" style="--cols:' + state.cols + ';--qsize:' + size + ';--gap:' + gap.toFixed(2) + 'mm">' +
        qs.map(function (q) {
          return '<div class="oral-item"><span class="oral-eq">' + esc(q.expr) + ' =</span><span class="oral-blank"></span></div>';
        }).join('') + '</div>';
      sheets.push(sheetHTML({
        title: title, subtitle: pages > 1 ? sub + ' · 第 ' + (p + 1) + ' 组' : sub,
        metaKind: state.showHeader ? 'full' : 'none',
        body: body, pageNo: p + 1, total: total,
        tip: '建议：计时完成，先易后难'
      }));
    }

    answerChunks.forEach(function (items, i) {
      var body = '<div class="answer-grid" style="--acols:4">' +
        items.map(function (q) {
          return '<div class="answer-item">' + esc(q.expr) + ' = <b>' + esc(q.ans) + '</b></div>';
        }).join('') + '</div>';
      sheets.push(sheetHTML({
        title: title, subtitle: '参考答案' + (answerChunks.length > 1 ? ' · 第 ' + (i + 1) + ' 部分' : ''),
        metaKind: state.showHeader ? 'basic' : 'none',
        body: body, pageNo: pages + i + 1, total: total,
        tip: '答案由本地算法计算'
      }));
    });

    return sheets;
  }

  /* ================= 竖式 ================= */
  function buildVertical(state) {
    var perPage = state.cols * state.rows;
    var pages = Math.max(1, state.pages | 0);
    var sets = [];
    var p;
    for (p = 0; p < pages; p++) {
      sets.push(WF.genVertical({
        grade: state.grade, ops: state.ops, count: perPage,
        seed: (state.seed + p * 6151)
      }));
    }
    var answerChunks = state.answers ? chunk([].concat.apply([], sets.map(function (s) { return s; })), ANSWER_PER_PAGE) : [];
    var total = pages + answerChunks.length;
    var title = state.title || (WF.GRADE_LABEL[state.grade] + '竖式计算');
    var opsText = (state.ops && state.ops.length ? state.ops : WF.DEFAULT_OPS[state.grade]).filter(function (o) { return o !== '÷'; }).map(function (o) { return WF.OP_LABEL[o]; }).join(' · ');
    var sub = opsText + ' · 每页 ' + perPage + ' 题';
    var sheets = [];

    for (p = 0; p < pages; p++) {
      var vspace = Math.max(10, Math.min(32, 232 / Math.max(1, state.rows) - 22));
      var body = '<div class="v-grid" style="--vcols:' + state.cols + ';--vspace:' + vspace.toFixed(1) + 'mm">' +
        sets[p].map(function (q) {
          return '<div class="v-item"><div class="v-box">' +
            '<div class="v-line"><span class="v-num">' + esc(q.a) + '</span></div>' +
            '<div class="v-line"><span class="v-op">' + esc(q.op) + '</span><span class="v-num">' + esc(q.b) + '</span></div>' +
            '<div class="v-rule"></div>' +
            '<div class="v-space"></div>' +
            '</div></div>';
        }).join('') + '</div>';
      sheets.push(sheetHTML({
        title: title, subtitle: pages > 1 ? sub + ' · 第 ' + (p + 1) + ' 组' : sub,
        metaKind: state.showHeader ? 'full' : 'none',
        body: body, pageNo: p + 1, total: total,
        tip: '建议：列竖式，数位对齐'
      }));
    }

    answerChunks.forEach(function (items, i) {
      var body = '<div class="answer-grid" style="--acols:4">' +
        items.map(function (q) {
          return '<div class="answer-item">' + esc(q.a + ' ' + q.op + ' ' + q.b) + ' = <b>' + esc(q.ans) + '</b></div>';
        }).join('') + '</div>';
      sheets.push(sheetHTML({
        title: title, subtitle: '参考答案' + (answerChunks.length > 1 ? ' · 第 ' + (i + 1) + ' 部分' : ''),
        metaKind: state.showHeader ? 'basic' : 'none',
        body: body, pageNo: pages + i + 1, total: total,
        tip: '答案由本地算法计算'
      }));
    });

    return sheets;
  }

  /* ================= 汉字字帖 ================= */
  function findPreset(id) {
    var P = window.WF_PRESETS || {};
    var poems = P.poems || [];
    for (var i = 0; i < poems.length; i++) if (poems[i].id === id) return poems[i];
    if (P.common && P.common.id === id) return P.common;
    return poems[0] || null;
  }
  WF.findPreset = findPreset;

  function buildHanzi(state) {
    var preset = findPreset(state.hanziPreset);
    var hasText = !!(state.hanziText && state.hanziText.trim());
    var raw = hasText ? state.hanziText : (preset ? preset.text : '');
    var chars = raw.split('').filter(WF.isCJK);
    if (state.dedupe) chars = uniqChars(chars);
    if (!chars.length) {
      return [sheetHTML({
        title: '汉字字帖', subtitle: '请先在左侧输入要练习的文字', metaKind: 'none',
        body: '<div style="padding:30mm 10mm;text-align:center;color:#888;font-size:12pt;">' +
          '在左侧「练习内容」中粘贴课文、生字表或选择一首古诗，即可自动生成描红字帖。</div>',
        pageNo: 1, total: 1
      })];
    }
    var rows = Math.max(1, state.hanziRows | 0);
    var cells = Math.max(1, state.cells | 0);
    var cell = Math.max(12, Math.min(20, Math.floor((228 / rows - 6.2) * 10) / 10));
    var cellStr = cell.toFixed(1) + 'mm';
    var trace = Math.max(0, Math.min(cells, state.trace | 0));
    var gridCls = state.grid === 'mi' ? 'mi' : (state.grid === 'none' ? '' : 'tian');
    var groups = chunk(chars, rows);
    var total = groups.length;
    var title = state.title || (preset && !hasText ? preset.title : '汉字字帖');
    var subText = '';
    if (preset && !hasText) subText = (preset.author || '') + ' · ';
    subText += '每字 ' + cells + ' 格 · 描红 ' + trace + ' 格' + (state.showPinyin ? ' · 带拼音' : '');

    return groups.map(function (group, idx) {
      var rowHtml = group.map(function (ch) {
        var py = state.showPinyin ? WF.pinyin(ch) : '';
        var cellsHtml = '';
        for (var c = 0; c < cells; c++) {
          cellsHtml += '<div class="hz-cell ' + gridCls + '">' +
            (c < trace ? '<span class="hz-char trace">' + esc(ch) + '</span>' : '') +
            '</div>';
        }
        var pyLine = '<span class="hz-py">' + esc(py) + '</span>';
        for (var k = 1; k < cells; k++) pyLine += '<span class="hz-py"></span>';
        return '<div class="hz-row">' +
          '<div class="hz-pyline">' + pyLine + '</div>' +
          '<div class="hz-cells">' + cellsHtml + '</div>' +
          '</div>';
      }).join('');
      return sheetHTML({
        title: title, subtitle: subText,
        metaKind: state.showHeader ? 'basic' : 'none',
        body: '<div class="hz-wrap" style="--cells:' + cells + ';--cell:' + cellStr + '">' + rowHtml + '</div>' +
          (idx === 0 ? '<div class="hz-legend">浅红字为描红，空格为临写；建议先描后写，读完一遍再动笔。</div>' : ''),
        pageNo: idx + 1, total: total,
        tip: '打印建议：A4 100% 缩放'
      });
    });
  }

  /* ================= 英语单词默写 ================= */
  function allWordItems() {
    var W = window.WF_WORDS || {};
    var out = [];
    ['grade3', 'grade4', 'grade5', 'grade6'].forEach(function (k) {
      if (W[k]) W[k].words.forEach(function (it) { out.push(it); });
    });
    return out;
  }

  function resolveWordItems(state) {
    var custom = state.customWords && state.customWords.trim();
    if (custom) return WF.parseWordTable(state.customWords);
    if (state.wordsList === 'all') return allWordItems();
    var W = window.WF_WORDS || {};
    return (W[state.wordsList] || W.grade3 || { words: [] }).words;
  }
  WF.resolveWordItems = resolveWordItems;

  function buildWords(state) {
    var items = resolveWordItems(state);
    if (!items.length) {
      return [sheetHTML({
        title: '单词默写', subtitle: '请先在左侧选择词表或输入自定义词表', metaKind: 'none',
        body: '<div style="padding:30mm 10mm;text-align:center;color:#888;font-size:12pt;">每行输入「英文 中文」，例如：apple 苹果</div>',
        pageNo: 1, total: 1
      })];
    }
    var per = Math.max(4, Math.min(state.wordsPerPage | 0, items.length));
    var writeH = Math.max(9, Math.min(14, (232 - (per - 1) * 2.4) / per - 6.5));
    var writeStyle = '--wwrite:' + writeH.toFixed(1) + 'mm;--wgap:2.4mm';
    var pages = Math.max(1, state.pages | 0);
    var dir = state.wordsDir === 'en2cn' ? 'en2cn' : 'cn2en';
    var sheets = [];
    var allUsed = [];
    var pageChunks = [];
    var p;
    for (p = 0; p < pages; p++) {
      var shuffled = WF.shuffle(items, (state.seed || 1) + p * 104729);
      var chunkItems = shuffled.slice(0, per);
      pageChunks.push(chunkItems);
      allUsed = allUsed.concat(chunkItems);
    }
    var answerChunks = state.answers ? chunk(allUsed, ANSWER_PER_PAGE) : [];
    var total = pages + answerChunks.length;
    var customWords = state.customWords && state.customWords.trim();
    var listLabel = customWords
      ? '自定义词表'
      : (state.wordsList === 'all' ? '小学英语基础词' : ((window.WF_WORDS || {})[state.wordsList] || {}).label + '单词');
    var title = state.title || (listLabel + '默写');
    var sub = (dir === 'en2cn' ? '看英文写中文' : '看中文写英文') + ' · 每页 ' + per + ' 词';

    pageChunks.forEach(function (chunkItems, idx) {
      var body = '<div class="word-list" style="' + writeStyle + '">' + chunkItems.map(function (it, i) {
        var prompt, cls, promptCls;
        if (dir === 'en2cn') {
          prompt = it[0]; cls = 'blank-line'; promptCls = 'word-en';
        } else {
          prompt = it[1] || it[0]; cls = 'four-line'; promptCls = 'word-cn';
        }
        return '<div class="word-item">' +
          '<div class="word-no">' + (i + 1) + '.</div>' +
          '<div class="word-main">' +
            '<div class="word-prompt"><span class="' + promptCls + '">' + esc(prompt) + '</span>' +
            (dir === 'en2cn' && it[1] ? '<span class="word-hint">' + esc(it[1]) + '</span>' : '') +
            '</div>' +
            '<div class="word-write ' + cls + '"></div>' +
          '</div>' +
        '</div>';
      }).join('') + '</div>';
      sheets.push(sheetHTML({
        title: title, subtitle: pages > 1 ? sub + ' · 第 ' + (idx + 1) + ' 页' : sub,
        metaKind: state.showHeader ? 'basic' : 'none',
        body: body, pageNo: idx + 1, total: total,
        tip: '写完后对照答案页自查'
      }));
    });

    answerChunks.forEach(function (chunkItems, i) {
      var body = '<div class="answer-key">' + chunkItems.map(function (it, k) {
        return '<div class="k">' + esc(it[0]) + ' — ' + esc(it[1] || '') + '</div>';
      }).join('') + '</div>';
      sheets.push(sheetHTML({
        title: title, subtitle: '参考答案' + (answerChunks.length > 1 ? ' · 第 ' + (i + 1) + ' 部分' : ''),
        metaKind: state.showHeader ? 'basic' : 'none',
        body: body, pageNo: pages + i + 1, total: total,
        tip: '答案页可单独打印或由家长保存'
      }));
    });

    return sheets;
  }

  /* ================= 统一入口 ================= */
  WF.buildPages = function (state) {
    switch (state.mode) {
      case 'vertical': return buildVertical(state);
      case 'hanzi': return buildHanzi(state);
      case 'words': return buildWords(state);
      default: return buildOral(state);
    }
  };
})(window.WF);
