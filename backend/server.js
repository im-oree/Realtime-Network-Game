const express       = require('express')
const http          = require('http')
const path          = require('path')
const { Server }    = require('socket.io')
const GameRoom      = require('./gameRoom')
const { getMapList } = require('./maps')
const { WEAPONS }   = require('./weapons')

const app    = express()
const root   = path.join(__dirname, '..')

function parseAllowedOrigins(value) {
  const origins = typeof value === 'string'
    ? value.split(',').map(origin => origin.trim()).filter(Boolean)
    : []
  return origins.length ? origins : ['*']
}

const allowedOrigins = parseAllowedOrigins(process.env.CORS_ORIGIN || process.env.FRONTEND_ORIGIN)

function isOriginAllowed(origin) {
  if (!origin) return true
  if (allowedOrigins.includes('*')) return true
  return allowedOrigins.includes(origin)
}

app.use((req, res, next) => {
  const origin = req.headers.origin
  if (origin && !isOriginAllowed(origin)) return res.sendStatus(403)
  if (origin) {
    res.setHeader('Access-Control-Allow-Origin', allowedOrigins.includes('*') ? '*' : origin)
    res.setHeader('Vary', 'Origin')
  }
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')
  if (req.method === 'OPTIONS') return res.sendStatus(204)
  next()
})

app.use(express.static(path.join(root, 'dist')))
app.use(express.static(root))

const server = http.createServer(app)
const io     = new Server(server, {
  cors: {
    origin: allowedOrigins.includes('*') ? '*' : allowedOrigins,
    methods: ['GET', 'POST']
  },
  // FIX: Tighter ping settings to detect dead connections faster
  pingInterval: 3000,
  pingTimeout:  8000
})

// ─── State ───────────────────────────────────────────────────────────────────
const rooms      = {}
const playerRoom = {}
const matchQueue = []

// FIX: Two separate rates.
//   PHYSICS_HZ = how often the server simulates (60/s — keep this)
//   BROADCAST_HZ = how often we push world_state to clients (20/s)
//   Clients interpolate between received snapshots → smooth visuals, less bandwidth
const PHYSICS_HZ   = 60
const BROADCAST_HZ = 20
const PHYSICS_MS   = 1000 / PHYSICS_HZ
const BROADCAST_MS = 1000 / BROADCAST_HZ

function uid(prefix = '') {
  return prefix + Date.now().toString(36) + Math.random().toString(36).slice(2, 7)
}

function getRoomList() {
  return Object.keys(rooms).map(rid => ({
    roomId:      rid,
    mapId:       rooms[rid].mapId,
    mapName:     rooms[rid].map.name,
    playerCount: Object.keys(rooms[rid].players).length,
    maxPlayers:  rooms[rid].maxPlayers
  }))
}

// ─── REST ─────────────────────────────────────────────────────────────────────
app.get('/rooms',   (req, res) => res.json({ rooms: getRoomList() }))
app.get('/maps',    (req, res) => res.json({ maps: getMapList() }))
app.get('/weapons', (req, res) => res.json({ weapons: WEAPONS }))

// ─── Socket.io ───────────────────────────────────────────────────────────────
io.on('connection', socket => {
  const id = socket.id
  console.log(`+ ${id}`)
  socket.emit('connected', { id })

  socket.on('get_maps',      () => socket.emit('maps_list',  { maps: getMapList() }))
  socket.on('get_weapons',   () => socket.emit('weapons_list', { weapons: WEAPONS }))
  socket.on('request_rooms', () => socket.emit('rooms_list', { rooms: getRoomList() }))

  // ── Create room ───────────────────────────────────────────────────────────
  socket.on('create_room', ({ username, mapId, roomId: rid } = {}) => {
    const roomId = rid || uid('room_')
    if (!rooms[roomId]) rooms[roomId] = new GameRoom(roomId, mapId || 'forest')
    const room = rooms[roomId]
    socket.join(roomId)
    room.addPlayer(id, username || 'Player')
    playerRoom[id] = roomId
    const map = room.map
    socket.emit('room_joined', {
      roomId,
      snapshot: room.buildSnapshot(),
      // FIX: send server timestamp so client can compute initial latency
      serverTime: Date.now(),
      map: {
        id: map.id, name: map.name, width: map.width, height: map.height,
        background: map.background, gravity: map.gravity,
        platforms: map.platforms, walls: map.walls, decorations: map.decorations
      },
      weapons: WEAPONS
    })
    io.to(roomId).emit('player_joined', { id, username: username || 'Player' })
  })

  // ── Join room ─────────────────────────────────────────────────────────────
  socket.on('join_room', ({ roomId, username } = {}) => {
    if (!rooms[roomId]) { socket.emit('error_msg', 'Room not found'); return }
    const room = rooms[roomId]
    if (Object.keys(room.players).length >= room.maxPlayers) { socket.emit('error_msg', 'Room is full'); return }
    socket.join(roomId)
    room.addPlayer(id, username || 'Player')
    playerRoom[id] = roomId
    const map = room.map
    socket.emit('room_joined', {
      roomId,
      snapshot: room.buildSnapshot(),
      serverTime: Date.now(),
      map: {
        id: map.id, name: map.name, width: map.width, height: map.height,
        background: map.background, gravity: map.gravity,
        platforms: map.platforms, walls: map.walls, decorations: map.decorations
      },
      weapons: WEAPONS
    })
    io.to(roomId).emit('player_joined', { id, username: username || 'Player' })
  })

  // ── WebRTC Signaling ──────────────────────────────────────────────────────
  socket.on('webrtc-offer', ({ to, offer }) => {
    io.sockets.sockets.get(to)?.emit('webrtc-offer', { from: id, offer })
  })
  socket.on('webrtc-answer', ({ to, answer }) => {
    io.sockets.sockets.get(to)?.emit('webrtc-answer', { from: id, answer })
  })
  socket.on('ice-candidate', ({ to, candidate }) => {
    io.sockets.sockets.get(to)?.emit('ice-candidate', { from: id, candidate })
  })

  // ── Quick join ────────────────────────────────────────────────────────────
  socket.on('quick_join', ({ username } = {}) => {
    let target = null
    for (const rid of Object.keys(rooms)) {
      const room = rooms[rid]
      if (Object.keys(room.players).length < room.maxPlayers) { target = rid; break }
    }
    if (!target) {
      const maps = ['forest', 'desert', 'castle', 'industrial']
      target = uid('room_')
      rooms[target] = new GameRoom(target, maps[Math.floor(Math.random() * maps.length)])
    }
    socket.emit('redirect_join', { roomId: target })
  })

  // ── Matchmake ─────────────────────────────────────────────────────────────
  socket.on('matchmake', ({ username } = {}) => {
    if (matchQueue.find(e => e.id === id)) return
    matchQueue.push({ id, username: username || 'Player' })
    if (matchQueue.length >= 2) {
      const a = matchQueue.shift()
      const b = matchQueue.shift()
      const maps = ['forest', 'desert', 'castle', 'industrial']
      const mapId  = maps[Math.floor(Math.random() * maps.length)]
      const roomId = uid('match_')
      const room   = new GameRoom(roomId, mapId)
      rooms[roomId] = room
      room.addPlayer(a.id, a.username)
      room.addPlayer(b.id, b.username)
      const sa = io.sockets.sockets.get(a.id)
      const sb = io.sockets.sockets.get(b.id)
      const map = room.map
      const payload = {
        roomId,
        snapshot: room.buildSnapshot(),
        serverTime: Date.now(),
        map: {
          id: map.id, name: map.name, width: map.width, height: map.height,
          background: map.background, gravity: map.gravity,
          platforms: map.platforms, walls: map.walls, decorations: map.decorations
        },
        weapons: WEAPONS
      }
      if (sa) { sa.join(roomId); playerRoom[a.id] = roomId; sa.emit('room_joined', payload) }
      if (sb) { sb.join(roomId); playerRoom[b.id] = roomId; sb.emit('room_joined', payload) }
    }
  })

  // ── Game input ────────────────────────────────────────────────────────────
  socket.on('input', data => {
    const rid = playerRoom[id]
    if (!rid || !rooms[rid]) return
    rooms[rid].processInput(id, data)
  })
  socket.on('shoot',  ({ angle } = {}) => { const rid = playerRoom[id]; if (rid && rooms[rid]) rooms[rid].handleShoot(id, angle) })
  socket.on('grenade',({ angle } = {}) => { const rid = playerRoom[id]; if (rid && rooms[rid]) rooms[rid].handleGrenade(id, angle) })
  socket.on('gas',    ({ angle } = {}) => { const rid = playerRoom[id]; if (rid && rooms[rid]) rooms[rid].handleGas(id, angle) })

  // ── Leave room ────────────────────────────────────────────────────────────
  socket.on('leave_room', () => cleanupPlayer(id, socket))

  socket.on('disconnect', () => {
    console.log(`- ${id}`)
    cleanupPlayer(id, socket)
    const qi = matchQueue.findIndex(e => e.id === id)
    if (qi >= 0) matchQueue.splice(qi, 1)
  })

  socket.on('cheat_code', (code) => {
    try {
      const rid  = playerRoom[id]
      const room = rid && rooms[rid]
      if (!room || typeof room.applyCheatCode !== 'function') return
      const cheats = room.applyCheatCode(id, code)
      if (cheats) io.to(rid).emit('cheats_updated', { id, cheats })
    } catch (err) {
      console.warn('cheat_code handler error', err)
    }
  })

  // ── Ping / latency measurement ────────────────────────────────────────────
  // FIX: let clients measure their own RTT so network.js can compensate
  socket.on('ping_req', (clientTime) => {
    socket.emit('ping_res', { clientTime, serverTime: Date.now() })
  })
})

function cleanupPlayer(id, socket) {
  const rid = playerRoom[id]
  if (rid && rooms[rid]) {
    rooms[rid].removePlayer(id)
    if (socket) socket.leave(rid)
    io.to(rid).emit('player_left', { id })
    if (Object.keys(rooms[rid].players).length === 0) delete rooms[rid]
  }
  delete playerRoom[id]
}

// ─── Game loop ────────────────────────────────────────────────────────────────
// FIX: Use a high-resolution self-correcting loop instead of setInterval.
// setInterval(fn, 16) in Node.js actually fires every 17-25ms due to timer
// imprecision, causing jitter in the broadcast. We track the ideal next-fire
// time and compensate with a shorter sleep when we're falling behind.

let physicsAccum  = 0   // accumulated real ms since last physics tick
let broadcastAccum = 0  // accumulated real ms since last broadcast
let lastHR         = process.hrtime.bigint()

function gameLoop() {
  const now  = process.hrtime.bigint()
  const elapsedMs = Number(now - lastHR) / 1e6   // nanoseconds → ms
  lastHR = now

  // Guard against huge spikes (tab suspend, debugger pause, etc.)
  const clampedMs = Math.min(elapsedMs, 100)

  physicsAccum   += clampedMs
  broadcastAccum += clampedMs

  // Physics: run as many fixed steps as accumulated
  while (physicsAccum >= PHYSICS_MS) {
    const dt = PHYSICS_MS / 1000   // fixed timestep in seconds
    for (const room of Object.values(rooms)) {
      room.tick(dt)
    }
    physicsAccum -= PHYSICS_MS
  }

  // Broadcast: send snapshots at BROADCAST_HZ
  if (broadcastAccum >= BROADCAST_MS) {
    broadcastAccum -= BROADCAST_MS
    const serverTime = Date.now()
    for (const [rid, room] of Object.entries(rooms)) {
      const snap = room.buildSnapshot()
      io.to(rid).emit('world_state', {
        ...snap,
        // FIX: send server timestamp with every snapshot.
        // Client uses this to drive its interpolation timeline.
        serverTime,
        events: room.events
      })
      // Clear events AFTER broadcast so they aren't lost between physics ticks
      room.events = []
    }
  }

  // Schedule next iteration. Using setImmediate keeps the loop tight and
  // cooperative with the event loop — far more stable than nested setTimeout.
  setImmediate(gameLoop)
}

// Kick off the loop
lastHR = process.hrtime.bigint()
setImmediate(gameLoop)

// ─── Serve ────────────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 3000
server.listen(PORT, () => console.log(`Server on :${PORT} | physics ${PHYSICS_HZ}Hz | broadcast ${BROADCAST_HZ}Hz`))
