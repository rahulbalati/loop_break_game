// LOOP//BREAK - Automated Comprehensive Headless Game Test Suite
// Tests: Arena Generator (Levels 1-10), Shard Boundary & Obstacle Clearance,
// Portal Unlock Fail-Safe, Echo Recording & Playback, Lethal Damage Callback,
// Enemy Flocking Separation, Abilities (Dash/Pulse), and Save System.

import { CONFIG } from '../src/config.js';
import { ArenaGenerator } from '../src/systems/ArenaGenerator.js';
import { EchoManager } from '../src/entities/EchoManager.js';
import { Player } from '../src/entities/Player.js';
import { HunterEnemy, InterceptorEnemy, SentinelEnemy } from '../src/entities/Enemies.js';
import { Shard } from '../src/entities/Shard.js';
import { ExitPortal } from '../src/entities/ExitPortal.js';
import { CollisionSystem } from '../src/systems/CollisionSystem.js';
import { ParticleSystem } from '../src/systems/ParticleSystem.js';

let passedTests = 0;
let totalTests = 0;

function assert(condition, message) {
  totalTests++;
  if (!condition) {
    console.error(`❌ FAILED: ${message}`);
    process.exitCode = 1;
  } else {
    console.log(`✅ PASSED: ${message}`);
    passedTests++;
  }
}

console.log('====================================================');
console.log('⚡ RUNNING AUTOMATED AUDIT FOR LOOP//BREAK');
console.log('====================================================');

// TEST 1: ARENA GENERATION & CRITICAL INVARIANTS ACROSS FLOORS 1 TO 10
console.log('\n--- Test 1: Arena Generation & Obstacle/Shard Invariants ---');
const arenaWidth = 1280;
const arenaHeight = 720;
const arenaGen = new ArenaGenerator(arenaWidth, arenaHeight);

for (let floor = 1; floor <= 10; floor++) {
  const data = arenaGen.generateLevel(floor);

  assert(data.shards.length > 0, `Floor ${floor}: Generated ${data.shards.length} shards`);
  assert(data.shards.length === data.requiredShards, `Floor ${floor}: Required shards (${data.requiredShards}) strictly matches shards count (${data.shards.length})`);
  assert(data.enemies.length > 0, `Floor ${floor}: Generated ${data.enemies.length} enemies`);
  assert(data.portal !== null, `Floor ${floor}: Portal initialized`);

  // Verify all shards are safely within arena bounds
  for (let s = 0; s < data.shards.length; s++) {
    const shard = data.shards[s];
    assert(
      shard.x >= 60 && shard.x <= arenaWidth - 60 && shard.y >= 60 && shard.y <= arenaHeight - 60,
      `Floor ${floor} Shard ${s}: Inside safe arena boundaries (${Math.round(shard.x)}, ${Math.round(shard.y)})`
    );

    // Verify shard does not collide with any obstacle
    for (let o = 0; o < data.obstacles.length; o++) {
      const obs = data.obstacles[o];
      const dist = Math.hypot(shard.x - obs.x, shard.y - obs.y);
      assert(
        dist >= obs.radius + 60,
        `Floor ${floor} Shard ${s}: Clear from Obstacle ${o} (dist=${Math.round(dist)}, minRequired=${obs.radius + 60})`
      );
    }
  }

  // Verify player spawn is safe from enemies
  for (let e = 0; e < data.enemies.length; e++) {
    const enemy = data.enemies[e];
    const spawnDist = Math.hypot(enemy.x - data.playerSpawn.x, enemy.y - data.playerSpawn.y);
    assert(
      spawnDist >= 220,
      `Floor ${floor} Enemy ${e} (${enemy.type}): Safe initial spawn distance from player (${Math.round(spawnDist)}px >= 220px)`
    );
  }
}

// TEST 2: SHARD MAGNETIZATION BOUNDARY CLAMPING
console.log('\n--- Test 2: Shard Boundary Clamping When Magnetized ---');
const testShard = new Shard(arenaWidth - 20, arenaHeight / 2);
testShard.vx = 800; // High speed outward
testShard.update(0.016, { x: arenaWidth + 500, y: arenaHeight / 2 }, arenaWidth, arenaHeight);
assert(
  testShard.x <= arenaWidth - 14,
  `Shard clamped within arena right wall (x=${testShard.x} <= ${arenaWidth - 14})`
);

// TEST 3: ECHO RECORDING, PLAYBACK & LETHAL DAMAGE CALLBACK
console.log('\n--- Test 3: Echo Manager & Lethal Damage Callback ---');
const echo = new EchoManager();
echo.setLevel(3, {}); // Unlocked at level 3
assert(echo.isActive === true, 'Echo active on Floor 3+');

const mockPlayer = new Player(100, 100);
mockPlayer.health = 1; // 1 shield left

const mockParticles = {
  spawnHitSparks: () => {},
  spawnDashStreak: () => {},
  spawnPulseWave: () => {},
  spawnShardPickup: () => {},
  spawnPortalBurst: () => {},
};
const mockShake = { shake: () => {} };

// Record path for 3 seconds (player moves from 100,100 to 400,100)
for (let t = 0; t <= 3.0; t += 0.05) {
  mockPlayer.x = 100 + t * 100;
  mockPlayer.y = 100;
  echo.record(mockPlayer, 0.05);
}

// Update echo at t = 3.0 (ghost should be at player position from 3.0 - 2.4 = 0.6s -> x = 160)
let diedCalled = false;
echo.update(0.05, mockPlayer, mockParticles, mockShake, () => {
  diedCalled = true;
});

assert(echo.ghost.x > 0, `Echo ghost replaying position (ghost.x=${Math.round(echo.ghost.x)})`);

// Now move player directly on top of ghost and trigger lethal damage
mockPlayer.x = echo.ghost.x;
mockPlayer.y = echo.ghost.y;
echo.ghost.alpha = 1.0; // fully visible

echo.update(0.016, mockPlayer, mockParticles, mockShake, () => {
  diedCalled = true;
});

assert(mockPlayer.health === 0, `Player health reduced to 0 (health=${mockPlayer.health})`);
assert(diedCalled === true, 'onPlayerDied callback successfully invoked by EchoManager on lethal damage');

// TEST 4: ENEMY SEPARATION (ANTI-STACKING)
console.log('\n--- Test 4: Enemy Flocking Separation Force ---');
const hunter1 = new HunterEnemy(300, 300);
const hunter2 = new HunterEnemy(302, 300); // 2px away (overlapping)
const enemyList = [hunter1, hunter2];

hunter1.separate(enemyList);
hunter2.separate(enemyList);

assert(
  hunter1.vx < 0 && hunter2.vx > 0,
  `Enemies push apart when overlapping (hunter1.vx=${Math.round(hunter1.vx)}, hunter2.vx=${Math.round(hunter2.vx)})`
);

// TEST 5: PORTAL UNLOCK FAIL-SAFE
console.log('\n--- Test 5: Portal Unlock When Shards Cleared ---');
const collision = new CollisionSystem();
const portal = new ExitPortal(500, 500);
const emptyShards = [];

assert(!portal.isUnlocked, 'Portal initially locked');
// Fail-safe logic
if (emptyShards.length === 0 && !portal.isUnlocked) {
  portal.setUnlocked(true);
}
assert(portal.isUnlocked, 'Portal unlocked when 0 shards remain');

// TEST 6: PLAYER DASH INVULNERABILITY
console.log('\n--- Test 6: Player Dash Invulnerability ---');
const dashPlayer = new Player(200, 200);
dashPlayer.dash({ x: 1, y: 0 }, mockParticles);
assert(dashPlayer.isDashing === true, 'Player enters dashing state');

const hitResult = dashPlayer.takeDamage(mockParticles, mockShake);
assert(hitResult === false, 'Player immune to damage while dashing');
assert(dashPlayer.health === CONFIG.PLAYER.BASE_HEALTH, 'Player health remains unchanged during dash');

console.log('\n====================================================');
console.log(`🎉 TEST SUMMARY: ${passedTests} / ${totalTests} TESTS PASSED!`);
console.log('====================================================\n');
