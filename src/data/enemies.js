// LOOP//BREAK - Enemy archetypes. HP is multiplied by the stage's time-based scaling at spawn.

export const ENEMIES = {
  drone: {
    name: 'Drone', hp: 10, speed: 80, damage: 8, radius: 12, xp: 1,
    color: '#ff4d6d', shape: 'tri',
  },
  swarmer: {
    name: 'Swarmer', hp: 5, speed: 132, damage: 5, radius: 9, xp: 1,
    color: '#ff8a3d', shape: 'dart',
  },
  brute: {
    name: 'Brute', hp: 60, speed: 54, damage: 15, radius: 22, xp: 4,
    color: '#ff3d81', shape: 'hex', mass: 3,
  },
  splitter: {
    name: 'Splitter', hp: 26, speed: 72, damage: 10, radius: 15, xp: 2,
    color: '#ffb13d', shape: 'diamond', split: { into: 'swarmer', count: 3 },
  },
  shooter: {
    name: 'Shooter', hp: 18, speed: 74, damage: 8, radius: 13, xp: 2,
    color: '#f05cff', shape: 'square',
    ranged: { keepDistance: 270, cooldown: 2.6, bulletSpeed: 200, damage: 10 },
  },
  charger: {
    name: 'Charger', hp: 32, speed: 64, damage: 16, radius: 15, xp: 3,
    color: '#ff5a3d', shape: 'arrow',
    charge: { range: 320, windup: 0.65, speed: 540, time: 0.42, cooldown: 3.6 },
  },
  eater: {
    name: 'Echo Eater', hp: 40, speed: 96, damage: 10, radius: 14, xp: 3,
    color: '#b45cff', shape: 'ring', targetsEchoes: true,
  },
  sentinel: {
    name: 'Sentinel Prime', hp: 1100, speed: 70, damage: 20, radius: 34, xp: 40,
    color: '#ff3d6e', shape: 'octa', miniboss: true, mass: 8,
    ranged: { burst: 14, cooldown: 3.2, bulletSpeed: 175, damage: 12 },
  },
  loopkeeper: {
    name: 'THE LOOPKEEPER', hp: 4500, speed: 66, damage: 28, radius: 52, xp: 200,
    color: '#ff2e63', shape: 'boss', boss: true, mass: 20,
    ranged: { burst: 18, cooldown: 2.8, bulletSpeed: 185, damage: 14 },
  },
  fracture: {
    name: 'THE FRACTURE', hp: 7000, speed: 74, damage: 30, radius: 54, xp: 260,
    color: '#3dffd0', shape: 'boss', boss: true, mass: 20,
    ranged: { burst: 22, cooldown: 2.5, bulletSpeed: 195, damage: 15 },
  },
};
