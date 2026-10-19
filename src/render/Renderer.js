// LOOP//BREAK - Canvas renderer for runs and the hub showcase. Reads Run state, never mutates it.
import { CONFIG } from '../config.js';
import { SpriteCache, shapePath } from './SpriteCache.js';
import { getCharacter } from '../data/characters.js';

const TAU = Math.PI * 2;

export class Renderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d', { alpha: false });
    this.sprites = new SpriteCache();
    this.dpr = 1;
    this.w = 1280;
    this.h = 720;
    this.camX = 0;
    this.camY = 0;
    this.quality = 1; // lowered automatically if frames drop
    this.shakeEnabled = true;
    this.hubTrail = [];
  }

  resize(w, h, dpr) {
    this.w = w;
    this.h = h;
    this.dpr = dpr;
    this.sprites.setDpr(dpr);
    this.canvas.width = Math.round(w * dpr);
    this.canvas.height = Math.round(h * dpr);
  }

  // ---------- Sprites ----------

  glowDot(color, radius) {
    const r = Math.max(1, Math.round(radius));
    return this.sprites.get(`dot:${color}:${r}`, r * 3, (c) => {
      const g = c.createRadialGradient(0, 0, 0, 0, 0, r * 3);
      g.addColorStop(0, '#ffffff');
      g.addColorStop(0.22, color);
      g.addColorStop(0.5, hexAlpha(color, 0.35));
      g.addColorStop(1, hexAlpha(color, 0));
      c.fillStyle = g;
      c.beginPath();
      c.arc(0, 0, r * 3, 0, TAU);
      c.fill();
    });
  }

  enemySprite(e, flash) {
    const shape = e.def.shape;
    const r = Math.round(e.r);
    const key = `en:${e.type}:${r}:${e.elite ? 1 : 0}:${flash ? 1 : 0}`;
    return this.sprites.get(key, r + 14, (c) => {
      const col = flash ? '#ffffff' : e.color;
      c.shadowColor = col;
      c.shadowBlur = 12;
      shapePath(c, shape, r);
      c.fillStyle = flash ? '#ffffff' : hexAlpha(e.color, 0.22);
      c.fill();
      c.lineWidth = shape === 'ring' ? 4 : 2.5;
      c.strokeStyle = col;
      c.stroke();
      c.shadowBlur = 0;
      if (shape === 'boss' || shape === 'octa') {
        shapePath(c, shape, r * 0.55);
        c.strokeStyle = hexAlpha(col, 0.8);
        c.lineWidth = 2;
        c.stroke();
        c.beginPath();
        c.arc(0, 0, r * 0.2, 0, TAU);
        c.fillStyle = col;
        c.fill();
      } else if (shape !== 'ring') {
        c.beginPath();
        c.arc(r * 0.25, 0, Math.max(2, r * 0.18), 0, TAU);
        c.fillStyle = flash ? e.color : '#ffffff';
        c.fill();
      }
      if (e.elite) {
        c.beginPath();
        c.arc(0, 0, r + 6, 0, TAU);
        c.strokeStyle = '#ffc83d';
        c.setLineDash([4, 4]);
        c.lineWidth = 2;
        c.stroke();
      }
    });
  }

  looperSprite(color, alpha = 1, key = 'player') {
    return this.sprites.get(`looper:${key}:${color}:${alpha}`, 30, (c) => {
      c.globalAlpha = alpha;
      c.shadowColor = color;
      c.shadowBlur = 16;
      c.beginPath();
      c.arc(0, 0, 13, 0, TAU);
      c.strokeStyle = color;
      c.lineWidth = 3;
      c.stroke();
      c.shadowBlur = 8;
      c.beginPath();
      c.arc(0, 0, 6, 0, TAU);
      c.fillStyle = '#ffffff';
      c.fill();
      // Broken ring motif: the "//" in LOOP//BREAK
      c.shadowBlur = 0;
      c.strokeStyle = CONFIG.COLORS.BG;
      c.lineWidth = 4;
      c.beginPath();
      c.moveTo(-3, -16); c.lineTo(3, -10);
      c.stroke();
    });
  }

  gemSprite(tier) {
    const color = tier === 2 ? CONFIG.COLORS.XP_LARGE : tier === 1 ? CONFIG.COLORS.XP_MED : CONFIG.COLORS.XP_SMALL;
    const r = tier === 2 ? 8 : tier === 1 ? 6 : 4.5;
    return this.sprites.get(`gem:${tier}`, r + 8, (c) => {
      c.shadowColor = color;
      c.shadowBlur = 8;
      c.beginPath();
      c.moveTo(0, -r); c.lineTo(r * 0.7, 0); c.lineTo(0, r); c.lineTo(-r * 0.7, 0); c.closePath();
      c.fillStyle = color;
      c.fill();
      c.shadowBlur = 0;
      c.beginPath();
      c.moveTo(0, -r * 0.5); c.lineTo(r * 0.3, 0); c.lineTo(0, r * 0.1); c.closePath();
      c.fillStyle = 'rgba(255,255,255,0.8)';
      c.fill();
    });
  }

  pickupSprite(type) {
    return this.sprites.get(`pickup:${type}`, 30, (c) => {
      if (type === 'cache') {
        c.shadowColor = '#ffc83d';
        c.shadowBlur = 18;
        c.strokeStyle = '#ffc83d';
        c.lineWidth = 2.5;
        c.fillStyle = 'rgba(255,200,61,0.18)';
        c.beginPath();
        c.rect(-13, -10, 26, 20);
        c.fill();
        c.stroke();
        c.beginPath();
        c.moveTo(-13, -2); c.lineTo(13, -2);
        c.moveTo(0, -6); c.lineTo(0, 2);
        c.stroke();
      } else if (type === 'heal') {
        c.shadowColor = '#ff4d6d';
        c.shadowBlur = 14;
        c.fillStyle = '#ff4d6d';
        c.fillRect(-3, -9, 6, 18);
        c.fillRect(-9, -3, 18, 6);
      } else if (type === 'flux') {
        c.shadowColor = '#ffc83d';
        c.shadowBlur = 12;
        c.fillStyle = '#ffc83d';
        c.beginPath();
        c.moveTo(2, -10); c.lineTo(-6, 2); c.lineTo(-1, 2); c.lineTo(-3, 10); c.lineTo(6, -3); c.lineTo(1, -3); c.closePath();
        c.fill();
      } else if (type === 'vacuum') {
        c.shadowColor = '#7dff6a';
        c.shadowBlur = 14;
        c.strokeStyle = '#7dff6a';
        c.lineWidth = 3;
        c.beginPath();
        c.arc(0, 0, 9, 0, TAU);
        c.stroke();
        c.beginPath();
        c.arc(0, 0, 3, 0, TAU);
        c.fillStyle = '#7dff6a';
        c.fill();
      }
    });
  }

  // Builds every sprite a run needs up front so the first elite or boss doesn't hitch a frame
  prewarm(enemyDefs, playerColor) {
    for (const [type, def] of Object.entries(enemyDefs)) {
      for (const elite of [false, true]) {
        const fake = { type, def, r: def.radius * (elite ? 1.4 : 1), elite, color: def.color };
        this.enemySprite(fake, false);
        this.enemySprite(fake, true);
      }
    }
    for (const t of [0, 1, 2]) this.gemSprite(t);
    for (const p of ['cache', 'heal', 'flux', 'vacuum']) this.pickupSprite(p);
    this.looperSprite(playerColor);
    this.looperSprite(CONFIG.COLORS.ECHO, 1, 'echo');
    for (const c of ['#ff4d6d', '#3df5ff', '#7dff6a', '#ff5cf0', '#9ad7ff', '#ffc83d', '#e8ff3a', '#c9a4ff', '#a873ff']) this.glowDot(c, 2);
  }

  blit(sprite, x, y, alpha = 1) {
    const ctx = this.ctx;
    if (alpha !== 1) ctx.globalAlpha = alpha;
    const s = sprite.half * 2;
    ctx.drawImage(sprite.canvas, x - sprite.half, y - sprite.half, s, s);
    if (alpha !== 1) ctx.globalAlpha = 1;
  }

  blitRotated(sprite, x, y, angle) {
    const ctx = this.ctx;
    const d = this.dpr;
    const c = Math.cos(angle), s = Math.sin(angle);
    ctx.setTransform(c * d, s * d, -s * d, c * d, x * d, y * d);
    ctx.drawImage(sprite.canvas, -sprite.half, -sprite.half, sprite.half * 2, sprite.half * 2);
    ctx.setTransform(d, 0, 0, d, 0, 0);
  }

  // ---------- Background ----------

  drawGrid(camX, camY, palette, time) {
    const ctx = this.ctx;
    const w = this.w, h = this.h;
    ctx.fillStyle = CONFIG.COLORS.BG;
    ctx.fillRect(0, 0, w, h);

    const cell = 48;
    const ox = -((camX - w / 2) % cell) - cell;
    const oy = -((camY - h / 2) % cell) - cell;
    ctx.lineWidth = 1;
    ctx.strokeStyle = palette.grid;
    ctx.beginPath();
    for (let x = ox; x < w + cell; x += cell) { ctx.moveTo(x, 0); ctx.lineTo(x, h); }
    for (let y = oy; y < h + cell; y += cell) { ctx.moveTo(0, y); ctx.lineTo(w, y); }
    ctx.stroke();

    // Major grid every 5 cells, with node crosses
    const major = cell * 5;
    const mx = -((camX - w / 2) % major) - major;
    const my = -((camY - h / 2) % major) - major;
    ctx.strokeStyle = palette.major;
    ctx.beginPath();
    for (let x = mx; x < w + major; x += major) { ctx.moveTo(x, 0); ctx.lineTo(x, h); }
    for (let y = my; y < h + major; y += major) { ctx.moveTo(0, y); ctx.lineTo(w, y); }
    ctx.stroke();

    // Slow scanning band adds motion even when the player stands still
    const bandY = ((time * 60) % (h + 200)) - 100;
    const g = ctx.createLinearGradient(0, bandY - 80, 0, bandY + 80);
    const band = palette.band || '122,92,255';
    g.addColorStop(0, `rgba(${band},0)`);
    g.addColorStop(0.5, `rgba(${band},0.06)`);
    g.addColorStop(1, `rgba(${band},0)`);
    ctx.fillStyle = g;
    ctx.fillRect(0, bandY - 80, w, 160);
  }

  // ---------- Run ----------

  renderRun(run, time) {
    const ctx = this.ctx;
    const d = this.dpr;
    const p = run.player;

    // Smooth camera with slight look-ahead in the movement direction
    const lookX = p.x + p.vx * 0.12, lookY = p.y + p.vy * 0.12;
    this.camX += (lookX - this.camX) * 0.12;
    this.camY += (lookY - this.camY) * 0.12;
    let sx = 0, sy = 0;
    if (this.shakeEnabled && run.shake > 0) {
      sx = (Math.random() - 0.5) * run.shake;
      sy = (Math.random() - 0.5) * run.shake;
    }
    const ox = this.w / 2 - this.camX + sx;
    const oy = this.h / 2 - this.camY + sy;
    const W = this.w, H = this.h;
    const onScreen = (x, y, m) => x + ox > -m && x + ox < W + m && y + oy > -m && y + oy < H + m;

    ctx.setTransform(d, 0, 0, d, 0, 0);
    this.drawGrid(this.camX - sx, this.camY - sy, run.stage.palette, time);

    // Loop captures (filled flash)
    for (const fx of run.loopFx) {
      const a = fx.life / fx.maxLife;
      ctx.beginPath();
      for (let i = 0; i < fx.poly.length; i += 2) {
        const x = fx.poly[i] + ox, y = fx.poly[i + 1] + oy;
        if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      }
      ctx.closePath();
      ctx.fillStyle = `rgba(232,255,58,${0.28 * a})`;
      ctx.fill();
      ctx.strokeStyle = `rgba(232,255,58,${a})`;
      ctx.lineWidth = 3 + (1 - a) * 6;
      ctx.stroke();
    }

    // Loop trail: older points fade out
    const trail = run.trail;
    if (trail.length > 1) {
      ctx.globalCompositeOperation = 'lighter';
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      const maxAge = run.stats.trailSeconds;
      for (let pass = 0; pass < 2; pass++) {
        ctx.lineWidth = pass === 0 ? 9 : 2.5;
        for (let i = 1; i < trail.length; i++) {
          const age = (run.time - trail[i].t) / maxAge;
          const a = Math.max(0, 1 - age) * (pass === 0 ? 0.18 : 0.9);
          ctx.strokeStyle = pass === 0 ? `rgba(168,115,255,${a})` : `rgba(214,190,255,${a})`;
          ctx.beginPath();
          ctx.moveTo(trail[i - 1].x + ox, trail[i - 1].y + oy);
          ctx.lineTo(trail[i].x + ox, trail[i].y + oy);
          ctx.stroke();
        }
      }
      ctx.globalCompositeOperation = 'source-over';
    }

    // Rift telegraphs: ring closes in, then a solid flash on impact
    for (const rf of run.rifts) {
      const x = rf.x + ox, y = rf.y + oy;
      if (!onScreen(rf.x, rf.y, rf.r + 10)) continue;
      if (rf.warn > 0) {
        const k = 1 - rf.warn / rf.maxWarn;
        ctx.fillStyle = `rgba(255,61,110,${0.08 + k * 0.14})`;
        ctx.beginPath();
        ctx.arc(x, y, rf.r, 0, TAU);
        ctx.fill();
        ctx.strokeStyle = 'rgba(255,61,110,0.8)';
        ctx.lineWidth = 2;
        ctx.setLineDash([6, 5]);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.strokeStyle = '#3dffd0';
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.arc(x, y, rf.r * (1 - k) + 4, 0, TAU);
        ctx.stroke();
      } else {
        const a = rf.life / 0.35;
        ctx.fillStyle = `rgba(61,255,208,${a * 0.5})`;
        ctx.beginPath();
        ctx.arc(x, y, rf.r * (1.1 - a * 0.1), 0, TAU);
        ctx.fill();
      }
    }

    // Gems & pickups
    for (const g of run.gems) {
      if (!onScreen(g.x, g.y, 20)) continue;
      this.blit(this.gemSprite(g.tier), g.x + ox, g.y + oy);
    }
    for (const it of run.pickups) {
      const bob = Math.sin(time * 4 + it.x) * 3;
      if (!onScreen(it.x, it.y, 40)) continue;
      this.blit(this.pickupSprite(it.type), it.x + ox, it.y + oy + bob);
    }

    // Mines
    for (const m of run.mines) {
      if (!onScreen(m.x, m.y, 20)) continue;
      const blink = m.arm > 0 ? 0.4 : 0.6 + 0.4 * Math.sin(time * 14);
      this.blit(this.glowDot(m.color, 4), m.x + ox, m.y + oy, blink);
    }

    // Echoes
    for (const ec of run.echoes) {
      if (ec.alpha < 0.02) continue;
      const x = ec.x + ox, y = ec.y + oy;
      const flicker = ec.disabled > 0 ? (Math.random() < 0.5 ? 0.15 : 0.4) : 0.75;
      this.blit(this.looperSprite(CONFIG.COLORS.ECHO, 1, 'echo'), x, y, ec.alpha * flicker);
      if (ec.active && ec.paradoxTimer <= 0) {
        const pulse = 1 + Math.sin(time * 10 + ec.index) * 0.15;
        ctx.beginPath();
        ctx.arc(x, y, ec.r * 1.6 * pulse, 0, TAU);
        ctx.strokeStyle = 'rgba(242,233,255,0.85)';
        ctx.lineWidth = 2;
        ctx.stroke();
      }
    }

    // Enemies
    for (const e of run.enemies) {
      if (e.dead || !onScreen(e.x, e.y, e.r + 20)) continue;
      const x = e.x + ox, y = e.y + oy;
      const spr = this.enemySprite(e, e.hitFlash > 0);
      if (e.def.shape === 'ring' || e.def.shape === 'hex' || e.boss || e.def.shape === 'octa') {
        if (e.boss || e.def.shape === 'octa') this.blitRotated(spr, x, y, time * (e.boss ? 0.6 : 1.2));
        else this.blit(spr, x, y);
      } else {
        this.blitRotated(spr, x, y, e.angle);
      }
      if (e.chargeState === 'windup') {
        ctx.strokeStyle = 'rgba(255,90,61,0.7)';
        ctx.setLineDash([6, 6]);
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x + e.chargeX * 220, y + e.chargeY * 220);
        ctx.stroke();
        ctx.setLineDash([]);
      }
      if ((e.elite || e.miniboss) && e.hp < e.maxHp) {
        const bw = e.r * 2;
        ctx.fillStyle = 'rgba(0,0,0,0.6)';
        ctx.fillRect(x - bw / 2, y - e.r - 12, bw, 4);
        ctx.fillStyle = e.elite ? '#ffc83d' : e.color;
        ctx.fillRect(x - bw / 2, y - e.r - 12, bw * Math.max(0, e.hp / e.maxHp), 4);
      }
      if (e.echo) {
        const spr2 = this.enemySprite(e, false);
        this.ctx.globalAlpha = 0.45;
        this.blitRotated(spr2, e.echo.x + ox, e.echo.y + oy, -time * 0.6);
        this.ctx.globalAlpha = 1;
      }
    }

    // Orbit shards
    const op = run.orbitPoints;
    for (let i = 0; i < op.length; i += 4) {
      this.blit(this.glowDot('#7dff6a', op[i + 2] * 0.6), op[i] + ox, op[i + 1] + oy, op[i + 3]);
    }

    // Player projectiles & enemy bullets
    ctx.globalCompositeOperation = 'lighter';
    for (const pr of run.projectiles) {
      if (!onScreen(pr.x, pr.y, 20)) continue;
      this.blit(this.glowDot(pr.color, pr.r * 0.8), pr.x + ox, pr.y + oy);
    }
    ctx.globalCompositeOperation = 'source-over';
    const bulletSpr = this.glowDot(CONFIG.COLORS.ENEMY_BULLET, 4);
    for (const b of run.bullets) {
      if (!onScreen(b.x, b.y, 20)) continue;
      this.blit(bulletSpr, b.x + ox, b.y + oy);
    }

    // Player
    const px = p.x + ox, py = p.y + oy;
    const blink = p.invuln > 0 && Math.floor(time * 20) % 2 === 0 ? 0.35 : 1;
    this.blit(this.looperSprite(p.color), px, py, blink);
    ctx.strokeStyle = p.color;
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.arc(px, py, 19, Math.atan2(p.fy, p.fx) - 0.35, Math.atan2(p.fy, p.fx) + 0.35);
    ctx.stroke();
    // Health bar under the player
    const hpFrac = Math.max(0, p.hp / run.stats.maxHp);
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    ctx.fillRect(px - 18, py + 22, 36, 4);
    ctx.fillStyle = hpFrac > 0.35 ? '#3dffa8' : '#ff4d6d';
    ctx.fillRect(px - 18, py + 22, 36 * hpFrac, 4);
    // Dash readiness pip
    if (p.dashCd <= 0) {
      ctx.fillStyle = p.color;
      ctx.fillRect(px - 2, py + 28, 4, 3);
    }

    // Effects
    ctx.globalCompositeOperation = 'lighter';
    for (const r of run.rings) {
      const a = r.life / r.maxLife;
      ctx.beginPath();
      ctx.arc(r.x + ox, r.y + oy, r.r, 0, TAU);
      ctx.strokeStyle = hexAlpha(r.color, a * 0.9);
      ctx.lineWidth = r.width * a + 1;
      ctx.stroke();
    }
    for (const b of run.beams) {
      const a = b.life / b.maxLife;
      ctx.lineCap = 'round';
      ctx.strokeStyle = hexAlpha(b.color, a * 0.35);
      ctx.lineWidth = b.width * 1.8;
      ctx.beginPath();
      ctx.moveTo(b.x1 + ox, b.y1 + oy);
      ctx.lineTo(b.x2 + ox, b.y2 + oy);
      ctx.stroke();
      ctx.strokeStyle = `rgba(255,255,255,${a})`;
      ctx.lineWidth = b.width * 0.35;
      ctx.stroke();
    }
    for (const bolt of run.bolts) {
      const a = bolt.life / bolt.maxLife;
      ctx.strokeStyle = hexAlpha(bolt.color, a);
      ctx.lineWidth = 2;
      ctx.beginPath();
      const pts = bolt.points;
      ctx.moveTo(pts[0] + ox, pts[1] + oy);
      for (let i = 2; i < pts.length; i += 2) {
        const mx = (pts[i - 2] + pts[i]) / 2 + (Math.random() - 0.5) * 18;
        const my = (pts[i - 1] + pts[i + 1]) / 2 + (Math.random() - 0.5) * 18;
        ctx.lineTo(mx + ox, my + oy);
        ctx.lineTo(pts[i] + ox, pts[i + 1] + oy);
      }
      ctx.stroke();
    }
    for (const pt of run.particles.items) {
      if (!onScreen(pt.x, pt.y, 10)) continue;
      this.blit(this.glowDot(pt.color, 2), pt.x + ox, pt.y + oy, Math.min(1, (pt.life / pt.maxLife) * 1.4) * (pt.size / 3));
    }
    ctx.globalCompositeOperation = 'source-over';

    // Floating texts
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.lineJoin = 'round';
    for (const t of run.texts) {
      const a = Math.min(1, t.life / t.maxLife * 2);
      ctx.globalAlpha = a;
      ctx.font = `700 ${t.size}px "IBM Plex Mono", monospace`;
      ctx.lineWidth = 3;
      ctx.strokeStyle = 'rgba(7,6,13,0.9)';
      ctx.strokeText(t.text, t.x + ox, t.y + oy);
      ctx.fillStyle = t.color;
      ctx.fillText(t.text, t.x + ox, t.y + oy);
    }
    ctx.globalAlpha = 1;

    // Off-screen indicators for boss, minibosses, elites and caches
    for (const e of run.enemies) {
      if (e.dead || !(e.boss || e.miniboss || e.elite)) continue;
      this.edgeArrow(e.x + ox, e.y + oy, e.boss || e.miniboss ? e.color : '#ffc83d');
    }
    for (const it of run.pickups) {
      if (it.type === 'cache') this.edgeArrow(it.x + ox, it.y + oy, '#ffc83d');
    }

    // Full-screen flash
    if (run.flash > 0) {
      ctx.fillStyle = `rgba(232,220,255,${run.flash * 0.35})`;
      ctx.fillRect(0, 0, W, H);
    }
  }

  edgeArrow(x, y, color) {
    const m = 26;
    if (x > m && x < this.w - m && y > m && y < this.h - m) return;
    const cx = this.w / 2, cy = this.h / 2;
    const a = Math.atan2(y - cy, x - cx);
    const ex = Math.max(m, Math.min(this.w - m, x));
    const ey = Math.max(m, Math.min(this.h - m, y));
    const ctx = this.ctx;
    ctx.save();
    ctx.translate(ex, ey);
    ctx.rotate(a);
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(10, 0); ctx.lineTo(-6, 7); ctx.lineTo(-2, 0); ctx.lineTo(-6, -7); ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  // ---------- Hub showcase: a looper tracing a figure-eight with echoes following ----------

  renderHub(time, characterId, skinColor) {
    const ctx = this.ctx;
    const d = this.dpr;
    ctx.setTransform(d, 0, 0, d, 0, 0);
    const palette = { grid: 'rgba(120, 92, 255, 0.08)', major: 'rgba(120, 92, 255, 0.18)' };
    this.drawGrid(time * 30, time * 12, palette, time);

    const ch = getCharacter(characterId);
    const color = skinColor || ch.color;
    // Keep the showcase in the right half so it never runs under the menu column
    const cx = this.w * 0.7;
    const cy = this.h * 0.55;
    const ax = Math.min(this.w * 0.13, 230), ay = Math.min(this.h * 0.17, 130);
    const pos = (t) => {
      const s = t * 0.9;
      return { x: cx + Math.sin(s) * ax, y: cy + Math.sin(s * 2) * ay };
    };

    // Trail
    ctx.globalCompositeOperation = 'lighter';
    ctx.lineCap = 'round';
    const steps = 46;
    for (let i = 1; i < steps; i++) {
      const t0 = time - (i - 1) * 0.05, t1 = time - i * 0.05;
      const a = 1 - i / steps;
      const p0 = pos(t0), p1 = pos(t1);
      ctx.strokeStyle = `rgba(168,115,255,${a * 0.7})`;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(p0.x, p0.y);
      ctx.lineTo(p1.x, p1.y);
      ctx.stroke();
    }
    ctx.globalCompositeOperation = 'source-over';

    for (let k = 3; k >= 1; k--) {
      const ep = pos(time - k * 0.75);
      this.blit(this.looperSprite(CONFIG.COLORS.ECHO, 1, 'echo'), ep.x, ep.y, 0.75 - k * 0.12);
    }
    const p = pos(time);
    this.blit(this.looperSprite(color), p.x, p.y);
  }
}

export function hexAlpha(hex, a) {
  if (hex.startsWith('rgba')) return hex;
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${Math.max(0, Math.min(1, a)).toFixed(3)})`;
}
