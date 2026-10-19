// LOOP//BREAK - Playable "Loopers". Each one changes how their echoes behave.

export const CHARACTERS = [
  {
    id: 'cipher',
    name: 'CIPHER',
    title: 'The First Loop',
    color: '#3df5ff',
    startWeapon: 'pulse_bolt',
    hp: 100,
    speed: 215,
    trait: 'Echoes fire your weapons at 60% power.',
    mods: { echoDamage: 0.6 },
    unlock: null,
  },
  {
    id: 'swarm',
    name: 'SWARM',
    title: 'Many Hands',
    color: '#7dff6a',
    startWeapon: 'orbit',
    hp: 85,
    speed: 228,
    trait: 'Starts with 2 echoes, but they hit at 40% power.',
    mods: { echoDamage: 0.4, startEchoes: 1 },
    unlock: { stat: 'loopKills', target: 150, label: 'Capture 150 enemies inside loops' },
  },
  {
    id: 'warden',
    name: 'WARDEN',
    title: 'Paradox Engine',
    color: '#ffc83d',
    startWeapon: 'nova',
    hp: 130,
    speed: 200,
    trait: 'Paradox blasts recharge 40% faster and hit 60% harder.',
    mods: { echoDamage: 0.55, paradoxCooldownMult: 0.6, paradoxDamageMult: 1.6 },
    unlock: { stat: 'bestTime', target: 300, label: 'Survive 5:00 in a single run' },
  },
];

export function getCharacter(id) {
  return CHARACTERS.find(c => c.id === id) || CHARACTERS[0];
}
