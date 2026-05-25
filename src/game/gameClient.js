import { io }          from 'socket.io-client'
import { useStore }    from '../store'
import { PLAYER_SPEED, TICK_MS } from '../config'
import { getApiBaseUrl } from './network'
import ClientPhysics from './clientPhysics'
import WebRTCManager from './webrtcManager'
import { OFFLINE_MAP, OFFLINE_WEAPONS, createOfflinePlayer } from './offlinePractice'
import { createOfflineBots, thinkOfflineBot } from './offlineBrain'
import audioManager from './audioManager'

class GameClient {
  constructor() {
    this.socket        = null
    this.webrtc        = null
    this.pendingInputs = []
    this.seq           = 0
    this.clientPhysics = null
    this.localInput    = { vx: 0, vy: 0, jump: false, jetpack: false }
    this.localAimAngle = 0
    this.lastAuthoritativeWorld = null
    this.roomPlayers   = new Set() // Track players in room for WebRTC connections
    this.webrtcEnabled = true // Can be disabled if problems occur
    this.playerPreviousPositions = {} // Track previous positions for extrapolation
    this.playerPreviousAngles = {}
    this.localSimulationEnabled = true
    this.offlineMode   = false
    this.offlineWorld   = null
  }

  startOfflinePractice(username = 'Player') {
    this.disconnect()
    this.webrtc?.disconnect()
    this.webrtc = null

    this.offlineMode = true
    this.pendingInputs = []
    this.seq = 0
    this.roomPlayers = new Set()
    this.playerPreviousPositions = {}
    this.localInput = { vx: 0, vy: 0, jump: false, jetpack: false }

    const player = createOfflinePlayer(username)
    const bots = createOfflineBots(3)
    this.clientPhysics = new ClientPhysics(
      OFFLINE_MAP.width,
      OFFLINE_MAP.height,
      OFFLINE_MAP.gravity,
      OFFLINE_MAP.platforms,
      OFFLINE_MAP.walls
    )

    const players = {
      [player.id]: { ...player },
      ...Object.fromEntries(bots.map(bot => [bot.id, { ...bot }]))
    }

    this.offlineWorld = {
      players,
      playersExtrapolated: { ...players },
      botIds: bots.map(bot => bot.id),
      projectiles: [],
      grenades: [],
      gasClouds: [],
      pickups: [],
      scores: Object.fromEntries(Object.keys(players).map(id => [id, { kills: 0, deaths: 0 }])),
      mapSize: { w: OFFLINE_MAP.width, h: OFFLINE_MAP.height },
      events: []
    }

    useStore.getState().setOfflineMode(true)
    useStore.getState().setConnected(false)
    useStore.getState().setMyId(player.id)
    useStore.getState().setRoomId('offline')
    useStore.getState().setMapData(OFFLINE_MAP)
    useStore.getState().setWeapons(OFFLINE_WEAPONS)
    useStore.getState().resetCheats()
    useStore.getState().setPredictedPlayer({ ...player })
    useStore.getState().setWorld({ ...this.offlineWorld, myId: player.id })
    useStore.getState().setPaused(false)
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
        const localPlayer = state.predictedPlayer || state.players?.[myId]

        // Only update non-movement state from server
        // Client movement is 100% local and runs every frame in updateClientPhysics
        if (localPlayer) {
          const updatedPlayer = {
            ...localPlayer,
            id: myId,
            // Combat/authority state from server only
            hp: serverPlayer.hp,
            armor: serverPlayer.armor,
            ammo: serverPlayer.ammo,
            weapon: serverPlayer.weapon,
            kills: serverPlayer.kills,
            deaths: serverPlayer.deaths,
            dead: serverPlayer.dead,
            respawnTimer: serverPlayer.respawnTimer,
            color: serverPlayer.color,
            username: serverPlayer.username,
            // Preserve all position/velocity fields from local prediction
            // They are ONLY updated by updateClientPhysics, never by server
          }

          // Only snap position back if major cheat detected (>50px drift)
          if (!serverPlayer.dead && localPlayer && serverPlayer.x && serverPlayer.y) {
            const dx = localPlayer.x - serverPlayer.x
            const dy = localPlayer.y - serverPlayer.y
            const drift = Math.sqrt(dx * dx + dy * dy)
            
            if (drift > 50) {
              // Major drift detected - snap back to server position
              updatedPlayer.x = serverPlayer.x
              updatedPlayer.y = serverPlayer.y
              updatedPlayer.vx = serverPlayer.vx || 0
              updatedPlayer.vy = serverPlayer.vy || 0
            }
          }

          // Update cheats from server if present
          if (serverPlayer.cheats) {
            updatedPlayer.cheats = { ...(localPlayer.cheats || {}), ...serverPlayer.cheats }
          }

          useStore.getState().setPredictedPlayer(updatedPlayer)
        }
      }

      this.lastAuthoritativeWorld = nextWorld
      
      // Extrapolate other players' positions for smooth rendering
      // This reduces the appearance of lag for remote players
      nextWorld.playersExtrapolated = this._extrapolatePlayers(nextWorld.players, TICK_MS / 1000)
      
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

  /**
   * Extrapolate player positions based on previous velocity
   * Makes remote players appear to move smoothly instead of snapping
   */
  _extrapolatePlayers(players, dt) {
    const extrapolated = { ...players }
    
    for (const [id, player] of Object.entries(extrapolated)) {
      if (!player || id === this.socket?.id || player.dead) continue
      
      const prev = this.playerPreviousPositions[id]
      if (prev) {
        // Calculate velocity from previous frame
        const vx = (player.x - prev.x) / (dt || 0.016) // Fallback to 60fps
        const vy = (player.y - prev.y) / (dt || 0.016)
        
        // Extrapolate forward based on velocity
        // This makes remote players appear to move smoothly between updates
        extrapolated[id] = {
          ...player,
          x: player.x + vx * (dt || 0.016),
          y: player.y + vy * (dt || 0.016)
        }
      }
      // Smooth / extrapolate aim angle for remote players
      try {
        const prevA = this.playerPreviousAngles[id]
        if (typeof prevA === 'number' && typeof player.angle === 'number') {
          // compute shortest angular difference
          const a = player.angle
          const b = prevA
          const delta = ((((a - b) + Math.PI) % (Math.PI * 2)) + (Math.PI * 2)) % (Math.PI * 2) - Math.PI
          const angularVel = delta / (dt || 0.016)
          const extrapolatedAngle = a + angularVel * (dt || 0.016)
          extrapolated[id] = { ...(extrapolated[id] || player), angle: extrapolatedAngle }
        }
      } catch (_) {}
      
      // Store current position for next extrapolation
      this.playerPreviousPositions[id] = {
        x: player.x,
        y: player.y
      }
      // Store current angle for next frame
      if (typeof player.angle === 'number') this.playerPreviousAngles[id] = player.angle
    }
    
    return extrapolated
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
    this.localInput = { vx, vy, jump, jetpack }
    if (this.offlineMode || !this.socket) return
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

    // Smoothly interpolate local aim angle for visual smoothness
    if (typeof this.localAimAngle === 'number') {
      const a = predicted.angle || 0
      const b = this.localAimAngle
      // Shortest angular lerp
      const diff = ((((b - a) + Math.PI) % (Math.PI * 2)) + (Math.PI * 2)) % (Math.PI * 2) - Math.PI
      const alpha = Math.min(1, 20 * dt) // responsiveness
      predicted.angle = a + diff * alpha
    }

    useStore.getState().setPredictedPlayer(predicted)
  }

  sendAim(angle) {
    // store desired local aim immediately for smoothing
    this.localAimAngle = angle

    if (this.offlineMode || !this.socket) {
      const state = useStore.getState()
      const player = state.predictedPlayer || state.players?.[state.myId]
      if (player) {
        const nextPlayer = { ...player, angle }
        useStore.getState().setPredictedPlayer(nextPlayer)
        useStore.setState(s => ({
          players: { ...s.players, [s.myId]: nextPlayer }
        }))
      }
      return
    }
    this.socket.emit('input', { type: 'aim', angle })
    useStore.setState(s => {
      const p = s.players[s.myId]
      if (!p) return {}
      return { players: { ...s.players, [s.myId]: { ...p, angle } } }
    })
  }

  shoot(angle) {
    if (this.offlineMode || !this.socket) {
      this._offlineShoot(angle)
      return
    }
    const state = useStore.getState()
    const player = state.predictedPlayer || state.players?.[state.myId]
    if (player) {
      audioManager.shoot(player.weapon)
    }
    this.socket.emit('shoot', { angle })
  }

  throwGrenade(angle) {
    if (this.offlineMode || !this.socket) {
      this._offlineThrowGrenade(angle)
      return
    }
    this.socket.emit('grenade', { angle })
  }

  throwGas(angle) {
    if (this.offlineMode || !this.socket) {
      this._offlineThrowGas(angle)
      return
    }
    this.socket.emit('gas', { angle })
  }

  reload() {
    if (this.offlineMode || !this.socket) {
      this._offlineReload()
      return
    }
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
    if (this.socket) {
      this.socket.emit('leave_room')
    }
    this.offlineMode = false
    this.offlineWorld = null
    useStore.getState().leaveGame()
  }

  requestRooms(callback) {
    if (!this.socket) return
    this._roomsCallback = callback
    this.socket.emit('request_rooms')
  }

  applyCheatCode(code) {
    if (this.offlineMode || !this.socket) {
      this._applyOfflineCheatCode(code)
      return
    }
    if (!code) return
    this.socket.emit('cheat_code', { code })
  }

  updateOfflineSimulation(dt) {
    if (!this.offlineMode || !this.offlineWorld) return

    const state = useStore.getState()
    const player = state.predictedPlayer || state.players?.[state.myId]
    if (!player) return

    this._advanceOfflineBots(dt)

    const nextEvents = [...(this.offlineWorld.events || [])]
    const nextProjectiles = []
    const nextGrenades = []
    const nextGasClouds = []
    const map = OFFLINE_MAP

    // Respawn locally without server involvement.
    if (player.dead) {
      const respawnTimer = Math.max(0, (player.respawnTimer ?? 0) - dt)
      const nextPlayer = { ...player, respawnTimer }
      if (respawnTimer <= 0) {
        const spawn = map.spawnPoints[0]
        Object.assign(nextPlayer, createOfflinePlayer(player.username), {
          x: spawn.x,
          y: spawn.y,
          id: player.id,
          username: player.username,
          color: player.color,
          cheats: { ...(player.cheats || {}) }
        })
      }
      useStore.getState().setPredictedPlayer(nextPlayer)
      this._emitOfflineWorldPatch()
      return
    }

    // Finish local reloads.
    if (player.reloading) {
      const weapon = OFFLINE_WEAPONS[player.weapon] || OFFLINE_WEAPONS.pistol
      const reloadTimer = Math.max(0, (player.reloadTimer ?? 0) - dt)
      const nextPlayer = { ...player, reloadTimer }
      if (reloadTimer <= 0) {
        nextPlayer.reloading = false
        nextPlayer.ammo = weapon.magSize
      }
      useStore.getState().setPredictedPlayer(nextPlayer)
      this._emitOfflineWorldPatch()
      return
    }

    // Move bullets / keep effects alive.
    for (const projectile of this.offlineWorld.projectiles || []) {
      const nextProjectile = { ...projectile }
      nextProjectile.x += nextProjectile.vx * dt
      nextProjectile.y += nextProjectile.vy * dt
      nextProjectile.life -= dt

      const hitWorld =
        nextProjectile.x < 0 ||
        nextProjectile.y < 0 ||
        nextProjectile.x > map.width ||
        nextProjectile.y > map.height ||
        this._pointHitsSolid(nextProjectile.x, nextProjectile.y, map)

      if (hitWorld || nextProjectile.life <= 0) {
        if (nextProjectile.explosive) {
          nextEvents.push({
            type: 'explosion',
            x: nextProjectile.x,
            y: nextProjectile.y,
            radius: nextProjectile.explosionRadius || 80
          })
        }
        continue
      }

      nextProjectiles.push(nextProjectile)
    }

    for (const grenade of this.offlineWorld.grenades || []) {
      const nextGrenade = { ...grenade }
      nextGrenade.vy += 800 * dt
      nextGrenade.x += nextGrenade.vx * dt
      nextGrenade.y += nextGrenade.vy * dt
      nextGrenade.fuse -= dt

      if (nextGrenade.x <= 16 || nextGrenade.x >= map.width - 16) {
        nextGrenade.vx *= -0.65
        nextGrenade.x = Math.max(16, Math.min(map.width - 16, nextGrenade.x))
      }
      if (nextGrenade.y >= map.height - 24) {
        nextGrenade.y = map.height - 24
        nextGrenade.vy *= -0.45
      }

      if (nextGrenade.fuse <= 0) {
        nextEvents.push({
          type: 'explosion',
          x: nextGrenade.x,
          y: nextGrenade.y,
          radius: 100
        })
        continue
      }

      nextGrenades.push(nextGrenade)
    }

    for (const gasCloud of this.offlineWorld.gasClouds || []) {
      const nextGas = { ...gasCloud }
      nextGas.life -= dt
      if (nextGas.life > 0) nextGasClouds.push(nextGas)
    }

    this.offlineWorld = {
      ...this.offlineWorld,
      players: { ...(this.offlineWorld.players || {}), [player.id]: { ...player } },
      playersExtrapolated: { ...(this.offlineWorld.playersExtrapolated || this.offlineWorld.players || {}), [player.id]: { ...player } },
      projectiles: nextProjectiles,
      grenades: nextGrenades,
      gasClouds: nextGasClouds,
      events: nextEvents
    }

    useStore.getState().setWorld({
      ...this.offlineWorld,
      myId: player.id
    })
  }

  _pointHitsSolid(x, y, map = OFFLINE_MAP) {
    const solids = [...(map.platforms || []), ...(map.walls || [])]
    return solids.some(rect => x >= rect.x && x <= rect.x + rect.w && y >= rect.y && y <= rect.y + rect.h)
  }

  _offlinePlayer() {
    const state = useStore.getState()
    return state.predictedPlayer || state.players?.[state.myId] || null
  }

  _emitOfflineWorldPatch(patch = {}) {
    if (!this.offlineWorld) return
    const player = this._offlinePlayer()
    const players = { ...(this.offlineWorld.players || {}) }
    if (player) {
      players[player.id] = { ...player }
    }
    this.offlineWorld = {
      ...this.offlineWorld,
      ...patch,
      players,
      playersExtrapolated: players
    }
    useStore.getState().setWorld({ ...this.offlineWorld, myId: player?.id })
  }

  _buildOfflineShot(player, angle, projectiles = []) {
    const weapon = OFFLINE_WEAPONS[player.weapon] || OFFLINE_WEAPONS.pistol
    const nextPlayer = { ...player, lastShot: Date.now(), angle }
    if (!nextPlayer.cheats?.infiniteBullets) {
      nextPlayer.ammo = Math.max(0, (nextPlayer.ammo || 0) - 1)
    }

    for (let i = 0; i < weapon.bulletsPerShot; i++) {
      const spreadAngle = angle + (Math.random() - 0.5) * weapon.spread * 2
      const originX = nextPlayer.x + Math.cos(spreadAngle) * 24
      const originY = nextPlayer.y + Math.sin(spreadAngle) * 24
      projectiles.push({
        id: `offline_b_${Date.now().toString(36)}_${i}`,
        owner: nextPlayer.id,
        x: originX,
        y: originY,
        vx: Math.cos(spreadAngle) * weapon.speed,
        vy: Math.sin(spreadAngle) * weapon.speed,
        life: weapon.bulletLife,
        damage: weapon.damage,
        knockback: weapon.knockback,
        color: weapon.color,
        size: weapon.bulletSize,
        weaponId: weapon.id,
        explosive: weapon.explosive || false,
        explosionRadius: weapon.explosionRadius || 0,
        explosionDamage: weapon.explosionDamage || 0
      })
    }

    return { nextPlayer, projectiles, weapon }
  }

  _advanceOfflineBots(dt) {
    if (!this.offlineWorld?.botIds?.length) return

    const players = { ...(this.offlineWorld.players || {}) }
    const projectiles = [...(this.offlineWorld.projectiles || [])]
    const grenades = [...(this.offlineWorld.grenades || [])]
    const gasClouds = [...(this.offlineWorld.gasClouds || [])]
    const events = []
    const human = this._offlinePlayer()

    if (human) {
      players[human.id] = { ...human }
    }

    const map = OFFLINE_MAP
    const botIds = this.offlineWorld.botIds || []

    for (const [botIndex, botId] of botIds.entries()) {
      const bot = players[botId]
      if (!bot) continue

      if (bot.dead) {
        bot.respawnTimer = Math.max(0, (bot.respawnTimer ?? 0) - dt)
        if (bot.respawnTimer <= 0) {
          const spawn = map.spawnPoints[(botIndex + 1) % map.spawnPoints.length] || map.spawnPoints[0]
          Object.assign(bot, createOfflinePlayer(bot.username), {
            id: bot.id,
            username: bot.username,
            x: spawn.x,
            y: spawn.y,
            color: bot.color,
            weapon: bot.weapon,
            ammo: (OFFLINE_WEAPONS[bot.weapon] || OFFLINE_WEAPONS.pistol).magSize,
            isBot: true,
            brain: bot.brain,
            cheats: { ...(bot.cheats || {}) }
          })
          events.push({ type: 'respawn', playerId: bot.id, x: bot.x, y: bot.y })
        }
        continue
      }

      const command = thinkOfflineBot(bot, { players, map }, dt)

      if (!bot.reloading && bot.ammo <= 0) {
        bot.reloading = true
        bot.reloadTimer = (OFFLINE_WEAPONS[bot.weapon] || OFFLINE_WEAPONS.pistol).reloadTime / 1000
      }

      if (bot.reloading) {
        bot.reloadTimer = Math.max(0, (bot.reloadTimer ?? 0) - dt)
        if (bot.reloadTimer <= 0) {
          bot.reloading = false
          bot.ammo = (OFFLINE_WEAPONS[bot.weapon] || OFFLINE_WEAPONS.pistol).magSize
        }
      }

      if (this.clientPhysics) {
        this.clientPhysics.update(bot, command, dt)
      }

      bot.angle = command.angle
      bot.jetpackActive = !!command.jetpack

      if (command.shoot && !bot.reloading && bot.ammo > 0) {
        const shot = this._buildOfflineShot(bot, command.angle, projectiles)
        Object.assign(bot, shot.nextPlayer, { isBot: true, brain: bot.brain })
        events.push({ type: 'shoot', playerId: bot.id, x: bot.x, y: bot.y, angle: command.angle, weaponId: shot.weapon.id })
      }

      if (command.grenade && (bot.grenades || 0) > 0) {
        bot.grenades -= 1
        bot.lastGrenade = Date.now()
        grenades.push({
          id: `offline_gr_${Date.now().toString(36)}_${bot.id}`,
          owner: bot.id,
          x: bot.x + Math.cos(command.angle) * 20,
          y: bot.y + Math.sin(command.angle) * 20,
          vx: Math.cos(command.angle) * 400,
          vy: Math.sin(command.angle) * 400 - 150,
          fuse: 2.5,
          bounces: 0
        })
        events.push({ type: 'grenade', playerId: bot.id, x: bot.x, y: bot.y, angle: command.angle })
      }

      if (command.gas && (bot.gasCanisters || 0) > 0) {
        bot.gasCanisters -= 1
        bot.lastGas = Date.now()
        gasClouds.push({
          id: `offline_gas_${Date.now().toString(36)}_${bot.id}`,
          owner: bot.id,
          x: bot.x + Math.cos(command.angle) * 200,
          y: bot.y + Math.sin(command.angle) * 200,
          radius: 90,
          duration: 5,
          life: 5,
          damage: 8
        })
        events.push({ type: 'gas', playerId: bot.id, x: bot.x, y: bot.y, angle: command.angle })
      }

      players[bot.id] = bot
    }

    this.offlineWorld = {
      ...this.offlineWorld,
      players,
      playersExtrapolated: { ...players },
      projectiles,
      grenades,
      gasClouds,
      events: [...(this.offlineWorld.events || []), ...events]
    }
  }

  _offlineShoot(angle) {
    const player = this._offlinePlayer()
    if (!player || player.dead) return

    const weapon = OFFLINE_WEAPONS[player.weapon] || OFFLINE_WEAPONS.pistol
    const now = Date.now()
    const cooldown = player.rapidFire ? weapon.fireRate * 0.5 : weapon.fireRate
    if (now - (player.lastShot || 0) < cooldown) return
    if ((player.ammo || 0) <= 0) {
      this._offlineReload()
      return
    }

    const shot = this._buildOfflineShot({ ...player, ammo: player.ammo, rapidFire: player.rapidFire, cheats: player.cheats }, angle, [...(this.offlineWorld?.projectiles || [])])
    const nextPlayer = shot.nextPlayer
    const projectiles = shot.projectiles

    this.offlineWorld = {
      ...this.offlineWorld,
      projectiles,
      events: [
        ...(this.offlineWorld?.events || []),
        { type: 'shoot', playerId: nextPlayer.id, x: nextPlayer.x, y: nextPlayer.y, angle, weaponId: shot.weapon.id }
      ]
    }
    audioManager.shoot(shot.weapon.id)
    useStore.getState().setPredictedPlayer(nextPlayer)
    this._emitOfflineWorldPatch({ projectiles, events: this.offlineWorld.events })
  }

  _offlineThrowGrenade(angle) {
    const player = this._offlinePlayer()
    if (!player || player.dead) return
    const now = Date.now()
    if ((player.grenades || 0) <= 0) return
    if (now - (player.lastGrenade || 0) < 3000) return

    const nextPlayer = {
      ...player,
      grenades: (player.grenades || 0) - 1,
      lastGrenade: now
    }
    const grenades = [...(this.offlineWorld?.grenades || [])]
    grenades.push({
      id: `offline_gr_${Date.now().toString(36)}`,
      owner: nextPlayer.id,
      x: nextPlayer.x + Math.cos(angle) * 20,
      y: nextPlayer.y + Math.sin(angle) * 20,
      vx: Math.cos(angle) * 400,
      vy: Math.sin(angle) * 400 - 150,
      fuse: 2.5,
      bounces: 0
    })
    this.offlineWorld = {
      ...this.offlineWorld,
      grenades,
      events: [
        ...(this.offlineWorld?.events || []),
        { type: 'grenade', playerId: nextPlayer.id, x: nextPlayer.x, y: nextPlayer.y, angle }
      ]
    }
    useStore.getState().setPredictedPlayer(nextPlayer)
    this._emitOfflineWorldPatch({ grenades, events: this.offlineWorld.events })
  }

  _offlineThrowGas(angle) {
    const player = this._offlinePlayer()
    if (!player || player.dead) return
    const now = Date.now()
    if ((player.gasCanisters || 0) <= 0) return
    if (now - (player.lastGas || 0) < 8000) return

    const nextPlayer = {
      ...player,
      gasCanisters: (player.gasCanisters || 0) - 1,
      lastGas: now
    }
    const gasClouds = [...(this.offlineWorld?.gasClouds || [])]
    gasClouds.push({
      id: `offline_gas_${Date.now().toString(36)}`,
      owner: nextPlayer.id,
      x: nextPlayer.x + Math.cos(angle) * 200,
      y: nextPlayer.y + Math.sin(angle) * 200,
      radius: 90,
      duration: 5,
      life: 5,
      damage: 8
    })
    this.offlineWorld = {
      ...this.offlineWorld,
      gasClouds,
      events: [
        ...(this.offlineWorld?.events || []),
        { type: 'gas', playerId: nextPlayer.id, x: nextPlayer.x, y: nextPlayer.y, angle }
      ]
    }
    useStore.getState().setPredictedPlayer(nextPlayer)
    this._emitOfflineWorldPatch({ gasClouds, events: this.offlineWorld.events })
  }

  _offlineReload() {
    const player = this._offlinePlayer()
    if (!player || player.dead || player.reloading) return
    const weapon = OFFLINE_WEAPONS[player.weapon] || OFFLINE_WEAPONS.pistol
    const nextPlayer = {
      ...player,
      reloading: true,
      reloadTimer: weapon.reloadTime / 1000
    }
    useStore.getState().setPredictedPlayer(nextPlayer)
    this._emitOfflineWorldPatch()
  }

  _applyOfflineCheatCode(code) {
    const player = this._offlinePlayer()
    if (!player || !code) return
    const raw = String(code).trim().toUpperCase()
    const cheats = { ...(player.cheats || {}) }
    const syncCheats = () => {
      useStore.getState().setCheats(cheats)
      useStore.getState().setPredictedPlayer({ ...player, cheats })
      this._emitOfflineWorldPatch()
    }

    const setAll = value => {
      cheats.infiniteHealth = value
      cheats.infiniteJetpack = value
      cheats.infiniteBullets = value
      cheats.infiniteLives = value
    }

    switch (raw) {
      case 'GODMODE':
        cheats.infiniteHealth = true
        player.hp = player.maxHp
        break
      case 'INFJETPACK':
        cheats.infiniteJetpack = true
        player.jetpackFuel = 100
        break
      case 'INFBULLETS':
        cheats.infiniteBullets = true
        break
      case 'INFLIFE':
        cheats.infiniteLives = true
        break
      case 'ALL':
        setAll(true)
        player.hp = player.maxHp
        player.jetpackFuel = 100
        break
      case 'RESET':
        setAll(false)
        break
      default:
        if (raw.startsWith('+') || raw.startsWith('-')) {
          const on = raw[0] === '+'
          const key = raw.slice(1)
          if (key === 'GODMODE') cheats.infiniteHealth = on
          if (key === 'INFJETPACK') cheats.infiniteJetpack = on
          if (key === 'INFBULLETS') cheats.infiniteBullets = on
          if (key === 'INFLIFE') cheats.infiniteLives = on
        }
        break
    }

    player.cheats = cheats
    syncCheats()
  }
}

export default new GameClient()