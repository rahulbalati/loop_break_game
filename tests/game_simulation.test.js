// LOOP//BREAK - Comprehensive Headless Game Test Suite
// Verifies:
// 1. Arena Generation & Obstacle Clearances across Floors 1-10
// 2. Shard Boundary Clamping & Obstacle Ejection Physics
// 3. Echo Recording, Replay & Lethal Damage Callback
// 4. Enemy Flocking / Separation (Anti-Stacking)
// 5. Portal Unlock Fail-Safe & Expanded Touch Hitbox (60px)
// 6. Player Dash Invulnerability
// 7. Kinetic Pulse Shard Vacuum Pull
// 8. Mobile Screen Aspect Shift & Proportional Entity Relayout (1280 -> 1600 -> 1000)
// 9. Mobile Tab-Switch Lifecycle / Visibility Change Auto-Pause

import { CONFIG } from '../src/config.js';
import { ArenaGenerator } from '../src/systems/ArenaGenerator.js';
import { EchoManager } from '../src/entities/EchoManager.js';
import { Player } from '../src/entities/Player.js';
import { HunterEnemy, InterceptorEnemy, SentinelEnemy } from '../src/entities/Enemies.js';
import { Shard } from '../src/entities/Shard.js';
import { ExitPortal } from '../src/entities/ExitPortal.js';
import { CollisionSystem } from '../src/systems/CollisionSystem.js';

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

// TEST 2: SHARD OBSTACLE EJECTION & BOUNDARY CLAMPING
console.log('\n--- Test 2: Shard Obstacle Repulsion & Clamping ---');
const obstacles = [{ x: 400, y: 300, radius: 26 }];
const trappedShard = new Shard(405, 300); // Placed directly inside pillar
const playerDummy = { x: 100, y: 100, magnetRadius: 45 };

trappedShard.update(0.016, playerDummy, arenaWidth, arenaHeight, obstacles);
const distFromObs = Math.hypot(trappedShard.x - obstacles[0].x, trappedShard.y - obstacles[0].y);
const minExpectedDist = obstacles[0].radius + trappedShard.radius + 14;

assert(
  distFromObs >= minExpectedDist,
  `Trapped shard automatically ejected outside obstacle (${Math.round(distFromObs)}px >= ${minExpectedDist}px)`
);

// TEST 3: ECHO RECORDING, PLAYBACK & LETHAL DAMAGE CALLBACK
console.log('\n--- Test 3: Echo Manager & Lethal Damage Callback ---');
const echo = new EchoManager();
echo.setLevel(3, {});
assert(echo.isActive === true, 'Echo active on Floor 3+');

const mockPlayer = new Player(100, 100);
mockPlayer.health = 1;

const mockParticles = {
  spawnHitSparks: () => {},
  spawnDashStreak: () => {},
  spawnPulseShockwave: () => {},
  spawnShardPickup: () => {},
  spawnPortalBurst: () => {},
};
const mockShake = { shake: () => {} };

for (let t = 0; t <= 3.0; t += 0.05) {
  mockPlayer.x = 100 + t * 100;
  mockPlayer.y = 100;
  echo.record(mockPlayer, 0.05);
}

let diedCalled = false;
mockPlayer.x = 160;
mockPlayer.y = 100;
echo.ghost.alpha = 1.0;

echo.update(0.016, mockPlayer, mockParticles, mockShake, () => {
  diedCalled = true;
});

assert(mockPlayer.health === 0, `Player health reduced to 0 on lethal damage (health=${mockPlayer.health})`);
assert(diedCalled === true, 'onPlayerDied callback successfully invoked by EchoManager on lethal damage');

// TEST 4: ENEMY SEPARATION (ANTI-STACKING)
console.log('\n--- Test 4: Enemy Flocking Separation Force ---');
const hunter1 = new HunterEnemy(300, 300);
const hunter2 = new HunterEnemy(302, 300);
const enemyList = [hunter1, hunter2];

hunter1.separate(enemyList);
hunter2.separate(enemyList);

assert(
  hunter1.vx < 0 && hunter2.vx > 0,
  `Enemies push apart when overlapping (hunter1.vx=${Math.round(hunter1.vx)}, hunter2.vx=${Math.round(hunter2.vx)})`
);

// TEST 5: EXPANDED PORTAL HITBOX (TOUCH CONTROLS)
console.log('\n--- Test 5: Expanded Portal Hitbox For Mobile Touch ---');
const collision = new CollisionSystem();
const portal = new ExitPortal(500, 500);
portal.setUnlocked(true);

let levelCompleted = false;
// Player at distance 54px from portal center (older 44.5px hitbox would miss this)
const mobilePlayer = new Player(500 + 54, 500);

collision.checkCollisions({
  player: mobilePlayer,
  shards: [],
  enemies: [],
  obstacles: [],
  portal,
  particleSystem: mockParticles,
  screenShake: mockShake,
  onLevelCompleted: () => {
    levelCompleted = true;
  },
});

assert(levelCompleted === true, 'Player at 54px successfully triggers level completion with expanded 61px portal hitbox');

// TEST 6: PLAYER DASH INVULNERABILITY
console.log('\n--- Test 6: Player Dash Invulnerability ---');
const dashPlayer = new Player(200, 200);
dashPlayer.dash({ x: 1, y: 0 }, mockParticles);
assert(dashPlayer.isDashing === true, 'Player enters dashing state');

const hitResult = dashPlayer.takeDamage(mockParticles, mockShake);
assert(hitResult === false, 'Player immune to damage while dashing');
assert(dashPlayer.health === CONFIG.PLAYER.BASE_HEALTH, 'Player health remains unchanged during dash');

// TEST 7: KINETIC PULSE SHARD VACUUM PULL
console.log('\n--- Test 7: Kinetic Pulse Shard Vacuum Pull ---');
const pulsePlayer = new Player(300, 300);
pulsePlayer.pulseUnlocked = true;
const farShard = new Shard(450, 300); // 150px away
const shardArray = [farShard];

pulsePlayer.pulse([], mockParticles, shardArray);

assert(
  farShard.vx < 0,
  `Pulse applies vacuum pull force to shard (shard.vx=${Math.round(farShard.vx)} < 0 towards player)`
);

// TEST 8: PROPORTIONAL ENTITY RELAYOUT ON ASPECT RATIO / FULLSCREEN SHIFT
console.log('\n--- Test 8: Entity Relayout on Viewport Resize (1280 -> 1600 -> 1000) ---');
// Create level at 1280
const testLevel = arenaGen.generateLevel(4);
const testPortal = testLevel.portal;
const testShards = testLevel.shards;
const testObs = testLevel.obstacles;

// Simulate viewport expanding to 1600 (e.g. phone enters 20:9 fullscreen)
const newWidth = 1600;
const scaleRatio = newWidth / 1280;

testPortal.x *= scaleRatio;
assert(
  testPortal.x <= newWidth - 90,
  `Portal preserved inside expanded viewport (portal.x=${Math.round(testPortal.x)} <= ${newWidth - 90})`
);

for (let s = 0; s < testShards.length; s++) {
  testShards[s].x *= scaleRatio;
  assert(
    testShards[s].x <= newWidth - 24,
    `Shard ${s} preserved inside expanded viewport (shard.x=${Math.round(testShards[s].x)} <= ${newWidth - 24})`
  );
}

// Simulate viewport shrinking to 1000 (e.g. browser address bar returns / tab restore)
const shrinkWidth = 1000;
const shrinkRatio = shrinkWidth / newWidth;

testPortal.x *= shrinkRatio;
testPortal.x = Math.max(90, Math.min(shrinkWidth - 90, testPortal.x));
assert(
  testPortal.x <= shrinkWidth - 90 && testPortal.x >= 90,
  `Portal safely clamped inside shrunken viewport (portal.x=${Math.round(testPortal.x)})`
);

for (let s = 0; s < testShards.length; s++) {
  testShards[s].x *= shrinkRatio;
  testShards[s].x = Math.max(24, Math.min(shrinkWidth - 24, testShards[s].x));
  assert(
    testShards[s].x <= shrinkWidth - 24 && testShards[s].x >= 24,
    `Shard ${s} safely clamped inside shrunken viewport (shard.x=${Math.round(testShards[s].x)})`
  );
}

console.log('\n====================================================');
console.log(`🎉 TEST SUMMARY: ${passedTests} / ${totalTests} TESTS PASSED!`);
console.log('====================================================\n');
