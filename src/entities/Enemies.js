// LOOP//BREAK - Enemy Behaviors (Hunter, Interceptor, Sentinel) & Echo Decoy Interaction

import { CONFIG } from '../config.js';

export class BaseEnemy {
  constructor(x, y, radius, speed, color) {
    this.x = x;
    this.y = y;
    this.vx = 0;
    this.vy = 0;
    this.radius = radius;
    this.speed = speed;
    this.color = color;
    this.stunTimer = 0;
    this.rotation = 0;
  }

  applyStun(duration) {
    this.stunTimer = duration;
    this.vx *= 0.2;
    this.vy *= 0.2;
  }

  // Chooses between the actual player and an active Echo Decoy
  selectTarget(player, decoy) {
    if (!decoy) return player;

    const distToPlayer = Math.hypot(player.x - this.x, player.y - this.y);
    const distToDecoy = Math.hypot(decoy.x - this.x, decoy.y - this.y);

    // If decoy is closer or within decoy lure radius, enemy gets tricked
    if (distToDecoy < distToPlayer * 1.15 && distToDecoy < CONFIG.ECHO.DECOY_ATTRACT_RADIUS) {
      return decoy;
    }
    return player;
  }

  // Flocking separation: nudges enemies apart so they do not overlap/stack
  separate(allEnemies) {
    if (!allEnemies || allEnemies.length <= 1) return;
    for (let i = 0; i < allEnemies.length; i++) {
      const other = allEnemies[i];
      if (other === this) continue;
      const dx = this.x - other.x;
      const dy = this.y - other.y;
      const dist = Math.hypot(dx, dy);
      const minDist = this.radius + other.radius + 8;
      if (dist < minDist && dist > 0.001) {
        const overlap = (minDist - dist) / dist;
        const pushForce = overlap * 35;
        this.vx += (dx / dist) * pushForce;
        this.vy += (dy / dist) * pushForce;
      }
    }
  }

  bounceWalls(arenaWidth, arenaHeight) {
    const pad = this.radius + 12;
    if (this.x < pad) {
      this.x = pad;
      this.vx = Math.abs(this.vx) * 0.8;
    } else if (this.x > arenaWidth - pad) {
      this.x = arenaWidth - pad;
      this.vx = -Math.abs(this.vx) * 0.8;
    }
    if (this.y < pad) {
      this.y = pad;
      this.vy = Math.abs(this.vy) * 0.8;
    } else if (this.y > arenaHeight - pad) {
      this.y = arenaHeight - pad;
      this.vy = -Math.abs(this.vy) * 0.8;
    }
  }
}

// 1. HUNTER: Pursues target directly with momentum
export class HunterEnemy extends BaseEnemy {
  constructor(x, y, speedScale = 1) {
    super(
      x,
      y,
      CONFIG.ENEMIES.HUNTER.RADIUS,
      CONFIG.ENEMIES.HUNTER.SPEED * speedScale,
      CONFIG.ENEMIES.HUNTER.COLOR
    );
    this.type = 'hunter';
  }

  update(dt, player, decoy, arenaWidth, arenaHeight) {
    if (this.stunTimer > 0) {
      this.stunTimer -= dt;
      this.x += this.vx * dt;
      this.y += this.vy * dt;
      this.bounceWalls(arenaWidth, arenaHeight);
      return;
    }

    const target = this.selectTarget(player, decoy);
    const dx = target.x - this.x;
    const dy = target.y - this.y;
    const dist = Math.hypot(dx, dy);

    if (dist > 1) {
      const targetVx = (dx / dist) * this.speed;
      const targetVy = (dy / dist) * this.speed;

      this.vx += (targetVx - this.vx) * Math.min(1, dt * 5.0);
      this.vy += (targetVy - this.vy) * Math.min(1, dt * 5.0);
    }

    this.x += this.vx * dt;
    this.y += this.vy * dt;
    this.rotation += dt * 2.5;

    this.bounceWalls(arenaWidth, arenaHeight);
  }

  render(ctx) {
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.rotate(this.rotation);

    if (this.stunTimer > 0) {
      ctx.globalAlpha = 0.5 + Math.sin(Date.now() * 0.02) * 0.3;
    }

    // Outer Glow
    ctx.shadowColor = this.color;
    ctx.shadowBlur = 14;

    // Octagon Body
    ctx.beginPath();
    const sides = 8;
    for (let i = 0; i < sides; i++) {
      const angle = (i / sides) * Math.PI * 2;
      const px = Math.cos(angle) * this.radius;
      const py = Math.sin(angle) * this.radius;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.fillStyle = this.color;
    ctx.fill();

    // Inner Menacing Eye
    ctx.shadowBlur = 0;
    ctx.beginPath();
    ctx.arc(0, 0, this.radius * 0.45, 0, Math.PI * 2);
    ctx.fillStyle = '#ffffff';
    ctx.fill();

    ctx.beginPath();
    ctx.arc(0, 0, this.radius * 0.2, 0, Math.PI * 2);
    ctx.fillStyle = '#100510';
    ctx.fill();

    ctx.restore();
  }
}

// 2. INTERCEPTOR: Predicts target movement trajectory
export class InterceptorEnemy extends BaseEnemy {
  constructor(x, y, speedScale = 1) {
    super(
      x,
      y,
      CONFIG.ENEMIES.INTERCEPTOR.RADIUS,
      CONFIG.ENEMIES.INTERCEPTOR.SPEED * speedScale,
      CONFIG.ENEMIES.INTERCEPTOR.COLOR
    );
    this.type = 'interceptor';
    this.facingAngle = 0;
  }

  update(dt, player, decoy, arenaWidth, arenaHeight) {
    if (this.stunTimer > 0) {
      this.stunTimer -= dt;
      this.x += this.vx * dt;
      this.y += this.vy * dt;
      this.bounceWalls(arenaWidth, arenaHeight);
      return;
    }

    const target = this.selectTarget(player, decoy);

    // Predict where target will be in t seconds
    const predTime = CONFIG.ENEMIES.INTERCEPTOR.PREDICTION_TIME;
    const predX = target.x + (target.vx || 0) * predTime;
    const predY = target.y + (target.vy || 0) * predTime;

    const dx = predX - this.x;
    const dy = predY - this.y;
    const dist = Math.hypot(dx, dy);

    if (dist > 5) {
      const targetVx = (dx / dist) * this.speed;
      const targetVy = (dy / dist) * this.speed;

      this.vx += (targetVx - this.vx) * Math.min(1, dt * 7.0);
      this.vy += (targetVy - this.vy) * Math.min(1, dt * 7.0);
      this.facingAngle = Math.atan2(this.vy, this.vx);
    }

    this.x += this.vx * dt;
    this.y += this.vy * dt;

    this.bounceWalls(arenaWidth, arenaHeight);
  }

  render(ctx) {
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.rotate(this.facingAngle);

    if (this.stunTimer > 0) {
      ctx.globalAlpha = 0.5 + Math.sin(Date.now() * 0.02) * 0.3;
    }

    // Glow
    ctx.shadowColor = this.color;
    ctx.shadowBlur = 14;

    // Sleek Sharp Triangle
    ctx.beginPath();
    ctx.moveTo(this.radius * 1.3, 0);
    ctx.lineTo(-this.radius * 0.9, -this.radius * 0.85);
    ctx.lineTo(-this.radius * 0.4, 0);
    ctx.lineTo(-this.radius * 0.9, this.radius * 0.85);
    ctx.closePath();
    ctx.fillStyle = this.color;
    ctx.fill();

    // Thruster Core
    ctx.shadowBlur = 0;
    ctx.beginPath();
    ctx.arc(-this.radius * 0.2, 0, this.radius * 0.3, 0, Math.PI * 2);
    ctx.fillStyle = '#ffffff';
    ctx.fill();

    ctx.restore();
  }
}

// 3. SENTINEL: Patrols perimeter or high-value zones with radar sweep
export class SentinelEnemy extends BaseEnemy {
  constructor(anchorX, anchorY, patrolRadius = 140, speedScale = 1) {
    super(
      anchorX,
      anchorY,
      CONFIG.ENEMIES.SENTINEL.RADIUS,
      CONFIG.ENEMIES.SENTINEL.SPEED * speedScale,
      CONFIG.ENEMIES.SENTINEL.COLOR
    );
    this.type = 'sentinel';
    this.anchorX = anchorX;
    this.anchorY = anchorY;
    this.patrolRadius = patrolRadius;
    this.patrolAngle = Math.random() * Math.PI * 2;
    this.radarAngle = 0;
    this.alertMode = false;
  }

  update(dt, player, decoy, arenaWidth, arenaHeight) {
    if (this.stunTimer > 0) {
      this.stunTimer -= dt;
      this.x += this.vx * dt;
      this.y += this.vy * dt;
      this.bounceWalls(arenaWidth, arenaHeight);
      return;
    }

    this.radarAngle += dt * 3.5;
    const target = this.selectTarget(player, decoy);
    const distToTarget = Math.hypot(target.x - this.x, target.y - this.y);

    // If target enters scan detection radius, activate pursuit
    if (distToTarget < CONFIG.ENEMIES.SENTINEL.SCAN_RADIUS) {
      this.alertMode = true;
      const dx = target.x - this.x;
      const dy = target.y - this.y;
      const spd = this.speed * 1.5;
      this.vx = (dx / distToTarget) * spd;
      this.vy = (dy / distToTarget) * spd;
    } else {
      // Orbit around anchor point
      this.alertMode = false;
      this.patrolAngle += (this.speed / this.patrolRadius) * dt;
      const targetX = this.anchorX + Math.cos(this.patrolAngle) * this.patrolRadius;
      const targetY = this.anchorY + Math.sin(this.patrolAngle) * this.patrolRadius;

      const dx = targetX - this.x;
      const dy = targetY - this.y;
      this.vx = dx * 3.0;
      this.vy = dy * 3.0;
    }

    this.x += this.vx * dt;
    this.y += this.vy * dt;

    this.bounceWalls(arenaWidth, arenaHeight);
  }

  render(ctx) {
    ctx.save();

    // Draw Radar Scan Arc
    ctx.beginPath();
    ctx.moveTo(this.x, this.y);
    ctx.arc(
      this.x,
      this.y,
      CONFIG.ENEMIES.SENTINEL.SCAN_RADIUS,
      this.radarAngle - 0.35,
      this.radarAngle + 0.35
    );
    ctx.closePath();
    ctx.fillStyle = this.alertMode ? 'rgba(255, 42, 95, 0.15)' : 'rgba(168, 85, 247, 0.12)';
    ctx.fill();

    ctx.translate(this.x, this.y);

    if (this.stunTimer > 0) {
      ctx.globalAlpha = 0.5 + Math.sin(Date.now() * 0.02) * 0.3;
    }

    // Glow
    ctx.shadowColor = this.alertMode ? '#ff2a5f' : this.color;
    ctx.shadowBlur = 16;

    // Diamond Body
    ctx.beginPath();
    ctx.moveTo(0, -this.radius * 1.25);
    ctx.lineTo(this.radius * 1.1, 0);
    ctx.lineTo(0, this.radius * 1.25);
    ctx.lineTo(-this.radius * 1.1, 0);
    ctx.closePath();
    ctx.fillStyle = this.alertMode ? '#ff2a5f' : this.color;
    ctx.fill();

    // Center Core
    ctx.shadowBlur = 0;
    ctx.beginPath();
    ctx.arc(0, 0, this.radius * 0.4, 0, Math.PI * 2);
    ctx.fillStyle = '#ffffff';
    ctx.fill();

    ctx.restore();
  }
}
