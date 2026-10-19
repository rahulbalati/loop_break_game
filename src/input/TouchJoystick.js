// LOOP//BREAK - Floating analog joystick (anywhere on the left 60%) + dash button, multitouch.

export class TouchJoystick {
  constructor(canvas) {
    this.canvas = canvas;
    this.virtualWidth = 1280;
    this.virtualHeight = 720;
    this.isActive = false;
    this.touchId = null;
    this.baseX = 0;
    this.baseY = 0;
    this.thumbX = 0;
    this.thumbY = 0;
    this.maxRadius = 70;
    this.thumbRadius = 28;
    this.deadZone = 8;
    this.vector = { x: 0, y: 0 };

    this.dashButton = { x: 0, y: 0, radius: 60 };
    this.dashTouchId = null;
    this.dashTriggered = false;
    this.dashCooldown = 0;
    this.isTouchDevice = false;
    this.enabled = false;
    this.bindEvents();
  }

  setEnabled(val) {
    this.enabled = !!val;
    if (!this.enabled) {
      this.resetJoystick();
      this.dashTouchId = null;
    }
  }

  toVirtual(touch) {
    const rect = this.canvas.getBoundingClientRect();
    return {
      x: (touch.clientX - rect.left) * (this.virtualWidth / rect.width),
      y: (touch.clientY - rect.top) * (this.virtualHeight / rect.height),
    };
  }

  bindEvents() {
    const onStart = (e) => {
      this.isTouchDevice = true;
      if (!this.enabled) return;
      // Let HUD buttons (pause) receive their own taps
      if (e.target && e.target.closest && e.target.closest('button')) return;
      for (const touch of e.changedTouches) {
        const p = this.toVirtual(touch);
        const db = this.dashButton;
        if (this.dashTouchId === null && Math.hypot(p.x - db.x, p.y - db.y) <= db.radius * 1.5) {
          this.dashTouchId = touch.identifier;
          this.dashTriggered = true;
          e.preventDefault();
          continue;
        }
        if (this.touchId === null && p.x < this.virtualWidth * 0.6) {
          this.touchId = touch.identifier;
          this.isActive = true;
          this.baseX = p.x;
          this.baseY = p.y;
          this.updateVector(p.x, p.y);
          e.preventDefault();
        }
      }
    };

    const onMove = (e) => {
      if (!this.enabled || !this.isActive) return;
      for (const touch of e.changedTouches) {
        if (touch.identifier !== this.touchId) continue;
        const p = this.toVirtual(touch);
        // Let the base follow the thumb when dragged past the ring, so direction changes stay quick
        const dx = p.x - this.baseX, dy = p.y - this.baseY;
        const dist = Math.hypot(dx, dy);
        if (dist > this.maxRadius * 1.4) {
          const k = (dist - this.maxRadius * 1.4) / dist;
          this.baseX += dx * k;
          this.baseY += dy * k;
        }
        this.updateVector(p.x, p.y);
        e.preventDefault();
      }
    };

    const onEnd = (e) => {
      for (const touch of e.changedTouches) {
        if (touch.identifier === this.touchId) this.resetJoystick();
        if (touch.identifier === this.dashTouchId) this.dashTouchId = null;
      }
      if (e.touches && e.touches.length === 0) {
        this.resetJoystick();
        this.dashTouchId = null;
      }
    };

    window.addEventListener('touchstart', onStart, { passive: false });
    window.addEventListener('touchmove', onMove, { passive: false });
    window.addEventListener('touchend', onEnd, { passive: false });
    window.addEventListener('touchcancel', onEnd, { passive: false });
  }

  updateLayout(w, h) {
    this.virtualWidth = w;
    this.virtualHeight = h;
    const scale = Math.max(0.9, Math.min(1.25, h / 720));
    this.maxRadius = Math.round(64 * scale);
    this.thumbRadius = Math.round(26 * scale);
    this.deadZone = Math.round(7 * scale);
    this.dashButton.radius = Math.round(Math.max(48, Math.min(66, h * 0.09)));
    this.dashButton.x = w - Math.max(96, Math.min(170, w * 0.085));
    this.dashButton.y = h - Math.max(96, Math.min(150, h * 0.17));
    if (!this.isActive) {
      this.baseX = Math.max(120, Math.min(200, w * 0.11));
      this.baseY = h - Math.max(110, Math.min(160, h * 0.19));
      this.thumbX = this.baseX;
      this.thumbY = this.baseY;
    }
  }

  updateVector(tx, ty) {
    const dx = tx - this.baseX;
    const dy = ty - this.baseY;
    const dist = Math.hypot(dx, dy);
    if (dist < this.deadZone) {
      this.vector.x = 0;
      this.vector.y = 0;
      this.thumbX = this.baseX;
      this.thumbY = this.baseY;
      return;
    }
    const a = Math.atan2(dy, dx);
    const clamped = Math.min(dist, this.maxRadius);
    this.thumbX = this.baseX + Math.cos(a) * clamped;
    this.thumbY = this.baseY + Math.sin(a) * clamped;
    // Reach full speed at 70% deflection so thumbs don't have to stretch
    const intensity = Math.min(1, (clamped - this.deadZone) / ((this.maxRadius - this.deadZone) * 0.7));
    this.vector.x = Math.cos(a) * intensity;
    this.vector.y = Math.sin(a) * intensity;
  }

  resetJoystick() {
    this.isActive = false;
    this.touchId = null;
    this.vector.x = 0;
    this.vector.y = 0;
    this.updateLayout(this.virtualWidth, this.virtualHeight);
  }

  consumeDash() {
    const v = this.dashTriggered;
    this.dashTriggered = false;
    return v;
  }

  setCooldown(frac) {
    this.dashCooldown = Math.max(0, Math.min(1, frac));
  }

  render(ctx) {
    if (!this.isTouchDevice || !this.enabled) return;
    ctx.save();
    const ringA = this.isActive ? 0.5 : 0.2;
    ctx.beginPath();
    ctx.arc(this.baseX, this.baseY, this.maxRadius, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(20, 14, 40, ${ringA * 0.8})`;
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = `rgba(168, 115, 255, ${ringA + 0.1})`;
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(this.thumbX, this.thumbY, this.thumbRadius, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(232, 255, 58, ${this.isActive ? 0.85 : 0.35})`;
    ctx.fill();

    const db = this.dashButton;
    const ready = this.dashCooldown <= 0;
    ctx.beginPath();
    ctx.arc(db.x, db.y, db.radius, 0, Math.PI * 2);
    ctx.fillStyle = ready ? 'rgba(232, 255, 58, 0.16)' : 'rgba(20, 14, 40, 0.6)';
    ctx.fill();
    ctx.lineWidth = 3;
    ctx.strokeStyle = ready ? '#e8ff3a' : 'rgba(232, 255, 58, 0.3)';
    ctx.stroke();
    if (!ready) {
      ctx.beginPath();
      ctx.arc(db.x, db.y, db.radius + 6, -Math.PI / 2, -Math.PI / 2 + (1 - this.dashCooldown) * Math.PI * 2);
      ctx.strokeStyle = '#e8ff3a';
      ctx.lineWidth = 3;
      ctx.stroke();
    }
    ctx.fillStyle = ready ? '#e8ff3a' : 'rgba(255,255,255,0.4)';
    ctx.font = '700 15px "Chakra Petch", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('DASH', db.x, db.y);
    ctx.restore();
  }
}
