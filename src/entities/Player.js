// LOOP//BREAK - Player Entity & Movement Mechanics

import { CONFIG } from '../config.js';
import { audio } from '../audio/AudioSynthesizer.js';

export class Player {
  constructor(x, y, skin = CONFIG.SKINS[0]) {
    this.x = x;
    this.y = y;
    this.vx = 0;
    this.vy = 0;
    this.radius = CONFIG.PLAYER.RADIUS;
    this.skin = skin;

    // Health & Shields
    this.maxHealth = CONFIG.PLAYER.BASE_HEALTH;
    this.health = this.maxHealth;
    this.invulnerableTimer = 0;

    // Movement & Abilities
    this.facingAngle = 0;
    this.speed = CONFIG.PLAYER.BASE_SPEED;

    // Dash
    this.isDashing = false;
    this.dashTimer = 0;
    this.dashCooldownTimer = 0;
    this.dashCooldownMax = CONFIG.PLAYER.BASE_DASH_COOLDOWN;
    this.dashVx = 0;
    this.dashVy = 0;

    // Pulse
    this.pulseCooldownTimer = 0;
    this.pulseCooldownMax = CONFIG.PULSE.BASE_COOLDOWN;
    this.pulseUnlocked = false;

    // Magnet
    this.magnetRadius = CONFIG.PLAYER.BASE_MAGNET_RADIUS;

    // Visual trails
    this.trail = [];
    this.maxTrail = 8;
  }

  applyUpgrades(upgrades) {
    // Phase Engine (Dash Cooldown reduction)
    const phaseLvl = upgrades.phase_engine || 0;
    this.dashCooldownMax = CONFIG.PLAYER.BASE_DASH_COOLDOWN * (1 - phaseLvl * 0.12);

    // Flux Magnet
    const magnetLvl = upgrades.flux_magnet || 0;
    this.magnetRadius = CONFIG.PLAYER.BASE_MAGNET_RADIUS + magnetLvl * 28;

    // Kinetic Pulse
    const pulseLvl = upgrades.kinetic_pulse || 0;
    this.pulseCooldownMax = CONFIG.PULSE.BASE_COOLDOWN * (1 - pulseLvl * 0.08);
  }

  setSkin(skin) {
    this.skin = skin;
  }

  reset(x, y) {
    this.x = x;
    this.y = y;
    this.vx = 0;
    this.vy = 0;
    this.isDashing = false;
    this.dashTimer = 0;
    this.dashCooldownTimer = 0;
    this.pulseCooldownTimer = 0;
    this.invulnerableTimer = 0;
    this.health = this.maxHealth;
    this.trail.length = 0;
  }

  dash(inputVector, particleSystem) {
    if (this.dashCooldownTimer > 0) return false;

    this.isDashing = true;
    this.dashTimer = CONFIG.PLAYER.DASH_DURATION;
    this.dashCooldownTimer = this.dashCooldownMax;

    // Determine dash direction: input vector or current facing angle
    let dirX = inputVector.x;
    let dirY = inputVector.y;
    if (Math.hypot(dirX, dirY) < 0.1) {
      dirX = Math.cos(this.facingAngle);
      dirY = Math.sin(this.facingAngle);
    } else {
      const len = Math.hypot(dirX, dirY);
      dirX /= len;
      dirY /= len;
    }

    this.dashVx = dirX * CONFIG.PLAYER.DASH_SPEED;
    this.dashVy = dirY * CONFIG.PLAYER.DASH_SPEED;

    audio.playDash();
    particleSystem.spawnDashStreak(this.x, this.y, this.skin.color, Math.atan2(dirY, dirX));
    return true;
  }

  pulse(enemies, particleSystem) {
    if (!this.pulseUnlocked || this.pulseCooldownTimer > 0) return false;

    this.pulseCooldownTimer = this.pulseCooldownMax;
    audio.playPulse();
    particleSystem.spawnPulseShockwave(this.x, this.y, CONFIG.PULSE.BASE_RADIUS, this.skin.color);

    // Knockback & stun nearby enemies
    for (const enemy of enemies) {
      const dx = enemy.x - this.x;
      const dy = enemy.y - this.y;
      const dist = Math.hypot(dx, dy);

      if (dist < CONFIG.PULSE.BASE_RADIUS) {
        const force = (1 - dist / CONFIG.PULSE.BASE_RADIUS) * CONFIG.PULSE.KNOCKBACK_FORCE;
        const angle = Math.atan2(dy, dx);
        enemy.vx = Math.cos(angle) * force;
        enemy.vy = Math.sin(angle) * force;
        enemy.applyStun(CONFIG.PULSE.STUN_DURATION);
      }
    }
    return true;
  }

  takeDamage(particleSystem, screenShake) {
    if (this.isDashing || this.invulnerableTimer > 0) return false;

    this.health--;
    this.invulnerableTimer = CONFIG.PLAYER.INVULNERABLE_DURATION;

    audio.playHit();
    particleSystem.spawnHitSparks(this.x, this.y, '#ff2a5f');
    screenShake.shake(12, 0.35);

    return true;
  }

  update(dt, inputVector, arenaWidth, arenaHeight, particleSystem) {
    // Ability cooldown timers
    if (this.dashCooldownTimer > 0) this.dashCooldownTimer -= dt;
    if (this.pulseCooldownTimer > 0) this.pulseCooldownTimer -= dt;
    if (this.invulnerableTimer > 0) this.invulnerableTimer -= dt;

    if (this.isDashing) {
      this.dashTimer -= dt;
      this.x += this.dashVx * dt;
      this.y += this.dashVy * dt;

      // Spawn dash streak particles periodically
      if (Math.random() < 0.75) {
        particleSystem.spawnDashStreak(this.x, this.y, this.skin.color, Math.atan2(this.dashVy, this.dashVx));
      }

      if (this.dashTimer <= 0) {
        this.isDashing = false;
        this.vx = this.dashVx * 0.3;
        this.vy = this.dashVy * 0.3;
      }
    } else {
      // Normal acceleration & friction
      const targetVx = inputVector.x * this.speed;
      const targetVy = inputVector.y * this.speed;

      this.vx += (targetVx - this.vx) * Math.min(1, dt * 14);
      this.vy += (targetVy - this.vy) * Math.min(1, dt * 14);

      this.x += this.vx * dt;
      this.y += this.vy * dt;

      if (Math.hypot(inputVector.x, inputVector.y) > 0.05) {
        this.facingAngle = Math.atan2(inputVector.y, inputVector.x);
      }
    }

    // Clamp inside arena walls
    const pad = this.radius + 14;
    this.x = Math.max(pad, Math.min(arenaWidth - pad, this.x));
    this.y = Math.max(pad, Math.min(arenaHeight - pad, this.y));

    // Update motion trail
    if (Math.hypot(this.vx, this.vy) > 10 || this.isDashing) {
      this.trail.unshift({ x: this.x, y: this.y });
      if (this.trail.length > this.maxTrail) {
        this.trail.pop();
      }
    }
  }

  render(ctx) {
    ctx.save();

    // Invulnerability flashing
    if (this.invulnerableTimer > 0 && Math.floor(this.invulnerableTimer * 12) % 2 === 0) {
      ctx.globalAlpha = 0.35;
    }

    // Draw Motion Trail
    for (let i = 0; i < this.trail.length; i++) {
      const p = this.trail[i];
      const alpha = (1 - i / this.trail.length) * (this.isDashing ? 0.6 : 0.25);
      const size = this.radius * (1 - i / this.trail.length * 0.4);

      ctx.beginPath();
      ctx.arc(p.x, p.y, size, 0, Math.PI * 2);
      ctx.fillStyle = this.skin.trail || 'rgba(0, 240, 255, 0.3)';
      ctx.globalAlpha = alpha;
      ctx.fill();
    }

    // Draw Neon Outer Glow
    ctx.globalAlpha = 1.0;
    ctx.shadowColor = this.skin.glow || this.skin.color;
    ctx.shadowBlur = this.isDashing ? 28 : 14;

    // Draw Player Body (Geometric Hexagon / Circle)
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
    ctx.fillStyle = this.skin.color;
    ctx.fill();

    // Inner Core
    ctx.shadowBlur = 0;
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.radius * 0.55, 0, Math.PI * 2);
    ctx.fillStyle = '#ffffff';
    ctx.fill();

    // Directional Pointer Needle
    ctx.beginPath();
    const ptrX = this.x + Math.cos(this.facingAngle) * (this.radius + 6);
    const ptrY = this.y + Math.sin(this.facingAngle) * (this.radius + 6);
    ctx.arc(ptrX, ptrY, 3.5, 0, Math.PI * 2);
    ctx.fillStyle = '#ffffff';
    ctx.fill();

    // Draw Energy Shield Ring if active
    if (this.health > 1) {
      ctx.beginPath();
      ctx.arc(this.x, this.y, this.radius + 6, 0, Math.PI * 2);
      ctx.lineWidth = 2;
      ctx.strokeStyle = '#00ffaa';
      ctx.globalAlpha = 0.5 + Math.sin(Date.now() * 0.006) * 0.25;
      ctx.stroke();
    }

    ctx.restore();
  }
}
