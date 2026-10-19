// LOOP//BREAK - Level-up drafts and cache (chest) rewards.
import { CONFIG } from '../config.js';
import { WEAPONS, EVOLUTIONS } from '../data/weapons.js';
import { PASSIVES } from '../data/passives.js';

function weaponOption(run, id) {
  const def = WEAPONS[id];
  const owned = run.weapons.find(w => w.id === id);
  const from = owned ? owned.level : 0;
  return {
    kind: 'weapon', id, icon: id, name: def.name, color: def.color,
    levelFrom: from, levelTo: from + 1, isNew: !owned,
    desc: owned ? def.descs[from] : def.desc,
  };
}

function passiveOption(run, id) {
  const def = PASSIVES[id];
  const from = run.passives[id] || 0;
  return {
    kind: 'passive', id, icon: id, name: def.name, color: def.color,
    levelFrom: from, levelTo: from + 1, isNew: from === 0, desc: def.desc,
  };
}

// Every option the run could currently take, with a draft weight.
export function candidateOptions(run) {
  const out = [];
  const weaponSlotsFree = run.weapons.length < CONFIG.RUN.MAX_WEAPONS;
  for (const id of Object.keys(WEAPONS)) {
    const owned = run.weapons.find(w => w.id === id);
    if (owned) {
      if (!owned.evolved && owned.level < WEAPONS[id].maxLevel) out.push({ opt: weaponOption(run, id), w: 1.5 });
    } else if (weaponSlotsFree) {
      out.push({ opt: weaponOption(run, id), w: 1.0 });
    }
  }
  const ownedPassives = Object.keys(run.passives).filter(id => run.passives[id] > 0).length;
  for (const id of Object.keys(PASSIVES)) {
    const lvl = run.passives[id] || 0;
    if (lvl >= PASSIVES[id].maxLevel) continue;
    if (lvl === 0 && ownedPassives >= CONFIG.RUN.MAX_PASSIVES) continue;
    // Echoes are the signature mechanic, so Temporal Fork shows up more often
    out.push({ opt: passiveOption(run, id), w: id === 'temporal_fork' ? 1.6 : lvl > 0 ? 1.3 : 0.9 });
  }
  return out;
}

export function fillerOptions() {
  return [
    { kind: 'heal', id: 'heal', icon: 'heal', name: 'Patch Kit', color: '#ff4d6d', desc: 'Restore 40% health.', isNew: false },
    { kind: 'flux', id: 'flux', icon: 'flux', name: 'Flux Cache', color: '#ffc83d', desc: '+25 Flux, banked when the run ends.', isNew: false },
  ];
}

export function buildDraft(run, count = 3) {
  const pool = candidateOptions(run);
  const picks = [];
  while (picks.length < count && pool.length > 0) {
    let total = 0;
    for (const c of pool) total += c.w;
    let r = run.rng() * total;
    let idx = 0;
    for (; idx < pool.length; idx++) {
      r -= pool[idx].w;
      if (r <= 0) break;
    }
    idx = Math.min(idx, pool.length - 1);
    picks.push(pool[idx].opt);
    pool.splice(idx, 1);
  }
  const fillers = fillerOptions();
  while (picks.length < count && fillers.length > 0) picks.push(fillers.shift());
  return picks;
}

export function availableEvolution(run) {
  for (const evo of Object.values(EVOLUTIONS)) {
    const w = run.weapons.find(x => x.id === evo.from);
    if (w && !w.evolved && w.level >= WEAPONS[evo.from].maxLevel && (run.passives[evo.requires] || 0) > 0) {
      return evo;
    }
  }
  return null;
}

export function buildCacheOptions(run) {
  const evo = availableEvolution(run);
  if (evo) {
    return [{
      kind: 'evolution', id: evo.id, icon: evo.id, name: evo.name, color: evo.color,
      desc: evo.desc, isNew: true, from: evo.from,
    }];
  }
  return buildDraft(run, 3);
}

export function applyOption(run, opt) {
  switch (opt.kind) {
    case 'weapon': {
      const owned = run.weapons.find(w => w.id === opt.id);
      if (owned) owned.level += 1;
      else run.addWeapon(opt.id);
      break;
    }
    case 'passive':
      run.passives[opt.id] = (run.passives[opt.id] || 0) + 1;
      break;
    case 'evolution': {
      const w = run.weapons.find(x => x.id === opt.from);
      if (w) {
        w.evolved = opt.id;
        run.evolutions.push(opt.id);
      }
      break;
    }
    case 'heal':
      run.player.hp = Math.min(run.stats.maxHp, run.player.hp + run.stats.maxHp * 0.4);
      break;
    case 'flux':
      run.fluxPickups += 25;
      break;
  }
  run.recomputeStats();
}
