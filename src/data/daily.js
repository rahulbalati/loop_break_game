// LOOP//BREAK - Daily content: login streak rewards and the mission pool.

// Cycle of 7. Day 7 grants an exclusive colorway the first time (Flux afterwards).
export const STREAK_REWARDS = [
  { day: 1, flux: 20 },
  { day: 2, flux: 30 },
  { day: 3, flux: 40 },
  { day: 4, flux: 55 },
  { day: 5, flux: 70 },
  { day: 6, flux: 90 },
  { day: 7, flux: 120, skin: 'chrono' },
];

export function streakReward(count) {
  return STREAK_REWARDS[(Math.max(1, count) - 1) % STREAK_REWARDS.length];
}

// mode 'sum' accumulates across the day's runs; 'best' is a single-run record.
// `targets` are easy / medium / hard; each day draws one of each tier.
export const MISSIONS = [
  { id: 'kills', mode: 'sum', stat: 'kills', targets: [250, 550, 1000], label: (n) => `Destroy ${n} enemies` },
  { id: 'loops', mode: 'sum', stat: 'loopKills', targets: [12, 35, 80], label: (n) => `Capture ${n} enemies inside loops` },
  { id: 'paradox', mode: 'sum', stat: 'paradoxes', targets: [8, 25, 50], label: (n) => `Trigger ${n} paradox blasts` },
  { id: 'survive', mode: 'best', stat: 'time', targets: [150, 300, 450], label: (n) => `Survive ${fmt(n)} in one run` },
  { id: 'level', mode: 'best', stat: 'level', targets: [10, 16, 22], label: (n) => `Reach level ${n} in one run` },
  { id: 'elites', mode: 'sum', stat: 'elites', targets: [2, 4, 7], label: (n) => `Defeat ${n} elites or minibosses` },
  { id: 'caches', mode: 'sum', stat: 'caches', targets: [2, 4, 6], label: (n) => `Open ${n} data caches` },
  { id: 'runs', mode: 'sum', stat: 'runs', targets: [2, 3, 5], label: (n) => `Play ${n} runs` },
  { id: 'ruins', mode: 'best', stat: 'ruinsTime', targets: [90, 180, 300], label: (n) => `Survive ${fmt(n)} in Glitch Ruins`, requiresStage: 'glitch_ruins' },
];

export const MISSION_REWARDS = [25, 45, 70];
export const ALL_MISSIONS_BONUS = 60;

function fmt(s) {
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}
