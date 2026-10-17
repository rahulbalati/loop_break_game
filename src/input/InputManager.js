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

    this.bindKeyboard();
  }

  setGameplayActive(active) {
    this.isGameplayActive = active;
  }

  bindKeyboard() {
    window.addEventListener('keydown', (e) => {
      // Prevent browser scroll on arrow keys and space when active
      if (this.isGameplayActive && ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '].includes(e.key)) {
        e.preventDefault();
      }

      this.keys[e.key.toLowerCase()] = true;
      this.keys[e.code] = true;

      if (e.code === 'Space') {
        this.dashTriggered = true;
      }
      if (e.key.toLowerCase() === 'e' || e.key.toLowerCase() === 'j') {
        this.pulseTriggered = true;
      }
      if (e.key === 'Escape' || e.key.toLowerCase() === 'p') {
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

  update(virtualWidth, virtualHeight) {
    this.joystick.updateLayout(virtualWidth, virtualHeight);

    // Compute Keyboard Vector
    let kx = 0;
    let ky = 0;

    if (this.keys['w'] || this.keys['arrowup']) ky -= 1;
    if (this.keys['s'] || this.keys['arrowdown']) ky += 1;
    if (this.keys['a'] || this.keys['arrowleft']) kx -= 1;
    if (this.keys['d'] || this.keys['arrowright']) kx += 1;

    // Normalize diagonal keyboard speed
    const kLen = Math.hypot(kx, ky);
    if (kLen > 0) {
      kx /= kLen;
      ky /= kLen;
    }

    // Combine with Mobile Joystick
    const jx = this.joystick.vector.x;
    const jy = this.joystick.vector.y;

    if (Math.hypot(jx, jy) > 0.05) {
      this.moveVector.x = jx;
      this.moveVector.y = jy;
      this.lastFacingAngle = Math.atan2(jy, jx);
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
