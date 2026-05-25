import { io }          from 'socket.io-client'
import { useStore }    from '../store'
import { PLAYER_SPEED, TICK_MS } from '../config'
import { getApiBaseUrl } from './network'

class GameClient {
  constructor() {
    this.socket        = null
    this.pendingInputs = []
    this.seq           = 0
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
      }
      useStore.getState().setScreen('playing')
    })

    this.socket.on('world_state', world => {
      const myId = this.socket?.id
      if (myId && world.players?.[myId]) {
        const lastAck = world.players[myId].lastProcessedSeq || 0
        while (this.pendingInputs.length && this.pendingInputs[0].seq <= lastAck) {
          this.pendingInputs.shift()
        }
        let x = world.players[myId].x
        let y = world.players[myId].y
        for (const inp of this.pendingInputs) {
          if (inp.type !== 'move') continue
          const dt = inp.dt ?? (TICK_MS / 1000)
          x += (inp.vx || 0) * dt
        }
        world.players[myId].x = x
        world.players[myId].y = y
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
  sendMovement(vx, vy, jump, jetpack, dt) {
    if (!this.socket) return
    this.seq++
    const inp = { seq: this.seq, type: 'move', vx, vy, jump, jetpack, dt }
    this.pendingInputs.push({ ...inp })
    this.socket.emit('input', inp)

    // Optimistic update (horizontal only, let server handle gravity)
    useStore.setState(s => {
      const p = s.players[s.myId]
      if (!p || p.dead) return {}
      const mw = s.mapSize?.w || 2400
      return {
        players: {
          ...s.players,
          [s.myId]: {
            ...p,
            x: Math.max(16, Math.min(mw - 16, p.x + vx * dt))
          }
        }
      }
    })
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