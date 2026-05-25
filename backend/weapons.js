// ─── Weapon Definitions ────────────────────────────────────────────────────────
const WEAPONS = {
  pistol: {
    id: 'pistol',
    name: 'Pistol',
    damage: 18,
    speed: 650,
    fireRate: 300,       // ms between shots
    bulletLife: 1.8,
    spread: 0.04,        // radians
    bulletsPerShot: 1,
    magSize: 12,
    reloadTime: 1200,
    knockback: 80,
    bulletSize: 4,
    auto: false,
    color: '#facc15',
    zoomFactor: 1.0
  },
  smg: {
    id: 'smg',
    name: 'SMG',
    damage: 10,
    speed: 700,
    fireRate: 80,
    bulletLife: 1.4,
    spread: 0.12,
    bulletsPerShot: 1,
    magSize: 30,
    reloadTime: 1600,
    knockback: 40,
    bulletSize: 3,
    auto: true,
    color: '#f97316',
    zoomFactor: 1.0
  },
  shotgun: {
    id: 'shotgun',
    name: 'Shotgun',
    damage: 12,
    speed: 550,
    fireRate: 600,
    bulletLife: 0.6,
    spread: 0.25,
    bulletsPerShot: 6,
    magSize: 6,
    reloadTime: 2000,
    knockback: 200,
    bulletSize: 3,
    auto: false,
    color: '#ef4444',
    zoomFactor: 1.0
  },
  sniper: {
    id: 'sniper',
    name: 'Sniper',
    damage: 75,
    speed: 1200,
    fireRate: 1200,
    bulletLife: 3.0,
    spread: 0.005,
    bulletsPerShot: 1,
    magSize: 5,
    reloadTime: 2500,
    knockback: 250,
    bulletSize: 3,
    auto: false,
    color: '#a855f7',
    zoomFactor: 2.5
  },
  rifle: {
    id: 'rifle',
    name: 'Assault Rifle',
    damage: 16,
    speed: 750,
    fireRate: 130,
    bulletLife: 1.6,
    spread: 0.06,
    bulletsPerShot: 1,
    magSize: 25,
    reloadTime: 1800,
    knockback: 60,
    bulletSize: 3.5,
    auto: true,
    color: '#22c55e',
    zoomFactor: 1.2
  },
  rpg: {
    id: 'rpg',
    name: 'RPG',
    damage: 60,
    speed: 300,
    fireRate: 2500,
    bulletLife: 3.0,
    spread: 0.01,
    bulletsPerShot: 1,
    magSize: 1,
    reloadTime: 3000,
    knockback: 350,
    bulletSize: 7,
    auto: false,
    color: '#dc2626',
    zoomFactor: 1.0,
    explosive: true,
    explosionRadius: 80,
    explosionDamage: 40
  }
}

// Pickup weapon pool
const WEAPON_PICKUPS = ['smg', 'shotgun', 'sniper', 'rifle', 'rpg']

module.exports = { WEAPONS, WEAPON_PICKUPS }