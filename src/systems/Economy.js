// LOOP//BREAK - Single source of truth for Flux rewards. The results screen and the save both use this.

export function computeRunFlux({ time, kills, level, bossKilled, fluxPickups }, greedLevel = 0, multiplier = 1) {
  const base =
    Math.floor(time / 60) * 6 + // 6 per full minute survived
    Math.floor(kills / 20) + // 1 per 20 kills
    level * 2 + // 2 per level reached
    (bossKilled ? 120 : 0) +
    (fluxPickups || 0);
  return Math.floor(base * (1 + 0.1 * greedLevel) * multiplier);
}
