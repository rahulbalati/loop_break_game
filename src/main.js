// LOOP//BREAK - Main Entry Point & Initialization

import { GameEngine } from './core/GameEngine.js';
import { UIManager } from './ui/UIManager.js';
import { platform } from './systems/CrazyGamesSDK.js';
import { audio } from './audio/AudioSynthesizer.js';

window.addEventListener('DOMContentLoaded', async () => {
  const canvas = document.getElementById('game-canvas');
  if (!canvas) {
    console.error('Canvas element #game-canvas not found!');
    return;
  }

  // 1. Initialize Game Engine & UI immediately
  const engine = new GameEngine(canvas);
  const ui = new UIManager(engine);
  engine.setUI(ui);

  // 2. Start 60 FPS Game Loop
  engine.startLoop();

  // 3. Initialize CrazyGames SDK v3 asynchronously
  platform.init().catch(e => console.warn('Platform init issue', e));

  // 4. Global user gesture listener to unlock Web Audio on iOS Safari and mobile browsers
  const unlockAudio = () => {
    audio.ensureContext();
    window.removeEventListener('pointerdown', unlockAudio);
    window.removeEventListener('keydown', unlockAudio);
    window.removeEventListener('touchstart', unlockAudio);
    window.removeEventListener('touchend', unlockAudio);
  };
  window.addEventListener('pointerdown', unlockAudio, { passive: true });
  window.addEventListener('keydown', unlockAudio, { passive: true });
  window.addEventListener('touchstart', unlockAudio, { passive: true });
  window.addEventListener('touchend', unlockAudio, { passive: true });

  console.log('[LOOP//BREAK] System initialized. Ready to break the loop.');
});
