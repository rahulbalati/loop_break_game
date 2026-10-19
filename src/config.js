// LOOP//BREAK - Global tuning constants. Content (weapons, enemies, stages) lives in src/data/.

export const CONFIG = {
  // Virtual resolution: height adapts between these bounds so small iframes (800x450) stay readable
  MIN_VIRTUAL_HEIGHT: 560,
  MAX_VIRTUAL_HEIGHT: 720,
  FIXED_DT: 1 / 60,

  PLAYER: {
    RADIUS: 14,
    ACCEL: 14, // velocity smoothing factor
    INVULN_TIME: 0.55,
    DASH_SPEED: 860,
    DASH_TIME: 0.16,
    DASH_COOLDOWN: 1.6,
    BASE_MAGNET: 120,
  },

  ECHO: {
    HISTORY_SECONDS: 12,
    HISTORY_HZ: 60,
    FIRST_DELAY: 1.5,
    SPACING: 1.05,
    RADIUS: 13,
    MAX: 5,
    PARADOX_COOLDOWN: 5.5,
    PARADOX_RADIUS: 105,
    PARADOX_DAMAGE: 55,
  },

  LOOP: {
    TRAIL_SECONDS: 3.4,
    SAMPLE_DIST: 9,
    MIN_AREA: 4200,
    COOLDOWN: 0.3,
    ELITE_DAMAGE_PCT: 0.35,
    BOSS_DAMAGE_PCT: 0.04,
  },

  RUN: {
    MAX_WEAPONS: 5,
    MAX_PASSIVES: 5,
    MAX_ENEMIES: 280,
    MAX_GEMS: 320,
    REVIVES: 1,
  },

  // Midgame ads are only requested at natural breaks and never more often than this
  MIN_SECONDS_BETWEEN_MIDGAME_ADS: 150,

  COLORS: {
    BG: '#07060d',
    GRID: 'rgba(120, 92, 255, 0.10)',
    GRID_MAJOR: 'rgba(120, 92, 255, 0.22)',
    PLAYER: '#3df5ff',
    ECHO: '#a873ff',
    ECHO_CHARGED: '#f2e9ff',
    TRAIL: '#a873ff',
    ENEMY_BULLET: '#ff5577',
    XP_SMALL: '#3df5ff',
    XP_MED: '#7dff6a',
    XP_LARGE: '#ff5cf0',
    FLUX: '#ffc83d',
    HEAL: '#ff4d6d',
  },
};

// XP required to go from `level` to `level + 1`
export function xpForLevel(level) {
  if (level <= 1) return 4;
  const late = level > 25 ? Math.pow(level - 25, 2) * 0.9 : 0; // keeps late drafts from becoming constant
  return Math.round(4 + (level - 1) * 2.4 + Math.pow(level - 1, 1.75) * 0.3 + late);
}
