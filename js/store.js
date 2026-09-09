/* ================= 数据层（localStorage 持久化 + 统计） ================= */
'use strict';

const Store = (function () {
  const P = 'ww.'; // key 前缀

  function read(key, fallback) {
    try {
      const v = localStorage.getItem(P + key);
      return v === null ? fallback : JSON.parse(v);
    } catch (e) { return fallback; }
  }
  function write(key, value) {
    try { localStorage.setItem(P + key, JSON.stringify(value)); }
    catch (e) { /* 容量满或隐私模式时静默失败 */ }
  }

  /* ---------- 日期工具 ---------- */
  const pad = n => String(n).padStart(2, '0');
  function dateStr(d) {
    return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
  }
  function todayStr() { return dateStr(new Date()); }
  function parseDate(str) { // 'YYYY-MM-DD' -> 本地 Date 零点
    const p = str.split('-').map(Number);
    return new Date(p[0], p[1] - 1, p[2]);
  }
  function daysAgoStr(n) { const d = new Date(); d.setDate(d.getDate() - n); return dateStr(d); }
  function addDaysStr(str, n) { const d = parseDate(str); d.setDate(d.getDate() + n); return dateStr(d); }
  function hm(ts) { const d = new Date(ts); return pad(d.getHours()) + ':' + pad(d.getMinutes()); }
  function hms(ts) { const d = new Date(ts); return pad(d.getHours()) + ':' + pad(d.getMinutes()) + ':' + pad(d.getSeconds()); }
  function nowHM() { const d = new Date(); return pad(d.getHours()) + ':' + pad(d.getMinutes()); }
  function minOfDay(hmStr) { const p = hmStr.split(':').map(Number); return p[0] * 60 + p[1]; }

  /* ---------- 配置 ---------- */
  const DEFAULTS = {
    goalCups: 8,                 // 每日目标（杯）
    cupMl: 250,                  // 每杯容量 ml
    reminders: [                 // 闹钟提醒时间
      { t: '09:00', on: true }, { t: '11:00', on: true },
      { t: '13:30', on: true }, { t: '15:30', on: true },
      { t: '17:30', on: true }, { t: '20:00', on: true }
    ],
    sound: true,                 // 页面内响铃
    notify: false,               // 浏览器通知
    wake: '08:00',               // 节奏建议：清醒开始时间
    sleep: '23:00'               // 节奏建议：结束时间
  };
  let cfg = Object.assign({}, DEFAULTS, read('cfg', {}));
  function getCfg() { return cfg; }
  function setCfg(partial) {
    cfg = Object.assign({}, cfg, partial);
    write('cfg', cfg);
    return cfg;
  }
  function goalMl() { return cfg.goalCups * cfg.cupMl; }

  /* ---------- 每日喝水记录 ---------- */
  function dayKey(s) { return 'drink.' + s; }
  function entries(s) { return (read(dayKey(s), []) || []).slice().sort((a, b) => a.ts - b.ts); }
  function addDrink(s, ml) {
    const arr = read(dayKey(s), []);
    arr.push({ ts: Date.now(), ml: ml });
    write(dayKey(s), arr);
  }
  function removeAt(s, idx) {
    const arr = read(dayKey(s), []);
    arr.sort((a, b) => a.ts - b.ts);
    if (idx >= 0 && idx < arr.length) { arr.splice(idx, 1); write(dayKey(s), arr); return true; }
    return false;
  }
  function clearDay(s) { write(dayKey(s), []); }
  function totalMl(s) { return entries(s).reduce((a, e) => a + e.ml, 0); }
  function totalCups(s, cupMl) { return totalMl(s) / (cupMl || cfg.cupMl); }
  function completed(s) { return totalMl(s) >= goalMl(); }

  /* ---------- 连胜天数（连续达标） ---------- */
  function streakDays(s) {
    let n = 0, cur = s;
    if (!completed(cur)) cur = addDaysStr(cur, -1); // 今天未达标则从昨天起算
    while (completed(cur)) { n++; cur = addDaysStr(cur, -1); }
    return n;
  }

  /* ---------- 历史统计 ---------- */
  // 返回从今天往前 n 天的 [{date,total,goal}]
  function lastNDays(n) {
    const goal = goalMl(), out = [];
    for (let i = n - 1; i >= 0; i--) {
      const d = daysAgoStr(i);
      out.push({ date: d, total: totalMl(d), goal });
    }
    return out;
  }

  /* ---------- 已触发的提醒（每天一次） ---------- */
  function firedKey(s) { return 'fired.' + s; }
  function firedToday(s) { return read(firedKey(s), {}); }
  function markFired(s, time) {
    const f = read(firedKey(s), {});
    f[time] = true; write(firedKey(s), f);
  }

  /* ---------- 数据备份（导出 / 导入） ---------- */
  function exportAll() {
    const out = {};
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.indexOf(P) === 0) {
        const short = k.slice(P.length);
        out[short] = read(short, null);
      }
    }
    return out;
  }
  function importAll(data) {
    // 先清空旧数据
    const keys = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.indexOf(P) === 0) keys.push(k);
    }
    keys.forEach(k => localStorage.removeItem(k));
    // 再写入备份内容
    Object.keys(data || {}).forEach(short => {
      const v = data[short];
      if (typeof v !== 'undefined' && v !== null) write(short, v);
    });
    cfg = Object.assign({}, DEFAULTS, read('cfg', {}));
  }

  /* ---------- 数据重置 ---------- */
  function clearAll() {
    const keys = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.indexOf(P) === 0) keys.push(k);
    }
    keys.forEach(k => localStorage.removeItem(k));
    cfg = Object.assign({}, DEFAULTS);
  }

  return {
    pad, dateStr, todayStr, daysAgoStr, addDaysStr, parseDate, hm, hms, nowHM, minOfDay,
    getCfg, setCfg, goalMl,
    entries, addDrink, removeAt, clearDay, totalMl, totalCups, completed,
    streakDays, lastNDays,
    firedToday, markFired,
    exportAll, importAll,
    clearAll
  };
})();
