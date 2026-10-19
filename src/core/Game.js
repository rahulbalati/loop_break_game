// LOOP//BREAK - Game shell: state machine, fixed-timestep loop, viewport, and glue between Run, UI and SDK.
import { CONFIG } from '../config.js';
import { Run } from './Run.js';
import { Renderer } from '../render/Renderer.js';
import { InputManager } from '../input/InputManager.js';
import { UI } from '../ui/UI.js';
import { buildDraft, applyOption } from '../systems/DraftSystem.js';
import { computeRunFlux } from '../systems/Economy.js';
import { saveSystem } from '../systems/SaveSystem.js';
import { platform } from '../systems/CrazyGamesSDK.js';
import { audio } from '../audio/AudioSynthesizer.js';
import { SKINS } from '../data/meta.js';
import { ENEMIES } from '../data/enemies.js';

// States: HUB | RUN | DRAFT | PAUSED | REVIVE | RESULTS | BUSY (waiting on an ad)
export class Game {
  constructor(canvas) {
    this.canvas = canvas;
    this.renderer = new Renderer(canvas);
    this.input = new InputManager(canvas);
    this.ui = null;
    this.state = 'BOOT';
    this.run = null;
    this.draftQueue = [];
    this.currentDraft = null;
    this.lastSummary = null;
    this.lastFlux = 0;
    this.time = 0;
    this.accumulator = 0;
    this.lastFrame = 0;
    this.slowFrames = 0;
    this.lowQuality = false;
    this.isTouch = typeof window !== 'undefined' && ('ontouchstart' in window || navigator.maxTouchPoints > 0);
    // Show the joystick and DASH button before the first touch so mobile players see the controls
    this.input.joystick.isTouchDevice = this.isTouch;
  }

  start() {
    this.ui = new UI(this);
    this.applySettings();
    this.handleResize();
    window.addEventListener('resize', () => this.handleResize());
    window.addEventListener('orientationchange', () => setTimeout(() => this.handleResize(), 150));
    document.addEventListener('visibilitychange', () => {
      if (document.hidden && this.state === 'RUN') this.pause();
      if (!document.hidden) audio.ensureContext();
    });

    // New players land straight in gameplay; returning players get the hub.
    if (saveSystem.isFirstSession) this.startRun();
    else this.goHubNow();

    this.lastFrame = performance.now();
    requestAnimationFrame((t) => this.frame(t));
  }

  applySettings() {
    const s = saveSystem.data.settings;
    audio.setSfxEnabled(s.sfx);
    audio.setMusicEnabled(s.music);
    this.renderer.shakeEnabled = s.shake;
    if (this.run) this.run.showDamageNumbers = s.damageNumbers;
  }

  handleResize() {
    const cssW = window.innerWidth || 1280;
    const cssH = window.innerHeight || 720;
    const vh = Math.round(Math.max(CONFIG.MIN_VIRTUAL_HEIGHT, Math.min(CONFIG.MAX_VIRTUAL_HEIGHT, cssH * 1.25)));
    const vw = Math.round(vh * (cssW / cssH));
    const maxDpr = this.lowQuality ? 1 : 2;
    const dpr = Math.min(maxDpr, (window.devicePixelRatio || 1) * (cssH / vh));
    this.viewW = vw;
    this.viewH = vh;
    this.renderer.resize(vw, vh, Math.max(1, dpr));
    this.input.updateLayout(vw, vh);
    if (this.run) {
      this.run.viewW = vw;
      this.run.viewH = vh;
    }
    const portrait = this.isTouch && cssH > cssW;
    this.ui?.setRotatePrompt(portrait);
    if (portrait && this.state === 'RUN') this.pause();
  }

  // ---------- Flow ----------

  startRun() {
    if (this.state === 'BUSY') return;
    const d = saveSystem.data;
    const skin = SKINS.find(s => s.id === d.selectedSkin);
    this.run = new Run({
      characterId: d.selectedCharacter,
      stageId: 'neon_grid',
      lab: d.lab,
      seed: (Math.random() * 2 ** 31) | 0,
      viewW: this.viewW,
      viewH: this.viewH,
      skinColor: skin && skin.color,
      showDamageNumbers: d.settings.damageNumbers,
    });
    this.renderer.prewarm(ENEMIES, this.run.player.color);
    this.draftQueue = [];
    this.currentDraft = null;
    this.renderer.camX = 0;
    this.renderer.camY = 0;
    this.hintState = { moved: false };
    this.state = 'RUN';
    this.ui.showHud(this.run);
    this.input.setGameplayActive(true);
    audio.ensureContext();
    audio.setMusic('run');
    audio.setIntensity(0);
    platform.gameplayStart();
  }

  pause() {
    if (this.state !== 'RUN') return;
    this.state = 'PAUSED';
    this.input.setGameplayActive(false);
    this.ui.showPause(this.run);
    platform.gameplayStop();
  }

  resume() {
    if (this.state !== 'PAUSED') return;
    this.ui.hidePause();
    this.state = 'RUN';
    this.input.setGameplayActive(true);
    platform.gameplayStart();
  }

  abandonRun() {
    if (this.state !== 'PAUSED') return;
    this.ui.hidePause();
    this.endRun();
  }

  // ---------- Drafts ----------

  openNextDraft() {
    const run = this.run;
    let draft = null;
    if (this.draftQueue.length > 0) {
      draft = this.draftQueue.shift();
    } else if (run.pendingLevelUps > 0) {
      run.pendingLevelUps -= 1;
      draft = { kind: 'level', options: buildDraft(run, 3) };
      audio.playLevelUp();
    }
    if (!draft) return false;
    this.currentDraft = draft;
    this.state = 'DRAFT';
    this.input.setGameplayActive(false);
    this.ui.showDraft(draft.options, { kind: draft.kind, level: run.level, rerolls: run.rerolls });
    return true;
  }

  pickDraft(index) {
    if (this.state !== 'DRAFT' || !this.currentDraft) return;
    const opt = this.currentDraft.options[index];
    if (!opt) return;
    applyOption(this.run, opt);
    audio.playPick();
    this.currentDraft = null;
    this.ui.hideDraft();
    this.ui.renderBuild(this.run);
    if (!this.openNextDraft()) {
      this.state = 'RUN';
      this.input.setGameplayActive(true);
    }
  }

  reroll() {
    if (this.state !== 'DRAFT' || !this.currentDraft || this.currentDraft.kind !== 'level' || this.run.rerolls <= 0) return;
    this.run.rerolls -= 1;
    this.currentDraft.options = buildDraft(this.run, 3);
    this.ui.showDraft(this.currentDraft.options, { kind: 'level', level: this.run.level, rerolls: this.run.rerolls });
  }

  // ---------- Death / revive / results ----------

  onDeath() {
    this.input.setGameplayActive(false);
    platform.gameplayStop();
    if (this.run.revivesLeft > 0 && this.run.time > 20) {
      this.state = 'REVIVE';
      this.ui.setReviveBusy(false);
      this.ui.showRevive(8, () => this.declineRevive());
    } else {
      this.endRun();
    }
  }

  acceptRevive() {
    if (this.state !== 'REVIVE') return;
    this.state = 'BUSY';
    this.ui.setReviveBusy(true);
    platform.requestRewardedAd(
      () => {
        this.ui.hideRevive();
        this.run.revive();
        this.ui.toast({ title: 'REWOUND', text: 'Back in the loop', kind: 'echo' });
        this.state = 'RUN';
        this.input.setGameplayActive(true);
        platform.gameplayStart();
      },
      () => {
        this.ui.hideRevive();
        this.endRun();
      }
    );
  }

  declineRevive() {
    if (this.state !== 'REVIVE') return;
    this.ui.hideRevive();
    this.endRun();
  }

  endRun() {
    const run = this.run;
    const summary = run.summary();
    const flux = computeRunFlux(summary, saveSystem.labLevel('greed'));
    summary.flux = flux;
    const { newRecords, unlockedCharacters } = saveSystem.recordRun(summary);
    this.lastSummary = summary;
    this.lastFlux = flux;
    this.state = 'RESULTS';
    this.input.setGameplayActive(false);
    platform.gameplayStop();
    audio.setMusic('menu');
    if (!summary.bossKilled) audio.playGameOver();
    if (newRecords.length > 0 || unlockedCharacters.length > 0) platform.happytime();
    this.ui.showResults({ summary, flux, newRecords, unlocked: unlockedCharacters, canDouble: true });
  }

  doubleFlux() {
    if (this.state !== 'RESULTS' || this.lastFlux <= 0) return;
    this.state = 'BUSY';
    this.ui.setDoubleBusy(true);
    platform.requestRewardedAd(
      () => {
        saveSystem.addFlux(this.lastFlux);
        this.lastFlux *= 2;
        this.ui.updateResultsFlux(this.lastFlux);
        audio.playChest();
        this.state = 'RESULTS';
      },
      () => {
        this.ui.setDoubleBusy(false);
        this.state = 'RESULTS';
      }
    );
  }

  // Midgame ads only at the run-end break, skipped after a player's very first run.
  afterBreakAd(next) {
    if (saveSystem.data.stats.runs <= 1) {
      next();
      return;
    }
    this.state = 'BUSY';
    platform.requestMidgameAd(next, CONFIG.MIN_SECONDS_BETWEEN_MIDGAME_ADS);
  }

  retry() {
    if (this.state !== 'RESULTS') return;
    this.afterBreakAd(() => {
      this.state = 'RESULTS';
      this.startRun();
    });
  }

  goHub() {
    if (this.state !== 'RESULTS') return;
    this.afterBreakAd(() => this.goHubNow());
  }

  goHubNow() {
    this.run = null;
    this.state = 'HUB';
    this.input.setGameplayActive(false);
    platform.gameplayStop();
    this.ui.showHub();
    audio.setMusic('menu');
  }

  // ---------- Events from the simulation ----------

  processEvents() {
    const run = this.run;
    const events = run.events;
    for (let i = 0; i < events.length; i++) {
      const ev = events[i];
      switch (ev.type) {
        case 'toast':
          this.ui.toast(ev);
          break;
        case 'warning':
          this.ui.toast({ title: ev.title, text: ev.text, kind: 'danger' });
          break;
        case 'boss':
          this.ui.showBossBar(ev.name);
          audio.setMusic('boss');
          break;
        case 'bossDefeated':
          this.ui.hideBossBar();
          this.ui.toast({ title: 'LOOP BROKEN', text: 'Overtime: survive for bonus Flux', kind: 'win' });
          audio.setMusic('run');
          platform.happytime();
          break;
        case 'cache':
          this.draftQueue.push({ kind: 'cache', options: ev.options });
          break;
        case 'hurt':
          this.ui.hurtFlash();
          if (!saveSystem.data.tips.dash) {
            saveSystem.markTip('dash');
            this.ui.toast({ title: 'TIP', text: this.isTouch ? 'Tap DASH to phase through enemies' : 'Press SPACE to dash through enemies', kind: 'info' });
          }
          break;
        case 'loop':
          if (ev.count > 0 && !saveSystem.data.tips.loop) saveSystem.markTip('loop');
          break;
        case 'happy':
          platform.happytime();
          break;
        case 'death':
          this.onDeath();
          break;
      }
    }
    events.length = 0;
  }

  // Context hints for new players, shown until they perform the action once
  updateHints() {
    const run = this.run;
    const tips = saveSystem.data.tips;
    let hint = null;
    if (!this.hintState.moved) {
      if (Math.hypot(run.player.vx, run.player.vy) > 60 && run.time > 1.5) this.hintState.moved = true;
      else hint = this.isTouch ? '<b>DRAG</b> anywhere on the left to move' : '<b>WASD</b> / <b>ARROWS</b> to move — weapons fire on their own';
    } else if (!tips.loop && run.echoOnline && run.time > 12) {
      hint = '<b>CIRCLE</b> around enemies to close a loop — everything inside <b>shatters</b>';
    } else if (tips.loop && !tips.paradox && run.stats.echoCount > 0 && run.time > 40) {
      if (run.paradoxes > 0) saveSystem.markTip('paradox');
      else hint = 'Lead enemies into your <b>glowing echo</b> to trigger a <b>PARADOX</b> blast';
    }
    this.ui.hint(hint);
  }

  // ---------- Loop ----------

  frame(now) {
    const dt = Math.max(0, Math.min(0.1, (now - this.lastFrame) / 1000));
    this.lastFrame = Math.max(this.lastFrame, now);
    this.time += dt;
    this.trackPerformance(dt);

    if (this.state === 'RUN') {
      this.accumulator += dt;
      const step = CONFIG.FIXED_DT;
      while (this.accumulator >= step && this.state === 'RUN') {
        this.input.update();
        if (this.input.consumePause()) {
          this.pause();
          break;
        }
        const mv = this.input.moveVector;
        this.run.update(step, { x: mv.x, y: mv.y, dash: this.input.consumeDash() });
        this.accumulator -= step;
        this.processEvents();
        if (this.state === 'RUN' && (this.run.pendingLevelUps > 0 || this.draftQueue.length > 0)) this.openNextDraft();
      }
      if (this.state !== 'RUN') this.accumulator = 0;
      if (this.run) {
        this.ui.updateHud(this.run);
        if (this.state === 'RUN') this.updateHints();
        const p = this.run.player;
        this.input.joystick.setCooldown(p.dashCd / CONFIG.PLAYER.DASH_COOLDOWN);
        audio.setIntensity(Math.min(1, this.run.time / 420 + this.run.enemies.length / 400));
      }
    } else if (this.run && this.state !== 'HUB') {
      // Keep effects animating behind drafts / pause so the screen never looks frozen
      this.run.particles.update(dt * 0.25);
    }

    const ctx = this.renderer.ctx;
    if (this.state === 'HUB' || !this.run) {
      this.renderer.renderHub(this.time, saveSystem.data.selectedCharacter, (SKINS.find(s => s.id === saveSystem.data.selectedSkin) || {}).color);
    } else {
      this.renderer.renderRun(this.run, this.time);
      if (this.state === 'RUN') {
        ctx.setTransform(this.renderer.dpr, 0, 0, this.renderer.dpr, 0, 0);
        this.input.render(ctx);
      }
    }
    requestAnimationFrame((t) => this.frame(t));
  }

  // Drops to 1x resolution if the device can't hold ~45fps
  trackPerformance(dt) {
    if (this.lowQuality || this.state !== 'RUN') return;
    if (dt > 1 / 45) this.slowFrames += 1;
    else this.slowFrames = Math.max(0, this.slowFrames - 0.5);
    if (this.slowFrames > 90) {
      this.lowQuality = true;
      this.handleResize();
    }
  }
}
