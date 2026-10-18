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

    // High-DPI Retina resolution
    this.dpr = typeof window !== 'undefined' ? Math.min(window.devicePixelRatio || 1, 2) : 1;

    // Ambient Menu Particles (for vibrant start screen backdrop)
    this.ambientParticles = [];
    this.scanlineY = 0;
    this.hasDashedOnFloor2 = false;

    // UI reference
    this.ui = null;

    this.handleResize();
    this.initAmbientParticles();
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

  initAmbientParticles() {
    this.ambientParticles = [];
    const colors = ['#00f0ff', '#00ffaa', '#ffd200', '#ff00aa', '#88a0d0'];
    const w = this.virtualWidth || 1280;
    const h = this.virtualHeight || 720;
    for (let i = 0; i < 30; i++) {
      this.ambientParticles.push({
        x: Math.random() * w,
        y: Math.random() * h,
        vx: (Math.random() - 0.5) * 30,
        vy: (Math.random() - 0.5) * 30,
        radius: 2 + Math.random() * 3,
        color: colors[i % colors.length],
        alpha: 0.2 + Math.random() * 0.4,
        pulseSpeed: 1 + Math.random() * 2,
      });
    }
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

    // Native High-DPI buffer scaling (capped at 2x for optimal 60fps performance)
    this.dpr = typeof window !== 'undefined' ? Math.min(window.devicePixelRatio || 1, 2) : 1;

    // Fullscreen canvas
    this.canvas.style.width = '100%';
    this.canvas.style.height = '100%';

    // Native buffer resolution matches virtual dimensions * DPR
    this.canvas.width = Math.round(this.virtualWidth * this.dpr);
    this.canvas.height = Math.round(this.virtualHeight * this.dpr);

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

    // Refresh touch joystick layout (button positions, scale factors) on resize
    if (this.input) {
      this.input.updateLayout(this.virtualWidth, this.virtualHeight);
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

  onPlayerDied(source = null) {
    this.state = 'GAMEOVER';
    this.input.setGameplayActive(false);
    audio.playGameOver();

    const timeSurvived = (performance.now() - this.runStartTime) / 1000;
    const fluxEarned = this.shardsTotalThisRun + (this.currentLevel - 1) * 3;
    const causeOfDeath = source || (this.player && this.player.lastDamageSource) || 'Enemy Drone';

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
        causeOfDeath,
      });
    }

    platform.gameplayStop();
  }

  onLevelCompleted() {
    this.state = 'LEVEL_CLEAR';
    this.input.setGameplayActive(false);
    audio.playLevelClear();
    this.particleSystem.spawnPortalBurst(this.portal.x, this.portal.y);
    this.particleSystem.spawnCelebrationConfetti(this.virtualWidth, this.virtualHeight);
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

    this.input.update();

    // Ability Input Execution
    if (this.input.consumeDash()) {
      if (this.player.dash(this.input.moveVector, this.particleSystem)) {
        this.hasDashedOnFloor2 = true;
      }
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
    this.echo.update(dt, this.player, this.particleSystem, this.screenShake, () => this.onPlayerDied('ECHO TEMPORAL REPERCUSSION'));
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
      onPlayerDied: (source) => this.onPlayerDied(source),
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

  // Render Menu Ambient Cyber Atmosphere
  renderMenuAtmosphere(ctx) {
    const time = performance.now() * 0.001;
    // 1. Subtle cyber scanline sweep
    this.scanlineY = (this.scanlineY + 1.2) % this.virtualHeight;
    ctx.save();
    ctx.strokeStyle = 'rgba(0, 240, 255, 0.14)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(0, this.scanlineY);
    ctx.lineTo(this.virtualWidth, this.scanlineY);
    ctx.stroke();

    // 2. Ambient drifting cyber nodes
    for (const p of this.ambientParticles) {
      p.x = (p.x + p.vx * 0.016 + this.virtualWidth) % this.virtualWidth;
      p.y = (p.y + p.vy * 0.016 + this.virtualHeight) % this.virtualHeight;
      const pulsingAlpha = p.alpha * (0.7 + 0.3 * Math.sin(time * p.pulseSpeed));

      ctx.beginPath();
      ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
      ctx.fillStyle = p.color;
      ctx.globalAlpha = pulsingAlpha;
      ctx.shadowColor = p.color;
      ctx.shadowBlur = 8;
      ctx.fill();
    }
    ctx.restore();
  }

  // Interactive Floor 1 Onboarding & Dynamic Waypoint Beacons
  renderOnboardingGuide(ctx) {
    if (this.state !== 'PLAYING') return;

    const time = performance.now() * 0.001;
    // Cache touch detection once — never changes mid-session on a real device
    if (this._isTouchCached === undefined) {
      this._isTouchCached = 'ontouchstart' in window && navigator.maxTouchPoints > 0;
    }
    const isTouch = this._isTouchCached || this.input.lastInputType === 'touch';
    // Badge width cache — measureText is expensive on mobile, cache by key
    if (!this._badgeWidths) this._badgeWidths = {};

    // Floor 1: Interactive Onboarding Beacon & Waypoint Beam
    if (this.currentLevel === 1) {
      ctx.save();

      const uncollectedShards = this.shards ? this.shards.filter(s => !s.isCollected) : [];

      if (uncollectedShards.length > 0) {
        // Find nearest shard
        let nearestShard = uncollectedShards[0];
        let minDist = Math.hypot(nearestShard.x - this.player.x, nearestShard.y - this.player.y);
        for (let i = 1; i < uncollectedShards.length; i++) {
          const d = Math.hypot(uncollectedShards[i].x - this.player.x, uncollectedShards[i].y - this.player.y);
          if (d < minDist) {
            minDist = d;
            nearestShard = uncollectedShards[i];
          }
        }

        // Animated waypoint beam
        const pulse = 0.6 + 0.4 * Math.sin(time * 6);
        ctx.setLineDash([8, 8]);
        ctx.lineDashOffset = -time * 35;
        ctx.strokeStyle = `rgba(255, 210, 0, ${pulse * 0.85})`;
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.moveTo(this.player.x, this.player.y);
        ctx.lineTo(nearestShard.x, nearestShard.y);
        ctx.stroke();

        // Pulsing target ring around shard
        ctx.setLineDash([]);
        ctx.beginPath();
        ctx.arc(nearestShard.x, nearestShard.y, nearestShard.radius + 14 + Math.sin(time * 5) * 4, 0, Math.PI * 2);
        ctx.strokeStyle = '#ffd200';
        ctx.lineWidth = 2;
        ctx.stroke();

        // Floating label
        ctx.font = 'bold 13px "Orbitron", "Inter", sans-serif';
        ctx.fillStyle = '#ffd200';
        ctx.textAlign = 'center';
        ctx.shadowColor = '#ffd200';
        ctx.shadowBlur = 8;
        ctx.fillText('✦ HARVEST SHARD ✦', nearestShard.x, nearestShard.y - 28);

        // Player movement prompt badge — cached text width (measureText expensive on mobile)
        const badgeY = this.player.y - 52;
        const hintText = isTouch ? '🕹️ DRAG JOYSTICK TO MOVE' : 'MOVE: [W A S D] or [↑ ← ↓ →]';
        const hintKey = isTouch ? 'hint_move_touch' : 'hint_move_kb';
        ctx.font = 'bold 12px "Orbitron", "Inter", sans-serif';
        if (!this._badgeWidths[hintKey]) this._badgeWidths[hintKey] = ctx.measureText(hintText).width;
        const textW = this._badgeWidths[hintKey];
        ctx.fillStyle = 'rgba(5, 8, 20, 0.85)';
        ctx.strokeStyle = '#00f0ff';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.roundRect(this.player.x - textW / 2 - 12, badgeY - 14, textW + 24, 28, 14);
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = '#ffffff';
        ctx.shadowColor = '#00f0ff';
        ctx.shadowBlur = 6;
        ctx.fillText(hintText, this.player.x, badgeY + 4);

      } else if (this.portal && this.portal.isUnlocked) {
        // Emerald beacon to exit portal
        const pulse = 0.6 + 0.4 * Math.sin(time * 6);
        ctx.setLineDash([8, 8]);
        ctx.lineDashOffset = -time * 35;
        ctx.strokeStyle = `rgba(0, 255, 170, ${pulse * 0.9})`;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(this.player.x, this.player.y);
        ctx.lineTo(this.portal.x, this.portal.y);
        ctx.stroke();

        // Pulsing portal ring
        ctx.setLineDash([]);
        ctx.beginPath();
        ctx.arc(this.portal.x, this.portal.y, this.portal.radius + 18 + Math.sin(time * 5) * 6, 0, Math.PI * 2);
        ctx.strokeStyle = '#00ffaa';
        ctx.lineWidth = 2.5;
        ctx.stroke();

        // Floating label
        ctx.font = 'bold 14px "Orbitron", "Inter", sans-serif';
        ctx.fillStyle = '#00ffaa';
        ctx.textAlign = 'center';
        ctx.shadowColor = '#00ffaa';
        ctx.shadowBlur = 10;
        ctx.fillText('⚡ ENTER PORTAL ⚡', this.portal.x, this.portal.y - this.portal.radius - 22);

        // Player badge — cached text width
        const badgeY = this.player.y - 52;
        const hintText = '⚡ PORTAL UNLOCKED — ENTER TO ADVANCE';
        ctx.font = 'bold 12px "Orbitron", "Inter", sans-serif';
        if (!this._badgeWidths['hint_portal']) this._badgeWidths['hint_portal'] = ctx.measureText(hintText).width;
        const textW = this._badgeWidths['hint_portal'];
        ctx.fillStyle = 'rgba(5, 8, 20, 0.85)';
        ctx.strokeStyle = '#00ffaa';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.roundRect(this.player.x - textW / 2 - 12, badgeY - 14, textW + 24, 28, 14);
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = '#00ffaa';
        ctx.fillText(hintText, this.player.x, badgeY + 4);
      }

      ctx.restore();

    } else if (this.currentLevel === 2) {
      // Floor 2: Prompt for Dash Ability (Invulnerability Burst)
      if (!this.hasDashedOnFloor2 && this.player.dashCooldownTimer <= 0) {
        ctx.save();
        ctx.textAlign = 'center';
        const badgeY = this.player.y - 52;
        const hintText = isTouch ? '⚡ TAP DASH FOR BURST INVULNERABILITY' : '⚡ PRESS [SPACE] / [SHIFT] TO DASH';
        const hintKey = isTouch ? 'hint_dash_touch' : 'hint_dash_kb';
        ctx.font = 'bold 12px "Orbitron", "Inter", sans-serif';
        if (!this._badgeWidths[hintKey]) this._badgeWidths[hintKey] = ctx.measureText(hintText).width;
        const textW = this._badgeWidths[hintKey];
        ctx.fillStyle = 'rgba(5, 8, 20, 0.85)';
        ctx.strokeStyle = '#00f0ff';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.roundRect(this.player.x - textW / 2 - 12, badgeY - 14, textW + 24, 28, 14);
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = '#00f0ff';
        ctx.shadowColor = '#00f0ff';
        ctx.shadowBlur = 6;
        ctx.fillText(hintText, this.player.x, badgeY + 4);
        ctx.restore();
      }
    } else if (this.currentLevel === 3) {
      // Floor 3: The Echo Signature Warning
      if (this.echo && this.echo.isActive && this.echo.ghost.alpha > 0.3) {
        ctx.save();
        ctx.textAlign = 'center';
        ctx.font = 'bold 12px "Orbitron", "Inter", sans-serif';
        ctx.fillStyle = '#ff00aa';
        ctx.shadowColor = '#ff00aa';
        ctx.shadowBlur = 8;
        ctx.fillText('⚠️ LETHAL ECHO TRAIL', this.echo.ghost.x, this.echo.ghost.y - 28);
        ctx.restore();
      }
    }
  }

  // Render Frame
  render() {
    this.ctx.save();
    // High-DPI Retina scaling: scales virtual coordinates to device pixels
    if (this.dpr && this.dpr !== 1) {
      this.ctx.scale(this.dpr, this.dpr);
    }

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

    // Ambient Menu Atmosphere when on Start Screen
    if (this.state === 'START' || this.state === 'MENU') {
      this.renderMenuAtmosphere(this.ctx);
    }

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

      // 8b. Render Floor 1 Interactive Guidance & Waypoint Beacons
      this.renderOnboardingGuide(this.ctx);
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
