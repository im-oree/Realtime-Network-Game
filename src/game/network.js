// ── network.js ────────────────────────────────────────────────────────────────
// Handles:
//   • Socket.IO connection + all server events
//   • Snapshot interpolation buffer for smooth remote players
//   • RTT / clock-offset measurement for timeline sync
//   • Client-side prediction reconciliation (input replay on server correction)
//
// KEY FIXES vs original:
//   1. Interpolation buffer: we store the last N snapshots and render players
//      at (now - interpolationDelay), smoothly lerping between two bracketing
//      snapshots.  No more snap-to-server-position on every tick.
//   2. Proper reconciliation: when the server corrects our position we replay
//      all pending (unacknowledged) inputs on top of the corrected state.
//   3. RTT measurement: periodic ping so we know true one-way latency and can
//      tune the interpolation delay automatically.
//   4. The extrapolation function is fixed — old one divided position-delta by
//      dt then re-multiplied by dt (a no-op that also caused overshooting).
//
// Usage: import gameClient from './gameClient'
//        gameClient.connect()   ← still the same public API

import { io }        from 'socket.io-client'
import { useStore }  from '../store'

const DEFAULT_API_BASE_URL = 'http://localhost:3000'

function readEnvValue(v) { return typeof v === 'string' ? v.trim() : '' }

export function getApiBaseUrl() {
  const e = readEnvValue(import.meta.env?.VITE_API_BASE_URL)
  return e ? e.replace(/\/$/, '') : DEFAULT_API_BASE_URL
}

export function apiUrl(path = '') {
  const base = getApiBaseUrl()
  const nb   = base.endsWith('/') ? base : `${base}/`
  const np   = path.startsWith('/') ? path.slice(1) : path
  return new URL(np, nb).toString()
}

// ─── Interpolation constants ──────────────────────────────────────────────────
// How far behind "real time" we render remote players (ms).
// Lower = less latency but more visible gaps if a packet drops.
// 100ms is the classic sweet spot; we auto-tune it toward 1.5× measured RTT.
const INTERP_DELAY_MS_DEFAULT = 100
const INTERP_BUFFER_SIZE      = 16   // how many snapshots to keep
const MAX_EXTRAPOLATE_MS      = 200  // never extrapolate beyond this
const RECONCILE_THRESHOLD_SQ  = 100  // px² drift to trigger reconciliation (10px)
const SNAP_THRESHOLD_SQ       = 160000  // px² (400px) — instant snap for teleports

// ─── RTT tracking ─────────────────────────────────────────────────────────────
const RTT_SAMPLES   = 8
const RTT_INTERVAL  = 2000  // measure every 2s

export class NetworkManager {
  constructor() {
    this.socket = null

    // Interpolation
    this._snapshotBuffer  = []     // [{ serverTime, players, ... }, ...]  sorted by serverTime
    this._interpDelay     = INTERP_DELAY_MS_DEFAULT
    this._clockOffset     = 0      // localTime + clockOffset ≈ serverTime

    // RTT
    this._rttSamples  = []
    this._rttTimer    = null
    this._pingSeq     = 0

    // Pending inputs for reconciliation
    this._pendingInputs = []
    this._seq           = 0

    // Callbacks set by GameClient
    this.onWorldUpdate  = null   // (interpolatedWorld) => void
    this.onRoomJoined   = null   // (data) => void
    this.onPlayerJoined = null   // ({ id, username }) => void
    this.onPlayerLeft   = null   // ({ id }) => void
    this.onRedirectJoin = null   // ({ roomId }) => void
    this.onCheatsUpdated= null   // ({ id, cheats }) => void
    this.onError        = null   // (msg) => void
    this.getPhysicsReplay = null // () => fn(player, input, dt)
  }

  // ── Connect ───────────────────────────────────────────────────────────────
  connect() {
    if (this.socket?.connected) return

    this.socket = io(getApiBaseUrl(), {
      transports: ['websocket'],
      // FIX: reconnection with backoff so brief server restarts don't kill clients
      reconnection:      true,
      reconnectionDelay: 500,
      reconnectionDelayMax: 4000
    })

    this.socket.on('connect', () => {
      useStore.getState().setMyId(this.socket.id)
      useStore.getState().setConnected(true)
      this._startRTTMeasurement()
    })

    this.socket.on('disconnect', () => {
      useStore.getState().setConnected(false)
      this._stopRTTMeasurement()
      this._snapshotBuffer = []
    })

    this.socket.on('connected', ({ id }) => {
      useStore.getState().setMyId(id)
    })

    // ── RTT / clock sync ─────────────────────────────────────────────────────
    this.socket.on('ping_res', ({ clientTime, serverTime }) => {
      const now    = performance.now()
      const rtt    = now - clientTime
      const oneWay = rtt / 2

      // Clock offset: how much to add to local performance.now() to get server time
      // serverTime (ms epoch) - (now - oneWay) (local epoch approx)
      const localEpochAtSend = Date.now() - rtt
      this._clockOffset = serverTime - localEpochAtSend

      this._rttSamples.push(rtt)
      if (this._rttSamples.length > RTT_SAMPLES) this._rttSamples.shift()

      // Update interpolation delay: target 1.5× one-way latency, min 50ms, max 200ms
      const avgRTT    = this._rttSamples.reduce((a, b) => a + b, 0) / this._rttSamples.length
      const targetDelay = Math.max(50, Math.min(200, avgRTT * 1.5))
      // Smooth the change so it doesn't cause a jump
      this._interpDelay += (targetDelay - this._interpDelay) * 0.1
    })

    // ── Room joined ──────────────────────────────────────────────────────────
    this.socket.on('room_joined', data => {
      this._snapshotBuffer = []
      this._pendingInputs  = []
      this._seq            = 0
      if (data.serverTime) {
        // Seed clock offset from initial handshake
        this._clockOffset = data.serverTime - Date.now()
      }
      this.onRoomJoined?.(data)
    })

    // ── World state ───────────────────────────────────────────────────────────
    // FIX: instead of immediately applying the snapshot, push it into a buffer.
    // The render loop calls getInterpolatedWorld() which picks the right pair.
    this.socket.on('world_state', snapshot => {
      const ts = snapshot.serverTime ?? Date.now()

      // Push into sorted buffer
      this._snapshotBuffer.push({ ...snapshot, _localRxTime: Date.now() })

      // Keep buffer bounded
      if (this._snapshotBuffer.length > INTERP_BUFFER_SIZE) {
        this._snapshotBuffer.shift()
      }

      // FIX: Reconcile OUR player from the authoritative snapshot, then replay inputs
      const myId = this.socket?.id
      if (myId && snapshot.players?.[myId]) {
        this._reconcileLocalPlayer(snapshot.players[myId], snapshot.lastProcessedSeq)
      }

      // Notify the game loop that new data arrived (for event processing)
      if (this.onWorldUpdate) {
        this.onWorldUpdate(snapshot)
      }
    })

    // ── Other events ─────────────────────────────────────────────────────────
    this.socket.on('player_joined', data => this.onPlayerJoined?.(data))
    this.socket.on('player_left',   data => this.onPlayerLeft?.(data))
    this.socket.on('redirect_join', data => this.onRedirectJoin?.(data))
    this.socket.on('error_msg',     msg  => this.onError?.(msg))

    this.socket.on('cheats_updated', data => {
      this.onCheatsUpdated?.(data)
    })

    this.socket.on('rooms_list', ({ rooms }) => {
      this._roomsCallback?.(rooms)
    })

    // WebRTC signaling — unchanged, just delegated back to caller
    this.socket.on('webrtc-offer',   d => this.onWebRTCOffer?.(d))
    this.socket.on('webrtc-answer',  d => this.onWebRTCAnswer?.(d))
    this.socket.on('ice-candidate',  d => this.onICECandidate?.(d))
  }

  disconnect() {
    this._stopRTTMeasurement()
    this.socket?.disconnect()
    this.socket = null
  }

  // ── Send input ────────────────────────────────────────────────────────────
  sendInput(inp) {
    if (!this.socket?.connected) return
    this._seq++
    const tagged = { ...inp, seq: this._seq }
    this._pendingInputs.push({ ...tagged, timestamp: performance.now() })
    this.socket.emit('input', tagged)
    return tagged
  }

  sendShoot(angle)  { this.socket?.emit('shoot',   { angle }) }
  sendGrenade(angle){ this.socket?.emit('grenade',  { angle }) }
  sendGas(angle)    { this.socket?.emit('gas',      { angle }) }
  sendLeaveRoom()   { this.socket?.emit('leave_room') }
  sendCheatCode(c)  { this.socket?.emit('cheat_code', { code: c }) }
  sendCreateRoom(p) { this.socket?.emit('create_room', p) }
  sendJoinRoom(p)   { this.socket?.emit('join_room',   p) }
  sendQuickJoin(p)  { this.socket?.emit('quick_join',  p) }
  sendMatchmake(p)  { this.socket?.emit('matchmake',   p) }

  requestRooms(cb) {
    this._roomsCallback = cb
    this.socket?.emit('request_rooms')
  }

  get id() { return this.socket?.id }
  get connected() { return !!this.socket?.connected }

  // ── Interpolated world for renderer ──────────────────────────────────────
  // Call this every render frame. Returns a world object with remote players
  // smoothly interpolated between the two nearest snapshots.
  getInterpolatedWorld(myId, predictedPlayer) {
    if (this._snapshotBuffer.length === 0) return null

    // The render time is "now" minus the interpolation delay, in server time
    const renderTime = Date.now() + this._clockOffset - this._interpDelay

    // Find the two snapshots that bracket renderTime
    let older = null
    let newer = null

    for (let i = 0; i < this._snapshotBuffer.length; i++) {
      const snap = this._snapshotBuffer[i]
      const t    = snap.serverTime ?? snap._localRxTime
      if (t <= renderTime) {
        older = snap
      } else if (!newer) {
        newer = snap
        break
      }
    }

    // Pick base snapshot
    let base = newer ?? older ?? this._snapshotBuffer[this._snapshotBuffer.length - 1]

    let interpPlayers = {}

    if (older && newer) {
      // Normal interpolation between two snapshots
      const t0   = older.serverTime ?? older._localRxTime
      const t1   = newer.serverTime ?? newer._localRxTime
      const span = t1 - t0
      const t    = span > 0 ? Math.max(0, Math.min(1, (renderTime - t0) / span)) : 0

      for (const pid of Object.keys(newer.players || {})) {
        if (pid === myId) continue   // local player handled by prediction
        const pOld = older.players?.[pid]
        const pNew = newer.players[pid]
        if (!pOld) {
          interpPlayers[pid] = { ...pNew }
          continue
        }
        interpPlayers[pid] = {
          ...pNew,
          x: _lerp(pOld.x, pNew.x, t),
          y: _lerp(pOld.y, pNew.y, t)
        }
      }
    } else if (older) {
      // Only have older snapshot — extrapolate forward, but cap it
      const age = Date.now() - (older._localRxTime ?? 0)
      const extrapT = Math.min(age / 1000, MAX_EXTRAPOLATE_MS / 1000)

      for (const [pid, p] of Object.entries(older.players || {})) {
        if (pid === myId) continue
        if (p.dead) { interpPlayers[pid] = { ...p }; continue }
        interpPlayers[pid] = {
          ...p,
          x: p.x + (p.vx || 0) * extrapT,
          y: p.y + (p.vy || 0) * extrapT
        }
      }
    } else {
      // Only newer — use it directly
      for (const [pid, p] of Object.entries(newer?.players || {})) {
        if (pid === myId) continue
        interpPlayers[pid] = { ...p }
      }
    }

    // Overlay predicted local player on top
    if (myId && predictedPlayer) {
      interpPlayers[myId] = predictedPlayer
    } else if (myId && base.players?.[myId]) {
      interpPlayers[myId] = base.players[myId]
    }

    return {
      ...base,
      players: interpPlayers,
      myId
    }
  }

  // ── Reconciliation ────────────────────────────────────────────────────────
  // FIX: This is the heart of good client-side prediction.
  // When the server sends us OUR player state:
  //   1. Drop all pending inputs the server has already processed.
  //   2. If the server position differs meaningfully from our prediction,
  //      reset our position to the server's and REPLAY all still-pending inputs
  //      so we land at the correct predicted position — not the old server one.
  _reconcileLocalPlayer(serverPlayer, lastProcessedSeq) {
    const state = useStore.getState()
    let local   = state.predictedPlayer ?? state.players?.[this.socket.id]
    if (!local) return

    // Drop acknowledged inputs
    if (lastProcessedSeq != null) {
      this._pendingInputs = this._pendingInputs.filter(i => i.seq > lastProcessedSeq)
    } else {
      // Server didn't send lastProcessedSeq — keep last 20 inputs as safety window
      if (this._pendingInputs.length > 20) this._pendingInputs = this._pendingInputs.slice(-20)
    }

    // Always sync non-positional authoritative state (hp, ammo, etc.)
    const synced = {
      ...local,
      hp:           serverPlayer.hp,
      armor:        serverPlayer.armor,
      ammo:         serverPlayer.ammo,
      weapon:       serverPlayer.weapon,
      kills:        serverPlayer.kills,
      deaths:       serverPlayer.deaths,
      dead:         serverPlayer.dead,
      respawnTimer: serverPlayer.respawnTimer,
      color:        serverPlayer.color,
      username:     serverPlayer.username,
      grenades:     serverPlayer.grenades,
      gasCanisters: serverPlayer.gasCanisters,
      speedBoost:   serverPlayer.speedBoost,
      rapidFire:    serverPlayer.rapidFire,
      jetpackFuel:  serverPlayer.jetpackFuel
    }

    if (serverPlayer.cheats) {
      synced.cheats = { ...(local.cheats || {}), ...serverPlayer.cheats }
    }

    // Check positional drift
    if (!serverPlayer.dead) {
      const dx    = local.x - serverPlayer.x
      const dy    = local.y - serverPlayer.y
      const distSq = dx * dx + dy * dy

      if (distSq > SNAP_THRESHOLD_SQ) {
        // Huge drift (teleport/respawn) — snap immediately
        synced.x  = serverPlayer.x
        synced.y  = serverPlayer.y
        synced.vx = serverPlayer.vx || 0
        synced.vy = serverPlayer.vy || 0
      } else if (distSq > RECONCILE_THRESHOLD_SQ) {
        // Meaningful drift — reset to server position and replay pending inputs
        synced.x  = serverPlayer.x
        synced.y  = serverPlayer.y
        synced.vx = serverPlayer.vx || 0
        synced.vy = serverPlayer.vy || 0

        // Replay pending inputs using the physics engine
        const replayFn = this.getPhysicsReplay?.()
        if (replayFn && this._pendingInputs.length > 0) {
          let replayed = { ...synced }
          const fixedDt = 1 / 60
          for (const inp of this._pendingInputs) {
            replayFn(replayed, inp, fixedDt)
          }
          synced.x  = replayed.x
          synced.y  = replayed.y
          synced.vx = replayed.vx
          synced.vy = replayed.vy
        }
      }
      // If distSq <= RECONCILE_THRESHOLD_SQ: prediction was close enough, keep local
    } else {
      // Dead — trust server fully
      synced.x = serverPlayer.x
      synced.y = serverPlayer.y
    }

    useStore.getState().setPredictedPlayer(synced)
  }

  // ── RTT measurement ───────────────────────────────────────────────────────
  _startRTTMeasurement() {
    this._stopRTTMeasurement()
    this._rttTimer = setInterval(() => {
      if (this.socket?.connected) {
        this.socket.emit('ping_req', performance.now())
      }
    }, RTT_INTERVAL)
    // Immediate first ping
    if (this.socket?.connected) this.socket.emit('ping_req', performance.now())
  }

  _stopRTTMeasurement() {
    if (this._rttTimer) { clearInterval(this._rttTimer); this._rttTimer = null }
  }

  get rtt() {
    if (this._rttSamples.length === 0) return 0
    return this._rttSamples.reduce((a, b) => a + b, 0) / this._rttSamples.length
  }
}

function _lerp(a, b, t) { return a + (b - a) * t }

// Singleton — matches existing import pattern
export const networkManager = new NetworkManager()
export default networkManager
