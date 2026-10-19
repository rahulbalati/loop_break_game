// LOOP//BREAK - Pooled particle simulation. Pure data; drawn by Renderer with cached glow sprites.

export class ParticleSystem {
  constructor(rng = Math.random) {
    this.rng = rng;
    this.items = [];
    this.free = [];
    this.max = 520; // lowered on weaker devices
  }

  reset() {
    for (const p of this.items) this.free.push(p);
    this.items.length = 0;
  }

  emit(x, y, { count = 8, color = '#ffffff', speed = 140, life = 0.45, size = 3, angle = 0, spread = Math.PI * 2, drag = 4 } = {}) {
    for (let i = 0; i < count; i++) {
      if (this.items.length >= this.max) return;
      const p = this.free.pop() || {};
      const a = angle - spread / 2 + this.rng() * spread;
      const s = speed * (0.35 + this.rng() * 0.85);
      p.x = x;
      p.y = y;
      p.vx = Math.cos(a) * s;
      p.vy = Math.sin(a) * s;
      p.life = life * (0.6 + this.rng() * 0.6);
      p.maxLife = p.life;
      p.size = size * (0.6 + this.rng() * 0.8);
      p.color = color;
      p.drag = drag;
      this.items.push(p);
    }
  }

  update(dt) {
    const items = this.items;
    for (let i = items.length - 1; i >= 0; i--) {
      const p = items[i];
      p.life -= dt;
      if (p.life <= 0) {
        items[i] = items[items.length - 1];
        items.pop();
        this.free.push(p);
        continue;
      }
      const damp = Math.max(0, 1 - p.drag * dt);
      p.vx *= damp;
      p.vy *= damp;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
    }
  }
}
