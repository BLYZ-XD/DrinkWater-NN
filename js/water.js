/* ================= 喝水监督模块 ================= */
'use strict';

const Water = (function () {
  let day = Store.todayStr();
  let chartDays = 7;
  const $id = id => document.getElementById(id);

  /* ---------- 数字显示工具 ---------- */
  function cupsOf(ml) { return ml / Store.getCfg().cupMl; }
  function cupsStr(ml) {
    const c = Math.round(cupsOf(ml) * 2) / 2;
    return (Number.isInteger(c) ? c : c.toFixed(1).replace(/\.0$/, ''));
  }
  function todayCupsFrac() { // 今日杯数（保留 0.5）
    return cupsStr(Store.totalMl(day));
  }
  function fmtWeekday(dStr) {
    return '周' + ['日', '一', '二', '三', '四', '五', '六'][Store.parseDate(dStr).getDay()];
  }

  /* ---------- 主渲染 ---------- */
  function render(force) {
    const sec = $id('view-water');
    const hidden = sec.classList.contains('hidden');
    if (hidden && !force) return;
    const cfg = Store.getCfg();
    const today = Store.todayStr();
    if (today !== day) { day = today; }

    // 头部日期
    $id('waterDateStr').textContent =
      day === today ? '今天 · ' + fmtWeekday(day) : fmtWeekday(day);
    $id('waterDateStr').textContent += ' · ' + day;

    // 连胜
    $id('streakNum').textContent = Store.streakDays(today);

    const total = Store.totalMl(day);
    const goal = cfg.goalCups * cfg.cupMl;
    const done = total >= goal;
    renderRing(Math.min(1, total / goal));
    $id('ringTotal').textContent = todayCupsFrac() + ' / ' + cfg.goalCups + ' 杯';

    const remain = Math.max(0, cfg.goalCups - cupsOf(total));
    const remainEl = $id('remainNum');
    if (done) {
      remainEl.textContent = '目标已完成 🎉';
      remainEl.classList.add('done');
    } else {
      remainEl.textContent = '还差 ' + (Number.isInteger(remain) ? remain : remain.toFixed(1).replace(/\.0$/, '')) + ' 杯';
      remainEl.classList.remove('done');
    }

    $id('statMl').textContent = total + ' ml';
    $id('statCups').textContent = todayCupsFrac() + ' 杯';
    $id('goalHint').textContent =
      '目标：' + cfg.goalCups + ' 杯（每杯 ' + cfg.cupMl + ' ml）· 全天 ' + goal + ' ml';

    renderTimeline();
    renderPace();
    renderChart();
  }

  /* ---------- 时间线 ---------- */
  function renderTimeline() {
    const list = Store.entries(day);
    const box = $id('timeline');
    box.innerHTML = '';
    $id('timelineEmpty').classList.toggle('hidden', list.length > 0);
    const cfg = Store.getCfg();
    list.slice().reverse().forEach((e, ri) => {
      const idx = list.length - 1 - ri;
      const item = document.createElement('div');
      item.className = 'tl-item';
      const isFull = Math.abs(e.ml - cfg.cupMl) < 1;
      const isHalf = Math.abs(e.ml * 2 - cfg.cupMl) < 1;
      const name = isFull ? '一杯' : (isHalf ? '半杯' : cupsStr(e.ml) + '杯');
      item.innerHTML =
        '<span class="tl-time">' + Store.hm(e.ts) + '</span>' +
        '<span class="tl-cup" title="' + esc(e.ts) + '">' + (isFull ? '🥤' : '🥛') + '</span>' +
        '<span class="muted small">' + name + '</span>' +
        '<span class="tl-amt">' + e.ml + ' ml</span>' +
        '<button class="tl-del" type="button" data-idx="' + idx + '" title="删除这条记录">✕</button>';
      item.querySelector('.tl-del').addEventListener('click', () => {
        Store.removeAt(day, idx);
        toast('已删除一条记录', 'warn');
        render(); Home.render();
      });
      box.appendChild(item);
    });
  }

  /* ---------- 节奏建议 ---------- */
  function renderPace() {
    const cfg = Store.getCfg();
    const nowMin = Store.minOfDay(Store.nowHM());
    const wake = Store.minOfDay(cfg.wake), sleep = Store.minOfDay(cfg.sleep);
    const span = Math.max(60, sleep - wake);
    const interval = span / cfg.goalCups; // 分钟/杯
    const milestones = []; // 第 i 杯应喝时间点(min)
    for (let i = 1; i <= cfg.goalCups; i++) milestones.push(wake + interval * i);

    const total = Store.totalMl(day);
    const actual = cupsOf(total); // 可能带 .5
    let ideal = 0;
    milestones.forEach(m => { if (m <= nowMin) ideal++; });
    if (nowMin < wake) ideal = 0;

    const behind = actual < ideal;
    const ahead = actual > ideal + 0.5;
    const warn = behind || (!done() && nowMin > wake + span * 0.6 && actual < ideal + 0.4);
    function done() { return total >= cfg.goalCups * cfg.cupMl; }

    let statusHtml, statusClass;
    if (done()) { statusClass = 'pace-good'; statusHtml = '🎉 今日目标已完成，记得保持匀速补充'; }
    else if (behind) { statusClass = 'pace-warn'; statusHtml = '⏳ 节奏偏慢，落后约 ' + cupsStr((ideal - actual) * cfg.cupMl) + ' 杯，起来走走喝一杯吧 🚶💦'; }
    else if (ahead) { statusClass = 'pace-good'; statusHtml = '🚀 进度超前，继续保持！'; }
    else { statusClass = 'pace-good'; statusHtml = '👍 节奏不错，继续保持'; }

    // 下一杯建议时间
    let next = '';
    if (!done()) {
      let found = null;
      for (let i = 0; i < milestones.length; i++) {
        if (milestones[i] > nowMin) { found = milestones[i]; break; }
      }
      if (found !== null) {
        const hh = Math.floor(found / 60), mm = Math.round(found % 60);
        next = '建议在 <b>' + Store.pad(hh) + ':' + Store.pad(mm) + '</b> 前喝下一杯';
      } else {
        next = '目标时段已过，请尽快补足剩余 ' + cupsStr((cfg.goalCups * cfg.cupMl - total)) + ' 杯';
      }
    }

    $id('paceCard').innerHTML =
      '<div class="pace-line"><span>⏱ 推荐节奏</span><b>全天 ' + cfg.goalCups + ' 杯</b></div>' +
      '<div class="pace-line"><span>清醒时段</span><b>' + cfg.wake + ' – ' + cfg.sleep + '</b></div>' +
      '<div class="pace-line"><span>平均间隔</span><b>约 ' + Math.round(interval) + ' 分钟/杯</b></div>' +
      '<div class="pace-line"><span>此刻应喝 / 已喝</span><b>' + ideal + ' / ' + cupsStr(total) + ' 杯</b></div>' +
      '<div class="pace-line"><span>节奏评价</span><span class="' + statusClass + '">' + statusHtml + '</span></div>' +
      (next ? '<div class="pace-line"><span>下一杯</span><span>' + next + '</span></div>' : '');

    $id('statSpeed').textContent =
      nowMin < wake ? '未开始' : (behind ? '偏慢' : (ahead ? '超前' : '正常'));
  }

  /* ---------- 历史柱状图 ---------- */
  function renderChart() {
    const data = Store.lastNDays(chartDays).map(d => ({
      label: d.date,
      value: d.total,
      goal: d.goal
    }));
    drawBarChart($id('weekChart'), data, Store.goalMl());
    $id('rangeBtn').textContent = chartDays === 7 ? '查看近 30 天' : '查看近 7 天';
    $id('rangeBtn').dataset.range = chartDays;
  }

  /* ---------- 打卡动作 ---------- */
  function addCup(ml, msg) {
    Store.addDrink(day, ml);
    const total = Store.totalMl(day);
    if (total >= Store.goalMl()) {
      toast('🎉 干得漂亮！今日目标已完成（' + cupsStr(total) + ' / ' + Store.getCfg().goalCups + ' 杯）', 'ok', 3200);
      playChime();
    } else {
      toast(msg || ('已记录 ' + cupsStr(ml) + ' 杯 💦'));
    }
    render(); Home.render();
  }
  function undo() {
    const list = Store.entries(day);
    if (!list.length) { toast('今天还没有记录哦', 'warn'); return; }
    Store.removeAt(day, list.length - 1);
    toast('已撤销上一条（' + list[list.length - 1].ml + ' ml）', 'warn');
    render(); Home.render();
  }

  /* ---------- 设置弹层 ---------- */
  function openSettings() {
    const cfg = Store.getCfg();
    $id('goalInput').value = cfg.goalCups;
    $id('cupInput').value = cfg.cupMl;
    $id('soundSw').checked = cfg.sound;
    $id('notifySw').checked = cfg.notify;
    updateMlPreview();
    updateNotifyState();
    renderReminders();
    openModal();
  }
  function updateMlPreview() {
    const goal = Math.max(1, parseInt($id('goalInput').value || '0', 10) || 1);
    const cup = Math.max(50, parseInt($id('cupInput').value || '0', 10) || 250);
    $id('goalMlPreview').textContent = '全天合计约 ' + (goal * cup) + ' ml（约 ' + (goal * cup / 1000).toFixed(1) + ' L）';
  }
  function applyGoalCups() {
    const v = Math.max(1, Math.min(30, parseInt($id('goalInput').value || '0', 10) || 1));
    $id('goalInput').value = v;
    Store.setCfg({ goalCups: v });
    updateMlPreview(); afterCfgChange();
  }
  function applyCupMl() {
    const v = Math.max(50, Math.min(1000, parseInt($id('cupInput').value || '0', 10) || 250));
    $id('cupInput').value = v;
    Store.setCfg({ cupMl: v });
    updateMlPreview(); afterCfgChange();
  }
  function afterCfgChange() {
    render(); Home.render();
    if (!$id('settingsModal').classList.contains('hidden')) updateMlPreview();
  }
  function updateNotifyState() {
    const el = $id('notifyState');
    if (!notifySupported()) el.textContent = '当前浏览器不支持系统通知。';
    else if (Notification.permission === 'granted') el.textContent = '✅ 已授权，喝水到点会弹出系统通知。';
    else if (Notification.permission === 'denied') el.textContent = '⚠️ 通知已被拒绝，请在浏览器地址栏图标处重新开启。';
    else el.textContent = '浏览器通知尚未授权（可选）。';
  }
  function renderReminders() {
    const cfg = Store.getCfg();
    const box = $id('reminderList');
    box.innerHTML = '';
    cfg.reminders.forEach((r, i) => {
      const row = document.createElement('div');
      row.className = 'rem-item' + (r.on ? '' : ' off');
      row.innerHTML =
        '<input class="rem-time-input" type="time" value="' + esc(r.t) + '" aria-label="提醒时间">' +
        '<label class="switch"><input type="checkbox"' + (r.on ? ' checked' : '') + '><span class="slider"></span></label>' +
        '<button class="rem-del" type="button" title="删除该提醒">✕</button>';
      const timeInput = row.querySelector('.rem-time-input');
      const sw = row.querySelector('input[type=checkbox]');
      timeInput.addEventListener('change', () => {
        if (!timeInput.value) return;
        const dup = cfg.reminders.some((x, j) => x.t === timeInput.value && j !== i);
        if (dup) { toast('该时间已存在', 'warn'); timeInput.value = r.t; return; }
        r.t = timeInput.value;
        Store.setCfg({ reminders: cfg.reminders });
        toast('提醒时间已更新为 ' + r.t);
      });
      sw.addEventListener('change', () => {
        r.on = sw.checked;
        Store.setCfg({ reminders: cfg.reminders });
        row.classList.toggle('off', !r.on);
        toast(r.on ? '提醒已开启' : '提醒已关闭', 'warn');
      });
      row.querySelector('.rem-del').addEventListener('click', () => {
        cfg.reminders.splice(i, 1);
        Store.setCfg({ reminders: cfg.reminders });
        renderReminders(); toast('已删除提醒', 'warn');
      });
      box.appendChild(row);
    });
  }

  /* ---------- 事件绑定（页面加载时调用一次） ---------- */
  function bind() {
    $id('addCupBtn').addEventListener('click', () => addCup(Store.getCfg().cupMl, '已记录 1 杯 💦'));
    $id('addHalfBtn').addEventListener('click', () => addCup(Store.getCfg().cupMl / 2, '已记录 半杯 💦'));
    $id('undoBtn').addEventListener('click', undo);

    $id('waterSettingsBtn').addEventListener('click', openSettings);
    $id('modalCloseBtn').addEventListener('click', closeModal);
    $id('settingsModal').addEventListener('click', e => { if (e.target === $id('settingsModal')) closeModal(); });

    // 目标/杯量 stepper
    $$('#settingsModal .stepper button').forEach(b => {
      b.addEventListener('click', () => {
        const inp = b.parentElement.querySelector('input');
        const delta = parseInt(b.dataset.step, 10);
        const cur = parseInt(inp.value || '0', 10) || (inp.id === 'goalInput' ? 8 : 250);
        inp.value = cur + delta;
        if (inp.id === 'goalInput') applyGoalCups(); else applyCupMl();
      });
    });
    $id('goalInput').addEventListener('change', applyGoalCups);
    $id('goalInput').addEventListener('input', updateMlPreview);
    $id('cupInput').addEventListener('change', applyCupMl);
    $id('cupInput').addEventListener('input', updateMlPreview);

    $id('addReminderBtn').addEventListener('click', () => {
      const cfg = Store.getCfg();
      const used = cfg.reminders.map(r => Store.minOfDay(r.t));
      let t = '12:00';
      for (let h = 8; h <= 22; h += 2) { if (used.indexOf(h * 60) < 0) { t = Store.pad(h) + ':00'; break; } }
      cfg.reminders.push({ t: t, on: true });
      Store.setCfg({ reminders: cfg.reminders });
      renderReminders();
      toast('已添加 ' + t + ' 的提醒');
    });

    $id('soundSw').addEventListener('change', e => Store.setCfg({ sound: e.target.checked }));
    $id('notifySw').addEventListener('change', async e => {
      if (e.target.checked && !notifyGranted()) {
        const r = await requestNotify();
        if (r !== 'granted') { e.target.checked = false; toast('未获得通知权限', 'warn'); }
        updateNotifyState();
      }
      Store.setCfg({ notify: e.target.checked });
    });
    $id('grantBtn').addEventListener('click', async () => {
      const r = await requestNotify();
      if (r === 'granted') {
        toast('✅ 通知已授权');
        Store.setCfg({ notify: true });
        $id('notifySw').checked = true;
        sendNotify('工作台 · 喝水监督', '通知已开启，之后到点会提醒你喝水 💧');
      } else toast(r === 'denied' ? '通知被拒绝，请在浏览器设置中开启' : '当前环境不支持通知', 'warn');
      updateNotifyState();
    });

    $id('rangeBtn').addEventListener('click', () => {
      chartDays = chartDays === 7 ? 30 : 7;
      renderChart();
    });

    $id('clearTodayBtn').addEventListener('click', () => {
      if (confirm('确定清空今天的全部喝水记录吗？')) {
        Store.clearDay(day);
        toast('已清空今天的记录', 'warn');
        render(); Home.render(); closeModal();
      }
    });

    // ---- 数据备份：导出 ----
    $id('exportBtn').addEventListener('click', () => {
      try {
        const payload = {
          app: 'ww-workbench',
          version: 1,
          exportedAt: new Date().toISOString(),
          data: Store.exportAll()
        };
        const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = '喝水工作台备份_' + Store.todayStr() + '.json';
        document.body.appendChild(a);
        a.click();
        a.remove();
        setTimeout(() => URL.revokeObjectURL(url), 3000);
        toast('✅ 备份已导出，请妥善保存该 JSON 文件');
      } catch (e) {
        toast('导出失败：' + e.message, 'warn');
      }
    });

    // ---- 数据备份：导入 ----
    $id('importBtn').addEventListener('click', () => $id('importFile').click());
    $id('importFile').addEventListener('change', e => {
      const file = e.target.files && e.target.files[0];
      e.target.value = ''; // 允许重复选择同一文件
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        try {
          const obj = JSON.parse(reader.result);
          if (!obj || typeof obj !== 'object' || !obj.data || typeof obj.data !== 'object') {
            throw new Error('不是有效的工作台备份文件');
          }
          const nCfg = Object.keys(obj.data).length;
          if (!confirm('导入将覆盖当前全部数据（' + nCfg + ' 项），确定继续吗？')) return;
          Store.importAll(obj.data);
          day = Store.todayStr();
          closeModal();
          render(); Home.render();
          toast('✅ 数据导入成功', 'ok', 2600);
          setTimeout(() => openSettings(), 260);
        } catch (err) {
          toast('导入失败：' + err.message, 'warn');
        }
      };
      reader.readAsText(file);
    });

    $id('resetAllBtn').addEventListener('click', () => {
      if (confirm('确定重置全部数据吗？所有打卡记录、目标与闹钟设置都将清空，且无法恢复！')) {
        Store.clearAll();
        day = Store.todayStr();
        toast('已重置全部数据', 'warn');
        openSettings(); // 重新读取默认
        render(); Home.render();
      }
    });

    // 弹层内回车不触发默认提交
    document.addEventListener('keydown', e => { if (e.key === 'Escape') closeModal(); });
  }

  return {
    bind: bind,
    render: render,
    addCup: addCup,
    undo: undo,
    openSettings: openSettings,
    get day() { return day; },
    refreshDay: function () { const t = Store.todayStr(); if (t !== day) { day = t; return true; } return false; }
  };
})();
