// LOOP//BREAK - Stage definitions: continuous spawn segments plus scripted events.

export const STAGES = [
  {
    id: 'neon_grid',
    index: 1,
    name: 'NEON GRID',
    subtitle: 'Where every loop begins',
    duration: 600, // boss arrives here
    fluxMult: 1,
    unlock: null,
    palette: { grid: 'rgba(120, 92, 255, 0.10)', major: 'rgba(120, 92, 255, 0.24)', glow: '#7a5cff', band: '122,92,255' },
    // HP multiplier as a function of elapsed seconds
    hpScale: (t) => 1 + (t / 60) * 0.3 + (t > 600 ? Math.pow((t - 600) / 60, 1.6) * 0.6 : 0),
    segments: [
      { from: 0, to: 30, rate: 1.0, mix: { drone: 1 } },
      { from: 30, to: 60, rate: 1.5, mix: { drone: 1 } },
      { from: 60, to: 120, rate: 2.0, mix: { drone: 0.7, swarmer: 0.3 } },
      { from: 120, to: 180, rate: 2.5, mix: { drone: 0.5, swarmer: 0.3, splitter: 0.2 } },
      { from: 180, to: 240, rate: 2.9, mix: { drone: 0.4, swarmer: 0.25, splitter: 0.15, shooter: 0.2 } },
      { from: 240, to: 300, rate: 3.3, mix: { drone: 0.3, swarmer: 0.25, brute: 0.15, shooter: 0.12, charger: 0.18 } },
      { from: 300, to: 360, rate: 3.8, mix: { drone: 0.25, swarmer: 0.2, brute: 0.15, charger: 0.15, eater: 0.15, shooter: 0.1 } },
      { from: 360, to: 450, rate: 4.4, mix: { swarmer: 0.25, brute: 0.2, splitter: 0.15, charger: 0.15, eater: 0.15, shooter: 0.1 } },
      { from: 450, to: 540, rate: 5.2, mix: { swarmer: 0.3, brute: 0.25, charger: 0.15, eater: 0.15, shooter: 0.15 } },
      { from: 540, to: 600, rate: 6.0, mix: { swarmer: 0.3, brute: 0.3, splitter: 0.1, charger: 0.15, eater: 0.15 } },
      { from: 600, to: 99999, rate: 2.2, mix: { swarmer: 0.5, brute: 0.3, charger: 0.2 }, overtimeRamp: 0.05 },
    ],
    events: [
      { t: 45, type: 'ring', enemy: 'drone', count: 14 },
      { t: 100, type: 'elite', enemy: 'brute' },
      { t: 150, type: 'miniboss', enemy: 'sentinel' },
      { t: 210, type: 'rush', enemy: 'swarmer', count: 28 },
      { t: 260, type: 'elite', enemy: 'charger' },
      { t: 300, type: 'miniboss', enemy: 'sentinel' },
      { t: 360, type: 'ring', enemy: 'swarmer', count: 26 },
      { t: 410, type: 'elite', enemy: 'eater' },
      { t: 450, type: 'miniboss', enemy: 'sentinel' },
      { t: 510, type: 'ring', enemy: 'brute', count: 14 },
      { t: 560, type: 'elite', enemy: 'brute' },
      { t: 600, type: 'boss', enemy: 'loopkeeper' },
    ],
  },
  {
    id: 'glitch_ruins',
    index: 2,
    name: 'GLITCH RUINS',
    subtitle: 'The loop is breaking apart',
    duration: 600,
    fluxMult: 1.5,
    unlock: { label: 'Survive 7:00 or defeat the Loopkeeper in Neon Grid' },
    palette: { grid: 'rgba(61, 255, 208, 0.08)', major: 'rgba(255, 61, 110, 0.20)', glow: '#3dffd0', band: '61,255,208' },
    hpScale: (t) => 1.2 + (t / 60) * 0.34 + (t > 600 ? Math.pow((t - 600) / 60, 1.6) * 0.7 : 0),
    // Telegraphed strikes that hit everything inside them: dodge them, or drag enemies into them
    rifts: { from: 20, every: 6.5, count: 2, countGrowth: 1 / 120, radius: 78, warn: 1.3, damage: 18, enemyDamage: 140 },
    segments: [
      { from: 0, to: 30, rate: 1.3, mix: { drone: 0.7, swarmer: 0.3 } },
      { from: 30, to: 90, rate: 2.0, mix: { drone: 0.5, swarmer: 0.3, shooter: 0.2 } },
      { from: 90, to: 180, rate: 2.7, mix: { swarmer: 0.35, splitter: 0.2, shooter: 0.2, charger: 0.25 } },
      { from: 180, to: 300, rate: 3.4, mix: { swarmer: 0.3, brute: 0.15, charger: 0.2, eater: 0.2, shooter: 0.15 } },
      { from: 300, to: 420, rate: 4.2, mix: { swarmer: 0.3, brute: 0.2, splitter: 0.1, charger: 0.15, eater: 0.25 } },
      { from: 420, to: 540, rate: 5.0, mix: { swarmer: 0.3, brute: 0.25, charger: 0.2, eater: 0.25 } },
      { from: 540, to: 600, rate: 5.8, mix: { swarmer: 0.3, brute: 0.3, charger: 0.2, eater: 0.2 } },
      { from: 600, to: 99999, rate: 2.6, mix: { swarmer: 0.4, brute: 0.35, eater: 0.25 }, overtimeRamp: 0.06 },
    ],
    events: [
      { t: 40, type: 'rush', enemy: 'swarmer', count: 22 },
      { t: 90, type: 'elite', enemy: 'charger' },
      { t: 140, type: 'miniboss', enemy: 'sentinel' },
      { t: 200, type: 'ring', enemy: 'splitter', count: 12 },
      { t: 250, type: 'elite', enemy: 'eater' },
      { t: 290, type: 'miniboss', enemy: 'sentinel' },
      { t: 350, type: 'rush', enemy: 'charger', count: 12 },
      { t: 400, type: 'elite', enemy: 'brute' },
      { t: 440, type: 'miniboss', enemy: 'sentinel' },
      { t: 500, type: 'ring', enemy: 'eater', count: 12 },
      { t: 550, type: 'elite', enemy: 'charger' },
      { t: 600, type: 'boss', enemy: 'fracture' },
    ],
  },
];

export function isStageUnlocked(stage, save) {
  if (!stage.unlock) return true;
  return save.unlockedStages && save.unlockedStages.includes(stage.id);
}

export function getStage(id) {
  return STAGES.find(s => s.id === id) || STAGES[0];
}
