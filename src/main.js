// LOOP//BREAK - Entry point
import '@fontsource/chakra-petch/latin-500.css';
import '@fontsource/chakra-petch/latin-700.css';
import '@fontsource/ibm-plex-mono/latin-500.css';
import '@fontsource/ibm-plex-mono/latin-700.css';
import './style.css';

import { Game } from './core/Game.js';
import { platform } from './systems/CrazyGamesSDK.js';
import { saveSystem } from './systems/SaveSystem.js';
import { audio } from './audio/AudioSynthesizer.js';

async function boot() {
  try {
    await platform.init();
  } catch (e) {
    console.warn('Platform init issue', e);
  }
  platform.loadingStart();

  // Save must load after the SDK so the cloud data module is available
  saveSystem.init();

  const canvas = document.getElementById('game-canvas');
  const game = new Game(canvas);
  game.start();

  platform.loadingStop();

  // Unlock Web Audio on the first user gesture (required on iOS / mobile browsers)
  const unlock = () => {
    audio.ensureContext();
    window.removeEventListener('pointerdown', unlock);
    window.removeEventListener('keydown', unlock);
    window.removeEventListener('touchend', unlock);
  };
  window.addEventListener('pointerdown', unlock, { passive: true });
  window.addEventListener('keydown', unlock, { passive: true });
  window.addEventListener('touchend', unlock, { passive: true });

  // Debug hook for local playtesting only
  if (!platform.hasSDK && /[?&]debug\b/.test(location.search)) window.__game = game;
}

if (document.readyState === 'loading') window.addEventListener('DOMContentLoaded', boot);
else boot();
