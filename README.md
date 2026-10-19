# LOOP//BREAK

> **Every path you run becomes a past self that fights beside you.**

An echo survivor-like for desktop and mobile web, built for CrazyGames. Survive ten minutes of escalating waves on the Neon Grid, beat the Loopkeeper, then push into overtime.

## What makes it different

| Mechanic | What it does |
| :--- | :--- |
| **Echo allies** | Your movement is recorded. Each echo replays your path a second or more behind you and fires every weapon you own. Up to 5 echoes. |
| **Loop capture** | Your trail lingers for a few seconds. Close a loop around enemies and everything inside shatters. Elites and bosses take a chunk of max HP. |
| **Paradox** | Charged echoes (white ring) explode when an enemy touches them, and chain into other charged echoes. |

Echo Eaters hunt your echoes and jam them, so protecting your past selves matters.

## Run structure (Stage 01 · Neon Grid)

- Level-up drafts every 20–60 s: pick 1 of 3 weapons or passives. Rerolls come from the Flux Lab.
- Encirclement rings, swarm rushes, elites (drop data caches), Sentinel Prime minibosses at 2:30 / 5:00 / 7:30.
- **The Loopkeeper** arrives at 10:00. Below 50% HP it spawns its own echo. Beat it for the stage clear, then survive overtime for bonus Flux.
- Evolutions come from caches: max-level weapon + its paired passive (Pulse Bolt + Overclock → Singularity Bolt, Orbit Shards + Temporal Fork → Event Horizon).
- One rewarded **Rewind** per run (full HP + area-clearing shockwave).

## Daily systems (next-day retention)

- **Login streak**: 7-day reward track (20 → 120 Flux). Day 7 grants the exclusive **Chrono** colorway. Missing a day resets the streak. The reward pops up on the first hub visit of the day.
- **Daily missions**: 3 per day (easy / medium / hard), the same for every player on a given date, generated from a seeded pool in `src/data/daily.js`. Progress is shown live with a toast the moment a mission completes, banked at run end, and all three pay a bonus.
- **Tomorrow tease**: the Daily panel and results screen always show the next day's streak reward and when missions reset.
- **Stage 02 · Glitch Ruins**: unlocks after surviving 7:00 (or beating the Loopkeeper) in Neon Grid. Tougher enemies, telegraphed **rift** strikes that hit players and enemies alike, a new boss (**The Fracture**), and ×1.5 Flux.

Logic lives in `src/systems/DailySystem.js` as pure functions over the save, so it is fully covered by tests with fixed dates.

## Meta progression

- **Flux** is earned every run (`src/systems/Economy.js` is the single source of truth, so the results screen always matches what is banked). Rewarded ad doubles it.
- **Flux Lab**: 6 permanent upgrade lines.
- **Stages**: Neon Grid, Glitch Ruins (see above).
- **Loopers**: Cipher, Swarm (unlock: 150 loop kills), Warden (unlock: survive 5:00). Each changes how echoes behave.
- **Colorways**: 5 cosmetic player colors.

## Controls

| Desktop | Mobile (landscape) |
| :--- | :--- |
| WASD / ZQSD / arrows to move | Drag anywhere on the left 60% (floating joystick) |
| Space / Shift / K to dash (invulnerable) | DASH button, bottom right |
| Esc / P to pause, 1·2·3 to pick upgrades, R to reroll | Tap cards |

Weapons fire automatically.

## CrazyGames integration

- New players land directly in gameplay; returning players get the hub.
- SDK v3: `loadingStart/Stop`, `gameplayStart/Stop` (deduplicated), `happytime` on records, unlocks and boss kills, locale read from `user.systemInfo`.
- Save data loads **after** SDK init and merges cloud (data module) with localStorage, keeping whichever has more progress. v1 saves are migrated (Flux carried over, old upgrades refunded, skins kept).
- Ads: rewarded Rewind and rewarded 2× Flux; midgame ads only at the run-end break, skipped after a player's first run and throttled to one per 150 s. Every ad path has a fallback, so ad blockers never soft-lock the game.
- No custom fullscreen button (the platform provides it). Fonts are self-hosted.

## Project layout

```
src/
  core/      Game (state machine + loop), Run (pure simulation), SpatialHash, math
  data/      weapons, passives, enemies, stages, characters, meta (lab/skins), icons
  systems/   DraftSystem, Economy, SaveSystem, ParticleSystem, CrazyGamesSDK
  render/    Renderer (canvas), SpriteCache (pre-rendered glow sprites)
  input/     InputManager, TouchJoystick
  ui/        UI (hub, panels, HUD, drafts, pause, revive, results)
  audio/     AudioSynthesizer (procedural SFX + adaptive music sequencer)
tests/
  run.test.js   headless tests: echoes, loops, paradox, drafts, saves, economy, determinism
  balance.js    balance bot that plays full runs and reports pacing
```

`Run` never touches the DOM or canvas, so the whole game can be simulated in Node.

## Development

```bash
npm install
```

```bash
npm run dev
```

```bash
npm test
```

```bash
npm run balance -- runs=10 skill=0.4
```

`skill` is 0–1 (0.4 ≈ new player, 0.7 ≈ experienced). Add `?debug` to the local URL to expose `window.__game` for playtesting (disabled when the CrazyGames SDK is present).

## Release

```bash
npm run build
```

Zip the contents of `dist/` (with `index.html` at the zip root) and upload to the CrazyGames Developer Portal.
