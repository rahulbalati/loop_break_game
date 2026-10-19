// LOOP//BREAK - In-run passive upgrades. `apply` mutates the run's stat block per level owned.

export const PASSIVES = {
  vitality: {
    id: 'vitality', name: 'Vital Core', color: '#ff4d6d', maxLevel: 5,
    desc: '+20 max health and heal 20.',
    apply: (s, lvl) => { s.maxHpBonus += 20 * lvl; },
  },
  overclock: {
    id: 'overclock', name: 'Overclock', color: '#3df5ff', maxLevel: 5,
    desc: 'Weapons fire 8% faster.',
    apply: (s, lvl) => { s.cooldownMult *= Math.pow(0.92, lvl); },
  },
  amplifier: {
    id: 'amplifier', name: 'Amplifier', color: '#ff5cf0', maxLevel: 5,
    desc: '+12% damage for you and your echoes.',
    apply: (s, lvl) => { s.damageMult *= 1 + 0.12 * lvl; },
  },
  magnet: {
    id: 'magnet', name: 'Flux Magnet', color: '#7dff6a', maxLevel: 5,
    desc: '+35% pickup radius.',
    apply: (s, lvl) => { s.magnetMult *= 1 + 0.35 * lvl; },
  },
  velocity: {
    id: 'velocity', name: 'Velocity', color: '#e8ff3a', maxLevel: 5,
    desc: '+8% move speed.',
    apply: (s, lvl) => { s.speedMult *= 1 + 0.08 * lvl; },
  },
  temporal_fork: {
    id: 'temporal_fork', name: 'Temporal Fork', color: '#a873ff', maxLevel: 3,
    desc: '+1 echo. Every echo fires all of your weapons.',
    apply: (s, lvl) => { s.echoCount += lvl; },
  },
  long_exposure: {
    id: 'long_exposure', name: 'Long Exposure', color: '#c9b3ff', maxLevel: 4,
    desc: 'Your loop trail lasts 22% longer and paradoxes recharge faster.',
    apply: (s, lvl) => { s.trailMult *= 1 + 0.22 * lvl; s.paradoxCooldownMult *= Math.pow(0.88, lvl); },
  },
};
