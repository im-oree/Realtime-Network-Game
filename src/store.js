import { create } from 'zustand'

export const useStore = create((set, get) => ({
  // Game state
  screen:       'menu',         // menu | settings | createRoom | browse | playing
  connected:    false,
  myId:         null,
  roomId:       null,

  // World
  players:      {},
  projectiles:  [],
  grenades:     [],
  gasClouds:    [],
  pickups:      [],
  scores:       {},
  mapSize:      { w: 2400, h: 1400 },

  // Map data (received from server)
  mapData:      null,
  weapons:      {},

  // Events from server (ephemeral per tick)
  events:       [],

  // UI
  paused:       false,
  showScoreboard: false,
  // Mobile / device mode (persisted)
  // read previous preference from localStorage when available
  isMobileMode: (() => {
    try { const v = localStorage.getItem('gridwars_mobileMode'); return v === 'true' } catch (_) { return false }
  })(),
  showDevicePrompt: (() => {
    try { return localStorage.getItem('gridwars_mobileMode') == null } catch (_) { return true }
  })(),

  // Actions
  setScreen:     (s) => set({ screen: s }),
  setConnected:  (v) => set({ connected: v }),
  setMyId:       (id) => set({ myId: id }),
  setRoomId:     (id) => set({ roomId: id }),
  setPaused:     (v) => set({ paused: v }),
  setShowScoreboard: (v) => set({ showScoreboard: v }),
  setMobileMode: (v) => set({ isMobileMode: v }),
  setShowDevicePrompt: (v) => set({ showDevicePrompt: v }),

  setMapData: (data) => set({ mapData: data }),
  setWeapons: (w)    => set({ weapons: w }),

  setWorld: (world) => set(state => ({
    players:     world.players     ?? state.players,
    projectiles: world.projectiles ?? state.projectiles,
    grenades:    world.grenades    ?? state.grenades,
    gasClouds:   world.gasClouds   ?? state.gasClouds,
    pickups:     world.pickups     ?? state.pickups,
    scores:      world.scores      ?? state.scores,
    mapSize:     world.mapSize     ?? state.mapSize,
    events:      world.events      ?? [],
    myId:        world.myId != null ? world.myId : state.myId
  })),

  leaveGame: () => set({
    screen:  'menu',
    roomId:  null,
    players: {},
    projectiles: [],
    grenades: [],
    gasClouds: [],
    pickups: [],
    scores: {},
    mapData: null,
    paused:  false
  })
}))