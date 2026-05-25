module.exports = {
  id: 'industrial',
  name: 'Abandoned Factory',
  description: 'Rusted factory with conveyor systems and catwalks',
  width: 2400,
  height: 1400,
  background: '#0f1215',
  gravity: 800,

  platforms: [
    // Ground
    { x: 0, y: 1340, w: 2400, h: 60, type: 'ground', color: '#3a3e42' },

    // Left warehouse
    { x: 0, y: 900, w: 400, h: 440, type: 'ground', color: '#4a4e52' },
    { x: 0, y: 860, w: 450, h: 40, type: 'platform', color: '#5a5e62' },
    // Right warehouse
    { x: 2000, y: 900, w: 400, h: 440, type: 'ground', color: '#4a4e52' },
    { x: 1950, y: 860, w: 450, h: 40, type: 'platform', color: '#5a5e62' },

    // Catwalks
    { x: 300, y: 650, w: 400, h: 15, type: 'platform', color: '#6a6e72' },
    { x: 1700, y: 650, w: 400, h: 15, type: 'platform', color: '#6a6e72' },
    { x: 850, y: 550, w: 700, h: 15, type: 'platform', color: '#6a6e72' },

    // Conveyor belts (visual)
    { x: 600, y: 1100, w: 400, h: 20, type: 'platform', color: '#5a4e32' },
    { x: 1400, y: 1100, w: 400, h: 20, type: 'platform', color: '#5a4e32' },

    // Crane platform (high)
    { x: 1050, y: 300, w: 300, h: 20, type: 'platform', color: '#7a7e82' },

    // Support pillars / steps
    { x: 500, y: 1200, w: 120, h: 20, type: 'platform', color: '#4a4e52' },
    { x: 1780, y: 1200, w: 120, h: 20, type: 'platform', color: '#4a4e52' },
    { x: 800, y: 800, w: 180, h: 20, type: 'platform', color: '#5a5e62' },
    { x: 1420, y: 800, w: 180, h: 20, type: 'platform', color: '#5a5e62' },

    // Lower platforms
    { x: 250, y: 1150, w: 200, h: 20, type: 'platform', color: '#4a4e52' },
    { x: 1950, y: 1150, w: 200, h: 20, type: 'platform', color: '#4a4e52' },

    // Crate stacks
    { x: 1100, y: 1200, w: 200, h: 140, type: 'ground', color: '#5a4e32' },
    { x: 1130, y: 1160, w: 140, h: 40, type: 'platform', color: '#6a5e42' }
  ],

  walls: [
    { x: 0, y: 0, w: 20, h: 1400 },
    { x: 2380, y: 0, w: 20, h: 1400 },
    // Warehouse walls
    { x: 395, y: 900, w: 25, h: 300 },
    { x: 1980, y: 900, w: 25, h: 300 },
    // Support columns
    { x: 750, y: 1100, w: 30, h: 240 },
    { x: 1620, y: 1100, w: 30, h: 240 },
    // Crate walls
    { x: 1100, y: 1200, w: 25, h: 140 },
    { x: 1275, y: 1200, w: 25, h: 140 }
  ],

  decorations: [
    { type: 'barrel', x: 300, y: 1310, size: 1.0 },
    { type: 'barrel', x: 2100, y: 1310, size: 1.0 },
    { type: 'barrel', x: 700, y: 1310, size: 0.8 },
    { type: 'barrel', x: 1700, y: 1310, size: 0.8 },
    { type: 'crate', x: 900, y: 1300, size: 1.0 },
    { type: 'crate', x: 1500, y: 1300, size: 1.0 },
    { type: 'pipe', x: 450, y: 680, size: 1.2 },
    { type: 'pipe', x: 1950, y: 680, size: 1.2 }
  ],

  spawnPoints: [
    { x: 200, y: 840 },
    { x: 2200, y: 840 },
    { x: 500, y: 1280 },
    { x: 900, y: 1280 },
    { x: 1500, y: 1280 },
    { x: 1900, y: 1280 },
    { x: 1200, y: 520 },
    { x: 1200, y: 270 }
  ],

  pickupSpawns: [
    { x: 250, y: 830 },
    { x: 2150, y: 830 },
    { x: 1200, y: 270 },
    { x: 900, y: 520 },
    { x: 1500, y: 520 },
    { x: 600, y: 1070 },
    { x: 1800, y: 1070 },
    { x: 1200, y: 1130 }
  ]
}