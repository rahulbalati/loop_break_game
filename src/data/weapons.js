// LOOP//BREAK - Weapon & evolution definitions. Every emitter (player + each echo) fires every weapon.

// Builds a per-level stat table from base stats and a list of [description, mutator] steps.
function buildLevels(base, steps) {
  const levels = [{ ...base }];
  const descs = [null];
  for (const [desc, mutate] of steps) {
    const next = { ...levels[levels.length - 1] };
    mutate(next);
    levels.push(next);
    descs.push(desc);
  }
  return { levels, descs };
}

const pulseBolt = buildLevels(
  { damage: 11, cooldown: 0.85, count: 1, pierce: 0, speed: 560, size: 5, spread: 0.18 },
  [
    ['+1 bolt', s => { s.count += 1; }],
    ['+30% damage', s => { s.damage *= 1.3; }],
    ['-15% cooldown', s => { s.cooldown *= 0.85; }],
    ['+1 pierce', s => { s.pierce += 1; }],
    ['+1 bolt', s => { s.count += 1; }],
    ['+30% damage', s => { s.damage *= 1.3; }],
    ['+1 bolt, +1 pierce', s => { s.count += 1; s.pierce += 1; }],
  ]
);

const orbit = buildLevels(
  { damage: 9, count: 2, radius: 64, spin: 3.2, size: 8, hitCooldown: 0.45 },
  [
    ['+1 shard', s => { s.count += 1; }],
    ['+25% damage, +10% radius', s => { s.damage *= 1.25; s.radius *= 1.1; }],
    ['+1 shard', s => { s.count += 1; }],
    ['+20% spin speed', s => { s.spin *= 1.2; }],
    ['+1 shard', s => { s.count += 1; }],
    ['+30% damage', s => { s.damage *= 1.3; }],
    ['+1 shard, +15% radius', s => { s.count += 1; s.radius *= 1.15; }],
  ]
);

const nova = buildLevels(
  { damage: 16, cooldown: 2.6, radius: 120, knockback: 260 },
  [
    ['+20% radius', s => { s.radius *= 1.2; }],
    ['+30% damage', s => { s.damage *= 1.3; }],
    ['-15% cooldown', s => { s.cooldown *= 0.85; }],
    ['+20% radius', s => { s.radius *= 1.2; }],
    ['+30% damage', s => { s.damage *= 1.3; }],
    ['-15% cooldown', s => { s.cooldown *= 0.85; }],
    ['+40% damage', s => { s.damage *= 1.4; }],
  ]
);

const arc = buildLevels(
  { damage: 13, cooldown: 1.5, chains: 2, range: 260, jump: 150 },
  [
    ['+1 chain', s => { s.chains += 1; }],
    ['+25% damage', s => { s.damage *= 1.25; }],
    ['-15% cooldown', s => { s.cooldown *= 0.85; }],
    ['+2 chains', s => { s.chains += 2; }],
    ['+25% damage', s => { s.damage *= 1.25; }],
    ['-15% cooldown', s => { s.cooldown *= 0.85; }],
    ['+2 chains, +30% damage', s => { s.chains += 2; s.damage *= 1.3; }],
  ]
);

const mine = buildLevels(
  { damage: 26, cooldown: 1.3, radius: 62, life: 7 },
  [
    ['+20% blast radius', s => { s.radius *= 1.2; }],
    ['+30% damage', s => { s.damage *= 1.3; }],
    ['-20% cooldown', s => { s.cooldown *= 0.8; }],
    ['+20% blast radius', s => { s.radius *= 1.2; }],
    ['+30% damage', s => { s.damage *= 1.3; }],
    ['-20% cooldown', s => { s.cooldown *= 0.8; }],
    ['+40% damage', s => { s.damage *= 1.4; }],
  ]
);

const lance = buildLevels(
  { damage: 20, cooldown: 1.7, length: 270, width: 16 },
  [
    ['+20% length', s => { s.length *= 1.2; }],
    ['+30% damage', s => { s.damage *= 1.3; }],
    ['-15% cooldown', s => { s.cooldown *= 0.85; }],
    ['+40% width', s => { s.width *= 1.4; }],
    ['+30% damage', s => { s.damage *= 1.3; }],
    ['-15% cooldown', s => { s.cooldown *= 0.85; }],
    ['+25% length, +30% damage', s => { s.length *= 1.25; s.damage *= 1.3; }],
  ]
);

export const WEAPONS = {
  pulse_bolt: {
    id: 'pulse_bolt', name: 'Pulse Bolt', color: '#3df5ff', maxLevel: 8,
    desc: 'Fires a bolt at the nearest enemy.',
    ...pulseBolt,
  },
  orbit: {
    id: 'orbit', name: 'Orbit Shards', color: '#7dff6a', maxLevel: 8,
    desc: 'Shards circle you and every echo, shredding anything they touch.',
    ...orbit,
  },
  nova: {
    id: 'nova', name: 'Nova Ring', color: '#ff5cf0', maxLevel: 8,
    desc: 'Emits a shockwave that damages and pushes enemies away.',
    ...nova,
  },
  arc: {
    id: 'arc', name: 'Arc Chain', color: '#9ad7ff', maxLevel: 8,
    desc: 'Lightning strikes an enemy and jumps to others nearby.',
    ...arc,
  },
  mine: {
    id: 'mine', name: 'Trail Mines', color: '#ffc83d', maxLevel: 8,
    desc: 'Drops mines along your path. Echoes drop them too.',
    ...mine,
  },
  lance: {
    id: 'lance', name: 'Prism Lance', color: '#e8ff3a', maxLevel: 8,
    desc: 'Pierces everything in the direction you move.',
    ...lance,
  },
};

// Evolutions: max level weapon + required passive, offered from caches (chests).
export const EVOLUTIONS = {
  singularity: {
    id: 'singularity', name: 'Singularity Bolt', from: 'pulse_bolt', requires: 'overclock',
    color: '#3df5ff',
    desc: 'Bolts pierce everything and collapse into micro black holes.',
    stats: { damage: 34, cooldown: 0.55, count: 4, pierce: 999, speed: 620, size: 7, spread: 0.22, blastRadius: 48 },
  },
  event_horizon: {
    id: 'event_horizon', name: 'Event Horizon', from: 'orbit', requires: 'temporal_fork',
    color: '#7dff6a',
    desc: 'Eight shards on a breathing orbit. Every echo carries a full ring.',
    stats: { damage: 30, count: 8, radius: 96, spin: 4.4, size: 10, hitCooldown: 0.3, breathe: 34 },
  },
};

export function weaponStats(id, level, evolvedId = null) {
  if (evolvedId && EVOLUTIONS[evolvedId]) return EVOLUTIONS[evolvedId].stats;
  const w = WEAPONS[id];
  return w.levels[Math.max(0, Math.min(w.levels.length - 1, level - 1))];
}
