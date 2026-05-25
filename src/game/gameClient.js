import { io }          from 'socket.io-client'
import { useStore }    from '../store'
import { PLAYER_SPEED, TICK_MS } from '../config'
import { getApiBaseUrl } from './network'
import ClientPhysics from './clientPhysics'

class GameClient {
  constructor() {
    this.socket        = null
    this.pendingInputs = []
    this.seq           = 0
    this.clientPhysics = null
    this.localInput    = { vx: 0, vy: 0, jump: false, jetpack: false }
    this.networkPlayers = {} // Store for interpolation of remote players
  }

  connect() {
    if (this.socket?.connected) return

    this.socket = io(getApiBaseUrl(), { transports: ['websocket'] })

    this.socket.on('connect', () => {
      useStore.getState().setMyId(this.socket.id)
      useStore.getState().setConnected(true)
    })

    this.socket.on('disconnect', () => {
      useStore.getState().setConnected(false)
    })

    this.socket.on('connected', ({ id }) => {
      useStore.getState().setMyId(id)
    })

    this.socket.on('room_joined', data => {
      useStore.getState().setRoomId(data.roomId)
      if (data.map)     useStore.getState().setMapData(data.map)
      if (data.weapons) useStore.getState().setWeapons(data.weapons)
      if (data.snapshot) {
        useStore.getState().setWorld({
          ...data.snapshot,
          myId: this.socket.id
        })
        // Initialize client physics for this map
        if (data.map && !this.clientPhysics) {
          this.clientPhysics = new ClientPhysics(
            data.map.w,
            data.map.platforms,
            data.map.walls
          )
        }
      }
      useStore.getState().setScreen('playing')
    })

    this.socket.on('world_state', world => {
      const myId = this.socket?.id
      const state = useStore.getState()
      
      // For our own player: use client-side prediction, only apply server corrections periodically
      if (myId && world.players?.[myId] && state.players?.[myId]) {
        const serverPlayer = world.players[myId]
        const localPlayer = state.players[myId]
        
        // Check for misprediction - if server's position differs significantly from ours,
        // apply a gentle correction (lerp) to avoid jarring jumps
        const dx = serverPlayer.x - localPlayer.x
        const dy = serverPlayer.y - localPlayer.y
        const distSq = dx * dx + dy * dy
        
        // If we've drifted too far, correct gradually (reconciliation)
        if (distSq > 400) { // 20px threshold
          serverPlayer.x = localPlayer.x + dx * 0.1 // Gentle correction
          serverPlayer.y = localPlayer.y + dy * 0.1
        } else {
          serverPlayer.x = localPlayer.x
          serverPlayer.y = localPlayer.y
        }
        
        // Apply other server-authoritative data
        serverPlayer.vy = localPlayer.vy
        serverPlayer.hp = serverPlayer.hp // Keep server's hp
        serverPlayer.dead = serverPlayer.dead // Keep server's dead state
      }
      
      // For remote players: interpolate their movement smoothly
      if (world.players) {
        for (const [id, player] of Object.entries(world.players)) {
          if (id === myId) continue
          
          const prev = this.networkPlayers[id]
          if (prev) {
            // Smooth interpolation between last known position and new position
            player._prevX = prev.x
            player._prevY = prev.y
            player._prevTime = prev.time || 0
          }
          
          this.networkPlayers[id] = {
            x: player.x,
            y: player.y,
            time: Date.now()
          }
        }
      }
      
      useStore.getState().setWorld({ ...world, myId })
    })

    this.socket.on('player_left', ({ id }) => {
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
    
    // Send input to server
    const inp = { seq: this.seq, type: 'move', vx, vy, jump, jetpack }
    this.pendingInputs.push(inp)
    this.socket.emit('input', inp)
    
    // Update local input state for client-side prediction
    this.setMovementInput(vx, vy, jump, jetpack)
  }

  // ── Client Physics Update ────────────────────────────────────────────────
  updateClientPhysics(dt) {
    if (!this.clientPhysics) return
    
    const state = useStore.getState()
    const myId = state.myId
    const myPlayer = state.players?.[myId]
    
    if (!myPlayer || myPlayer.dead) return
    
    // Apply client-side physics prediction
    this.clientPhysics.update(myPlayer, this.localInput, dt)
    
    // Update store with new position
    useStore.setState(s => ({
      players: {
        ...s.players,
        [myId]: { ...myPlayer }
      }
    }))
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
}

export default new GameClient()