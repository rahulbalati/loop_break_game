// LOOP//BREAK - Login streak and daily missions. Pure functions over the save object so they can be tested
// with any date; SaveSystem calls them with the real local date.
import { MISSIONS, MISSION_REWARDS, ALL_MISSIONS_BONUS, streakReward } from '../data/daily.js';
import { createRng } from '../core/math.js';

export function dayKey(date = new Date()) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function previousDayKey(key) {
  const [y, m, d] = key.split('-').map(Number);
  return dayKey(new Date(y, m - 1, d - 1));
}

export function msUntilNextDay(now = new Date()) {
  const next = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
  return next - now;
}

function hashKey(key) {
  let h = 2166136261;
  for (let i = 0; i < key.length; i++) {
    h ^= key.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function defaultDaily() {
  return {
    streak: { count: 0, lastDay: null, claimedDay: null },
    missions: { day: null, list: [], bonusClaimed: false },
  };
}

// Same three missions for everyone on a given day: one easy, one medium, one hard.
export function generateMissions(day, unlockedStages = []) {
  const rng = createRng(hashKey(day));
  const pool = MISSIONS.filter(m => !m.requiresStage || unlockedStages.includes(m.requiresStage));
  const picked = [];
  while (picked.length < 3 && pool.length > 0) {
    const i = Math.floor(rng() * pool.length);
    picked.push(pool[i]);
    pool.splice(i, 1);
  }
  const tiers = [0, 1, 2].sort(() => rng() - 0.5);
  return picked.map((m, k) => ({
    id: m.id,
    tier: tiers[k],
    target: m.targets[tiers[k]],
    reward: MISSION_REWARDS[tiers[k]],
    progress: 0,
    done: false,
  })).sort((a, b) => a.tier - b.tier);
}

// Called on boot and whenever the hub or results screen opens (handles midnight rollover).
// Returns { newDay, streakChanged }.
export function checkIn(daily, today, unlockedStages = []) {
  let streakChanged = false;
  const s = daily.streak;
  if (s.lastDay !== today) {
    s.count = s.lastDay && s.lastDay === previousDayKey(today) ? s.count + 1 : 1;
    s.lastDay = today;
    streakChanged = true;
  }
  let newDay = false;
  if (daily.missions.day !== today) {
    daily.missions = { day: today, list: generateMissions(today, unlockedStages), bonusClaimed: false };
    newDay = true;
  }
  return { newDay, streakChanged };
}

export function canClaimStreak(daily, today) {
  return daily.streak.lastDay === today && daily.streak.claimedDay !== today;
}

// Returns the reward granted ({ flux, skin }) or null. Caller applies it to the save.
export function claimStreak(daily, today, ownedSkins = []) {
  if (!canClaimStreak(daily, today)) return null;
  daily.streak.claimedDay = today;
  const r = streakReward(daily.streak.count);
  if (r.skin && !ownedSkins.includes(r.skin)) return { day: r.day, flux: r.flux, skin: r.skin };
  return { day: r.day, flux: r.flux + (r.skin ? 60 : 0), skin: null };
}

export function missionDef(id) {
  return MISSIONS.find(m => m.id === id);
}

export function missionLabel(m) {
  return missionDef(m.id).label(m.target);
}

// Value of a mission's stat for one run summary.
function runValue(def, summary) {
  if (def.stat === 'runs') return 1;
  if (def.stat === 'ruinsTime') return summary.stageId === 'glitch_ruins' ? Math.floor(summary.time) : 0;
  if (def.stat === 'time') return Math.floor(summary.time);
  return summary[def.stat] || 0;
}

// Progress the mission would have if `summary` (possibly a run still in progress) were added.
export function previewProgress(m, summary) {
  const def = missionDef(m.id);
  const v = runValue(def, summary);
  return def.mode === 'sum' ? m.progress + v : Math.max(m.progress, v);
}

// Applies a finished run. Returns { completed: [mission], bonus: number, fluxEarned: number }.
export function applyRun(daily, summary) {
  const completed = [];
  let fluxEarned = 0;
  for (const m of daily.missions.list) {
    if (m.done) continue;
    m.progress = Math.min(m.target, previewProgress(m, summary));
    if (m.progress >= m.target) {
      m.done = true;
      completed.push(m);
      fluxEarned += m.reward;
    }
  }
  let bonus = 0;
  const list = daily.missions.list;
  if (list.length > 0 && list.every(m => m.done) && !daily.missions.bonusClaimed) {
    daily.missions.bonusClaimed = true;
    bonus = ALL_MISSIONS_BONUS;
    fluxEarned += bonus;
  }
  return { completed, bonus, fluxEarned };
}

export function missionsDone(daily) {
  return daily.missions.list.filter(m => m.done).length;
}
