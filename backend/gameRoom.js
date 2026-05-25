const { WEAPONS, WEAPON_PICKUPS } = require('./weapons')
const physics = require('./physics')
const { getMap } = require('./maps')

const PLAYER_SPEED   = 260
const JUMP_FORCE     = -420
const JETPACK_FORCE  = -600
const JETPACK_FUEL_MAX = 100
const JETPACK_DRAIN  = 40   // per sec
const JETPACK_REGEN  = 25   // per sec on ground
const MAX_HP         = 100
const RESPAWN_TIME   = 3.0
const GRENADE_SPEED  = 400
const GRENADE_FUSE   = 2.5
const GRENADE_DAMAGE = 55
const GRENADE_RADIUS = 100
const GRENADE_COOLDOWN = 3000
const GAS_DAMAGE     = 8    // per sec
const GAS_DURATION   = 5
const GAS_RADIUS     = 90
const GAS_COOLDOWN   = 8000

const PICKUP_TYPES = ['health', 'armor', 'jetfuel', 'grenade', 'weapon', 'speed', 'rapidfire']

function uid(prefix = '') {
  return prefix + Date.now().toString(36) + Math.random().toString(36).slice(2, 7)
}

const PLAYER_COLORS = [
  '#ef4444','#f97316','#eab308','#22c55e',
  '#3b82f6','#a855f7','#ec4899','#14b8a6',
  '#6366f1','#d946ef','#f43f5e','#0ea5e9'
]

class GameRoom {
  constructor(roomId, mapId = 'forest', maxPlayers = 8) {
    this.id = roomId
    this.mapId = mapId
    this.map = getMap(mapId)
    this.maxPlayers = maxPlayers
    this.players = {}
    this.inputQueues = {}
    this.projectiles = {}
    this.grenades = {}
    this.gasClouds = {}
    this.pickups = {}
    this.scores = {}
    this.tickCount = 0
    this.lastPickupSpawn = Date.now()
    this.events = []
    this.usedColors = []

    // Initial pickups
    this._spawnInitialPickups()
  }

  _nextColor() {
    const avail = PLAYER_COLORS.filter(c => !this.usedColors.includes(c))
    const color = avail.length > 0
      ? avail[Math.floor(Math.random() * avail.length)]
      : PLAYER_COLORS[Math.floor(Math.random() * PLAYER_COLORS.length)]
    this.usedColors.push(color)
    return color
  }

  _spawnInitialPickups() {
    const spawns = this.map.pickupSpawns || []
    for (let i = 0; i < Math.min(6, spawns.length); i++) {
      this._spawnPickupAt(spawns[i].x, spawns[i].y)
    }
  }

  _spawnPickupAt(x, y) {
    const type = PICKUP_TYPES[Math.floor(Math.random() * PICKUP_TYPES.length)]
    const id = uid('pk_')
    const pickup = { id, type, x, y, spawnedAt: Date.now() }
    if (type === 'weapon') {
      pickup.weaponId = WEAPON_PICKUPS[Math.floor(Math.random() * WEAPON_PICKUPS.length)]
    }
    this.pickups[id] = pickup
  }

  _getSpawnPoint() {
    const spawns = this.map.spawnPoints || [{ x: 400, y: 400 }]
    // Pick spawn farthest from all players
    let best = spawns[0]
    let bestDist = -1
    for (const sp of spawns) {
      let minDist = Infinity
      for (const p of Object.values(this.players)) {
        if (p.dead) continue
        const dx = p.x - sp.x, dy = p.y - sp.y
        const d = dx * dx + dy * dy
        if (d < minDist) minDist = d
      }
      if (minDist > bestDist) {
        bestDist = minDist
        best = sp
      }
    }
    return { x: best.x, y: best.y }
  }

  addPlayer(playerId, username) {
    if (this.players[playerId]) return
    const { x, y } = this._getSpawnPoint()
    const color = this._nextColor()
    this.players[playerId] = {
      id: playerId,
      username: username || 'Player',
      x, y,
      vx: 0, vy: 0,
      angle: 0,
      color,
      hp: MAX_HP,
      maxHp: MAX_HP,
      armor: 0,
      weapon: 'pistol',
      ammo: WEAPONS.pistol.magSize,
      reloading: false,
      reloadTimer: 0,
      lastShot: 0,
      jetpackFuel: JETPACK_FUEL_MAX,
      jetpackActive: false,
      onGround: false,
      dead: false,
      respawnTimer: 0,
      lastProcessedSeq: 0,
      grenades: 3,
      lastGrenade: 0,
      lastGas: 0,
      gasCanisters: 1,
      speedBoost: false,
      speedTimer: 0,
      rapidFire: false,
      rapidTimer: 0,
      kills: 0,
      deaths: 0,
      facing: 1   // 1 = right, -1 = left
    }
    this.inputQueues[playerId] = []
    this.scores[playerId] = this.scores[playerId] || { kills: 0, deaths: 0 }
  }

  removePlayer(playerId) {
    const idx = this.usedColors.indexOf(this.players[playerId]?.color)
    if (idx >= 0) this.usedColors.splice(idx, 1)
    delete this.players[playerId]
    delete this.inputQueues[playerId]
  }

  processInput(playerId, input) {
    if (!this.inputQueues[playerId]) this.inputQueues[playerId] = []
    this.inputQueues[playerId].push(input)
  }

  handleShoot(playerId, angle) {
    const player = this.players[playerId]
    if (!player || player.dead || player.reloading) return

    const wpn = WEAPONS[player.weapon]
    if (!wpn) return

    const now = Date.now()
    const cooldown = player.rapidFire ? wpn.fireRate * 0.5 : wpn.fireRate
    if (now - player.lastShot < cooldown) return
    if (player.ammo <= 0) {
      this._startReload(player)
      return
    }

    player.lastShot = now
    player.ammo -= 1

    for (let i = 0; i < wpn.bulletsPerShot; i++) {
      const spreadAngle = angle + (Math.random() - 0.5) * wpn.spread * 2
      const ox = Math.cos(spreadAngle) * (physics.PLAYER_RADIUS + physics.BULLET_RADIUS + 4)
      const oy = Math.sin(spreadAngle) * (physics.PLAYER_RADIUS + physics.BULLET_RADIUS + 4)
      const projId = uid('b_')
      this.projectiles[projId] = {
        id: projId,
        owner: playerId,
        x: player.x + ox,
        y: player.y + oy,
        vx: Math.cos(spreadAngle) * wpn.speed,
        vy: Math.sin(spreadAngle) * wpn.speed,
        life: wpn.bulletLife,
        damage: wpn.damage,
        knockback: wpn.knockback,
        color: wpn.color,
        size: wpn.bulletSize,
        weaponId: player.weapon,
        explosive: wpn.explosive || false,
        explosionRadius: wpn.explosionRadius || 0,
        explosionDamage: wpn.explosionDamage || 0
      }
    }

    // Camera shake event for shooter
    this.events.push({
      type: 'shoot',
      playerId,
      x: player.x,
      y: player.y,
      angle,
      weaponId: player.weapon
    })

    if (player.ammo <= 0) {
      this._startReload(player)
    }
  }

  _startReload(player) {
    const wpn = WEAPONS[player.weapon]
    if (!wpn || player.reloading) return
    player.reloading = true
    player.reloadTimer = wpn.reloadTime / 1000
  }

  handleGrenade(playerId, angle) {
    const player = this.players[playerId]
    if (!player || player.dead) return
    if (player.grenades <= 0) return
    const now = Date.now()
    if (now - player.lastGrenade < GRENADE_COOLDOWN) return

    player.grenades -= 1
    player.lastGrenade = now

    const id = uid('gr_')
    this.grenades[id] = {
      id,
      owner: playerId,
      x: player.x + Math.cos(angle) * 20,
      y: player.y + Math.sin(angle) * 20,
      vx: Math.cos(angle) * GRENADE_SPEED,
      vy: Math.sin(angle) * GRENADE_SPEED - 150,
      fuse: GRENADE_FUSE,
      bounces: 0
    }

    this.events.push({
      type: 'grenade',
      playerId,
      x: player.x,
      y: player.y,
      angle
    })
  }

  handleGas(playerId, angle) {
    const player = this.players[playerId]
    if (!player || player.dead) return
    if (player.gasCanisters <= 0) return
    const now = Date.now()
    if (now - player.lastGas < GAS_COOLDOWN) return

    player.gasCanisters -= 1
    player.lastGas = now

    const id = uid('gas_')
    const dist = 200
    this.gasClouds[id] = {
      id,
      owner: playerId,
      x: player.x + Math.cos(angle) * dist,
      y: player.y + Math.sin(angle) * dist,
      radius: GAS_RADIUS,
      duration: GAS_DURATION,
      life: GAS_DURATION,
      damage: GAS_DAMAGE
    }
  }

  tick(dt) {
    this.tickCount++
    this.events = []
    const now = Date.now()
    const map = this.map

    // Spawn pickups periodically
    if (now - this.lastPickupSpawn > 10000 && Object.keys(this.pickups).length < 10) {
      const spawns = map.pickupSpawns || []
      if (spawns.length > 0) {
        const sp = spawns[Math.floor(Math.random() * spawns.length)]
        this._spawnPickupAt(sp.x, sp.y)
      }
      this.lastPickupSpawn = now
    }

    // ─── Process inputs ─────────────────────────────────────────────────────
    for (const pid of Object.keys(this.inputQueues)) {
      const queue = this.inputQueues[pid]
      const player = this.players[pid]
      if (!player || player.dead) { if (queue) queue.length = 0; continue }

      while (queue.length) {
        const inp = queue.shift()
        if (inp.type === 'move') {
          let vx = inp.vx || 0
          const spd = player.speedBoost ? PLAYER_SPEED * 1.5 : PLAYER_SPEED
          // Horizontal movement
          if (vx !== 0) {
            player.vx = Math.sign(vx) * spd
            player.facing = vx > 0 ? 1 : -1
          } else {
            player.vx *= 0.7  // friction
          }
          // Jump
          if (inp.jump && player.onGround) {
            player.vy = JUMP_FORCE
            player.onGround = false
          }
          // Jetpack
          player.jetpackActive = !!inp.jetpack
        }
        if (inp.type === 'aim') {
          player.angle = inp.angle || 0
          if (Math.cos(player.angle) > 0) player.facing = 1
          else player.facing = -1
        }
        if (inp.type === 'reload') {
          if (!player.reloading && player.ammo < WEAPONS[player.weapon]?.magSize) {
            this._startReload(player)
          }
        }
        if (inp.seq) player.lastProcessedSeq = inp.seq
      }
    }

    // ─── Integrate players ──────────────────────────────────────────────────
    for (const player of Object.values(this.players)) {
      if (player.dead) {
        player.respawnTimer -= dt
        if (player.respawnTimer <= 0) {
          const { x, y } = this._getSpawnPoint()
          player.x = x; player.y = y
          player.vx = 0; player.vy = 0
          player.hp = player.maxHp
          player.armor = 0
          player.dead = false
          player.weapon = 'pistol'
          player.ammo = WEAPONS.pistol.magSize
          player.reloading = false
          player.jetpackFuel = JETPACK_FUEL_MAX
          player.grenades = Math.max(player.grenades, 2)
          player.gasCanisters = Math.max(player.gasCanisters, 1)
          this.events.push({ type: 'respawn', playerId: player.id, x, y })
        }
        continue
      }

      // Gravity
      player.vy += map.gravity * dt

      // Jetpack
      if (player.jetpackActive && player.jetpackFuel > 0 && !player.onGround) {
        player.vy += JETPACK_FORCE * dt
        player.jetpackFuel -= JETPACK_DRAIN * dt
        if (player.jetpackFuel < 0) player.jetpackFuel = 0
        this.events.push({ type: 'jetpack', playerId: player.id, x: player.x, y: player.y })
      }

      // Regen fuel on ground
      if (player.onGround && player.jetpackFuel < JETPACK_FUEL_MAX) {
        player.jetpackFuel += JETPACK_REGEN * dt
        if (player.jetpackFuel > JETPACK_FUEL_MAX) player.jetpackFuel = JETPACK_FUEL_MAX
      }

      // Integrate position
      player.x += player.vx * dt
      player.y += player.vy * dt

      // Clamp vy
      if (player.vy > 1000) player.vy = 1000

      // Boundary clamp
      const PR = physics.PLAYER_RADIUS
      if (player.x < PR) { player.x = PR; player.vx = 0 }
      if (player.x > map.width - PR) { player.x = map.width - PR; player.vx = 0 }
      if (player.y < PR) { player.y = PR; player.vy = 0 }
      if (player.y > map.height - PR) { player.y = map.height - PR; player.vy = 0; player.onGround = true }

      // Platform / wall collisions
      physics.playerVsPlatforms(player, map.platforms, map.walls)

      // Reload timer
      if (player.reloading) {
        player.reloadTimer -= dt
        if (player.reloadTimer <= 0) {
          player.reloading = false
          player.ammo = WEAPONS[player.weapon]?.magSize || 12
        }
      }

      // Powerup timers
      if (player.speedBoost) {
        player.speedTimer -= dt
        if (player.speedTimer <= 0) player.speedBoost = false
      }
      if (player.rapidFire) {
        player.rapidTimer -= dt
        if (player.rapidTimer <= 0) player.rapidFire = false
      }

      // Pickup collection
      for (const [pkId, pk] of Object.entries(this.pickups)) {
        const dx = player.x - pk.x, dy = player.y - pk.y
        if (dx * dx + dy * dy < (PR + 20) ** 2) {
          this._applyPickup(player, pk)
          delete this.pickups[pkId]
          this.events.push({ type: 'pickup', playerId: player.id, pickupType: pk.type, x: pk.x, y: pk.y })
        }
      }

      // Gas cloud damage
      for (const gas of Object.values(this.gasClouds)) {
        if (gas.owner === player.id) continue
        const dx = player.x - gas.x, dy = player.y - gas.y
        if (dx * dx + dy * dy < gas.radius * gas.radius) {
          player.hp -= gas.damage * dt
          if (player.hp <= 0) {
            this._killPlayer(player, gas.owner)
          }
        }
      }
    }

    // Player-player collisions
    const alive = Object.values(this.players).filter(p => !p.dead)
    physics.playerVsPlayer(alive)

    // ─── Projectiles ────────────────────────────────────────────────────────
    for (const [projId, proj] of Object.entries(this.projectiles)) {
      proj.x += proj.vx * dt
      proj.y += proj.vy * dt
      // Apply gravity to RPG
      if (proj.weaponId === 'rpg') proj.vy += 100 * dt
      proj.life -= dt

      if (proj.life <= 0 || proj.x < 0 || proj.x > map.width || proj.y < 0 || proj.y > map.height) {
        if (proj.explosive) this._explode(proj)
        delete this.projectiles[projId]
        continue
      }

      // Wall/platform hit
      const wallHit = physics.bulletVsPlatforms(proj, map.platforms, map.walls)
      if (wallHit.hit) {
        this.events.push({ type: 'wall_hit', x: proj.x, y: proj.y, weaponId: proj.weaponId })
        if (proj.explosive) this._explode(proj)
        delete this.projectiles[projId]
        continue
      }

      // Player hit
      let projDeleted = false
      for (const player of Object.values(this.players)) {
        if (player.id === proj.owner || player.dead) continue
        if (physics.bulletVsPlayer(proj, player)) {
          if (proj.explosive) {
            this._explode(proj)
          } else {
            this._damagePlayer(player, proj.damage, proj.owner, proj)
          }
          delete this.projectiles[projId]
          projDeleted = true
          break
        }
      }
      if (projDeleted) continue
    }

    // ─── Grenades ───────────────────────────────────────────────────────────
    for (const [gid, gren] of Object.entries(this.grenades)) {
      gren.vy += map.gravity * dt
      gren.x += gren.vx * dt
      gren.y += gren.vy * dt
      gren.fuse -= dt

      // Bounce off platforms
      const hit = physics.bulletVsPlatforms(gren, map.platforms, map.walls)
      if (hit.hit) {
        gren.vy *= -0.4
        gren.vx *= 0.6
        gren.bounces++
      }

      // Floor bounce
      if (gren.y > map.height - 10) {
        gren.y = map.height - 10
        gren.vy *= -0.3
        gren.vx *= 0.7
      }

      if (gren.fuse <= 0) {
        // Explode
        for (const player of Object.values(this.players)) {
          if (player.dead) continue
          const dx = player.x - gren.x, dy = player.y - gren.y
          const dist = Math.sqrt(dx * dx + dy * dy)
          if (dist < GRENADE_RADIUS) {
            const falloff = 1 - (dist / GRENADE_RADIUS)
            const dmg = GRENADE_DAMAGE * falloff
            this._damagePlayer(player, dmg, gren.owner, null)
            // Knockback
            const len = dist || 1
            player.vx += (dx / len) * 300 * falloff
            player.vy += (dy / len) * -250 * falloff
          }
        }
        this.events.push({ type: 'explosion', x: gren.x, y: gren.y, radius: GRENADE_RADIUS })
        delete this.grenades[gid]
      }
    }

    // ─── Gas clouds ─────────────────────────────────────────────────────────
    for (const [gid, gas] of Object.entries(this.gasClouds)) {
      gas.life -= dt
      if (gas.life <= 0) {
        delete this.gasClouds[gid]
      }
    }
  }

  _explode(proj) {
    const r = proj.explosionRadius || 80
    const dmg = proj.explosionDamage || 40
    for (const player of Object.values(this.players)) {
      if (player.dead) continue
      const dx = player.x - proj.x, dy = player.y - proj.y
      const dist = Math.sqrt(dx * dx + dy * dy)
      if (dist < r) {
        const falloff = 1 - (dist / r)
        this._damagePlayer(player, dmg * falloff + proj.damage * 0.5, proj.owner, null)
        const len = dist || 1
        player.vx += (dx / len) * 350 * falloff
        player.vy += (dy / len) * -300 * falloff
      }
    }
    this.events.push({ type: 'explosion', x: proj.x, y: proj.y, radius: r })
  }

  _damagePlayer(player, damage, attackerId, proj) {
    // Armor absorbs 50%
    if (player.armor > 0) {
      const absorbed = Math.min(player.armor, damage * 0.5)
      player.armor -= absorbed
      damage -= absorbed
    }
    player.hp -= damage

    if (proj) {
      // Knockback
      const len = Math.sqrt(proj.vx ** 2 + proj.vy ** 2) || 1
      player.vx += (proj.vx / len) * (proj.knockback || 60)
      player.vy += (proj.vy / len) * (proj.knockback || 60) * 0.5
    }

    this.events.push({
      type: 'hit',
      targetId: player.id,
      attackerId,
      damage,
      x: player.x,
      y: player.y
    })

    if (player.hp <= 0) {
      this._killPlayer(player, attackerId)
    }
  }

  _killPlayer(player, killerId) {
    player.hp = 0
    player.dead = true
    player.respawnTimer = RESPAWN_TIME
    player.deaths++
    if (this.scores[player.id]) this.scores[player.id].deaths++

    if (killerId && this.players[killerId]) {
      this.players[killerId].kills++
      if (this.scores[killerId]) this.scores[killerId].kills++
    }

    this.events.push({
      type: 'kill',
      killer: killerId,
      victim: player.id,
      x: player.x,
      y: player.y,
      color: player.color
    })
  }

  _applyPickup(player, pickup) {
    switch (pickup.type) {
      case 'health':
        player.hp = Math.min(player.hp + 40, player.maxHp)
        break
      case 'armor':
        player.armor = Math.min(player.armor + 50, 100)
        break
      case 'jetfuel':
        player.jetpackFuel = JETPACK_FUEL_MAX
        break
      case 'grenade':
        player.grenades = Math.min(player.grenades + 2, 5)
        break
      case 'weapon':
        if (pickup.weaponId && WEAPONS[pickup.weaponId]) {
          player.weapon = pickup.weaponId
          player.ammo = WEAPONS[pickup.weaponId].magSize
          player.reloading = false
        }
        break
      case 'speed':
        player.speedBoost = true
        player.speedTimer = 6
        break
      case 'rapidfire':
        player.rapidFire = true
        player.rapidTimer = 6
        break
    }
  }

  buildSnapshot() {
    const players = {}
    for (const [id, p] of Object.entries(this.players)) {
      players[id] = {
        id: p.id,
        username: p.username,
        x: p.x, y: p.y,
        vx: p.vx, vy: p.vy,
        angle: p.angle,
        color: p.color,
        hp: p.hp,
        maxHp: p.maxHp,
        armor: p.armor,
        weapon: p.weapon,
        ammo: p.ammo,
        reloading: p.reloading,
        jetpackFuel: p.jetpackFuel,
        jetpackActive: p.jetpackActive,
        onGround: p.onGround,
        dead: p.dead,
        respawnTimer: p.respawnTimer,
        lastProcessedSeq: p.lastProcessedSeq,
        grenades: p.grenades,
        gasCanisters: p.gasCanisters,
        speedBoost: p.speedBoost,
        rapidFire: p.rapidFire,
        facing: p.facing,
        kills: p.kills,
        deaths: p.deaths
      }
    }
    return {
      players,
      projectiles: Object.values(this.projectiles),
      grenades: Object.values(this.grenades),
      gasClouds: Object.values(this.gasClouds),
      pickups: Object.values(this.pickups),
      scores: this.scores,
      mapId: this.mapId,
      mapSize: { w: this.map.width, h: this.map.height },
      tickCount: this.tickCount
    }
  }
}

module.exports = GameRoom