/* ================= 工作台首页（模块注册表 + 渲染） ================= */
'use strict';

/* 模块注册表：以后新增模块只需 push 一个条目（type:'app'）或占位（type:'soon'） */
const MODULES = [
  {
    type: 'app', id: 'water', view: 'water',
    emoji: '💧', name: '喝水监督',
    desc: '每日目标杯数打卡、闹钟提醒、连胜与趋势统计',
    mini: () => {
      const s = Store.todayStr(), cfg = Store.getCfg();
      const total = Store.totalCups(s, cfg.cupMl);
      const done = Store.completed(s);
      const pct = Math.min(100, Math.round(total / cfg.goalCups * 100));
      return { html: '<div class="mini-progress"><i style="width:' + pct + '%"></i></div>', text: done ? '🎉 今日目标已完成！' : '今日 ' + pct + '% · ' + (cfg.goalCups - Math.floor(total)) + ' 杯待喝' };
    }
  },
  { type: 'soon', emoji: '🏃', name: '运动打卡', desc: '敬请期待：跑步 / 健身 / 步数统计' },
  { type: 'soon', emoji: '😴', name: '睡眠监督', desc: '敬请期待：作息提醒与睡眠统计' },
  { type: 'soon', emoji: '✅', name: '待办清单', desc: '敬请期待：今日待办与番茄钟' }
];

const Home = (function () {
  function greet() {
    const h = new Date().getHours();
    if (h < 6) return '夜深了，早点休息 🌙';
    if (h < 9) return '早上好 ☀️';
    if (h < 12) return '上午好 ☀️';
    if (h < 14) return '中午好 🌤️';
    if (h < 18) return '下午好 🌤️';
    if (h < 23) return '晚上好 🌙';
    return '夜深了，注意休息 🌙';
  }

  function render() {
    const d = new Date();
    $('#helloTitle').textContent = greet();
    $('#helloDate').textContent =
      '今天是 ' + d.getFullYear() + ' 年 ' + (d.getMonth() + 1) + ' 月 ' + d.getDate() + ' 日 ' +
      ['周日', '周一', '周二', '周三', '周四', '周五', '周六'][d.getDay()];

    const grid = $('#moduleGrid');
    grid.innerHTML = '';
    MODULES.forEach(m => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'module-card' + (m.type === 'app' ? ' ' + m.id : ' coming');
      if (m.type === 'app') btn.setAttribute('data-open', m.view);
      let mini = '';
      if (m.mini) { const r = m.mini(); mini = '<div style="font-size:12px;color:#5b6b85">' + r.html + '<span style="display:block;margin-top:4px">' + r.text + '</span></div>'; }
      btn.innerHTML =
        '<span class="mc-emoji">' + m.emoji + '</span>' +
        '<h3>' + m.name + '</h3>' +
        '<p>' + m.desc + '</p>' +
        mini +
        (m.type === 'app'
          ? '<span class="mc-go">进入模块 →</span>'
          : '<span class="mc-tag">规划中</span>');
      grid.appendChild(btn);
    });

    const tip = $('#homeTip');
    const cfg = Store.getCfg();
    const onN = cfg.reminders.filter(r => r.on).length;
    tip.innerHTML =
      '💡 <b>小贴士：</b>' +
      '每天 ' + cfg.goalCups + ' 杯 × ' + cfg.cupMl + ' ml = ' + (cfg.goalCups * cfg.cupMl) + ' ml 目标；' +
      '已设置 ' + onN + ' 个提醒闹钟。' +
      (onN === 0 ? '提醒未开启，可在「喝水监督 → ⚙️」中添加闹钟。' : '') +
      '<br>🔔 闹钟在页面打开/驻留时触发；推荐在浏览器菜单把本页「添加到主屏幕」安装为应用（PWA），或让浏览器标签常驻，体验最完整。' +
      '<br>📱 数据只保存在<b>本机浏览器</b>：电脑、手机各自独立、互不影响，无需联网同步；换设备可在 ⚙️ 设置中导出/导入备份。';
  }
  return { render: render };
})();
