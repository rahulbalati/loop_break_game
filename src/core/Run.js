// LOOP//BREAK - One run of the game: pure simulation, no DOM or canvas access.
// The Game reads `events` each frame to drive UI (drafts, toasts, death, boss).

import { CONFIG, xpForLevel } from '../config.js';
import { WEAPONS, weaponStats } from '../data/weapons.js';
import { PASSIVES } from '../data/passives.js';
import { ENEMIES } from '../data/enemies.js';
import { getStage } from '../data/stages.js';
import { getCharacter } from '../data/characters.js';
import { createRng, weightedPick, segmentIntersection, polygonArea, pointInPolygon, distToSegmentSq } from './math.js';
import { SpatialHash } from './SpatialHash.js';
import { ParticleSystem } from '../systems/ParticleSystem.js';
import { buildCacheOptions } from '../systems/DraftSystem.js';
import { audio } from '../audio/AudioSynthesizer.js';

const HIST_LEN = CONFIG.ECHO.HISTORY_SECONDS * CONFIG.ECHO.HISTORY_HZ;
const BOSS_HIST_LEN = 4 * 60;
const MAX_ENEMY_RADIUS = 60;

export class Run {
  constructor({ characterId = 'cipher', stageId = 'neon_grid', lab = {}, seed = Date.now(), viewW = 1280, viewH = 720, skinColor = null, showDamageNumbers = true } = {}) {
    this.rng = createRng(seed);
    this.seed = seed;
    this.stage = getStage(stageId);
    this.character = getCharacter(characterId);
    this.lab = lab;
    this.viewW = viewW;
    this.viewH = viewH;
    this.showDamageNumbers = showDamageNumbers;

    this.time = 0;
    this.kills = 0;
    this.loopKills = 0;
    this.paradoxes = 0;
    this.fluxPickups = 0;
    this.damageDealt = 0;
    this.level = 1;
    this.xp = 0;
    this.xpNeed = xpForLevel(1);
    this.pendingLevelUps = 0;
    this.revivesLeft = CONFIG.RUN.REVIVES;
    this.rerolls = lab.reroll || 0;
    this.dead = false;
    this.events = [];
    this.evolutions = [];

    this.player = {
      x: 0, y: 0, vx: 0, vy: 0, r: CONFIG.PLAYER.RADIUS,
      hp: 1, fx: 1, fy: 0,
      dashTimer: 0, dashCd: 0, dashX: 0, dashY: 0,
      invuln: 0, hitFlash: 0,
      color: skinColor || this.character.color,
    };

    // Movement history ring buffer: x, y, facingX, facingY
    this.history = new Float32Array(HIST_LEN * 4);
    this.histHead = 0;
    this.histCount = 0;
    this.echoes = [];
    for (let i = 0; i < CONFIG.ECHO.MAX; i++) {
      this.echoes.push({ index: i, x: 0, y: 0, fx: 1, fy: 0, active: false, alpha: 0, paradoxTimer: 2, disabled: 0, r: CONFIG.ECHO.RADIUS });
    }
    this.echoOnline = false;

    this.trail = [];
    this.loopCooldown = 0;
    this.loopFx = [];

    this.enemies = [];
    this.nextEnemyId = 1;
    this.hash = new SpatialHash(64);
    this.queryBuf = [];
    this.blastBuf = []; // separate buffer: explosions happen while iterating queryBuf
    this.bullets = [];
    this.projectiles = [];
    this.mines = [];
    this.gems = [];
    this.pickups = [];
    this.rings = [];
    this.beams = [];
    this.bolts = [];
    this.texts = [];
    this.particles = new ParticleSystem(this.rng);
    this.orbitPoints = [];

    this.weapons = [];
    this.passives = {};

    this.spawnAccum = 0;
    this.eventIndex = 0;
    this.warnedIndex = 0;
    this.boss = null;
    this.bossDefeatedAt = 0;
    this.bossKilled = false;

    this.shake = 0;
    this.hitstop = 0;
    this.flash = 0;
    this.combo = 0;
    this.comboTimer = 0;

    this.addWeapon(this.character.startWeapon);
    this.recomputeStats();
    this.player.hp = this.stats.maxHp;
  }

  // ---------- Stats ----------

  recomputeStats() {
    const ch = this.character;
    const mods = ch.mods || {};
    const s = {
      maxHpBonus: 0, cooldownMult: 1, damageMult: 1, magnetMult: 1, speedMult: 1,
      echoCount: 0, trailMult: 1, paradoxCooldownMult: 1,
    };
    for (const id in this.passives) {
      const lvl = this.passives[id];
      if (lvl > 0 && PASSIVES[id]) PASSIVES[id].apply(s, lvl);
    }
    const lab = this.lab;
    const prevMax = this.stats ? this.stats.maxHp : null;
    this.stats = {
      maxHp: ch.hp + (lab.hull || 0) * 10 + s.maxHpBonus,
      speed: ch.speed * (1 + (lab.thrust || 0) * 0.04) * s.speedMult,
      damageMult: (1 + (lab.might || 0) * 0.06) * s.damageMult,
      cooldownMult: s.cooldownMult,
      magnet: CONFIG.PLAYER.BASE_MAGNET * (1 + (lab.reach || 0) * 0.12) * s.magnetMult,
      echoCount: Math.min(CONFIG.ECHO.MAX, (this.echoOnline ? 1 : 0) + (mods.startEchoes && this.echoOnline ? mods.startEchoes : 0) + s.echoCount),
      echoDamage: mods.echoDamage || 0.6,
      trailSeconds: CONFIG.LOOP.TRAIL_SECONDS * s.trailMult,
      paradoxCooldown: CONFIG.ECHO.PARADOX_COOLDOWN * (mods.paradoxCooldownMult || 1) * s.paradoxCooldownMult,
      paradoxDamage: CONFIG.ECHO.PARADOX_DAMAGE * (mods.paradoxDamageMult || 1),
    };
    if (prevMax !== null && this.stats.maxHp > prevMax) {
      this.player.hp += this.stats.maxHp - prevMax;
    }
    this.player.hp = Math.min(this.player.hp, this.stats.maxHp);
  }

  addWeapon(id) {
    this.weapons.push({ id, level: 1, evolved: null, timers: new Array(CONFIG.ECHO.MAX + 1).fill(0.4), angle: 0 });
  }

  emit(type, data = {}) {
    this.events.push({ type, ...data });
  }

  // ---------- Main update ----------

  update(dt, input) {
    if (this.dead) return;
    this.particles.update(dt);
    this.updateEffects(dt);
    if (this.hitstop > 0) {
      this.hitstop -= dt;
      return;
    }

    this.time += dt;
    this.updatePlayer(dt, input);
    this.recordHistory();
    this.updateEchoes(dt);
    this.updateTrail(dt);
    this.updateDirector(dt);

    this.hash.clear();
    for (const e of this.enemies) if (!e.dead) this.hash.insert(e);

    this.updateEnemies(dt);
    this.updateWeapons(dt);
    this.updateProjectiles(dt);
    this.updateMines(dt);
    this.updateBullets(dt);
    this.updateParadox(dt);
    this.updatePickups(dt);
    this.sweepDead();

    if (this.comboTimer > 0) {
      this.comboTimer -= dt;
      if (this.comboTimer <= 0) this.combo = 0;
    }
    this.shake = Math.max(0, this.shake - dt * 30);
    this.flash = Math.max(0, this.flash - dt * 3);
  }

  updatePlayer(dt, input) {
    const p = this.player;
    const mx = input ? input.x : 0;
    const my = input ? input.y : 0;
    const mag = Math.hypot(mx, my);
    if (mag > 0.05) {
      p.fx = mx / mag;
      p.fy = my / mag;
    }

    p.dashCd = Math.max(0, p.dashCd - dt);
    p.invuln = Math.max(0, p.invuln - dt);
    p.hitFlash = Math.max(0, p.hitFlash - dt);

    if (input && input.dash && p.dashCd <= 0 && p.dashTimer <= 0) {
      p.dashTimer = CONFIG.PLAYER.DASH_TIME;
      p.dashCd = CONFIG.PLAYER.DASH_COOLDOWN;
      p.dashX = p.fx;
      p.dashY = p.fy;
      audio.playDash();
      this.particles.emit(p.x, p.y, { count: 14, color: p.color, speed: 220, life: 0.35, size: 3, angle: Math.atan2(-p.fy, -p.fx), spread: 1.2 });
    }

    if (p.dashTimer > 0) {
      p.dashTimer -= dt;
      p.vx = p.dashX * CONFIG.PLAYER.DASH_SPEED;
      p.vy = p.dashY * CONFIG.PLAYER.DASH_SPEED;
      if (this.rng() < 0.6) this.particles.emit(p.x, p.y, { count: 1, color: p.color, speed: 30, life: 0.3, size: 4 });
    } else {
      const tx = mx * this.stats.speed;
      const ty = my * this.stats.speed;
      const k = Math.min(1, CONFIG.PLAYER.ACCEL * dt);
      p.vx += (tx - p.vx) * k;
      p.vy += (ty - p.vy) * k;
    }
    p.x += p.vx * dt;
    p.y += p.vy * dt;
  }

  get isDashing() {
    return this.player.dashTimer > 0;
  }

  // ---------- Echoes ----------

  recordHistory() {
    const p = this.player;
    const i = this.histHead * 4;
    this.history[i] = p.x;
    this.history[i + 1] = p.y;
    this.history[i + 2] = p.fx;
    this.history[i + 3] = p.fy;
    this.histHead = (this.histHead + 1) % HIST_LEN;
    this.histCount = Math.min(HIST_LEN, this.histCount + 1);
  }

  // Samples the player's position from `delay` seconds ago. Returns false if not enough history yet.
  sampleHistory(delay, out) {
    const back = Math.round(delay * CONFIG.ECHO.HISTORY_HZ);
    if (back >= this.histCount) return false;
    const idx = ((this.histHead - 1 - back) % HIST_LEN + HIST_LEN) % HIST_LEN;
    out.x = this.history[idx * 4];
    out.y = this.history[idx * 4 + 1];
    out.fx = this.history[idx * 4 + 2];
    out.fy = this.history[idx * 4 + 3];
    return true;
  }

  updateEchoes(dt) {
    if (!this.echoOnline && this.level >= 2) {
      this.echoOnline = true;
      this.recomputeStats();
      this.emit('toast', { title: 'ECHO ONLINE', text: 'Your past self now fights beside you', kind: 'echo' });
      audio.playEchoOnline();
    }
    const count = this.stats.echoCount;
    for (const e of this.echoes) {
      const wanted = e.index < count;
      const delay = CONFIG.ECHO.FIRST_DELAY + e.index * CONFIG.ECHO.SPACING;
      const hasPos = wanted && this.sampleHistory(delay, e);
      e.active = hasPos && e.disabled <= 0;
      const targetAlpha = hasPos ? (e.disabled > 0 ? 0.18 : 1) : 0;
      e.alpha += (targetAlpha - e.alpha) * Math.min(1, dt * 6);
      if (e.disabled > 0) e.disabled -= dt;
      if (e.active && e.paradoxTimer > 0) e.paradoxTimer -= dt;
    }
  }

  get emitters() {
    const list = this._emitters || (this._emitters = []);
    list.length = 0;
    const p = this.player;
    list.push({ x: p.x, y: p.y, fx: p.fx, fy: p.fy, mult: 1, slot: 0 });
    for (const e of this.echoes) {
      if (e.active) list.push({ x: e.x, y: e.y, fx: e.fx, fy: e.fy, mult: this.stats.echoDamage, slot: e.index + 1 });
    }
    return list;
  }

  // ---------- Loop capture ----------

  updateTrail(dt) {
    const p = this.player;
    const now = this.time;
    const trail = this.trail;
    const maxAge = this.stats.trailSeconds;
    while (trail.length > 0 && now - trail[0].t > maxAge) trail.shift();
    if (this.loopCooldown > 0) this.loopCooldown -= dt;

    const last = trail[trail.length - 1];
    if (last && Math.hypot(p.x - last.x, p.y - last.y) < CONFIG.LOOP.SAMPLE_DIST) return;
    trail.push({ x: p.x, y: p.y, t: now });
    const n = trail.length;
    if (n < 6 || this.loopCooldown > 0) return;

    const a = trail[n - 2], b = trail[n - 1];
    // Ignore the few most recent segments: they always touch the newest one
    for (let i = n - 5; i >= 0; i--) {
      const c = trail[i], d = trail[i + 1];
      const hit = segmentIntersection(a.x, a.y, b.x, b.y, c.x, c.y, d.x, d.y);
      if (!hit) continue;
      const poly = [hit.x, hit.y];
      for (let k = i + 1; k <= n - 2; k++) poly.push(trail[k].x, trail[k].y);
      if (poly.length >= 8 && polygonArea(poly) >= CONFIG.LOOP.MIN_AREA) {
        this.captureLoop(poly);
        trail.splice(0, n - 1);
      }
      return;
    }
  }

  captureLoop(poly) {
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (let i = 0; i < poly.length; i += 2) {
      minX = Math.min(minX, poly[i]); maxX = Math.max(maxX, poly[i]);
      minY = Math.min(minY, poly[i + 1]); maxY = Math.max(maxY, poly[i + 1]);
    }
    const cx = (minX + maxX) / 2, cy = (minY + maxY) / 2;
    const r = Math.hypot(maxX - minX, maxY - minY) / 2 + MAX_ENEMY_RADIUS;
    const found = this.hash.query(cx, cy, r, this.queryBuf);
    let captured = 0;
    for (const e of found) {
      if (e.dead || !pointInPolygon(e.x, e.y, poly)) continue;
      if (e.boss || e.miniboss) {
        this.damageEnemy(e, e.maxHp * CONFIG.LOOP.BOSS_DAMAGE_PCT, { noText: false });
      } else if (e.elite) {
        this.damageEnemy(e, e.maxHp * CONFIG.LOOP.ELITE_DAMAGE_PCT);
      } else {
        this.damageEnemy(e, e.hp + 1, { noText: true, cause: 'loop' });
        if (e.dead) captured++;
      }
    }
    this.loopCooldown = CONFIG.LOOP.COOLDOWN;
    this.loopFx.push({ poly, life: 0.5, maxLife: 0.5, count: captured });
    this.loopKills += captured;
    if (captured > 0) {
      const label = captured >= 15 ? 'MEGA LOOP' : captured >= 6 ? 'GREAT LOOP' : 'LOOP';
      this.addText(cx, cy - 10, `${label} ×${captured}`, '#e8ff3a', captured >= 6 ? 26 : 20, 1.1);
      this.shake = Math.max(this.shake, Math.min(14, 4 + captured));
      this.hitstop = Math.min(0.08, 0.02 + captured * 0.004);
      this.flash = Math.min(0.5, 0.1 + captured * 0.02);
      audio.playLoopCapture(captured);
      if (captured >= 15) this.emit('happy');
    } else {
      audio.playLoopEmpty();
    }
    this.emit('loop', { count: captured });
  }

  // ---------- Director (spawning) ----------

  currentSegment() {
    const segs = this.stage.segments;
    for (const s of segs) if (this.time >= s.from && this.time < s.to) return s;
    return segs[segs.length - 1];
  }

  updateDirector(dt) {
    const events = this.stage.events;
    // Warn 3 seconds ahead of minibosses / boss
    while (this.warnedIndex < events.length && this.time >= events[this.warnedIndex].t - 3) {
      const ev = events[this.warnedIndex++];
      if (ev.type === 'boss') this.emit('warning', { title: 'WARNING', text: `${ENEMIES[ev.enemy].name} APPROACHES`, boss: true });
      else if (ev.type === 'miniboss') this.emit('warning', { title: 'WARNING', text: `${ENEMIES[ev.enemy].name} INCOMING` });
    }
    while (this.eventIndex < events.length && this.time >= events[this.eventIndex].t) {
      this.runEvent(events[this.eventIndex++]);
    }

    const seg = this.currentSegment();
    let rate = seg.rate;
    if (seg.overtimeRamp && this.bossKilled) rate += (this.time - this.bossDefeatedAt) * seg.overtimeRamp;
    this.spawnAccum += rate * dt;
    while (this.spawnAccum >= 1) {
      this.spawnAccum -= 1;
      if (this.enemies.length >= CONFIG.RUN.MAX_ENEMIES) continue;
      const pos = this.spawnPoint();
      this.spawnEnemy(weightedPick(this.rng, seg.mix), pos.x, pos.y);
    }
  }

  spawnRadius() {
    return Math.hypot(this.viewW, this.viewH) / 2 + 40;
  }

  spawnPoint(angle = null) {
    const p = this.player;
    // Bias spawns toward where the player is heading so the screen ahead fills up
    let a = angle;
    if (a === null) {
      const speed = Math.hypot(p.vx, p.vy);
      a = speed > 40 && this.rng() < 0.55
        ? Math.atan2(p.vy, p.vx) + (this.rng() - 0.5) * 1.6
        : this.rng() * Math.PI * 2;
    }
    const r = this.spawnRadius();
    return { x: p.x + Math.cos(a) * r, y: p.y + Math.sin(a) * r };
  }

  runEvent(ev) {
    const p = this.player;
    switch (ev.type) {
      case 'ring': {
        const r = this.spawnRadius() * 0.85;
        for (let i = 0; i < ev.count; i++) {
          const a = (i / ev.count) * Math.PI * 2;
          this.spawnEnemy(ev.enemy, p.x + Math.cos(a) * r, p.y + Math.sin(a) * r);
        }
        this.emit('toast', { title: 'ENCIRCLED', text: 'Break out — or loop them all', kind: 'danger' });
        break;
      }
      case 'rush': {
        const a = this.rng() * Math.PI * 2;
        for (let i = 0; i < ev.count; i++) {
          const pos = this.spawnPoint(a + (this.rng() - 0.5) * 0.7);
          this.spawnEnemy(ev.enemy, pos.x + (this.rng() - 0.5) * 80, pos.y + (this.rng() - 0.5) * 80);
        }
        this.emit('toast', { title: 'SWARM RUSH', text: 'Incoming from one side', kind: 'danger' });
        break;
      }
      case 'elite': {
        const pos = this.spawnPoint();
        const e = this.spawnEnemy(ev.enemy, pos.x, pos.y, { elite: true });
        if (e) this.emit('toast', { title: 'ELITE DETECTED', text: `Elite ${e.def.name} carries a data cache`, kind: 'elite' });
        break;
      }
      case 'miniboss': {
        const pos = this.spawnPoint();
        this.spawnEnemy(ev.enemy, pos.x, pos.y);
        audio.playBossWarn();
        break;
      }
      case 'boss': {
        const pos = this.spawnPoint();
        this.boss = this.spawnEnemy(ev.enemy, pos.x, pos.y);
        audio.playBossWarn();
        this.emit('boss', { name: ENEMIES[ev.enemy].name });
        break;
      }
    }
  }

  spawnEnemy(type, x, y, { elite = false } = {}) {
    const def = ENEMIES[type];
    if (!def) return null;
    const scale = this.stage.hpScale(this.time);
    const hp = def.hp * scale * (elite ? 7 : 1);
    const e = {
      id: this.nextEnemyId++, type, def, x, y, vx: 0, vy: 0, kx: 0, ky: 0,
      hp, maxHp: hp,
      r: def.radius * (elite ? 1.4 : 1),
      speed: def.speed * (0.92 + this.rng() * 0.16) * (elite ? 1.08 : 1),
      damage: def.damage * (elite ? 1.5 : 1),
      // Later enemies are worth more XP so levels keep coming as the curve steepens
      xp: Math.max(1, Math.round(def.xp * (elite ? 5 : 1) * Math.min(2.4, 1 + this.time / 420))),
      color: def.color,
      elite, boss: !!def.boss, miniboss: !!def.miniboss,
      mass: (def.mass || 1) * (elite ? 3 : 1),
      dead: false, hitFlash: 0, orbitHit: 0, angle: 0,
      fireTimer: def.ranged ? 1 + this.rng() * def.ranged.cooldown : 0,
      burstSpin: 0,
      chargeState: 'chase', chargeTimer: def.charge ? 1 + this.rng() * 2 : 0, chargeX: 0, chargeY: 0,
      phase: 1, fanTimer: 5,
      bossHist: def.boss ? new Float32Array(BOSS_HIST_LEN * 2) : null, bossHead: 0, bossCount: 0,
      echo: null,
    };
    this.enemies.push(e);
    return e;
  }

  // ---------- Enemies ----------

  updateEnemies(dt) {
    const p = this.player;
    const buf = this.queryBuf;
    const recycleDist = Math.max(this.viewW, this.viewH) * 1.15;
    for (const e of this.enemies) {
      if (e.dead) continue;
      e.hitFlash = Math.max(0, e.hitFlash - dt);
      if (e.orbitHit > 0) e.orbitHit -= dt;

      let tx = p.x, ty = p.y;
      if (e.def.targetsEchoes) {
        let best = null, bestD = 600 * 600;
        for (const ec of this.echoes) {
          if (!ec.active) continue;
          const d = (ec.x - e.x) ** 2 + (ec.y - e.y) ** 2;
          if (d < bestD) { bestD = d; best = ec; }
        }
        if (best) {
          tx = best.x; ty = best.y;
          if (bestD < (best.r + e.r) ** 2) {
            best.disabled = 4;
            best.paradoxTimer = Math.max(best.paradoxTimer, 1);
            this.addText(best.x, best.y - 20, 'ECHO JAMMED', '#b45cff', 14, 0.8);
            audio.playEchoJam();
          }
        }
      }

      let dx = tx - e.x, dy = ty - e.y;
      let dist = Math.hypot(dx, dy) || 1;
      dx /= dist; dy /= dist;
      let speed = e.speed;
      let mvx = dx, mvy = dy;

      const ranged = e.def.ranged;
      if (ranged && ranged.keepDistance) {
        const pd = Math.hypot(p.x - e.x, p.y - e.y);
        if (pd < ranged.keepDistance - 30) { mvx = -dx; mvy = -dy; }
        else if (pd < ranged.keepDistance + 30) { mvx = -dy; mvy = dx; speed *= 0.6; }
      }
      if (ranged) this.updateEnemyRanged(e, dt, ranged);

      if (e.def.charge) {
        const c = e.def.charge;
        if (e.chargeState === 'chase') {
          e.chargeTimer -= dt;
          if (e.chargeTimer <= 0 && dist < c.range) {
            e.chargeState = 'windup';
            e.chargeTimer = c.windup;
            e.chargeX = dx; e.chargeY = dy;
          }
        } else if (e.chargeState === 'windup') {
          speed = 0;
          e.chargeTimer -= dt;
          if (e.chargeTimer <= 0) { e.chargeState = 'charge'; e.chargeTimer = c.time; }
        } else {
          mvx = e.chargeX; mvy = e.chargeY; speed = c.speed;
          e.chargeTimer -= dt;
          if (e.chargeTimer <= 0) { e.chargeState = 'chase'; e.chargeTimer = c.cooldown; }
        }
      }

      if (e.boss) this.updateBoss(e, dt);

      e.vx = mvx * speed;
      e.vy = mvy * speed;
      e.x += (e.vx + e.kx) * dt;
      e.y += (e.vy + e.ky) * dt;
      const kd = Math.max(0, 1 - 7 * dt);
      e.kx *= kd; e.ky *= kd;
      if (mvx || mvy) e.angle = Math.atan2(mvy, mvx);

      // Soft separation against a handful of neighbours
      this.hash.query(e.x, e.y, e.r * 2, buf);
      let pushed = 0;
      for (let i = 0; i < buf.length && pushed < 6; i++) {
        const o = buf[i];
        if (o === e || o.dead) continue;
        const ox = e.x - o.x, oy = e.y - o.y;
        const min = e.r + o.r;
        const d2 = ox * ox + oy * oy;
        if (d2 > 0.01 && d2 < min * min) {
          const d = Math.sqrt(d2);
          const push = ((min - d) / d) * 0.5 * (o.mass / (o.mass + e.mass));
          e.x += ox * push;
          e.y += oy * push;
          pushed++;
        }
      }

      // Contact damage
      const pdx = p.x - e.x, pdy = p.y - e.y;
      if (pdx * pdx + pdy * pdy < (p.r + e.r) ** 2) this.hurtPlayer(e.damage);

      // Recycle stragglers far behind the player so pressure stays on screen
      if (!e.boss && !e.miniboss && !e.elite && Math.abs(pdx) + Math.abs(pdy) > recycleDist * 1.3) {
        const pos = this.spawnPoint();
        e.x = pos.x; e.y = pos.y;
      }
    }
  }

  updateEnemyRanged(e, dt, ranged) {
    e.fireTimer -= dt;
    if (e.fireTimer > 0) return;
    e.fireTimer = ranged.cooldown * (e.boss && e.phase === 2 ? 0.75 : 1);
    const p = this.player;
    if (ranged.burst) {
      e.burstSpin += 0.37;
      for (let i = 0; i < ranged.burst; i++) {
        const a = e.burstSpin + (i / ranged.burst) * Math.PI * 2;
        this.fireBullet(e.x, e.y, Math.cos(a) * ranged.bulletSpeed, Math.sin(a) * ranged.bulletSpeed, ranged.damage);
      }
      audio.playEnemyBurst();
    } else {
      const d = Math.hypot(p.x - e.x, p.y - e.y) || 1;
      if (d > 700) return;
      this.fireBullet(e.x, e.y, ((p.x - e.x) / d) * ranged.bulletSpeed, ((p.y - e.y) / d) * ranged.bulletSpeed, ranged.damage);
    }
  }

  updateBoss(e, dt) {
    // Record boss path so its phase-2 echo can replay it
    const i = e.bossHead * 2;
    e.bossHist[i] = e.x;
    e.bossHist[i + 1] = e.y;
    e.bossHead = (e.bossHead + 1) % BOSS_HIST_LEN;
    e.bossCount = Math.min(BOSS_HIST_LEN, e.bossCount + 1);

    if (e.phase === 1 && e.hp < e.maxHp * 0.5) {
      e.phase = 2;
      e.echo = { x: e.x, y: e.y, r: e.r * 0.8, fireTimer: 1.4 };
      this.emit('toast', { title: 'PHASE 2', text: 'The Loopkeeper rewinds itself', kind: 'danger' });
      audio.playBossWarn();
      this.shake = 16;
    }

    const p = this.player;
    e.fanTimer -= dt;
    if (e.fanTimer <= 0) {
      e.fanTimer = e.phase === 2 ? 4 : 6;
      const base = Math.atan2(p.y - e.y, p.x - e.x);
      for (let k = -2; k <= 2; k++) {
        const a = base + k * 0.16;
        this.fireBullet(e.x, e.y, Math.cos(a) * 260, Math.sin(a) * 260, 16);
      }
    }

    if (e.echo) {
      const back = Math.min(e.bossCount - 1, Math.round(2.5 * 60));
      const idx = ((e.bossHead - 1 - back) % BOSS_HIST_LEN + BOSS_HIST_LEN) % BOSS_HIST_LEN;
      e.echo.x = e.bossHist[idx * 2];
      e.echo.y = e.bossHist[idx * 2 + 1];
      e.echo.fireTimer -= dt;
      if (e.echo.fireTimer <= 0) {
        e.echo.fireTimer = 2.8;
        for (let k = 0; k < 12; k++) {
          const a = (k / 12) * Math.PI * 2 + 0.26;
          this.fireBullet(e.echo.x, e.echo.y, Math.cos(a) * 150, Math.sin(a) * 150, 12);
        }
      }
      const dx = p.x - e.echo.x, dy = p.y - e.echo.y;
      if (dx * dx + dy * dy < (p.r + e.echo.r) ** 2) this.hurtPlayer(e.damage * 0.7);
    }
  }

  fireBullet(x, y, vx, vy, damage) {
    if (this.bullets.length > 400) return;
    this.bullets.push({ x, y, vx, vy, damage, r: 6, life: 5 });
  }

  updateBullets(dt) {
    const p = this.player;
    const bs = this.bullets;
    for (let i = bs.length - 1; i >= 0; i--) {
      const b = bs[i];
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      b.life -= dt;
      const dx = p.x - b.x, dy = p.y - b.y;
      let remove = b.life <= 0;
      if (!remove && dx * dx + dy * dy < (p.r + b.r) ** 2) {
        if (this.hurtPlayer(b.damage) || this.isDashing) remove = true;
      }
      if (remove) {
        bs[i] = bs[bs.length - 1];
        bs.pop();
      }
    }
  }

  // ---------- Damage ----------

  damageEnemy(e, amount, { kx = 0, ky = 0, noText = false, cause = 'weapon', color = null } = {}) {
    if (e.dead) return;
    this.damageDealt += Math.min(amount, Math.max(0, e.hp));
    e.hp -= amount;
    e.hitFlash = 0.07;
    const resist = e.boss ? 0.05 : e.miniboss ? 0.2 : 1 / e.mass;
    e.kx += kx * resist;
    e.ky += ky * resist;
    if (!noText && this.showDamageNumbers) {
      this.addText(e.x + (this.rng() - 0.5) * 10, e.y - e.r, String(Math.round(amount)), color || '#ffffff', amount >= 60 ? 17 : 13, 0.5);
    }
    if (e.hp <= 0) this.killEnemy(e, cause);
  }

  killEnemy(e, cause) {
    e.dead = true;
    this.kills += 1;
    this.combo += 1;
    this.comboTimer = 1.6;
    this.particles.emit(e.x, e.y, { count: e.boss ? 80 : e.miniboss ? 40 : e.elite ? 26 : 9, color: e.color, speed: e.boss ? 420 : 200, life: 0.5, size: e.r > 20 ? 4.5 : 3 });
    audio.playEnemyDie();

    this.dropXp(e.x, e.y, e.xp);
    const r = this.rng();
    if (e.elite || e.miniboss) {
      this.pickups.push({ type: 'cache', x: e.x, y: e.y, r: 16, t: 0 });
      if (e.miniboss) this.pickups.push({ type: 'heal', x: e.x + 30, y: e.y, r: 11, t: 0 });
    } else if (r < 0.012) {
      this.pickups.push({ type: 'flux', x: e.x, y: e.y, r: 9, t: 0, value: 1 + Math.floor(this.rng() * 3) });
    } else if (r < 0.016) {
      this.pickups.push({ type: 'heal', x: e.x, y: e.y, r: 11, t: 0 });
    } else if (r < 0.0175) {
      this.pickups.push({ type: 'vacuum', x: e.x, y: e.y, r: 12, t: 0 });
    }

    if (e.def.split) {
      for (let i = 0; i < e.def.split.count; i++) {
        const a = (i / e.def.split.count) * Math.PI * 2;
        const c = this.spawnEnemy(e.def.split.into, e.x + Math.cos(a) * 14, e.y + Math.sin(a) * 14);
        if (c) { c.kx = Math.cos(a) * 160; c.ky = Math.sin(a) * 160; }
      }
    }

    if (e.boss) {
      this.bossKilled = true;
      this.bossDefeatedAt = this.time;
      this.boss = null;
      this.pickups.push({ type: 'cache', x: e.x, y: e.y, r: 18, t: 0 });
      this.shake = 24;
      this.flash = 1;
      this.hitstop = 0.25;
      for (const b of this.bullets) b.life = 0;
      this.emit('bossDefeated');
      audio.playBossDefeated();
    }
  }

  dropXp(x, y, value) {
    let remaining = value;
    while (remaining > 0) {
      const v = remaining >= 20 ? 20 : remaining >= 5 ? 5 : 1;
      remaining -= v;
      const ox = (this.rng() - 0.5) * (value > 1 ? 24 : 0);
      const oy = (this.rng() - 0.5) * (value > 1 ? 24 : 0);
      if (this.gems.length >= CONFIG.RUN.MAX_GEMS) {
        // Fold into the oldest gem instead of growing the list
        const g = this.gems[0];
        g.value += v;
        g.tier = g.value >= 20 ? 2 : g.value >= 5 ? 1 : 0;
        continue;
      }
      this.gems.push({ x: x + ox, y: y + oy, value: v, tier: v >= 20 ? 2 : v >= 5 ? 1 : 0, magnet: false, vx: 0, vy: 0 });
    }
  }

  hurtPlayer(amount) {
    const p = this.player;
    if (this.dead || p.invuln > 0 || this.isDashing) return false;
    p.hp -= amount;
    p.invuln = CONFIG.PLAYER.INVULN_TIME;
    p.hitFlash = 0.25;
    this.shake = Math.max(this.shake, 9);
    this.hitstop = 0.035;
    this.combo = 0;
    audio.playHit();
    this.particles.emit(p.x, p.y, { count: 14, color: '#ff4d6d', speed: 220, life: 0.4, size: 3 });
    this.emit('hurt');
    if (p.hp <= 0) {
      p.hp = 0;
      this.dead = true;
      this.emit('death');
    }
    return true;
  }

  revive() {
    const p = this.player;
    this.dead = false;
    this.revivesLeft -= 1;
    p.hp = this.stats.maxHp;
    p.invuln = 2.5;
    // Rewind shockwave clears the area around the player
    for (const e of this.enemies) {
      if (e.dead) continue;
      const d = Math.hypot(e.x - p.x, e.y - p.y);
      if (d < 420) {
        if (e.boss || e.miniboss || e.elite) {
          e.kx += ((e.x - p.x) / (d || 1)) * 600;
          e.ky += ((e.y - p.y) / (d || 1)) * 600;
        } else {
          this.killEnemy(e, 'revive');
        }
      }
    }
    for (const b of this.bullets) b.life = 0;
    this.rings.push({ x: p.x, y: p.y, r: 10, maxR: 420, life: 0.6, maxLife: 0.6, color: '#a873ff', width: 10 });
    this.shake = 18;
    this.flash = 0.8;
    this.sweepDead();
  }

  // ---------- Weapons ----------

  updateWeapons(dt) {
    const emitters = this.emitters;
    this.orbitPoints.length = 0;
    for (const w of this.weapons) {
      const st = weaponStats(w.id, w.level, w.evolved);
      if (w.id === 'orbit') {
        this.updateOrbit(w, st, emitters, dt);
        continue;
      }
      for (const em of emitters) {
        w.timers[em.slot] -= dt;
        if (w.timers[em.slot] > 0) continue;
        const fired = this.fireWeapon(w, st, em);
        w.timers[em.slot] = fired ? st.cooldown * this.stats.cooldownMult : 0.15;
      }
    }
  }

  nearestEnemy(x, y, maxDist, exclude = null) {
    let best = null;
    let bestD = maxDist * maxDist;
    for (const e of this.enemies) {
      if (e.dead || (exclude && exclude.includes(e))) continue;
      const d = (e.x - x) ** 2 + (e.y - y) ** 2;
      if (d < bestD) { bestD = d; best = e; }
    }
    return best;
  }

  fireWeapon(w, st, em) {
    const dmg = st.damage * this.stats.damageMult * em.mult;
    const color = WEAPONS[w.id].color;
    switch (w.id) {
      case 'pulse_bolt': {
        const target = this.nearestEnemy(em.x, em.y, 420);
        if (!target) return false;
        const base = Math.atan2(target.y - em.y, target.x - em.x);
        for (let i = 0; i < st.count; i++) {
          const a = base + (i - (st.count - 1) / 2) * st.spread;
          if (this.projectiles.length > 500) break;
          this.projectiles.push({
            x: em.x, y: em.y, vx: Math.cos(a) * st.speed, vy: Math.sin(a) * st.speed,
            damage: dmg, pierce: st.pierce, r: st.size, life: 1.3, color, hit: [], blast: st.blastRadius || 0,
          });
        }
        if (em.slot === 0) audio.playShoot();
        return true;
      }
      case 'nova': {
        const found = this.hash.query(em.x, em.y, st.radius + MAX_ENEMY_RADIUS, this.queryBuf);
        for (const e of found) {
          if (e.dead) continue;
          const dx = e.x - em.x, dy = e.y - em.y;
          const d = Math.hypot(dx, dy) || 1;
          if (d < st.radius + e.r) this.damageEnemy(e, dmg, { kx: (dx / d) * st.knockback, ky: (dy / d) * st.knockback, color });
        }
        this.rings.push({ x: em.x, y: em.y, r: 12, maxR: st.radius, life: 0.32, maxLife: 0.32, color, width: 5 });
        if (em.slot === 0) audio.playNova();
        return true;
      }
      case 'arc': {
        let target = this.nearestEnemy(em.x, em.y, st.range);
        if (!target) return false;
        const hit = [];
        const points = [em.x, em.y];
        for (let i = 0; i <= st.chains && target; i++) {
          hit.push(target);
          points.push(target.x, target.y);
          this.damageEnemy(target, dmg, { color });
          target = this.nearestEnemy(target.x, target.y, st.jump, hit);
        }
        this.bolts.push({ points, life: 0.16, maxLife: 0.16, color });
        if (em.slot === 0) audio.playArc();
        return true;
      }
      case 'mine': {
        if (this.mines.length >= 48) this.mines.shift();
        this.mines.push({ x: em.x, y: em.y, arm: 0.35, life: st.life, radius: st.radius, damage: dmg, color });
        return true;
      }
      case 'lance': {
        const x2 = em.x + em.fx * st.length, y2 = em.y + em.fy * st.length;
        const half = st.width / 2;
        for (const e of this.enemies) {
          if (e.dead) continue;
          if (distToSegmentSq(e.x, e.y, em.x, em.y, x2, y2) < (half + e.r) ** 2) {
            this.damageEnemy(e, dmg, { kx: em.fx * 120, ky: em.fy * 120, color });
          }
        }
        this.beams.push({ x1: em.x, y1: em.y, x2, y2, life: 0.18, maxLife: 0.18, color, width: st.width });
        if (em.slot === 0) audio.playLance();
        return true;
      }
    }
    return false;
  }

  updateOrbit(w, st, emitters, dt) {
    w.angle += st.spin * dt;
    const radius = st.radius + (st.breathe ? Math.sin(this.time * 2.2) * st.breathe : 0);
    const dmgBase = st.damage * this.stats.damageMult;
    const color = WEAPONS.orbit.color;
    for (const em of emitters) {
      for (let k = 0; k < st.count; k++) {
        const a = w.angle + (k / st.count) * Math.PI * 2;
        const ox = em.x + Math.cos(a) * radius;
        const oy = em.y + Math.sin(a) * radius;
        this.orbitPoints.push(ox, oy, st.size, em.slot === 0 ? 1 : 0.65);
        const found = this.hash.query(ox, oy, st.size + MAX_ENEMY_RADIUS, this.queryBuf);
        for (const e of found) {
          if (e.dead || e.orbitHit > 0) continue;
          const dx = e.x - ox, dy = e.y - oy;
          if (dx * dx + dy * dy < (st.size + e.r) ** 2) {
            e.orbitHit = st.hitCooldown;
            const d = Math.hypot(e.x - em.x, e.y - em.y) || 1;
            this.damageEnemy(e, dmgBase * em.mult, { kx: ((e.x - em.x) / d) * 140, ky: ((e.y - em.y) / d) * 140, color });
          }
        }
      }
    }
  }

  updateProjectiles(dt) {
    const ps = this.projectiles;
    for (let i = ps.length - 1; i >= 0; i--) {
      const pr = ps[i];
      pr.x += pr.vx * dt;
      pr.y += pr.vy * dt;
      pr.life -= dt;
      let remove = pr.life <= 0;
      if (!remove) {
        const found = this.hash.query(pr.x, pr.y, pr.r + MAX_ENEMY_RADIUS, this.queryBuf);
        for (const e of found) {
          if (e.dead || pr.hit.includes(e.id)) continue;
          const dx = e.x - pr.x, dy = e.y - pr.y;
          if (dx * dx + dy * dy >= (pr.r + e.r) ** 2) continue;
          pr.hit.push(e.id);
          const sp = Math.hypot(pr.vx, pr.vy) || 1;
          this.damageEnemy(e, pr.damage, { kx: (pr.vx / sp) * 90, ky: (pr.vy / sp) * 90, color: pr.color });
          if (pr.blast) this.explode(pr.x, pr.y, pr.blast, pr.damage * 0.5, pr.color, e);
          pr.pierce -= 1;
          if (pr.pierce < 0) { remove = true; break; }
        }
      }
      if (remove) {
        ps[i] = ps[ps.length - 1];
        ps.pop();
      }
    }
  }

  explode(x, y, radius, damage, color, skip = null) {
    const found = this.hash.query(x, y, radius + MAX_ENEMY_RADIUS, this.blastBuf);
    for (const e of found) {
      if (e.dead || e === skip) continue;
      const dx = e.x - x, dy = e.y - y;
      const d = Math.hypot(dx, dy) || 1;
      if (d < radius + e.r) this.damageEnemy(e, damage, { kx: (dx / d) * 220, ky: (dy / d) * 220, color, noText: damage < 8 });
    }
    this.rings.push({ x, y, r: 6, maxR: radius, life: 0.25, maxLife: 0.25, color, width: 4 });
  }

  updateMines(dt) {
    const ms = this.mines;
    for (let i = ms.length - 1; i >= 0; i--) {
      const m = ms[i];
      m.life -= dt;
      if (m.arm > 0) m.arm -= dt;
      let boom = false;
      if (m.arm <= 0) {
        const found = this.hash.query(m.x, m.y, 10 + MAX_ENEMY_RADIUS, this.queryBuf);
        for (const e of found) {
          if (!e.dead && (e.x - m.x) ** 2 + (e.y - m.y) ** 2 < (10 + e.r) ** 2) { boom = true; break; }
        }
      }
      if (boom) {
        this.explode(m.x, m.y, m.radius, m.damage, m.color);
        this.particles.emit(m.x, m.y, { count: 12, color: m.color, speed: 240, life: 0.35, size: 3 });
        audio.playMine();
      }
      if (boom || m.life <= 0) {
        ms[i] = ms[ms.length - 1];
        ms.pop();
      }
    }
  }

  // ---------- Paradox: charged echoes detonate on enemy contact ----------

  updateParadox() {
    for (const ec of this.echoes) {
      if (!ec.active || ec.paradoxTimer > 0) continue;
      const found = this.hash.query(ec.x, ec.y, ec.r + MAX_ENEMY_RADIUS, this.queryBuf);
      let touched = false;
      for (const e of found) {
        if (!e.dead && (e.x - ec.x) ** 2 + (e.y - ec.y) ** 2 < (ec.r + e.r) ** 2) { touched = true; break; }
      }
      if (touched) this.detonateParadox(ec, 0);
    }
  }

  detonateParadox(ec, depth) {
    ec.paradoxTimer = this.stats.paradoxCooldown;
    const radius = CONFIG.ECHO.PARADOX_RADIUS * (1 + depth * 0.15);
    const dmg = this.stats.paradoxDamage * this.stats.damageMult * (1 + this.level * 0.06) * (1 + depth * 0.5);
    this.explode(ec.x, ec.y, radius, dmg, '#c9a4ff');
    this.rings.push({ x: ec.x, y: ec.y, r: 10, maxR: radius * 1.25, life: 0.4, maxLife: 0.4, color: '#f2e9ff', width: 3 });
    this.particles.emit(ec.x, ec.y, { count: 22, color: '#c9a4ff', speed: 300, life: 0.45, size: 3.5 });
    this.paradoxes += 1;
    this.shake = Math.max(this.shake, 7 + depth * 3);
    this.hitstop = Math.max(this.hitstop, 0.03);
    this.addText(ec.x, ec.y - 24, depth > 0 ? `CHAIN PARADOX ×${depth + 1}` : 'PARADOX!', '#e7d6ff', 18 + depth * 2, 0.9);
    audio.playParadox(depth);
    // Chain reaction into other charged echoes caught in the blast
    for (const other of this.echoes) {
      if (other === ec || !other.active || other.paradoxTimer > 0) continue;
      if ((other.x - ec.x) ** 2 + (other.y - ec.y) ** 2 < radius * radius) this.detonateParadox(other, depth + 1);
    }
  }

  // ---------- Pickups ----------

  updatePickups(dt) {
    const p = this.player;
    const magnet = this.stats.magnet;
    const gems = this.gems;
    for (let i = gems.length - 1; i >= 0; i--) {
      const g = gems[i];
      const dx = p.x - g.x, dy = p.y - g.y;
      const d2 = dx * dx + dy * dy;
      if (!g.magnet && d2 < magnet * magnet) g.magnet = true;
      if (g.magnet) {
        // Accelerate until well past player speed so magnetised gems always catch up
        const d = Math.sqrt(d2) || 1;
        g.vx = Math.min(1100, (g.vx || 160) + 1600 * dt);
        const step = Math.min(d, g.vx * dt);
        g.x += (dx / d) * step;
        g.y += (dy / d) * step;
      }
      if (d2 < (p.r + 10) ** 2) {
        this.gainXp(g.value);
        gems[i] = gems[gems.length - 1];
        gems.pop();
      }
    }

    const ps = this.pickups;
    for (let i = ps.length - 1; i >= 0; i--) {
      const it = ps[i];
      it.t += dt;
      const dx = p.x - it.x, dy = p.y - it.y;
      const d = Math.hypot(dx, dy);
      if (it.type === 'flux' && d < magnet) {
        it.x += (dx / (d || 1)) * 500 * dt;
        it.y += (dy / (d || 1)) * 500 * dt;
      }
      if (d < p.r + it.r) {
        this.collectPickup(it);
        ps[i] = ps[ps.length - 1];
        ps.pop();
      }
    }
  }

  collectPickup(it) {
    const p = this.player;
    switch (it.type) {
      case 'heal':
        p.hp = Math.min(this.stats.maxHp, p.hp + this.stats.maxHp * 0.3);
        this.addText(p.x, p.y - 30, '+HP', '#ff4d6d', 16, 0.8);
        audio.playHeal();
        break;
      case 'flux':
        this.fluxPickups += it.value;
        this.addText(p.x, p.y - 30, `+${it.value} FLUX`, '#ffc83d', 14, 0.8);
        audio.playFlux();
        break;
      case 'vacuum':
        for (const g of this.gems) g.magnet = true;
        this.addText(p.x, p.y - 30, 'MAGNET SURGE', '#7dff6a', 16, 0.9);
        audio.playFlux();
        break;
      case 'cache':
        this.emit('cache', { options: buildCacheOptions(this) });
        audio.playChest();
        break;
    }
  }

  gainXp(value) {
    this.xp += value;
    audio.playXp();
    while (this.xp >= this.xpNeed) {
      this.xp -= this.xpNeed;
      this.level += 1;
      this.xpNeed = xpForLevel(this.level);
      this.pendingLevelUps += 1;
    }
  }

  // ---------- Effects & cleanup ----------

  addText(x, y, text, color, size = 14, life = 0.7) {
    if (this.texts.length > 60) this.texts.shift();
    this.texts.push({ x, y, text, color, size, life, maxLife: life });
  }

  updateEffects(dt) {
    const tick = (arr, extra) => {
      for (let i = arr.length - 1; i >= 0; i--) {
        const fx = arr[i];
        fx.life -= dt;
        if (extra) extra(fx);
        if (fx.life <= 0) {
          arr[i] = arr[arr.length - 1];
          arr.pop();
        }
      }
    };
    tick(this.rings, r => { r.r += (r.maxR - r.r) * Math.min(1, dt * 14); });
    tick(this.beams);
    tick(this.bolts);
    tick(this.loopFx);
    tick(this.texts, t => { t.y -= 34 * dt; });
  }

  sweepDead() {
    const es = this.enemies;
    for (let i = es.length - 1; i >= 0; i--) {
      if (es[i].dead) {
        es[i] = es[es.length - 1];
        es.pop();
      }
    }
  }

  summary() {
    return {
      time: this.time,
      kills: this.kills,
      loopKills: this.loopKills,
      paradoxes: this.paradoxes,
      level: this.level,
      bossKilled: this.bossKilled,
      fluxPickups: this.fluxPickups,
      evolutions: this.evolutions.slice(),
      weapons: this.weapons.map(w => ({ id: w.evolved || w.id, level: w.level, evolved: !!w.evolved })),
      passives: { ...this.passives },
    };
  }
}
