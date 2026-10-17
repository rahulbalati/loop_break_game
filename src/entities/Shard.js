// LOOP//BREAK - Energy Shard Entity & Magnetic Attraction

import { CONFIG } from '../config.js';

export class Shard {
  constructor(x, y, isBonus = false) {
    this.x = x;
    this.y = y;
    this.baseX = x;
    this.baseY = y;
    this.radius = isBonus ? CONFIG.SHARD.RADIUS * 1.3 : CONFIG.SHARD.RADIUS;
    this.isBonus = isBonus;
    this.color = isBonus ? '#ff00aa' : CONFIG.SHARD.COLOR;
    this.pulseOffset = Math.random() * Math.PI * 2;
    this.isCollected = false;

    // Magnetic pull kinematics
    this.vx = 0;
    this.vy = 0;
    this.isMagnetized = false;
  }

  update(dt, player) {
    if (this.isCollected) return;

    // Gentle hover animation
    this.pulseOffset += dt * CONFIG.SHARD.PULSE_SPEED;

    // Check Magnetic Attraction to player
    const dx = player.x - this.x;
    const dy = player.y - this.y;
    const dist = Math.hypot(dx, dy);

    if (dist < player.magnetRadius) {
      this.isMagnetized = true;
      const pullForce = (1 - dist / player.magnetRadius) * 650;
      this.vx += (dx / dist) * pullForce * dt * 4;
      this.vy += (dy / dist) * pullForce * dt * 4;
      this.x += this.vx * dt;
      this.y += this.vy * dt;
    } else {
      this.isMagnetized = false;
      this.vx *= 0.85;
      this.vy *= 0.85;
      this.x += this.vx * dt;
      this.y += this.vy * dt;
    }
  }

  render(ctx) {
    if (this.isCollected) return;

    ctx.save();
    const floatY = this.y + Math.sin(this.pulseOffset) * 3;

    // Glow
    ctx.shadowColor = this.color;
    ctx.shadowBlur = 12;

    // Diamond Gem Shape
    ctx.beginPath();
    ctx.moveTo(this.x, floatY - this.radius * 1.2);
    ctx.lineTo(this.x + this.radius, floatY);
    ctx.lineTo(this.x, floatY + this.radius * 1.2);
    ctx.lineTo(this.x - this.radius, floatY);
    ctx.closePath();
    ctx.fillStyle = this.color;
    ctx.fill();

    // Inner Radiant Star
    ctx.shadowBlur = 0;
    ctx.beginPath();
    ctx.arc(this.x, floatY, this.radius * 0.4, 0, Math.PI * 2);
    ctx.fillStyle = '#ffffff';
    ctx.fill();

    ctx.restore();
  }
}
