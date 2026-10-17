// LOOP//BREAK - Game Configuration & Balance Parameters

export const CONFIG = {
  // Dynamic Virtual Resolution System (adapts dynamically to any mobile or desktop screen)
  BASE_HEIGHT: 720,
  MIN_WIDTH: 960,
  MAX_WIDTH: 1920,

  // Player Specs
  PLAYER: {
    RADIUS: 16,
    BASE_SPEED: 320,
    BASE_HEALTH: 3,
    DASH_SPEED: 960,
    DASH_DURATION: 0.18, // seconds
    BASE_DASH_COOLDOWN: 1.25, // seconds
    BASE_MAGNET_RADIUS: 45,
    INVULNERABLE_DURATION: 1.0, // seconds on hit
  },

  // Pulse Ability Specs
  PULSE: {
    BASE_RADIUS: 175,
    BASE_COOLDOWN: 6.0,
    STUN_DURATION: 1.8, // seconds
    KNOCKBACK_FORCE: 450,
    DURATION: 0.25, // visual shockwave expansion
  },

  // Echo System Specs
  ECHO: {
    RECORD_FREQUENCY_HZ: 60,
    BASE_DELAY: 2.4, // seconds of movement recorded before ghost playback begins
    MAX_ECHOES: 2,
    COLOR: '#b026ff',
    TRAIL_ALPHA: 0.6,
    DANGER_DISTANCE: 40,
    DECOY_ATTRACT_RADIUS: 240, // distance within which enemies may get lured by echo
  },

  // Enemies Specs
  ENEMIES: {
    HUNTER: {
      RADIUS: 17,
      SPEED: 185,
      COLOR: '#ff2a5f',
      SHAPE: 'octagon',
      POINTS: 100,
    },
    INTERCEPTOR: {
      RADIUS: 16,
      SPEED: 215,
      COLOR: '#ff9900',
      SHAPE: 'triangle',
      PREDICTION_TIME: 0.7,
      POINTS: 150,
    },
    SENTINEL: {
      RADIUS: 20,
      SPEED: 110,
      COLOR: '#a855f7',
      SHAPE: 'diamond',
      SCAN_RADIUS: 160,
      POINTS: 200,
    }
  },

  // Shards & Portals
  SHARD: {
    RADIUS: 10,
    COLOR: '#ffd200',
    PULSE_SPEED: 4,
    POINTS: 50,
  },

  PORTAL: {
    RADIUS: 30,
    COLOR_LOCKED: '#3a3f58',
    COLOR_UNLOCKED: '#00ffaa',
    ROTATION_SPEED: 2.5,
  },

  // Combo & Scoring
  COMBO: {
    TIMEOUT: 4.0, // seconds between shard collections to maintain combo
    MAX_MULTIPLIER: 4.0,
    STEP: 0.5,
  },

  // Permanent Upgrades (Overclocks)
  UPGRADES: [
    {
      id: 'phase_engine',
      name: 'Phase Engine',
      description: 'Reduces Dash cooldown by 15% per tier',
      baseCost: 20,
      costMult: 1.8,
      maxLevel: 5,
      effect: (level) => 1 - level * 0.12, // multiplier on dash cooldown
    },
    {
      id: 'flux_magnet',
      name: 'Flux Magnet',
      description: 'Increases Shard collection radius by 25px per tier',
      baseCost: 15,
      costMult: 1.7,
      maxLevel: 5,
      effect: (level) => level * 28, // added to magnet radius
    },
    {
      id: 'kinetic_pulse',
      name: 'Kinetic Pulse',
      description: 'Increases Pulse radius & stun duration by 15%',
      baseCost: 25,
      costMult: 1.8,
      maxLevel: 5,
      effect: (level) => 1 + level * 0.15,
    },
    {
      id: 'echo_stabilizer',
      name: 'Echo Buffer',
      description: 'Adds +0.3s delay to your Echo, giving more room to maneuver',
      baseCost: 30,
      costMult: 2.0,
      maxLevel: 4,
      effect: (level) => level * 0.35, // added seconds to echo delay
    }
  ],

  // Unlockable Neon Skins
  SKINS: [
    {
      id: 'cyan_default',
      name: 'Cyber Cyan',
      cost: 0,
      color: '#00f0ff',
      glow: '#00b4d8',
      trail: 'rgba(0, 240, 255, 0.4)',
    },
    {
      id: 'synthwave',
      name: 'Synthwave Sunset',
      cost: 50,
      color: '#ff007f',
      glow: '#ffd200',
      trail: 'rgba(255, 0, 127, 0.4)',
    },
    {
      id: 'cyber_emerald',
      name: 'Cyber Emerald',
      cost: 100,
      color: '#00ffaa',
      glow: '#00cc88',
      trail: 'rgba(0, 255, 170, 0.4)',
    },
    {
      id: 'solar_flare',
      name: 'Solar Flare',
      cost: 175,
      color: '#ff7700',
      glow: '#ffcc00',
      trail: 'rgba(255, 119, 0, 0.4)',
    },
    {
      id: 'void_ghost',
      name: 'Void Specter',
      cost: 300,
      color: '#f0f4f8',
      glow: '#8b5cf6',
      trail: 'rgba(240, 244, 248, 0.5)',
    }
  ],

  // Visual Palette
  PALETTE: {
    BG_DARK: '#070814',
    GRID_LINE: 'rgba(30, 41, 79, 0.35)',
    WALL_BORDER: '#1e284a',
    WALL_GLOW: 'rgba(0, 240, 255, 0.2)',
    HAZARD_ZONE: 'rgba(255, 42, 95, 0.25)',
    TEXT_PRIMARY: '#e2e8f0',
    TEXT_ACCENT: '#00f0ff',
    SHIELD_ON: '#00ffaa',
    SHIELD_OFF: '#334155',
  }
};
