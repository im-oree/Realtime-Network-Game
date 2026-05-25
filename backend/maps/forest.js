module.exports = {
  id: 'forest',
  name: 'Enchanted Forest',
  description: 'Dense woodland with clearings and elevated platforms',
  width: 2400,
  height: 1400,
  background: '#0a1a0f',
  gravity: 800,

  // Solid platforms / ground
  platforms: [
    // Ground
    { x: 0, y: 1340, w: 2400, h: 60, type: 'ground', color: '#2d1f0e' },
    // Left cliff
    { x: 0, y: 1100, w: 300, h: 240, type: 'ground', color: '#3d2b16' },
    // Right cliff
    { x: 2100, y: 1100, w: 300, h: 240, type: 'ground', color: '#3d2b16' },

    // Floating platforms
    { x: 350, y: 1050, w: 200, h: 20, type: 'platform', color: '#5a3e1b' },
    { x: 700, y: 900, w: 240, h: 20, type: 'platform', color: '#5a3e1b' },
    { x: 1050, y: 1000, w: 300, h: 20, type: 'platform', color: '#5a3e1b' },
    { x: 1500, y: 900, w: 240, h: 20, type: 'platform', color: '#5a3e1b' },
    { x: 1850, y: 1050, w: 200, h: 20, type: 'platform', color: '#5a3e1b' },

    // High platforms
    { x: 500, y: 700, w: 180, h: 20, type: 'platform', color: '#5a3e1b' },
    { x: 900, y: 620, w: 250, h: 20, type: 'platform', color: '#5a3e1b' },
    { x: 1250, y: 620, w: 250, h: 20, type: 'platform', color: '#5a3e1b' },
    { x: 1700, y: 700, w: 180, h: 20, type: 'platform', color: '#5a3e1b' },

    // Top platforms
    { x: 700, y: 400, w: 200, h: 20, type: 'platform', color: '#5a3e1b' },
    { x: 1100, y: 350, w: 200, h: 20, type: 'platform', color: '#5a3e1b' },
    { x: 1500, y: 400, w: 200, h: 20, type: 'platform', color: '#5a3e1b' },

    // Center bridge
    { x: 1050, y: 780, w: 300, h: 15, type: 'platform', color: '#6b4423' }
  ],

  walls: [
    // Left boundary wall
    { x: 0, y: 0, w: 20, h: 1400 },
    // Right boundary wall
    { x: 2380, y: 0, w: 20, h: 1400 },
    // Some cover walls
    { x: 400, y: 1200, w: 25, h: 140 },
    { x: 1975, y: 1200, w: 25, h: 140 },
    { x: 1175, y: 850, w: 50, h: 120 },
    // Bunkers
    { x: 150, y: 1060, w: 80, h: 40 },
    { x: 2170, y: 1060, w: 80, h: 40 }
  ],

  // Decoration data (trees, rocks, bushes)
  decorations: [
    // Trees (type, x, y, size)
    { type: 'tree', x: 120, y: 1080, size: 1.4 },
    { type: 'tree', x: 350, y: 1320, size: 1.2 },
    { type: 'tree', x: 600, y: 1310, size: 1.6 },
    { type: 'tree', x: 900, y: 1300, size: 1.0 },
    { type: 'tree', x: 1100, y: 1320, size: 1.8 },
    { type: 'tree', x: 1400, y: 1310, size: 1.3 },
    { type: 'tree', x: 1700, y: 1300, size: 1.5 },
    { type: 'tree', x: 2000, y: 1320, size: 1.1 },
    { type: 'tree', x: 2250, y: 1080, size: 1.4 },
    { type: 'tree', x: 800, y: 580, size: 0.9 },
    { type: 'tree', x: 1600, y: 580, size: 0.9 },

    // Rocks
    { type: 'rock', x: 250, y: 1320, size: 1.0 },
    { type: 'rock', x: 750, y: 1320, size: 0.8 },
    { type: 'rock', x: 1250, y: 1320, size: 1.2 },
    { type: 'rock', x: 1800, y: 1320, size: 0.9 },
    { type: 'rock', x: 1050, y: 960, size: 0.7 },

    // Bushes (for hiding)
    { type: 'bush', x: 500, y: 1310, size: 1.0 },
    { type: 'bush', x: 1000, y: 1310, size: 1.2 },
    { type: 'bush', x: 1500, y: 1310, size: 1.0 },
    { type: 'bush', x: 2100, y: 1310, size: 0.9 },
    { type: 'bush', x: 650, y: 870, size: 0.8 },
    { type: 'bush', x: 1750, y: 870, size: 0.8 }
  ],

  spawnPoints: [
    { x: 200, y: 1050 },
    { x: 600, y: 1280 },
    { x: 1000, y: 1280 },
    { x: 1400, y: 1280 },
    { x: 1800, y: 1280 },
    { x: 2200, y: 1050 },
    { x: 800, y: 860 },
    { x: 1600, y: 860 }
  ],

  pickupSpawns: [
    { x: 600, y: 860 },
    { x: 1100, y: 600 },
    { x: 1600, y: 860 },
    { x: 1200, y: 960 },
    { x: 400, y: 1020 },
    { x: 2000, y: 1020 },
    { x: 1200, y: 330 },
    { x: 800, y: 370 },
    { x: 1600, y: 370 }
  ]
}