// Visual renderer adapted from the supplied lucky-wheel.html. No auth or persistent local data.
import { REWARD_PALETTE, PUNISHMENT_PALETTE, PRESET_POOL, EMOJI_CHOICES, KEYWORD_EMOJIS } from './presets.js?v=1';
import { request, confirmAction, signal } from './bridge.js?v=1';
let state = { mode:'reward', soundOn:true, voiceOn:false, mysteryMode:false, noRepeatMode:false, rewards:[], punishments:[], history:[] };
let revision = 0;
let busy = false;
let animationItems = null;
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
function getCurrentList() { return state.mode === 'reward' ? state.rewards : state.punishments; }
function getActiveItems() { return animationItems || getCurrentList().filter(item => item.enabled && !item.reserved); }
function getPalette() { return state.mode === 'reward' ? REWARD_PALETTE : PUNISHMENT_PALETTE; }
      let audioCtx = null;
      let chargeOsc = null;
      let chargeGain = null;

      function ensureAudio() {
        if (!state.soundOn) return null;
        try {
          if (!audioCtx) {
            const Ctx = window.AudioContext || window.webkitAudioContext;
            if (!Ctx) return null;
            audioCtx = new Ctx();
          }
          if (audioCtx.state === "suspended") {
            audioCtx.resume();
          }
          return audioCtx;
        } catch {
          return null;
        }
      }

      function playTickSound(speed = 10) {
        const ctx = ensureAudio();
        if (!ctx) return;
        const now = ctx.currentTime;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        // Crisp wooden/arcade peg clack
        osc.type = state.mode === "reward" ? "triangle" : "square";
        const baseFreq = state.mode === "reward" ? 680 : 480;
        const freq = baseFreq + Math.min(420, speed * 14);
        osc.frequency.setValueAtTime(freq, now);
        osc.frequency.exponentialRampToValueAtTime(160, now + 0.042);

        const vol = state.mode === "reward" ? 0.14 : 0.09;
        gain.gain.setValueAtTime(vol, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.045);

        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now);
        osc.stop(now + 0.05);
      }

      function playPopSound(freq = 560) {
        const ctx = ensureAudio();
        if (!ctx) return;
        const now = ctx.currentTime;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = "sine";
        osc.frequency.setValueAtTime(freq, now);
        osc.frequency.exponentialRampToValueAtTime(freq * 1.45, now + 0.09);
        gain.gain.setValueAtTime(0.14, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.11);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now);
        osc.stop(now + 0.12);
      }

      function playModeSwitchSound(toMode) {
        const ctx = ensureAudio();
        if (!ctx) return;
        const now = ctx.currentTime;
        const notes = toMode === "reward" ? [523, 659, 784, 1046] : [440, 392, 330, 587];
        notes.forEach((f, idx) => {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = toMode === "reward" ? "triangle" : "sawtooth";
          osc.frequency.setValueAtTime(f, now + idx * 0.055);
          gain.gain.setValueAtTime(0.08, now + idx * 0.055);
          gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.055 + 0.15);
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.start(now + idx * 0.055);
          osc.stop(now + idx * 0.055 + 0.16);
        });
      }

      function startChargeHum() {
        const ctx = ensureAudio();
        if (!ctx || chargeOsc) return;
        const now = ctx.currentTime;
        chargeOsc = ctx.createOscillator();
        chargeGain = ctx.createGain();
        chargeOsc.type = "sawtooth";
        chargeOsc.frequency.setValueAtTime(160, now);
        chargeGain.gain.setValueAtTime(0.001, now);
        chargeGain.gain.linearRampToValueAtTime(0.06, now + 0.15);
        chargeOsc.connect(chargeGain);
        chargeGain.connect(ctx.destination);
        chargeOsc.start(now);
      }

      function updateChargeHum(power) {
        if (!chargeOsc || !audioCtx) return;
        chargeOsc.frequency.setTargetAtTime(160 + power * 520, audioCtx.currentTime, 0.03);
      }

      function stopChargeHum() {
        if (!chargeOsc || !audioCtx) return;
        try {
          const now = audioCtx.currentTime;
          chargeGain.gain.setTargetAtTime(0.0001, now, 0.02);
          chargeOsc.stop(now + 0.06);
        } catch {
          // ignore
        }
        chargeOsc = null;
        chargeGain = null;
      }

      function playLaunchWhoosh(power = 0) {
        const ctx = ensureAudio();
        if (!ctx) return;
        const now = ctx.currentTime;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = "sine";
        osc.frequency.setValueAtTime(220 + power * 180, now);
        osc.frequency.exponentialRampToValueAtTime(760 + power * 300, now + 0.22);
        gain.gain.setValueAtTime(0.16, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.26);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now);
        osc.stop(now + 0.28);
      }

      function playWinFanfare(mode) {
        const ctx = ensureAudio();
        if (!ctx) return;
        const now = ctx.currentTime;
        if (mode === "reward") {
          // Cheerful major arpeggio fanfare
          const seq = [
            { f: 523.25, t: 0, d: 0.14 },
            { f: 659.25, t: 0.1, d: 0.14 },
            { f: 783.99, t: 0.2, d: 0.14 },
            { f: 1046.5, t: 0.32, d: 0.42 },
            { f: 1318.5, t: 0.44, d: 0.45 }
          ];
          seq.forEach(n => {
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.type = "triangle";
            osc.frequency.setValueAtTime(n.f, now + n.t);
            gain.gain.setValueAtTime(0.16, now + n.t);
            gain.gain.exponentialRampToValueAtTime(0.001, now + n.t + n.d);
            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.start(now + n.t);
            osc.stop(now + n.t + n.d + 0.02);
          });
        } else {
          // Playful comical cartoon bounce sting
          const seq = [
            { f: 440, t: 0, d: 0.12, type: "square" },
            { f: 587, t: 0.11, d: 0.12, type: "square" },
            { f: 392, t: 0.24, d: 0.14, type: "sawtooth" },
            { f: 523, t: 0.36, d: 0.18, type: "triangle" }
          ];
          seq.forEach(n => {
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.type = n.type;
            osc.frequency.setValueAtTime(n.f, now + n.t);
            if (n.t === 0.36) {
              osc.frequency.exponentialRampToValueAtTime(880, now + n.t + 0.2);
            }
            gain.gain.setValueAtTime(0.11, now + n.t);
            gain.gain.exponentialRampToValueAtTime(0.001, now + n.t + n.d + 0.05);
            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.start(now + n.t);
            osc.stop(now + n.t + n.d + 0.08);
          });
        }
      }

      function speakText(text) {
        if (!state.voiceOn || !("speechSynthesis" in window)) return;
        try {
          window.speechSynthesis.cancel();
          const utter = new SpeechSynthesisUtterance(text);
          utter.lang = "zh-CN";
          utter.rate = 1.08;
          utter.pitch = 1.25;
          window.speechSynthesis.speak(utter);
        } catch {
          // Speech synthesis unsupported
        }
      }

      // =====================================================
      // 4. DOM References
      // =====================================================
      const bodyEl = document.body;
      const ambientLayer = document.getElementById("ambient-layer");
      const wheelStage = document.getElementById("wheel-stage");
      const wheelCanvas = document.getElementById("wheel-canvas");
      const wheelCtx = wheelCanvas.getContext("2d");
      const confettiCanvas = document.getElementById("confetti-canvas");
      const confettiCtx = confettiCanvas.getContext("2d");

      const mascotAvatar = document.getElementById("mascot-avatar");
      const mascotSpeech = document.getElementById("mascot-speech");
      const capEmoji = document.getElementById("cap-emoji");
      const capLabel = document.getElementById("cap-label");
      const centerBtn = document.getElementById("wheel-center-btn");

      const btnModeReward = document.getElementById("btn-mode-reward");
      const btnModePunishment = document.getElementById("btn-mode-punishment");
      const btnSound = document.getElementById("btn-sound");
      const btnVoice = document.getElementById("btn-voice");
      const btnMainSpin = document.getElementById("btn-main-spin");
      const btnMainSpinText = document.getElementById("btn-main-spin-text");
      const btnMysteryToggle = document.getElementById("btn-mystery-toggle");
      const btnNorepeatToggle = document.getElementById("btn-norepeat-toggle");

      const powerFill = document.getElementById("power-fill");
      const powerPct = document.getElementById("power-pct");
      const powerStatusText = document.getElementById("power-status-text");

      const tabEdit = document.getElementById("tab-edit");
      const tabHistory = document.getElementById("tab-history");
      const viewEdit = document.getElementById("view-edit");
      const viewHistory = document.getElementById("view-history");
      const activeSliceBadge = document.getElementById("active-slice-badge");
      const historyCountBadge = document.getElementById("history-count-badge");

      const addItemForm = document.getElementById("add-item-form");
      const addBoxHeading = document.getElementById("add-box-heading");
      const inputItemName = document.getElementById("input-item-name");
      const btnEmojiPick = document.getElementById("btn-emoji-pick");
      const emojiPopover = document.getElementById("emoji-popover");
      const emojiGrid = document.getElementById("emoji-grid");
      const btnCloseEmoji = document.getElementById("btn-close-emoji");
      const presetChips = document.getElementById("preset-chips");
      const presetsTitle = document.getElementById("presets-title");
      const btnRefreshPresets = document.getElementById("btn-refresh-presets");

      const listStats = document.getElementById("list-stats");
      const itemsList = document.getElementById("items-list");
      const btnShuffle = document.getElementById("btn-shuffle");
      const btnEnableAll = document.getElementById("btn-enable-all");
      const btnResetDefault = document.getElementById("btn-reset-default");

      const historyList = document.getElementById("history-list");
      const statTotalSpins = document.getElementById("stat-total-spins");
      const statTotalRewards = document.getElementById("stat-total-rewards");
      const statTotalPunishments = document.getElementById("stat-total-punishments");
      const btnClearHistory = document.getElementById("btn-clear-history");

      const resultModal = document.getElementById("result-modal");
      const modalBadge = document.getElementById("modal-badge");
      const modalEmoji = document.getElementById("modal-emoji");
      const modalTitle = document.getElementById("modal-title");
      const modalDesc = document.getElementById("modal-desc");
      const modalMeta = document.getElementById("modal-meta");
      const modalBtnDone = document.getElementById("modal-btn-done");
      const modalBtnDoneText = document.getElementById("modal-btn-done-text");
      const modalBtnAgain = document.getElementById("modal-btn-again");

      const toastBox = document.getElementById("toast-box");
      const toastIcon = document.getElementById("toast-icon");
      const toastText = document.getElementById("toast-text");

      let selectedEmoji = "🎁";
      let selectedWeight = 1;
      let presetSeed = 0;
      let editingId = null;
      let editDraft = '';
      let toastTimer = null;
      let lastHistoryEntryId = null;

      function showToast(icon, text) {
        toastIcon.textContent = icon;
        toastText.textContent = text;
        toastBox.classList.add("show");
        clearTimeout(toastTimer);
        toastTimer = setTimeout(() => toastBox.classList.remove("show"), 2600);
      }

      // =====================================================
      // 5. Mascot SVGs & Ambient Decor
      // =====================================================
      function renderMascot(mood = "idle") {
        if (state.mode === "reward") {
          const eyes = mood === "win"
            ? `<text x="34" y="51" font-size="12" text-anchor="middle">⭐</text><text x="66" y="51" font-size="12" text-anchor="middle">⭐</text>`
            : mood === "spin"
            ? `<circle cx="36" cy="48" r="5" fill="#3d243b"/><circle cx="64" cy="48" r="5" fill="#3d243b"/><circle cx="38" cy="46" r="2" fill="#fff"/><circle cx="66" cy="46" r="2" fill="#fff"/>`
            : `<circle cx="36" cy="48" r="4.5" fill="#3d243b"/><circle cx="64" cy="48" r="4.5" fill="#3d243b"/><circle cx="37.5" cy="46.5" r="1.8" fill="#fff"/><circle cx="65.5" cy="46.5" r="1.8" fill="#fff"/>`;
          mascotAvatar.innerHTML = `
            <svg viewBox="0 0 100 100" width="100%" height="100%">
              <!-- Bunny Ears -->
              <ellipse cx="33" cy="22" rx="10" ry="20" transform="rotate(-12 33 22)" fill="#fff" stroke="#ff7a59" stroke-width="3.5"/>
              <ellipse cx="33" cy="23" rx="5" ry="13" transform="rotate(-12 33 23)" fill="#ffb5c2"/>
              <ellipse cx="67" cy="22" rx="10" ry="20" transform="rotate(12 67 22)" fill="#fff" stroke="#ff7a59" stroke-width="3.5"/>
              <ellipse cx="67" cy="23" rx="5" ry="13" transform="rotate(12 67 23)" fill="#ffb5c2"/>
              <!-- Mini Crown -->
              <polygon points="40,26 45,14 50,22 55,14 60,26" fill="#ffb703" stroke="#d98d00" stroke-width="2"/>
              <!-- Face -->
              <circle cx="50" cy="56" r="32" fill="#ffffff" stroke="#ff7a59" stroke-width="3.5"/>
              <!-- Cheeks -->
              <ellipse cx="28" cy="58" rx="6" ry="3.8" fill="#ffb5c2" opacity="0.85"/>
              <ellipse cx="72" cy="58" rx="6" ry="3.8" fill="#ffb5c2" opacity="0.85"/>
              ${eyes}
              <!-- Cute Nose & Smile -->
              <ellipse cx="50" cy="54" rx="3.5" ry="2.5" fill="#ff6b57"/>
              <path d="M43 60 Q50 67 57 60" fill="none" stroke="#3d243b" stroke-width="3" stroke-linecap="round"/>
            </svg>`;
        } else {
          // Cute Mischievous Monster
          const mouth = mood === "win"
            ? `<path d="M35 60 Q50 74 65 60 Z" fill="#ff4791" stroke="#fff" stroke-width="2"/>`
            : `<path d="M37 61 Q50 70 63 61" fill="none" stroke="#00f5d4" stroke-width="3.5" stroke-linecap="round"/>
               <polygon points="41,62 44,68 47,62" fill="#fff"/>
               <polygon points="53,62 56,68 59,62" fill="#fff"/>`;
          mascotAvatar.innerHTML = `
            <svg viewBox="0 0 100 100" width="100%" height="100%">
              <!-- Cute Monster Horns -->
              <path d="M26 36 Q18 14 36 22" fill="#00f5d4" stroke="#1e123b" stroke-width="3"/>
              <path d="M74 36 Q82 14 64 22" fill="#00f5d4" stroke="#1e123b" stroke-width="3"/>
              <!-- Body/Head -->
              <rect x="18" y="24" width="64" height="62" rx="28" fill="#8338ec" stroke="#00f5d4" stroke-width="3.5"/>
              <!-- Eyes -->
              <circle cx="37" cy="48" r="8.5" fill="#fff"/>
              <circle cx="63" cy="48" r="8.5" fill="#fff"/>
              <circle cx="39" cy="48" r="4.5" fill="#1e123b"/>
              <circle cx="61" cy="48" r="4.5" fill="#1e123b"/>
              <circle cx="40.5" cy="46.5" r="1.8" fill="#fff"/>
              <circle cx="62.5" cy="46.5" r="1.8" fill="#fff"/>
              <!-- Cheeks -->
              <circle cx="27" cy="58" r="4.5" fill="#ff4791" opacity="0.7"/>
              <circle cx="73" cy="58" r="4.5" fill="#ff4791" opacity="0.7"/>
              ${mouth}
            </svg>`;
        }
      }

      function populateAmbientDecor() {
        ambientLayer.innerHTML = "";
        const icons = state.mode === "reward"
          ? ["⭐", "✨", "🎈", "🍬", "🌈", "☁️", "🎁", "🍀"]
          : ["⚡", "👾", "💥", "🌟", "🎪", "🌀", "✨", "🔮"];
        for (let i = 0; i < 14; i++) {
          const el = document.createElement("div");
          el.className = "float-shape";
          el.textContent = icons[i % icons.length];
          el.style.left = `${(i * 7.3 + Math.random() * 4) % 96}%`;
          el.style.fontSize = `${18 + (i % 4) * 7}px`;
          el.style.animationDuration = `${14 + (i % 5) * 4}s`;
          el.style.animationDelay = `${-(i * 2.3)}s`;
          ambientLayer.appendChild(el);
        }
      }

      // =====================================================
      // 6. Confetti & Spark Particles Engine
      // =====================================================
      let confettiParticles = [];
      let wheelSparks = [];

      function resizeConfettiCanvas() {
        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        confettiCanvas.width = window.innerWidth * dpr;
        confettiCanvas.height = window.innerHeight * dpr;
        confettiCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
      }

      function launchConfetti(originX, originY, count = 110) {
        if (reducedMotion.matches) return;
        const colors = state.mode === "reward"
          ? ["#ff6b57", "#ffb703", "#06d6a0", "#4cc9f0", "#f72585", "#ffffff"]
          : ["#00f5d4", "#ff4791", "#fee440", "#9b5de5", "#00bbf9", "#ffffff"];
        const emojis = state.mode === "reward" ? ["⭐", "🎉", "✨", "🎁"] : ["⚡", "😜", "👾", "💥"];

        for (let i = 0; i < count; i++) {
          const angle = Math.random() * Math.PI * 2;
          const speed = 4 + Math.random() * 11;
          confettiParticles.push({
            x: originX,
            y: originY,
            vx: Math.cos(angle) * speed,
            vy: Math.sin(angle) * speed - 4,
            size: 6 + Math.random() * 8,
            color: colors[i % colors.length],
            emoji: i % 10 === 0 ? emojis[i % emojis.length] : null,
            rot: Math.random() * Math.PI * 2,
            vRot: (Math.random() - 0.5) * 0.25,
            life: 1,
            decay: 0.009 + Math.random() * 0.008
          });
        }
      }

      function spawnPegSparks(x, y, count = 5) {
        if (reducedMotion.matches) return;
        const color = state.mode === "reward" ? "#fff3b0" : "#00f5d4";
        for (let i = 0; i < count; i++) {
          const angle = -Math.PI + Math.random() * Math.PI;
          const spd = 1.5 + Math.random() * 3.5;
          wheelSparks.push({
            x, y,
            vx: Math.cos(angle) * spd,
            vy: Math.sin(angle) * spd - 0.5,
            r: 2 + Math.random() * 2.5,
            color,
            life: 1
          });
        }
      }

      // =====================================================
      // 7. Wheel Canvas Geometry & Physics Engine
      // =====================================================
      const POINTER_ANGLE = -Math.PI / 2; // 12 o'clock
      let wheelLogicalSize = 520;
      let wheelRotation = 0; // Radians, clockwise
      let angularVel = 0;    // Rad/sec
      let spinState = "idle"; // "idle" | "charging" | "spinning"
      let pointerAngle = 0;  // Clacker spring deflection angle
      let pointerVel = 0;
      let chargeStartTime = 0;
      let chargePower = 0;
      let marqueePhase = 0;
      let lastFrameTime = performance.now();

      function resizeWheelCanvas() {
        const rect = wheelStage.getBoundingClientRect();
        const size = Math.max(260, Math.round(rect.width));
        wheelLogicalSize = size;
        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        wheelCanvas.width = size * dpr;
        wheelCanvas.height = size * dpr;
        wheelCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
      }

      function normalizeAngle(rad) {
        const twoPi = Math.PI * 2;
        return ((rad % twoPi) + twoPi) % twoPi;
      }

      function buildSliceLayout(items) {
        if (!items.length) return [];
        const totalWeight = items.reduce((sum, it) => sum + (Number(it.weight) || 1), 0);
        let cursor = 0;
        return items.map((item, idx) => {
          const w = Number(item.weight) || 1;
          const sweep = (w / totalWeight) * Math.PI * 2;
          const slice = {
            item,
            index: idx,
            start: cursor,
            end: cursor + sweep,
            mid: cursor + sweep / 2,
            sweep,
            pct: ((w / totalWeight) * 100).toFixed(1)
          };
          cursor += sweep;
          return slice;
        });
      }

      function getPegAngles(slices) {
        if (!slices.length) return [];
        const pegs = [];
        if (slices.length === 1) {
          for (let i = 0; i < 8; i++) pegs.push((i / 8) * Math.PI * 2);
          return pegs;
        }
        slices.forEach(s => {
          pegs.push(s.start);
          // Add gentle intermediate studs if slice is super wide (> 75 deg)
          if (s.sweep > Math.PI * 0.42) {
            pegs.push(s.mid);
          }
        });
        return pegs;
      }

      function getSliceAtPointer(slices, rotation) {
        if (!slices.length) return null;
        const localAngle = normalizeAngle(POINTER_ANGLE - rotation);
        for (const s of slices) {
          if (localAngle >= s.start && localAngle < s.end) return s;
        }
        return slices[slices.length - 1];
      }

      function drawWheel() {
        const size = wheelLogicalSize;
        const cx = size / 2;
        const cy = size / 2;
        const bezelR = size * 0.475;
        const rimInnerR = size * 0.425;
        const wheelR = size * 0.415;
        const ctx = wheelCtx;

        ctx.clearRect(0, 0, size, size);

        const activeItems = getActiveItems();
        const slices = buildSliceLayout(activeItems);
        const pegs = getPegAngles(slices);
        const isReward = state.mode === "reward";

        // 1. Outer Arcade Bezel Ring
        ctx.save();
        const bezelGrad = ctx.createLinearGradient(0, cy - bezelR, 0, cy + bezelR);
        if (isReward) {
          bezelGrad.addColorStop(0, "#ff8b60");
          bezelGrad.addColorStop(0.5, "#ff5c47");
          bezelGrad.addColorStop(1, "#d93d2b");
        } else {
          bezelGrad.addColorStop(0, "#8338ec");
          bezelGrad.addColorStop(0.5, "#5a189a");
          bezelGrad.addColorStop(1, "#3c096c");
        }
        ctx.beginPath();
        ctx.arc(cx, cy, bezelR, 0, Math.PI * 2);
        ctx.fillStyle = bezelGrad;
        ctx.fill();

        // Outer Bright Rim Stroke
        ctx.lineWidth = Math.max(4, size * 0.012);
        ctx.strokeStyle = isReward ? "#fff4d9" : "#00f5d4";
        ctx.stroke();

        // Inner Gold / Neon Trim
        ctx.beginPath();
        ctx.arc(cx, cy, rimInnerR, 0, Math.PI * 2);
        ctx.lineWidth = Math.max(3, size * 0.01);
        ctx.strokeStyle = isReward ? "#ffd166" : "#ff4791";
        ctx.stroke();
        ctx.restore();

        // 2. Chasing Marquee LED Bulbs around Bezel
        const bulbCount = 24;
        const bulbOrbit = (bezelR + rimInnerR) / 2;
        const bulbRadius = Math.max(3.5, size * 0.013);
        const phaseStep = Math.floor(marqueePhase);
        for (let i = 0; i < bulbCount; i++) {
          const a = (i / bulbCount) * Math.PI * 2;
          const bx = cx + Math.cos(a) * bulbOrbit;
          const by = cy + Math.sin(a) * bulbOrbit;
          const isLit = (i + phaseStep) % 2 === 0;

          ctx.save();
          ctx.beginPath();
          ctx.arc(bx, by, bulbRadius, 0, Math.PI * 2);
          if (isLit) {
            ctx.fillStyle = isReward
              ? (i % 4 === 0 ? "#fffbe6" : "#ffd166")
              : (i % 4 === 0 ? "#00f5d4" : "#ff4791");
            ctx.shadowColor = ctx.fillStyle;
            ctx.shadowBlur = 12;
          } else {
            ctx.fillStyle = isReward ? "rgba(255,255,255,0.35)" : "rgba(255,255,255,0.18)";
          }
          ctx.fill();
          ctx.restore();
        }

        // 3. Draw Slices (or Empty Placeholder)
        ctx.save();
        ctx.beginPath();
        ctx.arc(cx, cy, wheelR, 0, Math.PI * 2);
        ctx.clip();

        if (!slices.length) {
          ctx.fillStyle = isReward ? "#fff4e6" : "#2d1b54";
          ctx.fillRect(0, 0, size, size);
          ctx.fillStyle = isReward ? "#8a6c66" : "#d7c4ff";
          ctx.font = `900 ${Math.round(size * 0.048)}px ${getComputedStyle(bodyEl).fontFamily}`;
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          ctx.fillText("转盘还是空的哦 ✨", cx, cy - size * 0.14);
          ctx.font = `700 ${Math.round(size * 0.034)}px ${getComputedStyle(bodyEl).fontFamily}`;
          ctx.fillText("请在右侧添加内容或点“恢复默认”", cx, cy + size * 0.14);
        } else {
          const palette = getPalette();
          slices.forEach((slice, idx) => {
            const startA = slice.start + wheelRotation;
            const endA = slice.end + wheelRotation;
            const midA = slice.mid + wheelRotation;
            const baseColor = slice.item.color || palette[idx % palette.length];

            // Slice Radial Fill
            const grad = ctx.createRadialGradient(cx, cy, wheelR * 0.1, cx, cy, wheelR);
            grad.addColorStop(0, lightenHex(baseColor, 22));
            grad.addColorStop(0.75, baseColor);
            grad.addColorStop(1, darkenHex(baseColor, 14));

            ctx.beginPath();
            ctx.moveTo(cx, cy);
            ctx.arc(cx, cy, wheelR + 1, startA, endA);
            ctx.closePath();
            ctx.fillStyle = grad;
            ctx.fill();

            // Crisp Slice Divider
            if (slices.length > 1) {
              ctx.lineWidth = Math.max(2, size * 0.006);
              ctx.strokeStyle = "rgba(255, 255, 255, 0.88)";
              ctx.stroke();
            }

            // Slice Content (Emoji + Label)
            ctx.save();
            ctx.translate(cx, cy);
            ctx.rotate(midA);

            const isMystery = state.mysteryMode;
            const displayEmoji = isMystery ? "❓" : (slice.item.emoji || (isReward ? "🎁" : "😜"));
            const displayLabel = isMystery ? (isReward ? "神秘大奖" : "神秘捣蛋") : slice.item.text;

            // Dynamic font size based on slice angle and total wheel size
            const arcWidthAtText = Math.max(22, wheelR * 0.52 * Math.min(slice.sweep, 1.3));
            const emojiSize = Math.round(Math.min(size * 0.06, Math.max(15, arcWidthAtText * 0.44)));
            const textSize = Math.round(Math.min(size * 0.029, Math.max(10, arcWidthAtText * 0.24)));

            // Flip left-hemisphere slices so every label stays upright and readable
            const normMid = normalizeAngle(midA);
            const flipLeft = normMid > Math.PI * 0.5 && normMid < Math.PI * 1.5;
            if (flipLeft) {
              ctx.rotate(Math.PI);
            }
            const dir = flipLeft ? -1 : 1;

            // Emoji near outer edge
            ctx.font = `${emojiSize}px "Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", sans-serif`;
            ctx.textAlign = "center";
            ctx.textBaseline = "middle";
            ctx.shadowColor = "rgba(0,0,0,0.28)";
            ctx.shadowBlur = 4;
            ctx.fillText(displayEmoji, dir * wheelR * 0.84, 0);

            // Text along radius (safely outside center button, up to emoji)
            ctx.font = `900 ${textSize}px "PingFang SC", "Microsoft YaHei UI", sans-serif`;
            ctx.textAlign = flipLeft ? "left" : "right";
            ctx.lineJoin = "round";
            ctx.lineWidth = Math.max(3, textSize * 0.25);
            ctx.strokeStyle = "rgba(25, 12, 42, 0.78)";
            ctx.fillStyle = "#ffffff";
            ctx.shadowColor = "rgba(0,0,0,0.35)";
            ctx.shadowBlur = 3;

            const maxTextWidth = wheelR * 0.41;
            const canTwoLine = arcWidthAtText >= textSize * 2.35;
            const lines = wrapRadialLines(ctx, displayLabel, maxTextWidth, canTwoLine);
            const lineH = textSize * 1.18;
            const startY = lines.length === 2 ? -lineH * 0.5 : 0;
            lines.forEach((ln, li) => {
              const y = startY + li * lineH;
              ctx.strokeText(ln, dir * wheelR * 0.73, y);
              ctx.fillText(ln, dir * wheelR * 0.73, y);
            });
            ctx.restore();
          });

          // Glossy Candy Specular Overlay
          const shine = ctx.createLinearGradient(0, cy - wheelR, 0, cy + wheelR * 0.4);
          shine.addColorStop(0, "rgba(255, 255, 255, 0.26)");
          shine.addColorStop(0.5, "rgba(255, 255, 255, 0.04)");
          shine.addColorStop(1, "rgba(0, 0, 0, 0.08)");
          ctx.fillStyle = shine;
          ctx.beginPath();
          ctx.arc(cx, cy, wheelR, 0, Math.PI * 2);
          ctx.fill();

          // Speed Motion Lines when spinning fast
          if (angularVel > 8) {
            const alpha = Math.min(0.35, (angularVel - 8) * 0.025);
            ctx.save();
            ctx.strokeStyle = `rgba(255, 255, 255, ${alpha})`;
            ctx.lineWidth = 2.5;
            for (let i = 0; i < 6; i++) {
              const a = (i / 6) * Math.PI * 2 + wheelRotation * 1.4;
              ctx.beginPath();
              ctx.arc(cx, cy, wheelR * (0.68 + (i % 3) * 0.1), a, a + 0.42);
              ctx.stroke();
            }
            ctx.restore();
          }
        }
        ctx.restore();

        // 4. Shiny Rim Pegs (Physical Studs)
        const pegRadius = Math.max(4, size * 0.012);
        pegs.forEach(pLocal => {
          const pWorld = pLocal + wheelRotation;
          const px = cx + Math.cos(pWorld) * (wheelR - pegRadius * 0.6);
          const py = cy + Math.sin(pWorld) * (wheelR - pegRadius * 0.6);

          ctx.save();
          ctx.beginPath();
          ctx.arc(px, py, pegRadius, 0, Math.PI * 2);
          const pGrad = ctx.createRadialGradient(px - 1.5, py - 1.5, 1, px, py, pegRadius);
          pGrad.addColorStop(0, "#ffffff");
          pGrad.addColorStop(0.5, isReward ? "#ffd166" : "#00f5d4");
          pGrad.addColorStop(1, isReward ? "#b56500" : "#5a189a");
          ctx.fillStyle = pGrad;
          ctx.shadowColor = "rgba(0,0,0,0.35)";
          ctx.shadowBlur = 4;
          ctx.fill();
          ctx.restore();
        });

        // 5. Peg Hit Sparks
        wheelSparks.forEach(sp => {
          ctx.save();
          ctx.globalAlpha = sp.life;
          ctx.fillStyle = sp.color;
          ctx.beginPath();
          ctx.arc(sp.x, sp.y, sp.r, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();
        });

        // 6. Top Spring-Loaded Clacker Pointer (12 o'clock)
        const ptrPivotX = cx;
        const ptrPivotY = cy - bezelR + size * 0.015;
        const ptrLen = size * 0.115;
        const ptrHalfW = size * 0.042;

        ctx.save();
        ctx.translate(ptrPivotX, ptrPivotY);
        ctx.rotate(-pointerAngle); // Deflects realistically when pegs sweep right/clockwise

        ctx.shadowColor = "rgba(0, 0, 0, 0.36)";
        ctx.shadowBlur = 10;
        ctx.shadowOffsetY = 4;

        ctx.beginPath();
        ctx.moveTo(0, ptrLen);
        ctx.lineTo(-ptrHalfW, 0);
        ctx.quadraticCurveTo(0, -ptrHalfW * 0.75, ptrHalfW, 0);
        ctx.closePath();

        const ptrGrad = ctx.createLinearGradient(0, -10, 0, ptrLen);
        ptrGrad.addColorStop(0, isReward ? "#ffe066" : "#00f5d4");
        ptrGrad.addColorStop(1, isReward ? "#ff4757" : "#ff007f");
        ctx.fillStyle = ptrGrad;
        ctx.fill();

        ctx.lineWidth = Math.max(2.5, size * 0.007);
        ctx.strokeStyle = "#ffffff";
        ctx.stroke();

        // Pointer Rivet Cap
        ctx.beginPath();
        ctx.arc(0, 2, ptrHalfW * 0.36, 0, Math.PI * 2);
        ctx.fillStyle = "#ffffff";
        ctx.fill();
        ctx.restore();
      }

      function wrapRadialLines(ctx, text, maxWidth, canTwoLine) {
        if (ctx.measureText(text).width <= maxWidth) return [text];
        if (!canTwoLine || text.length <= 4) return [fitText(ctx, text, maxWidth)];
        let splitIdx = Math.ceil(text.length / 2);
        // Prefer splitting on space if one exists near the middle
        const midSpace = text.indexOf(" ", Math.max(1, splitIdx - 2));
        if (midSpace > 0 && midSpace <= text.length - 2) {
          splitIdx = midSpace + 1;
        }
        const line1 = text.slice(0, splitIdx).trim();
        const line2 = text.slice(splitIdx).trim();
        if (!line2) return [fitText(ctx, line1, maxWidth)];
        return [fitText(ctx, line1, maxWidth), fitText(ctx, line2, maxWidth)];
      }

      function fitText(ctx, text, maxWidth) {
        if (ctx.measureText(text).width <= maxWidth) return text;
        let t = text;
        while (t.length > 1 && ctx.measureText(t + "…").width > maxWidth) {
          t = t.slice(0, -1);
        }
        return t + "…";
      }

      function lightenHex(hex, amount) {
        return shiftHex(hex, amount);
      }

      function darkenHex(hex, amount) {
        return shiftHex(hex, -amount);
      }

      function shiftHex(hex, amount) {
        const clean = hex.replace("#", "");
        if (clean.length !== 6) return hex;
        const num = parseInt(clean, 16);
        const r = Math.min(255, Math.max(0, (num >> 16) + amount));
        const g = Math.min(255, Math.max(0, ((num >> 8) & 0xff) + amount));
        const b = Math.min(255, Math.max(0, (num & 0xff) + amount));
        return `rgb(${r}, ${g}, ${b})`;
      }

      
let spinStarted=0, spinDuration=0, spinFrom=0, spinTo=0, spinReceipt=null, spinSnapshot=null;
      function animate(now) {
        const dt = Math.min(0.05, (now - lastFrameTime) / 1000);
        lastFrameTime = now;

        // Marquee Lights Speed
        const marqueeSpeed = spinState === "spinning" ? 16 : spinState === "charging" ? 22 : 3.2;
        marqueePhase = (marqueePhase + dt * marqueeSpeed) % 24;

        // Charging Power Update
        if (spinState === "charging") {
          const heldMs = now - chargeStartTime;
          if (heldMs > 130) {
            chargePower = Math.min(1, (heldMs - 130) / 1200);
            wheelStage.classList.add("charging");
            startChargeHum();
            updateChargeHum(chargePower);
            updatePowerUI(chargePower);
            if (chargePower > 0.65) {
              setMascotDialogue("哇哦！宇宙超级能量蓄满啦！快松手发射！！🚀", "spin");
            } else {
              setMascotDialogue("正在蓄力中…按得越久转得越飞快哦！⚡", "spin");
            }
          }
        }

        // Wheel Spin Physics
        if (spinState === "spinning") {
          const activeItems = getActiveItems();
          const slices = buildSliceLayout(activeItems);
          const pegs = getPegAngles(slices);

          const prevRot = wheelRotation;
          const progress = Math.min(1, (now - spinStarted) / spinDuration);
          wheelRotation = spinFrom + (spinTo - spinFrom) * (1 - Math.pow(1 - progress, 4));
          angularVel = Math.max(0, (wheelRotation - prevRot) / Math.max(dt, 0.001));

          // Detect peg collisions across POINTER_ANGLE
          const dRot = wheelRotation - prevRot;
          if (dRot > 0 && pegs.length > 0) {
            const a0 = normalizeAngle(POINTER_ANGLE - prevRot);
            let triggered = false;
            for (const p of pegs) {
              const dist = normalizeAngle(a0 - p);
              if (dist > 0 && dist <= dRot) {
                triggered = true;
                break;
              }
            }
            if (triggered) {
              pointerAngle = Math.min(0.72, Math.max(pointerAngle, 0.28) + Math.min(0.32, angularVel * 0.015));
              playTickSound(angularVel);
              spawnPegSparks(wheelLogicalSize / 2, wheelLogicalSize * 0.08, 4);
            }
          }

          // Suspense Mascot Cue
          if (angularVel < 2.2 && angularVel > 0.15) {
            setMascotDialogue("屏住呼吸……马上就要停下来啦！👀", "spin");
          }

          // Stop condition
          if (progress >= 1) {
            angularVel = 0;
            spinState = "idle";
            centerBtn.classList.remove("spinning");
            btnMainSpin.disabled = false;
            updatePowerUI(0);
            onSpinFinished();
          }
        }

        // Clacker Spring Return Physics
        const springForce = -240 * pointerAngle - 18 * pointerVel;
        pointerVel += springForce * dt;
        pointerAngle += pointerVel * dt;
        if (Math.abs(pointerAngle) < 0.002 && Math.abs(pointerVel) < 0.01) {
          pointerAngle = 0;
          pointerVel = 0;
        }

        // Update Peg Sparks
        wheelSparks = wheelSparks.filter(sp => {
          sp.x += sp.vx;
          sp.y += sp.vy;
          sp.vy += 0.16;
          sp.life -= 0.05;
          return sp.life > 0;
        });

        // Render Wheel
        drawWheel();

        // Render Fullscreen Confetti
        confettiCtx.clearRect(0, 0, window.innerWidth, window.innerHeight);
        if (confettiParticles.length > 0) {
          confettiParticles = confettiParticles.filter(p => {
            p.x += p.vx;
            p.y += p.vy;
            p.vy += 0.25;
            p.vx *= 0.99;
            p.rot += p.vRot;
            p.life -= p.decay;

            confettiCtx.save();
            confettiCtx.globalAlpha = Math.max(0, p.life);
            confettiCtx.translate(p.x, p.y);
            confettiCtx.rotate(p.rot);
            if (p.emoji) {
              confettiCtx.font = `${p.size * 2}px sans-serif`;
              confettiCtx.textAlign = "center";
              confettiCtx.textBaseline = "middle";
              confettiCtx.fillText(p.emoji, 0, 0);
            } else {
              confettiCtx.fillStyle = p.color;
              confettiCtx.fillRect(-p.size / 2, -p.size / 4, p.size, p.size * 0.55);
            }
            confettiCtx.restore();
            return p.life > 0 && p.y < window.innerHeight + 60;
          });
        }

        requestAnimationFrame(animate);
      }

            function updatePowerUI(power) {
        const pct = Math.round(power * 100);
        powerFill.style.width = `${pct}%`;
        powerPct.textContent = `${pct}%`;
        if (pct === 0) {
          powerStatusText.textContent = "⚡ 蓄力发射槽（直接点转盘即可开转，按住可蓄力加速）";
        } else if (pct < 45) {
          powerStatusText.textContent = "🔥 能量充能中...";
        } else if (pct < 85) {
          powerStatusText.textContent = "🌪️ 超级旋风蓄力！";
        } else {
          powerStatusText.textContent = "💥 宇宙极速满格！！松手起飞！";
        }
      }

      function getRandomCheer(mode) {
        const list = mode === "reward"
          ? [
              "太棒啦！快把这个好消息分享给爸爸妈妈，马上兑现吧！",
              "手气爆棚！今天你就是最幸运的小冠军！",
              "哇哦！梦想成真的时刻到啦，开心转圈圈！"
            ]
          : [
              "哈哈别害羞！大方表演出来，大家都会为你鼓掌哦！",
              "勇敢的小勇士从不认输，快开始你的搞笑大挑战吧！",
              "这局太有节目效果了！准备好迎接全场的笑声了吗？"
            ];
        return list[Math.floor(Math.random() * list.length)];
      }

            function setMascotDialogue(text, mood = "idle") {
        mascotSpeech.textContent = text;
        renderMascot(mood);
        if (mood === "win" || mood === "spin") {
          mascotAvatar.classList.add("bounce");
        } else {
          mascotAvatar.classList.remove("bounce");
        }
      }

      function applyModeUI(withFlip = false) {
        const isReward = state.mode === "reward";
        bodyEl.setAttribute("data-mode", state.mode);

        btnModeReward.classList.toggle("active", isReward);
        btnModePunishment.classList.toggle("active", !isReward);
        btnModeReward.setAttribute('aria-pressed',String(isReward));
        btnModePunishment.setAttribute('aria-pressed',String(!isReward));

        capEmoji.textContent = isReward ? "🎁" : "😜";
        capLabel.textContent = "点我抽奖";
        btnMainSpinText.textContent = isReward ? "立即抽取奖励！" : "立即抽取惩罚！";
        addBoxHeading.textContent = isReward ? "✨ 添加新奖励到转盘" : "😈 添加新惩罚到转盘";
        inputItemName.placeholder = isReward
          ? "输入奖励，例如：吃一个冰淇淋..."
          : "输入惩罚，例如：学小青蛙跳5下...";
        presetsTitle.textContent = isReward
          ? "💡 趣味奖励灵感（点一下就进转盘）"
          : "💡 爆笑惩罚灵感（点一下就进转盘）";

        selectedEmoji = isReward ? "🎁" : "😜";
        btnEmojiPick.textContent = selectedEmoji;
        editingId = null;

        if (withFlip) {
          wheelStage.classList.remove("flip-switch");
          void wheelStage.offsetWidth;
          wheelStage.classList.add("flip-switch");
          playModeSwitchSound(state.mode);
        }

        populateAmbientDecor();
        renderEmojiGrid();
        renderPresetChips();
        renderItemsList();
        setMascotDialogue(
          isReward
            ? "欢迎来到幸运奖励乐园！点击转盘就能抽奖，长按还能蓄力发射哦！✨"
            : "欢迎来到捣蛋冒险转盘！纯属娱乐，快看看谁会中搞笑挑战吧！👾",
          "idle"
        );
      }

      function syncTogglesUI() {
        btnSound.classList.toggle("on", state.soundOn);
        btnSound.innerHTML = state.soundOn
          ? `<span>🔊</span><span>音效开</span>`
          : `<span>🔇</span><span>音效关</span>`;
        btnVoice.classList.toggle("on", state.voiceOn);
        for (const [button,key] of [[btnSound,'soundOn'],[btnVoice,'voiceOn'],[btnMysteryToggle,'mysteryMode'],[btnNorepeatToggle,'noRepeatMode']]) button.setAttribute('aria-pressed',String(state[key]));
        btnMysteryToggle.classList.toggle("active-flag", state.mysteryMode);
        btnNorepeatToggle.classList.toggle("active-flag", state.noRepeatMode);
      }

      function renderEmojiGrid() {
        const list = EMOJI_CHOICES[state.mode];
        emojiGrid.innerHTML = "";
        list.forEach(em => {
          const btn = document.createElement("button");
          btn.type = "button";
          btn.className = "emoji-opt";
          btn.textContent = em;
          btn.addEventListener("click", () => {
            selectedEmoji = em;
            btnEmojiPick.textContent = em;
            emojiPopover.classList.remove("open");
            playPopSound(700);
          });
          emojiGrid.appendChild(btn);
        });
      }


const saveIndicator = document.createElement('div');
saveIndicator.className = 'save-indicator';
saveIndicator.setAttribute('role', 'status');
saveIndicator.setAttribute('aria-live', 'polite');
saveIndicator.hidden = true;
document.body.appendChild(saveIndicator);
const recovery = document.createElement('div');
recovery.className = 'recovery-bar';
recovery.setAttribute('role', 'alert');
recovery.hidden = true;
const recoveryText = document.createElement('span');
const reloadButton = document.createElement('button');
reloadButton.type = 'button';
reloadButton.className = 'btn-secondary';
reloadButton.textContent = '重新读取';
recovery.append(recoveryText, reloadButton);
document.body.appendChild(recovery);
let needsReload = false;

function setBusy(value, text = '正在保存…') {
  busy = value;
  document.querySelector('.app-shell').inert = value || resultModal.classList.contains('open');
  document.querySelector('.app-shell').setAttribute('aria-busy', String(value));
  modalBtnDone.disabled = value;
  modalBtnAgain.disabled = value;
  saveIndicator.textContent = text;
  saveIndicator.hidden = !value;
}
function showFailure(error) {
  needsReload = true;
  if (resultModal.classList.contains('open')) {
    resultModal.classList.remove('open');
    document.querySelector('.app-shell').inert=false;
    animationItems=null;
  }
  recoveryText.textContent = error instanceof Error ? error.message : '操作未完成，请重新读取。';
  recovery.hidden = false;
  // No success feedback or optimistic catalog writes on failure.
}
function applySnapshot(snapshot) {
  revision = snapshot.revision;
  const previousMode = state.mode;
  state = {
    ...snapshot.preferences,
    rewards: snapshot.entries.filter(item => item.kind === 'reward'),
    punishments: snapshot.entries.filter(item => item.kind === 'penalty'),
    history: snapshot.history.map(entry => ({ ...entry, time: new Date(entry.createdAt).toLocaleString('zh-CN', { month:'numeric', day:'numeric', hour:'2-digit', minute:'2-digit' }) })),
  };
  if (state.mode !== previousMode) applyModeUI(true);
  syncTogglesUI();
  renderItemsList();
  renderHistory();
}
async function refresh() {
  if (busy || spinState !== 'idle') return;
  setBusy(true, '正在读取奖池…');
  try {
    const response = await request({ action:'read', refresh:true });
    applySnapshot(response.snapshot);
    needsReload = false;
    recovery.hidden = true;
  } catch (error) { showFailure(error); }
  finally { setBusy(false); }
}
reloadButton.addEventListener('click', refresh);
async function mutate(action, payload = {}) {
  if (busy || spinState !== 'idle') return null;
  if (needsReload) { showToast('⚠️', '请先重新读取奖池，确认上次操作结果。'); return null; }
  setBusy(true);
  try {
    const response = await request({ action, kind:state.mode === 'reward' ? 'reward' : 'penalty', payload, revision, operation:crypto.randomUUID() });
    applySnapshot(response.snapshot);
    return response;
  } catch (error) { showFailure(error); return null; }
  finally { setBusy(false); }
}

async function launchSpin(power = 0) {
  if (busy || spinState !== 'idle' || needsReload) return;
  if (!getActiveItems().length) { showToast('⚠️', '当前没有可抽取的格子，请添加或启用条目。'); return; }
  ensureAudio();
  setBusy(true, '正在抽取…');
  try {
    const response = await request({ action:'draw', kind:state.mode === 'reward' ? 'reward' : 'penalty', payload:{}, revision, operation:crypto.randomUUID() });
    spinReceipt = response.result;
    spinSnapshot = response.snapshot;
    animationItems = response.result.items;
    const slices = buildSliceLayout(animationItems);
    const winner = slices.find(slice => slice.item.id === spinReceipt.entryId);
    if (!winner) throw new Error('抽取已记录，请重新读取战绩。');
    spinFrom = wheelRotation;
    const target = normalizeAngle(POINTER_ANGLE - (winner.start + winner.end) / 2);
    const turns = reducedMotion.matches ? 0 : 6 + Math.round(power * 4);
    spinTo = spinFrom + turns * Math.PI * 2 + normalizeAngle(target - normalizeAngle(spinFrom));
    spinDuration = reducedMotion.matches ? 180 : 3800 + power * 1100;
    spinStarted = performance.now();
    angularVel = 25;
    spinState = 'spinning';
    wheelStage.classList.remove('charging');
    centerBtn.classList.add('spinning');
    saveIndicator.textContent = '转盘旋转中…';
    playLaunchWhoosh(power);
    setMascotDialogue(state.mode === 'reward' ? '呼呼呼！大奖正在飞速转动中，会停在哪一格呢？🎉' : '哇哈哈！捣蛋转盘起飞啦！😜', 'spin');
  } catch (error) {
    animationItems = null;
    spinReceipt = null;
    spinSnapshot = null;
    setBusy(false);
    showFailure(error);
  }
}
function onSpinFinished() {
  if (!spinReceipt) { setBusy(false); return; }
  const receipt = spinReceipt;
  const noRepeat = state.noRepeatMode;
  // Keep the frozen winning wheel visible behind its result until the dialog closes.
  applySnapshot(spinSnapshot);
  lastHistoryEntryId = receipt.id;
  setBusy(false);
  const isReward = receipt.mode === 'reward';
  playWinFanfare(receipt.mode);
  const rect = wheelStage.getBoundingClientRect();
  launchConfetti(rect.left+rect.width/2, rect.top+rect.height/2, 130);
  setMascotDialogue(isReward ? `哇塞！！恭喜抽中【${receipt.emoji} ${receipt.text}】！🌟` : `哈哈哈！！抽中【${receipt.emoji} ${receipt.text}】！勇敢挑战吧！😜`, 'win');
  speakText(`${isReward ? '恭喜抽中奖励' : '抽中趣味惩罚'}：${receipt.text}`);
  modalBadge.textContent = isReward ? '🎁 幸运奖励大爆发！' : '😜 欢乐挑战降临！';
  modalEmoji.textContent = receipt.emoji;
  modalTitle.textContent = receipt.text;
  modalDesc.textContent = getRandomCheer(receipt.mode);
  modalMeta.textContent = `抽中概率 ${receipt.pct}% · 已记入战绩小本本${noRepeat ? ' · 已自动移出本轮转盘' : ''}`;
  modalBtnDoneText.textContent = isReward ? '收下并打卡！' : '我已完成挑战！';
  resultModal.classList.add('open');
  document.querySelector('.app-shell').inert = true;
  modalBtnDone.focus();
  spinReceipt = null;
  spinSnapshot = null;
}
function closeResult() {
  if (busy) return;
  resultModal.classList.remove('open');
  document.querySelector('.app-shell').inert = false;
  animationItems = null;
  wheelStage.focus();
}

let pointerDownActive = false;
wheelStage.addEventListener('pointerdown', event => {
  if (busy || needsReload || spinState !== 'idle' || (event.pointerType === 'mouse' && event.button !== 0)) return;
  event.preventDefault();
  ensureAudio();
  wheelStage.setPointerCapture(event.pointerId);
  pointerDownActive = true;
  spinState = 'charging';
  chargeStartTime = performance.now();
  chargePower = 0;
});
function finishCharge(cancelled = false) {
  if (!pointerDownActive) return;
  pointerDownActive = false;
  stopChargeHum();
  wheelStage.classList.remove('charging');
  const power = chargePower;
  spinState = 'idle';
  updatePowerUI(0);
  if (!cancelled) void launchSpin(power);
}
wheelStage.addEventListener('pointerup', () => finishCharge());
wheelStage.addEventListener('pointercancel', () => finishCharge(true));
wheelStage.addEventListener('lostpointercapture', () => finishCharge(true));
window.addEventListener('blur', () => finishCharge(true));
btnMainSpin.addEventListener('click', () => launchSpin(0.25));
window.addEventListener('keydown', event => {
  if (event.isComposing || busy) return;
  if (event.key === 'Escape') { closeResult(); emojiPopover.classList.remove('open'); return; }
  if (resultModal.classList.contains('open')) {
    if (event.key === 'Tab') {
      const first=modalBtnDone, last=modalBtnAgain;
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    }
    return;
  }
  if ((event.code === 'Space' || event.code === 'Enter') && document.activeElement === wheelStage) {
    event.preventDefault(); if (!event.repeat) launchSpin(0.2);
  } else if (event.code === 'Space' && document.activeElement === document.body) {
    event.preventDefault(); if (!event.repeat) launchSpin(0.2);
  }
});
modalBtnDone.addEventListener('click', async () => {
  if (await mutate('stamp', { id:lastHistoryEntryId, done:true })) { closeResult(); showToast('🏅', '打卡成功！已盖上闪亮印章！'); }
});
modalBtnAgain.addEventListener('click', () => { closeResult(); launchSpin(0.25); });
resultModal.addEventListener('click', event => { if (event.target === resultModal) closeResult(); });

async function switchMode(mode) {
  if (mode === state.mode) return;
  if (await mutate('preferences', { mode })) { /* applySnapshot owns the flip. */ }
}
btnModeReward.addEventListener('click', () => switchMode('reward'));
btnModePunishment.addEventListener('click', () => switchMode('punishment'));
document.getElementById('btn-home').addEventListener('click', () => signal('home'));
mascotAvatar.addEventListener('click', () => {
  playPopSound(640);
  const lines = state.mode === 'reward'
    ? ['点转盘就能转起来！按住不放还可以蓄力超级加速哦！🚀', '今天你想抽到什么超级大奖呢？快把喜欢的加进去吧！🍦', '打开盲盒模式，转完再揭晓！🙈']
    : ['安全又爆笑的趣味挑战，大家一起来玩吧！😜', '担心重复？打开抽后移出试试看！🎯', '完成挑战后，别忘了去战绩小本本盖章打卡哦！✅'];
  setMascotDialogue(lines[Math.floor(Math.random()*lines.length)], 'win');
  setTimeout(() => mascotAvatar.classList.remove('bounce'), 1200);
});
mascotAvatar.addEventListener('keydown', event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); mascotAvatar.click(); } });
for (const [button, key] of [[btnSound,'soundOn'], [btnVoice,'voiceOn'], [btnMysteryToggle,'mysteryMode'], [btnNorepeatToggle,'noRepeatMode']]) {
  button.addEventListener('click', async () => {
    // Prime audio during the gesture, before the authenticated request yields.
    if (key === 'soundOn' && !state.soundOn) { state.soundOn=true; ensureAudio(); state.soundOn=false; }
    if (!(await mutate('preferences', { [key]:!state[key] }))) return;
    syncTogglesUI();
    button.setAttribute('aria-pressed', String(state[key]));
    playPopSound(660);
    if (key === 'voiceOn') {
      if (state.voiceOn) speakText('语音播报已开启');
      else window.speechSynthesis?.cancel();
    }
    showToast('✨', state[key] ? '已开启' : '已关闭');
  });
}
function switchTab(tab) {
  const edit = tab === 'edit';
  tabEdit.classList.toggle('active', edit);
  tabHistory.classList.toggle('active', !edit);
  tabEdit.setAttribute('aria-pressed', String(edit));
  tabHistory.setAttribute('aria-pressed', String(!edit));
  viewEdit.classList.toggle('hidden', !edit);
  viewHistory.classList.toggle('hidden', edit);
  playPopSound(540);
}
tabEdit.addEventListener('click', () => switchTab('edit'));
tabHistory.addEventListener('click', () => switchTab('history'));
btnEmojiPick.addEventListener('click', () => emojiPopover.classList.toggle('open'));
btnCloseEmoji.addEventListener('click', () => { emojiPopover.classList.remove('open'); btnEmojiPick.focus(); });
inputItemName.addEventListener('input', () => {
  const rule = KEYWORD_EMOJIS.find(rule => rule.keys.some(key => inputItemName.value.toLowerCase().includes(key)));
  if (rule) { selectedEmoji=rule.emoji; btnEmojiPick.textContent=rule.emoji; }
});
document.querySelectorAll('.w-pill').forEach(button => button.addEventListener('click', () => {
  selectedWeight=Number(button.dataset.weight);
  document.querySelectorAll('.w-pill').forEach(item => { item.classList.toggle('active', item === button); item.setAttribute('aria-pressed', String(item === button)); });
  playPopSound(520+selectedWeight*60);
}));
async function addItem(text, emoji, weight=1) {
  if (!text.trim()) { showToast('✏️', '请先输入内容。'); inputItemName.focus(); return false; }
  const palette=getPalette();
  const response=await mutate('add', { text:text.trim(), emoji, weight, color:palette[getCurrentList().length % palette.length] });
  if (response) { playPopSound(780); showToast('🎉', `已添加「${text.trim()}」`); }
  return !!response;
}
addItemForm.addEventListener('submit', async event => {
  event.preventDefault();
  if (await addItem(inputItemName.value, selectedEmoji, selectedWeight)) {
    inputItemName.value=''; selectedEmoji=state.mode === 'reward' ? '🎁' : '😜'; btnEmojiPick.textContent=selectedEmoji;
    inputItemName.focus();
  }
});
function renderPresetChips() {
  const pool=PRESET_POOL[state.mode];
  presetChips.replaceChildren();
  for (let index=0;index<6;index++) {
    const item=pool[(presetSeed+index)%pool.length];
    const chip=document.createElement('button');
    chip.type='button'; chip.className='preset-chip'; chip.textContent=`${item.emoji} ${item.text} +`;
    chip.addEventListener('click', () => addItem(item.text,item.emoji));
    presetChips.appendChild(chip);
  }
}
btnRefreshPresets.addEventListener('click', () => { presetSeed+=6; renderPresetChips(); playPopSound(600); });
function escapeHtml(value) { return String(value).replace(/[&<>"']/g, char => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' })[char]); }
function renderItemsList() {
  const list=getCurrentList();
  const active=list.filter(item => item.enabled && !item.reserved);
  const total=active.reduce((sum,item) => sum+item.weight,0);
  activeSliceBadge.textContent=active.length;
  listStats.textContent=`当前转盘共 ${active.length} 个有效格（总计 ${list.length} 项）`;
  itemsList.replaceChildren();
  if (!list.length) { itemsList.innerHTML='<div class="empty-box">列表空空如也～<br>在上方添加一个，或点击“恢复默认”！</div>'; return; }
  list.forEach(item => {
    const row=document.createElement('div');
    row.className=`item-row ${!item.enabled || item.reserved ? 'disabled' : ''}`;
    if (editingId === item.id) {
      const form=document.createElement('form'); form.className='edit-row-form'; form.noValidate=true;
      form.innerHTML=`<span style="font-size:20px">${escapeHtml(item.emoji)}</span><input class="edit-input" type="text" maxlength="100" aria-label="修改名称" value="${escapeHtml(editDraft)}"><button class="icon-btn" type="submit" aria-label="保存">✅</button><button class="icon-btn" type="button" aria-label="取消">✕</button>`;
      const input=form.querySelector('input');
      input.addEventListener('input', () => { editDraft=input.value; });
      form.addEventListener('submit', async event => {
        event.preventDefault();
        if (!input.value.trim()) { input.focus(); return; }
        const nextName=input.value.trim();
        // Keep the typed name on a failed save.
        const response=await mutate('edit', { id:item.id,text:nextName });
        if (response) { editingId=null; renderItemsList(); playPopSound(680); }
      });
      form.querySelector('button[type="button"]').addEventListener('click', () => { editingId=null; renderItemsList(); });
      row.appendChild(form); itemsList.appendChild(row); return;
    }
    const pct=item.enabled && !item.reserved && total ? (100*item.weight/total).toFixed(1) : '0.0';
    row.innerHTML=`<button type="button" class="item-color-dot" aria-label="更换格子颜色" title="点击换一个格子颜色"></button>
      <button type="button" class="item-emoji emoji-cycle" aria-label="更换条目表情" title="更换表情">${escapeHtml(item.emoji)}</button>
      <div class="item-info"><div class="item-name" title="${escapeHtml(item.text)}">${escapeHtml(item.text)}</div>
      <div class="item-meta"><span>概率 ${pct}%</span><span>·</span><span>权重 ${item.weight}x</span>${item.reserved ? '<span>· 已预留</span>' : !item.enabled ? '<span>· 已停用</span>' : ''}</div></div>
      <div class="item-actions"><button type="button" class="icon-btn" data-act="weight" title="切换权重" aria-label="切换权重">${item.weight}x</button>
      <button type="button" class="icon-btn" data-act="toggle" title="${item.enabled ? '暂时移出转盘' : '重新启用'}" aria-label="${item.enabled ? '停用' : '启用'}">${item.enabled ? '👁️' : '🙈'}</button>
      <button type="button" class="icon-btn" data-act="edit" aria-label="修改名称" title="修改名称">✏️</button>
      <button type="button" class="icon-btn danger" data-act="del" aria-label="删除条目" title="删除">🗑️</button></div>`;
    row.querySelector('.item-color-dot').style.backgroundColor=item.color;
    row.querySelectorAll('button').forEach(button => { button.disabled=item.reserved; });
    row.querySelector('.item-color-dot').addEventListener('click', () => { const palette=getPalette(); mutate('edit',{id:item.id,color:palette[(palette.indexOf(item.color)+1)%palette.length]}); });
    row.querySelector('.emoji-cycle').addEventListener('click', () => {
      const choices=EMOJI_CHOICES[state.mode];
      mutate('edit',{id:item.id,emoji:choices[(choices.indexOf(item.emoji)+1)%choices.length]});
    });
    row.querySelector('[data-act="weight"]').addEventListener('click', () => mutate('edit',{id:item.id,weight:item.weight%3+1}));
    row.querySelector('[data-act="toggle"]').addEventListener('click', () => mutate('edit',{id:item.id,enabled:!item.enabled}));
    row.querySelector('[data-act="edit"]').addEventListener('click', () => { editingId=item.id; editDraft=item.text; renderItemsList(); itemsList.querySelector('input')?.focus(); });
    row.querySelector('[data-act="del"]').addEventListener('click', async () => {
      if (await confirmAction('delete',item.text)) { if (await mutate('delete',{id:item.id})) showToast('🗑️',`已删除「${item.text}」`); }
    });
    itemsList.appendChild(row);
  });
}
btnShuffle.addEventListener('click', async () => { if (await mutate('shuffle')) showToast('🔀','转盘格子已重新洗牌！'); });
btnEnableAll.addEventListener('click', async () => { if (await mutate('enableAll')) showToast('👀','可用条目已全部点亮！'); });
btnResetDefault.addEventListener('click', async () => {
  if (await confirmAction('reset')) { if (await mutate('reset')) { editingId=null; renderItemsList(); showToast('♻️','已恢复默认趣味列表！'); } }
});
function renderHistory() {
  historyCountBadge.textContent=state.history.length;
  statTotalSpins.textContent=state.history.length;
  statTotalRewards.textContent=state.history.filter(entry => entry.mode === 'reward').length;
  statTotalPunishments.textContent=state.history.filter(entry => entry.mode === 'punishment' && entry.done).length;
  historyList.replaceChildren();
  if (!state.history.length) { historyList.innerHTML='<div class="empty-box">还没有抽奖记录哦～<br>快去转动幸运大转盘吧！🎡</div>'; return; }
  state.history.forEach(entry => {
    const reward=entry.mode === 'reward';
    const row=document.createElement('div'); row.className=`history-item ${entry.done ? 'done' : ''}`;
    row.innerHTML=`<div style="font-size:26px">${escapeHtml(entry.emoji)}</div><div class="item-info"><div class="item-name">${escapeHtml(entry.text)}</div>
      <div class="item-meta"><span class="history-badge ${entry.mode}">${reward ? '奖励' : '惩罚'}</span><span>${escapeHtml(entry.time)}</span><span>· 概率 ${entry.pct > 0 ? entry.pct+'%' : '未记录'}</span></div></div>
      <button class="stamp-btn ${entry.done ? 'stamped' : ''}" type="button" aria-pressed="${entry.done}">${entry.done ? (reward ? '🌟 已兑现' : '✅ 已完成') : (reward ? '⬜ 待兑现' : '⬜ 待挑战')}</button>`;
    if (entry.treeReserved) { row.querySelector('button').disabled=true; row.querySelector('button').textContent='🌳 去生命树领取'; }
    row.querySelector('button').addEventListener('click', async event => {
      const rect=event.currentTarget.getBoundingClientRect();
      if (await mutate('stamp',{id:entry.id,done:!entry.done})) {
        if (!entry.done) { playWinFanfare('reward'); launchConfetti(rect.left+rect.width/2,rect.top,35); }
        showToast('🏅',entry.done ? '已撤销打卡' : '打卡成功！');
      }
    });
    historyList.appendChild(row);
  });
}
btnClearHistory.addEventListener('click', async () => {
  if (state.history.length && await confirmAction('clearHistory')) { if (await mutate('clearHistory')) showToast('🧹','战绩记录已清空'); }
});
window.addEventListener('resize', () => { resizeWheelCanvas(); resizeConfettiCanvas(); });
document.addEventListener('visibilitychange', () => {
  if (document.hidden) { finishCharge(true); window.speechSynthesis?.cancel(); }
  else if (!busy && !resultModal.classList.contains('open') && !editingId && !inputItemName.value) void refresh();
});
window.addEventListener('pagehide', () => { stopChargeHum(); audioCtx?.close(); window.speechSynthesis?.cancel(); });
try {
  const response=await request({action:'read'});
  applySnapshot(response.snapshot);
  applyModeUI(false);
  syncTogglesUI();
  renderHistory();
  document.body.style.visibility='visible';
  resizeWheelCanvas(); resizeConfettiCanvas();
  requestAnimationFrame(animate);
  signal('ready');
} catch (error) { signal('fatal', {error:error instanceof Error ? error.message : '读取奖池失败。'}); }
