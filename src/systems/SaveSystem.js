// LOOP//BREAK - Safe Persistent Local Storage & Progression Manager

const SAVE_KEY = 'loopbreak_save_data_v1';

const DEFAULT_SAVE_DATA = {
  highScore: 0,
  highestLevel: 1,
  totalShardsCollected: 0,
  successfulEscapes: 0,
  fluxCurrency: 0, // In-game currency earned from shards & level completes
  selectedSkin: 'cyan_default',
  unlockedSkins: ['cyan_default'],
  upgrades: {
    phase_engine: 0,
    flux_magnet: 0,
    kinetic_pulse: 0,
    echo_stabilizer: 0,
  },
  settings: {
    sfx: true,
    bgm: true,
    screenShake: true,
  },
  stats: {
    totalRuns: 0,
    bestCombo: 1,
    bestSurvivalTime: 0,
  }
};

export class SaveSystem {
  constructor() {
    this.data = this.load();
  }

  load() {
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      if (!raw) return { ...DEFAULT_SAVE_DATA };
      const parsed = JSON.parse(raw);
      // Validate schema & merge defaults
      return {
        ...DEFAULT_SAVE_DATA,
        ...parsed,
        upgrades: { ...DEFAULT_SAVE_DATA.upgrades, ...(parsed.upgrades || {}) },
        settings: { ...DEFAULT_SAVE_DATA.settings, ...(parsed.settings || {}) },
        stats: { ...DEFAULT_SAVE_DATA.stats, ...(parsed.stats || {}) },
        unlockedSkins: Array.isArray(parsed.unlockedSkins) && parsed.unlockedSkins.length > 0
          ? parsed.unlockedSkins
          : ['cyan_default'],
      };
    } catch (e) {
      console.warn('Could not read localStorage, using default state', e);
      return { ...DEFAULT_SAVE_DATA };
    }
  }

  save() {
    try {
      localStorage.setItem(SAVE_KEY, JSON.stringify(this.data));
    } catch (e) {
      console.warn('Could not save to localStorage', e);
    }
  }

  recordRunResult({ score, level, shardsCollected, combo, timeSurvived, escaped }) {
    this.data.stats.totalRuns++;
    this.data.totalShardsCollected += shardsCollected;
    this.data.fluxCurrency += shardsCollected + (escaped ? level * 5 : 0);

    if (score > this.data.highScore) {
      this.data.highScore = score;
    }
    if (level > this.data.highestLevel) {
      this.data.highestLevel = level;
    }
    if (combo > (this.data.stats.bestCombo || 1)) {
      this.data.stats.bestCombo = combo;
    }
    if (timeSurvived > (this.data.stats.bestSurvivalTime || 0)) {
      this.data.stats.bestSurvivalTime = Math.floor(timeSurvived);
    }
    if (escaped) {
      this.data.successfulEscapes++;
    }

    this.save();
  }

  getUpgradeLevel(upgradeId) {
    return this.data.upgrades[upgradeId] || 0;
  }

  purchaseUpgrade(upgradeId, cost) {
    if (this.data.fluxCurrency >= cost) {
      this.data.fluxCurrency -= cost;
      this.data.upgrades[upgradeId] = (this.data.upgrades[upgradeId] || 0) + 1;
      this.save();
      return true;
    }
    return false;
  }

  unlockSkin(skinId, cost) {
    if (this.data.unlockedSkins.includes(skinId)) return true;
    if (this.data.fluxCurrency >= cost) {
      this.data.fluxCurrency -= cost;
      this.data.unlockedSkins.push(skinId);
      this.save();
      return true;
    }
    return false;
  }

  selectSkin(skinId) {
    if (this.data.unlockedSkins.includes(skinId)) {
      this.data.selectedSkin = skinId;
      this.save();
      return true;
    }
    return false;
  }

  updateSettings(settings) {
    this.data.settings = { ...this.data.settings, ...settings };
    this.save();
  }
}

export const saveSystem = new SaveSystem();
