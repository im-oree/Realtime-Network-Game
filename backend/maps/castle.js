module.exports = {
  id: 'castle',
  name: 'Dark Fortress',
  description: 'Ancient stone fortress with towers and battlements',
  width: 2400,
  height: 1400,
  background: '#0d0d14',
  gravity: 800,

  platforms: [
    // Ground
    { x: 0, y: 1340, w: 2400, h: 60, type: 'ground', color: '#3a3a4a' },

    // Left tower base
    { x: 0, y: 500, w: 200, h: 840, type: 'ground', color: '#4a4a5a' },
    { x: 0, y: 460, w: 250, h: 40, type: 'platform', color: '#5a5a6a' },
    // Left tower upper
    { x: 0, y: 200, w: 150, h: 260, type: 'ground', color: '#4a4a5a' },
    { x: 0, y: 170, w: 180, h: 30, type: 'platform', color: '#6a6a7a' },

    // Right tower base
    { x: 2200, y: 500, w: 200, h: 840, type: 'ground', color: '#4a4a5a' },
    { x: 2150, y: 460, w: 250, h: 40, type: 'platform', color: '#5a5a6a' },
    // Right tower upper
    { x: 2250, y: 200, w: 150, h: 260, type: 'ground', color: '#4a4a5a' },
    { x: 2220, y: 170, w: 180, h: 30, type: 'platform', color: '#6a6a7a' },

    // Center keep
    { x: 1000, y: 1050, w: 400, h: 290, type: 'ground', color: '#4a4a5a' },
    { x: 950, y: 1010, w: 500, h: 40, type: 'platform', color: '#5a5a6a' },
    // Keep upper
    { x: 1050, y: 750, w: 300, h: 25, type: 'platform', color: '#5a5a6a' },
    { x: 1100, y: 500, w: 200, h: 25, type: 'platform', color: '#6a6a7a' },

    // Walkways
    { x: 300, y: 800, w: 350, h: 20, type: 'platform', color: '#5a5a6a' },
    { x: 1750, y: 800, w: 350, h: 20, type: 'platform', color: '#5a5a6a' },

    // Mid bridges
    { x: 650, y: 600, w: 300, h: 18, type: 'platform', color: '#5a5a6a' },
    { x: 1450, y: 600, w: 300, h: 18, type: 'platform', color: '#5a5a6a' },

    // Lower steps
    { x: 350, y: 1150, w: 180, h: 20, type: 'platform', color: '#4a4a5a' },
    { x: 1870, y: 1150, w: 180, h: 20, type: 'platform', color: '#4a4a5a' },
    { x: 550, y: 1000, w: 200, h: 20, type: 'platform', color: '#4a4a5a' },
    { x: 1650, y: 1000, w: 200, h: 20, type: 'platform', color: '#4a4a5a' }
  ],

  walls: [
    { x: 0, y: 0, w: 20, h: 1400 },
    { x: 2380, y: 0, w: 20, h: 1400 },
    // Keep walls
    { x: 1000, y: 1050, w: 25, h: 290 },
    { x: 1375, y: 1050, w: 25, h: 290 },
    // Tower walls
    { x: 196, y: 500, w: 25, h: 200 },
    { x: 2180, y: 500, w: 25, h: 200 },
    // Cover pillars
    { x: 700, y: 1200, w: 40, h: 140 },
    { x: 1660, y: 1200, w: 40, h: 140 }
  ],

  decorations: [
    { type: 'torch', x: 250, y: 480, size: 0.8 },
    { type: 'torch', x: 2150, y: 480, size: 0.8 },
    { type: 'torch', x: 1000, y: 1020, size: 0.8 },
    { type: 'torch', x: 1400, y: 1020, size: 0.8 },
    { type: 'banner', x: 180, y: 180, size: 1.0 },
    { type: 'banner', x: 2270, y: 180, size: 1.0 },
    { type: 'rock', x: 500, y: 1320, size: 1.0 },
    { type: 'rock', x: 1800, y: 1320, size: 1.0 }
  ],

  spawnPoints: [
    { x: 100, y: 440 },
    { x: 2300, y: 440 },
    { x: 400, y: 1280 },
    { x: 800, y: 1280 },
    { x: 1600, y: 1280 },
    { x: 2000, y: 1280 },
    { x: 1200, y: 980 },
    { x: 1200, y: 470 }
  ],

  pickupSpawns: [
    { x: 250, y: 440 },
    { x: 2150, y: 440 },
    { x: 1200, y: 720 },
    { x: 700, y: 570 },
    { x: 1700, y: 570 },
    { x: 1200, y: 980 },
    { x: 500, y: 1120 },
    { x: 1900, y: 1120 }
  ]
}