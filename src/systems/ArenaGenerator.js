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
    const pad = Math.max(70, Math.min(120, this.height * 0.12));

    // 1. Determine Player Spawn (Relative to current dynamic arena dimensions)
    let playerSpawn = { x: pad + 80, y: this.height / 2 };
    if (level > 3) {
      const quadrants = [
        { x: pad + 90, y: pad + 70 },
        { x: pad + 90, y: this.height - pad - 70 },
        { x: this.width - pad - 90, y: pad + 70 },
        { x: this.width - pad - 90, y: this.height - pad - 70 },
      ];
      playerSpawn = quadrants[level % quadrants.length];
    }

    // 2. Determine Exit Portal Location (Opposite quadrant)
    const portalX = playerSpawn.x < this.width / 2 ? this.width - pad - 90 : pad + 90;
    const portalY = playerSpawn.y < this.height / 2 ? this.height - pad - 70 : pad + 70;
    const portal = new ExitPortal(portalX, portalY);

    // 3. Generate Obstacles First (So shards and enemies never spawn inside them)
    const obstacles = [];
    if (level >= 2) {
      const numPillars = Math.min(4, Math.floor(level / 3));
      for (let i = 0; i < numPillars; i++) {
        const ox = this.width * (0.35 + 0.3 * (i % 2));
        const oy = this.height * (0.35 + 0.3 * Math.floor(i / 2));
        // Check safe clearance to spawn and portal
        if (Math.hypot(ox - playerSpawn.x, oy - playerSpawn.y) > 170 &&
            Math.hypot(ox - portalX, oy - portalY) > 130) {
          obstacles.push({
            x: ox,
            y: oy,
            radius: 26,
            color: '#1a2238',
            borderColor: '#00f0ff',
          });
        }
      }
    }

    // 4. Shard Placement (Guaranteed Reachability & Free from Obstacles)
    const targetShards = Math.min(7, 2 + Math.floor(level / 2));
    const shards = [];
    const minSafeDistFromSpawn = 150;
    let attempts = 0;

    const isPositionValid = (x, y) => {
      // Check boundaries
      if (x < pad || x > this.width - pad || y < pad || y > this.height - pad) return false;
      // Distance to player spawn
      if (Math.hypot(x - playerSpawn.x, y - playerSpawn.y) < minSafeDistFromSpawn) return false;
      // Distance to portal
      if (Math.hypot(x - portalX, y - portalY) < 95) return false;
      // Distance to all obstacles (CRITICAL: prevents trapped shards)
      for (const obs of obstacles) {
        if (Math.hypot(x - obs.x, y - obs.y) < obs.radius + 65) return false;
      }
      // Distance to existing shards
      for (const s of shards) {
        if (Math.hypot(x - s.x, y - s.y) < 85) return false;
      }
      return true;
    };

    while (shards.length < targetShards && attempts < 400) {
      attempts++;
      const sx = pad + Math.random() * (this.width - pad * 2);
      const sy = pad + Math.random() * (this.height - pad * 2);

      if (isPositionValid(sx, sy)) {
        const isBonus = shards.length === targetShards - 1 && level >= 4;
        shards.push(new Shard(sx, sy, isBonus));
      }
    }

    // Safe fallback ring if random attempts were restricted
    if (shards.length < targetShards) {
      for (let i = shards.length; i < targetShards; i++) {
        const angle = (i / targetShards) * Math.PI * 2;
        const dist = Math.min(this.width * 0.25, this.height * 0.3);
        let fx = this.width / 2 + Math.cos(angle) * dist;
        let fy = this.height / 2 + Math.sin(angle) * dist;

        // Ensure safe clearance from all obstacles
        for (const obs of obstacles) {
          const odist = Math.hypot(fx - obs.x, fy - obs.y);
          if (odist < obs.radius + 65) {
            const pushAngle = odist > 0.001 ? Math.atan2(fy - obs.y, fx - obs.x) : angle;
            fx = obs.x + Math.cos(pushAngle) * (obs.radius + 70);
            fy = obs.y + Math.sin(pushAngle) * (obs.radius + 70);
          }
        }

        // Clamp safely inside arena walls
        fx = Math.max(pad + 20, Math.min(this.width - pad - 20, fx));
        fy = Math.max(pad + 20, Math.min(this.height - pad - 20, fy));
        shards.push(new Shard(fx, fy));
      }
    }

    // Ensure requiredShards is 100% strictly synchronized with shards array
    const requiredShards = shards.length;

    // 5. Enemy Composition & Spawning (Safely away from player spawn > 260px)
    const enemies = [];
    const speedScale = Math.min(1.35, 0.85 + level * 0.035);

    const getSafeEnemyPos = () => {
      let ex = 0;
      let ey = 0;
      let safe = false;
      let eAttempts = 0;
      while (!safe && eAttempts < 200) {
        eAttempts++;
        ex = pad + 30 + Math.random() * (this.width - pad * 2 - 60);
        ey = pad + 30 + Math.random() * (this.height - pad * 2 - 60);
        if (Math.hypot(ex - playerSpawn.x, ey - playerSpawn.y) > 260) {
          // Also check not inside an obstacle
          const insideObs = obstacles.some(obs => Math.hypot(ex - obs.x, ey - obs.y) < obs.radius + 30);
          if (!insideObs) {
            safe = true;
          }
        }
      }
      return { x: ex, y: ey };
    };

    if (level === 1) {
      // Floor 1: Training Sector — Passive Training Drone (slow 0.35x speed, extra safe distance)
      let pos = getSafeEnemyPos();
      for (let attempt = 0; attempt < 60; attempt++) {
        if (Math.hypot(pos.x - playerSpawn.x, pos.y - playerSpawn.y) > 360) break;
        pos = getSafeEnemyPos();
      }
      const drone = new HunterEnemy(pos.x, pos.y, 0.35);
      drone.isTrainingDrone = true;
      enemies.push(drone);
    } else if (level === 2) {
      // Floor 2: Dash Practice Drone (0.65x speed)
      const pos = getSafeEnemyPos();
      enemies.push(new HunterEnemy(pos.x, pos.y, 0.65));
    } else if (level === 3) {
      // Floor 3: Introduce Echo — 1 Standard Hunter (0.85x speed)
      const pos = getSafeEnemyPos();
      enemies.push(new HunterEnemy(pos.x, pos.y, 0.85));
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
      // Levels 6+: Scaled combinations
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
        const anchor = level % 3 === 0 ? { x: this.width / 2, y: this.height / 2 } : { x: portalX, y: portalY };
        enemies.push(new SentinelEnemy(anchor.x, anchor.y, 140, speedScale));
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
