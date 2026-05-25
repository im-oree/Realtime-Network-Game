// ── Client-Side Physics Prediction ──────────────────────────────────────────
// This runs locally on the client every frame for instant feedback
// Server validates/corrects periodically and broadcasts other players

const PLAYER_RADIUS = 16
const DEFAULT_GRAVITY = 800  // pixels/s²
const PLAYER_SPEED = 260     // pixels/s
const JUMP_FORCE = -420
const JUMP_DEBOUNCE = 300    // ms minimum between jumps
const JETPACK_FORCE = -600
const JETPACK_DRAIN = 40     // per sec
const JETPACK_REGEN = 25     // per sec on ground
const JETPACK_FUEL_MAX = 100

export class ClientPhysics {
  constructor(mapWidth, mapHeight, gravity, platforms, walls) {
    this.mapWidth = mapWidth || 2400
    this.mapHeight = mapHeight || 1400
    this.gravity = gravity || DEFAULT_GRAVITY
    this.platforms = platforms || []
    this.walls = walls || []
    this.allColliders = [...this.platforms, ...this.walls.map(w => ({ ...w, type: 'wall' }))]
  }

  setMapBounds(mapWidth, mapHeight, gravity) {
    if (Number.isFinite(mapWidth) && mapWidth > 0) this.mapWidth = mapWidth
    if (Number.isFinite(mapHeight) && mapHeight > 0) this.mapHeight = mapHeight
    if (Number.isFinite(gravity) && gravity > 0) this.gravity = gravity
  }

  // ── Collision Detection ──────────────────────────────────────────────────
  checkCollisionsY(player, dt) {
    player.onGround = false

    for (const plat of this.allColliders) {
      if (this._rectVsCircle(player.x, player.y, PLAYER_RADIUS, plat)) {
        const collision = this._resolveRectVsCircle(player, PLAYER_RADIUS, plat)
        if (collision) {
          // Hit from above (landed)
          if (collision.ny < -0.5) {
            player.onGround = true
            if (player.vy > 0) player.vy = 0
          }
          // Hit from below
          if (collision.ny > 0.5 && player.vy < 0) {
            player.vy = 0
          }
        }
      }
    }
  }

  checkCollisionsX(player) {
    for (const plat of this.allColliders) {
      if (this._rectVsCircle(player.x, player.y, PLAYER_RADIUS, plat)) {
        const collision = this._resolveRectVsCircle(player, PLAYER_RADIUS, plat)
        if (collision && Math.abs(collision.nx) > 0.5) {
          player.vx *= 0.3
        }
      }
    }
  }

  _rectVsCircle(cx, cy, cr, rect) {
    const nearX = Math.max(rect.x, Math.min(cx, rect.x + rect.w))
    const nearY = Math.max(rect.y, Math.min(cy, rect.y + rect.h))
    const dx = cx - nearX
    const dy = cy - nearY
    return dx * dx + dy * dy < cr * cr
  }

  _resolveRectVsCircle(circle, cr, rect) {
    const nearX = Math.max(rect.x, Math.min(circle.x, rect.x + rect.w))
    const nearY = Math.max(rect.y, Math.min(circle.y, rect.y + rect.h))
    const dx = circle.x - nearX
    const dy = circle.y - nearY
    const dist = Math.sqrt(dx * dx + dy * dy) || 0.001
    const overlap = cr - dist
    if (overlap > 0) {
      circle.x += (dx / dist) * overlap
      circle.y += (dy / dist) * overlap
      return { nx: dx / dist, ny: dy / dist, overlap }
    }
    return null
  }

  // ── Physics Update ───────────────────────────────────────────────────────
  update(player, input, dt) {
    // Apply velocity from input
    if (input.vx !== undefined) {
      player.vx = Math.max(-PLAYER_SPEED, Math.min(PLAYER_SPEED, input.vx * PLAYER_SPEED))
    }

    // Jump is applied before gravity, matching the server's processing order
    if (input.jump && player.onGround) {
      const now = Date.now()
      if (!player._lastJumpTime || now - player._lastJumpTime > JUMP_DEBOUNCE) {
        player.vy = JUMP_FORCE
        player.onGround = false
        player._lastJumpTime = now
      }
    }

    // Jetpack
    if (input.jetpack && player.jetpackFuel > 0 && !player.onGround) {
      player.jetpackActive = true
      player.vy = Math.max(-600, player.vy + JETPACK_FORCE * dt)
      player.jetpackFuel = Math.max(0, player.jetpackFuel - JETPACK_DRAIN * dt)
    } else {
      player.jetpackActive = false
      if (player.onGround) {
        player.jetpackFuel = Math.min(JETPACK_FUEL_MAX, player.jetpackFuel + JETPACK_REGEN * dt)
      }
    }

    // Gravity
    player.vy = Math.min(player.vy + this.gravity * dt, 1000) // Terminal velocity

    // Horizontal movement
    player.x += player.vx * dt
    this.checkCollisionsX(player)

    // Vertical movement
    player.y += player.vy * dt
    this.checkCollisionsY(player, dt)

    // Clamp to map bounds
    if (player.x < PLAYER_RADIUS) {
      player.x = PLAYER_RADIUS
      player.vx = 0
    }
    if (player.x > this.mapWidth - PLAYER_RADIUS) {
      player.x = this.mapWidth - PLAYER_RADIUS
      player.vx = 0
    }

    // Death by falling
    if (player.y > this.mapHeight + 200) {
      player.dead = true
      player.respawnTimer = 3
    }
  }
}

export default ClientPhysics
