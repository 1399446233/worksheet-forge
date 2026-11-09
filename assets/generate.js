/* 题目生成核心：纯函数、可复现随机（seed） */
window.WF = window.WF || {};
(function (WF) {
  'use strict';

  WF.GRADE_LABEL = { 1: '一年级', 2: '二年级', 3: '三年级', 4: '四年级', 5: '五年级', 6: '六年级' };
  WF.DEFAULT_OPS = { 1: ['+', '-'], 2: ['+', '-', '×', '÷'], 3: ['+', '-', '×', '÷'], 4: ['+', '-', '×', '÷'], 5: ['+', '-', '×', '÷'], 6: ['+', '-', '×', '÷'] };
  WF.OP_LABEL = { '+': '加法', '-': '减法', '×': '乘法', '÷': '除法' };

  /* mulberry32：同一 seed 结果完全一致，方便老师出 A/B 卷 */
  WF.rng = function (seed) {
    var a = (seed >>> 0) || 0x9e3779b9;
    return function () {
      a = (a + 0x6D2B79F5) >>> 0;
      var t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  };

  WF.ri = function (rng, a, b) {
    if (b < a) { var t = a; a = b; b = t; }
    return a + Math.floor(rng() * (b - a + 1));
  };

  function pick(rng, arr) { return arr[Math.floor(rng() * arr.length)]; }

  function genAddSub(rng, grade, op) {
    var a;
    if (op === '+') {
      if (grade <= 1) { a = WF.ri(rng, 1, 10); return { a: a, b: WF.ri(rng, 1, 20 - a) }; }
      if (grade === 2) { a = WF.ri(rng, 10, 89); return { a: a, b: WF.ri(rng, 2, 100 - a) }; }
      if (grade === 3) { a = WF.ri(rng, 100, 899); return { a: a, b: WF.ri(rng, 2, 1000 - a) }; }
      a = WF.ri(rng, 1000, 8999); return { a: a, b: WF.ri(rng, 2, 10000 - a) };
    }
    if (grade <= 1) { a = WF.ri(rng, 2, 20); return { a: a, b: WF.ri(rng, 1, a - 1) }; }
    if (grade === 2) { a = WF.ri(rng, 20, 99); return { a: a, b: WF.ri(rng, 2, a - 1) }; }
    if (grade === 3) { a = WF.ri(rng, 200, 1000); return { a: a, b: WF.ri(rng, 2, a - 1) }; }
    a = WF.ri(rng, 2000, 10000); return { a: a, b: WF.ri(rng, 2, a - 1) };
  }

  function genMul(rng, grade, heavy) {
    if (grade <= 2) return { a: WF.ri(rng, 2, 9), b: WF.ri(rng, 2, 9) };
    if (grade === 3) return { a: WF.ri(rng, 10, 99), b: WF.ri(rng, 2, 9) };
    if (heavy) return { a: WF.ri(rng, 100, 999), b: WF.ri(rng, 10, 99) };
    if (grade === 4) return { a: WF.ri(rng, 100, 999), b: WF.ri(rng, 2, 9) };
    return { a: WF.ri(rng, 11, 99), b: WF.ri(rng, 11, 29) };
  }

  function genDiv(rng, grade, remainder) {
    var b, q, r, a;
    if (grade <= 2) { b = WF.ri(rng, 2, 9); q = WF.ri(rng, 2, 9); return { a: b * q, b: b }; }
    if (grade === 3) { b = WF.ri(rng, 2, 9); q = WF.ri(rng, 10, 99); return { a: b * q, b: b }; }
    if (remainder) {
      b = WF.ri(rng, 11, 99);
      q = WF.ri(rng, 2, Math.max(2, Math.floor(999 / b)));
      r = WF.ri(rng, 1, b - 1);
      a = q * b + r;
      if (a > 9999) { a = 9999; q = Math.floor(a / b); r = a - q * b; }
      return { a: a, b: b, rem: r };
    }
    b = WF.ri(rng, 11, 99);
    q = WF.ri(rng, 2, 9);
    return { a: b * q, b: b };
  }

  function fmtNum(n) { return String(n); }

  function makeQuestion(op, p) {
    var expr = fmtNum(p.a) + ' ' + op + ' ' + fmtNum(p.b);
    var ans;
    if (op === '+') ans = p.a + p.b;
    else if (op === '-') ans = p.a - p.b;
    else if (op === '×') ans = p.a * p.b;
    else ans = (p.rem === undefined ? String(p.a / p.b) : Math.floor(p.a / p.b) + '……' + p.rem);
    return { expr: expr, ans: String(ans), op: op };
  }

  /* ---------- 混合运算（含括号、先乘除后加减） ---------- */
  function genMixed(rng, grade) {
    var big = grade >= 5;
    var patterns = ['muladd', 'mulsub', 'paradd', 'parsub', 'divadd'];
    if (big) patterns = patterns.concat(['mulmul', 'mulmulsub', 'parmul3', 'divmul']);
    var p = pick(rng, patterns);
    var a, b, c, d, val, expr, ans;

    if (p === 'muladd') {
      a = big ? WF.ri(rng, 11, 99) : WF.ri(rng, 3, 9);
      b = big ? WF.ri(rng, 2, 9) : WF.ri(rng, 11, 99);
      c = big ? WF.ri(rng, 100, 999) : WF.ri(rng, 10, 99);
      val = a * b + c; expr = a + ' × ' + b + ' + ' + c; ans = val;
    } else if (p === 'mulsub') {
      a = big ? WF.ri(rng, 11, 99) : WF.ri(rng, 4, 9);
      b = big ? WF.ri(rng, 3, 9) : WF.ri(rng, 11, 99);
      c = WF.ri(rng, 10, Math.max(20, a * b - 1));
      val = a * b - c; expr = a + ' × ' + b + ' - ' + c; ans = val;
    } else if (p === 'paradd') {
      a = big ? WF.ri(rng, 100, 499) : WF.ri(rng, 10, 49);
      b = big ? WF.ri(rng, 100, 499) : WF.ri(rng, 10, 49);
      c = WF.ri(rng, 2, 9);
      val = (a + b) * c; expr = '(' + a + ' + ' + b + ') × ' + c; ans = val;
    } else if (p === 'parsub') {
      a = big ? WF.ri(rng, 200, 599) : WF.ri(rng, 20, 79);
      b = WF.ri(rng, 10, a - 1);
      c = WF.ri(rng, 2, 9);
      val = (a - b) * c; expr = '(' + a + ' - ' + b + ') × ' + c; ans = val;
    } else if (p === 'divadd') {
      b = WF.ri(rng, 2, 9);
      a = b * WF.ri(rng, 11, 99);
      c = WF.ri(rng, 10, 99);
      val = a / b + c; expr = a + ' ÷ ' + b + ' + ' + c; ans = val;
    } else if (p === 'mulmul') {
      a = WF.ri(rng, 2, 9); b = WF.ri(rng, 11, 99);
      c = WF.ri(rng, 2, 9); d = WF.ri(rng, 11, 99);
      val = a * b + c * d; expr = a + ' × ' + b + ' + ' + c + ' × ' + d; ans = val;
    } else if (p === 'mulmulsub') {
      a = WF.ri(rng, 6, 9); b = WF.ri(rng, 21, 99);
      c = WF.ri(rng, 2, 5); d = WF.ri(rng, 11, 49);
      var minuend = a * b;
      if (c * d >= minuend) { d = WF.ri(rng, 2, 9); }
      val = a * b - c * d; expr = a + ' × ' + b + ' - ' + c + ' × ' + d; ans = val;
    } else if (p === 'parmul3') {
      a = WF.ri(rng, 10, 49); b = WF.ri(rng, 10, 99); c = WF.ri(rng, 2, 9);
      val = (a + b) * c; expr = '(' + a + ' + ' + b + ') × ' + c; ans = val;
    } else {
      b = WF.ri(rng, 2, 9);
      a = b * WF.ri(rng, 11, 99);
      c = WF.ri(rng, 2, 9); d = WF.ri(rng, 11, 99);
      val = a / b + c * d; expr = a + ' ÷ ' + b + ' + ' + c + ' × ' + d; ans = val;
    }
    return { expr: expr, ans: String(ans), op: '混' };
  }

  /* 生成一页/一批口算题 */
  WF.genQuestions = function (opts) {
    var grade = opts.grade || 1;
    var count = Math.max(1, opts.count || 20);
    var rng = WF.rng(opts.seed || 1);
    var ops = (opts.ops && opts.ops.length ? opts.ops : WF.DEFAULT_OPS[grade]).slice();
    if (grade <= 1) ops = ops.filter(function (o) { return o === '+' || o === '-'; });
    var mixed = !!opts.mixed && grade >= 4;
    var remainder = !!opts.remainder && grade >= 4;
    var out = [];
    var seen = {};
    var guard = 0;
    while (out.length < count && guard < count * 40) {
      guard++;
      var q;
      if (mixed) {
        q = genMixed(rng, grade);
      } else {
        var op = pick(rng, ops);
        var p;
        if (op === '+' || op === '-') p = genAddSub(rng, grade, op);
        else if (op === '×') p = genMul(rng, grade, false);
        else p = genDiv(rng, grade, remainder);
        q = makeQuestion(op, p);
      }
      if (seen[q.expr]) continue;
      seen[q.expr] = 1;
      out.push(q);
    }
    return out;
  };

  /* 生成一批竖式题（+ - ×） */
  WF.genVertical = function (opts) {
    var grade = opts.grade || 1;
    var count = Math.max(1, opts.count || 12);
    var rng = WF.rng(opts.seed || 1);
    var ops = (opts.ops && opts.ops.length ? opts.ops : WF.DEFAULT_OPS[grade]).filter(function (o) { return o !== '÷'; });
    if (grade <= 1) ops = ['+', '-'];
    var out = [];
    var seen = {};
    var guard = 0;
    while (out.length < count && guard < count * 40) {
      guard++;
      var op = pick(rng, ops);
      var p;
      if (op === '+' || op === '-') p = genAddSub(rng, grade, op);
      else p = genMul(rng, grade, true);
      var key = p.a + op + p.b;
      if (seen[key]) continue;
      seen[key] = 1;
      var ans = op === '+' ? p.a + p.b : op === '-' ? p.a - p.b : p.a * p.b;
      out.push({ a: p.a, b: p.b, op: op, ans: String(ans) });
    }
    return out;
  };

  /* 打乱数组（返回新数组，可复现） */
  WF.shuffle = function (arr, seed) {
    var a = arr.slice();
    var rng = WF.rng(seed || 1);
    for (var i = a.length - 1; i > 0; i--) {
      var j = Math.floor(rng() * (i + 1));
      var t = a[i]; a[i] = a[j]; a[j] = t;
    }
    return a;
  };

  /* 拼音（依赖本地 pinyin-pro，缺失时自动降级为空） */
  WF.pinyin = function (ch) {
    var P = window.pinyinPro || window.pinyinpro;
    if (!P || typeof P.pinyin !== 'function') return '';
    try {
      var r = P.pinyin(ch, { toneType: 'symbol', type: 'string' });
      return typeof r === 'string' ? r : '';
    } catch (e) { return ''; }
  };

  WF.isCJK = function (ch) { return /[\u4e00-\u9fa5]/.test(ch); };

  /* 解析自定义词表：每行 "apple 苹果" / "apple,苹果" / "apple\t苹果" */
  WF.parseWordTable = function (text) {
    var out = [];
    String(text || '').split(/\r?\n/).forEach(function (line) {
      line = line.trim();
      if (!line) return;
      var m = line.split(/[\s,，、\t]+/);
      if (m.length >= 2) {
        out.push([m[0], m.slice(1).join(' ')]);
      } else {
        out.push([m[0], '']);
      }
    });
    return out;
  };
})(window.WF);
