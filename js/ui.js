/* ================= UI 基础组件 ================= */
'use strict';

const $ = sel => document.querySelector(sel);
const $$ = sel => Array.prototype.slice.call(document.querySelectorAll(sel));

function esc(s) {
  return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

/* ---------- Toast ---------- */
function toast(msg, type, ms) {
  const root = $('#toastRoot');
  const el = document.createElement('div');
  el.className = 'toast' + (type ? ' ' + type : '');
  el.textContent = msg;
  root.appendChild(el);
  setTimeout(() => { el.style.opacity = '0'; el.style.transition = 'opacity .4s'; }, (ms || 2200) - 400);
  setTimeout(() => el.remove(), ms || 2200);
}

/* ---------- 环形进度 ---------- */
const RING_R = 86, RING_C = 2 * Math.PI * RING_R;
function renderRing(pct, totalText) {
  const fg = $('#ringFg');
  const p = Math.max(0, Math.min(1, pct));
  fg.style.strokeDasharray = RING_C;
  fg.style.strokeDashoffset = RING_C * (1 - p);
  fg.classList.toggle('complete', p >= 1);
  $('#ringPct').textContent = Math.round(p * 100) + '%';
  if (totalText !== undefined) $('#ringTotal').textContent = totalText;
}

/* ---------- 柱状图（Canvas） ---------- */
// data: [{label, value}]  goal 常量目标线
function drawBarChart(canvas, data, goal) {
  const dpr = window.devicePixelRatio || 1;
  const w = canvas.clientWidth || canvas.parentElement.clientWidth || 600;
  const h = canvas.clientHeight || 190;
  canvas.width = w * dpr; canvas.height = h * dpr;
  canvas.style.width = w + 'px'; canvas.style.height = h + 'px';
  const ctx = canvas.getContext('2d');
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, w, h);

  const padL = 6, padR = 6, padT = 12, padB = 20;
  const n = data.length;
  const maxV = Math.max(goal * 1.08, ...data.map(d => d.value), 10);
  const plotW = w - padL - padR, plotH = h - padT - padB;
  const slot = plotW / n;
  const barW = Math.min(24, slot * 0.6);
  const yOf = v => padT + plotH * (1 - v / maxV);

  // 目标虚线
  const gy = yOf(goal);
  ctx.strokeStyle = '#f59e0b'; ctx.setLineDash([5, 4]); ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.moveTo(padL, gy); ctx.lineTo(w - padR, gy); ctx.stroke();
  ctx.setLineDash([]);
  // 小刻度线
  ctx.fillStyle = '#94a3b8'; ctx.font = '10px sans-serif'; ctx.textAlign = 'right';
  ctx.fillText(Math.round(goal / Store.getCfg().cupMl) + '杯', w - padR - 2, gy - 4);

  data.forEach((d, i) => {
    const cx = padL + slot * i + slot / 2;
    const val = d.value || 0;
    if (val > 0) {
      const bh = Math.max(2, yOf(0) - yOf(val));
      const grad = ctx.createLinearGradient(0, yOf(val), 0, yOf(0));
      grad.addColorStop(0, '#38bdf8'); grad.addColorStop(1, '#2563eb');
      ctx.fillStyle = grad;
      roundRect(ctx, cx - barW / 2, yOf(val), barW, bh, 3); ctx.fill();
    }
    // 标签
    ctx.fillStyle = '#94a3b8'; ctx.textAlign = 'center'; ctx.font = '10px sans-serif';
    const every = n > 15 ? 2 : 1;
    if (i % every === 0 || i === n - 1) {
      const short = d.label.length >= 5 ? d.label.slice(5) : d.label; // 'MM-DD'
      ctx.fillText(short, cx, h - 6);
    }
  });
  function roundRect(c, x, y, ww, hh, r) {
    r = Math.min(r, ww / 2, hh / 2);
    c.beginPath();
    c.moveTo(x + r, y);
    c.arcTo(x + ww, y, x + ww, y + hh, r);
    c.arcTo(x + ww, y + hh, x, y + hh, r);
    c.arcTo(x, y + hh, x, y, r);
    c.arcTo(x, y, x + ww, y, r);
    c.closePath();
  }
}

/* ---------- 提示音（WebAudio 三连音） ---------- */
let _actx = null;
function ensureAudio() {
  try {
    if (!_actx) _actx = new (window.AudioContext || window.webkitAudioContext)();
    if (_actx.state === 'suspended') _actx.resume();
    return _actx;
  } catch (e) { return null; }
}
function playChime() {
  const ctx = ensureAudio(); if (!ctx) return;
  const notes = [523.25, 659.25, 783.99, 1046.5]; // C5 E5 G5 C6
  const t0 = ctx.currentTime;
  notes.forEach((f, i) => {
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = 'sine'; o.frequency.value = f;
    const t = t0 + i * 0.18;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.4, t + 0.03);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.5);
    o.connect(g); g.connect(ctx.destination);
    o.start(t); o.stop(t + 0.55);
  });
  // 气泡音
  try {
    const o2 = ctx.createOscillator(), g2 = ctx.createGain();
    o2.type = 'triangle'; o2.frequency.setValueAtTime(300, t0 + 0.8);
    o2.frequency.exponentialRampToValueAtTime(700, t0 + 1.05);
    g2.gain.setValueAtTime(0.0001, t0 + 0.8);
    g2.gain.exponentialRampToValueAtTime(0.25, t0 + 0.85);
    g2.gain.exponentialRampToValueAtTime(0.0001, t0 + 1.1);
    o2.connect(g2); g2.connect(ctx.destination);
    o2.start(t0 + 0.8); o2.stop(t0 + 1.15);
  } catch (e) { }
}

/* ---------- 浏览器通知 ---------- */
function notifySupported() { return 'Notification' in window; }
function notifyGranted() { return notifySupported() && Notification.permission === 'granted'; }
function requestNotify() {
  return new Promise(res => {
    if (!notifySupported()) { res('unsupported'); return; }
    if (Notification.permission === 'granted') { res('granted'); return; }
    if (Notification.permission === 'denied') { res('denied'); return; }
    Notification.requestPermission().then(p => res(p));
  });
}
function sendNotify(title, body) {
  try {
    if (!notifyGranted()) return false;
    const n = new Notification(title, { body: body, icon: 'icons/icon-192.png', badge: 'icons/icon-192.png' });
    n.onclick = function () { window.focus(); this.close(); };
    setTimeout(() => { try { n.close(); } catch (e) { } }, 20000);
    return true;
  } catch (e) { return false; }
}

/* ---------- 弹层 ---------- */
function openModal() { $('#settingsModal').classList.remove('hidden'); document.body.style.overflow = 'hidden'; }
function closeModal() { $('#settingsModal').classList.add('hidden'); document.body.style.overflow = ''; }
function modalOpen() { return !$('#settingsModal').classList.contains('hidden'); }
