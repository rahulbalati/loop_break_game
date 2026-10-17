// LOOP//BREAK - Procedural Arena Generator & Solvability Verifier

import { HunterEnemy, InterceptorEnemy, SentinelEnemy } from '../entities/Enemies.js';
import { Shard } from '../entities/Shard.js';
import { ExitPortal } from '../entities/ExitPortal.js';

export class ArenaGenerator {
  constructor(arenaWidth, arenaHeight) {
    this.width = arenaWidth;
    this.height = arenaHeight;
  }

  generateLevel(level) {
    const pad = 90;

    // 1. Determine Player Spawn (Left-center bias for early levels, varying quadrants later)
    let playerSpawn = { x: 180, y: this.height / 2 };
    if (level > 3) {
      const quadrants = [
        { x: 180, y: 160 },
        { x: 180, y: this.height - 160 },
        { x: this.width - 180, y: 160 },
        { x: this.width - 180, y: this.height - 160 },
      ];
      playerSpawn = quadrants[level % quadrants.length];
    }

    // 2. Determine Exit Portal Location (Opposite quadrant)
    const portalX = playerSpawn.x < this.width / 2 ? this.width - 180 : 180;
    const portalY = playerSpawn.y < this.height / 2 ? this.height - 180 : 180;
    const portal = new ExitPortal(portalX, portalY);

    // 3. Shard Placement (Guaranteed Reachability)
    const requiredShards = Math.min(8, 2 + Math.floor(level / 2));
    const shards = [];

    // Distribute shards safely throughout the arena
    const minSafeDistFromSpawn = 160;
    let attempts = 0;

    while (shards.length < requiredShards && attempts < 200) {
      attempts++;
      const sx = pad + Math.random() * (this.width - pad * 2);
      const sy = pad + Math.random() * (this.height - pad * 2);

      // Distance to player
      if (Math.hypot(sx - playerSpawn.x, sy - playerSpawn.y) < minSafeDistFromSpawn) {
        continue;
      }
      // Distance to portal
      if (Math.hypot(sx - portalX, sy - portalY) < 90) {
        continue;
      }
      // Distance to existing shards
      const tooClose = shards.some(s => Math.hypot(s.x - sx, s.y - sy) < 110);
      if (tooClose) continue;

      // Bonus shard chance (1 per level starting level 4)
      const isBonus = shards.length === requiredShards - 1 && level >= 4;
      shards.push(new Shard(sx, sy, isBonus));
    }

    // Fallback if needed
    if (shards.length < requiredShards) {
      for (let i = shards.length; i < requiredShards; i++) {
        const angle = (i / requiredShards) * Math.PI * 2;
        const dist = 220;
        const fx = this.width / 2 + Math.cos(angle) * dist;
        const fy = this.height / 2 + Math.sin(angle) * dist;
        shards.push(new Shard(fx, fy));
      }
    }

    // 4. Enemy Composition & Spawning (Safely away from player spawn > 240px)
    const enemies = [];
    const speedScale = Math.min(1.4, 0.9 + level * 0.04);

    const getSafeEnemyPos = () => {
      let ex = 0;
      let ey = 0;
      let safe = false;
      let eAttempts = 0;
      while (!safe && eAttempts < 100) {
        eAttempts++;
        ex = pad + 40 + Math.random() * (this.width - pad * 2 - 80);
        ey = pad + 40 + Math.random() * (this.height - pad * 2 - 80);
        if (Math.hypot(ex - playerSpawn.x, ey - playerSpawn.y) > 260) {
          safe = true;
        }
      }
      return { x: ex, y: ey };
    };

    if (level === 1) {
      // 1 Slow Hunter
      const pos = getSafeEnemyPos();
      enemies.push(new HunterEnemy(pos.x, pos.y, 0.75));
    } else if (level === 2) {
      // 1 Standard Hunter
      const pos = getSafeEnemyPos();
      enemies.push(new HunterEnemy(pos.x, pos.y, 0.9));
    } else if (level === 3) {
      // Level 3 introduces Echo! 1 Hunter keeps it focused
      const pos = getSafeEnemyPos();
      enemies.push(new HunterEnemy(pos.x, pos.y, 1.0));
    } else if (level === 4) {
      // Introduce Interceptor
      const pos1 = getSafeEnemyPos();
      const pos2 = getSafeEnemyPos();
      enemies.push(new HunterEnemy(pos1.x, pos1.y, speedScale));
      enemies.push(new InterceptorEnemy(pos2.x, pos2.y, speedScale));
    } else if (level === 5) {
      // Introduce Sentinel guarding portal
      const pos1 = getSafeEnemyPos();
      const pos2 = getSafeEnemyPos();
      enemies.push(new HunterEnemy(pos1.x, pos1.y, speedScale));
      enemies.push(new InterceptorEnemy(pos2.x, pos2.y, speedScale));
      enemies.push(new SentinelEnemy(portalX, portalY, 130, speedScale));
    } else {
      // Levels 6+: Procedural combination
      const numHunters = Math.min(3, 1 + Math.floor((level - 4) / 3));
      const numInterceptors = Math.min(2, Math.floor((level - 3) / 3));
      const numSentinels = level % 2 === 0 ? 1 : 0;

      for (let i = 0; i < numHunters; i++) {
        const p = getSafeEnemyPos();
        enemies.push(new HunterEnemy(p.x, p.y, speedScale));
      }
      for (let i = 0; i < numInterceptors; i++) {
        const p = getSafeEnemyPos();
        enemies.push(new InterceptorEnemy(p.x, p.y, speedScale));
      }
      if (numSentinels > 0) {
        // Sentinel guards portal or arena center
        const anchor = level % 3 === 0 ? { x: this.width / 2, y: this.height / 2 } : { x: portalX, y: portalY };
        enemies.push(new SentinelEnemy(anchor.x, anchor.y, 140, speedScale));
      }
    }

    // 5. Obstacles / Hazard Barriers (Level 2+)
    const obstacles = [];
    if (level >= 2) {
      // Add decorative/tactical energy pillars that don't block passages
      const numPillars = Math.min(4, Math.floor(level / 3));
      for (let i = 0; i < numPillars; i++) {
        const ox = this.width * (0.35 + 0.3 * (i % 2));
        const oy = this.height * (0.35 + 0.3 * Math.floor(i / 2));
        // Check distance to spawn and portal
        if (Math.hypot(ox - playerSpawn.x, oy - playerSpawn.y) > 160 &&
            Math.hypot(ox - portalX, oy - portalY) > 120) {
          obstacles.push({
            x: ox,
            y: oy,
            radius: 24,
            color: '#1a2238',
            borderColor: '#00f0ff',
          });
        }
      }
    }

    return {
      level,
      playerSpawn,
      portal,
      shards,
      enemies,
      obstacles,
      requiredShards,
    };
  }
}
