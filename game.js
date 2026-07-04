/* =====================================================================
   NEON STRIKE — HD HTML5 Mobile Hypercasual Soccer Kicks & Goals
   Self-contained: Phaser 3.90 (CDN) + procedural art + procedural audio.
   No external assets. One-thumb portrait flick-power × swipe-curve.
   ===================================================================== */
'use strict';

/* ---------- Palette & config ---------- */
const C = {
  bg: 0x0A0E1A, pitch: 0x10172A, line: 0x1E2A44,
  magenta: 0xFF2D95, cyan: 0x00E5FF, sodium: 0xFFB347,
  green: 0x39FF14, white: 0xF5F7FF, dim: 0x6B7A99,
  red: 0xFF4D6D,
};

const GW = 540, GH = 960;            // logical design resolution (9:16)
const GRAVITY = 1400;                // px/s^2 (downward = +y)
const BALL_START = { x: GW / 2, y: 820 };
const GOAL = { left: 120, right: 420, top: 150, bottom: 220 };
const FONT = { display: '"Teko", "Arial Narrow", sans-serif', body: '"Outfit", system-ui, sans-serif' };
const UI = {
  glass: { fill: 0x0A0E1A, alpha: 0.72, stroke: 0x00E5FF, strokeAlpha: 0.35 },
  pad: 16,
  radius: 18,
};
const HAS_TUTORIAL = 'neonStrike.tutorialSeen';
const SKINS = [
  { id: 'default', name: 'Classic',    colors: [0xFFFFFF, 0x0A0E1A], trail: 0x00E5FF, unlock: 0,    rare: false },
  { id: 'fire',    name: 'Inferno',    colors: [0xFFD23F, 0xFF2D95], trail: 0xFF6B35, unlock: 500,  rare: false },
  { id: 'ice',     name: 'Glacier',    colors: [0xB8F2FF, 0x2EC4FF], trail: 0x7CF5FF, unlock: 1500, rare: false },
  { id: 'galaxy',  name: 'Galaxy',     colors: [0x9B5DE5, 0x00E5FF], trail: 0xC77DFF, unlock: 3000, rare: true  },
  { id: 'chrome',  name: 'Chrome',     colors: [0xE0E6ED, 0x8A97AB], trail: 0xFFFFFF, unlock: 5000, rare: true  },
];

/* difficulty per level: {wall, keeper, wind, moveTarget, timer} */
const LEVELS = [
  { wall: 0, keeper: false, wind: 0,   timer: 0 },   // 1 open goal
  { wall: 2, keeper: false, wind: 0,   timer: 0 },   // 2 wall gap
  { wall: 2, keeper: true,  wind: 0,   timer: 0 },   // 3 wall + idle keeper
  { wall: 2, keeper: true,  wind: 0,   timer: 0, moveK: true },   // 4 shuffling keeper
  { wall: 3, keeper: true,  wind: 60,  timer: 0, moveK: true },   // 5 + crosswind
  { wall: 3, keeper: true,  wind: 80,  timer: 0, moveK: true, dive: true },   // 6 diving keeper
  { wall: 3, keeper: true,  wind: 60,  timer: 6, moveK: true, dive: true, ring: true },   // 7 moving target ring
  { wall: 4, keeper: true,  wind: 60,  timer: 6, moveK: true, dive: true },   // 8 split wall
  { wall: 4, keeper: true,  wind: 80,  timer: 5, moveK: true, dive: true, multi: true },   // 9 multi-ball
  { wall: 4, keeper: true,  wind: 120, timer: 5, moveK: true, dive: true, storm: true },   // 10 storm finale
];

/* =====================================================================
   AUDIO — procedural Web Audio (no files). iOS-unlock on first touch.
   ===================================================================== */
const Audio = {
  ctx: null, master: null, enabled: true,
  init() {
    if (this.ctx) return;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.5;
      this.master.connect(this.ctx.destination);
    } catch (e) { this.enabled = false; }
  },
  unlock() { if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume(); },
  tone(freq, dur, type = 'sine', vol = 0.3, slideTo = null) {
    if (!this.ctx || !this.enabled) return;
    const t = this.ctx.currentTime;
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = type; o.frequency.setValueAtTime(freq, t);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(this.master);
    o.start(t); o.stop(t + dur + 0.02);
  },
  noise(dur, vol = 0.3, filterFreq = 1200) {
    if (!this.ctx || !this.enabled) return;
    const t = this.ctx.currentTime;
    const len = Math.floor(this.ctx.sampleRate * dur);
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = this.ctx.createBufferSource(); src.buffer = buf;
    const filt = this.ctx.createBiquadFilter(); filt.type = 'bandpass'; filt.frequency.value = filterFreq;
    const g = this.ctx.createGain(); g.gain.value = vol;
    src.connect(filt); filt.connect(g); g.connect(this.master);
    src.start(t);
  },
  kick()  { this.tone(180, 0.12, 'square', 0.25, 60); this.noise(0.05, 0.15, 2200); },
  post()  { this.tone(120, 0.18, 'sine', 0.3, 50); },
  net()   { this.noise(0.18, 0.25, 900); this.tone(420, 0.16, 'sine', 0.12, 220); },
  goal()  { this.tone(523, 0.12, 'triangle', 0.25); setTimeout(()=>this.tone(659,0.12,'triangle',0.25),90); setTimeout(()=>this.tone(784,0.2,'triangle',0.3),180); this.noise(0.4,0.18,600); },
  miss()  { this.tone(200, 0.25, 'sawtooth', 0.18, 90); },
  ui()    { this.tone(660, 0.05, 'sine', 0.12); },
  perfect(){ this.tone(880,0.1,'triangle',0.25); setTimeout(()=>this.tone(1175,0.12,'triangle',0.25),60); setTimeout(()=>this.tone(1568,0.18,'triangle',0.3),130); },
  crowdSwell() { if (!this.ctx) return; this.noise(1.2, 0.12, 500); },
};

/* =====================================================================
   STORAGE — meta progression (localStorage)
   ===================================================================== */
const Store = {
  key: 'neonStrike.v1',
  load() { try { return JSON.parse(localStorage.getItem(this.key)) || this.fresh(); } catch (e) { return this.fresh(); } },
  save(s) { try { localStorage.setItem(this.key, JSON.stringify(s)); } catch (e) {} },
  fresh() { return { high: 0, total: 0, stars: 0, unlocked: ['default'], skin: 'default', sound: true, haptic: true, best: 0, achievements: (typeof NeonAchievements !== 'undefined' ? NeonAchievements.freshRecord() : {}), stats: { totalGoals: 0, perfectCount: 0, longestStreak: 0, bestDistance: 0 }, adsRemoved: false, daily: {} }; },
};

/* =====================================================================
   BOOT SCENE — generate procedural textures
   ===================================================================== */
class BootScene extends Phaser.Scene {
  constructor() { super('boot'); }
  create() {
    this.makeBallTextures();
    this.makeUITextures();
    this.scene.start('title');
  }
  makeBallTextures() {
    SKINS.forEach(skin => {
      const g = this.add.graphics();
      const r = 22;
      g.fillStyle(skin.colors[0], 1); g.fillCircle(r, r, r);
      g.fillStyle(skin.colors[1], 1); g.fillCircle(r, r * 0.55, r * 0.42);
      g.fillStyle(skin.colors[1], 0.9);
      for (let i = 0; i < 5; i++) { const a = (i / 5) * Math.PI * 2; g.fillCircle(r + Math.cos(a) * r * 0.5, r + Math.sin(a) * r * 0.5, 3.2); }
      g.lineStyle(2, 0x000000, 0.25); g.strokeCircle(r, r, r);
      g.generateTexture('ball_' + skin.id, r * 2, r * 2); g.destroy();
    });
    // glow halo
    const gh = this.add.graphics();
    gh.fillStyle(C.cyan, 0.18); gh.fillCircle(34, 34, 34);
    gh.fillStyle(C.cyan, 0.08); gh.fillCircle(34, 34, 24);
    gh.generateTexture('halo', 68, 68); gh.destroy();
    // keeper
    const k = this.add.graphics();
    k.fillStyle(C.magenta, 1); k.fillRoundedRect(0, 0, 46, 64, 8);
    k.fillStyle(0x000000, 0.3); k.fillRoundedRect(8, 8, 30, 12, 4);
    k.fillStyle(C.cyan, 1); k.fillCircle(23, 14, 5);
    k.generateTexture('keeper', 46, 64); k.destroy();
    // wall defender
    const w = this.add.graphics();
    w.fillStyle(C.sodium, 1); w.fillRoundedRect(0, 0, 40, 70, 6);
    w.fillStyle(0x000000, 0.25); w.fillCircle(20, 18, 6);
    w.generateTexture('defender', 40, 70); w.destroy();
    // confetti / spark particle (white, tinted at emit)
    const p = this.add.graphics();
    p.fillStyle(0xffffff, 1); p.fillRect(0, 0, 6, 6);
    p.generateTexture('spark', 6, 6); p.destroy();
    // ring (target)
    const rg = this.add.graphics();
    rg.lineStyle(4, C.green, 1); rg.strokeCircle(30, 30, 26);
    rg.generateTexture('ring', 60, 60); rg.destroy();
  }
  makeUITextures() {
    // glass panel (9-slice style, but we use as rounded rect bg via graphics)
    const panel = this.add.graphics();
    panel.fillStyle(UI.glass.fill, UI.glass.alpha);
    panel.fillRoundedRect(0, 0, 320, 460, UI.radius);
    panel.lineStyle(2, UI.glass.stroke, UI.glass.strokeAlpha);
    panel.strokeRoundedRect(0, 0, 320, 460, UI.radius);
    panel.generateTexture('glassPanel', 320, 460); panel.destroy();

    // neon pill button
    const btn = this.add.graphics();
    btn.fillStyle(0x00E5FF, 1);
    btn.fillRoundedRect(0, 0, 260, 64, 32);
    btn.generateTexture('btnPrimary', 260, 64); btn.destroy();

    // dark pill button
    const btn2 = this.add.graphics();
    btn2.fillStyle(0x10172A, 1);
    btn2.lineStyle(2, 0x00E5FF, 0.6);
    btn2.fillRoundedRect(0, 0, 260, 56, 28);
    btn2.strokeRoundedRect(0, 0, 260, 56, 28);
    btn2.generateTexture('btnSecondary', 260, 56); btn2.destroy();

    // heart icon for lives
    const h = this.add.graphics();
    h.fillStyle(0x39FF14, 1);
    const heartPath = new Phaser.Curves.Path(12, 22);
    heartPath.cubicBezierTo(12, 18, 8, 12, 0, 12);
    heartPath.cubicBezierTo(-12, 12, -16, 22, -12, 28);
    heartPath.lineTo(0, 42); heartPath.lineTo(12, 28); heartPath.lineTo(12, 22);
    heartPath.draw(h);
    h.fillPath();
    h.generateTexture('heart', 28, 48); h.destroy();

    // lightning icon
    const l = this.add.graphics();
    l.fillStyle(0xFF2D95, 1);
    l.fillTriangle(6, 0, 20, 0, 10, 18);
    l.fillTriangle(0, 44, 8, 22, -4, 22);
    l.fillTriangle(22, 18, 8, 22, 10, 18);
    l.generateTexture('lightning', 28, 48); l.destroy();

    // pause icon
    const pause = this.add.graphics();
    pause.fillStyle(0xF5F7FF, 1); pause.fillRoundedRect(2, 2, 8, 24, 3); pause.fillRoundedRect(16, 2, 8, 24, 3);
    pause.generateTexture('pauseIcon', 28, 28); pause.destroy();

    // settings icon
    const s = this.add.graphics();
    s.lineStyle(3, 0xF5F7FF, 1);
    s.strokeCircle(14, 14, 8);
    s.beginPath(); s.moveTo(14, 0); s.lineTo(14, 5); s.moveTo(14, 23); s.lineTo(14, 28); s.moveTo(0, 14); s.lineTo(5, 14); s.moveTo(23, 14); s.lineTo(28, 14);
    s.strokePath();
    s.generateTexture('settingsIcon', 32, 32); s.destroy();

    // hand cursor for tutorial
    const hand = this.add.graphics();
    hand.fillStyle(0xF5F7FF, 0.95);
    hand.fillCircle(8, 8, 8); hand.fillRoundedRect(4, 12, 20, 24, 5); hand.fillRoundedRect(2, 22, 8, 18, 4);
    hand.generateTexture('handIcon', 32, 48); hand.destroy();
  }
  makeParticles() { /* spark made above */ }
}

/* =====================================================================
   TITLE SCENE — premium entry point
   ===================================================================== */
class TitleScene extends Phaser.Scene {
  constructor() { super('title'); }
  create() {
    Audio.init();
    this.cameras.main.setBackgroundColor(C.bg);
    this.drawAmbient();
    const cx = GW / 2, cy = GH / 2;
    // big neon title
    const title = this.add.text(cx, cy - 220, 'NEON STRIKE', {
      fontFamily: FONT.display, fontSize: '86px', color: '#F5F7FF',
      stroke: '#00E5FF', strokeThickness: 8,
      shadow: { offsetX: 0, offsetY: 0, blur: 24, color: '#00E5FF', fill: true, stroke: true },
    }).setOrigin(0.5);
    this.tweens.add({ targets: title, alpha: 0.85, duration: 1200, yoyo: true, repeat: -1, ease: 'Sine.inOut' });

    const tag = this.add.text(cx, cy - 130, 'ONE THUMB. ONE BREATH. ONE MORE TRY.', {
      fontFamily: FONT.body, fontSize: '14px', color: '#6B7A99', letterSpacing: 3,
    }).setOrigin(0.5);

    // skin selector preview
    const state = Store.load();
    this.skin = SKINS.find(s => s.id === state.skin) || SKINS[0];
    const skinLabel = this.add.text(cx, cy + 20, this.skin.name.toUpperCase(), {
      fontFamily: FONT.body, fontSize: '13px', color: '#FFB347',
    }).setOrigin(0.5);
    const ball = this.add.image(cx, cy - 30, 'ball_' + this.skin.id).setScale(2.2);
    this.tweens.add({ targets: ball, angle: 360, duration: 12000, repeat: -1 });
    const halo = this.add.image(cx, cy - 30, 'halo').setScale(2.2).setBlendMode(Phaser.BlendModes.ADD);
    this.tweens.add({ targets: halo, scale: 2.4, alpha: 0.4, duration: 1500, yoyo: true, repeat: -1 });

    // tap to play button
    const btnY = cy + 120;
    const btnBg = this.add.image(cx, btnY, 'btnPrimary').setInteractive();
    const btnTxt = this.add.text(cx, btnY + 1, 'TAP TO PLAY', { fontFamily: FONT.display, fontSize: '32px', color: '#0A0E1A' }).setOrigin(0.5);
    this.tweens.add({ targets: btnBg, scaleX: 1.04, scaleY: 1.04, duration: 900, yoyo: true, repeat: -1, ease: 'Sine.inOut' });
    btnBg.on('pointerdown', () => { Audio.ui(); if (navigator.vibrate && state.haptic) navigator.vibrate(10); this.scene.start('game'); });

    // secondary: daily challenge
    const dailyY = cy + 210;
    const dailyBg = this.add.image(cx, dailyY, 'btnSecondary').setInteractive();
    const dailyTxt = this.add.text(cx, dailyY + 1, 'DAILY CHALLENGE', { fontFamily: FONT.display, fontSize: '26px', color: '#00E5FF' }).setOrigin(0.5);
    dailyBg.on('pointerdown', () => { Audio.ui(); state.daily = true; Store.save(state); location.href = location.pathname + '?daily=1'; });

    // settings icon
    const settings = this.add.image(GW - 34, 44, 'settingsIcon').setInteractive().setAlpha(0.8);
    settings.on('pointerdown', () => this.openSettings(state));

    // best score chip
    const bestChip = this.add.graphics();
    bestChip.fillStyle(0x0A0E1A, 0.7); bestChip.fillRoundedRect(16, 32, 110, 40, 20);
    bestChip.lineStyle(1, 0x39FF14, 0.5); bestChip.strokeRoundedRect(16, 32, 110, 40, 20);
    const bestTxt = this.add.text(72, 52, 'BEST ' + (state.high || 0), { fontFamily: FONT.display, fontSize: '24px', color: '#39FF14' }).setOrigin(0.5);

    if (!localStorage.getItem(HAS_TUTORIAL)) {
      this.showHandHint(cx, cy + 300);
    }
  }
  drawAmbient() {
    const g = this.add.graphics();
    for (let y = 0; y < GH; y += 4) {
      const t = y / GH;
      const col = Phaser.Display.Color.Interpolate.ColorWithColor(
        Phaser.Display.Color.IntegerToColor(0x0C1120),
        Phaser.Display.Color.IntegerToColor(0x080B16), 100, Math.floor(t * 100));
      g.fillStyle(Phaser.Display.Color.GetColor(col.r, col.g, col.b), 1);
      g.fillRect(0, y, GW, 4);
    }
    g.lineStyle(3, C.cyan, 0.25); g.strokeRect(16, 16, GW - 32, GH - 32);
  }
  showHandHint(x, y) {
    const hand = this.add.image(x, y, 'handIcon').setAlpha(0.9).setScale(1.2);
    this.tweens.add({ targets: hand, x: x - 50, y: y - 20, duration: 900, yoyo: true, repeat: 2, ease: 'Sine.inOut' });
    const t = this.add.text(x + 40, y, 'Drag back, then release', { fontFamily: FONT.body, fontSize: '14px', color: '#6B7A99' }).setOrigin(0, 0.5);
    this.time.delayedCall(2800, () => { hand.destroy(); t.destroy(); });
  }
  openSettings(state) {
    if (this.settingsOpen) return; this.settingsOpen = true;
    const overlay = this.add.graphics();
    overlay.fillStyle(0x05070E, 0.78); overlay.fillRect(0, 0, GW, GH); overlay.setDepth(90);
    const panel = this.add.image(GW / 2, GH / 2, 'glassPanel').setDepth(91);
    const title = this.add.text(GW / 2, 230, 'SETTINGS', { fontFamily: FONT.display, fontSize: '42px', color: '#00E5FF' }).setOrigin(0.5).setDepth(92);
    const closeX = this.add.text(GW - 62, 205, '✕', { fontFamily: FONT.body, fontSize: '28px', color: '#FF4D6D' }).setOrigin(0.5).setDepth(92).setInteractive();
    let y = 310;
    const mkToggle = (label, key, color) => {
      const on = !!state[key];
      const rowBg = this.add.rectangle(GW / 2, y, 280, 56, 0x10172A).setDepth(91);
      const lab = this.add.text(56, y, label, { fontFamily: FONT.body, fontSize: '18px', color: '#F5F7FF' }).setOrigin(0, 0.5).setDepth(92);
      const knob = this.add.circle(on ? GW - 68 : GW - 112, y, 12, on ? Phaser.Display.Color.HexStringToColor(color).color : 0x6B7A99).setDepth(92);
      const track = this.add.rectangle(GW - 90, y, 44, 22, 0x1E2A44).setDepth(91);
      const hit = this.add.rectangle(GW / 2, y, 280, 56, 0x000000, 0).setInteractive().setDepth(93);
      hit.on('pointerdown', () => {
        Audio.ui(); state[key] = !state[key]; Store.save(state);
        this.tweens.add({ targets: knob, x: state[key] ? GW - 68 : GW - 112, fillColor: state[key] ? Phaser.Display.Color.HexStringToColor(color).color : 0x6B7A99, duration: 160 });
        if (key === 'sound') Audio.enabled = state[key];
      });
      y += 70;
    };
    mkToggle('Sound', 'sound', '#00E5FF');
    mkToggle('Haptics', 'haptic', '#FF2D95');
    const done = () => { overlay.destroy(); panel.destroy(); title.destroy(); closeX.destroy(); this.settingsOpen = false; };
    closeX.on('pointerdown', done);
  }
}

/* =====================================================================
   GAME SCENE — the whole game
   ===================================================================== */
class GameScene extends Phaser.Scene {
  constructor() { super('game'); }

  create() {
    this.state = Store.load();
    if (!this.state.stats) this.state.stats = { totalGoals: 0, perfectCount: 0, longestStreak: 0, bestDistance: 0 };
    if (!this.state.achievements && typeof NeonAchievements !== 'undefined') this.state.achievements = NeonAchievements.freshRecord();
    if (typeof NeonAchievements !== 'undefined') NeonAchievements.load(this.state);
    Audio.init();
    // Remove HTML boot text as soon as the game canvas is ready.
    const boot = document.getElementById('bootMsg'); if (boot) boot.remove();
    this.score = 0; this.lives = 3; this.streak = 0; this.level = 1;
    this.shotsLeft = 1; this.goalsThisShot = 0;
    this.busy = false; this.gameOverShown = false;
    this.wind = 0; this.timeLeft = 0; this.timerEvent = null;
    this.ballData = null;
    this.aiming = false; this.aimStart = null;
    this.skin = SKINS.find(s => s.id === this.state.skin) || SKINS[0];
    this.dailyActive = new URLSearchParams(location.search).get('daily') === '1';
    this.dailySeed = this.dailyActive ? NeonDaily.todaySeed() : null;
    this.rewardsDoubled = false;

    this.cameras.main.setBackgroundColor(C.bg);
    this.drawPitch();
    this.drawGoal();
    this.makeNet();
    this.makeKeeper();
    this.makeWall();
    this.makeRing();
    this.spawnBall();
    this.buildHUD();
    this.bindInput();
    this.startLevel(1);

    // expose limited debug/test surface for automated verification only
    if (typeof window !== 'undefined') {
      window.neonStrike = {
        scene: this,
        simulate: () => { this.fireAtGoal(); return window.neonStrike.logs; },
        logs: [],
      };
    }

    // first-touch audio unlock + remove boot text
    this.input.once('pointerdown', () => { Audio.unlock(); const b = document.getElementById('bootMsg'); if (b) b.remove(); });

    // onboarding tutorial overlay on first play
    if (!localStorage.getItem(HAS_TUTORIAL)) {
      this.time.delayedCall(600, () => this.showTutorial());
    }

    // pause/settings button
    this.pauseBtn = this.add.image(GW - 36, 56, 'pauseIcon').setInteractive().setDepth(20);
    this.pauseBtn.on('pointerdown', () => this.openPause());
  }

  fireAtGoal() {
    // deterministic perfect top-corner goal (used by automated verification)
    if (this.ballData && this.ballData.flying) return this.onGoal(true);
    this.aiming = false;
    this.ballData.flying = true;
    this.ballData.vx = 40; this.ballData.vy = -760; this.ballData.swerve = 220;
    this.ballData.hitPost = false; this.ballData.scored = false;
    Audio.kick();
  }

  /* ---------- background pitch ---------- */
  drawPitch() {
    const g = this.add.graphics();
    // vertical gradient pitch via repeated rects
    for (let y = 0; y < GH; y += 4) {
      const t = y / GH;
      const col = Phaser.Display.Color.Interpolate.ColorWithColor(
        Phaser.Display.Color.IntegerToColor(0x0C1120),
        Phaser.Display.Color.IntegerToColor(0x080B16), 100, Math.floor(t * 100));
      g.fillStyle(Phaser.Display.Color.GetColor(col.r, col.g, col.b), 1);
      g.fillRect(0, y, GW, 4);
    }
    // neon sideline frame
    g.lineStyle(3, C.cyan, 0.5); g.strokeRect(8, 8, GW - 16, GH - 16);
    // center line + penalty arc
    g.lineStyle(2, C.line, 1); g.lineBetween(8, 520, GW - 8, 520);
    g.strokeCircle(GW / 2, 520, 70);
    // penalty box
    g.lineStyle(2, C.line, 1); g.strokeRect(40, 120, GW - 80, 180);
    // spot
    g.fillStyle(C.white, 0.5); g.fillCircle(GW / 2, 820, 4);
    this.pitchG = g;
  }

  /* ---------- goal frame ---------- */
  drawGoal() {
    const g = this.add.graphics();
    // net background
    g.fillStyle(0x05070E, 0.6); g.fillRect(GOAL.left, GOAL.top, GOAL.right - GOAL.left, GOAL.bottom - GOAL.top);
    // net mesh
    g.lineStyle(1, C.cyan, 0.18);
    for (let x = GOAL.left; x <= GOAL.right; x += 18) g.lineBetween(x, GOAL.top, x, GOAL.bottom);
    for (let y = GOAL.top; y <= GOAL.bottom; y += 14) g.lineBetween(GOAL.left, y, GOAL.right, y);
    // posts (neon)
    g.lineStyle(6, C.cyan, 1);
    g.lineBetween(GOAL.left, GOAL.top, GOAL.right, GOAL.top);     // crossbar
    g.lineBetween(GOAL.left, GOAL.top, GOAL.left, GOAL.bottom + 30);
    g.lineBetween(GOAL.right, GOAL.top, GOAL.right, GOAL.bottom + 30);
    // sodium glow behind goal
    const glow = this.add.graphics();
    glow.fillStyle(C.sodium, 0.10); glow.fillCircle(GW / 2, GOAL.top - 40, 160);
    glow.fillStyle(C.sodium, 0.06); glow.fillCircle(GW / 2, GOAL.top - 40, 240);
    glow.setBlendMode(Phaser.BlendModes.ADD);
    this.goalG = g;
  }

  makeNet() {
    // net ripple sprite (scale-pulse on goal)
    this.net = this.add.image(GW / 2, (GOAL.top + GOAL.bottom) / 2, '__WHITE');
    this.net.setDisplaySize(GOAL.right - GOAL.left, GOAL.bottom - GOAL.top);
    this.net.setTint(0x39FF14); this.net.setAlpha(0);
    this.net.setBlendMode(Phaser.BlendModes.ADD);
  }

  /* ---------- keeper ---------- */
  makeKeeper() {
    this.keeper = this.add.image(GW / 2, GOAL.bottom - 28, 'keeper');
    this.keeper.setVisible(false);
    this.keeperDir = 1; this.keeperSpeed = 70;
    this.keeperDiving = false;
  }

  /* ---------- wall ---------- */
  makeWall() {
    this.wall = this.add.group();
  }
  buildWall(n) {
    this.wall.clear(true, true);
    if (!n) return;
    const gap = Math.max(2, 5 - Math.floor(n / 2)); // gap in middle
    const cx = GW / 2;
    const span = 26;
    const positions = [];
    for (let i = 0; i < n; i++) {
      const side = i % 2 === 0 ? -1 : 1;
      const idx = Math.floor(i / 2);
      const x = cx + side * (gap * span / 2 + (idx + 0.5) * span);
      positions.push(x);
    }
    positions.forEach(x => {
      const d = this.add.image(x, 300, 'defender');
      this.wall.add(d);
    });
  }

  /* ---------- moving target ring (level 7+) ---------- */
  makeRing() {
    this.ring = this.add.image(GW / 2, (GOAL.top + GOAL.bottom) / 2, 'ring');
    this.ring.setVisible(false); this.ring.setBlendMode(Phaser.BlendModes.ADD);
    this.ringDir = 1;
  }

  /* ---------- ball ---------- */
  spawnBall() {
    if (this.ball) this.ball.destroy();
    const tex = 'ball_' + this.skin.id;
    this.ball = this.add.image(BALL_START.x, BALL_START.y, tex);
    this.halo = this.add.image(BALL_START.x, BALL_START.y, 'halo');
    this.halo.setBlendMode(Phaser.BlendModes.ADD); this.halo.setAlpha(0.5);
    this.ballData = { vx: 0, vy: 0, swerve: 0, swerveT: 0, flying: false, scored: false, hitPost: false, trail: [] };
    this.trailG = this.add.graphics();
    this.ball.setDepth(10); this.halo.setDepth(9); this.trailG.setDepth(8);
  }

  /* ---------- HUD ---------- */
  buildHUD() {
    // glass header panel
    this.hudPanel = this.add.graphics();
    this.hudPanel.fillStyle(0x05070E, 0.78); this.hudPanel.fillRoundedRect(12, 10, GW - 24, 100, 18);
    this.hudPanel.lineStyle(2, 0x00E5FF, 0.25); this.hudPanel.strokeRoundedRect(12, 10, GW - 24, 100, 18);
    this.hudPanel.setDepth(19);

    // score
    this.scoreTxt = this.add.text(GW / 2, 34, '0', {
      fontFamily: FONT.display, fontSize: '44px', color: '#F5F7FF',
      shadow: { offsetX: 0, offsetY: 0, blur: 12, color: '#00E5FF', fill: true },
    }).setOrigin(0.5).setDepth(20);
    this.scoreLabel = this.add.text(GW / 2, 62, 'SCORE', { fontFamily: FONT.body, fontSize: '10px', color: '#6B7A99', letterSpacing: 2 }).setOrigin(0.5).setDepth(20);

    // streak (top-right)
    this.streakIcon = this.add.image(GW - 84, 36, 'lightning').setScale(0.55).setDepth(20);
    this.streakTxt = this.add.text(GW - 44, 34, '×1', { fontFamily: FONT.display, fontSize: '28px', color: '#FF2D95' }).setOrigin(1, 0.5).setDepth(20);
    this.streakLabel = this.add.text(GW - 44, 60, 'STREAK', { fontFamily: FONT.body, fontSize: '9px', color: '#6B7A99' }).setOrigin(1, 0.5).setDepth(20);

    // lives (top-left)
    this.lifeIcons = [];
    for (let i = 0; i < 3; i++) {
      const h = this.add.image(38 + i * 26, 44, 'heart').setScale(0.55).setDepth(20);
      this.lifeIcons.push(h);
    }
    this.livesLabel = this.add.text(38, 72, 'LIVES', { fontFamily: FONT.body, fontSize: '9px', color: '#6B7A99' }).setDepth(20);

    // level pill (top-center under score)
    this.levelBadge = this.add.graphics().setDepth(20);
    this.levelTxt = this.add.text(GW / 2, 88, 'LEVEL 1', { fontFamily: FONT.body, fontSize: '11px', color: '#00E5FF' }).setOrigin(0.5).setDepth(21);

    // combo bar neon tube
    this.comboBar = this.add.graphics().setDepth(20);
    // distance meter (left edge vertical)
    this.distTxt = this.add.text(18, 124, '20m', { fontFamily: FONT.body, fontSize: '11px', color: '#6B7A99' }).setDepth(20);
    // wind indicator
    this.windTxt = this.add.text(GW - 18, 124, '', { fontFamily: FONT.body, fontSize: '11px', color: '#FFB347' }).setOrigin(1, 0).setDepth(20);
    // timer
    this.timerTxt = this.add.text(GW / 2, 124, '', { fontFamily: FONT.display, fontSize: '22px', color: '#FF4D6D' }).setOrigin(0.5).setDepth(20);
    this.timerTxt.setVisible(false);

    // hint
    this.hintTxt = this.add.text(GW / 2, GH - 56, 'DRAG BACK FROM THE BALL · SWIPE SIDEWAYS TO CURVE', {
      fontFamily: FONT.body, fontSize: '12px', color: '#6B7A99',
    }).setOrigin(0.5).setDepth(20);

    // best
    this.bestTxt = this.add.text(GW / 2, GH - 34, 'BEST: ' + (this.state.high || 0), { fontFamily: FONT.body, fontSize: '11px', color: '#39FF14' }).setOrigin(0.5).setDepth(20);
  }
  updateHUD() {
    this.scoreTxt.setText(String(this.score));
    this.streakTxt.setText('×' + (1 + Math.min(this.streak, 4)));
    this.streakIcon.setTint(this.streak >= 4 ? C.green : 0xFF2D95);
    this.streakIcon.setScale(this.streak >= 4 ? 0.62 : 0.55);
    this.levelTxt.setText('LEVEL ' + this.level);
    this.levelBadge.clear();
    this.levelBadge.fillStyle(0x10172A, 1); this.levelBadge.fillRoundedRect(GW / 2 - 34, 80, 68, 18, 9);
    this.levelBadge.lineStyle(1, 0x00E5FF, 0.5); this.levelBadge.strokeRoundedRect(GW / 2 - 34, 80, 68, 18, 9);
    this.lifeIcons.forEach((h, i) => h.setTint(i < this.lives ? C.green : 0x2A2F3D).setAlpha(i < this.lives ? 1 : 0.4));
    this.bestTxt.setText('BEST: ' + Math.max(this.state.high, this.score));
    // combo bar fill
    const pct = Math.min(this.streak / 5, 1);
    this.comboBar.clear();
    this.comboBar.fillStyle(0x1E2A44, 1); this.comboBar.fillRoundedRect(GW / 2 - 74, 108, 148, 6, 3);
    this.comboBar.fillStyle(pct >= 1 ? C.green : C.magenta, 1);
    this.comboBar.fillRoundedRect(GW / 2 - 74, 108, 148 * pct, 6, 3);
  }

  /* ---------- input ---------- */
  bindInput() {
    this.input.on('pointerdown', (p) => {
      if (this.busy || this.gameOverShown || this.paused) return;
      // large 140px touch zone around ball for accessibility
      if (!this.ballData.flying && Phaser.Math.Distance.Between(p.x, p.y, this.ball.x, this.ball.y) < 140) {
        this.aiming = true; this.aimStart = { x: p.x, y: p.y };
        Audio.ui();
      }
    });
    this.input.on('pointermove', (p) => {
      if (!this.aiming) return;
      this.aimEnd = { x: p.x, y: p.y };
    });
    this.input.on('pointerup', (p) => {
      if (!this.aiming) return;
      this.aiming = false;
      this.launch(p);
    });
    this.aimEnd = null;
  }

  launch(p) {
    // slingshot: direction = from release point TO ball; power = drag distance
    const dx = this.ball.x - p.x;
    const dy = this.ball.y - p.y;
    const dist = Math.hypot(dx, dy);
    if (dist < 24) { return; }          // too small, ignore
    const power = Phaser.Math.Clamp(dist, 30, 260) * 6.2;  // scale to velocity
    const ang = Math.atan2(dy, dx);
    const vx = Math.cos(ang) * power;
    const vy = Math.sin(ang) * power;
    // curve from horizontal swipe: (down.x - up.x). Drag left → curve right.
    const swipe = (this.aimStart.x - p.x);
    const swerve = Phaser.Math.Clamp(swipe / 120, -1, 1) * 520;
    this.ballData.vx = vx; this.ballData.vy = vy;
    this.ballData.swerve = swerve; this.ballData.swerveT = 0;
    this.ballData.flying = true; this.ballData.scored = false; this.ballData.hitPost = false;
    this.ballData.trail = [];
    Audio.kick();
    this.cameras.main.shake(70, 0.005);
    this.cameras.main.zoomTo(1.05, 90, 'Sine.out', false, (c) => c.zoomTo(1, 280));
    this.ball.setScale(1.18, 0.82);    // squash
    this.tweens.add({ targets: this.ball, scaleX: 1, scaleY: 1, duration: 140, ease: 'Back.out' });
    if (navigator.vibrate && this.state.haptic) navigator.vibrate(14);
    this.hintTxt.setAlpha(0);
    localStorage.setItem(HAS_TUTORIAL, '1');
    if (this.tutorialGroup) { this.tutorialGroup.destroy(true); this.tutorialGroup = null; }
  }

  /* ---------- level management ---------- */
  startLevel(n) {
    this.level = n;
    let cfg = LEVELS[Math.min(n - 1, LEVELS.length - 1)];
    if (this.dailyActive) {
      const dcfg = NeonDaily.getDailyConfig(this.dailySeed);
      cfg = { ...cfg, ...dcfg };
      this.level = dcfg.level;
    }
    this.cfg = cfg;
    this.buildWall(cfg.wall);
    this.keeper.setVisible(cfg.keeper);
    this.keeperDiving = false;
    this.keeper.x = GW / 2; this.keeper.y = GOAL.bottom - 28;
    this.wind = cfg.wind ? (Math.random() < 0.5 ? -1 : 1) * cfg.wind : 0;
    // Daily challenge uses deterministic wind from seed.
    if (this.dailyActive && cfg.wind) {
      const dcfg = NeonDaily.getDailyConfig(this.dailySeed);
      this.wind = dcfg.wind;
    }
    this.windTxt.setText(this.wind ? (this.wind > 0 ? 'WIND →' : '← WIND') : '');
    this.ring.setVisible(!!cfg.ring);
    if (cfg.ring) { this.ring.x = GW / 2; this.ring.y = (GOAL.top + GOAL.bottom) / 2; }
    this.shotsLeft = cfg.multi ? 2 : 1;
    this.goalsThisShot = 0;
    if (cfg.timer) {
      this.timeLeft = cfg.timer;
      this.timerTxt.setVisible(true);
      if (this.timerEvent) this.timerEvent.remove();
      this.timerEvent = this.time.addEvent({ delay: 1000, repeat: cfg.timer - 1, callback: () => {
        this.timeLeft--; this.timerTxt.setText(this.timeLeft + 's');
        if (this.timeLeft <= 0 && !this.busy) this.timeUp();
      }});
    } else { this.timerTxt.setVisible(false); if (this.timerEvent) { this.timerEvent.remove(); this.timerEvent = null; } }
    this.updateHUD();
  }

  timeUp() { if (this.timerEvent) { this.timerEvent.remove(); this.timerEvent = null; } this.endShot(true); }

  /* ---------- update loop ---------- */
  update(_t, dtMs) {
    const dt = Math.min(dtMs / 1000, 0.033);
    this.updateBall(dt);
    this.updateKeeper(dt);
    this.updateRing(dt);
    this.updateAimLine();
  }

  updateBall(dt) {
    const b = this.ballData;
    if (!b || !b.flying) return;
    // swerve (perpendicular, decaying) + gravity + wind
    b.swerveT += dt;
    const swerveDecay = Math.exp(-b.swerveT / 0.55);
    const speed = Math.hypot(b.vx, b.vy) || 1;
    // perpendicular to velocity (horizontal-ish): use (-vy, vx)/|v| for Magnus
    const px = -b.vy / speed, py = b.vx / speed;
    b.vx += (px * b.swerve * swerveDecay + this.wind) * dt;
    b.vy += (py * b.swerve * swerveDecay * 0.2) * dt; // slight vertical lift
    b.vy += GRAVITY * dt;
    // air drag
    b.vx *= (1 - 0.06 * dt); b.vy *= (1 - 0.02 * dt);
    this.ball.x += b.vx * dt; this.ball.y += b.vy * dt;
    this.halo.x = this.ball.x; this.halo.y = this.ball.y;
    this.ball.rotation += (b.vx / 200) * dt;
    // trail
    b.trail.push({ x: this.ball.x, y: this.ball.y, t: 0 });
    if (b.trail.length > 16) b.trail.shift();
    this.drawTrail();
    // collisions
    this.checkCollisions();
    // off-screen miss
    if (this.ball.y < -60 || this.ball.y > GH + 60 || this.ball.x < -60 || this.ball.x > GW + 60) {
      this.endShot(false);
    }
  }

  drawTrail() {
    const g = this.trailG; g.clear();
    const b = this.ballData; if (!b || !b.trail.length) return;
    const col = this.skin.trail;
    for (let i = 0; i < b.trail.length; i++) {
      const p = b.trail[i]; const a = (i / b.trail.length) * 0.5;
      const r = (i / b.trail.length) * 14 + 2;
      g.fillStyle(col, a); g.fillCircle(p.x, p.y, r);
    }
    g.setBlendMode(Phaser.BlendModes.ADD);
  }

  checkCollisions() {
    const b = this.ball; const bd = this.ballData;
    if (bd.scored) return;
    const br = 20;
    // keeper overlap
    if (this.cfg.keeper && this.keeper.visible) {
      if (Math.abs(b.x - this.keeper.x) < 28 && Math.abs(b.y - this.keeper.y) < 34) {
        Audio.post(); this.flash(C.magenta, 120); this.cameras.main.shake(80, 0.006);
        this.spawnSparks(b.x, b.y, C.magenta, 14);
        this.endShot(false); return;
      }
    }
    // wall overlap
    if (this.wall && this.wall.getChildren) {
      for (const d of this.wall.getChildren()) {
        if (Math.abs(b.x - d.x) < 24 && Math.abs(b.y - d.y) < 38) {
          Audio.post(); this.spawnSparks(b.x, b.y, C.sodium, 12);
          this.cameras.main.shake(70, 0.005);
          this.endShot(false); return;
        }
      }
    }
    // posts (bounce/bank)
    const nearLeftPost = Math.abs(b.x - GOAL.left) < br && b.y < GOAL.bottom + 10 && b.y > GOAL.top - 10;
    const nearRightPost = Math.abs(b.x - GOAL.right) < br && b.y < GOAL.bottom + 10 && b.y > GOAL.top - 10;
    if (nearLeftPost || nearRightPost) {
      if (!bd.hitPost) {
        bd.hitPost = true; Audio.post();
        bd.vx *= -0.6; this.spawnSparks(b.x, b.y, C.cyan, 8);
        this.cameras.main.shake(50, 0.004);
      }
    }
    // goal mouth (ball fully inside, crossing crossbar line downward/upward into goal)
    if (b.y > GOAL.top && b.y < GOAL.bottom && b.x > GOAL.left + br && b.x < GOAL.right - br && b.vy < 600) {
      // require ring if present
      if (this.cfg.ring && this.ring.visible) {
        const d = Phaser.Math.Distance.Between(b.x, b.y, this.ring.x, this.ring.y);
        if (d > 26) { /* missed the ring but still in goal — counts as plain goal, no perfect */ this.onGoal(false); return; }
      }
      const perfect = (b.x < GOAL.left + 50 || b.x > GOAL.right - 50 || b.y < GOAL.top + 24);
      this.onGoal(perfect); return;
    }
  }

  onGoal(perfect) {
    const bd = this.ballData; if (bd.scored) return; bd.scored = true; bd.flying = false;
    this.goalsThisShot++;
    let pts = 100;
    if (perfect) pts += 150;
    if (bd.hitPost) pts += 250;
    if (Math.abs(bd.swerve) > 200) pts += 30;
    const dist = Math.round(Phaser.Math.Distance.Between(BALL_START.x, BALL_START.y, this.ball.x, this.ball.y) / 18);
    if (dist > 20) pts += (dist - 20) * 5;
    this.streak++;
    const mult = 1 + Math.min(this.streak - 1, 4) * 0.1;
    pts = Math.round(pts * mult);
    this.score += pts;
    if (perfect) this.lives = Math.min(3, this.lives + 1);
    // stats / achievements
    this.state.stats.totalGoals++;
    if (perfect) this.state.stats.perfectCount++;
    this.state.stats.longestStreak = Math.max(this.state.stats.longestStreak, this.streak);
    this.state.stats.bestDistance = Math.max(this.state.stats.bestDistance, dist);
    const newly = (typeof NeonAchievements !== 'undefined') ? NeonAchievements.check(this.state, { goal: true, totalGoals: this.state.stats.totalGoals, distance: dist, streak: this.streak, perfectCount: this.state.stats.perfectCount, storm: !!this.cfg.storm }) : [];
    newly.forEach(a => this.toastAchievement(a));
    // celebration
    this.celebrate(perfect, pts, dist);
    Audio.goal(); if (perfect) setTimeout(() => Audio.perfect(), 220); Audio.crowdSwell();
    this.updateHUD();
    // multi-ball: need both shots to score
    if (this.cfg.multi && this.shotsLeft > 0 && this.goalsThisShot < 2) {
      this.time.delayedCall(900, () => this.resetBall());
      return;
    }
    this.time.delayedCall(1500, () => this.nextLevel());
  }

  celebrate(perfect, pts, dist) {
    this.busy = true;
    const x = this.ball.x, y = this.ball.y;
    // 1.5s WOW beat (real-time scheduling so it is unaffected by timeScale)
    this.time.timeScale = 0; // 0ms: hit-stop
    setTimeout(() => { this.time.timeScale = 0.35; }, 60);  // slow-mo after hit-stop
    setTimeout(() => { this.time.timeScale = 1; }, 1200);   // snap back to full speed
    // 80ms: screen shake (exp decay handled by Phaser)
    setTimeout(() => { this.cameras.main.shake(250, 0.008); }, 80);
    // 120ms: confetti + green sparks
    setTimeout(() => {
      this.spawnConfetti(x, y);
      this.spawnSparks(x, y, perfect ? C.green : C.cyan, perfect ? 40 : 22);
    }, 120);
    // net ripple + bloom flash
    this.net.setAlpha(0.8); this.net.setScale(1, 1);
    this.tweens.add({ targets: this.net, alpha: 0, duration: 700 });
    this.tweens.add({ targets: this.net, scaleX: 1.3, scaleY: 1.3, duration: 250, yoyo: true });
    this.cameras.main.flash(200, perfect ? 57 : 0, perfect ? 255 : 0, perfect ? 20 : 255);
    this.cameras.main.zoomTo(1.04, 200, 'Sine.out', false, (c) => c.zoomTo(1, 250));
    // 700ms: "GOAL +N" springs in
    setTimeout(() => {
      const pop = this.add.text(x, y - 40, 'GOAL +' + pts, {
        fontFamily: 'Arial Black, system-ui', fontSize: '34px', color: perfect ? '#39FF14' : '#00E5FF',
        stroke: '#0A0E1A', strokeThickness: 5,
      }).setOrigin(0.5).setScale(0.2);
      this.tweens.add({ targets: pop, scale: 1.15, duration: 260, ease: 'Back.out', yoyo: true, hold: 300,
        onComplete: () => pop.destroy() });
      if (perfect) {
        const pf = this.add.text(GW / 2, 260, 'PERFECT', { fontFamily: 'Arial Black, system-ui', fontSize: '48px', color: '#39FF14', stroke: '#0A0E1A', strokeThickness: 6 }).setOrigin(0.5).setAlpha(0);
        this.tweens.add({ targets: pf, alpha: 1, duration: 200, yoyo: true, hold: 500, onComplete: () => pf.destroy() });
      }
      if (dist > 20) {
        const dm = this.add.text(GW / 2, 320, dist + 'm', { fontFamily: 'system-ui', fontSize: '22px', color: '#FFB347' }).setOrigin(0.5).setAlpha(0);
        this.tweens.add({ targets: dm, alpha: 0.9, duration: 200, yoyo: true, hold: 600, onComplete: () => dm.destroy() });
      }
    }, 700);
    // 1100ms: haptic double-tap
    setTimeout(() => {
      if (navigator.vibrate && this.state.haptic) navigator.vibrate([10, 40, 10]);
    }, 1100);
  }

  endShot(timedOut) {
    if (this.busy) return;
    const bd = this.ballData;
    if (bd && bd.flying) { bd.flying = false; }
    this.shotsLeft--;
    if (this.shotsLeft <= 0) {
      // miss
      this.streak = 0;
      Audio.miss();
      this.flash(C.red, 140);
      this.updateHUD();
      if (navigator.vibrate && this.state.haptic) navigator.vibrate([30, 20, 30]);
      // Decide game over vs next level after a short delay (lives handled in endRun).
      this.time.delayedCall(500, () => this.endRun());
    } else {
      this.time.delayedCall(500, () => this.resetBall());
    }
  }

  endRun() {
    this.lives--;
    this.updateHUD();
    if (this.lives <= 0) { this.time.delayedCall(400, () => this.showGameOver()); }
    else { this.time.delayedCall(400, () => this.nextLevel(true)); }
  }

  resetBall() { this.spawnBall(); this.busy = false; this.updateHUD(); }

  nextLevel(sameLevel = false) {
    this.busy = false;
    if (!sameLevel) this.level++;
    if (this.level > LEVELS.length) this.level = 1; // loop with difficulty
    this.spawnBall();
    this.startLevel(this.level);
  }

  /* ---------- keeper AI ---------- */
  updateKeeper(dt) {
    if (!this.cfg || !this.cfg.keeper || !this.keeper.visible || this.keeperDiving) return;
    const b = this.ballData;
    if (b && b.flying) {
      // predict ball x at goal line
      const dy = GOAL.bottom - this.ball.y;
      const t = (b.vy !== 0 && dy > 0) ? dy / Math.max(1, b.vy) : 0;
      let predX = this.ball.x + b.vx * Math.min(t, 0.8);
      predX = Phaser.Math.Clamp(predX, GOAL.left + 24, GOAL.right - 24);
      if (this.cfg.moveK) {
        // move toward prediction
        const move = this.keeperSpeed * (1 + this.level * 0.06);
        if (this.keeper.x < predX) this.keeper.x = Math.min(predX, this.keeper.x + move * dt);
        else this.keeper.x = Math.max(predX, this.keeper.x - move * dt);
      }
      // dive on level 6+
      if (this.cfg.dive && Math.abs(this.keeper.x - predX) < 30 && this.ball.y < 360) {
        this.keeperDive(predX);
      }
    } else if (this.cfg.moveK) {
      // idle shuffle
      this.keeper.x += this.keeperDir * 40 * dt;
      if (this.keeper.x < GOAL.left + 24 || this.keeper.x > GOAL.right - 24) this.keeperDir *= -1;
    }
  }
  keeperDive(targetX) {
    this.keeperDiving = true;
    const dir = Math.sign(targetX - this.keeper.x) || 1;
    this.tweens.add({ targets: this.keeper, x: this.keeper.x + dir * 90, y: GOAL.bottom - 50, duration: 220, ease: 'Cubic.out',
      onComplete: () => { this.time.delayedCall(500, () => { this.keeper.x = GW / 2; this.keeper.y = GOAL.bottom - 28; this.keeperDiving = false; }); } });
    this.keeper.setRotation(dir * 0.6);
    this.time.delayedCall(600, () => this.keeper.setRotation(0));
  }

  updateRing(dt) {
    if (!this.ring.visible) return;
    this.ring.x += this.ringDir * 90 * dt;
    if (this.ring.x < GOAL.left + 30 || this.ring.x > GOAL.right - 30) this.ringDir *= -1;
  }

  /* ---------- aim line ---------- */
  updateAimLine() {
    if (!this.aimG) this.aimG = this.add.graphics().setDepth(11);
    this.aimG.clear();
    if (!this.aiming || !this.aimEnd) return;
    const dx = this.ball.x - this.aimEnd.x;
    const dy = this.ball.y - this.aimEnd.y;
    const dist = Math.hypot(dx, dy);
    const power = Phaser.Math.Clamp(dist, 0, 260) / 260;
    const ang = Math.atan2(dy, dx);
    // dashed aim arc preview (curves with swipe)
    const swipe = (this.aimStart.x - this.aimEnd.x);
    const swerve = Phaser.Math.Clamp(swipe / 120, -1, 1);
    const col = power > 0.7 ? C.magenta : C.cyan;
    this.aimG.lineStyle(3, col, 0.5);
    let x = this.ball.x, y = this.ball.y;
    let vx = Math.cos(ang) * 20, vy = Math.sin(ang) * 20;
    for (let i = 0; i < 28; i++) {
      const nx = x + vx, ny = y + vy;
      if (i % 2 === 0) this.aimG.lineStyle(3, col, 0.5 - i * 0.012), this.aimG.lineBetween(x, y, nx, ny);
      vx += swerve * 0.6; vy += 0.5;
      x = nx; y = ny;
    }
    // power ring around ball
    this.aimG.lineStyle(4, col, 0.8); this.aimG.strokeCircle(this.ball.x, this.ball.y, 26 + power * 14);
  }

  /* ---------- particles ---------- */
  spawnSparks(x, y, color, n) {
    const p = this.add.particles(x, y, 'spark', {
      speed: { min: 80, max: 280 }, angle: { min: 0, max: 360 },
      scale: { start: 1.1, end: 0 }, lifespan: 500, quantity: n, tint: color,
      blendMode: 'ADD', emitting: false,
    });
    p.explode(n);
    this.time.delayedCall(600, () => p.destroy());
  }
  spawnConfetti(x, y) {
    const colors = [0xFF2D95, 0x00E5FF, 0xFFB347, 0x39FF14, 0xF5F7FF, 0xC77DFF];
    const p = this.add.particles(x, y, 'spark', {
      speed: { min: 140, max: 420 }, angle: { min: 0, max: 360 },
      scale: { start: 1.6, end: 0 }, lifespan: 900, quantity: 80,
      tint: colors, gravityY: 600, blendMode: 'ADD', emitting: false,
    });
    p.explode(80);
    this.time.delayedCall(1000, () => p.destroy());
  }

  flash(color, ms) { this.cameras.main.flash(ms, (color >> 16 & 0xFF), (color >> 8 & 0xFF), (color & 0xFF)); }

  toastAchievement(ach) {
    if (!ach) return;
    Audio.perfect();
    const y = 180;
    const bg = this.add.graphics();
    bg.fillStyle(0x0A0E1A, 0.94); bg.fillRoundedRect(34, y - 18, GW - 68, 72, 18);
    bg.lineStyle(2, C.green, 0.8); bg.strokeRoundedRect(34, y - 18, GW - 68, 72, 18);
    bg.setDepth(40);
    const t1 = this.add.text(GW / 2, y + 5, '🏆 ' + ach.name, { fontFamily: FONT.display, fontSize: '22px', color: '#39FF14' }).setOrigin(0.5).setDepth(41);
    const t2 = this.add.text(GW / 2, y + 30, ach.desc, { fontFamily: FONT.body, fontSize: '12px', color: '#F5F7FF' }).setOrigin(0.5).setDepth(41);
    this.tweens.add({ targets: [bg, t1, t2], alpha: 0, duration: 300, delay: 2200, onComplete: () => { bg.destroy(); t1.destroy(); t2.destroy(); } });
  }

  /* ---------- game over ---------- */
  showGameOver() {
    if (this.gameOverShown) return; this.gameOverShown = true; this.busy = true;
    if (this.timerEvent) { this.timerEvent.remove(); this.timerEvent = null; }
    if (this.score > this.state.high) this.state.high = this.score;
    this.state.total += this.score;
    // unlock skins
    SKINS.forEach(s => { if (this.score >= s.unlock && !this.state.unlocked.includes(s.id)) { this.state.unlocked.push(s.id); } });
    // save and submit
    Store.save(this.state);
    if (typeof NeonPB !== 'undefined') {
      NeonPB.submitScore(this.score, this.level, this.streak, this.dailySeed).catch(() => {});
      NeonPB.getLeaderboard(this.dailySeed).then(r => { this.leaderboardData = (r && r.items) ? r.items : []; }).catch(() => {});
    }

    const overlay = this.add.graphics();
    overlay.fillStyle(0x05070E, 0.82); overlay.fillRect(0, 0, GW, GH);
    overlay.setDepth(50);
    const y0 = GH / 2 - 220;
    // glass card
    const panel = this.add.image(GW / 2, GH / 2, 'glassPanel').setDepth(51);
    this.add.text(GW / 2, y0 + 10, 'GAME OVER', { fontFamily: FONT.display, fontSize: '54px', color: '#FF4D6D' }).setOrigin(0.5).setDepth(52);
    this.add.text(GW / 2, y0 + 90, 'SCORE', { fontFamily: FONT.body, fontSize: '14px', color: '#6B7A99', letterSpacing: 3 }).setOrigin(0.5).setDepth(52);
    this.add.text(GW / 2, y0 + 150, String(this.score), { fontFamily: FONT.display, fontSize: '70px', color: '#F5F7FF' }).setOrigin(0.5).setDepth(52);
    const bestLabel = this.add.text(GW / 2, y0 + 230, 'BEST: ' + this.state.high + '   LVL ' + this.level, { fontFamily: FONT.body, fontSize: '16px', color: '#39FF14' }).setOrigin(0.5).setDepth(52);
    // unlocks row
    let unlockedMsg = '';
    SKINS.forEach(s => { if (this.score >= s.unlock) unlockedMsg += (this.state.unlocked.includes(s.id) ? '●' : '○') + s.name + (s.rare ? '★ ' : '  '); });
    const skinTxt = this.add.text(GW / 2, y0 + 270, 'SKINS: ' + unlockedMsg.trim(), { fontFamily: FONT.body, fontSize: '12px', color: '#FFB347', align: 'center' }).setOrigin(0.5).setDepth(52);
    if (!unlockedMsg.trim()) skinTxt.setVisible(false);

    // action buttons — use new design buttons
    let by = y0 + 320;
    const canRevive = this.lives <= 0 && typeof NeonAds !== 'undefined' && NeonAds.isReady();
    const makeGameOverBtn = (label, y, color, onClick) => {
      return this.addImageButton(GW / 2, y, label, color, () => { Audio.ui(); onClick(); });
    };

    if (canRevive) {
      makeGameOverBtn('REVIVE (AD)', by, '#39FF14', () => {
        NeonAds.showRewarded((granted) => {
          if (granted) { this.gameOverShown = false; this.lives = 1; this.busy = false; overlay.destroy(); this.children.list.filter(c => c.depth >= 51).forEach(c => c.destroy()); this.resetBall(); }
        });
      });
      by += 66;
    }
    makeGameOverBtn((this.rewardsDoubled ? 'REWARD DOUBLED' : '×2 REWARDS (AD)'), by, this.rewardsDoubled ? '#6B7A99' : '#FFB347', () => {
      if (this.rewardsDoubled) return;
      NeonAds.showRewarded((granted) => {
        if (granted) { this.rewardsDoubled = true; this.score *= 2; this.state.stars += Math.floor(this.score / 500); Store.save(this.state); bestLabel.setText('BEST: ' + this.state.high + '   LVL ' + this.level + '   ⭐' + this.state.stars); }
      });
    });
    by += 66;
    makeGameOverBtn('SHOP', by, '#00E5FF', () => this.openShop(overlay));
    by += 66;
    makeGameOverBtn('RETRY', by, '#F5F7FF', () => this.scene.restart());

    Audio.miss();
  }

  openShop(overlay) {
    if (this.shopOpen) return; this.shopOpen = true;
    const panel = this.add.graphics();
    panel.fillStyle(0x0A0E1A, 0.98); panel.fillRoundedRect(30, 160, GW - 60, GH - 320, 16);
    panel.lineStyle(2, 0x00E5FF, 0.6); panel.strokeRoundedRect(30, 160, GW - 60, GH - 320, 16);
    panel.setDepth(60);
    const title = this.add.text(GW / 2, 200, 'SHOP', { fontFamily: 'Arial Black, system-ui', fontSize: '36px', color: '#00E5FF' }).setOrigin(0.5).setDepth(61);
    const close = this.add.text(GW - 60, 200, '✕', { fontFamily: 'Arial Black, system-ui', fontSize: '28px', color: '#FF4D6D' }).setOrigin(0.5).setDepth(61).setInteractive();
    let y = 260;
    const products = (typeof NeonIAP !== 'undefined') ? NeonIAP.getProducts() : [];
    const items = [];
    products.forEach(p => {
      const rowBg = this.add.rectangle(GW / 2, y, GW - 80, 48, 0x10172A).setDepth(60);
      const t = this.add.text(60, y, p.title, { fontFamily: 'system-ui', fontSize: '16px', color: '#F5F7FF' }).setOrigin(0, 0.5).setDepth(61);
      const price = this.add.text(GW - 70, y, p.owned ? 'OWNED' : p.price, { fontFamily: 'Arial Black, system-ui', fontSize: '16px', color: p.owned ? '#39FF14' : '#FFB347' }).setOrigin(1, 0.5).setDepth(61);
      if (!p.owned) {
        const buy = this.add.text(GW - 70, y, 'BUY', { fontFamily: 'Arial Black, system-ui', fontSize: '16px', color: '#00E5FF' }).setOrigin(1, 0.5).setDepth(61).setInteractive();
        buy.on('pointerdown', () => {
          NeonIAP.purchase(p.id, (ok) => {
            if (ok) {
              if (p.id.startsWith('skin_')) {
                const sid = p.id.replace('skin_', '');
                if (!this.state.unlocked.includes(sid)) this.state.unlocked.push(sid);
              }
              if (p.id === 'remove_ads') this.state.adsRemoved = true;
              if (p.id === 'coin_pack_small') this.state.stars += 100;
              Store.save(this.state);
              items.forEach(it => { it.t.destroy(); it.p.destroy(); if (it.b) it.b.destroy(); it.bg.destroy(); });
              title.destroy(); close.destroy(); panel.destroy();
              this.shopOpen = false;
              this.openShop(overlay);
            }
          });
        });
        items.push({ bg: rowBg, t, p: price, b: buy });
      } else {
        items.push({ bg: rowBg, t, p: price });
      }
      y += 56;
    });
    const starTxt = this.add.text(GW / 2, GH - 130, '⭐ ' + (this.state.stars || 0), { fontFamily: 'Arial Black, system-ui', fontSize: '22px', color: '#FFB347' }).setOrigin(0.5).setDepth(61);
    close.on('pointerdown', () => {
      items.forEach(it => { it.t.destroy(); it.p.destroy(); if (it.b) it.b.destroy(); it.bg.destroy(); });
      title.destroy(); close.destroy(); panel.destroy(); starTxt.destroy();
      this.shopOpen = false;
    });
  }

  cycleSkin() {
    const idx = this.state.unlocked.indexOf(this.state.skin);
    const next = this.state.unlocked[(idx + 1) % this.state.unlocked.length];
    this.state.skin = next; Store.save(this.state); Audio.ui();
  }
}

/* =====================================================================
   GAME CONFIG & BOOT
   ===================================================================== */
window.addEventListener('load', () => {
  const config = {
    type: Phaser.AUTO,
    parent: 'game',
    backgroundColor: '#0A0E1A',
    scale: {
      mode: Phaser.Scale.FIT,
      autoCenter: Phaser.Scale.CENTER_BOTH,
      width: GW, height: GH,
    },
    physics: { default: 'arcade', arcade: { gravity: { y: 0 }, debug: false } },
    scene: [BootScene, TitleScene, GameScene],
    fps: { target: 60, forceSetTimeOut: false },
    render: { antialias: true, powerPreference: 'high-performance' },
  };
  window.game = new Phaser.Game(config);
  // PWA service worker (best-effort)
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./sw.js').catch(() => {});
  }
});
