// LOOP//BREAK - Headless tests for the simulation, saves and economy. Run: npm test
import { Run } from '../src/core/Run.js';
import { SpatialHash } from '../src/core/SpatialHash.js';
import { polygonArea, pointInPolygon, segmentIntersection } from '../src/core/math.js';
import { buildDraft, applyOption, availableEvolution, buildCacheOptions } from '../src/systems/DraftSystem.js';
import { computeRunFlux } from '../src/systems/Economy.js';
import { migrateV1, normalizeSave, pickBestSave, createDefaultSave, SaveSystem } from '../src/systems/SaveSystem.js';
import { WEAPONS } from '../src/data/weapons.js';
import { CONFIG } from '../src/config.js';

let passed = 0;
let failed = 0;
function test(name, fn) {
  try {
    fn();
    passed++;
    console.log(`  ok  ${name}`);
  } catch (e) {
    failed++;
    console.error(`  FAIL ${name}\n       ${e.message}`);
  }
}
function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

const DT = 1 / 60;
const still = { x: 0, y: 0, dash: false };

// Disables the spawn director so tests control every enemy
function quietRun(opts = {}) {
  const run = new Run({ seed: 1234, ...opts });
  run.stage = { ...run.stage, segments: [{ from: 0, to: 1e9, rate: 0, mix: { drone: 1 } }], events: [] };
  return run;
}

console.log('\nGeometry');
test('segment intersection finds crossing', () => {
  const p = segmentIntersection(0, 0, 10, 10, 0, 10, 10, 0);
  assert(p && Math.abs(p.x - 5) < 1e-6 && Math.abs(p.y - 5) < 1e-6, 'expected (5,5)');
  assert(segmentIntersection(0, 0, 1, 0, 0, 1, 1, 1) === null, 'parallel segments should not intersect');
});
test('polygon area and containment', () => {
  const sq = [0, 0, 100, 0, 100, 100, 0, 100];
  assert(Math.abs(polygonArea(sq) - 10000) < 1e-6, 'area of 100x100 square');
  assert(pointInPolygon(50, 50, sq), 'centre inside');
  assert(!pointInPolygon(150, 50, sq), 'outside point');
});
test('spatial hash returns nearby objects only', () => {
  const h = new SpatialHash(64);
  const a = { x: 10, y: 10 }, b = { x: 500, y: 500 };
  h.insert(a); h.insert(b);
  const out = h.query(0, 0, 50, []);
  assert(out.includes(a) && !out.includes(b), 'query should include a and not b');
  h.clear();
  assert(h.query(0, 0, 50, []).length === 0, 'cleared hash is empty');
});

console.log('\nEchoes');
test('history sampling returns the past position', () => {
  const run = quietRun();
  for (let i = 0; i < 120; i++) run.update(DT, { x: 1, y: 0, dash: false });
  const out = {};
  assert(run.sampleHistory(1.0, out), 'sample should exist after 2s');
  assert(out.x < run.player.x - 100, `echo should lag behind (echo ${out.x.toFixed(0)} vs player ${run.player.x.toFixed(0)})`);
});
test('first echo comes online at level 2', () => {
  const run = quietRun();
  assert(run.stats.echoCount === 0, 'no echo at level 1');
  run.gainXp(run.xpNeed);
  for (let i = 0; i < 200; i++) run.update(DT, { x: 1, y: 0.3, dash: false });
  assert(run.echoOnline && run.stats.echoCount === 1, 'one echo after level 2');
  assert(run.echoes[0].active, 'echo is active once history is long enough');
  assert(run.events.some(e => e.type === 'toast' && e.title === 'ECHO ONLINE'), 'echo toast emitted');
});
test('echoes fire weapons too (emitters include active echoes)', () => {
  const run = quietRun();
  run.passives.temporal_fork = 2;
  run.gainXp(run.xpNeed);
  for (let i = 0; i < 400; i++) run.update(DT, { x: Math.cos(i / 30), y: Math.sin(i / 30), dash: false });
  assert(run.emitters.length === 4, `expected player + 3 echoes, got ${run.emitters.length}`);
});
test('charged echo detonates a paradox on enemy contact', () => {
  const run = quietRun();
  run.gainXp(run.xpNeed);
  for (let i = 0; i < 200; i++) run.update(DT, { x: 1, y: 0, dash: false });
  run.events.length = 0;
  const echo = run.echoes[0];
  echo.paradoxTimer = 0;
  const e = run.spawnEnemy('brute', echo.x, echo.y);
  e.speed = 0;
  run.update(DT, still);
  assert(run.paradoxes === 1, `expected 1 paradox, got ${run.paradoxes}`);
  assert(echo.paradoxTimer > 0, 'paradox recharges after detonation');
});

console.log('\nLoop capture');
test('circling a cluster captures every enemy inside', () => {
  const run = quietRun();
  run.player.hp = 1e9;
  run.stats.maxHp = 1e9;
  const targets = [];
  for (let i = 0; i < 6; i++) {
    const e = run.spawnEnemy('brute', 150 + (i % 3) * 20, (i < 3 ? -10 : 10));
    e.speed = 0;
    e.damage = 0;
    targets.push(e);
  }
  // Drive the player around a circle centred on the cluster
  const cx = 170, cy = 0, R = 100;
  run.player.x = cx + R; run.player.y = cy;
  let a = 0;
  for (let i = 0; i < 260 && run.loopKills === 0; i++) {
    a += 0.036;
    const tx = cx + Math.cos(a) * R, ty = cy + Math.sin(a) * R;
    const dx = tx - run.player.x, dy = ty - run.player.y;
    const len = Math.hypot(dx, dy) || 1;
    run.update(DT, { x: dx / len, y: dy / len, dash: false });
  }
  assert(run.loopKills === 6, `expected 6 loop kills, got ${run.loopKills}`);
});
test('tiny wiggles do not count as loops', () => {
  const run = quietRun();
  for (let i = 0; i < 300; i++) run.update(DT, { x: Math.sign(Math.sin(i / 3)), y: 0, dash: false });
  assert(run.loopFx.length === 0 && run.loopKills === 0, 'no loop from back-and-forth movement');
});

console.log('\nCombat');
test('dash grants invulnerability', () => {
  const run = quietRun();
  const e = run.spawnEnemy('brute', 30, 0);
  e.speed = 0;
  run.update(DT, { x: 1, y: 0, dash: true });
  const hp = run.player.hp;
  run.update(DT, { x: 1, y: 0, dash: false });
  assert(run.player.hp === hp, 'no damage taken mid-dash');
});
test('death emits event and revive restores the run', () => {
  const run = quietRun();
  run.time = 60;
  run.player.invuln = 0;
  run.hurtPlayer(9999);
  assert(run.dead && run.events.some(e => e.type === 'death'), 'death event');
  for (let i = 0; i < 10; i++) run.spawnEnemy('drone', 50 + i * 10, 0);
  run.revive();
  assert(!run.dead && run.player.hp === run.stats.maxHp, 'revived at full hp');
  assert(run.enemies.length === 0, 'revive shockwave clears nearby enemies');
  assert(run.revivesLeft === 0, 'revive consumed');
});
test('splitter spawns children on death', () => {
  const run = quietRun();
  const e = run.spawnEnemy('splitter', 300, 0);
  run.damageEnemy(e, 1e6);
  run.sweepDead();
  assert(run.enemies.filter(x => x.type === 'swarmer').length === 3, 'three swarmers');
});
test('killing an elite drops a data cache that offers a draft', () => {
  const run = quietRun();
  const e = run.spawnEnemy('brute', 200, 0, { elite: true });
  run.damageEnemy(e, 1e9);
  assert(run.pickups.some(p => p.type === 'cache'), 'cache dropped');
  run.collectPickup({ type: 'cache' });
  const ev = run.events.find(x => x.type === 'cache');
  assert(ev && ev.options.length === 3, 'cache offers three options');
});

console.log('\nDrafts');
test('drafts offer three distinct options', () => {
  const run = quietRun();
  for (let i = 0; i < 30; i++) {
    const opts = buildDraft(run, 3);
    assert(opts.length === 3, 'three options');
    assert(new Set(opts.map(o => o.kind + o.id)).size === 3, 'distinct options');
    applyOption(run, opts[0]);
  }
  assert(run.weapons.length <= CONFIG.RUN.MAX_WEAPONS, 'weapon slots respected');
});
test('evolution becomes available at max level + required passive', () => {
  const run = quietRun();
  const w = run.weapons.find(x => x.id === 'pulse_bolt');
  w.level = WEAPONS.pulse_bolt.maxLevel;
  assert(availableEvolution(run) === null, 'needs the passive');
  run.passives.overclock = 1;
  const opts = buildCacheOptions(run);
  assert(opts.length === 1 && opts[0].kind === 'evolution', 'cache offers the evolution');
  applyOption(run, opts[0]);
  assert(w.evolved === 'singularity' && run.evolutions.includes('singularity'), 'weapon evolved');
});

console.log('\nEconomy & saves');
test('flux shown equals flux banked', () => {
  const summary = { time: 372, kills: 418, level: 14, bossKilled: false, fluxPickups: 9, loopKills: 40, paradoxes: 5, evolutions: [] };
  const flux = computeRunFlux(summary, 2);
  const save = new SaveSystem();
  save.save = () => {};
  const before = save.data.flux;
  save.recordRun({ ...summary, flux });
  assert(save.data.flux - before === flux, `banked ${save.data.flux - before}, shown ${flux}`);
});
test('v1 saves migrate with flux and refunds', () => {
  const v1 = {
    fluxCurrency: 40,
    upgrades: { phase_engine: 2, flux_magnet: 0, kinetic_pulse: 0, echo_stabilizer: 0 },
    unlockedSkins: ['cyan_default', 'synthwave', 'bogus'],
    selectedSkin: 'synthwave',
    stats: { totalRuns: 12 },
    highScore: 9000,
  };
  const s = migrateV1(v1);
  assert(s.flux === 40 + 20 + 36, `expected 96 flux, got ${s.flux}`);
  assert(s.unlockedSkins.includes('synthwave') && !s.unlockedSkins.includes('bogus'), 'known skins kept, unknown dropped');
  assert(s.selectedSkin === 'synthwave' && s.stats.runs === 12, 'skin and run count carried');
});
test('normalizeSave repairs partial or corrupt data', () => {
  const s = normalizeSave({ flux: -5, selectedCharacter: 'warden', stats: { runs: 3 } });
  assert(s.flux === 0, 'negative flux clamped');
  assert(s.selectedCharacter === 'cipher', 'locked character falls back');
  assert(s.stats.runs === 3 && s.stats.loopKills === 0, 'stats merged with defaults');
  assert(s.tips && s.tips.loop === false, 'tips default');
});
test('cloud vs local merge keeps the save with more progress', () => {
  const a = createDefaultSave(); a.stats.runs = 4;
  const b = createDefaultSave(); b.stats.runs = 9;
  assert(pickBestSave(a, b) === b && pickBestSave(b, a) === b, 'more runs wins');
  assert(pickBestSave(null, a) === a, 'null side ignored');
});
test('character unlocks trigger from stats', () => {
  const save = new SaveSystem();
  save.save = () => {};
  const { unlockedCharacters } = save.recordRun({ time: 320, kills: 10, loopKills: 0, paradoxes: 0, level: 5, bossKilled: false, flux: 0 });
  assert(unlockedCharacters.includes('warden'), 'warden unlocks at 5:00');
});

console.log('\nDeterminism & stability');
function botInput(run, i) {
  const a = i / 70;
  return { x: Math.cos(a), y: Math.sin(a * 1.3), dash: i % 240 === 0 };
}
function simulate(seed, seconds) {
  const run = new Run({ seed });
  for (let i = 0; i < seconds * 60 && !run.dead; i++) {
    run.update(DT, botInput(run, i));
    while (run.pendingLevelUps > 0) {
      run.pendingLevelUps--;
      applyOption(run, buildDraft(run, 3)[0]);
    }
    for (const ev of run.events) if (ev.type === 'cache') applyOption(run, ev.options[0]);
    run.events.length = 0;
  }
  return run;
}
test('same seed + same input = same result', () => {
  const a = simulate(77, 60), b = simulate(77, 60);
  assert(a.kills === b.kills && a.level === b.level && Math.abs(a.player.x - b.player.x) < 1e-6, 'runs diverged');
});
test('3-minute simulated run stays numerically sane', () => {
  const run = simulate(5, 180);
  assert(Number.isFinite(run.player.x) && Number.isFinite(run.player.hp), 'player state finite');
  assert(run.enemies.every(e => Number.isFinite(e.x) && Number.isFinite(e.hp)), 'enemy state finite');
  assert(run.enemies.length <= CONFIG.RUN.MAX_ENEMIES + 40, 'enemy cap respected');
  assert(run.kills > 0, 'bot killed something');
});

console.log(`\n${passed} passed, ${failed} failed\n`);
if (failed > 0) process.exitCode = 1;
