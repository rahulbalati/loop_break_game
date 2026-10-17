// LOOP//BREAK - The Signature Echo System & Decoy Mechanics

import { CONFIG } from '../config.js';
import { audio } from '../audio/AudioSynthesizer.js';

export class EchoManager {
  constructor() {
    this.history = []; // Array of { time, x, y, vx, vy, isDashing, angle }
    this.echoDelay = CONFIG.ECHO.BASE_DELAY;
    this.isActive = false;
    this.elapsedTime = 0;

    // Current replaying ghost state
    this.ghost = {
      x: 0,
      y: 0,
      vx: 0,
      vy: 0,
      isDashing: false,
      angle: 0,
      alpha: 0,
      trail: [],
    };

    this.warningSoundCooldown = 0;
  }

  setLevel(level, upgrades = {}) {
    // Echo unlocked at Level 3 and onward
    this.isActive = level >= 3;
    const stabilizerLvl = upgrades.echo_stabilizer || 0;
    this.echoDelay = CONFIG.ECHO.BASE_DELAY + stabilizerLvl * 0.35;
    this.reset();
  }

  reset() {
    this.history.length = 0;
    this.elapsedTime = 0;
    this.ghost.trail.length = 0;
    this.ghost.alpha = 0;
  }

  record(player, dt) {
    if (!this.isActive) return;

    this.elapsedTime += dt;
    this.history.push({
      time: this.elapsedTime,
      x: player.x,
      y: player.y,
      vx: player.vx,
      vy: player.vy,
      isDashing: player.isDashing,
      angle: player.facingAngle,
    });

    // Prune history older than echoDelay + 2 seconds buffer
    const cutoff = this.elapsedTime - (this.echoDelay + 2.0);
    while (this.history.length > 0 && this.history[0].time < cutoff) {
      this.history.shift();
    }
  }

  update(dt, player, particleSystem, screenShake) {
    if (!this.isActive || this.history.length === 0) return;

    if (this.warningSoundCooldown > 0) {
      this.warningSoundCooldown -= dt;
    }

    const targetTime = this.elapsedTime - this.echoDelay;

    // Not enough time has elapsed to start playback
    if (targetTime < this.history[0].time) {
      this.ghost.alpha = 0;
      return;
    }

    // Binary search or scan for the recorded snapshot corresponding to targetTime
    let sample = null;
    for (let i = 0; i < this.history.length; i++) {
      if (this.history[i].time >= targetTime) {
        sample = this.history[i];
        break;
      }
    }

    if (!sample) {
      sample = this.history[this.history.length - 1];
    }

    // Smoothly update ghost position
    this.ghost.x = sample.x;
    this.ghost.y = sample.y;
    this.ghost.vx = sample.vx;
    this.ghost.vy = sample.vy;
    this.ghost.isDashing = sample.isDashing;
    this.ghost.angle = sample.angle;
    this.ghost.alpha = Math.min(1.0, this.ghost.alpha + dt * 2);

    // Update ghost trail
    this.ghost.trail.unshift({ x: this.ghost.x, y: this.ghost.y });
    if (this.ghost.trail.length > 12) {
      this.ghost.trail.pop();
    }

    // Check collision / proximity with current player
    const dist = Math.hypot(player.x - this.ghost.x, player.y - this.ghost.y);

    // Hazard warning aura sound if close
    if (dist < 80 && dist > CONFIG.ECHO.DANGER_DISTANCE && this.warningSoundCooldown <= 0) {
      audio.playEnemyWarning();
      this.warningSoundCooldown = 0.6;
    }

    // Collision damage
    if (dist < CONFIG.PLAYER.RADIUS + 12 && !player.isDashing) {
      const damaged = player.takeDamage(particleSystem, screenShake);
      if (damaged) {
        particleSystem.spawnHitSparks(this.ghost.x, this.ghost.y, CONFIG.ECHO.COLOR);
      }
    }
  }

  // Returns active ghost decoy position for enemy AI attraction
  getDecoyTarget() {
    if (!this.isActive || this.ghost.alpha < 0.5) return null;
    return {
      x: this.ghost.x,
      y: this.ghost.y,
      vx: this.ghost.vx,
      vy: this.ghost.vy,
    };
  }

  render(ctx) {
    if (!this.isActive || this.ghost.alpha <= 0.05) return;

    ctx.save();

    // 1. Render Ghost Motion Trail Ribbon
    for (let i = 0; i < this.ghost.trail.length; i++) {
      const p = this.ghost.trail[i];
      const alpha = (1 - i / this.ghost.trail.length) * 0.4 * this.ghost.alpha;
      ctx.beginPath();
      ctx.arc(p.x, p.y, CONFIG.PLAYER.RADIUS * (1 - i / this.ghost.trail.length * 0.3), 0, Math.PI * 2);
      ctx.fillStyle = CONFIG.ECHO.COLOR;
      ctx.globalAlpha = alpha;
      ctx.fill();
    }

    // 2. Render Pulsing Danger / Telegraph Aura
    const pulseScale = 1.0 + Math.sin(Date.now() * 0.01) * 0.15;
    ctx.beginPath();
    ctx.arc(this.ghost.x, this.ghost.y, (CONFIG.PLAYER.RADIUS + 8) * pulseScale, 0, Math.PI * 2);
    ctx.strokeStyle = CONFIG.ECHO.COLOR;
    ctx.lineWidth = 2;
    ctx.globalAlpha = 0.5 * this.ghost.alpha;
    ctx.stroke();

    // 3. Render Ghost Body (Translucent Violet)
    ctx.globalAlpha = 0.85 * this.ghost.alpha;
    ctx.shadowColor = CONFIG.ECHO.COLOR;
    ctx.shadowBlur = 18;

    ctx.beginPath();
    ctx.arc(this.ghost.x, this.ghost.y, CONFIG.PLAYER.RADIUS, 0, Math.PI * 2);
    ctx.fillStyle = CONFIG.ECHO.COLOR;
    ctx.fill();

    // Inner Ghost Core
    ctx.shadowBlur = 0;
    ctx.beginPath();
    ctx.arc(this.ghost.x, this.ghost.y, CONFIG.PLAYER.RADIUS * 0.5, 0, Math.PI * 2);
    ctx.fillStyle = '#ffffff';
    ctx.globalAlpha = 0.9 * this.ghost.alpha;
    ctx.fill();

    // Ghost Direction Pointer
    ctx.beginPath();
    const ptrX = this.ghost.x + Math.cos(this.ghost.angle) * (CONFIG.PLAYER.RADIUS + 5);
    const ptrY = this.ghost.y + Math.sin(this.ghost.angle) * (CONFIG.PLAYER.RADIUS + 5);
    ctx.arc(ptrX, ptrY, 3, 0, Math.PI * 2);
    ctx.fillStyle = '#ffffff';
    ctx.fill();

    ctx.restore();
  }
}
