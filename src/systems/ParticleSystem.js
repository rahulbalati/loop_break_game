// LOOP//BREAK - High-Performance Neon Particle & Visual Juice Engine

export class ParticleSystem {
  constructor() {
    this.particles = [];
    this.shockwaves = [];
  }

  reset() {
    this.particles.length = 0;
    this.shockwaves.length = 0;
  }

  // Generic particle spawner
  spawn({ x, y, count = 10, color = '#00f0ff', speed = 100, life = 0.5, size = 3, spread = Math.PI * 2, angle = 0 }) {
    for (let i = 0; i < count; i++) {
      const a = angle - spread / 2 + Math.random() * spread;
      const spd = speed * (0.4 + Math.random() * 0.8);
      this.particles.push({
        x,
        y,
        vx: Math.cos(a) * spd,
        vy: Math.sin(a) * spd,
        color,
        size: size * (0.6 + Math.random() * 0.8),
        life,
        maxLife: life,
        drag: 0.94,
      });
    }
  }

  // Shard pickup burst
  spawnShardPickup(x, y) {
    this.spawn({
      x,
      y,
      count: 18,
      color: '#ffd200',
      speed: 180,
      life: 0.6,
      size: 4,
    });
    this.spawn({
      x,
      y,
      count: 10,
      color: '#ffffff',
      speed: 120,
      life: 0.4,
      size: 2.5,
    });
  }

  // Dash ghost streak
  spawnDashStreak(x, y, color = '#00f0ff', dirAngle) {
    this.spawn({
      x,
      y,
      count: 6,
      color,
      speed: 60,
      life: 0.35,
      size: 3.5,
      spread: Math.PI / 3,
      angle: dirAngle + Math.PI,
    });
  }

  // Pulse kinetic shockwave ring
  spawnPulseShockwave(x, y, maxRadius = 180, color = '#00f0ff') {
    this.shockwaves.push({
      x,
      y,
      radius: 10,
      maxRadius,
      color,
      life: 0.3,
      maxLife: 0.3,
    });
    this.spawn({
      x,
      y,
      count: 24,
      color,
      speed: 260,
      life: 0.45,
      size: 3,
    });
  }

  // Enemy / Player hit spark
  spawnHitSparks(x, y, color = '#ff2a5f') {
    this.spawn({
      x,
      y,
      count: 22,
      color,
      speed: 220,
      life: 0.5,
      size: 4,
    });
    this.spawn({
      x,
      y,
      count: 12,
      color: '#ffffff',
      speed: 160,
      life: 0.35,
      size: 2,
    });
  }

  // Level Clear Vortex burst
  spawnPortalBurst(x, y) {
    this.spawn({
      x,
      y,
      count: 40,
      color: '#00ffaa',
      speed: 280,
      life: 0.8,
      size: 5,
    });
    this.shockwaves.push({
      x,
      y,
      radius: 15,
      maxRadius: 260,
      color: '#00ffaa',
      life: 0.5,
      maxLife: 0.5,
    });
  }

  // Celebratory Level Clear Matrix Confetti
  spawnCelebrationConfetti(width, height) {
    const colors = ['#00f0ff', '#00ffaa', '#ffd200', '#ff007f', '#b34dff', '#ffffff'];
    for (let i = 0; i < 75; i++) {
      const x = Math.random() * width;
      const y = -10 - Math.random() * 80;
      const angle = Math.PI / 2 + (Math.random() - 0.5) * 0.9;
      const speed = 140 + Math.random() * 260;
      this.particles.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        color: colors[Math.floor(Math.random() * colors.length)],
        size: 3 + Math.random() * 4,
        life: 2.5,
        maxLife: 2.5,
        drag: 0.98,
      });
    }
  }

  update(dt) {
    // Update particles
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.life -= dt;
      if (p.life <= 0) {
        this.particles.splice(i, 1);
        continue;
      }
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vx *= p.drag;
      p.vy *= p.drag;
    }

    // Update shockwaves
    for (let i = this.shockwaves.length - 1; i >= 0; i--) {
      const sw = this.shockwaves[i];
      sw.life -= dt;
      if (sw.life <= 0) {
        this.shockwaves.splice(i, 1);
        continue;
      }
      const progress = 1 - sw.life / sw.maxLife;
      sw.radius = 10 + (sw.maxRadius - 10) * progress;
    }
  }

  render(ctx) {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';

    // Render shockwaves
    for (let sw of this.shockwaves) {
      const alpha = Math.max(0, sw.life / sw.maxLife);
      ctx.beginPath();
      ctx.arc(sw.x, sw.y, sw.radius, 0, Math.PI * 2);
      ctx.lineWidth = 3 * alpha;
      ctx.strokeStyle = sw.color;
      ctx.globalAlpha = alpha * 0.85;
      ctx.stroke();
    }

    // Render particles
    for (let p of this.particles) {
      const alpha = Math.max(0, p.life / p.maxLife);
      ctx.fillStyle = p.color;
      ctx.globalAlpha = alpha;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size * alpha, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();
  }
}

export class ScreenShake {
  constructor() {
    this.intensity = 0;
    this.duration = 0;
    this.timer = 0;
    this.offsetX = 0;
    this.offsetY = 0;
    this.rotation = 0;
  }

  shake(intensity = 8, duration = 0.25) {
    this.intensity = Math.max(this.intensity, intensity);
    this.duration = duration;
    this.timer = duration;
  }

  update(dt) {
    if (this.timer > 0) {
      this.timer -= dt;
      const progress = this.timer / this.duration;
      const currentIntensity = this.intensity * progress;
      this.offsetX = (Math.random() * 2 - 1) * currentIntensity;
      this.offsetY = (Math.random() * 2 - 1) * currentIntensity;
      this.rotation = ((Math.random() * 2 - 1) * currentIntensity * 0.002);
    } else {
      this.intensity = 0;
      this.offsetX = 0;
      this.offsetY = 0;
      this.rotation = 0;
    }
  }

  apply(ctx) {
    if (this.timer > 0) {
      ctx.translate(this.offsetX, this.offsetY);
      ctx.rotate(this.rotation);
    }
  }
}
