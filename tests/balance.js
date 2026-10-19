// LOOP//BREAK - Balance bot. Plays full runs headlessly with a simple kiting AI and reports pacing.
// Usage: npm run balance [-- runs=8 skill=0.6 character=cipher]
import { Run } from '../src/core/Run.js';
import { buildDraft, applyOption } from '../src/systems/DraftSystem.js';
import { computeRunFlux } from '../src/systems/Economy.js';
import { formatTime } from '../src/core/math.js';

const args = Object.fromEntries(process.argv.slice(2).map(a => a.split('=')));
const RUNS = Number(args.runs || 8);
const SKILL = Number(args.skill || 0.6); // 0 = wanders, 1 = kites well
const CHARACTER = args.character || 'cipher';
const STAGE = args.stage || 'neon_grid';
const LAB = args.lab ? JSON.parse(args.lab) : {};
const DT = 1 / 60;

// Kite away from nearby enemies, orbit when crowded (which also draws loops), drift toward gems.
function botInput(run, tick, rng, bot) {
  const p = run.player;
  // Loop mode: orbit the local enemy centroid long enough to close a loop around it
  if (bot.loopTicks > 0) {
    bot.loopTicks--;
    bot.angle += 0.035;
    const tx = bot.cx + Math.cos(bot.angle) * 105, ty = bot.cy + Math.sin(bot.angle) * 105;
    const dx = tx - p.x, dy = ty - p.y, l = Math.hypot(dx, dy) || 1;
    return { x: dx / l, y: dy / l, dash: false };
  }
  if (SKILL >= 0.5 && tick % 300 === 0) {
    let n = 0, sx = 0, sy = 0;
    for (const e of run.enemies) if ((e.x - p.x) ** 2 + (e.y - p.y) ** 2 < 220 * 220) { n++; sx += e.x; sy += e.y; }
    if (n >= 5) {
      bot.cx = sx / n; bot.cy = sy / n;
      bot.angle = Math.atan2(p.y - bot.cy, p.x - bot.cx);
      bot.loopTicks = 200;
    }
  }
  let ax = 0, ay = 0;
  for (const e of run.enemies) {
    const dx = p.x - e.x, dy = p.y - e.y;
    const d2 = dx * dx + dy * dy;
    if (d2 < 260 * 260 && d2 > 1) {
      const w = (e.boss || e.miniboss ? 4 : 1) / d2;
      ax += dx * w;
      ay += dy * w;
    }
  }
  // Telegraphed rifts are visible to players, so the bot steps out of them too
  for (const rf of run.rifts || []) {
    if (rf.warn <= 0) continue;
    const dx = p.x - rf.x, dy = p.y - rf.y;
    const d2 = dx * dx + dy * dy;
    if (d2 < (rf.r + 30) ** 2 && d2 > 1) { ax += (dx / d2) * 6; ay += (dy / d2) * 6; }
  }
  for (const b of run.bullets) {
    const dx = p.x - b.x, dy = p.y - b.y;
    const d2 = dx * dx + dy * dy;
    if (d2 < 140 * 140 && d2 > 1) { ax += (dx / d2) * 2; ay += (dy / d2) * 2; }
  }
  let mx, my;
  const threat = Math.hypot(ax, ay);
  let gem = null, gd = 320 * 320;
  for (const g of run.gems) {
    const d = (g.x - p.x) ** 2 + (g.y - p.y) ** 2;
    if (d < gd) { gd = d; gem = g; }
  }
  // Caches and heals matter more than gems
  for (const it of run.pickups) {
    const d = ((it.x - p.x) ** 2 + (it.y - p.y) ** 2) * 0.25;
    if (d < gd) { gd = d * 4; gem = it; }
  }
  if (threat > 1e-4) {
    const nx = ax / threat, ny = ay / threat;
    // Tangential component makes the bot circle, like a real player drawing loops
    mx = nx * 0.75 - ny * 0.65;
    my = ny * 0.75 + nx * 0.65;
    if (gem) {
      const gl = Math.sqrt(gd) || 1;
      mx += ((gem.x - p.x) / gl) * 0.6;
      my += ((gem.y - p.y) / gl) * 0.6;
    }
  } else {
    if (gem) { mx = gem.x - p.x; my = gem.y - p.y; }
    else { mx = Math.cos(tick / 90); my = Math.sin(tick / 90); }
  }
  // Lower skill = noisier, slower reactions
  if (rng() > SKILL) { mx += (rng() - 0.5) * 2; my += (rng() - 0.5) * 2; }
  const len = Math.hypot(mx, my) || 1;
  const dash = threat > 0.02 && p.dashCd <= 0 && rng() < SKILL * 0.15;
  return { x: mx / len, y: my / len, dash };
}

function pick(run, options) {
  // Prefer upgrading what we own, then echoes, then new weapons
  const score = (o) => (o.kind === 'evolution' ? 100 : 0) + (o.id === 'temporal_fork' ? 8 : 0) + (!o.isNew ? 5 : 0) + (o.kind === 'weapon' ? 3 : 0) + (o.kind === 'heal' && run.player.hp < run.stats.maxHp * 0.5 ? 20 : 0);
  return options.slice().sort((a, b) => score(b) - score(a))[0];
}

function play(seed) {
  const run = new Run({ seed, characterId: CHARACTER, lab: LAB, stageId: STAGE });
  let rngState = seed * 7919;
  const rng = () => ((rngState = (rngState * 1103515245 + 12345) % 2147483648) / 2147483648);
  const marks = {};
  let revived = false;
  const bot = { loopTicks: 0, angle: 0, cx: 0, cy: 0 };
  const maxTicks = 14 * 60 * 60;
  for (let tick = 0; tick < maxTicks; tick++) {
    run.update(DT, botInput(run, tick, rng, bot));
    if (tick === 540 * 60) marks.dmg540 = run.damageDealt;
    if (tick === 600 * 60) marks.dps = (run.damageDealt - marks.dmg540) / 60;
    while (run.pendingLevelUps > 0) {
      run.pendingLevelUps--;
      applyOption(run, pick(run, buildDraft(run, 3)));
      for (const L of [2, 5, 10, 15, 20, 25]) if (run.level >= L && !marks[`lv${L}`]) marks[`lv${L}`] = run.time;
    }
    for (const ev of run.events) {
      if (ev.type === 'cache') applyOption(run, pick(run, ev.options));
      if (ev.type === 'boss') { marks.boss = run.time; marks.dmgAtBoss = run.damageDealt; }
      if (ev.type === 'bossDefeated') marks.bossDown = run.time;
    }
    run.events.length = 0;
    if (run.dead) {
      if (!revived && SKILL >= 0.5) { revived = true; marks.revive = run.time; run.revive(); continue; }
      break;
    }
  }
  const s = run.summary();
  return { ...s, marks, flux: computeRunFlux(s, 0), evolved: s.evolutions.length };
}

const results = [];
const t0 = Date.now();
for (let i = 0; i < RUNS; i++) {
  const r = play(1000 + i * 31);
  results.push(r);
  console.log(
    `run ${String(i + 1).padStart(2)}  died ${formatTime(r.time)}  lv ${String(r.level).padStart(2)}  kills ${String(r.kills).padStart(5)}  loops ${String(r.loopKills).padStart(4)}  paradox ${String(r.paradoxes).padStart(3)}  flux ${String(r.flux).padStart(4)}  evo ${r.evolved}` +
    `  ${r.marks.revive ? `revive@${formatTime(r.marks.revive)}` : ''} ${r.marks.bossDown ? `BOSS@${formatTime(r.marks.bossDown)}` : r.marks.boss ? 'boss-reached' : ''}`
  );
}
const avg = (f) => results.reduce((a, r) => a + f(r), 0) / results.length;
const med = (f) => { const v = results.map(f).sort((a, b) => a - b); return v[Math.floor(v.length / 2)]; };
console.log('\n--- summary ---');
console.log(`skill ${SKILL}  character ${CHARACTER}  stage ${STAGE}  (${((Date.now() - t0) / 1000).toFixed(1)}s)`);
console.log(`median death ${formatTime(med(r => r.time))}   mean ${formatTime(avg(r => r.time))}`);
for (const L of [2, 5, 10, 15, 20]) {
  const hit = results.filter(r => r.marks[`lv${L}`] !== undefined);
  if (hit.length) console.log(`level ${String(L).padStart(2)} reached by ${hit.length}/${results.length} at ~${formatTime(hit.reduce((a, r) => a + r.marks[`lv${L}`], 0) / hit.length)}`);
}
console.log(`boss reached ${results.filter(r => r.marks.boss).length}/${results.length}, defeated ${results.filter(r => r.marks.bossDown).length}/${results.length}`);
const dpsRuns = results.filter(r => r.marks.dps);
if (dpsRuns.length) console.log(`DPS in minute 10: ${dpsRuns.map(r => Math.round(r.marks.dps)).join(', ')}`);
console.log(`avg flux per run ${avg(r => r.flux).toFixed(0)}, avg loop kills ${avg(r => r.loopKills).toFixed(0)}, avg paradoxes ${avg(r => r.paradoxes).toFixed(0)}`);
