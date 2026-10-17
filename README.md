# LOOP//BREAK

> **"Your past movements shape your present challenge. Break the loop."**

**LOOP//BREAK** is an original, high-octane neon cyber arcade game engineered for desktop and mobile web browsers. Designed for instant loading, silky 60 FPS gameplay, and publication on **CrazyGames** under the Zrazy Game brand.

---

## 🎮 Game Concept & The Signature "Echo System"

In **LOOP//BREAK**, you pilot an agile, cybernetic avatar trapped inside an unstable quantum simulation. To escape, you must collect all designated Energy Shards, activate the dimensional Exit Portal, and survive across endless, increasingly hazardous floors.

### The Echo System
The central mechanic is the **Echo System**:
- The simulation records your movement history in real-time.
- After a short delay (2.4s base, adjustable via Upgrades), a translucent violet **Echo Ghost** spawns and replays your exact recorded trajectory.
- **The Danger**: Colliding with your Echo damages your energy shields.
- **The Strategy**: Hunter and Sentinel enemies can be **baited and distracted** by your Echo! By carving strategic curved paths, you can trick aggressive enemies into chasing your ghost while you slip through guarded corridors to reach energy shards or the exit portal.

---

## 🕹️ Controls

### Desktop Controls
| Input | Action |
| :--- | :--- |
| **WASD** or **Arrow Keys** | 360° Analog / Directional Movement |
| **SPACE** | **Dash Burst** (Brief Invulnerability Frames & Speed Boost) |
| **E** or **J** | **Kinetic Pulse** (Radial Shockwave: Knocks back & Stuns enemies) |
| **ESC** or **P** | Pause / Settings Menu |
| **SPACE / ENTER** | Instant Restart (on Game Over) or Continue (on Floor Clear) |

### Mobile Controls (Landscape Orientation)
- **BGMI-Style Floating Rotary Joystick (Bottom-Left)**:
  - Touch anywhere in the bottom-left screen zone to anchor the rotary joystick under your thumb.
  - Smooth 360° directional vector with dead-zone dampening and spring reset.
- **Primary DASH Button (Bottom-Right)**:
  - Large circular touch button with real-time radial cooldown sweep.
- **Secondary PULSE Button (Orbital)**:
  - Positioned above Dash, unlocked at Floor 4.
- **Simultaneous Multitouch**:
  - Full support for moving with your left thumb while dashing or pulsing with your right thumb.
- **Landscape Enforcer Overlay**:
  - If a player holds their phone in portrait mode, a sleek visual overlay prompts them to rotate to landscape while automatically pausing physics and muting audio.

---

## 👾 Enemy Roster & Behaviors

1. **Hunter (Coral-Red Octagon)**:
   - Direct pursuit with high acceleration and momentum. Can be juked into arena walls or lured into chasing your Echo ghost.
2. **Interceptor (Golden-Amber Triangle)**:
   - Predictive interceptor. Calculates your velocity vector and leads its trajectory to cut off your escape route.
3. **Sentinel (Electric-Violet Diamond)**:
   - Orbital perimeter patrol guarding high-value shards and the exit portal. Emits a radial radar sweep arc and aggressively charges when targets are detected.

---

## ⚡ Progression, Overclocks & Neon Skins

Collected Energy Shards bank permanently into **Flux Currency (⚡)** across all runs:

### Cyber Lab: Stat Overclocks
- **Phase Engine**: Reduces Dash cooldown by 12% per tier.
- **Flux Magnet**: Expands shard collection attraction radius by +28px per tier.
- **Kinetic Pulse**: Increases Pulse blast radius and stun duration by +15% per tier.
- **Echo Buffer**: Extends Echo delay by +0.35s per tier, giving more room to maneuver.

### Cyber Lab: Avatar Skins
- **Cyber Cyan** (Default): High-voltage electric cyan.
- **Synthwave Sunset**: Radiant neon magenta with solar flare glow.
- **Cyber Emerald**: Vibrant crystalline green.
- **Solar Flare**: Molten fiery amber.
- **Void Specter**: Ultra-clean pure white with dark trail.

---

## 🔊 Zero-Asset Web Audio Synthesizer

LOOP//BREAK has **zero external audio file dependencies**:
- All sound effects (pentatonic shard collection chimes, filtered dash noise whooshes, 808 sub-bass pulse drops, enemy proximity alarms, shield crack impacts, and portal fanfares) are synthesized live using the browser's native **Web Audio API**.
- Includes a procedural 107 BPM ambient cyber-bassline soundtrack with independent SFX and BGM controls.
- Fast load times with zero CORS or 404 audio errors on web portals.

---

## 🚀 Publishing to CrazyGames

The project is built specifically to meet all CrazyGames requirements:
- Sub-second cold boot (< 80 KB total static bundle).
- Standard **CrazyGames v3 SDK** integration with safe local mock fallback.
- `gameplayStart()` and `gameplayStop()` lifecycle triggers on level start, pause, and game over.
- `happytime()` triggers on floor clearances.
- Clean isolation between platform SDK and core gameplay.

### Building for Release
```bash
# 1. Install dependencies
npm install --legacy-peer-deps

# 2. Build production bundle
npm run build
```

The resulting `dist/` folder contains everything needed:
```
dist/
├── index.html
└── assets/
    ├── index-*.css
    └── index-*.js
```

### Packaging for Submission
Compress the contents of the `dist/` directory into a `.zip` archive (ensure `index.html` is in the root of the zip):
```bash
cd dist && zip -r ../loopbreak-crazygames-release.zip . && cd ..
```
Upload `loopbreak-crazygames-release.zip` directly to the **CrazyGames Developer Portal**.

---

## 🛠️ Local Development

```bash
# Start Vite development server
npm run dev

# Preview production build locally
npm run preview
```

Open `http://localhost:3000/` in your browser.
