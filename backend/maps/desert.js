module.exports = {
  id: 'desert',
  name: 'Arid Canyon',
  description: 'Sun-scorched canyon with rocky ledges and sand dunes',
  width: 2400,
  height: 1400,
  background: '#1a150a',
  gravity: 800,

  platforms: [
    // Ground
    { x: 0, y: 1340, w: 900, h: 60, type: 'ground', color: '#8B6914' },
    { x: 1000, y: 1360, w: 400, h: 40, type: 'ground', color: '#8B6914' },
    { x: 1500, y: 1340, w: 900, h: 60, type: 'ground', color: '#8B6914' },

    // Left mesa
    { x: 0, y: 900, w: 350, h: 440, type: 'ground', color: '#a0782c' },
    { x: 0, y: 860, w: 280, h: 40, type: 'platform', color: '#b8923a' },
    // Right mesa
    { x: 2050, y: 900, w: 350, h: 440, type: 'ground', color: '#a0782c' },
    { x: 2120, y: 860, w: 280, h: 40, type: 'platform', color: '#b8923a' },

    // Mid pillars
    { x: 600, y: 1050, w: 120, h: 290, type: 'ground', color: '#a0782c' },
    { x: 1680, y: 1050, w: 120, h: 290, type: 'ground', color: '#a0782c' },

    // Floating ledges
    { x: 400, y: 800, w: 200, h: 20, type: 'platform', color: '#b8923a' },
    { x: 800, y: 700, w: 250, h: 20, type: 'platform', color: '#b8923a' },
    { x: 1100, y: 600, w: 200, h: 20, type: 'platform', color: '#b8923a' },
    { x: 1350, y: 700, w: 250, h: 20, type: 'platform', color: '#b8923a' },
    { x: 1800, y: 800, w: 200, h: 20, type: 'platform', color: '#b8923a' },

    // High perch
    { x: 1050, y: 400, w: 300, h: 20, type: 'platform', color: '#c9a044' },

    // Sand dune ramps
    { x: 300, y: 1280, w: 250, h: 60, type: 'ground', color: '#c9a044' },
    { x: 1850, y: 1280, w: 250, h: 60, type: 'ground', color: '#c9a044' }
  ],

  walls: [
    { x: 0, y: 0, w: 20, h: 1400 },
    { x: 2380, y: 0, w: 20, h: 1400 },
    { x: 650, y: 1050, w: 25, h: 150 },
    { x: 1730, y: 1050, w: 25, h: 150 },
    { x: 1160, y: 700, w: 80, h: 25 },
    { x: 1160, y: 725, w: 25, h: 100 }
  ],

  decorations: [
    { type: 'cactus', x: 200, y: 1320, size: 1.2 },
    { type: 'cactus', x: 500, y: 1310, size: 0.9 },
    { type: 'cactus', x: 900, y: 1330, size: 1.0 },
    { type: 'cactus', x: 1300, y: 1340, size: 1.4 },
    { type: 'cactus', x: 1700, y: 1310, size: 0.8 },
    { type: 'cactus', x: 2100, y: 1320, size: 1.1 },
    { type: 'rock', x: 400, y: 1310, size: 1.3 },
    { type: 'rock', x: 800, y: 1310, size: 1.0 },
    { type: 'rock', x: 1500, y: 1310, size: 1.5 },
    { type: 'rock', x: 2000, y: 1310, size: 0.9 },
    { type: 'skull', x: 1050, y: 1330, size: 0.6 },
    { type: 'skull', x: 700, y: 1060, size: 0.5 }
  ],

  spawnPoints: [
    { x: 150, y: 850 },
    { x: 500, y: 1280 },
    { x: 900, y: 1280 },
    { x: 1200, y: 1300 },
    { x: 1500, y: 1280 },
    { x: 1900, y: 1280 },
    { x: 2250, y: 850 },
    { x: 1200, y: 570 }
  ],

  pickupSpawns: [
    { x: 500, y: 770 },
    { x: 1200, y: 380 },
    { x: 1900, y: 770 },
    { x: 660, y: 1010 },
    { x: 1740, y: 1010 },
    { x: 950, y: 670 },
    { x: 1450, y: 670 },
    { x: 1200, y: 1300 }
  ]
}