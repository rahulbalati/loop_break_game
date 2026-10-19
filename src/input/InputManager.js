// LOOP//BREAK - Unified input: keyboard (QWERTY/AZERTY/arrows) + touch joystick.

import { TouchJoystick } from './TouchJoystick.js';

const DASH_CODES = new Set(['Space', 'ShiftLeft', 'ShiftRight', 'KeyK']);
const SCROLL_KEYS = new Set(['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' ']);

export class InputManager {
  constructor(canvas) {
    this.keys = {};
    this.joystick = new TouchJoystick(canvas);
    this.isGameplayActive = false;
    this.moveVector = { x: 0, y: 0 };
    this.dashTriggered = false;
    this.pauseTriggered = false;
    this.lastInputType = 'keyboard';
    this.bindKeyboard();
  }

  setGameplayActive(active) {
    this.isGameplayActive = !!active;
    this.joystick.setEnabled(this.isGameplayActive);
    if (!active) {
      this.dashTriggered = false;
      this.pauseTriggered = false;
    }
  }

  bindKeyboard() {
    window.addEventListener('keydown', (e) => {
      this.lastInputType = 'keyboard';
      if (this.isGameplayActive && SCROLL_KEYS.has(e.key)) e.preventDefault();
      this.keys[e.code] = true;
      this.keys[e.key.toLowerCase()] = true;
      if (!this.isGameplayActive || e.repeat) return;
      if (DASH_CODES.has(e.code)) this.dashTriggered = true;
      if (e.code === 'Escape' || e.code === 'KeyP') this.pauseTriggered = true;
    });
    window.addEventListener('keyup', (e) => {
      this.keys[e.code] = false;
      this.keys[e.key.toLowerCase()] = false;
    });
    window.addEventListener('blur', () => {
      this.keys = {};
      this.joystick.resetJoystick();
    });
  }

  updateLayout(w, h) {
    this.joystick.updateLayout(w, h);
  }

  update() {
    const k = this.keys;
    let kx = 0, ky = 0;
    // Physical key codes cover AZERTY too: its Z/Q keys report KeyW/KeyA
    if (k.KeyW || k.ArrowUp) ky -= 1;
    if (k.KeyS || k.ArrowDown) ky += 1;
    if (k.KeyA || k.ArrowLeft) kx -= 1;
    if (k.KeyD || k.ArrowRight) kx += 1;
    const kLen = Math.hypot(kx, ky);

    const jv = this.joystick.vector;
    if (Math.hypot(jv.x, jv.y) > 0.05) {
      this.moveVector.x = jv.x;
      this.moveVector.y = jv.y;
      this.lastInputType = 'touch';
    } else if (kLen > 0) {
      this.moveVector.x = kx / kLen;
      this.moveVector.y = ky / kLen;
    } else {
      this.moveVector.x = 0;
      this.moveVector.y = 0;
    }
  }

  consumeDash() {
    const v = this.dashTriggered || this.joystick.consumeDash();
    this.dashTriggered = false;
    return v;
  }

  consumePause() {
    const v = this.pauseTriggered;
    this.pauseTriggered = false;
    return v;
  }

  render(ctx) {
    this.joystick.render(ctx);
  }
}
