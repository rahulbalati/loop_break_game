// LOOP//BREAK - Core Game Engine, Fixed-Timestep Loop & State Machine

import { CONFIG } from '../config.js';
import { Player } from '../entities/Player.js';
import { EchoManager } from '../entities/EchoManager.js';
import { ArenaGenerator } from '../systems/ArenaGenerator.js';
import { CollisionSystem } from '../systems/CollisionSystem.js';
import { ParticleSystem, ScreenShake } from '../systems/ParticleSystem.js';
import { InputManager } from '../input/InputManager.js';
import { saveSystem } from '../systems/SaveSystem.js';
import { audio } from '../audio/AudioSynthesizer.js';
import { platform } from '../systems/CrazyGamesSDK.js';

export class GameEngine {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');

    this.virtualWidth = CONFIG.VIRTUAL_WIDTH;
    this.virtualHeight = CONFIG.VIRTUAL_HEIGHT;

    // Subsystems
    this.particleSystem = new ParticleSystem();
    this.screenShake = new ScreenShake();
    this.input = new InputManager(canvas);
    this.arenaGen = new ArenaGenerator(this.virtualWidth, this.virtualHeight);
    this.collision = new CollisionSystem();
    this.echo = new EchoManager();

    // Player with saved skin
    const initialSkin = CONFIG.SKINS.find(s => s.id === saveSystem.data.selectedSkin) || CONFIG.SKINS[0];
    this.player = new Player(this.virtualWidth / 2, this.virtualHeight / 2, initialSkin);
    this.player.applyUpgrades(saveSystem.data.upgrades);

    // State
    this.state = 'START'; // 'START', 'PLAYING', 'PAUSED', 'LEVEL_CLEAR', 'GAMEOVER'
    this.currentLevel = 1;
    this.score = 0;
    this.shardsCollectedThisLevel = 0;
    this.shardsTotalThisRun = 0;
    this.runStartTime = 0;

    // Level entities
    this.portal = null;
    this.shards = [];
    this.enemies = [];
    this.obstacles = [];
    this.requiredShards = 3;

    // Loop timing
    this.lastTime = 0;
    this.accumulator = 0;
    this.fixedDt = 1 / 60; // 60 FPS physics step

    // UI reference
    this.ui = null;

    this.handleResize();
    window.addEventListener('resize', () => this.handleResize());
    window.addEventListener('orientationchange', () => {
      setTimeout(() => this.handleResize(), 120);
    });
    document.addEventListener('fullscreenchange', () => {
      setTimeout(() => this.handleResize(), 120);
    });
    document.addEventListener('webkitfullscreenchange', () => {
      setTimeout(() => this.handleResize(), 120);
    });

    // Mobile Background / Tab Switch Lifecycle Management
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        // Tab went to background: pause game to prevent background death/desync
        if (this.state === 'PLAYING') {
          this.pauseGame();
        }
      } else {
        // Tab restored: force immediate layout re-sync and audio wakeup
        this.handleResize();
        if (this.ui) this.ui.checkOrientation();
        audio.ensureContext();
      }
    });

    window.addEventListener('focus', () => {
      this.handleResize();
      audio.ensureContext();
    });
  }

  setUI(uiManager) {
    this.ui = uiManager;
  }

  handleResize() {
    const windowWidth = window.innerWidth || document.documentElement.clientWidth || 1280;
    const windowHeight = window.innerHeight || document.documentElement.clientHeight || 720;

    // Calculate real viewport aspect ratio (e.g. 1.777 on 16:9, 2.16 on iPhone, 2.22 on Galaxy)
    const aspect = Math.max(1.1, windowWidth / windowHeight);

    const oldWidth = this.virtualWidth || 1280;

    // Dynamic Virtual Resolution: Fixed 720 base height, width adapts to match aspect ratio perfectly
    this.virtualHeight = CONFIG.BASE_HEIGHT;
    this.virtualWidth = Math.round(CONFIG.BASE_HEIGHT * aspect);

    // Fullscreen canvas
    this.canvas.style.width = '100%';
    this.canvas.style.height = '100%';

    // Native buffer resolution matches virtual dimensions
    this.canvas.width = this.virtualWidth;
    this.canvas.height = this.virtualHeight;

    // Update arena generator
    if (this.arenaGen) {
      this.arenaGen.width = this.virtualWidth;
      this.arenaGen.height = this.virtualHeight;
    }

    // Proportional Entity Relayout & Wall Clamping (Ensures NO entity is ever clipped or lost off-screen)
    if (this.state === 'PLAYING' || this.state === 'PAUSED' || this.state === 'LEVEL_CLEAR') {
      const scaleRatio = oldWidth > 0 ? this.virtualWidth / oldWidth : 1;

      // 1. Player
      if (this.player) {
        if (scaleRatio !== 1) this.player.x *= scaleRatio;
        const pad = this.player.radius + 14;
        this.player.x = Math.max(pad, Math.min(this.virtualWidth - pad, this.player.x));
        this.player.y = Math.max(pad, Math.min(this.virtualHeight - pad, this.player.y));
      }

      // 2. Portal
      if (this.portal) {
        if (scaleRatio !== 1) this.portal.x *= scaleRatio;
        const pad = 90;
        this.portal.x = Math.max(pad, Math.min(this.virtualWidth - pad, this.portal.x));
        this.portal.y = Math.max(pad, Math.min(this.virtualHeight - pad, this.portal.y));
      }

      // 3. Shards
      if (this.shards && this.shards.length > 0) {
        for (const shard of this.shards) {
          if (scaleRatio !== 1) shard.x *= scaleRatio;
          const pad = shard.radius + 24;
          shard.x = Math.max(pad, Math.min(this.virtualWidth - pad, shard.x));
          shard.y = Math.max(pad, Math.min(this.virtualHeight - pad, shard.y));
        }
      }

      // 4. Obstacles
      if (this.obstacles && this.obstacles.length > 0) {
        for (const obs of this.obstacles) {
          if (scaleRatio !== 1) obs.x *= scaleRatio;
          const pad = obs.radius + 24;
          obs.x = Math.max(pad, Math.min(this.virtualWidth - pad, obs.x));
          obs.y = Math.max(pad, Math.min(this.virtualHeight - pad, obs.y));
        }
      }

      // 5. Enemies
      if (this.enemies && this.enemies.length > 0) {
        for (const enemy of this.enemies) {
          if (scaleRatio !== 1) enemy.x *= scaleRatio;
          const pad = enemy.radius + 16;
          enemy.x = Math.max(pad, Math.min(this.virtualWidth - pad, enemy.x));
          enemy.y = Math.max(pad, Math.min(this.virtualHeight - pad, enemy.y));
        }
      }
    }

    // Refresh touch joystick bounds immediately
    if (this.input) {
      this.input.update(this.virtualWidth, this.virtualHeight);
    }
  }

  startRun(forcedFloor = null) {
    this.state = 'PLAYING';

    // Sector Checkpoint System: Determine starting floor & baseline score
    const activeSectorId = saveSystem.data.selectedSector || 'sector_1';
    const sectorConfig = CONFIG.SECTORS.find(s => s.id === activeSectorId) || CONFIG.SECTORS[0];

    if (forcedFloor !== null) {
      this.currentLevel = forcedFloor;
      this.score = 0;
    } else {
      this.currentLevel = sectorConfig.startFloor;
      this.score = sectorConfig.baselineScore;
    }

    this.shardsTotalThisRun = 0;
    this.runStartTime = performance.now();

    this.player.applyUpgrades(saveSystem.data.upgrades);
    this.collision.resetCombo();
    this.particleSystem.reset();

    this.loadLevel(this.currentLevel);
    this.input.setGameplayActive(true);

    if (this.ui) {
      this.ui.showHUD();
      this.updateHUD();
      this.ui.showFloorDirective(this.currentLevel);
    }

    platform.gameplayStart();
  }

  loadLevel(level) {
    this.currentLevel = level;
    this.shardsCollectedThisLevel = 0;

    const levelData = this.arenaGen.generateLevel(level);
    this.player.reset(levelData.playerSpawn.x, levelData.playerSpawn.y);
    this.portal = levelData.portal;
    this.shards = levelData.shards;
    this.enemies = levelData.enemies;
    this.obstacles = levelData.obstacles;
    this.requiredShards = levelData.requiredShards;

    // Setup Pulse unlock (unlocked at Level 4)
    this.player.pulseUnlocked = level >= 4;

    // Setup Echo (unlocked at Level 3)
    this.echo.setLevel(level, saveSystem.data.upgrades);

    if (this.ui) {
      this.ui.showFloorDirective(level);
    }
  }

  proceedToNextLevel() {
    if (this.ui) this.ui.hideLevelClearModal();
    this.state = 'PLAYING';
    this.input.setGameplayActive(true);
    this.currentLevel++;
    this.loadLevel(this.currentLevel);
    this.updateHUD();
    platform.gameplayStart();
  }

  pauseGame() {
    if (this.state !== 'PLAYING') return;
    this.state = 'PAUSED';
    this.input.setGameplayActive(false);
    if (this.ui) this.ui.showPauseModal();
    platform.gameplayStop();
  }

  resumeGame() {
    if (this.state !== 'PAUSED') return;
    this.state = 'PLAYING';
    this.input.setGameplayActive(true);
    if (this.ui) this.ui.hidePauseModal();
    platform.gameplayStart();
  }

  onPlayerDied() {
    this.state = 'GAMEOVER';
    this.input.setGameplayActive(false);
    audio.playGameOver();

    const timeSurvived = (performance.now() - this.runStartTime) / 1000;
    const fluxEarned = this.shardsTotalThisRun + (this.currentLevel - 1) * 3;

    saveSystem.recordRunResult({
      score: this.score,
      level: this.currentLevel,
      shardsCollected: this.shardsTotalThisRun,
      combo: this.collision.comboMultiplier,
      timeSurvived,
      escaped: false,
    });

    if (this.ui) {
      this.ui.showGameOverModal({
        score: this.score,
        floor: this.currentLevel,
        fluxEarned,
      });
    }

    platform.gameplayStop();
  }

  onLevelCompleted() {
    this.state = 'LEVEL_CLEAR';
    this.input.setGameplayActive(false);
    audio.playLevelClear();
    this.particleSystem.spawnPortalBurst(this.portal.x, this.portal.y);
    platform.happytime();
    platform.gameplayStop();

    const levelBonus = this.currentLevel * 250;
    this.score += levelBonus;

    // Check & unlock Sector Checkpoint Milestones
    const nextFloor = this.currentLevel + 1;
    saveSystem.unlockSectorsForLevel(nextFloor);

    if (this.ui) {
      this.ui.showLevelClearModal(this.currentLevel, levelBonus);
    }
  }

  updateHUD() {
    if (!this.ui) return;
    this.ui.updateHUD({
      floor: this.currentLevel,
      shardsCollected: this.shardsCollectedThisLevel,
      shardsRequired: this.requiredShards,
      score: this.score,
      combo: this.collision.comboMultiplier,
      shields: this.player.health,
    });
  }

  // Fixed Physics Update Tick
  updatePhysics(dt) {
    if (this.state !== 'PLAYING') return;

    this.input.update(this.virtualWidth, this.virtualHeight);

    // Ability Input Execution
    if (this.input.consumeDash()) {
      this.player.dash(this.input.moveVector, this.particleSystem);
    }
    if (this.input.consumePulse()) {
      this.player.pulse(this.enemies, this.particleSystem, this.shards);
    }
    if (this.input.consumePause()) {
      this.pauseGame();
      return;
    }

    // Cooldown indicator sync for touch buttons
    this.input.setAbilityCooldowns(
      this.player.dashCooldownTimer / this.player.dashCooldownMax,
      this.player.pulseCooldownTimer / this.player.pulseCooldownMax,
      this.player.pulseUnlocked
    );

    // Update Player
    this.player.update(dt, this.input.moveVector, this.virtualWidth, this.virtualHeight, this.particleSystem);

    // Record and Update Echo
    this.echo.record(this.player, dt);
    this.echo.update(dt, this.player, this.particleSystem, this.screenShake, () => this.onPlayerDied());
    const decoy = this.echo.getDecoyTarget();

    // Update Enemies (with mutual separation to prevent clustering)
    for (const enemy of this.enemies) {
      enemy.separate(this.enemies);
      enemy.update(dt, this.player, decoy, this.virtualWidth, this.virtualHeight);
    }

    // Update Shards (with obstacle repulsion and boundary clamping)
    for (const shard of this.shards) {
      shard.update(dt, this.player, this.virtualWidth, this.virtualHeight, this.obstacles);
    }

    // Update Portal
    if (this.portal) {
      this.portal.update(dt, this.particleSystem);
    }

    // Update Combo Timer
    this.collision.updateCombo(dt);

    // Collision Checks
    this.collision.checkCollisions({
      player: this.player,
      shards: this.shards,
      enemies: this.enemies,
      obstacles: this.obstacles,
      portal: this.portal,
      particleSystem: this.particleSystem,
      screenShake: this.screenShake,
      onShardCollected: (shard, combo) => {
        this.shardsCollectedThisLevel++;
        this.shardsTotalThisRun++;
        const points = Math.round(CONFIG.SHARD.POINTS * combo * (shard.isBonus ? 2 : 1));
        this.score += points;

        // Check if all required shards collected to unlock exit portal
        const allCleared = this.shardsCollectedThisLevel >= this.requiredShards || this.shards.length === 0;
        if (allCleared && !this.portal.isUnlocked) {
          this.portal.setUnlocked(true);
          audio.playPortalUnlock();
          this.particleSystem.spawnPortalBurst(this.portal.x, this.portal.y);
          this.screenShake.shake(6, 0.25);
        }

        this.updateHUD();
      },
      onLevelCompleted: () => this.onLevelCompleted(),
      onPlayerDied: () => this.onPlayerDied(),
    });

    // Fail-Safe: If all shards are collected in the arena, guarantee exit portal is open!
    if (this.shards.length === 0 && this.portal && !this.portal.isUnlocked) {
      this.portal.setUnlocked(true);
      audio.playPortalUnlock();
      this.particleSystem.spawnPortalBurst(this.portal.x, this.portal.y);
      this.screenShake.shake(6, 0.25);
    }

    this.updateHUD();
  }

  // Render Frame
  render() {
    this.ctx.save();

    // Clear Canvas
    this.ctx.fillStyle = CONFIG.PALETTE.BG_DARK;
    this.ctx.fillRect(0, 0, this.virtualWidth, this.virtualHeight);

    // Apply Screen Shake if active
    this.screenShake.apply(this.ctx);

    // 1. Draw Subtle Sci-Fi Grid
    this.ctx.strokeStyle = CONFIG.PALETTE.GRID_LINE;
    this.ctx.lineWidth = 1;
    const gridSize = 40;
    this.ctx.beginPath();
    for (let x = 0; x <= this.virtualWidth; x += gridSize) {
      this.ctx.moveTo(x, 0);
      this.ctx.lineTo(x, this.virtualHeight);
    }
    for (let y = 0; y <= this.virtualHeight; y += gridSize) {
      this.ctx.moveTo(0, y);
      this.ctx.lineTo(this.virtualWidth, y);
    }
    this.ctx.stroke();

    // 2. Draw Outer Neon Arena Borders
    this.ctx.strokeStyle = CONFIG.PALETTE.WALL_BORDER;
    this.ctx.lineWidth = 8;
    this.ctx.strokeRect(4, 4, this.virtualWidth - 8, this.virtualHeight - 8);

    this.ctx.strokeStyle = '#00f0ff';
    this.ctx.shadowColor = '#00f0ff';
    this.ctx.shadowBlur = 12;
    this.ctx.lineWidth = 2;
    this.ctx.strokeRect(4, 4, this.virtualWidth - 8, this.virtualHeight - 8);
    this.ctx.shadowBlur = 0;

    // 3. Draw Tactical Energy Pillars / Obstacles
    for (const obs of this.obstacles) {
      this.ctx.save();
      this.ctx.beginPath();
      this.ctx.arc(obs.x, obs.y, obs.radius, 0, Math.PI * 2);
      this.ctx.fillStyle = obs.color;
      this.ctx.strokeStyle = obs.borderColor;
      this.ctx.lineWidth = 2.5;
      this.ctx.shadowColor = obs.borderColor;
      this.ctx.shadowBlur = 10;
      this.ctx.fill();
      this.ctx.stroke();
      this.ctx.restore();
    }

    if (this.state === 'PLAYING' || this.state === 'PAUSED' || this.state === 'LEVEL_CLEAR') {
      // 4. Render Exit Portal
      if (this.portal) {
        this.portal.render(this.ctx, this.player, this.shards);
      }

      // 5. Render Shards
      for (const shard of this.shards) {
        shard.render(this.ctx);
      }

      // 6. Render Echo Ghost & Trails
      this.echo.render(this.ctx);

      // 7. Render Enemies
      for (const enemy of this.enemies) {
        enemy.render(this.ctx);
      }

      // 8. Render Player
      this.player.render(this.ctx);
    }

    // 9. Render Particles & Shockwaves
    this.particleSystem.render(this.ctx);

    // 10. Render Touch Joystick & Buttons on top
    if (this.state === 'PLAYING') {
      this.input.render(this.ctx);
    }

    this.ctx.restore();
  }

  startLoop() {
    this.lastTime = performance.now();
    const loop = (currentTime) => {
      const dt = Math.min((currentTime - this.lastTime) / 1000, 0.1);
      this.lastTime = currentTime;

      this.accumulator += dt;
      while (this.accumulator >= this.fixedDt) {
        this.updatePhysics(this.fixedDt);
        this.accumulator -= this.fixedDt;
      }

      this.particleSystem.update(dt);
      this.screenShake.update(dt);

      this.render();
      requestAnimationFrame(loop);
    };

    requestAnimationFrame(loop);
  }
}
