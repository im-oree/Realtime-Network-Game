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
  if (origin && !isOriginAllowed(origin)) {
    return res.sendStatus(403)
  }

  if (origin) {
    res.setHeader('Access-Control-Allow-Origin', allowedOrigins.includes('*') ? '*' : origin)
    res.setHeader('Vary', 'Origin')
  }
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')

  if (req.method === 'OPTIONS') {
    return res.sendStatus(204)
  }

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
  pingInterval: 2000,
  pingTimeout: 5000
})

// ─── State ──────────────────────────────────────────────────────────────────────
const rooms      = {} // roomId -> GameRoom
const playerRoom = {} // socketId -> roomId
const matchQueue = []
const TICK_RATE  = 1000 / 60

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

// ─── REST endpoints ─────────────────────────────────────────────────────────────
app.get('/rooms', (req, res) => res.json({ rooms: getRoomList() }))
app.get('/maps',  (req, res) => res.json({ maps: getMapList() }))
app.get('/weapons', (req, res) => res.json({ weapons: WEAPONS }))

// ─── Socket.io ──────────────────────────────────────────────────────────────────
io.on('connection', socket => {
  const id = socket.id
  console.log(`+ ${id}`)

  socket.emit('connected', { id })

  // Maps & weapons info
  socket.on('get_maps',    () => socket.emit('maps_list', { maps: getMapList() }))
  socket.on('get_weapons', () => socket.emit('weapons_list', { weapons: WEAPONS }))
  socket.on('request_rooms', () => socket.emit('rooms_list', { rooms: getRoomList() }))

  // ── Create room ───────────────────────────────────────────────────────────
  socket.on('create_room', ({ username, mapId, roomId: rid } = {}) => {
    const roomId = rid || uid('room_')
    if (!rooms[roomId]) {
      rooms[roomId] = new GameRoom(roomId, mapId || 'forest')
    }
    const room = rooms[roomId]
    socket.join(roomId)
    room.addPlayer(id, username || 'Player')
    playerRoom[id] = roomId
    const map = room.map
    socket.emit('room_joined', {
      roomId,
      snapshot: room.buildSnapshot(),
      map: {
        id:          map.id,
        name:        map.name,
        width:       map.width,
        height:      map.height,
        background:  map.background,
        gravity:     map.gravity,
        platforms:   map.platforms,
        walls:       map.walls,
        decorations: map.decorations
      },
      weapons: WEAPONS
    })
    io.to(roomId).emit('player_joined', { id, username: username || 'Player' })
  })

  // ── Join room ─────────────────────────────────────────────────────────────
  socket.on('join_room', ({ roomId, username } = {}) => {
    if (!rooms[roomId]) {
      socket.emit('error_msg', 'Room not found')
      return
    }
    const room = rooms[roomId]
    if (Object.keys(room.players).length >= room.maxPlayers) {
      socket.emit('error_msg', 'Room is full')
      return
    }
    socket.join(roomId)
    room.addPlayer(id, username || 'Player')
    playerRoom[id] = roomId
    const map = room.map
    socket.emit('room_joined', {
      roomId,
      snapshot: room.buildSnapshot(),
      map: {
        id: map.id, name: map.name, width: map.width, height: map.height,
        background: map.background, gravity: map.gravity,
        platforms: map.platforms, walls: map.walls, decorations: map.decorations
      },
      weapons: WEAPONS
    })
    io.to(roomId).emit('player_joined', { id, username: username || 'Player' })
  })

  // ── Quick join ────────────────────────────────────────────────────────────
  socket.on('quick_join', ({ username } = {}) => {
    // Find a room with space
    let target = null
    for (const rid of Object.keys(rooms)) {
      const room = rooms[rid]
      if (Object.keys(room.players).length < room.maxPlayers) {
        target = rid
        break
      }
    }
    if (!target) {
      // Create a new room with random map
      const maps = ['forest', 'desert', 'castle', 'industrial']
      const mapId = maps[Math.floor(Math.random() * maps.length)]
      target = uid('room_')
      rooms[target] = new GameRoom(target, mapId)
    }
    socket.emit('redirect_join', { roomId: target })
    // Client will then emit join_room
  })

  // ── Matchmake ─────────────────────────────────────────────────────────────
  socket.on('matchmake', ({ username } = {}) => {
    if (matchQueue.find(e => e.id === id)) return
    matchQueue.push({ id, username: username || 'Player' })
    if (matchQueue.length >= 2) {
      const a = matchQueue.shift()
      const b = matchQueue.shift()
      const maps = ['forest', 'desert', 'castle', 'industrial']
      const mapId = maps[Math.floor(Math.random() * maps.length)]
      const roomId = uid('match_')
      const room = new GameRoom(roomId, mapId)
      rooms[roomId] = room
      room.addPlayer(a.id, a.username)
      room.addPlayer(b.id, b.username)
      const sa = io.sockets.sockets.get(a.id)
      const sb = io.sockets.sockets.get(b.id)
      const map = room.map
      const payload = {
        roomId,
        snapshot: room.buildSnapshot(),
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

  socket.on('shoot', ({ angle } = {}) => {
    const rid = playerRoom[id]
    if (!rid || !rooms[rid]) return
    rooms[rid].handleShoot(id, angle)
  })

  socket.on('grenade', ({ angle } = {}) => {
    const rid = playerRoom[id]
    if (!rid || !rooms[rid]) return
    rooms[rid].handleGrenade(id, angle)
  })

  socket.on('gas', ({ angle } = {}) => {
    const rid = playerRoom[id]
    if (!rid || !rooms[rid]) return
    rooms[rid].handleGas(id, angle)
  })

  // ── Leave room ────────────────────────────────────────────────────────────
  socket.on('leave_room', () => {
    const rid = playerRoom[id]
    if (rid && rooms[rid]) {
      rooms[rid].removePlayer(id)
      socket.leave(rid)
      io.to(rid).emit('player_left', { id })
      if (Object.keys(rooms[rid].players).length === 0) {
        delete rooms[rid]
      }
    }
    delete playerRoom[id]
  })

  socket.on('disconnect', () => {
    console.log(`- ${id}`)
    const rid = playerRoom[id]
    if (rid && rooms[rid]) {
      rooms[rid].removePlayer(id)
      io.to(rid).emit('player_left', { id })
      if (Object.keys(rooms[rid].players).length === 0) {
        delete rooms[rid]
      }
    }
    delete playerRoom[id]
    const qi = matchQueue.findIndex(e => e.id === id)
    if (qi >= 0) matchQueue.splice(qi, 1)
  })
})

// ─── Game loop ──────────────────────────────────────────────────────────────────
let lastTick = Date.now()

setInterval(() => {
  const now = Date.now()
  const dt  = Math.min((now - lastTick) / 1000, 0.05)
  lastTick  = now

  for (const [rid, room] of Object.entries(rooms)) {
    room.tick(dt)
    const snap = room.buildSnapshot()
    io.to(rid).emit('world_state', {
      ...snap,
      tick:   now,
      events: room.events
    })
  }
}, TICK_RATE)

// ─── Serve ──────────────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 3000
server.listen(PORT, () => console.log(`Server on :${PORT}`))