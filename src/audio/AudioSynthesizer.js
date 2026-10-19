// LOOP//BREAK - Procedural Web Audio: rate-limited SFX and a layered, intensity-driven music sequencer.

const NOTE = (n) => 440 * Math.pow(2, (n - 69) / 12);

export class AudioSynthesizer {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.sfxBus = null;
    this.musicBus = null;
    this.sfxEnabled = true;
    this.musicEnabled = true;
    this.sdkMuted = false;
    this.lastPlayed = {};
    this.noiseBuffer = null;

    // Music sequencer state
    this.musicMode = null; // 'menu' | 'run' | 'boss'
    this.intensity = 0; // 0..1, raises layers during a run
    this.step = 0;
    this.nextStepTime = 0;
    this.schedulerTimer = null;
    this.tempo = 118;
  }

  init() {
    if (this.ctx || typeof window === 'undefined') return;
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return;
      this.ctx = new AudioCtx();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.9;
      const comp = this.ctx.createDynamicsCompressor();
      comp.threshold.value = -14;
      comp.ratio.value = 4;
      this.master.connect(comp);
      comp.connect(this.ctx.destination);
      this.sfxBus = this.ctx.createGain();
      this.sfxBus.gain.value = 0.55;
      this.sfxBus.connect(this.master);
      this.musicBus = this.ctx.createGain();
      this.musicBus.gain.value = 0.32;
      this.musicBus.connect(this.master);
      const len = this.ctx.sampleRate * 0.5;
      this.noiseBuffer = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      const data = this.noiseBuffer.getChannelData(0);
      for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
      this.applyMute();
    } catch (e) {
      console.warn('Web Audio API not supported', e);
    }
  }

  ensureContext() {
    if (!this.ctx) this.init();
    if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume();
  }

  applyMute() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this.sfxBus.gain.setTargetAtTime(this.sfxEnabled && !this.sdkMuted ? 0.55 : 0, t, 0.02);
    this.musicBus.gain.setTargetAtTime(this.musicEnabled && !this.sdkMuted ? 0.32 : 0, t, 0.05);
  }

  setSdkMute(muted) {
    this.sdkMuted = !!muted;
    this.applyMute();
  }

  setSfxEnabled(v) {
    this.sfxEnabled = !!v;
    this.applyMute();
  }

  setMusicEnabled(v) {
    this.musicEnabled = !!v;
    this.applyMute();
  }

  // Returns a usable context only if SFX should play and the rate limit allows it.
  sfx(key, minGap = 0) {
    if (!this.ctx || !this.sfxEnabled || this.sdkMuted) return null;
    const now = this.ctx.currentTime;
    if (minGap > 0) {
      if (this.lastPlayed[key] && now - this.lastPlayed[key] < minGap) return null;
      this.lastPlayed[key] = now;
    }
    return this.ctx;
  }

  tone(ctx, { type = 'sine', freq = 440, freqEnd = null, start = 0, dur = 0.15, vol = 0.3, bus = this.sfxBus, filter = null }) {
    const t = ctx.currentTime + start;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);
    if (freqEnd) osc.frequency.exponentialRampToValueAtTime(Math.max(1, freqEnd), t + dur);
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(vol, t + 0.008);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    let node = osc;
    if (filter) {
      const f = ctx.createBiquadFilter();
      f.type = filter.type;
      f.frequency.setValueAtTime(filter.freq, t);
      if (filter.freqEnd) f.frequency.exponentialRampToValueAtTime(filter.freqEnd, t + dur);
      f.Q.value = filter.q || 1;
      osc.connect(f);
      node = f;
    }
    node.connect(gain);
    gain.connect(bus);
    osc.start(t);
    osc.stop(t + dur + 0.02);
  }

  noise(ctx, { start = 0, dur = 0.1, vol = 0.3, type = 'bandpass', freq = 1200, freqEnd = null, q = 1, bus = this.sfxBus }) {
    const t = ctx.currentTime + start;
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    const f = ctx.createBiquadFilter();
    f.type = type;
    f.frequency.setValueAtTime(freq, t);
    if (freqEnd) f.frequency.exponentialRampToValueAtTime(freqEnd, t + dur);
    f.Q.value = q;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(vol, t);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f);
    f.connect(gain);
    gain.connect(bus);
    src.start(t);
    src.stop(t + dur + 0.02);
  }

  // ---------- SFX ----------
  playClick() {
    const c = this.sfx('click', 0.03); if (!c) return;
    this.tone(c, { type: 'square', freq: 1400, freqEnd: 900, dur: 0.05, vol: 0.08 });
  }
  playHover() {
    const c = this.sfx('hover', 0.05); if (!c) return;
    this.tone(c, { type: 'sine', freq: 2200, dur: 0.03, vol: 0.03 });
  }
  playShoot() {
    const c = this.sfx('shoot', 0.07); if (!c) return;
    this.tone(c, { type: 'triangle', freq: 980, freqEnd: 420, dur: 0.07, vol: 0.06 });
  }
  playNova() {
    const c = this.sfx('nova', 0.1); if (!c) return;
    this.tone(c, { type: 'sine', freq: 180, freqEnd: 50, dur: 0.3, vol: 0.35 });
    this.noise(c, { dur: 0.2, vol: 0.1, freq: 600, freqEnd: 200 });
  }
  playArc() {
    const c = this.sfx('arc', 0.08); if (!c) return;
    this.noise(c, { dur: 0.09, vol: 0.12, type: 'highpass', freq: 3000 });
    this.tone(c, { type: 'sawtooth', freq: 1800, freqEnd: 600, dur: 0.08, vol: 0.05 });
  }
  playLance() {
    const c = this.sfx('lance', 0.08); if (!c) return;
    this.tone(c, { type: 'sawtooth', freq: 300, freqEnd: 1600, dur: 0.12, vol: 0.07, filter: { type: 'lowpass', freq: 3000 } });
  }
  playMine() {
    const c = this.sfx('mine', 0.06); if (!c) return;
    this.noise(c, { dur: 0.22, vol: 0.22, type: 'lowpass', freq: 900, freqEnd: 120 });
  }
  playEnemyDie() {
    const c = this.sfx('die', 0.045); if (!c) return;
    this.noise(c, { dur: 0.08, vol: 0.12, freq: 1800 + Math.random() * 800, q: 3 });
  }
  playEnemyBurst() {
    const c = this.sfx('burst', 0.2); if (!c) return;
    this.tone(c, { type: 'square', freq: 260, freqEnd: 140, dur: 0.15, vol: 0.06 });
  }
  playXp() {
    const c = this.sfx('xp', 0.035); if (!c) return;
    const n = 84 + Math.floor(Math.random() * 5) * 2;
    this.tone(c, { type: 'sine', freq: NOTE(n), dur: 0.06, vol: 0.05 });
  }
  playHit() {
    const c = this.sfx('hit', 0.08); if (!c) return;
    this.tone(c, { type: 'sawtooth', freq: 170, freqEnd: 40, dur: 0.25, vol: 0.32 });
    this.noise(c, { dur: 0.15, vol: 0.2, type: 'lowpass', freq: 1200 });
  }
  playDash() {
    const c = this.sfx('dash', 0.05); if (!c) return;
    this.noise(c, { dur: 0.16, vol: 0.2, freq: 700, freqEnd: 2600, q: 2 });
  }
  playHeal() {
    const c = this.sfx('heal', 0.1); if (!c) return;
    [72, 76, 79].forEach((n, i) => this.tone(c, { type: 'triangle', freq: NOTE(n), start: i * 0.06, dur: 0.18, vol: 0.12 }));
  }
  playFlux() {
    const c = this.sfx('flux', 0.06); if (!c) return;
    this.tone(c, { type: 'triangle', freq: NOTE(88), dur: 0.1, vol: 0.1 });
    this.tone(c, { type: 'triangle', freq: NOTE(95), start: 0.05, dur: 0.12, vol: 0.08 });
  }
  playLevelUp() {
    const c = this.sfx('lvl', 0.1); if (!c) return;
    [67, 71, 74, 79, 83].forEach((n, i) => this.tone(c, { type: 'triangle', freq: NOTE(n), start: i * 0.05, dur: 0.3, vol: 0.13 }));
  }
  playPick() {
    const c = this.sfx('pick', 0.05); if (!c) return;
    this.tone(c, { type: 'square', freq: NOTE(79), freqEnd: NOTE(91), dur: 0.12, vol: 0.08 });
    this.noise(c, { dur: 0.25, vol: 0.08, type: 'highpass', freq: 4000 });
  }
  playChest() {
    const c = this.sfx('chest', 0.2); if (!c) return;
    [60, 64, 67, 72, 76, 79, 84].forEach((n, i) => this.tone(c, { type: 'triangle', freq: NOTE(n), start: i * 0.045, dur: 0.35, vol: 0.1 }));
  }
  playEchoOnline() {
    const c = this.sfx('echo', 0.5); if (!c) return;
    [55, 62, 67, 74].forEach((n, i) => this.tone(c, { type: 'sine', freq: NOTE(n), start: i * 0.12, dur: 0.6, vol: 0.12 }));
    this.tone(c, { type: 'sawtooth', freq: 110, freqEnd: 880, dur: 0.6, vol: 0.04, filter: { type: 'lowpass', freq: 400, freqEnd: 4000 } });
  }
  playEchoJam() {
    const c = this.sfx('jam', 0.3); if (!c) return;
    this.tone(c, { type: 'square', freq: 420, freqEnd: 90, dur: 0.25, vol: 0.08 });
  }
  playLoopCapture(count) {
    const c = this.sfx('loop', 0.05); if (!c) return;
    const root = 60 + Math.min(12, count);
    [0, 7, 12, 16].forEach((iv, i) => this.tone(c, { type: 'triangle', freq: NOTE(root + iv), start: i * 0.035, dur: 0.4, vol: 0.12 }));
    this.noise(c, { dur: 0.35, vol: 0.14, freq: 400, freqEnd: 5000, q: 1.5 });
  }
  playLoopEmpty() {
    const c = this.sfx('loop0', 0.2); if (!c) return;
    this.tone(c, { type: 'sine', freq: NOTE(72), freqEnd: NOTE(79), dur: 0.12, vol: 0.05 });
  }
  playParadox(depth = 0) {
    const c = this.sfx('paradox', 0.04); if (!c) return;
    this.tone(c, { type: 'sine', freq: 140 - depth * 10, freqEnd: 35, dur: 0.45, vol: 0.4 });
    this.tone(c, { type: 'sawtooth', freq: NOTE(76 + depth * 3), freqEnd: NOTE(64), dur: 0.25, vol: 0.06, filter: { type: 'lowpass', freq: 2400 } });
    this.noise(c, { dur: 0.3, vol: 0.18, type: 'lowpass', freq: 2000, freqEnd: 200 });
  }
  playBossWarn() {
    const c = this.sfx('warn', 0.8); if (!c) return;
    for (let i = 0; i < 3; i++) this.tone(c, { type: 'sawtooth', freq: 220, freqEnd: 180, start: i * 0.35, dur: 0.28, vol: 0.12, filter: { type: 'lowpass', freq: 1200 } });
  }
  playBossDefeated() {
    const c = this.sfx('bossdown', 1); if (!c) return;
    this.tone(c, { type: 'sine', freq: 90, freqEnd: 30, dur: 1.2, vol: 0.5 });
    [60, 67, 72, 76, 79, 84, 88].forEach((n, i) => this.tone(c, { type: 'triangle', freq: NOTE(n), start: 0.3 + i * 0.07, dur: 0.6, vol: 0.12 }));
  }
  playGameOver() {
    const c = this.sfx('over', 1); if (!c) return;
    [64, 60, 57, 52].forEach((n, i) => this.tone(c, { type: 'triangle', freq: NOTE(n), freqEnd: NOTE(n) * 0.97, start: i * 0.16, dur: 0.45, vol: 0.14 }));
  }

  // ---------- Music: lookahead step sequencer ----------
  setMusic(mode) {
    if (this.musicMode === mode) return;
    this.musicMode = mode;
    if (!mode) {
      clearInterval(this.schedulerTimer);
      this.schedulerTimer = null;
      return;
    }
    this.tempo = mode === 'menu' ? 96 : mode === 'boss' ? 138 : 122;
    if (!this.schedulerTimer) {
      this.ensureContext();
      if (!this.ctx) return;
      this.step = 0;
      this.nextStepTime = this.ctx.currentTime + 0.05;
      this.schedulerTimer = setInterval(() => this.schedule(), 25);
    }
  }

  setIntensity(v) {
    this.intensity = Math.max(0, Math.min(1, v));
  }

  schedule() {
    if (!this.ctx || !this.musicMode) return;
    const stepDur = 60 / this.tempo / 4;
    // Skip ahead if the tab was throttled so we never burst-schedule a backlog
    if (this.nextStepTime < this.ctx.currentTime - 0.2) this.nextStepTime = this.ctx.currentTime + 0.05;
    while (this.nextStepTime < this.ctx.currentTime + 0.12) {
      this.playStep(this.step, this.nextStepTime, stepDur);
      this.nextStepTime += stepDur;
      this.step = (this.step + 1) % 64;
    }
  }

  playStep(step, t, stepDur) {
    const c = this.ctx;
    const bus = this.musicBus;
    const mode = this.musicMode;
    const bar = Math.floor(step / 16) % 4;
    const s = step % 16;
    // i - VI - III - VII in A minor
    const roots = mode === 'boss' ? [45, 46, 45, 43] : [45, 41, 48, 43];
    const root = roots[bar];
    const at = (t2) => t2 - c.currentTime;

    // Bass: driving eighths during runs, sparse in the menu
    if (mode === 'menu' ? s % 8 === 0 : s % 2 === 0) {
      const n = root - 12 + (mode !== 'menu' && s % 8 === 6 ? 12 : 0);
      this.tone(c, { type: 'sawtooth', freq: NOTE(n), start: at(t), dur: stepDur * 1.8, vol: 0.16, bus, filter: { type: 'lowpass', freq: 380 + this.intensity * 600, freqEnd: 120 } });
    }

    if (mode !== 'menu') {
      // Kick on quarters, snare on 2 and 4 once intensity builds
      if (s % 4 === 0) this.tone(c, { type: 'sine', freq: 150, freqEnd: 42, start: at(t), dur: 0.18, vol: 0.38, bus });
      if (this.intensity > 0.25 && (s === 4 || s === 12)) this.noise(c, { start: at(t), dur: 0.12, vol: 0.13, type: 'bandpass', freq: 1800, q: 0.8, bus });
      if (s % 2 === 1) this.noise(c, { start: at(t), dur: 0.03, vol: 0.05 + this.intensity * 0.04, type: 'highpass', freq: 7000, bus });
    }

    // Arpeggio layer: always in the menu, fades in as the run heats up
    const arpOn = mode === 'menu' || this.intensity > 0.12;
    if (arpOn && (mode === 'menu' ? s % 2 === 0 : true)) {
      const chord = [0, 3, 7, 10, 12, 7, 3, 0];
      const n = root + 24 + chord[(step + bar) % chord.length];
      const vol = mode === 'menu' ? 0.05 : 0.025 + this.intensity * 0.035;
      this.tone(c, { type: 'triangle', freq: NOTE(n), start: at(t), dur: stepDur * 0.9, vol, bus });
    }

    // Pad on each bar
    if (s === 0) {
      [0, 3, 7].forEach(iv => this.tone(c, { type: 'sine', freq: NOTE(root + 12 + iv), start: at(t), dur: stepDur * 16, vol: 0.035, bus }));
    }
  }
}

export const audio = new AudioSynthesizer();
