// LOOP//BREAK - Versioned save data: CrazyGames cloud save + localStorage, merged on boot.
import { platform } from './CrazyGamesSDK.js';
import { CHARACTERS } from '../data/characters.js';
import { LAB_NODES, labCost, SKINS } from '../data/meta.js';
import { STAGES } from '../data/stages.js';
import * as Daily from './DailySystem.js';

const STAGE2_UNLOCK_SECONDS = 420;

export const SAVE_KEY = 'loopbreak_save_v2';
export const LEGACY_SAVE_KEY = 'loopbreak_save_data_v1';

const LEGACY_UPGRADES = [
  { id: 'phase_engine', baseCost: 20, costMult: 1.8 },
  { id: 'flux_magnet', baseCost: 15, costMult: 1.7 },
  { id: 'kinetic_pulse', baseCost: 25, costMult: 1.8 },
  { id: 'echo_stabilizer', baseCost: 30, costMult: 2.0 },
];

export function createDefaultSave() {
  return {
    version: 2,
    flux: 0,
    selectedCharacter: 'cipher',
    unlockedCharacters: ['cipher'],
    selectedSkin: 'cyan_default',
    unlockedSkins: ['cyan_default'],
    selectedStage: 'neon_grid',
    unlockedStages: ['neon_grid'],
    daily: Daily.defaultDaily(),
    lab: Object.fromEntries(LAB_NODES.map(n => [n.id, 0])),
    stats: {
      runs: 0,
      totalKills: 0,
      loopKills: 0,
      paradoxes: 0,
      bestTime: 0,
      bestLevel: 0,
      bestKills: 0,
      bossKills: 0,
      totalSeconds: 0,
      legacyHighScore: 0,
    },
    discovered: { evolutions: [] },
    tips: { loop: false, paradox: false, dash: false },
    settings: { sfx: true, music: true, shake: true, damageNumbers: true },
  };
}

// Normalizes any parsed object into a complete v2 save (fills missing fields with defaults).
export function normalizeSave(parsed) {
  const def = createDefaultSave();
  if (!parsed || typeof parsed !== 'object') return def;
  const out = {
    ...def,
    ...parsed,
    version: 2,
    lab: { ...def.lab, ...(parsed.lab || {}) },
    stats: { ...def.stats, ...(parsed.stats || {}) },
    settings: { ...def.settings, ...(parsed.settings || {}) },
    discovered: { ...def.discovered, ...(parsed.discovered || {}) },
    tips: { ...def.tips, ...(parsed.tips || {}) },
    daily: normalizeDaily(parsed.daily),
  };
  const stageIds = STAGES.map(st => st.id);
  out.unlockedStages = Array.from(new Set(['neon_grid', ...(Array.isArray(out.unlockedStages) ? out.unlockedStages : [])])).filter(id => stageIds.includes(id));
  if (!out.unlockedStages.includes(out.selectedStage)) out.selectedStage = 'neon_grid';
  if (out.stats.bestTime >= STAGE2_UNLOCK_SECONDS || out.stats.bossKills > 0) {
    if (!out.unlockedStages.includes('glitch_ruins')) out.unlockedStages.push('glitch_ruins');
  }
  if (!Array.isArray(out.unlockedCharacters) || !out.unlockedCharacters.includes('cipher')) {
    out.unlockedCharacters = ['cipher', ...(Array.isArray(out.unlockedCharacters) ? out.unlockedCharacters : [])];
  }
  if (!Array.isArray(out.unlockedSkins) || !out.unlockedSkins.includes('cyan_default')) {
    out.unlockedSkins = ['cyan_default', ...(Array.isArray(out.unlockedSkins) ? out.unlockedSkins : [])];
  }
  if (!out.unlockedCharacters.includes(out.selectedCharacter)) out.selectedCharacter = 'cipher';
  if (!out.unlockedSkins.includes(out.selectedSkin)) out.selectedSkin = 'cyan_default';
  if (typeof out.flux !== 'number' || !isFinite(out.flux) || out.flux < 0) out.flux = 0;
  return out;
}

function normalizeDaily(d) {
  const def = Daily.defaultDaily();
  if (!d || typeof d !== 'object') return def;
  const streak = { ...def.streak, ...(d.streak || {}) };
  if (typeof streak.count !== 'number' || streak.count < 0) streak.count = 0;
  const m = d.missions;
  const missions = m && typeof m.day === 'string' && Array.isArray(m.list) && m.list.every(x => x && Daily.missionDef(x.id))
    ? { day: m.day, list: m.list, bonusClaimed: !!m.bonusClaimed }
    : def.missions;
  return { streak, missions };
}

// Converts a v1 save: Flux carries over, old stat upgrades are refunded, skins are kept.
export function migrateV1(v1) {
  const save = createDefaultSave();
  if (!v1 || typeof v1 !== 'object') return save;
  let refund = 0;
  for (const u of LEGACY_UPGRADES) {
    const lvl = (v1.upgrades && v1.upgrades[u.id]) || 0;
    for (let i = 0; i < lvl; i++) refund += Math.round(u.baseCost * Math.pow(u.costMult, i));
  }
  save.flux = Math.max(0, Math.floor((v1.fluxCurrency || 0) + refund));
  const knownSkins = new Set(SKINS.map(s => s.id));
  if (Array.isArray(v1.unlockedSkins)) {
    save.unlockedSkins = Array.from(new Set(['cyan_default', ...v1.unlockedSkins.filter(id => knownSkins.has(id))]));
  }
  if (v1.selectedSkin && save.unlockedSkins.includes(v1.selectedSkin)) save.selectedSkin = v1.selectedSkin;
  save.stats.runs = (v1.stats && v1.stats.totalRuns) || 0;
  save.stats.legacyHighScore = v1.highScore || 0;
  if (v1.settings) {
    save.settings.sfx = v1.settings.sfx !== false;
    save.settings.music = v1.settings.bgm !== false;
    save.settings.shake = v1.settings.screenShake !== false;
  }
  return save;
}

function parse(raw) {
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch (_) {
    return null;
  }
}

// Picks the save with more progress. Runs played is the primary signal, total time played the tiebreaker.
export function pickBestSave(a, b) {
  if (!a) return b;
  if (!b) return a;
  const score = s => (s.stats?.runs || 0) * 1e6 + (s.stats?.totalSeconds || 0);
  return score(b) > score(a) ? b : a;
}

export class SaveSystem {
  constructor() {
    this.data = createDefaultSave();
    this.isLoaded = false;
  }

  // Must run after platform.init() so the cloud data module is available.
  init() {
    const cloud = parse(platform.getCloudItem(SAVE_KEY));
    const local = parse(platform.getLocalItem(SAVE_KEY));
    let best = pickBestSave(cloud ? normalizeSave(cloud) : null, local ? normalizeSave(local) : null);

    if (!best) {
      const legacy = parse(platform.getCloudItem(LEGACY_SAVE_KEY)) || parse(platform.getLocalItem(LEGACY_SAVE_KEY));
      best = legacy ? migrateV1(legacy) : createDefaultSave();
    }

    this.data = normalizeSave(best);
    this.isLoaded = true;
    this.dailyCheckIn();
    this.save();
    return this.data;
  }

  get isFirstSession() {
    return this.data.stats.runs === 0;
  }

  save() {
    try {
      platform.setItem(SAVE_KEY, JSON.stringify(this.data));
    } catch (e) {
      console.warn('Could not write save data', e);
    }
  }

  // Rolls the streak and missions over to the current local day. Safe to call often.
  dailyCheckIn(now = new Date()) {
    const result = Daily.checkIn(this.data.daily, Daily.dayKey(now), this.data.unlockedStages);
    if (result.newDay || result.streakChanged) this.save();
    return result;
  }

  canClaimStreak(now = new Date()) {
    return Daily.canClaimStreak(this.data.daily, Daily.dayKey(now));
  }

  claimStreak(now = new Date()) {
    const reward = Daily.claimStreak(this.data.daily, Daily.dayKey(now), this.data.unlockedSkins);
    if (!reward) return null;
    this.data.flux += reward.flux;
    if (reward.skin && !this.data.unlockedSkins.includes(reward.skin)) this.data.unlockedSkins.push(reward.skin);
    this.save();
    return reward;
  }

  selectStage(id) {
    if (!this.data.unlockedStages.includes(id)) return false;
    this.data.selectedStage = id;
    this.save();
    return true;
  }

  // Applies a finished run. Returns { newRecords, unlockedCharacters, unlockedStages, missions }.
  recordRun(summary) {
    this.dailyCheckIn();
    const s = this.data.stats;
    const newRecords = [];
    s.runs += 1;
    s.totalKills += summary.kills;
    s.loopKills += summary.loopKills;
    s.paradoxes += summary.paradoxes;
    s.totalSeconds += Math.floor(summary.time);
    if (summary.bossKilled) s.bossKills += 1;
    if (summary.time > s.bestTime) { s.bestTime = Math.floor(summary.time); newRecords.push('time'); }
    if (summary.level > s.bestLevel) { s.bestLevel = summary.level; newRecords.push('level'); }
    if (summary.kills > s.bestKills) { s.bestKills = summary.kills; newRecords.push('kills'); }
    for (const evo of summary.evolutions || []) {
      if (!this.data.discovered.evolutions.includes(evo)) this.data.discovered.evolutions.push(evo);
    }
    this.data.flux += summary.flux;
    const missions = Daily.applyRun(this.data.daily, summary);
    this.data.flux += missions.fluxEarned;
    const unlockedCharacters = this.checkUnlocks();
    const unlockedStages = [];
    if (summary.stageId === 'neon_grid' && (summary.time >= STAGE2_UNLOCK_SECONDS || summary.bossKilled) && !this.data.unlockedStages.includes('glitch_ruins')) {
      this.data.unlockedStages.push('glitch_ruins');
      unlockedStages.push('glitch_ruins');
    }
    this.save();
    return { newRecords, unlockedCharacters, unlockedStages, missions };
  }

  addFlux(amount) {
    this.data.flux += Math.max(0, Math.floor(amount));
    this.save();
  }

  checkUnlocks() {
    const newly = [];
    for (const c of CHARACTERS) {
      if (!c.unlock || this.data.unlockedCharacters.includes(c.id)) continue;
      if ((this.data.stats[c.unlock.stat] || 0) >= c.unlock.target) {
        this.data.unlockedCharacters.push(c.id);
        newly.push(c.id);
      }
    }
    return newly;
  }

  unlockProgress(character) {
    if (!character.unlock) return 1;
    return Math.min(1, (this.data.stats[character.unlock.stat] || 0) / character.unlock.target);
  }

  labLevel(id) {
    return this.data.lab[id] || 0;
  }

  nextLabCost(id) {
    const node = LAB_NODES.find(n => n.id === id);
    const lvl = this.labLevel(id);
    if (!node || lvl >= node.maxLevel) return null;
    return labCost(node, lvl);
  }

  affordableLabCount() {
    let n = 0;
    for (const node of LAB_NODES) {
      const cost = this.nextLabCost(node.id);
      if (cost !== null && cost <= this.data.flux) n++;
    }
    return n;
  }

  buyLab(id) {
    const cost = this.nextLabCost(id);
    if (cost === null || this.data.flux < cost) return false;
    this.data.flux -= cost;
    this.data.lab[id] = this.labLevel(id) + 1;
    this.save();
    return true;
  }

  selectCharacter(id) {
    if (!this.data.unlockedCharacters.includes(id)) return false;
    this.data.selectedCharacter = id;
    this.save();
    return true;
  }

  buySkin(id) {
    const skin = SKINS.find(s => s.id === id);
    if (!skin) return false;
    if (this.data.unlockedSkins.includes(id)) return true;
    if (skin.cost === null) return false; // exclusive rewards can't be bought
    if (this.data.flux < skin.cost) return false;
    this.data.flux -= skin.cost;
    this.data.unlockedSkins.push(id);
    this.save();
    return true;
  }

  selectSkin(id) {
    if (!this.data.unlockedSkins.includes(id)) return false;
    this.data.selectedSkin = id;
    this.save();
    return true;
  }

  markTip(id) {
    if (this.data.tips[id]) return;
    this.data.tips[id] = true;
    this.save();
  }

  updateSettings(patch) {
    this.data.settings = { ...this.data.settings, ...patch };
    this.save();
  }
}

export const saveSystem = new SaveSystem();
