// ── network.js ────────────────────────────────────────────────────────────────
// Handles:
//   • Socket.IO connection + all server events
//   • Snapshot interpolation buffer for smooth remote players
//   • RTT / clock-offset measurement for timeline sync
//   • Client-side prediction reconciliation (input replay on server correction)

import { io }      from 'socket.io-client'
import { useStore } from '../store'

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
const INTERP_DELAY_MS_DEFAULT = 100
const INTERP_BUFFER_SIZE      = 16   
const MAX_EXTRAPOLATE_MS      = 200  
const RECONCILE_THRESHOLD_SQ  = 100  // px² drift to trigger reconciliation (10px)
const SNAP_THRESHOLD_SQ       = 160000 // px² (400px) — instant snap for teleports

// ─── RTT tracking ─────────────────────────────────────────────────────────────
const RTT_SAMPLES   = 8
const RTT_INTERVAL  = 2000  

export class NetworkManager {
  constructor() {
    this.socket = null

    // Interpolation
    this._snapshotBuffer  = []     // [{ serverTime, players, ... }, ...] sorted chronologically
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
    this.onWorldUpdate   = null 
    this.onRoomJoined    = null 
    this.onPlayerJoined  = null 
    this.onPlayerLeft    = null 
    this.onRedirectJoin  = null 
    this.onCheatsUpdated = null 
    this.onError         = null 
    this.getPhysicsReplay = null

    // WebRTC signaling callbacks
    this.onWebRTCOffer   = null
    this.onWebRTCAnswer  = null
    this.onICECandidate  = null
    this._roomsCallback  = null
  }

  // ── Connect ───────────────────────────────────────────────────────────────
  connect() {
    // FIX: Guard against active or pending connection handles to prevent memory leaks
    if (this.socket) return

    this.socket = io(getApiBaseUrl(), {
      transports: ['websocket'],
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

      // FIX: Server stamps the time at the mid-point of transit (oneWay duration)
      const localEpochAtServerProcess = Date.now() - oneWay
      this._clockOffset = serverTime - localEpochAtServerProcess

      this._rttSamples.push(rtt)
      if (this._rttSamples.length > RTT_SAMPLES) this._rttSamples.shift()

      const avgRTT      = this._rttSamples.reduce((a, b) => a + b, 0) / this._rttSamples.length
      const targetDelay = Math.max(50, Math.min(200, avgRTT * 1.5))
      
      this._interpDelay += (targetDelay - this._interpDelay) * 0.1
    })

    // ── Room joined ──────────────────────────────────────────────────────────
    this.socket.on('room_joined', data => {
      this._snapshotBuffer = []
      this._pendingInputs  = []
      this._seq            = 0
      if (data.serverTime) {
        this._clockOffset = data.serverTime - Date.now()
      }
      this.onRoomJoined?.(data)
    })

    // ── World state ───────────────────────────────────────────────────────────
    this.socket.on('world_state', snapshot => {
      // Push into buffer and force timeline-sorted structural integrity
      this._snapshotBuffer.push({ ...snapshot, _localRxTime: Date.now() })
      
      // FIX: Sort explicitly to absorb frame anomalies or transport out-of-order jitter
      this._snapshotBuffer.sort((a, b) => {
        const tA = a.serverTime ?? a._localRxTime
        const tB = b.serverTime ?? b._localRxTime
        return tA - tB
      })

      if (this._snapshotBuffer.length > INTERP_BUFFER_SIZE) {
        this._snapshotBuffer.shift()
      }

      // FIX: Ensure ID resolves against store allocations if custom mapping exists
      const myId = useStore.getState().myId || this.socket?.id
      if (myId && snapshot.players?.[myId]) {
        this._reconcileLocalPlayer(snapshot.players[myId], snapshot.lastProcessedSeq)
      }

      if (this.onWorldUpdate) {
        this.onWorldUpdate(snapshot)
      }
    })

    // ── Other events ─────────────────────────────────────────────────────────
    this.socket.on('player_joined', data => this.onPlayerJoined?.(data))
    this.socket.on('player_left',   data => this.onPlayerLeft?.(data))
    this.socket.on('redirect_join', data => this.onRedirectJoin?.(data))
    this.socket.on('error_msg',     msg  => this.onError?.(msg))
    this.socket.on('cheats_updated', data => this.onCheatsUpdated?.(data))

    this.socket.on('rooms_list', ({ rooms }) => {
      this._roomsCallback?.(rooms)
    })

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
  getInterpolatedWorld(myId, predictedPlayer) {
    if (this._snapshotBuffer.length === 0) return null

    const renderTime = Date.now() + this._clockOffset - this._interpDelay

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

    let base = newer ?? older ?? this._snapshotBuffer[this._snapshotBuffer.length - 1]
    let interpPlayers = {}

    if (older && newer) {
      const t0   = older.serverTime ?? older._localRxTime
      const t1   = newer.serverTime ?? newer._localRxTime
      const span = t1 - t0
      const t    = span > 0 ? Math.max(0, Math.min(1, (renderTime - t0) / span)) : 0

      for (const pid of Object.keys(newer.players || {})) {
        if (pid === myId) continue  
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
      // FIX: Extrapolate relative to your rendering timeline, not arbitrary packet RX times
      const olderTime = older.serverTime ?? older._localRxTime
      const extrapMs  = Math.max(0, Math.min(renderTime - olderTime, MAX_EXTRAPOLATE_MS))
      const extrapT   = extrapMs / 1000

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
      for (const [pid, p] of Object.entries(newer?.players || {})) {
        if (pid === myId) continue
        interpPlayers[pid] = { ...p }
      }
    }

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
  _reconcileLocalPlayer(serverPlayer, lastProcessedSeq) {
    const state = useStore.getState()
    const myId  = state.myId || this.socket?.id
    let local   = state.predictedPlayer ?? state.players?.[myId]
    if (!local) return

    if (lastProcessedSeq != null) {
      this._pendingInputs = this._pendingInputs.filter(i => i.seq > lastProcessedSeq)
    } else if (this._pendingInputs.length > 20) {
      this._pendingInputs = this._pendingInputs.slice(-20)
    }

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

    if (!serverPlayer.dead) {
      const dx     = local.x - serverPlayer.x
      const dy     = local.y - serverPlayer.y
      const distSq = dx * dx + dy * dy

      if (distSq > SNAP_THRESHOLD_SQ) {
        synced.x  = serverPlayer.x
        synced.y  = serverPlayer.y
        synced.vx = serverPlayer.vx || 0
        synced.vy = serverPlayer.vy || 0
      } else if (distSq > RECONCILE_THRESHOLD_SQ) {
        synced.x  = serverPlayer.x
        synced.y  = serverPlayer.y
        synced.vx = serverPlayer.vx || 0
        synced.vy = serverPlayer.vy || 0

        const replayFn = this.getPhysicsReplay?.()
        if (replayFn && this._pendingInputs.length > 0) {
          let replayed = { ...synced }
          const fixedDt = 1 / 60
          
          for (const inp of this._pendingInputs) {
            // Fall back to original frame dt if sent with input metadata
            replayFn(replayed, inp, inp.dt || fixedDt)
          }
          synced.x  = replayed.x
          synced.y  = replayed.y
          synced.vx = replayed.vx
          synced.vy = replayed.vy
        }
      }
    } else {
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
    
    if (this.socket?.connected) this.socket.emit('ping_req', performance.now())
  }

  _stopRTTMeasurement() {
    if (this._rttTimer) { 
      clearInterval(this._rttTimer)
      this._rttTimer = null 
    }
  }

  get rtt() {
    if (this._rttSamples.length === 0) return 0
    return this._rttSamples.reduce((a, b) => a + b, 0) / this._rttSamples.length
  }
}

function _lerp(a, b, t) { return a + (b - a) * t }

export const networkManager = new NetworkManager()
export default networkManager