// LOOP//BREAK - Exit Portal Entity & Level Transition Vortex

import { CONFIG } from '../config.js';

export class ExitPortal {
  constructor(x, y) {
    this.x = x;
    this.y = y;
    this.radius = CONFIG.PORTAL.RADIUS;
    this.isUnlocked = false;
    this.rotation = 0;
    this.particles = [];
  }

  setUnlocked(unlocked) {
    this.isUnlocked = unlocked;
  }

  update(dt, particleSystem) {
    const rotSpeed = this.isUnlocked ? CONFIG.PORTAL.ROTATION_SPEED * 1.8 : CONFIG.PORTAL.ROTATION_SPEED * 0.5;
    this.rotation += dt * rotSpeed;

    if (this.isUnlocked && Math.random() < 0.3) {
      particleSystem.spawn({
        x: this.x,
        y: this.y,
        count: 2,
        color: '#00ffaa',
        speed: 80,
        life: 0.5,
        size: 3,
      });
    }
  }

  render(ctx, player, shards = []) {
    ctx.save();
    ctx.translate(this.x, this.y);

    const baseColor = this.isUnlocked ? CONFIG.PORTAL.COLOR_UNLOCKED : CONFIG.PORTAL.COLOR_LOCKED;
    ctx.shadowColor = baseColor;
    ctx.shadowBlur = this.isUnlocked ? 24 : 8;

    // Outer Vortex Rings
    for (let i = 3; i >= 1; i--) {
      ctx.save();
      ctx.rotate(this.rotation * (i % 2 === 0 ? 1 : -1) * (i * 0.7));
      ctx.beginPath();
      ctx.arc(0, 0, this.radius * (i / 3), 0, Math.PI * 1.75);
      ctx.lineWidth = 3.5;
      ctx.strokeStyle = baseColor;
      ctx.globalAlpha = (i / 3) * (this.isUnlocked ? 0.9 : 0.4);
      ctx.stroke();
      ctx.restore();
    }

    // Portal Singularity Core
    ctx.shadowBlur = 0;
    ctx.beginPath();
    ctx.arc(0, 0, this.radius * 0.35, 0, Math.PI * 2);
    ctx.fillStyle = this.isUnlocked ? '#ffffff' : '#1e2438';
    ctx.fill();

    ctx.restore();

    // If unlocked, draw emerald directional beacon from player toward exit portal
    if (this.isUnlocked && player) {
      const dx = this.x - player.x;
      const dy = this.y - player.y;
      const dist = Math.hypot(dx, dy);

      if (dist > 180) {
        ctx.save();
        const angle = Math.atan2(dy, dx);
        const beaconDist = 55;
        const bx = player.x + Math.cos(angle) * beaconDist;
        const by = player.y + Math.sin(angle) * beaconDist;

        ctx.translate(bx, by);
        ctx.rotate(angle);

        ctx.beginPath();
        ctx.moveTo(8, 0);
        ctx.lineTo(-6, -6);
        ctx.lineTo(-2, 0);
        ctx.lineTo(-6, 6);
        ctx.closePath();
        ctx.fillStyle = '#00ffaa';
        ctx.shadowColor = '#00ffaa';
        ctx.shadowBlur = 8;
        ctx.globalAlpha = 0.8 + Math.sin(Date.now() * 0.008) * 0.2;
        ctx.fill();

        ctx.restore();
      }
    }

    // If locked and only <= 2 shards remain, draw subtle golden compass beacon pointing to nearest shard
    if (!this.isUnlocked && shards && shards.length <= 2 && shards.length > 0 && player) {
      let nearestShard = null;
      let minDist = Infinity;
      for (const s of shards) {
        const d = Math.hypot(s.x - player.x, s.y - player.y);
        if (d < minDist) {
          minDist = d;
          nearestShard = s;
        }
      }
      if (nearestShard && minDist > 140) {
        ctx.save();
        const sdx = nearestShard.x - player.x;
        const sdy = nearestShard.y - player.y;
        const angle = Math.atan2(sdy, sdx);
        const beaconDist = 52;
        const bx = player.x + Math.cos(angle) * beaconDist;
        const by = player.y + Math.sin(angle) * beaconDist;

        ctx.translate(bx, by);
        ctx.rotate(angle);

        ctx.beginPath();
        ctx.moveTo(7, 0);
        ctx.lineTo(-5, -5);
        ctx.lineTo(-2, 0);
        ctx.lineTo(-5, 5);
        ctx.closePath();
        ctx.fillStyle = '#ffd200';
        ctx.shadowColor = '#ffd200';
        ctx.shadowBlur = 8;
        ctx.globalAlpha = 0.75 + Math.sin(Date.now() * 0.008) * 0.25;
        ctx.fill();

        ctx.restore();
      }
    }
  }
}
