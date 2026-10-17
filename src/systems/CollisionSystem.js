// LOOP//BREAK - Spatial Collision & Interaction System

import { audio } from '../audio/AudioSynthesizer.js';

export class CollisionSystem {
  constructor() {
    this.comboTimer = 0;
    this.comboMultiplier = 1.0;
  }

  resetCombo() {
    this.comboTimer = 0;
    this.comboMultiplier = 1.0;
  }

  updateCombo(dt) {
    if (this.comboTimer > 0) {
      this.comboTimer -= dt;
      if (this.comboTimer <= 0) {
        this.comboMultiplier = 1.0;
      }
    }
  }

  checkCollisions({
    player,
    shards,
    enemies,
    obstacles,
    portal,
    particleSystem,
    screenShake,
    onShardCollected,
    onLevelCompleted,
    onPlayerDied,
  }) {
    // 1. Player vs Shards
    for (let i = shards.length - 1; i >= 0; i--) {
      const shard = shards[i];
      if (shard.isCollected) continue;

      const dist = Math.hypot(player.x - shard.x, player.y - shard.y);
      if (dist < player.radius + shard.radius) {
        shard.isCollected = true;
        shards.splice(i, 1);

        // Increase combo
        this.comboTimer = 4.0;
        this.comboMultiplier = Math.min(4.0, this.comboMultiplier + 0.5);

        audio.playShardPickup(this.comboMultiplier);
        particleSystem.spawnShardPickup(shard.x, shard.y);

        if (onShardCollected) {
          onShardCollected(shard, this.comboMultiplier);
        }
      }
    }

    // 2. Player & Enemies vs Obstacles
    for (const obs of obstacles) {
      // Player vs Obstacle
      const pDist = Math.hypot(player.x - obs.x, player.y - obs.y);
      const minP = player.radius + obs.radius;
      if (pDist < minP && pDist > 0) {
        const overlap = minP - pDist;
        const nx = (player.x - obs.x) / pDist;
        const ny = (player.y - obs.y) / pDist;
        player.x += nx * overlap;
        player.y += ny * overlap;
      }

      // Enemies vs Obstacle
      for (const enemy of enemies) {
        const eDist = Math.hypot(enemy.x - obs.x, enemy.y - obs.y);
        const minE = enemy.radius + obs.radius;
        if (eDist < minE && eDist > 0) {
          const overlap = minE - eDist;
          const nx = (enemy.x - obs.x) / eDist;
          const ny = (enemy.y - obs.y) / eDist;
          enemy.x += nx * overlap;
          enemy.y += ny * overlap;
          enemy.vx += nx * 100;
          enemy.vy += ny * 100;
        }
      }
    }

    // 3. Player vs Enemies
    for (const enemy of enemies) {
      const dist = Math.hypot(player.x - enemy.x, player.y - enemy.y);
      if (dist < player.radius + enemy.radius) {
        // If player is dashing, they are immune and knock enemy slightly
        if (player.isDashing) {
          const angle = Math.atan2(enemy.y - player.y, enemy.x - player.x);
          enemy.vx += Math.cos(angle) * 350;
          enemy.vy += Math.sin(angle) * 350;
          enemy.applyStun(0.4);
          particleSystem.spawnHitSparks(enemy.x, enemy.y, enemy.color);
        } else {
          // Player takes damage
          const damaged = player.takeDamage(particleSystem, screenShake);
          if (damaged) {
            this.comboMultiplier = 1.0;
            if (player.health <= 0 && onPlayerDied) {
              onPlayerDied();
            }
          }
        }
      }
    }

    // 4. Player vs Exit Portal
    if (portal && portal.isUnlocked) {
      const dist = Math.hypot(player.x - portal.x, player.y - portal.y);
      if (dist < player.radius + portal.radius * 0.95) {
        if (onLevelCompleted) {
          onLevelCompleted();
        }
      }
    }
  }
}
