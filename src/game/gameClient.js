import { io }          from 'socket.io-client'
import { useStore }    from '../store'
import { PLAYER_SPEED, TICK_MS } from '../config'
import { getApiBaseUrl } from './network'
import ClientPhysics from './clientPhysics'
import WebRTCManager from './webrtcManager'

class GameClient {
  constructor() {
    this.socket        = null
    this.webrtc        = null
    this.pendingInputs = []
    this.seq           = 0
    this.clientPhysics = null
    this.localInput    = { vx: 0, vy: 0, jump: false, jetpack: false }
    this.lastAuthoritativeWorld = null
    this.roomPlayers   = new Set() // Track players in room for WebRTC connections
    this.webrtcEnabled = true // Can be disabled if problems occur
  }

  connect() {
    if (this.socket?.connected) return

    this.socket = io(getApiBaseUrl(), { transports: ['websocket'] })

    this.socket.on('connect', () => {
      useStore.getState().setMyId(this.socket.id)
      useStore.getState().setConnected(true)
      this._initWebRTC()
    })

    this.socket.on('disconnect', () => {
      useStore.getState().setConnected(false)
      this.webrtc?.disconnect()
      this.webrtc = null
    })

    this.socket.on('connected', ({ id }) => {
      useStore.getState().setMyId(id)
    })

    // ── WebRTC Signaling ──────────────────────────────────────────────────────
    this.socket.on('webrtc-offer', async ({ from, offer }) => {
      if (!this.webrtc || !this.webrtcEnabled) return
      await this.webrtc.handleOffer(from, offer)
    })

    this.socket.on('webrtc-answer', async ({ from, answer }) => {
      if (!this.webrtc || !this.webrtcEnabled) return
      await this.webrtc.handleAnswer(from, answer)
    })

    this.socket.on('ice-candidate', async ({ from, candidate }) => {
      if (!this.webrtc || !this.webrtcEnabled) return
      await this.webrtc.handleIceCandidate(from, candidate)
    })

    this.socket.on('room_joined', data => {
      useStore.getState().setRoomId(data.roomId)
      if (data.map)     useStore.getState().setMapData(data.map)
      if (data.weapons) useStore.getState().setWeapons(data.weapons)
      if (data.snapshot) {
        const snapshotWorld = { ...data.snapshot, myId: this.socket.id }
        useStore.getState().setWorld(snapshotWorld)
        useStore.getState().setPredictedPlayer(snapshotWorld.players?.[this.socket.id] ? { ...snapshotWorld.players[this.socket.id] } : null)
        
        // Track room players for WebRTC connections
        this.roomPlayers = new Set(Object.keys(snapshotWorld.players || {}))
        this.roomPlayers.delete(this.socket.id) // Don't connect to self
        this._initiatePeerConnections()

        if (data.map) {
          if (!this.clientPhysics) {
            this.clientPhysics = new ClientPhysics(
              data.map.width,
              data.map.height,
              data.map.gravity,
              data.map.platforms,
              data.map.walls
            )
          } else {
            this.clientPhysics.setMapBounds(data.map.width, data.map.height, data.map.gravity)
          }
        }
      }
      useStore.getState().setScreen('playing')
    })

    this.socket.on('world_state', world => {
      const myId = this.socket?.id
      const state = useStore.getState()

      if (this.clientPhysics && world.mapSize) {
        this.clientPhysics.setMapBounds(world.mapSize.w, world.mapSize.h)
      }

      const nextWorld = {
        ...world,
        players: { ...(world.players || {}) }
      }

      if (myId && nextWorld.players[myId]) {
        const serverPlayer = nextWorld.players[myId]
        const lastAck = serverPlayer.lastProcessedSeq || 0

        while (this.pendingInputs.length && this.pendingInputs[0].seq <= lastAck) {
          this.pendingInputs.shift()
        }

        const basePlayer = state.predictedPlayer || state.players?.[myId] || serverPlayer
        const reconciled = { ...basePlayer, ...serverPlayer }

        if (!reconciled.dead) {
          for (const inp of this.pendingInputs) {
            this.clientPhysics?.update(reconciled, inp, inp.dt ?? (TICK_MS / 1000))
          }
        }

        useStore.getState().setPredictedPlayer({
          ...reconciled,
          id: myId,
          hp: serverPlayer.hp,
          armor: serverPlayer.armor,
          ammo: serverPlayer.ammo,
          weapon: serverPlayer.weapon,
          kills: serverPlayer.kills,
          deaths: serverPlayer.deaths,
          dead: serverPlayer.dead,
          respawnTimer: serverPlayer.respawnTimer,
          lastProcessedSeq: serverPlayer.lastProcessedSeq,
          color: serverPlayer.color,
          username: serverPlayer.username
        })
        if (serverPlayer.cheats) {
          const existing = useStore.getState().predictedPlayer || {}
          useStore.getState().setPredictedPlayer({ ...existing, ...serverPlayer, cheats: { ...(existing.cheats || {}), ...serverPlayer.cheats } })
        }
      }

      this.lastAuthoritativeWorld = nextWorld
      useStore.getState().setWorld({ ...nextWorld, myId })
    })

    this.socket.on('player_joined', ({ id, username }) => {
      if (this.webrtcEnabled && this.webrtc && id !== this.socket.id) {
        this.roomPlayers.add(id)
        // We'll be initiator for new players joining after us
        this.webrtc.connectToPeer(id, true)
      }
    })

    this.socket.on('player_left', ({ id }) => {
      if (this.webrtc) {
        this.webrtc._closePeer(id)
      }
      this.roomPlayers.delete(id)
      useStore.setState(s => {
        const p = { ...s.players }
        delete p[id]
        return { players: p }
      })
    })

    this.socket.on('redirect_join', ({ roomId }) => {
      const username = localStorage.getItem('gridwars_username') || 'Player'
      this.joinRoom(roomId, username)
    })

    this.socket.on('error_msg', msg => {
      console.error('Server error:', msg)
    })

    this.socket.on('rooms_list', ({ rooms }) => {
      // Handled by component via callback
      if (this._roomsCallback) this._roomsCallback(rooms)
    })

    this.socket.on('cheats_updated', ({ cheats }) => {
      if (cheats) {
        useStore.getState().setCheats(cheats)
        const existing = useStore.getState().predictedPlayer || {}
        useStore.getState().setPredictedPlayer({ ...existing, cheats: { ...(existing.cheats || {}), ...cheats } })
      }
    })
  }

  /**
   * Initialize WebRTC manager
   */
  _initWebRTC() {
    if (!this.webrtcEnabled) return

    this.webrtc = new WebRTCManager({
      socket: this.socket,
      localId: this.socket.id,
      onMovementUpdate: (data) => {
        // Handle incoming WebRTC movement updates (for future use with other players)
      },
      onPeerDisconnect: (peerId) => {
        console.log(`Peer ${peerId} disconnected`)
      }
    })
  }

  /**
   * Initiate P2P connections with existing room players
   */
  _initiatePeerConnections() {
    if (!this.webrtc || !this.webrtcEnabled) return

    // We're the last one to join, so we initiate connections
    for (const peerId of this.roomPlayers) {
      this.webrtc.connectToPeer(peerId, true)
    }
  }

  disconnect() {
    this.socket?.disconnect()
    this.socket = null
  }

  // ── Movement ──────────────────────────────────────────────────────────────
  setMovementInput(vx, vy, jump, jetpack) {
    // Store input state - will be used in updateClientPhysics()
    this.localInput = { vx, vy, jump, jetpack }
  }

  sendMovement(vx, vy, jump, jetpack, dt) {
    if (!this.socket) return
    this.seq++
    
    // Create input object
    const inp = { seq: this.seq, type: 'move', vx, vy, jump, jetpack, dt }
    this.pendingInputs.push(inp)
    
    // Try WebRTC first (lower latency), with Socket.IO fallback
    let sentViaWebRTC = false
    if (this.webrtcEnabled && this.webrtc) {
      // Broadcast to all connected peers via WebRTC (0-1ms latency vs ~50ms via server)
      const sendCount = this.webrtc.broadcastMovement(inp)
      sentViaWebRTC = sendCount > 0
    }
    
    // Always send to server via Socket.IO (authoritative)
    // Server has latest state and will validate/correct any cheating
    this.socket.emit('input', inp)
    
    // Update local input state for client-side prediction
    this.setMovementInput(vx, vy, jump, jetpack)
  }

  // ── Client Physics Update ────────────────────────────────────────────────
  updateClientPhysics(dt) {
    if (!this.clientPhysics) return
    
    const state = useStore.getState()
    const myId = state.myId
    const myPlayer = state.predictedPlayer || state.players?.[myId]
    
    if (!myPlayer || myPlayer.dead) return

    if (state.mapSize) {
      this.clientPhysics.setMapBounds(state.mapSize.w, state.mapSize.h)
    }
    
    // Apply client-side physics prediction
    const predicted = { ...myPlayer }
    this.clientPhysics.update(predicted, this.localInput, dt)
    
    useStore.getState().setPredictedPlayer(predicted)
  }

  sendAim(angle) {
    if (!this.socket) return
    this.socket.emit('input', { type: 'aim', angle })
    useStore.setState(s => {
      const p = s.players[s.myId]
      if (!p) return {}
      return { players: { ...s.players, [s.myId]: { ...p, angle } } }
    })
  }

  shoot(angle) {
    if (!this.socket) return
    this.socket.emit('shoot', { angle })
  }

  throwGrenade(angle) {
    if (!this.socket) return
    this.socket.emit('grenade', { angle })
  }

  throwGas(angle) {
    if (!this.socket) return
    this.socket.emit('gas', { angle })
  }

  reload() {
    if (!this.socket) return
    this.socket.emit('input', { type: 'reload' })
  }

  createRoom(mapId, username) {
    if (!this.socket) return
    this.socket.emit('create_room', { username, mapId })
  }

  joinRoom(roomId, username) {
    if (!this.socket) return
    this.socket.emit('join_room', { roomId, username })
  }

  quickJoin(username) {
    if (!this.socket) return
    this.socket.emit('quick_join', { username })
  }

  matchmake(username) {
    if (!this.socket) return
    this.socket.emit('matchmake', { username })
  }

  leaveRoom() {
    if (!this.socket) return
    this.socket.emit('leave_room')
    useStore.getState().leaveGame()
  }

  requestRooms(callback) {
    if (!this.socket) return
    this._roomsCallback = callback
    this.socket.emit('request_rooms')
  }

  applyCheatCode(code) {
    if (!this.socket || !code) return
    this.socket.emit('cheat_code', { code })
  }
}

export default new GameClient()