// LOOP//BREAK - BGMI-Style Rotary Analog Joystick & Multitouch Controller

export class TouchJoystick {
  constructor(canvas) {
    this.canvas = canvas;
    this.isActive = false;
    this.touchId = null;

    // Center base anchor (in virtual/screen pixels)
    this.baseX = 0;
    this.baseY = 0;
    // Current thumbstick position
    this.thumbX = 0;
    this.thumbY = 0;

    // Specs (Enlarged and dynamically scaled)
    this.maxRadius = 78; // Max thumb travel distance
    this.thumbRadius = 32;
    this.deadZone = 9;    // Minimum movement threshold

    // Output vector (-1 to 1)
    this.vector = { x: 0, y: 0 };
    this.angle = 0;
    this.intensity = 0; // 0 to 1

    // Touch zones and buttons
    this.dashTouchId = null;
    this.pulseTouchId = null;
    this.dashTriggered = false;
    this.pulseTriggered = false;

    // Button layout bounding boxes (calculated in resize)
    this.dashButton = { x: 0, y: 0, radius: 72 };
    this.pulseButton = { x: 0, y: 0, radius: 56 };

    // Cooldown progress (0 = ready, 1 = on full cooldown)
    this.dashCooldown = 0;
    this.pulseCooldown = 0;
    this.pulseUnlocked = true;

    this.isTouchDevice = false;
    this.bindEvents();
  }

  bindEvents() {
    const el = window;

    const onTouchStart = (e) => {
      this.isTouchDevice = true;
      const rect = this.canvas.getBoundingClientRect();
      const scaleX = this.canvas.width / rect.width;
      const scaleY = this.canvas.height / rect.height;

      for (let i = 0; i < e.changedTouches.length; i++) {
        const touch = e.changedTouches[i];
        const screenX = (touch.clientX - rect.left) * scaleX;
        const screenY = (touch.clientY - rect.top) * scaleY;

        // Check Dash Button first with generous 1.55x touch tolerance for mobile thumbs
        const distToDash = Math.hypot(screenX - this.dashButton.x, screenY - this.dashButton.y);
        if (distToDash <= this.dashButton.radius * 1.55 && this.dashTouchId === null) {
          this.dashTouchId = touch.identifier;
          this.dashTriggered = true;
          e.preventDefault();
          continue;
        }

        // Check Pulse Button
        if (this.pulseUnlocked) {
          const distToPulse = Math.hypot(screenX - this.pulseButton.x, screenY - this.pulseButton.y);
          if (distToPulse <= this.pulseButton.radius * 1.55 && this.pulseTouchId === null) {
            this.pulseTouchId = touch.identifier;
            this.pulseTriggered = true;
            e.preventDefault();
            continue;
          }
        }

        // Left 50% of the screen initiates the Joystick
        if (screenX < this.canvas.width * 0.5 && this.touchId === null) {
          this.touchId = touch.identifier;
          this.isActive = true;
          this.baseX = screenX;
          this.baseY = screenY;
          this.thumbX = screenX;
          this.thumbY = screenY;
          this.updateVector(screenX, screenY);
          e.preventDefault();
        }
      }
    };

    const onTouchMove = (e) => {
      if (!this.isActive) return;
      const rect = this.canvas.getBoundingClientRect();
      const scaleX = this.canvas.width / rect.width;
      const scaleY = this.canvas.height / rect.height;

      for (let i = 0; i < e.changedTouches.length; i++) {
        const touch = e.changedTouches[i];
        if (touch.identifier === this.touchId) {
          const screenX = (touch.clientX - rect.left) * scaleX;
          const screenY = (touch.clientY - rect.top) * scaleY;
          this.updateVector(screenX, screenY);
          e.preventDefault();
        }
      }
    };

    const onTouchEnd = (e) => {
      for (let i = 0; i < e.changedTouches.length; i++) {
        const touch = e.changedTouches[i];
        if (touch.identifier === this.touchId) {
          this.resetJoystick();
        }
        if (touch.identifier === this.dashTouchId) {
          this.dashTouchId = null;
        }
        if (touch.identifier === this.pulseTouchId) {
          this.pulseTouchId = null;
        }
      }
      // Safety fail-safe: if no active touches remain on screen, reset everything
      if (e.touches && e.touches.length === 0) {
        this.resetJoystick();
        this.dashTouchId = null;
        this.pulseTouchId = null;
      }
    };

    window.addEventListener('touchstart', onTouchStart, { passive: false });
    window.addEventListener('touchmove', onTouchMove, { passive: false });
    window.addEventListener('touchend', onTouchEnd, { passive: false });
    window.addEventListener('touchcancel', onTouchEnd, { passive: false });
  }

  updateLayout(virtualWidth, virtualHeight) {
    // Dynamic Responsive Scaling for Joystick and Action Buttons
    const scaleFactor = Math.max(0.95, Math.min(1.35, virtualHeight / 720));

    // Enlarged Joystick Dimensions
    this.maxRadius = Math.round(76 * scaleFactor);
    this.thumbRadius = Math.round(33 * scaleFactor);
    this.deadZone = Math.round(9 * scaleFactor);

    // Responsive Margins (anchored to viewport edges with safe area padding)
    const rightMargin = Math.max(115, Math.min(210, virtualWidth * 0.10));
    const bottomMargin = Math.max(105, Math.min(160, virtualHeight * 0.17));

    // Enlarged Buttons with proportional scaling
    this.dashButton.radius = Math.round(Math.max(65, Math.min(85, virtualHeight * 0.11)));
    this.dashButton.x = virtualWidth - rightMargin;
    this.dashButton.y = virtualHeight - bottomMargin;

    this.pulseButton.radius = Math.round(Math.max(52, Math.min(70, virtualHeight * 0.088)));
    // Ergonomic orbital placement: placed slightly left-above Dash for natural thumb sweep
    this.pulseButton.x = this.dashButton.x - 22;
    this.pulseButton.y = this.dashButton.y - (this.dashButton.radius + this.pulseButton.radius + 24);

    // Default neutral base position on bottom-left if inactive
    if (!this.isActive) {
      const leftMargin = Math.max(135, Math.min(240, virtualWidth * 0.12));
      this.baseX = leftMargin;
      this.baseY = virtualHeight - bottomMargin;
      this.thumbX = this.baseX;
      this.thumbY = this.baseY;
    }
  }

  updateVector(targetX, targetY) {
    const dx = targetX - this.baseX;
    const dy = targetY - this.baseY;
    const dist = Math.hypot(dx, dy);

    if (dist < this.deadZone) {
      this.vector.x = 0;
      this.vector.y = 0;
      this.intensity = 0;
      this.thumbX = this.baseX;
      this.thumbY = this.baseY;
      return;
    }

    this.angle = Math.atan2(dy, dx);
    const clampedDist = Math.min(dist, this.maxRadius);

    this.thumbX = this.baseX + Math.cos(this.angle) * clampedDist;
    this.thumbY = this.baseY + Math.sin(this.angle) * clampedDist;

    this.intensity = (clampedDist - this.deadZone) / (this.maxRadius - this.deadZone);
    this.vector.x = Math.cos(this.angle) * this.intensity;
    this.vector.y = Math.sin(this.angle) * this.intensity;
  }

  resetJoystick() {
    this.isActive = false;
    this.touchId = null;
    this.vector.x = 0;
    this.vector.y = 0;
    this.intensity = 0;
    this.thumbX = this.baseX;
    this.thumbY = this.baseY;
  }

  consumeDash() {
    if (this.dashTriggered) {
      this.dashTriggered = false;
      return true;
    }
    return false;
  }

  consumePulse() {
    if (this.pulseTriggered) {
      this.pulseTriggered = false;
      return true;
    }
    return false;
  }

  setCooldowns(dashCooldown, pulseCooldown, pulseUnlocked = true) {
    this.dashCooldown = Math.max(0, Math.min(1, dashCooldown));
    this.pulseCooldown = Math.max(0, Math.min(1, pulseCooldown));
    this.pulseUnlocked = pulseUnlocked;
  }

  render(ctx) {
    // Only render touch controls if touch has been detected
    if (!this.isTouchDevice) return;

    ctx.save();

    // 1. Render Joystick Outer Ring & Thumbstick
    const ringAlpha = this.isActive ? 0.45 : 0.22;
    ctx.beginPath();
    ctx.arc(this.baseX, this.baseY, this.maxRadius, 0, Math.PI * 2);
    ctx.lineWidth = 3;
    ctx.strokeStyle = `rgba(0, 240, 255, ${ringAlpha})`;
    ctx.fillStyle = `rgba(10, 20, 45, ${ringAlpha * 0.7})`;
    ctx.fill();
    ctx.stroke();

    // Inner dead zone marker
    ctx.beginPath();
    ctx.arc(this.baseX, this.baseY, this.deadZone, 0, Math.PI * 2);
    ctx.strokeStyle = `rgba(0, 240, 255, ${ringAlpha * 0.5})`;
    ctx.stroke();

    // Movable thumbstick
    const thumbAlpha = this.isActive ? 0.85 : 0.45;
    ctx.beginPath();
    ctx.arc(this.thumbX, this.thumbY, this.thumbRadius || 33, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(0, 240, 255, ${thumbAlpha * 0.6})`;
    ctx.strokeStyle = `rgba(255, 255, 255, ${thumbAlpha})`;
    ctx.lineWidth = 2.5;
    ctx.fill();
    ctx.stroke();

    // 2. Render DASH Button (Bottom-Right)
    const db = this.dashButton;
    ctx.beginPath();
    ctx.arc(db.x, db.y, db.radius, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(12, 18, 38, 0.65)';
    ctx.fill();
    ctx.lineWidth = 3;
    ctx.strokeStyle = this.dashCooldown <= 0 ? '#00f0ff' : 'rgba(0, 240, 255, 0.3)';
    ctx.stroke();

    // Radial Cooldown Swipe
    if (this.dashCooldown > 0) {
      ctx.beginPath();
      ctx.moveTo(db.x, db.y);
      ctx.arc(db.x, db.y, db.radius - 2, -Math.PI / 2, -Math.PI / 2 + (1 - this.dashCooldown) * Math.PI * 2);
      ctx.closePath();
      ctx.fillStyle = 'rgba(0, 240, 255, 0.25)';
      ctx.fill();
    }

    // DASH Icon / Label
    ctx.fillStyle = this.dashCooldown <= 0 ? '#ffffff' : 'rgba(255, 255, 255, 0.4)';
    ctx.font = 'bold 16px Orbitron, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('DASH', db.x, db.y);

    // 3. Render PULSE Button (Orbital above Dash)
    if (this.pulseUnlocked) {
      const pb = this.pulseButton;
      ctx.beginPath();
      ctx.arc(pb.x, pb.y, pb.radius, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(12, 18, 38, 0.65)';
      ctx.fill();
      ctx.lineWidth = 2.5;
      ctx.strokeStyle = this.pulseCooldown <= 0 ? '#b026ff' : 'rgba(176, 38, 255, 0.3)';
      ctx.stroke();

      // Cooldown swipe for pulse
      if (this.pulseCooldown > 0) {
        ctx.beginPath();
        ctx.moveTo(pb.x, pb.y);
        ctx.arc(pb.x, pb.y, pb.radius - 2, -Math.PI / 2, -Math.PI / 2 + (1 - this.pulseCooldown) * Math.PI * 2);
        ctx.closePath();
        ctx.fillStyle = 'rgba(176, 38, 255, 0.25)';
        ctx.fill();
      }

      ctx.fillStyle = this.pulseCooldown <= 0 ? '#ffffff' : 'rgba(255, 255, 255, 0.4)';
      ctx.font = 'bold 13px Orbitron, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('PULSE', pb.x, pb.y);
    }

    ctx.restore();
  }
}
