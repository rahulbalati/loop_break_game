// LOOP//BREAK - Permanent progression: Flux Lab nodes and cosmetic colorways.

export const LAB_NODES = [
  { id: 'hull', name: 'Reinforced Hull', desc: '+10 max health', baseCost: 30, costMult: 1.6, maxLevel: 5 },
  { id: 'might', name: 'Signal Gain', desc: '+6% damage', baseCost: 40, costMult: 1.65, maxLevel: 5 },
  { id: 'thrust', name: 'Thrusters', desc: '+4% move speed', baseCost: 35, costMult: 1.6, maxLevel: 5 },
  { id: 'reach', name: 'Wide Field', desc: '+12% pickup radius', baseCost: 25, costMult: 1.55, maxLevel: 5 },
  { id: 'greed', name: 'Flux Siphon', desc: '+10% Flux earned', baseCost: 50, costMult: 1.7, maxLevel: 5 },
  { id: 'reroll', name: 'Probability Engine', desc: '+1 upgrade reroll per run', baseCost: 60, costMult: 2.0, maxLevel: 3 },
];

export function labCost(node, level) {
  return Math.round(node.baseCost * Math.pow(node.costMult, level));
}

// Colorways carried over from v1 skins (same ids so old unlocks keep working)
export const SKINS = [
  { id: 'cyan_default', name: 'Default', cost: 0, color: null },
  { id: 'synthwave', name: 'Synthwave', cost: 50, color: '#ff3d9a' },
  { id: 'cyber_emerald', name: 'Emerald', cost: 100, color: '#3dffa8' },
  { id: 'solar_flare', name: 'Solar Flare', cost: 175, color: '#ff9a3d' },
  { id: 'void_ghost', name: 'Void Specter', cost: 300, color: '#f0f4ff' },
  // Exclusive: day 7 of the login streak
  { id: 'chrono', name: 'Chrono', cost: null, color: '#e8ff3a', exclusive: 'Day 7 login reward' },
];
