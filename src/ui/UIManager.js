// LOOP//BREAK - UI & Screen State Orchestrator with Fullscreen & Tutorial Directives

import { CONFIG } from '../config.js';
import { saveSystem } from '../systems/SaveSystem.js';
import { audio } from '../audio/AudioSynthesizer.js';
import { platform } from '../systems/CrazyGamesSDK.js';

export class UIManager {
  constructor(gameEngine) {
    this.game = gameEngine;
    this.directiveTimeout = null;

    this.dom = {
      // Screens
      startScreen: document.getElementById('start-screen'),
      hud: document.getElementById('hud'),
      pauseModal: document.getElementById('pause-modal'),
      levelClearModal: document.getElementById('level-clear-modal'),
      gameOverModal: document.getElementById('game-over-modal'),
      upgradesModal: document.getElementById('upgrades-modal'),
      tutorialModal: document.getElementById('tutorial-modal'),
      rotatePrompt: document.getElementById('rotate-prompt'),

      // HUD Elements
      hudFloor: document.getElementById('hud-floor'),
      hudShards: document.getElementById('hud-shards'),
      hudScore: document.getElementById('hud-score'),
      hudCombo: document.getElementById('hud-combo'),
      hudShields: document.getElementById('hud-shields'),
      hudPauseBtn: document.getElementById('hud-pause-btn'),
      hudDirective: document.getElementById('hud-directive'),
      directiveTitle: document.getElementById('directive-title'),
      directiveText: document.getElementById('directive-text'),

      // Start Screen Elements
      btnStart: document.getElementById('btn-start-game'),
      btnOpenUpgrades: document.getElementById('btn-open-upgrades'),
      btnOpenTutorial: document.getElementById('btn-open-tutorial'),
      startHighScore: document.getElementById('start-high-score'),
      startHighFloor: document.getElementById('start-high-floor'),
      startFlux: document.getElementById('start-flux-count'),
      desktopControlsHint: document.getElementById('desktop-controls-hint'),
      mobileControlsHint: document.getElementById('mobile-controls-hint'),

      // Tutorial Modal Elements
      btnStartFromTutorial: document.getElementById('btn-start-from-tutorial'),
      btnCloseTutorial: document.getElementById('btn-close-tutorial'),

      // Pause Screen Elements
      btnResume: document.getElementById('btn-resume'),
      btnRestartPause: document.getElementById('btn-restart-pause'),
      btnQuitToMenu: document.getElementById('btn-quit-to-menu'),
      toggleSfx: document.getElementById('toggle-sfx'),
      toggleBgm: document.getElementById('toggle-bgm'),

      // Level Clear Elements
      clearFloorNum: document.getElementById('clear-floor-num'),
      clearFloorScore: document.getElementById('clear-floor-score'),
      btnNextLevel: document.getElementById('btn-next-level'),

      // Game Over Elements
      overScore: document.getElementById('over-score'),
      overBestScore: document.getElementById('over-best-score'),
      overFloor: document.getElementById('over-floor'),
      overFluxEarned: document.getElementById('over-flux-earned'),
      btnRestartOver: document.getElementById('btn-restart-over'),
      btnShopOver: document.getElementById('btn-shop-over'),
      btnMenuOver: document.getElementById('btn-menu-over'),

      // Upgrades Modal Elements
      upgradesFluxCount: document.getElementById('upgrades-flux-count'),
      upgradesList: document.getElementById('upgrades-list'),
      skinsList: document.getElementById('skins-list'),
      btnCloseUpgrades: document.getElementById('btn-close-upgrades'),
      tabOverclocks: document.getElementById('tab-overclocks'),
      tabSkins: document.getElementById('tab-skins'),
      contentOverclocks: document.getElementById('content-overclocks'),
      contentSkins: document.getElementById('content-skins'),
    };

    this.bindEvents();
    this.updateStartStats();
  }

  bindEvents() {
    // Start game & enter fullscreen
    this.dom.btnStart.addEventListener('click', () => {
      audio.playClick();
      audio.startBGM();
      this.requestFullscreenAuto();
      this.game.startRun();
    });

    // Start from tutorial modal
    this.dom.btnStartFromTutorial.addEventListener('click', () => {
      audio.playClick();
      audio.startBGM();
      this.hideTutorialModal();
      this.requestFullscreenAuto();
      this.game.startRun();
    });

    // Tutorial open/close
    this.dom.btnOpenTutorial.addEventListener('click', () => {
      audio.playClick();
      this.showTutorialModal();
    });

    this.dom.btnCloseTutorial.addEventListener('click', () => {
      audio.playClick();
      this.hideTutorialModal();
    });

    // Global Auto-Fullscreen Trigger on First/Any User Interaction
    const autoFullscreenHandler = () => {
      this.requestFullscreenAuto();
    };
    window.addEventListener('pointerdown', autoFullscreenHandler, { passive: true });
    window.addEventListener('touchstart', autoFullscreenHandler, { passive: true });

    // Pause HUD button
    this.dom.hudPauseBtn.addEventListener('click', () => {
      audio.playClick();
      this.game.pauseGame();
    });

    // Resume
    this.dom.btnResume.addEventListener('click', () => {
      audio.playClick();
      this.requestFullscreenAuto();
      this.game.resumeGame();
    });

    // Restart from Pause
    this.dom.btnRestartPause.addEventListener('click', () => {
      audio.playClick();
      this.requestFullscreenAuto();
      this.game.startRun();
    });

    // Quit to Menu from Pause
    this.dom.btnQuitToMenu.addEventListener('click', () => {
      audio.playClick();
      this.showStartScreen();
    });

    // Audio toggles in pause menu
    this.dom.toggleSfx.addEventListener('change', (e) => {
      audio.setSfxEnabled(e.target.checked);
      saveSystem.updateSettings({ sfx: e.target.checked });
      audio.playClick();
    });

    this.dom.toggleBgm.addEventListener('change', (e) => {
      audio.setBgmEnabled(e.target.checked);
      saveSystem.updateSettings({ bgm: e.target.checked });
      audio.playClick();
    });

    // Next Level Continue
    this.dom.btnNextLevel.addEventListener('click', () => {
      audio.playClick();
      this.requestFullscreenAuto();
      this.game.proceedToNextLevel();
    });

    // Game Over Restart
    this.dom.btnRestartOver.addEventListener('click', () => {
      audio.playClick();
      this.requestFullscreenAuto();
      this.game.startRun();
    });

    // Game Over to Shop
    this.dom.btnShopOver.addEventListener('click', () => {
      audio.playClick();
      this.showUpgradesModal();
    });

    // Game Over to Menu
    this.dom.btnMenuOver.addEventListener('click', () => {
      audio.playClick();
      this.showStartScreen();
    });

    // Open Upgrades Shop from Start
    this.dom.btnOpenUpgrades.addEventListener('click', () => {
      audio.playClick();
      this.showUpgradesModal();
    });

    // Close Upgrades
    this.dom.btnCloseUpgrades.addEventListener('click', () => {
      audio.playClick();
      this.dom.upgradesModal.classList.add('hidden');
      this.updateStartStats();
    });

    // Upgrades tab switching
    this.dom.tabOverclocks.addEventListener('click', () => {
      audio.playClick();
      this.dom.tabOverclocks.classList.add('active');
      this.dom.tabSkins.classList.remove('active');
      this.dom.contentOverclocks.classList.remove('hidden');
      this.dom.contentSkins.classList.add('hidden');
    });

    this.dom.tabSkins.addEventListener('click', () => {
      audio.playClick();
      this.dom.tabSkins.classList.add('active');
      this.dom.tabOverclocks.classList.remove('active');
      this.dom.contentSkins.classList.remove('hidden');
      this.dom.contentOverclocks.classList.add('hidden');
    });

    // Click directive banner to dismiss early
    this.dom.hudDirective.addEventListener('click', () => {
      this.dom.hudDirective.classList.add('hidden');
    });

    // Orientation change listener
    window.addEventListener('resize', () => this.checkOrientation());
    window.addEventListener('orientationchange', () => this.checkOrientation());
    this.checkOrientation();

    // Check touch support to toggle control instructions on start screen
    const isTouch = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
    if (isTouch) {
      this.dom.desktopControlsHint.classList.add('hidden');
      this.dom.mobileControlsHint.classList.remove('hidden');
    } else {
      this.dom.desktopControlsHint.classList.remove('hidden');
      this.dom.mobileControlsHint.classList.add('hidden');
    }

    // Keyboard navigation shortcuts
    window.addEventListener('keydown', (e) => {
      if (e.code === 'Space' || e.code === 'Enter') {
        if (this.game.state === 'START') {
          audio.playClick();
          audio.startBGM();
          this.requestFullscreenAuto();
          this.game.startRun();
        } else if (this.game.state === 'GAMEOVER') {
          audio.playClick();
          this.game.startRun();
        } else if (this.game.state === 'LEVEL_CLEAR') {
          audio.playClick();
          this.game.proceedToNextLevel();
        }
      }
      if (e.key === 'Escape') {
        if (!this.dom.tutorialModal.classList.contains('hidden')) {
          this.hideTutorialModal();
        } else if (!this.dom.upgradesModal.classList.contains('hidden')) {
          this.dom.upgradesModal.classList.add('hidden');
          this.updateStartStats();
        }
      }
    });
  }

  // --- AUTOMATIC FULLSCREEN SYSTEM ---
  requestFullscreenAuto() {
    const isFs = !!(
      document.fullscreenElement ||
      document.webkitFullscreenElement ||
      document.mozFullScreenElement ||
      document.msFullscreenElement
    );

    if (!isFs) {
      const el = document.documentElement;
      try {
        if (el.requestFullscreen) {
          el.requestFullscreen().catch(() => {});
        } else if (el.webkitRequestFullscreen) {
          el.webkitRequestFullscreen();
        } else if (el.msRequestFullscreen) {
          el.msRequestFullscreen();
        }
      } catch (err) {}

      try {
        if (screen.orientation && screen.orientation.lock) {
          screen.orientation.lock('landscape').catch(() => {});
        }
      } catch (err) {}
    }
  }

  checkOrientation() {
    const isTouch = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
    const isPortrait = isTouch && (window.innerHeight > window.innerWidth);
    if (isPortrait) {
      this.dom.rotatePrompt.classList.remove('hidden');
      if (this.game.state === 'PLAYING') {
        this.game.pauseGame();
      }
    } else {
      this.dom.rotatePrompt.classList.add('hidden');
    }
  }

  showStartScreen() {
    this.dom.startScreen.classList.remove('hidden');
    this.dom.hud.classList.add('hidden');
    this.dom.pauseModal.classList.add('hidden');
    this.dom.levelClearModal.classList.add('hidden');
    this.dom.gameOverModal.classList.add('hidden');
    this.dom.upgradesModal.classList.add('hidden');
    this.dom.tutorialModal.classList.add('hidden');
    this.dom.hudDirective.classList.add('hidden');
    this.updateStartStats();
  }

  showHUD() {
    this.dom.startScreen.classList.add('hidden');
    this.dom.hud.classList.remove('hidden');
    this.dom.pauseModal.classList.add('hidden');
    this.dom.levelClearModal.classList.add('hidden');
    this.dom.gameOverModal.classList.add('hidden');
    this.dom.upgradesModal.classList.add('hidden');
    this.dom.tutorialModal.classList.add('hidden');
  }

  showTutorialModal() {
    this.dom.tutorialModal.classList.remove('hidden');
  }

  hideTutorialModal() {
    this.dom.tutorialModal.classList.add('hidden');
  }

  // --- INTERACTIVE IN-GAME FLOOR DIRECTIVES ---
  showFloorDirective(floor) {
    if (this.directiveTimeout) {
      clearTimeout(this.directiveTimeout);
      this.directiveTimeout = null;
    }

    let title = '';
    let text = '';

    if (floor === 1) {
      title = 'DIRECTIVE: SHARD COLLECTION';
      text = 'Collect all golden Energy Shards to unlock the emerald Exit Portal! Avoid the Hunter.';
    } else if (floor === 2) {
      title = 'ABILITY UNLOCKED: [DASH]';
      text = 'Tap DASH (or press SPACE) for a supersonic burst with temporary INVULNERABILITY!';
    } else if (floor === 3) {
      title = 'THE SIGNATURE ECHO SYSTEM ACTIVATED';
      text = 'Your violet Ghost repeats your past path! Avoid it, or BAIT enemies into chasing it!';
    } else if (floor === 4) {
      title = 'ABILITY UNLOCKED: [KINETIC PULSE]';
      text = 'Tap PULSE (or press E) to unleash an EMP shockwave that stuns & pushes back enemies!';
    } else {
      title = `FLOOR ${floor} IN PROGRESS`;
      text = 'Dodge enemies, exploit your Echo decoy, collect all shards, and escape!';
    }

    this.dom.directiveTitle.innerText = title;
    this.dom.directiveText.innerText = text;
    this.dom.hudDirective.classList.remove('hidden');

    // Auto-hide after 5.5 seconds
    this.directiveTimeout = setTimeout(() => {
      this.dom.hudDirective.classList.add('hidden');
      this.directiveTimeout = null;
    }, 5500);
  }

  showPauseModal() {
    this.dom.pauseModal.classList.remove('hidden');
    this.dom.toggleSfx.checked = saveSystem.data.settings.sfx;
    this.dom.toggleBgm.checked = saveSystem.data.settings.bgm;
  }

  hidePauseModal() {
    this.dom.pauseModal.classList.add('hidden');
  }

  showLevelClearModal(floor, scoreGained) {
    this.dom.hudDirective.classList.add('hidden');
    this.dom.clearFloorNum.innerText = `FLOOR ${floor} DECRYPTED`;
    this.dom.clearFloorScore.innerText = `+${scoreGained} PTS`;
    this.dom.levelClearModal.classList.remove('hidden');
  }

  hideLevelClearModal() {
    this.dom.levelClearModal.classList.add('hidden');
  }

  showGameOverModal({ score, floor, fluxEarned }) {
    this.dom.hudDirective.classList.add('hidden');
    this.dom.overScore.innerText = score.toLocaleString();
    this.dom.overBestScore.innerText = saveSystem.data.highScore.toLocaleString();
    this.dom.overFloor.innerText = floor;
    this.dom.overFluxEarned.innerText = `+${fluxEarned}`;
    this.dom.gameOverModal.classList.remove('hidden');
  }

  hideGameOverModal() {
    this.dom.gameOverModal.classList.add('hidden');
  }

  updateHUD({ floor, shardsCollected, shardsRequired, score, combo, shields }) {
    this.dom.hudFloor.innerText = `FLOOR ${floor}`;
    this.dom.hudShards.innerText = `${shardsCollected} / ${shardsRequired}`;
    this.dom.hudScore.innerText = score.toLocaleString();
    this.dom.hudCombo.innerText = combo > 1.0 ? `x${combo.toFixed(1)}` : '';

    // Render Energy Shields
    let shieldsHtml = '';
    for (let i = 0; i < 3; i++) {
      shieldsHtml += `<span class="shield-pip ${i < shields ? 'active' : ''}"></span>`;
    }
    this.dom.hudShields.innerHTML = shieldsHtml;
  }

  updateStartStats() {
    this.dom.startHighScore.innerText = saveSystem.data.highScore.toLocaleString();
    this.dom.startHighFloor.innerText = saveSystem.data.highestLevel;
    this.dom.startFlux.innerText = saveSystem.data.fluxCurrency;
  }

  showUpgradesModal() {
    this.dom.upgradesFluxCount.innerText = saveSystem.data.fluxCurrency;
    this.renderUpgradesList();
    this.renderSkinsList();
    this.dom.upgradesModal.classList.remove('hidden');
  }

  renderUpgradesList() {
    this.dom.upgradesList.innerHTML = '';
    for (const upg of CONFIG.UPGRADES) {
      const currentLevel = saveSystem.getUpgradeLevel(upg.id);
      const isMax = currentLevel >= upg.maxLevel;
      const cost = isMax ? 0 : Math.round(upg.baseCost * Math.pow(upg.costMult, currentLevel));
      const canAfford = saveSystem.data.fluxCurrency >= cost;

      const item = document.createElement('div');
      item.className = 'upgrade-card';
      item.innerHTML = `
        <div class="upgrade-info">
          <h4>${upg.name} <span class="badge">Tier ${currentLevel}/${upg.maxLevel}</span></h4>
          <p>${upg.description}</p>
        </div>
        <div class="upgrade-action">
          <button class="btn btn-buy ${isMax ? 'disabled' : (canAfford ? 'active' : 'unaffordable')}" data-id="${upg.id}" ${isMax || !canAfford ? 'disabled' : ''}>
            ${isMax ? 'MAX' : `UPGRADE (${cost} ⚡)`}
          </button>
        </div>
      `;

      const btn = item.querySelector('.btn-buy');
      if (!isMax && canAfford) {
        btn.addEventListener('click', () => {
          audio.playClick();
          if (saveSystem.purchaseUpgrade(upg.id, cost)) {
            this.showUpgradesModal();
            this.game.player.applyUpgrades(saveSystem.data.upgrades);
          }
        });
      }

      this.dom.upgradesList.appendChild(item);
    }
  }

  renderSkinsList() {
    this.dom.skinsList.innerHTML = '';
    const selectedSkin = saveSystem.data.selectedSkin;
    const unlockedSkins = saveSystem.data.unlockedSkins;

    for (const skin of CONFIG.SKINS) {
      const isUnlocked = unlockedSkins.includes(skin.id);
      const isSelected = selectedSkin === skin.id;
      const canAfford = saveSystem.data.fluxCurrency >= skin.cost;

      const card = document.createElement('div');
      card.className = `skin-card ${isSelected ? 'selected' : ''}`;
      card.innerHTML = `
        <div class="skin-preview" style="background: radial-gradient(circle, ${skin.glow} 0%, rgba(10,15,30,0.8) 70%); border-color: ${skin.color}">
          <div class="skin-circle" style="background: ${skin.color}; box-shadow: 0 0 12px ${skin.color}"></div>
        </div>
        <div class="skin-info">
          <h4>${skin.name}</h4>
          <p>${isUnlocked ? (isSelected ? 'EQUIPPED' : 'UNLOCKED') : `${skin.cost} ⚡`}</p>
        </div>
        <div class="skin-action">
          ${isSelected ? '<span class="status-badge active">IN USE</span>' : (
            isUnlocked
              ? `<button class="btn btn-equip" data-id="${skin.id}">EQUIP</button>`
              : `<button class="btn btn-buy ${canAfford ? 'active' : 'unaffordable'}" data-id="${skin.id}" ${!canAfford ? 'disabled' : ''}>UNLOCK</button>`
          )}
        </div>
      `;

      const equipBtn = card.querySelector('.btn-equip');
      if (equipBtn) {
        equipBtn.addEventListener('click', () => {
          audio.playClick();
          saveSystem.selectSkin(skin.id);
          this.game.player.setSkin(skin);
          this.renderSkinsList();
        });
      }

      const buyBtn = card.querySelector('.btn-buy');
      if (buyBtn && canAfford) {
        buyBtn.addEventListener('click', () => {
          audio.playClick();
          if (saveSystem.unlockSkin(skin.id, skin.cost)) {
            saveSystem.selectSkin(skin.id);
            this.game.player.setSkin(skin);
            this.showUpgradesModal();
          }
        });
      }

      this.dom.skinsList.appendChild(card);
    }
  }
}
