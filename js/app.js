/* ================= 主入口：导航 / 调度 / 提醒 ================= */
'use strict';

const APP_VERSION = 'v1.3.2'; // 页面加载后显示在顶栏/右下角，用于判断是否最新代码

const App = (function () {
  let currentView = 'home';

  /* ---------- 视图切换 ---------- */
  function show(view) {
    currentView = view;
    ['home', 'water'].forEach(v => {
      $id('view-' + v).classList.toggle('hidden', v !== view);
    });
    $$('.navtab').forEach(b => b.classList.toggle('active', b.dataset.view === view));
    window.scrollTo({ top: 0 });
    if (view === 'water') Water.render(true);
    if (view === 'home') Home.render();
  }
  const $id = id => document.getElementById(id);

  /* ---------- 全局错误提示（便于发现问题） ---------- */
  function wireGlobalErrors() {
    window.addEventListener('error', e => {
      try { toast('⚠️ 页面出错：' + (e.message || '未知错误'), 'warn', 6000); } catch (_) { }
    });
    window.addEventListener('unhandledrejection', e => {
      try {
        const r = e.reason;
        toast('⚠️ 运行出错：' + (r && r.message ? r.message : String(r)), 'warn', 6000);
      } catch (_) { }
    });
  }

  /* ---------- 闹钟横幅 ---------- */
  const snoozeQueue = []; // {at:number, t:'HH:MM'}
  function hideAlarm() { $id('alarmBanner').classList.add('hidden'); }

  function fireAlarm(t) {
    const cfg = Store.getCfg();
    const s = Store.todayStr();
    const total = Store.totalMl(s);
    const have = Math.min(cfg.goalCups, Math.round(total / cfg.cupMl * 2) / 2);
    const left = Math.max(0, cfg.goalCups - have);
    const base = left > 0
      ? '已完成 ' + (Number.isInteger(have) ? have : have.toFixed(1)) + '/' + cfg.goalCups + ' 杯，还差 ' + (Number.isInteger(left) ? left : left.toFixed(1)) + ' 杯。起身走走，喝口水吧～'
      : '今日目标已达成 🎉 继续保持匀速补水就好。';
    $id('alarmText').textContent = (t ? '（' + t + ' 提醒）' : '') + base;
    $id('alarmBanner').classList.remove('hidden');

    if (cfg.sound) playChime();
    if (navigator.vibrate && document.visibilityState === 'visible') {
      try { navigator.vibrate([200, 120, 200]); } catch (e) { }
    }
    if (cfg.notify) sendNotify('🚰 到点喝水啦！', '已完成 ' + have + '/' + cfg.goalCups + ' 杯，' + (left > 0 ? '还差 ' + left + ' 杯 💧' : '今日目标已达成 🎉'));
  }

  function checkReminders() {
    const cfg = Store.getCfg();
    const s = Store.todayStr();
    const nowMin = Store.minOfDay(Store.nowHM());
    const fired = Store.firedToday(s);
    cfg.reminders.forEach(r => {
      if (!r.on) return;
      if (fired[r.t]) return;
      const rm = Store.minOfDay(r.t);
      const elapsed = nowMin - rm;
      if (elapsed >= 0 && elapsed <= 30) { // 到点，或刚错过 30 分钟内补提醒
        Store.markFired(s, r.t);
        fireAlarm(r.t);
      }
    });
  }
  function checkSnoozes() {
    const now = Date.now();
    for (let i = snoozeQueue.length - 1; i >= 0; i--) {
      if (snoozeQueue[i].at <= now) {
        const q = snoozeQueue.splice(i, 1)[0];
        fireAlarm(q.t);
      }
    }
  }

  function tick() {
    const rolled = Water.refreshDay();
    if (rolled) { hideAlarm(); Home.render(); Water.render(true); }
    checkReminders();
    checkSnoozes();
  }

  /* ---------- 事件绑定 ---------- */
  function bind() {
    $$('.navtab').forEach(b => b.addEventListener('click', () => show(b.dataset.view)));
    $id('brandBtn').addEventListener('click', () => show('home'));

    // 首页模块卡片 -> 跳转
    $id('moduleGrid').addEventListener('click', e => {
      const card = e.target.closest('[data-open]');
      if (card) show(card.dataset.open);
    });

    // 闹钟横幅动作
    $id('alarmDrinkBtn').addEventListener('click', () => {
      Water.addCup(Store.getCfg().cupMl, '已记录 1 杯 💦');
      hideAlarm();
      show('water');
    });
    $id('alarmSnoozeBtn').addEventListener('click', () => {
      const cfg = Store.getCfg();
      const s = Store.todayStr();
      const q = { at: Date.now() + 10 * 60 * 1000, t: '' };
      // 找出最接近的提醒时间作为备注
      const nowMin = Store.minOfDay(Store.nowHM());
      let near = null;
      cfg.reminders.forEach(r => { const m = Store.minOfDay(r.t); if (m >= nowMin && (near === null || m < near)) near = r.t; });
      q.t = near || '';
      snoozeQueue.push(q);
      // 打上“今日已触发”标记，避免 10 分钟后再次被定时器重复触发
      hideAlarm();
      toast('好的，10 分钟后再次提醒你 ⏰');
    });
    $id('alarmCloseBtn').addEventListener('click', hideAlarm);

    // 右上角铃铛：授权系统通知
    $id('bellBtn').addEventListener('click', async () => {
      const cfg = Store.getCfg();
      if (notifySupported() && Notification.permission !== 'granted') {
        const r = await requestNotify();
        if (r === 'granted') {
          Store.setCfg({ notify: true });
          toast('✅ 通知已授权并开启');
          sendNotify('工作台 · 喝水监督', '通知已开启，到点会提醒你喝水 💧');
        } else {
          toast('未获得通知权限，可稍后在 ⚙️ 设置中重试', 'warn');
          Water.openSettings();
        }
      } else {
        Water.openSettings();
      }
    });

    // 首次交互解锁音频
    document.addEventListener('pointerdown', function unlock() {
      ensureAudio();
      document.removeEventListener('pointerdown', unlock);
    });
  }

  /* ---------- 自检模式：?selftest=1 时自动点击打卡按钮并把结果写入标题（便于无头验证/排查） ---------- */
  function selfTest() {
    const out = [];
    try {
      const add = $id('addCupBtn'), half = $id('addHalfBtn'), undo = $id('undoBtn'), gear = $id('waterSettingsBtn');
      if (!add || !half || !undo || !gear) throw new Error('按钮不存在，事件未注册?');
      show('water');                                          // 先切到喝水视图，让 DOM 实时渲染
      add.click(); add.click(); half.click();                 // +1 +1 +半杯 = 2.5 杯
      out.push('statMl=' + $id('statMl').textContent);        // 期望 625 ml
      out.push('ring=' + $id('ringTotal').textContent);       // 期望 2.5 / 8 杯
      out.push('tl=' + document.querySelectorAll('.tl-item').length); // 期望 3
      undo.click();
      out.push('afterUndo=' + document.querySelectorAll('.tl-item').length); // 期望 2
      gear.click();
      out.push('modalOpen=' + !$id('settingsModal').classList.contains('hidden')); // 期望 true
      out.push('chip=' + $id('appVerChip').textContent);
      document.title = 'SELFTEST-OK | ' + out.join(' | ');
    } catch (e) {
      document.title = 'SELFTEST-FAIL | ' + (e && e.message ? e.message : e);
    }
  }

  /* ---------- 启动 ---------- */
  function resetNow() {
    // 网址带 ?reset=1 时：注销所有 Service Worker + 清空缓存，然后干净地重新加载
    const jobs = [];
    if ('serviceWorker' in navigator) {
      jobs.push(navigator.serviceWorker.getRegistrations().then(regs =>
        Promise.all(regs.map(r => r.unregister()))
      ));
    }
    if (window.caches) {
      jobs.push(caches.keys().then(ks => Promise.all(ks.map(k => caches.delete(k)))));
    }
    Promise.all(jobs).then(() => {
      sessionStorage.removeItem('ww_reloaded');
      location.replace(location.pathname); // 去掉 ?reset=1 后重新加载
    });
  }

  function boot() {
    if (location.search.indexOf('reset=1') >= 0) { resetNow(); return; }
    // 顶栏显示当前代码版本（便于判断是否已更新）
    const verEl = document.getElementById('appVer');
    if (verEl) verEl.textContent = ' · ' + APP_VERSION;
    const verChip = document.getElementById('appVerChip');
    if (verChip) verChip.textContent = APP_VERSION;
    wireGlobalErrors();

    bind();
    Water.bind();   // 注册喝水模块的按钮/设置/备份等事件（缺失会导致打卡无反应）
    Home.render();
    show('home');

    if (location.search.indexOf('selftest=1') >= 0) {
      setTimeout(selfTest, 600); // 等渲染稳定后自动跑自检
    }

    // 定时检查 + 跨天 + 可见性恢复
    setInterval(tick, 10 * 1000);
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') tick();
    });
    tick();
    setInterval(() => { // 每分钟刷新一次日期文案/连胜
      if (currentView === 'water') Water.render();
      if (currentView === 'home') Home.render();
    }, 60 * 1000);

    // 旋转/缩放窗口时重绘图表
    let rzT = null;
    window.addEventListener('resize', () => {
      clearTimeout(rzT);
      rzT = setTimeout(() => { if (currentView === 'water') Water.render(true); }, 200);
    });

    registerSW();
  }

  function registerSW() {
    if (!('serviceWorker' in navigator) || location.protocol.indexOf('http') !== 0) return;
    // Service Worker 更新接管后自动刷新一次，保证用户拿到最新版（只自动刷一次，避免死循环；自检模式不刷新）
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (location.search.indexOf('selftest=1') >= 0) return;
      if (!sessionStorage.getItem('ww_reloaded')) {
        sessionStorage.setItem('ww_reloaded', '1');
        location.reload();
      }
    });
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('sw.js').then(reg => {
        console.log('[PWA] ServiceWorker 注册成功', reg.scope);
      }).catch(err => console.warn('[PWA] ServiceWorker 注册失败（需 http/https 环境）', err));
    });
  }

  return { boot: boot, show: show };
})();

document.addEventListener('DOMContentLoaded', App.boot);
