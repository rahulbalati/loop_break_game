// LOOP//BREAK - Pre-rendered glow sprites. shadowBlur is expensive per frame on mobile, so every
// glowing shape is drawn once to an offscreen canvas and then blitted with drawImage.

export class SpriteCache {
  constructor() {
    this.sprites = new Map();
    this.dpr = 1;
  }

  setDpr(dpr) {
    if (dpr !== this.dpr) {
      this.dpr = dpr;
      this.sprites.clear();
    }
  }

  // `size` is the logical half-extent including glow. draw(ctx) draws centred at (0, 0).
  get(key, halfSize, draw) {
    let s = this.sprites.get(key);
    if (s) return s;
    const px = Math.ceil(halfSize * 2 * this.dpr);
    const canvas = document.createElement('canvas');
    canvas.width = px;
    canvas.height = px;
    const ctx = canvas.getContext('2d');
    ctx.setTransform(this.dpr, 0, 0, this.dpr, px / 2, px / 2);
    draw(ctx);
    s = { canvas, half: halfSize };
    this.sprites.set(key, s);
    return s;
  }
}

export function shapePath(ctx, shape, r) {
  ctx.beginPath();
  const poly = (n, rot = 0, rad = r) => {
    for (let i = 0; i < n; i++) {
      const a = rot + (i / n) * Math.PI * 2;
      const x = Math.cos(a) * rad, y = Math.sin(a) * rad;
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.closePath();
  };
  switch (shape) {
    case 'tri': poly(3); break;
    case 'dart':
      ctx.moveTo(r * 1.2, 0); ctx.lineTo(-r * 0.8, r * 0.75); ctx.lineTo(-r * 0.35, 0); ctx.lineTo(-r * 0.8, -r * 0.75); ctx.closePath();
      break;
    case 'hex': poly(6, Math.PI / 6); break;
    case 'diamond': poly(4); break;
    case 'square': poly(4, Math.PI / 4); break;
    case 'arrow':
      ctx.moveTo(r * 1.15, 0); ctx.lineTo(-r * 0.6, r); ctx.lineTo(-r * 0.2, 0); ctx.lineTo(-r * 0.6, -r); ctx.closePath();
      break;
    case 'ring': ctx.arc(0, 0, r, 0, Math.PI * 2); break;
    case 'octa': poly(8, Math.PI / 8); break;
    case 'boss': poly(6, 0); break;
    default: ctx.arc(0, 0, r, 0, Math.PI * 2);
  }
}
