// LOOP//BREAK - Unified Input Manager (Desktop Keyboard & Mobile Touch)

import { TouchJoystick } from './TouchJoystick.js';

export class InputManager {
  constructor(canvas) {
    this.canvas = canvas;
    this.keys = {};
    this.joystick = new TouchJoystick(canvas);

    // Track active gameplay state to prevent unwanted page scrolling
    this.isGameplayActive = false;

    // Movement direction vector (-1 to 1)
    this.moveVector = { x: 0, y: 0 };
    this.lastFacingAngle = 0; // In radians

    // Action triggers (one-shot flag per press)
    this.dashTriggered = false;
    this.pulseTriggered = false;
    this.pauseTriggered = false;

    // Input device detection ('keyboard' or 'touch')
    this.lastInputType = 'keyboard';

    this.bindKeyboard();
  }

  setGameplayActive(active) {
    this.isGameplayActive = !!active;
    if (this.joystick) {
      this.joystick.setEnabled(this.isGameplayActive);
    }
  }

  bindKeyboard() {
    window.addEventListener('keydown', (e) => {
      this.lastInputType = 'keyboard';

      // Prevent browser scroll on arrow keys and space when active
      if (this.isGameplayActive && ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '].includes(e.key)) {
        e.preventDefault();
      }

      const keyLower = e.key.toLowerCase();
      this.keys[keyLower] = true;
      this.keys[e.code] = true;

      // Dash triggers: Space, Left/Right Shift, K
      if (e.code === 'Space' || e.code === 'ShiftLeft' || e.code === 'ShiftRight' || e.code === 'KeyK' || keyLower === 'k') {
        this.dashTriggered = true;
      }
      // Pulse triggers: E, J, F
      if (keyLower === 'e' || keyLower === 'j' || keyLower === 'f' || e.code === 'KeyE' || e.code === 'KeyJ' || e.code === 'KeyF') {
        this.pulseTriggered = true;
      }
      // Pause triggers: Escape, P
      if (e.key === 'Escape' || keyLower === 'p' || e.code === 'KeyP') {
        this.pauseTriggered = true;
      }
    });

    window.addEventListener('keyup', (e) => {
      this.keys[e.key.toLowerCase()] = false;
      this.keys[e.code] = false;
    });

    // Reset keys if window loses focus
    window.addEventListener('blur', () => {
      this.keys = {};
      this.joystick.resetJoystick();
    });
  }

  // Called only on resize — recomputes button positions, radii and scale factors
  updateLayout(virtualWidth, virtualHeight) {
    this.joystick.updateLayout(virtualWidth, virtualHeight);
  }

  update() {
    // NOTE: updateLayout() is intentionally NOT called here.
    // Layout is computed once on resize via updateLayout(), not every physics tick.

    // Compute Keyboard Vector (QWERTY + AZERTY + Arrows)
    let kx = 0;
    let ky = 0;

    // Up: W (QWERTY) or Z (AZERTY) or ArrowUp
    if (this.keys['w'] || this.keys['z'] || this.keys['arrowup'] || this.keys['KeyW'] || this.keys['KeyZ']) ky -= 1;
    // Down: S or ArrowDown
    if (this.keys['s'] || this.keys['arrowdown'] || this.keys['KeyS']) ky += 1;
    // Left: A (QWERTY) or Q (AZERTY) or ArrowLeft
    if (this.keys['a'] || this.keys['q'] || this.keys['arrowleft'] || this.keys['KeyA'] || this.keys['KeyQ']) kx -= 1;
    // Right: D or ArrowRight
    if (this.keys['d'] || this.keys['arrowright'] || this.keys['KeyD']) kx += 1;

    // Normalize diagonal keyboard speed
    const kLen = Math.hypot(kx, ky);
    if (kLen > 0) {
      kx /= kLen;
      ky /= kLen;
      this.lastInputType = 'keyboard';
    }

    // Combine with Mobile Joystick
    const jx = this.joystick.vector.x;
    const jy = this.joystick.vector.y;

    if (Math.hypot(jx, jy) > 0.05) {
      this.moveVector.x = jx;
      this.moveVector.y = jy;
      this.lastFacingAngle = Math.atan2(jy, jx);
      this.lastInputType = 'touch';
    } else if (kLen > 0) {
      this.moveVector.x = kx;
      this.moveVector.y = ky;
      this.lastFacingAngle = Math.atan2(ky, kx);
    } else {
      this.moveVector.x = 0;
      this.moveVector.y = 0;
    }
  }

  consumeDash() {
    const kDash = this.dashTriggered;
    const tDash = this.joystick.consumeDash();
    this.dashTriggered = false;
    return kDash || tDash;
  }

  consumePulse() {
    const kPulse = this.pulseTriggered;
    const tPulse = this.joystick.consumePulse();
    this.pulseTriggered = false;
    return kPulse || tPulse;
  }

  consumePause() {
    if (this.pauseTriggered) {
      this.pauseTriggered = false;
      return true;
    }
    return false;
  }

  setAbilityCooldowns(dashCooldown, pulseCooldown, pulseUnlocked = true) {
    this.joystick.setCooldowns(dashCooldown, pulseCooldown, pulseUnlocked);
  }

  render(ctx) {
    this.joystick.render(ctx);
  }
}
