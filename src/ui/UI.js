// LOOP//BREAK - DOM layer: hub, panels, HUD, drafts, pause, revive and results.
import { iconSvg } from '../data/icons.js';
import { CHARACTERS, getCharacter } from '../data/characters.js';
import { LAB_NODES, SKINS } from '../data/meta.js';
import { WEAPONS, EVOLUTIONS } from '../data/weapons.js';
import { PASSIVES } from '../data/passives.js';
import { getStage } from '../data/stages.js';
import { formatTime } from '../core/math.js';
import { saveSystem } from '../systems/SaveSystem.js';
import { audio } from '../audio/AudioSynthesizer.js';

const $ = (id) => document.getElementById(id);

export class UI {
  constructor(game) {
    this.game = game;
    this.hudCache = {};
    this.draftOptions = [];
    this.reviveTimer = null;
    this.hintTimer = null;
    this.panel = null;

    this.hydrateIcons(document);
    this.bind();
  }

  hydrateIcons(root) {
    root.querySelectorAll('[data-icon]').forEach((el) => {
      if (el.dataset.hydrated) return;
      el.innerHTML = iconSvg(el.dataset.icon, 18);
      el.classList.add('ico');
      el.dataset.hydrated = '1';
    });
  }

  click(el, fn) {
    el.addEventListener('click', (e) => {
      e.stopPropagation();
      // Drop focus after mouse/touch clicks so Space (dash) can't re-trigger the button mid-run
      if (e.detail > 0) el.blur();
      audio.ensureContext();
      audio.playClick();
      fn(e);
    });
    el.addEventListener('pointerenter', () => audio.playHover());
  }

  bind() {
    const g = this.game;
    this.click($('btn-play'), () => g.startRun());
    document.querySelectorAll('.nav-btn').forEach((b) => this.click(b, () => this.openPanel(b.dataset.panel)));
    this.click($('panel-close'), () => this.closePanel());
    $('panel-layer').addEventListener('click', (e) => { if (e.target.id === 'panel-layer') this.closePanel(); });
    this.click($('hud-pause'), () => g.pause());
    this.click($('btn-resume'), () => g.resume());
    this.click($('btn-abandon'), () => g.abandonRun());
    this.click($('btn-reroll'), () => g.reroll());
    this.click($('btn-revive'), () => g.acceptRevive());
    this.click($('btn-giveup'), () => g.declineRevive());
    this.click($('btn-double'), () => g.doubleFlux());
    this.click($('btn-retry'), () => g.retry());
    this.click($('btn-hub'), () => g.goHub());

    // Stop wheel / long-press from scrolling the host page or opening menus, except inside scrollable lists
    window.addEventListener('wheel', (e) => {
      if (!(e.target.closest && e.target.closest('.panel-body, .results, .sheet'))) e.preventDefault();
    }, { passive: false });
    window.addEventListener('contextmenu', (e) => e.preventDefault());

    window.addEventListener('keydown', (e) => {
      if (e.repeat) return;
      // A focused button already handles Space/Enter itself
      if ((e.code === 'Space' || e.code === 'Enter') && e.target.closest && e.target.closest('button')) return;
      const state = g.state;
      if (state === 'DRAFT') {
        const n = ['Digit1', 'Digit2', 'Digit3', 'Numpad1', 'Numpad2', 'Numpad3'].indexOf(e.code) % 3;
        if (n >= 0 && n < this.draftOptions.length) { audio.playClick(); g.pickDraft(n); }
        if (e.code === 'KeyR') g.reroll();
      } else if (state === 'RESULTS' && (e.code === 'Space' || e.code === 'Enter')) {
        e.preventDefault();
        g.retry();
      } else if (state === 'HUB' && !this.panel && (e.code === 'Space' || e.code === 'Enter')) {
        e.preventDefault();
        g.startRun();
      } else if (state === 'PAUSED' && (e.code === 'Escape' || e.code === 'KeyP')) {
        g.resume();
      } else if (state === 'HUB' && this.panel && e.code === 'Escape') {
        this.closePanel();
      }
    });
  }

  hideAll() {
    for (const id of ['hud', 'screen-hub', 'panel-layer', 'screen-draft', 'screen-pause', 'screen-revive', 'screen-results']) {
      $(id).classList.add('hidden');
    }
    this.panel = null;
  }

  // ---------- HUB ----------

  showHub() {
    this.hideAll();
    $('screen-hub').classList.remove('hidden');
    this.refreshHub();
  }

  refreshHub() {
    const d = saveSystem.data;
    $('hub-flux').textContent = d.flux.toLocaleString();
    $('rec-time').textContent = formatTime(d.stats.bestTime);
    $('rec-level').textContent = d.stats.bestLevel;
    $('rec-loops').textContent = d.stats.loopKills.toLocaleString();
    const stage = getStage('neon_grid');
    $('hub-stage-line').textContent = `STAGE ${String(stage.index).padStart(2, '0')} · ${stage.name} · BEST ${formatTime(d.stats.bestTime)}`;

    const ch = getCharacter(d.selectedCharacter);
    $('hub-looper').innerHTML = `
      <span class="kicker">SELECTED LOOPER</span>
      <div class="hub-looper-name" style="--c:${ch.color}">${ch.name}</div>
      <div class="hub-looper-title">${ch.title}</div>
      <div class="hub-looper-trait">${ch.trait}</div>
      <div class="hub-looper-weapon">${iconSvg(ch.startWeapon, 16)}<span>${WEAPONS[ch.startWeapon].name}</span></div>`;

    const lab = saveSystem.affordableLabCount();
    const labBadge = $('badge-lab');
    labBadge.classList.toggle('hidden', lab === 0);
    labBadge.textContent = lab;
    const nextChar = CHARACTERS.find(c => !d.unlockedCharacters.includes(c.id));
    const lBadge = $('badge-loopers');
    if (nextChar) {
      lBadge.classList.remove('hidden');
      lBadge.textContent = `${Math.floor(saveSystem.unlockProgress(nextChar) * 100)}%`;
    } else {
      lBadge.classList.add('hidden');
    }
  }

  openPanel(kind) {
    this.panel = kind;
    $('panel-layer').classList.remove('hidden');
    const titles = { loopers: ['02', 'LOOPERS'], lab: ['03', 'FLUX LAB'], settings: ['04', 'SETTINGS'] };
    $('panel-index').textContent = titles[kind][0];
    $('panel-title').textContent = titles[kind][1];
    this.renderPanel();
  }

  closePanel() {
    this.panel = null;
    $('panel-layer').classList.add('hidden');
    this.refreshHub();
  }

  renderPanel() {
    $('panel-flux').textContent = saveSystem.data.flux.toLocaleString();
    const body = $('panel-body');
    if (this.panel === 'loopers') body.innerHTML = this.loopersHtml();
    else if (this.panel === 'lab') body.innerHTML = this.labHtml();
    else body.innerHTML = `<div class="settings-grid">${this.settingsHtml()}</div>`;
    this.hydrateIcons(body);
    this.bindPanel(body);
  }

  loopersHtml() {
    const d = saveSystem.data;
    const chars = CHARACTERS.map((c) => {
      const owned = d.unlockedCharacters.includes(c.id);
      const selected = d.selectedCharacter === c.id;
      const prog = saveSystem.unlockProgress(c);
      const stat = c.unlock ? Math.min(d.stats[c.unlock.stat] || 0, c.unlock.target) : 0;
      const statText = c.unlock && c.unlock.stat === 'bestTime' ? `${formatTime(stat)} / ${formatTime(c.unlock.target)}` : c.unlock ? `${stat} / ${c.unlock.target}` : '';
      return `
        <button class="char-card ${selected ? 'is-selected' : ''} ${owned ? '' : 'is-locked'}" data-char="${c.id}" style="--c:${c.color}" ${owned ? '' : 'aria-disabled="true"'}>
          <div class="char-glyph"><span class="char-ring"></span></div>
          <div class="char-name">${c.name}</div>
          <div class="char-title">${c.title}</div>
          <div class="char-trait">${c.trait}</div>
          <div class="char-weapon">${iconSvg(c.startWeapon, 14)}${WEAPONS[c.startWeapon].name} · ${c.hp} HP</div>
          ${owned
            ? `<div class="char-state">${selected ? 'SELECTED' : 'SELECT'}</div>`
            : `<div class="char-lock">${iconSvg('lock', 14)}<span>${c.unlock.label}</span></div>
               <div class="progress"><div class="progress-fill" style="width:${prog * 100}%"></div></div>
               <div class="char-prog">${statText}</div>`}
        </button>`;
    }).join('');

    const skins = SKINS.map((s) => {
      const owned = d.unlockedSkins.includes(s.id);
      const selected = d.selectedSkin === s.id;
      const color = s.color || getCharacter(d.selectedCharacter).color;
      const afford = d.flux >= s.cost;
      return `
        <button class="skin-chip ${selected ? 'is-selected' : ''} ${!owned && !afford ? 'is-poor' : ''}" data-skin="${s.id}" style="--c:${color}">
          <span class="skin-dot"></span>
          <span class="skin-name">${s.name}</span>
          <span class="skin-cost">${owned ? (selected ? 'ON' : '') : `${iconSvg('flux', 12)}${s.cost}`}</span>
        </button>`;
    }).join('');

    return `<div class="char-grid">${chars}</div>
      <h3 class="section-label">COLORWAYS</h3>
      <div class="skin-row">${skins}</div>`;
  }

  labHtml() {
    const d = saveSystem.data;
    return `<p class="panel-copy">Permanent upgrades. Flux is earned every run, win or lose.</p><div class="lab-grid">${LAB_NODES.map((n) => {
      const lvl = saveSystem.labLevel(n.id);
      const cost = saveSystem.nextLabCost(n.id);
      const max = cost === null;
      const afford = !max && d.flux >= cost;
      const pips = Array.from({ length: n.maxLevel }, (_, i) => `<span class="pip ${i < lvl ? 'on' : ''}"></span>`).join('');
      return `
        <div class="lab-node ${afford ? 'is-ready' : ''}">
          <div class="lab-name">${n.name}</div>
          <div class="lab-desc">${n.desc}</div>
          <div class="pips">${pips}</div>
          <button class="lab-buy" data-lab="${n.id}" ${max || !afford ? 'disabled' : ''}>
            ${max ? 'MAXED' : `${iconSvg('flux', 13)}${cost}`}
          </button>
        </div>`;
    }).join('')}</div>`;
  }

  settingsHtml() {
    const s = saveSystem.data.settings;
    const row = (key, label) => `
      <label class="toggle">
        <span>${label}</span>
        <input type="checkbox" data-setting="${key}" ${s[key] ? 'checked' : ''}>
        <span class="toggle-track"><span class="toggle-thumb"></span></span>
      </label>`;
    return row('sfx', 'Sound effects') + row('music', 'Music') + row('shake', 'Screen shake') + row('damageNumbers', 'Damage numbers');
  }

  bindSettings(root) {
    root.querySelectorAll('[data-setting]').forEach((input) => {
      input.addEventListener('change', () => {
        saveSystem.updateSettings({ [input.dataset.setting]: input.checked });
        this.game.applySettings();
        audio.playClick();
      });
    });
  }

  bindPanel(body) {
    body.querySelectorAll('[data-char]').forEach((el) => this.click(el, () => {
      if (saveSystem.selectCharacter(el.dataset.char)) this.renderPanel();
    }));
    body.querySelectorAll('[data-skin]').forEach((el) => this.click(el, () => {
      const id = el.dataset.skin;
      if (saveSystem.buySkin(id)) saveSystem.selectSkin(id);
      this.renderPanel();
    }));
    body.querySelectorAll('[data-lab]').forEach((el) => this.click(el, () => {
      if (saveSystem.buyLab(el.dataset.lab)) audio.playPick();
      this.renderPanel();
    }));
    this.bindSettings(body);
  }

  // ---------- HUD ----------

  showHud(run) {
    this.hideAll();
    $('hud').classList.remove('hidden');
    $('hud-stage').textContent = run.stage.name;
    this.hideBossBar();
    $('toasts').innerHTML = '';
    this.hudCache = {};
    this.renderBuild(run);
  }

  setText(id, value) {
    if (this.hudCache[id] === value) return;
    this.hudCache[id] = value;
    $(id).textContent = value;
  }

  updateHud(run) {
    const xpFrac = Math.min(1, run.xp / run.xpNeed);
    const xpKey = Math.round(xpFrac * 400);
    if (this.hudCache.xp !== xpKey) {
      this.hudCache.xp = xpKey;
      $('hud-xp-fill').style.transform = `scaleX(${xpFrac})`;
    }
    this.setText('hud-level', String(run.level));
    this.setText('hud-timer', formatTime(run.time));
    this.setText('hud-kills', run.kills.toLocaleString());
    this.setText('hud-loops', run.loopKills.toLocaleString());

    const combo = run.combo >= 10 ? `${run.combo} CHAIN` : '';
    if (this.hudCache.combo !== combo) {
      this.hudCache.combo = combo;
      const el = $('hud-combo');
      el.textContent = combo;
      el.classList.toggle('show', !!combo);
    }

    if (run.boss) {
      const frac = Math.max(0, run.boss.hp / run.boss.maxHp);
      const key = Math.round(frac * 300);
      if (this.hudCache.boss !== key) {
        this.hudCache.boss = key;
        $('hud-boss-fill').style.transform = `scaleX(${frac})`;
      }
    }

    const low = run.player.hp / run.stats.maxHp < 0.3;
    if (this.hudCache.low !== low) {
      this.hudCache.low = low;
      $('vignette').classList.toggle('low', low);
    }
  }

  renderBuild(run) {
    const slots = [];
    for (const w of run.weapons) {
      const def = w.evolved ? EVOLUTIONS[w.evolved] : WEAPONS[w.id];
      slots.push(`<div class="slot ${w.evolved ? 'evo' : ''}" style="--c:${def.color}" title="${def.name}">${iconSvg(w.evolved || w.id, 18)}<span class="slot-lvl">${w.evolved ? '★' : w.level}</span></div>`);
    }
    slots.push('<div class="slot-sep"></div>');
    for (const id in run.passives) {
      const def = PASSIVES[id];
      slots.push(`<div class="slot slot-p" style="--c:${def.color}" title="${def.name}">${iconSvg(id, 16)}<span class="slot-lvl">${run.passives[id]}</span></div>`);
    }
    $('hud-build').innerHTML = slots.join('');
  }

  showBossBar(name) {
    $('hud-boss-name').textContent = name;
    $('hud-boss').classList.remove('hidden');
    $('hud').classList.add('has-boss');
    this.hudCache.boss = null;
  }

  hideBossBar() {
    $('hud-boss').classList.add('hidden');
    $('hud').classList.remove('has-boss');
  }

  toast({ title, text = '', kind = 'info' }) {
    const box = $('toasts');
    const el = document.createElement('div');
    el.className = `toast toast-${kind}`;
    el.innerHTML = `<span class="toast-title">${title}</span>${text ? `<span class="toast-text">${text}</span>` : ''}`;
    box.appendChild(el);
    while (box.children.length > 3) box.removeChild(box.firstChild);
    setTimeout(() => el.classList.add('out'), 2600);
    setTimeout(() => el.remove(), 3100);
  }

  hint(html) {
    const el = $('hud-hint');
    if (!html) {
      el.classList.add('hidden');
      this.hudCache.hint = null;
      return;
    }
    if (this.hudCache.hint === html) return;
    this.hudCache.hint = html;
    el.innerHTML = html;
    el.classList.remove('hidden');
  }

  hurtFlash() {
    const v = $('vignette');
    v.classList.remove('hit');
    void v.offsetWidth;
    v.classList.add('hit');
    clearTimeout(this.hitTimer);
    this.hitTimer = setTimeout(() => v.classList.remove('hit'), 400);
  }

  // ---------- DRAFT ----------

  showDraft(options, { kind, level, rerolls }) {
    this.draftOptions = options;
    const screen = $('screen-draft');
    screen.classList.remove('hidden');
    screen.classList.toggle('is-cache', kind === 'cache');
    $('draft-kicker').textContent = kind === 'cache' ? 'DATA CACHE DECRYPTED' : `LEVEL ${level}`;
    $('draft-title').textContent = options.length === 1 && options[0].kind === 'evolution' ? 'EVOLUTION UNLOCKED' : kind === 'cache' ? 'CLAIM ONE REWARD' : 'CHOOSE AN UPGRADE';
    const cards = $('draft-cards');
    cards.innerHTML = options.map((o, i) => {
      const max = o.kind === 'weapon' ? WEAPONS[o.id].maxLevel : o.kind === 'passive' ? PASSIVES[o.id].maxLevel : 0;
      const pips = max ? Array.from({ length: max }, (_, k) => `<span class="pip ${k < o.levelFrom ? 'on' : k < o.levelTo ? 'next' : ''}"></span>`).join('') : '';
      const tag = o.kind === 'evolution' ? 'EVOLUTION' : o.isNew ? 'NEW' : o.kind === 'weapon' || o.kind === 'passive' ? `LV ${o.levelFrom} → ${o.levelTo}` : 'BONUS';
      const type = o.kind === 'weapon' ? 'WEAPON' : o.kind === 'passive' ? 'PASSIVE' : o.kind === 'evolution' ? 'WEAPON' : 'ITEM';
      return `
        <button class="card ${o.kind === 'evolution' ? 'card-evo' : ''}" data-idx="${i}" style="--c:${o.color}; --d:${i * 60}ms">
          <span class="card-key desktop-only">${i + 1}</span>
          <span class="card-tag ${o.isNew ? 'is-new' : ''}">${tag}</span>
          <span class="card-icon">${iconSvg(o.icon, 34)}</span>
          <span class="card-type">${type}</span>
          <span class="card-name">${o.name}</span>
          <span class="card-desc">${o.desc}</span>
          ${pips ? `<span class="pips">${pips}</span>` : ''}
        </button>`;
    }).join('');
    cards.querySelectorAll('.card').forEach((el) => this.click(el, () => this.game.pickDraft(Number(el.dataset.idx))));
    const rr = $('btn-reroll');
    rr.classList.toggle('hidden', kind === 'cache' || rerolls <= 0);
    $('reroll-count').textContent = `×${rerolls}`;
  }

  hideDraft() {
    $('screen-draft').classList.add('hidden');
    this.draftOptions = [];
  }

  // ---------- PAUSE ----------

  showPause(run) {
    $('screen-pause').classList.remove('hidden');
    const items = [];
    for (const w of run.weapons) {
      const def = w.evolved ? EVOLUTIONS[w.evolved] : WEAPONS[w.id];
      items.push(`<div class="build-item" style="--c:${def.color}">${iconSvg(w.evolved || w.id, 18)}<span>${def.name}</span><b>${w.evolved ? 'EVO' : `LV ${w.level}`}</b></div>`);
    }
    for (const id in run.passives) {
      const def = PASSIVES[id];
      items.push(`<div class="build-item" style="--c:${def.color}">${iconSvg(id, 18)}<span>${def.name}</span><b>LV ${run.passives[id]}</b></div>`);
    }
    $('pause-build').innerHTML = items.join('');
    const settings = $('pause-settings');
    settings.innerHTML = this.settingsHtml();
    this.bindSettings(settings);
  }

  hidePause() {
    $('screen-pause').classList.add('hidden');
  }

  // ---------- REVIVE ----------

  showRevive(seconds, onTimeout) {
    $('screen-revive').classList.remove('hidden');
    const arc = $('revive-arc');
    const total = 2 * Math.PI * 44;
    arc.style.strokeDasharray = `${total}`;
    let left = seconds;
    const tick = () => {
      $('revive-count').textContent = Math.ceil(left);
      arc.style.strokeDashoffset = `${total * (1 - left / seconds)}`;
    };
    tick();
    clearInterval(this.reviveTimer);
    this.reviveTimer = setInterval(() => {
      if (document.hidden) return;
      left -= 0.1;
      tick();
      if (left <= 0) {
        clearInterval(this.reviveTimer);
        onTimeout();
      }
    }, 100);
  }

  hideRevive() {
    clearInterval(this.reviveTimer);
    $('screen-revive').classList.add('hidden');
  }

  setReviveBusy(busy) {
    $('btn-revive').disabled = busy;
    if (busy) clearInterval(this.reviveTimer);
  }

  // ---------- RESULTS ----------

  showResults({ summary, flux, newRecords, unlocked, canDouble }) {
    this.hideAll();
    $('screen-results').classList.remove('hidden');
    $('results-kicker').textContent = summary.bossKilled ? 'LOOP BROKEN' : 'LOOP COLLAPSED';
    $('results-kicker').className = `kicker ${summary.bossKilled ? 'kicker-win' : 'kicker-danger'}`;
    $('results-title').textContent = formatTime(summary.time);

    const recLabels = { time: 'NEW BEST TIME', level: 'NEW BEST LEVEL', kills: 'NEW KILL RECORD' };
    $('results-records').innerHTML = newRecords.map(r => `<span class="record-chip">${recLabels[r]}</span>`).join('');

    const stat = (label, value, icon) => `<div class="rstat"><span class="rstat-ico">${iconSvg(icon, 16)}</span><span class="rstat-val">${value}</span><span class="rstat-lbl">${label}</span></div>`;
    $('results-stats').innerHTML =
      stat('LEVEL', summary.level, 'amplifier') +
      stat('KILLS', summary.kills.toLocaleString(), 'skull') +
      stat('LOOP KILLS', summary.loopKills.toLocaleString(), 'loop') +
      stat('PARADOXES', summary.paradoxes.toLocaleString(), 'temporal_fork');

    $('results-flux').textContent = `+${flux}`;
    $('btn-double').classList.toggle('hidden', !canDouble || flux <= 0);
    $('btn-double').disabled = false;

    const d = saveSystem.data;
    const progress = [];
    for (const id of unlocked) {
      const c = getCharacter(id);
      progress.push(`<div class="unlock-banner" style="--c:${c.color}"><span class="kicker">NEW LOOPER UNLOCKED</span><b>${c.name}</b><span>${c.trait}</span></div>`);
    }
    const next = CHARACTERS.find(c => !d.unlockedCharacters.includes(c.id));
    if (next) {
      const pct = saveSystem.unlockProgress(next);
      progress.push(`<div class="prog-row"><span class="prog-lbl">NEXT LOOPER · <b style="color:${next.color}">${next.name}</b> — ${next.unlock.label}</span><div class="progress"><div class="progress-fill" style="width:${pct * 100}%"></div></div></div>`);
    }
    const lab = saveSystem.affordableLabCount();
    if (lab > 0) progress.push(`<div class="prog-row prog-lab">${iconSvg('lab', 16)}<span>${lab} Flux Lab upgrade${lab > 1 ? 's' : ''} ready in the hub</span></div>`);
    $('results-progress').innerHTML = progress.join('');

    setTimeout(() => $('btn-retry').focus({ preventScroll: true }), 50);
  }

  updateResultsFlux(flux) {
    $('results-flux').textContent = `+${flux}`;
    $('btn-double').classList.add('hidden');
  }

  setDoubleBusy(busy) {
    $('btn-double').disabled = busy;
  }

  // ---------- Orientation ----------

  setRotatePrompt(show) {
    $('rotate-prompt').classList.toggle('hidden', !show);
  }
}
