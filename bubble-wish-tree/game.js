/* ============================================================
   泡泡愿望树 · 作业大冒险
   核心循环：戳泡泡 → 开花 → 浇水/晒太阳 → 结果 → 摘果 → 兑换奖励
   ============================================================ */
'use strict';

/* ---------------- 工具 ---------------- */
const $ = (s) => document.querySelector(s);
const uid = () => Math.random().toString(36).slice(2, 9);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const rand = (a, b) => a + Math.random() * (b - a);
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
const pad = (n) => String(n).padStart(2, '0');
function dayKey(d = new Date()) { return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; }
function shiftDay(key, n) { const d = new Date(key + 'T12:00:00'); d.setDate(d.getDate() + n); return dayKey(d); }
function daysBetween(a, b) { return Math.round((new Date(b + 'T12:00:00') - new Date(a + 'T12:00:00')) / 86400000); }

/* ---------------- 配置 ---------------- */
const SUBJECTS = {
  语文: { emoji: '📖', color: '#ff6b9d', deep: '#e64980', petal: ['#ff9ebb', '#f06595'], tint: 'rgba(255,107,157,.50)' },
  数学: { emoji: '🔢', color: '#4dabf7', deep: '#339af0', petal: ['#a5d8ff', '#5c9df5'], tint: 'rgba(77,171,247,.50)' },
  英语: { emoji: '🔤', color: '#9775fa', deep: '#845ef7', petal: ['#d0bfff', '#9775fa'], tint: 'rgba(151,117,250,.50)' },
};
const ECON = { sunPerStar: 2, waterBase: 1, need: 3, magicCost: 10, goal: 3, goalBonus: 2, comboWindow: 4000, comboEvery: 3 };
const TREE_LV = [10, 25]; // 累计戳泡升级阈值
const SLOTS = [
  [105, 105], [165, 62], [245, 58], [318, 88], [352, 142], [78, 158],
  [132, 138], [205, 108], [282, 128], [338, 192], [98, 208], [172, 182],
  [252, 178], [300, 232], [140, 238], [222, 232],
];
const SAVE_KEY = 'bubble-wish-tree-v1';

/* ---------------- 存档 ---------------- */
function seedState() {
  const today = dayKey();
  const yest = shiftDay(today, -1);
  const T = (id, subject, name, stars, enabled) => ({ id, subject, name, stars, enabled });
  return {
    v: 1, day: today, lastVisit: today, lastPopDay: yest, streak: 2,
    sun: 8, water: 4, fruits: 1,
    totalPops: 6, totalBlooms: 5, totalFruits: 2, totalRedeems: 0,
    doneToday: [], goalBonusGiven: false, sound: true, tutorialSeen: false,
    tasks: [
      T('t1', '语文', '单课预习', 1, true),
      T('t2', '语文', '看拼音写字', 1, true),
      T('t3', '语文', '日积月累·背诵', 2, true),
      T('t4', '语文', '看图写话', 3, true),
      T('t5', '数学', '每日三道题', 1, true),
      T('t6', '数学', '课堂内容巩固', 2, true),
      T('t7', '英语', '每日单词', 1, true),
      T('t8', '英语', '背三句话', 2, true),
      T('t9', '语文', '单课复习', 2, false),
      T('t10', '语文', '单元复习', 3, false),
      T('t11', '语文', '日积月累·默写', 3, false),
      T('t12', '英语', 'Workbook 练习', 2, false),
      T('t13', '英语', '默写三句话', 3, false),
      T('t14', '英语', '写一篇小作文', 3, false),
    ],
    flowers: [
      { id: 'f1', slot: 2, subject: '语文', golden: false, growth: 1, need: ECON.need },
      { id: 'f2', slot: 7, subject: '数学', golden: false, growth: 2, need: ECON.need },
      { id: 'f3', slot: 11, subject: '英语', golden: true, growth: 3, need: ECON.need },
    ],
    rewards: [
      { id: 'r1', emoji: '🍦', name: '冰淇淋一个', cost: 2, redeemed: 0 },
      { id: 'r2', emoji: '📺', name: '动画片加时 20 分钟', cost: 1, redeemed: 0 },
      { id: 'r3', emoji: '📖', name: '妈妈多讲 2 个睡前故事', cost: 1, redeemed: 0 },
      { id: 'r4', emoji: '🎨', name: '一套新画笔', cost: 5, redeemed: 0 },
      { id: 'r5', emoji: '🧸', name: '心愿小玩具', cost: 8, redeemed: 0 },
      { id: 'r6', emoji: '🎡', name: '周末游乐园大冒险', cost: 12, redeemed: 0 },
    ],
    diary: [
      { t: new Date(yest + 'T19:12:00').getTime(), icon: '🍎', text: '摘下了 1 个金果，真甜！' },
      { t: new Date(yest + 'T19:02:00').getTime(), icon: '🌸', text: '「背三句话」开出了英语小花' },
      { t: new Date(yest + 'T18:55:00').getTime(), icon: '🫧', text: '戳破了「每日单词」泡泡' },
    ],
  };
}
let state;
function loadState() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    state = raw ? JSON.parse(raw) : seedState();
    if (!state || state.v !== 1 || !Array.isArray(state.tasks)) state = seedState();
  } catch (e) { state = seedState(); }
}
let saveTimer = null;
function save() {
  state.lastVisit = dayKey();
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    try { localStorage.setItem(SAVE_KEY, JSON.stringify(state)); } catch (e) { /* 隐私模式下仅内存存档 */ }
  }, 120);
}

/* ---------------- 音效（WebAudio 全合成，无外部资源） ---------------- */
const AudioSys = {
  ctx: null, master: null, sfx: null, music: null, nextNote: 0, noteIdx: 0,
  melody: [76, 79, 81, 79, 76, 74, 76, 0, 72, 74, 76, 79, 76, 74, 72, 0],
  ensure() {
    if (!this.ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return false;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = state.sound ? 0.9 : 0;
      this.master.connect(this.ctx.destination);
      this.sfx = this.ctx.createGain(); this.sfx.gain.value = 0.55; this.sfx.connect(this.master);
      this.music = this.ctx.createGain(); this.music.gain.value = 0.16; this.music.connect(this.master);
      this.nextNote = this.ctx.currentTime + 0.1;
      setInterval(() => this.scheduleMusic(), 200);
    }
    if (this.ctx.state === 'suspended') this.ctx.resume();
    return true;
  },
  setSound(on) { if (this.master) this.master.gain.linearRampToValueAtTime(on ? 0.9 : 0, this.ctx.currentTime + 0.15); },
  midi(m) { return 440 * Math.pow(2, (m - 69) / 12); },
  tone(freq, t, dur, type = 'sine', vol = 0.3, dest = null, slideTo = null) {
    const o = this.ctx.createOscillator(), g = this.ctx.createGain();
    o.type = type; o.frequency.setValueAtTime(freq, t);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(vol, t + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(dest || this.sfx);
    o.start(t); o.stop(t + dur + 0.05);
  },
  noise(t, dur, vol = 0.3, freq = 1800) {
    const len = Math.floor(this.ctx.sampleRate * dur);
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = this.ctx.createBufferSource(); src.buffer = buf;
    const f = this.ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = freq; f.Q.value = 0.8;
    const g = this.ctx.createGain(); g.gain.value = vol;
    src.connect(f); f.connect(g); g.connect(this.sfx);
    src.start(t);
  },
  scheduleMusic() {
    if (!this.ctx || this.ctx.state !== 'running') return;
    const ahead = this.ctx.currentTime + 0.6;
    while (this.nextNote < ahead) {
      const m = this.melody[this.noteIdx % this.melody.length];
      if (m) {
        this.tone(this.midi(m), this.nextNote, 1.4, 'sine', 0.5, this.music);
        this.tone(this.midi(m) * 2, this.nextNote, 0.7, 'sine', 0.12, this.music);
        if (this.noteIdx % 8 === 0) this.tone(this.midi(m - 12), this.nextNote, 2.2, 'triangle', 0.18, this.music);
      }
      this.noteIdx++; this.nextNote += 0.42;
    }
  },
  play(fn) { if (!state.sound || !this.ctx || this.ctx.state !== 'running') return; fn(this.ctx.currentTime); },
  pop() { this.play((t) => { this.noise(t, 0.09, 0.5, 2400); this.tone(520, t, 0.13, 'triangle', 0.4, null, 170); }); },
  bloom() { this.play((t) => [72, 76, 79, 84].forEach((m, i) => this.tone(this.midi(m), t + i * 0.07, 0.9, 'sine', 0.22))); },
  ripen() { this.play((t) => [79, 84, 88].forEach((m, i) => this.tone(this.midi(m), t + i * 0.08, 0.8, 'sine', 0.24))); },
  water() { this.play((t) => { this.tone(880, t, 0.1, 'sine', 0.25, null, 430); this.tone(660, t + 0.1, 0.12, 'sine', 0.2, null, 330); }); },
  pick() { this.play((t) => { this.tone(620, t, 0.12, 'triangle', 0.32, null, 990); this.tone(1320, t + 0.09, 0.25, 'sine', 0.18); }); },
  reward() { this.play((t) => [72, 76, 79, 84, 88].forEach((m, i) => this.tone(this.midi(m), t + i * 0.09, 0.7, 'triangle', 0.26))); },
  magic() { this.play((t) => { this.tone(300, t, 0.55, 'sine', 0.22, null, 1400); [84, 88, 91, 96].forEach((m, i) => this.tone(this.midi(m), t + 0.15 + i * 0.08, 0.8, 'sine', 0.16)); }); },
  levelup() { this.play((t) => [72, 76, 79, 84, 88, 91].forEach((m, i) => this.tone(this.midi(m), t + i * 0.08, 0.9, 'triangle', 0.24))); },
  click() { this.play((t) => this.tone(1150, t, 0.045, 'sine', 0.12)); },
};

/* ---------------- 粒子画布 ---------------- */
const FX = {
  cv: $('#fx'), ctx: null, dpr: 1, w: 0, h: 0, parts: [], petalTimer: 0, sparkTimer: 0,
  init() { this.ctx = this.cv.getContext('2d'); this.resize(); },
  resize() {
    this.dpr = Math.min(2, window.devicePixelRatio || 1);
    this.w = innerWidth; this.h = innerHeight;
    this.cv.width = this.w * this.dpr; this.cv.height = this.h * this.dpr;
    this.cv.style.width = this.w + 'px'; this.cv.style.height = this.h + 'px';
    this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
  },
  add(p) { if (this.parts.length < 560) this.parts.push(p); },
  burst(x, y, color) {
    this.add({ kind: 'ring', x, y, age: 0, life: 0.38, r0: 8, r1: 74, color });
    for (let i = 0; i < 16; i++) {
      const a = (i / 16) * Math.PI * 2 + rand(-0.2, 0.2), sp = rand(130, 330);
      this.add({ kind: 'shard', x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 60, age: 0, life: rand(0.45, 0.8), r: rand(2.5, 5.5), color: i % 3 ? color : '#ffffff' });
    }
    this.sparkle(x, y, 6, '#fff3c4');
  },
  sparkle(x, y, n = 6, color = '#ffe082') {
    for (let i = 0; i < n; i++) this.add({ kind: 'spark', x: x + rand(-26, 26), y: y + rand(-26, 26), vx: rand(-14, 14), vy: rand(-34, -8), age: 0, life: rand(0.5, 0.9), r: rand(3, 7), color, ph: rand(0, 6) });
  },
  droplets(x, y) {
    for (let i = 0; i < 8; i++) this.add({ kind: 'drop', x: x + rand(-22, 22), y: y - rand(34, 60), vx: rand(-8, 8), vy: rand(30, 80), age: 0, life: rand(0.4, 0.6), r: rand(2.5, 4.5) });
  },
  petals(x, y, n = 8) {
    for (let i = 0; i < n; i++) this.add({ kind: 'petal', x: x + rand(-14, 14), y: y + rand(-10, 10), vx: rand(-26, 26), vy: rand(24, 60), age: 0, life: rand(1.6, 2.6), rot: rand(0, 6.3), vr: rand(-3, 3), ph: rand(0, 6), color: pick(['#ffb3cd', '#ffc9de', '#ffe3ee']) });
  },
  confetti(x, y) {
    const colors = ['#ff6b9d', '#4dabf7', '#ffd54a', '#51cf66', '#9775fa', '#ff922b'];
    for (let i = 0; i < 70; i++) this.add({ kind: 'conf', x: x + rand(-30, 30), y, vx: rand(-270, 270), vy: rand(-390, -90), age: 0, life: rand(1.5, 2.4), rot: rand(0, 6.3), vr: rand(-9, 9), color: pick(colors), w: rand(5, 8), h: rand(8, 13) });
  },
  orb(x, y, tx, ty, color, r, dur, onDone) {
    this.add({ kind: 'orb', x0: x, y0: y, cx: (x + tx) / 2 + rand(-40, 40), cy: Math.min(y, ty) - rand(70, 130), x1: tx, y1: ty, x, y, t: 0, dur, color, r, onDone, trail: [], age: 0, life: dur + 0.2 });
  },
  flyTo(x, y, el, color, r = 7) {
    const b = el.getBoundingClientRect();
    this.orb(x, y, b.left + b.width / 2, b.top + b.height / 2, color, r, 0.85, () => bump(el));
  },
  seedFly(x, y, tx, ty, onDone) { this.orb(x, y, tx, ty, '#ffe082', 8, 0.95, onDone); },
  setFireflies(on) {
    this.parts = this.parts.filter((p) => p.kind !== 'firefly');
    if (on) for (let i = 0; i < 9; i++) this.add({ kind: 'firefly', x: rand(0.08, 0.92) * this.w, y: rand(0.3, 0.8) * this.h, ph: rand(0, 9), age: 0, life: 1e9 });
  },
  update(dt, t) {
    // 环境花瓣
    this.petalTimer += dt;
    if (this.petalTimer > 2.7 && document.body.dataset.daypart !== 'night') {
      this.petalTimer = 0;
      const tr = $('#tree-wrap').getBoundingClientRect();
      this.add({ kind: 'petal', x: tr.left + rand(0.2, 0.8) * tr.width, y: tr.top + rand(0.1, 0.4) * tr.height, vx: rand(-22, 22), vy: rand(22, 46), age: 0, life: rand(3, 4.5), rot: rand(0, 6.3), vr: rand(-2, 2), ph: rand(0, 6), color: pick(['#ffb3cd', '#ffffff', '#ffc9de']) });
    }
    // 成熟果实闪微光
    this.sparkTimer += dt;
    if (this.sparkTimer > 1.9) {
      this.sparkTimer = 0;
      const ripe = state.flowers.filter((f) => f.growth >= f.need);
      if (ripe.length) { const p = Flowers.screenPos(pick(ripe)); this.sparkle(p.x, p.y, 2); }
    }
    for (const p of this.parts) {
      p.age += dt;
      switch (p.kind) {
        case 'shard': p.vy += 320 * dt; p.x += p.vx * dt; p.y += p.vy * dt; break;
        case 'spark': p.x += p.vx * dt; p.y += p.vy * dt; break;
        case 'drop': p.vy += 520 * dt; p.x += p.vx * dt; p.y += p.vy * dt; break;
        case 'petal': p.x += (p.vx + Math.sin(t * 2 + p.ph) * 22) * dt; p.y += p.vy * dt; p.rot += p.vr * dt; break;
        case 'conf': p.vy += 640 * dt; p.vx *= 0.99; p.x += p.vx * dt; p.y += p.vy * dt; p.rot += p.vr * dt; break;
        case 'orb': {
          p.t = Math.min(1, p.t + dt / p.dur);
          const u = 1 - p.t;
          p.x = u * u * p.x0 + 2 * u * p.t * p.cx + p.t * p.t * p.x1;
          p.y = u * u * p.y0 + 2 * u * p.t * p.cy + p.t * p.t * p.y1;
          p.trail.push({ x: p.x, y: p.y }); if (p.trail.length > 7) p.trail.shift();
          if (p.t >= 1 && !p.done) { p.done = true; p.age = p.life = 1; if (p.onDone) p.onDone(); }
          break;
        }
        case 'firefly': p.x += Math.sin(t * 0.6 + p.ph) * 0.5; p.y += Math.cos(t * 0.45 + p.ph * 1.3) * 0.35; break;
      }
    }
    this.parts = this.parts.filter((p) => p.kind === 'firefly' ? document.body.dataset.daypart === 'night' : p.age < p.life);
  },
  draw(t) {
    const c = this.ctx;
    c.clearRect(0, 0, this.w, this.h);
    for (const p of this.parts) {
      const k = 1 - p.age / p.life;
      switch (p.kind) {
        case 'ring': {
          const r = p.r0 + (p.r1 - p.r0) * (p.age / p.life);
          c.globalAlpha = k * 0.8; c.strokeStyle = p.color; c.lineWidth = 3.5 * k + 0.5;
          c.beginPath(); c.arc(p.x, p.y, r, 0, 6.3); c.stroke(); break;
        }
        case 'shard': c.globalAlpha = k; c.fillStyle = p.color; c.beginPath(); c.arc(p.x, p.y, p.r * k + 0.6, 0, 6.3); c.fill(); break;
        case 'spark': {
          c.globalAlpha = k * (0.6 + 0.4 * Math.sin(t * 14 + p.ph)); c.fillStyle = p.color;
          const r = p.r;
          c.beginPath();
          c.moveTo(p.x, p.y - r); c.quadraticCurveTo(p.x, p.y, p.x + r, p.y); c.quadraticCurveTo(p.x, p.y, p.x, p.y + r); c.quadraticCurveTo(p.x, p.y, p.x - r, p.y); c.quadraticCurveTo(p.x, p.y, p.x, p.y - r);
          c.fill(); break;
        }
        case 'drop': c.globalAlpha = k; c.fillStyle = '#74c0fc'; c.beginPath(); c.ellipse(p.x, p.y, p.r * 0.7, p.r, 0, 0, 6.3); c.fill(); break;
        case 'petal': {
          c.globalAlpha = Math.min(1, k * 2.2) * 0.9; c.fillStyle = p.color;
          c.save(); c.translate(p.x, p.y); c.rotate(p.rot);
          c.beginPath(); c.ellipse(0, 0, 7, 4, 0, 0, 6.3); c.fill(); c.restore(); break;
        }
        case 'conf': c.globalAlpha = Math.min(1, k * 2); c.fillStyle = p.color; c.save(); c.translate(p.x, p.y); c.rotate(p.rot); c.fillRect(-p.w / 2, -p.h / 2, p.w, p.h); c.restore(); break;
        case 'orb': {
          for (let i = 0; i < p.trail.length; i++) {
            const tr = p.trail[i];
            c.globalAlpha = (i / p.trail.length) * 0.35; c.fillStyle = p.color;
            c.beginPath(); c.arc(tr.x, tr.y, p.r * (i / p.trail.length) * 0.8, 0, 6.3); c.fill();
          }
          c.globalAlpha = 1;
          const g = c.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.r * 2.6);
          g.addColorStop(0, '#ffffff'); g.addColorStop(0.35, p.color); g.addColorStop(1, 'rgba(255,224,138,0)');
          c.fillStyle = g; c.beginPath(); c.arc(p.x, p.y, p.r * 2.6, 0, 6.3); c.fill();
          break;
        }
        case 'firefly': {
          const a = 0.35 + 0.3 * Math.sin(t * 2.2 + p.ph);
          const g = c.createRadialGradient(p.x, p.y, 0, p.x, p.y, 9);
          g.addColorStop(0, `rgba(255,240,160,${a})`); g.addColorStop(1, 'rgba(255,240,160,0)');
          c.globalAlpha = 1; c.fillStyle = g; c.beginPath(); c.arc(p.x, p.y, 9, 0, 6.3); c.fill();
          break;
        }
      }
    }
    c.globalAlpha = 1;
  },
};

/* ---------------- 通用 UI ---------------- */
function toast(msg) {
  const box = $('#toasts');
  while (box.children.length >= 3) box.firstChild.remove();
  const el = document.createElement('div');
  el.className = 'toast'; el.textContent = msg;
  box.appendChild(el);
  setTimeout(() => el.remove(), 3000);
}
function floatText(x, y, text) {
  const el = document.createElement('div');
  el.className = 'float-text'; el.textContent = text;
  el.style.left = x + 'px'; el.style.top = y + 'px';
  $('#float-texts').appendChild(el);
  setTimeout(() => el.remove(), 1200);
}
function bump(el) { el.classList.remove('bump'); void el.offsetWidth; el.classList.add('bump'); }
function showLayer(el) { el.hidden = false; requestAnimationFrame(() => requestAnimationFrame(() => el.classList.add('show'))); }
function hideLayer(el) { el.classList.remove('show'); setTimeout(() => { if (!el.classList.contains('show')) el.hidden = true; }, 430); }
function openScrim() { showLayer($('#scrim')); }
function closeScrim() { hideLayer($('#scrim')); }

let currentTaskId = null, currentFlowerId = null, parentUnlocked = false;
const drawers = ['shop', 'diary', 'parent'];
function anyDrawerOpen() { return drawers.some((id) => !$('#' + id).hidden); }
function closeAllLayers() {
  hideLayer($('#task-sheet')); currentTaskId = null;
  drawers.forEach((id) => hideLayer($('#' + id)));
  $('#flower-pop').hidden = true; currentFlowerId = null;
  closeScrim();
}

/* ---------------- HUD / 目标 ---------------- */
function treeLevel() { return state.totalPops >= TREE_LV[1] ? 3 : state.totalPops >= TREE_LV[0] ? 2 : 1; }
function updateHUD() {
  $('#sun-val').textContent = state.sun;
  $('#water-val').textContent = state.water;
  $('#fruit-val').textContent = state.fruits;
  $('#streak-val').textContent = state.streak;
  $('#shop-badge').textContent = state.fruits;
  $('#shop-fruit').textContent = state.fruits;
  $('#btn-magic').classList.toggle('ready', state.sun >= ECON.magicCost);
  const done = state.doneToday.length;
  const dots = $('#goal-dots').children;
  for (let i = 0; i < dots.length; i++) dots[i].classList.toggle('on', i < done);
  $('#goal-text').textContent =
    done >= ECON.goal ? '目标达成！你是勤劳的小蜜蜂 🐝 水滴奖励已发放' :
    done === 0 ? '每完成一项作业，就能戳破一个泡泡哦！' :
    `太棒了！再戳 ${ECON.goal - done} 个泡泡，领取 💧+${ECON.goalBonus} 奖励`;
  const lv = treeLevel();
  document.body.dataset.treeLv = lv;
  $('#tree-progress').textContent = lv >= 3 ? 'MAX' : `${state.totalPops}/${TREE_LV[lv - 1]}`;
}

/* ---------------- 泡泡 ---------------- */
const Bubbles = {
  list: [],
  activeTasks() {
    const today = dayKey();
    return state.tasks.filter((t) => t.enabled && !state.doneToday.includes(t.id) && t.skipUntil !== today);
  },
  build() {
    $('#bubble-layer').innerHTML = '';
    this.list = [];
    for (const task of this.activeTasks()) {
      const sub = SUBJECTS[task.subject];
      const el = document.createElement('button');
      el.className = 'bubble';
      el.style.setProperty('--tint', sub.tint);
      el.setAttribute('aria-label', `${task.subject}作业：${task.name}`);
      el.innerHTML = `<span class="bubble-in"><span class="b-emoji">${sub.emoji}</span><span class="b-name">${task.name}</span><span class="b-stars">${'⭐'.repeat(task.stars)}</span></span>`;
      el.addEventListener('click', () => { AudioSys.click(); openTaskSheet(task.id); });
      $('#bubble-layer').appendChild(el);
      this.list.push({ id: task.id, task, el, ax: 0, ay: 0, x: 0, y: 0, size: 100, phase: rand(0, 6.3), spd: rand(0.5, 0.9), ampX: rand(8, 15), ampY: rand(10, 17), popping: false, popT: 0, bying: false, byeT: 0 });
    }
    this.layout();
  },
  layout() {
    const W = innerWidth, H = innerHeight, mobile = W < 760;
    const tr = $('#tree-wrap').getBoundingClientRect();
    const zones = mobile
      ? [{ x0: 0.02, x1: 0.30, y0: 0.19, y1: 0.40 }, { x0: 0.70, x1: 0.98, y0: 0.19, y1: 0.40 }, { x0: 0.31, x1: 0.69, y0: 0.18, y1: 0.26 }, { x0: 0.31, x1: 0.69, y0: 0.30, y1: 0.40 }]
      : [{ x0: 0.03, x1: 0.25, y0: 0.16, y1: 0.72 }, { x0: 0.75, x1: 0.97, y0: 0.16, y1: 0.72 }, { x0: 0.28, x1: 0.72, y0: 0.13, y1: 0.27 }];
    const forbidden = [
      { x: tr.left + tr.width * 0.08, y: tr.top - 10, w: tr.width * 0.84, h: tr.height * 0.78 },
      { x: 0, y: 0, w: W, h: mobile ? 96 : 66 },
      { x: 0, y: H - (mobile ? 96 : 108), w: W, h: mobile ? 96 : 108 },
    ];
    if (mobile) forbidden.push({ x: 0, y: 92, w: W, h: 52 });
    else forbidden.push({ x: 0, y: H - 150, w: 280, h: 150 });
    const sizes = mobile ? [64, 76, 88] : [96, 112, 128];
    this.list.forEach((b, i) => {
      b.size = sizes[b.task.stars - 1] || 96;
      b.el.style.setProperty('--size', b.size + 'px');
      const z = zones[i % zones.length];
      const r = b.size / 2;
      b.ax = rand(z.x0 * W + r, z.x1 * W - r);
      b.ay = rand(z.y0 * H + r, z.y1 * H - r);
      b.r = r;
    });
    // 松弛：互相推开 + 避开树与界面
    for (let it = 0; it < 46; it++) {
      for (let i = 0; i < this.list.length; i++) {
        const a = this.list[i];
        for (let j = i + 1; j < this.list.length; j++) {
          const b = this.list[j];
          let dx = b.ax - a.ax, dy = b.ay - a.ay;
          let d = Math.hypot(dx, dy) || 1;
          const min = a.r + b.r + 12;
          if (d < min) {
            const push = (min - d) / 2 / d;
            a.ax -= dx * push; a.ay -= dy * push;
            b.ax += dx * push; b.ay += dy * push;
          }
        }
        for (const f of forbidden) {
          const cx = clamp(a.ax, f.x, f.x + f.w), cy = clamp(a.ay, f.y, f.y + f.h);
          const dx = a.ax - cx, dy = a.ay - cy, d = Math.hypot(dx, dy);
          if (d < a.r + 6) {
            if (d > 0.01) { a.ax = cx + (dx / d) * (a.r + 6); a.ay = cy + (dy / d) * (a.r + 6); }
            else { a.ay = f.y - a.r - 6; }
          }
        }
        a.ax = clamp(a.ax, a.r + 26, W - a.r - 26);
        a.ay = clamp(a.ay, a.r + 26, H - a.r - 26);
      }
    }
  },
  update(t, dt) {
    for (const b of this.list) {
      if (b.popping) {
        b.popT += dt;
        const k = Math.min(1, b.popT / 0.22);
        const s = 1 + 0.5 * (1 - Math.pow(1 - k, 3));
        b.el.style.opacity = String(1 - k);
        b.el.style.transform = `translate3d(${b.x - b.r}px,${b.y - b.r}px,0) scale(${s})`;
        if (k >= 1) { b.el.remove(); b.dead = true; }
        continue;
      }
      if (b.bying) {
        b.byeT += dt;
        const k = Math.min(1, b.byeT / 0.6);
        b.el.style.opacity = String(1 - k);
        b.el.style.transform = `translate3d(${b.x - b.r}px,${b.y - b.r - 130 * k * k}px,0) scale(${1 - 0.4 * k})`;
        if (k >= 1) { b.el.remove(); b.dead = true; }
        continue;
      }
      b.x = b.ax + Math.sin(t * b.spd + b.phase) * b.ampX + Math.sin(t * 0.21 + b.phase * 1.7) * 6;
      b.y = b.ay + Math.cos(t * b.spd * 0.9 + b.phase) * b.ampY + Math.cos(t * 0.17 + b.phase) * 5;
      b.el.style.transform = `translate3d(${b.x - b.r}px,${b.y - b.r}px,0)`;
    }
    this.list = this.list.filter((b) => !b.dead);
  },
  get(id) { return this.list.find((b) => b.id === id); },
};

/* ---------------- 蝴蝶 ---------------- */
const Butterflies = {
  els: [1, 2].map((n) => {
    let el = document.querySelector('.butterfly.b' + n);
    if (!el) {
      el = document.createElement('span');
      el.className = 'butterfly b' + n;
      el.setAttribute('aria-hidden', 'true');
      el.textContent = n === 1 ? '🦋' : '🐝';
      document.body.appendChild(el);
    }
    return el;
  }),
  cfg: [{ rx: 0.30, ry: 0.16, sp: 0.35, ph: 0 }, { rx: 0.38, ry: 0.22, sp: 0.27, ph: 2.4 }],
  update(t) {
    const W = innerWidth, H = innerHeight;
    this.els.forEach((el, i) => {
      const c = this.cfg[i];
      const x = W * 0.5 + Math.sin(t * c.sp + c.ph) * W * c.rx;
      const y = H * 0.34 + Math.cos(t * c.sp * 1.3 + c.ph) * H * c.ry;
      const dir = Math.cos(t * c.sp + c.ph) > 0 ? 1 : -1;
      el.style.transform = `translate(${x}px,${y}px) scaleX(${dir}) rotate(${Math.sin(t * 2 + c.ph) * 12}deg)`;
    });
  },
};

/* ---------------- 花朵 ---------------- */
const Flowers = {
  els: new Map(),
  build() {
    this.els.clear();
    $('#flower-layer').innerHTML = '';
    state.flowers.forEach((f) => this.createEl(f, false));
  },
  slotPos(slot) {
    const tr = $('#tree-wrap').getBoundingClientRect();
    return { x: tr.left + (SLOTS[slot][0] / 420) * tr.width, y: tr.top + (SLOTS[slot][1] / 480) * tr.height };
  },
  screenPos(f) { return this.slotPos(f.slot); },
  freeSlot() {
    const used = new Set(state.flowers.map((f) => f.slot));
    const free = SLOTS.map((_, i) => i).filter((i) => !used.has(i));
    return free.length ? pick(free) : null;
  },
  createEl(f, born) {
    const sub = SUBJECTS[f.subject];
    const el = document.createElement('button');
    el.className = `flower stage-${Math.min(f.growth, f.need)}${f.golden ? ' golden' : ''}${born ? ' born' : ''}`;
    el.style.left = (SLOTS[f.slot][0] / 420 * 100) + '%';
    el.style.top = (SLOTS[f.slot][1] / 480 * 100) + '%';
    el.style.setProperty('--petal', f.golden ? '#ffe082' : sub.petal[0]);
    el.style.setProperty('--petal-d', f.golden ? '#ffb300' : sub.petal[1]);
    el.dataset.id = f.id;
    el.setAttribute('aria-label', `${f.subject}${f.golden ? '金' : '小'}花`);
    el.innerHTML = '<span class="ripe-halo"></span><span class="petals">' +
      [0, 1, 2, 3, 4, 5].map((i) => `<i style="--i:${i}"></i>`).join('') +
      '</span><span class="center"></span><span class="fruitlet"></span><span class="ripe-fruit"></span>';
    el.addEventListener('click', (e) => { e.stopPropagation(); AudioSys.click(); openFlowerPop(f.id); });
    $('#flower-layer').appendChild(el);
    this.els.set(f.id, el);
    if (born) setTimeout(() => el.classList.remove('born'), 800);
  },
  refresh(f) {
    const el = this.els.get(f.id);
    if (!el) return;
    el.className = `flower stage-${Math.min(f.growth, f.need)}${f.golden ? ' golden' : ''}`;
  },
  add(task, slot) {
    const golden = task.stars === 3;
    const f = { id: uid(), slot, subject: task.subject, golden, growth: 0, need: ECON.need };
    state.flowers.push(f);
    this.createEl(f, true);
    const p = this.screenPos(f);
    FX.sparkle(p.x, p.y, 10, golden ? '#ffe082' : '#ffffff');
    AudioSys.bloom();
    state.totalBlooms++;
    addDiary('🌸', `「${task.name}」开出了${golden ? '一朵金花 ✨' : SUBJECTS[task.subject].emoji + ' ' + task.subject + '小花'}`);
    save();
  },
};
function addDiary(icon, text) {
  state.diary.push({ t: Date.now(), icon, text });
  if (state.diary.length > 120) state.diary = state.diary.slice(-120);
}
function growFlower(f, source) {
  if (f.growth >= f.need) return;
  f.growth++;
  Flowers.refresh(f);
  const p = Flowers.screenPos(f);
  const el = Flowers.els.get(f.id);
  if (el) { el.classList.remove('wiggle'); void el.offsetWidth; el.classList.add('wiggle'); }
  if (f.growth >= f.need) {
    FX.petals(p.x, p.y, 9);
    FX.sparkle(p.x, p.y, 8, f.golden ? '#ffe082' : '#ffc9de');
    AudioSys.ripen();
    toast(`${f.golden ? '✨ 金' : '🌸 '}花结果啦！快去摘果子`);
    addDiary('🌼', `${f.subject}小花结出了${f.golden ? '金果' : '果子'}`);
  } else if (source === 'water') {
    FX.droplets(p.x, p.y);
  } else {
    FX.sparkle(p.x, p.y, 5);
  }
  save(); updateHUD();
}

/* ---------------- 任务卡片 ---------------- */
function openTaskSheet(id) {
  const task = state.tasks.find((t) => t.id === id);
  if (!task) return;
  currentTaskId = id;
  const sub = SUBJECTS[task.subject];
  $('#ts-emoji').textContent = sub.emoji;
  $('#ts-subject').textContent = task.subject;
  $('#ts-subject').style.background = sub.color;
  $('#ts-name').textContent = task.name;
  $('#ts-stars').textContent = '⭐'.repeat(task.stars) + (task.stars === 3 ? ' 挑战' : task.stars === 2 ? ' 巩固' : ' 基础');
  const sun = task.stars * ECON.sunPerStar, water = ECON.waterBase + (task.stars === 3 ? 1 : 0);
  $('#ts-reward').textContent = `完成可得：☀️+${sun}  💧+${water}  ·  树上开出${task.stars === 3 ? '✨金花' : sub.emoji + ' ' + task.subject + '小花'}`;
  $('#ts-note').textContent = task.stars === 3 ? '挑战任务会结出金果，一个顶两个果实哦！' : '认真做完作业，再来戳破它吧～';
  showLayer($('#task-sheet')); openScrim();
}
function popCurrentTask() {
  const task = state.tasks.find((t) => t.id === currentTaskId);
  const b = task && Bubbles.get(task.id);
  if (!task || !b || b.popping) return;
  hideLayer($('#task-sheet')); closeScrim(); currentTaskId = null;
  b.popping = true;
  const x = b.x, y = b.y;
  const sub = SUBJECTS[task.subject];
  AudioSys.pop();
  FX.burst(x, y, sub.color);
  state.doneToday.push(task.id);

  const sunGain = task.stars * ECON.sunPerStar;
  const waterGain = ECON.waterBase + (task.stars === 3 ? 1 : 0);
  state.sun += sunGain; state.water += waterGain;
  FX.flyTo(x, y, $('#pill-sun'), '#ffd54a');
  FX.flyTo(x, y + 12, $('#pill-water'), '#74c0fc');
  floatText(x, y - b.r - 14, `+${sunGain}☀️  +${waterGain}💧`);

  // 连续天数
  const today = dayKey();
  if (state.lastPopDay !== today) {
    state.streak = state.lastPopDay === shiftDay(today, -1) ? state.streak + 1 : 1;
    state.lastPopDay = today;
    if (state.streak > 1) toast(`🔥 连续 ${state.streak} 天完成作业，太厉害了！`);
  }
  // 连击
  const now = Date.now();
  state.combo = (now - (state.lastPopAt || 0) < ECON.comboWindow) ? (state.combo || 0) + 1 : 1;
  state.lastPopAt = now;
  if (state.combo > 1) floatText(x, y - b.r - 44, `连击 ×${state.combo}!`);
  if (state.combo % ECON.comboEvery === 0) {
    state.water += 1;
    toast(`⚡ ${ECON.comboEvery} 连击！奖励 💧+1`);
    FX.flyTo(x, y, $('#pill-water'), '#74c0fc');
  }
  // 今日目标
  if (state.doneToday.length === ECON.goal && !state.goalBonusGiven) {
    state.goalBonusGiven = true;
    state.water += ECON.goalBonus;
    setTimeout(() => { toast(`🎯 今日目标达成！奖励 💧+${ECON.goalBonus}`); FX.confetti(innerWidth * 0.2, innerHeight * 0.7); }, 600);
  }
  state.totalPops++;
  addDiary('🫧', `戳破了「${task.name}」泡泡`);

  // 升级
  const lvBefore = document.body.dataset.treeLv;
  updateHUD();
  if (document.body.dataset.treeLv !== lvBefore) {
    AudioSys.levelup();
    FX.confetti(innerWidth / 2, innerHeight * 0.3);
    toast('🌳 愿望树升级啦！长得更茂盛了');
    addDiary('🌳', `愿望树升到了 ${document.body.dataset.treeLv} 级`);
  }
  // 种子飞向树冠
  const slot = Flowers.freeSlot();
  if (slot !== null) {
    const p = Flowers.slotPos(slot);
    FX.seedFly(x, y, p.x, p.y, () => Flowers.add(task, slot));
  } else {
    state.sun += 2;
    toast('树冠开满花啦！种子变成 ☀️+2，先摘些果子吧');
  }
  save(); updateHUD();
}
function postponeCurrentTask() {
  const task = state.tasks.find((t) => t.id === currentTaskId);
  if (!task) return;
  task.skipUntil = shiftDay(dayKey(), 1);
  const b = Bubbles.get(task.id);
  if (b) b.bying = true;
  hideLayer($('#task-sheet')); closeScrim(); currentTaskId = null;
  toast('🌙 泡泡去睡觉啦，明天见！');
  save();
}

/* ---------------- 小花弹窗 ---------------- */
function openFlowerPop(id) {
  const f = state.flowers.find((fl) => fl.id === id);
  if (!f) return;
  currentFlowerId = id;
  renderFlowerPop(f);
  const pop = $('#flower-pop');
  pop.hidden = false;
  const p = Flowers.screenPos(f);
  const W = innerWidth, H = innerHeight;
  const pw = 230, ph = 215;
  let left = clamp(p.x - pw / 2, 8, W - pw - 8);
  let top = p.y - ph - 26;
  if (top < 8) top = clamp(p.y + 30, 8, H - ph - 8);
  pop.style.left = left + 'px'; pop.style.top = top + 'px';
}
function renderFlowerPop(f) {
  const ripe = f.growth >= f.need;
  $('#fp-title').textContent = `${SUBJECTS[f.subject].emoji} ${f.subject}${f.golden ? '金花 ✨' : '小花'}`;
  $('#fp-desc').textContent = ripe
    ? (f.golden ? '金果成熟啦！摘下它值 2 个果实 🍎🍎' : '果子成熟啦！摘下来去换礼物吧')
    : `再照顾 ${f.need - f.growth} 次就能结果！浇水或等它慢慢长大（每天 +1）`;
  const dots = $('#fp-dots').children;
  for (let i = 0; i < dots.length; i++) dots[i].classList.toggle('on', i < f.growth);
  const waterBtn = $('#fp-water'), pickBtn = $('#fp-pick');
  waterBtn.hidden = ripe; pickBtn.hidden = !ripe;
  if (!ripe) {
    waterBtn.disabled = state.water < 1;
    waterBtn.textContent = state.water < 1 ? '💧 没有水滴啦，去做作业吧' : `💧 浇水长大（有 ${state.water} 滴）`;
  } else {
    pickBtn.textContent = f.golden ? '✨ 摘下金果 +2🍎' : '🍎 摘下果子 +1';
  }
}
function waterCurrentFlower() {
  const f = state.flowers.find((fl) => fl.id === currentFlowerId);
  if (!f || f.growth >= f.need || state.water < 1) return;
  state.water--;
  AudioSys.water();
  growFlower(f, 'water');
  renderFlowerPop(f);
}
function pickCurrentFlower() {
  const f = state.flowers.find((fl) => fl.id === currentFlowerId);
  if (!f || f.growth < f.need) return;
  const gain = f.golden ? 2 : 1;
  state.fruits += gain; state.totalFruits++;
  const p = Flowers.screenPos(f);
  AudioSys.pick();
  FX.flyTo(p.x, p.y, $('#pill-fruit'), f.golden ? '#ffd54a' : '#ff6b6b', 9);
  FX.sparkle(p.x, p.y, 8, '#ffe082');
  floatText(p.x, p.y - 30, `+${gain}🍎`);
  addDiary('🍎', `摘下了 ${gain} 个${f.golden ? '金果' : '果子'}`);
  const el = Flowers.els.get(f.id);
  if (el) el.remove();
  Flowers.els.delete(f.id);
  state.flowers = state.flowers.filter((fl) => fl.id !== f.id);
  $('#flower-pop').hidden = true; currentFlowerId = null;
  toast(gain > 1 ? '✨ 金果到手！去愿望商店看看吧' : '🍎 果子到手！去愿望商店看看吧');
  save(); updateHUD();
  if (!$('#shop').hidden) renderShop();
}

/* ---------------- 阳光魔法 ---------------- */
function castMagic() {
  if (state.sun < ECON.magicCost) { toast(`☀️ 阳光不够啦（需要 ${ECON.magicCost}），先戳几个泡泡吧`); return; }
  const growing = state.flowers.filter((f) => f.growth < f.need);
  if (!growing.length) { toast('现在没有需要长大的小花哦 🌸'); return; }
  state.sun -= ECON.magicCost;
  AudioSys.magic();
  const flash = document.createElement('div');
  flash.id = 'magic-flash';
  document.body.appendChild(flash);
  setTimeout(() => flash.remove(), 1200);
  growing.forEach((f, i) => setTimeout(() => growFlower(f, 'magic'), 200 + i * 160));
  addDiary('✨', `施展了阳光魔法，${growing.length} 朵小花一起长大`);
  toast(`✨ 阳光魔法！${growing.length} 朵小花一起长大`);
  save(); updateHUD();
}

/* ---------------- 愿望商店 ---------------- */
function renderShop() {
  $('#shop-fruit').textContent = state.fruits;
  const list = $('#shop-list');
  list.innerHTML = '';
  for (const r of state.rewards) {
    const can = state.fruits >= r.cost;
    const card = document.createElement('div');
    card.className = 'reward-card' + (can ? ' affordable' : '');
    card.innerHTML = `
      ${r.redeemed ? `<span class="r-redeemed">已换 ×${r.redeemed}</span>` : ''}
      <span class="r-emoji">${r.emoji}</span>
      <span class="r-name">${r.name}</span>
      <span class="r-cost">🍎 × ${r.cost}</span>
      <span class="r-bar"><i style="width:${clamp(state.fruits / r.cost * 100, 0, 100)}%"></i></span>
      <button class="r-btn" ${can ? '' : 'disabled'}>${can ? '兑换礼物！' : `还差 ${r.cost - state.fruits} 🍎`}</button>`;
    card.querySelector('.r-btn').addEventListener('click', () => redeem(r.id));
    list.appendChild(card);
  }
}
function redeem(id) {
  const r = state.rewards.find((x) => x.id === id);
  if (!r) return;
  if (state.fruits < r.cost) { toast('🍎 果实还不够，继续加油！'); return; }
  state.fruits -= r.cost; r.redeemed++; state.totalRedeems++;
  AudioSys.reward();
  const head = $('#shop').getBoundingClientRect();
  FX.confetti(head.left + head.width / 2, head.top + 120);
  addDiary('🎁', `兑换了「${r.name}」，快找爸爸妈妈兑现`);
  toast(`🎟️ 兑换成功！把「${r.name}」拿给爸爸妈妈看吧`);
  save(); updateHUD(); renderShop();
}

/* ---------------- 成长日记 ---------------- */
function fmtTime(t) {
  const d = new Date(t), today = dayKey(), yest = shiftDay(today, -1);
  const hm = `${pad(d.getHours())}:${pad(d.getMinutes())}`;
  const k = dayKey(d);
  if (k === today) return `今天 ${hm}`;
  if (k === yest) return `昨天 ${hm}`;
  return `${d.getMonth() + 1}/${d.getDate()} ${hm}`;
}
function renderDiary() {
  $('#diary-stats').innerHTML = [
    [state.totalPops, '🫧 戳泡泡'], [state.totalBlooms, '🌸 开花'],
    [state.totalFruits, '🍎 摘果'], [state.totalRedeems, '🎁 兑换'],
  ].map(([v, l]) => `<div class="stat-cell"><b>${v}</b><span>${l}</span></div>`).join('');
  const list = $('#diary-list');
  list.innerHTML = state.diary.length ? '' : '<div class="diary-empty">还没有记录，去戳第一个泡泡吧 🫧</div>';
  [...state.diary].reverse().slice(0, 60).forEach((d) => {
    const el = document.createElement('div');
    el.className = 'diary-item';
    el.innerHTML = `<span class="d-icon">${d.icon}</span><span class="d-text">${d.text}</span><span class="d-time">${fmtTime(d.t)}</span>`;
    list.appendChild(el);
  });
}

/* ---------------- 家长模式 ---------------- */
let gateAnswer = 0;
function openGate() {
  const a = 6 + Math.floor(Math.random() * 4), b = 6 + Math.floor(Math.random() * 4);
  gateAnswer = a * b;
  $('#gate-q').textContent = `${a} × ${b} = ?`;
  $('#gate-input').value = '';
  $('#gate').hidden = false;
  setTimeout(() => $('#gate-input').focus(), 80);
}
function tryGate() {
  if (parseInt($('#gate-input').value, 10) === gateAnswer) {
    parentUnlocked = true;
    $('#gate').hidden = true;
    openDrawer('parent');
  } else {
    const card = $('.gate-card');
    card.classList.remove('shake'); void card.offsetWidth; card.classList.add('shake');
    openGate();
  }
}
function renderParent() {
  const doneNames = state.doneToday.map((id) => (state.tasks.find((t) => t.id === id) || {}).name).filter(Boolean);
  $('#parent-overview').innerHTML = `
    <span class="ov-chip">今日完成 <b>${doneNames.length}</b> 项</span>
    <span class="ov-chip">☀️ <b>${state.sun}</b></span>
    <span class="ov-chip">💧 <b>${state.water}</b></span>
    <span class="ov-chip">🍎 <b>${state.fruits}</b></span>
    <span class="ov-chip">🔥 连续 <b>${state.streak}</b> 天</span>
    ${doneNames.length ? `<span class="ov-chip">已完成：${doneNames.join('、')}</span>` : ''}`;
  const list = $('#task-list');
  list.innerHTML = '';
  for (const subName of Object.keys(SUBJECTS)) {
    const tasks = state.tasks.filter((t) => t.subject === subName);
    if (!tasks.length) continue;
    const group = document.createElement('div');
    group.className = 'task-group';
    group.innerHTML = `<div class="task-group-title">${SUBJECTS[subName].emoji} ${subName}</div>`;
    for (const t of tasks) {
      const row = document.createElement('div');
      row.className = 'task-row' + (t.enabled ? '' : ' disabled');
      row.innerHTML = `
        <span class="t-emoji">${SUBJECTS[subName].emoji}</span>
        <span class="t-name">${t.name}${state.doneToday.includes(t.id) ? ' <span class="t-done">今日已完成</span>' : ''}</span>
        <select class="row-select stars" aria-label="难度">${[1, 2, 3].map((s) => `<option value="${s}" ${s === t.stars ? 'selected' : ''}>${'⭐'.repeat(s)}</option>`).join('')}</select>
        <label class="switch" title="启用/停用"><input type="checkbox" ${t.enabled ? 'checked' : ''}><i></i></label>
        <button class="row-del" title="删除">🗑</button>`;
      row.querySelector('.stars').addEventListener('change', (e) => { t.stars = +e.target.value; save(); Bubbles.build(); });
      row.querySelector('input[type=checkbox]').addEventListener('change', (e) => { t.enabled = e.target.checked; save(); Bubbles.build(); renderParent(); });
      row.querySelector('.row-del').addEventListener('click', () => {
        if (!confirm(`删除作业「${t.name}」？`)) return;
        state.tasks = state.tasks.filter((x) => x.id !== t.id);
        state.doneToday = state.doneToday.filter((x) => x !== t.id);
        save(); Bubbles.build(); renderParent();
      });
      group.appendChild(row);
    }
    list.appendChild(group);
  }
  const rl = $('#reward-list');
  rl.innerHTML = '';
  for (const r of state.rewards) {
    const row = document.createElement('div');
    row.className = 'reward-row';
    row.innerHTML = `
      <span class="t-emoji">${r.emoji}</span>
      <input class="rw-name-edit" type="text" maxlength="16" value="${r.name}" aria-label="奖励名称">
      <input class="rw-cost-edit" type="number" min="1" max="99" value="${r.cost}" aria-label="所需果实">
      <span style="font-size:12px;color:var(--ink-soft)">🍎</span>
      <button class="row-del" title="删除">🗑</button>`;
    row.querySelector('.rw-name-edit').addEventListener('change', (e) => { r.name = e.target.value.trim() || r.name; e.target.value = r.name; save(); });
    row.querySelector('.rw-cost-edit').addEventListener('change', (e) => { r.cost = clamp(parseInt(e.target.value, 10) || 1, 1, 99); e.target.value = r.cost; save(); });
    row.querySelector('.row-del').addEventListener('click', () => {
      if (!confirm(`删除奖励「${r.name}」？`)) return;
      state.rewards = state.rewards.filter((x) => x.id !== r.id);
      save(); renderParent();
    });
    rl.appendChild(row);
  }
}

/* ---------------- 抽屉管理 ---------------- */
function openDrawer(id) {
  drawers.forEach((d) => { if (d !== id) hideLayer($('#' + d)); });
  hideLayer($('#task-sheet'));
  if (id === 'shop') renderShop();
  if (id === 'diary') renderDiary();
  if (id === 'parent') renderParent();
  showLayer($('#' + id));
  openScrim();
}

/* ---------------- 昼夜与日期 ---------------- */
function setDaypart() {
  const h = new Date().getHours();
  const part = h >= 5 && h < 10 ? 'morning' : h < 16 ? 'day' : h < 19 ? 'dusk' : 'night';
  if (document.body.dataset.daypart !== part) {
    document.body.dataset.daypart = part;
    FX.setFireflies(part === 'night');
  }
}
function checkDay() {
  const today = dayKey();
  if (state.day === today) return;
  const away = clamp(daysBetween(state.lastVisit || state.day, today), 0, 3);
  if (away > 0) {
    let grown = 0;
    state.flowers.forEach((f) => { if (f.growth < f.need) { f.growth = Math.min(f.need, f.growth + away); grown++; } });
    if (grown) setTimeout(() => toast(`🌱 你不在的时候，${grown} 朵小花悄悄长大啦`), 900);
  }
  state.day = today;
  state.doneToday = []; state.goalBonusGiven = false;
  state.tasks.forEach((t) => { if (t.skipUntil && t.skipUntil <= today) delete t.skipUntil; });
  Bubbles.build(); Flowers.build(); updateHUD(); save();
}

/* ---------------- 事件绑定 ---------------- */
function bindEvents() {
  document.addEventListener('pointerdown', () => AudioSys.ensure(), { once: true });
  $('#ts-close').addEventListener('click', () => { hideLayer($('#task-sheet')); closeScrim(); currentTaskId = null; });
  $('#ts-pop').addEventListener('click', popCurrentTask);
  $('#ts-later').addEventListener('click', postponeCurrentTask);
  $('#fp-close').addEventListener('click', () => { $('#flower-pop').hidden = true; currentFlowerId = null; });
  $('#fp-water').addEventListener('click', waterCurrentFlower);
  $('#fp-pick').addEventListener('click', pickCurrentFlower);
  $('#btn-magic').addEventListener('click', castMagic);
  $('#btn-shop').addEventListener('click', () => { AudioSys.click(); openDrawer('shop'); });
  $('#btn-diary').addEventListener('click', () => { AudioSys.click(); openDrawer('diary'); });
  $('#btn-parent').addEventListener('click', () => { AudioSys.click(); parentUnlocked ? openDrawer('parent') : openGate(); });
  $('#btn-help').addEventListener('click', () => { $('#tutorial').hidden = false; });
  $('#btn-sound').addEventListener('click', () => {
    state.sound = !state.sound;
    AudioSys.ensure(); AudioSys.setSound(state.sound);
    $('#btn-sound').textContent = state.sound ? '🔊' : '🔇';
    if (state.sound) AudioSys.click();
    save();
  });
  document.querySelectorAll('[data-close]').forEach((btn) => btn.addEventListener('click', () => { hideLayer($('#' + btn.dataset.close)); closeScrim(); }));
  $('#scrim').addEventListener('click', closeAllLayers);
  $('#gate-ok').addEventListener('click', tryGate);
  $('#gate-input').addEventListener('keydown', (e) => { if (e.key === 'Enter') tryGate(); });
  $('#gate-cancel').addEventListener('click', () => { $('#gate').hidden = true; });
  $('#tut-start').addEventListener('click', () => { state.tutorialSeen = true; save(); $('#tutorial').hidden = true; AudioSys.ensure(); AudioSys.reward(); });
  $('#add-task').addEventListener('click', () => {
    const name = $('#add-name').value.trim();
    if (!name) { toast('先给作业起个名字吧'); return; }
    state.tasks.push({ id: uid(), subject: $('#add-subject').value, name, stars: +$('#add-stars').value, enabled: true });
    $('#add-name').value = '';
    save(); Bubbles.build(); renderParent();
    toast(`🫧 新泡泡「${name}」飞上天啦`);
  });
  $('#add-reward').addEventListener('click', () => {
    const name = $('#rw-name').value.trim();
    if (!name) { toast('先给奖励起个名字吧'); return; }
    state.rewards.push({ id: uid(), emoji: $('#rw-emoji').value.trim() || '🎁', name, cost: clamp(parseInt($('#rw-cost').value, 10) || 3, 1, 99), redeemed: 0 });
    $('#rw-name').value = ''; $('#rw-emoji').value = '';
    save(); renderParent();
    toast(`🎁 新奖励「${name}」上架啦`);
  });
  $('#btn-export').addEventListener('click', () => {
    const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `愿望树备份-${dayKey()}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
    toast('⬇️ 备份已下载');
  });
  $('#btn-reset').addEventListener('click', () => {
    if (!confirm('确定要清空所有进度，重新开始吗？')) return;
    if (!confirm('再想一下哦：花朵、果实、日记都会消失！真的重新开始？')) return;
    try { localStorage.removeItem(SAVE_KEY); } catch (e) {}
    location.reload();
  });
  document.addEventListener('pointerdown', (e) => {
    const pop = $('#flower-pop');
    if (!pop.hidden && !pop.contains(e.target) && !e.target.closest('.flower')) { pop.hidden = true; currentFlowerId = null; }
  });
  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    if (!$('#gate').hidden) { $('#gate').hidden = true; return; }
    if (!$('#tutorial').hidden && state.tutorialSeen) { $('#tutorial').hidden = true; return; }
    closeAllLayers();
  });
  window.addEventListener('resize', () => { FX.resize(); Bubbles.layout(); });
  document.addEventListener('visibilitychange', () => { if (document.hidden) save(); });
  window.addEventListener('beforeunload', save);
}

/* ---------------- 主循环 ---------------- */
let lastFrame = performance.now();
function frame(now) {
  const dt = Math.min(0.05, (now - lastFrame) / 1000);
  lastFrame = now;
  const t = now / 1000;
  Bubbles.update(t, dt);
  Butterflies.update(t);
  FX.update(dt, t);
  FX.draw(t);
  requestAnimationFrame(frame);
}

/* ---------------- 启动 ---------------- */
function init() {
  loadState();
  setDaypart();
  FX.init();
  FX.setFireflies(document.body.dataset.daypart === 'night');
  checkDay();
  Bubbles.build();
  Flowers.build();
  updateHUD();
  $('#btn-sound').textContent = state.sound ? '🔊' : '🔇';
  bindEvents();
  if (!state.tutorialSeen) setTimeout(() => { if (!state.tutorialSeen) $('#tutorial').hidden = false; }, 600);
  setInterval(() => { setDaypart(); checkDay(); }, 30000);
  requestAnimationFrame(frame);
}
init();