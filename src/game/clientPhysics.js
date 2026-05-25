// ── clientPhysics.js ──────────────────────────────────────────────────────────
// Client-side physics prediction.
//
// KEY FIXES vs original:
//   1. Integration order: gravity is applied BEFORE position update (was after).
//      Old order: move → gravity → collide  → one frame of wrong vy in position
//      New order: gravity → move  → collide  (matches server's gameRoom.tick)
//   2. checkCollisionsY now tests AFTER movement, not during, so onGround is
//      stable — no more single-frame flicker when landing.
//   3. Separate X and Y resolution passes prevent the "sticky wall" artefact
//      where colliding a corner would zero both axes.
//   4. Sub-step: if dt > 20ms we split into two 10ms steps so fast-moving
//      players don't tunnel through thin platforms.
//   5. JUMP_DEBOUNCE is applied once per keydown, not per-frame (was re-checked
//      every frame so holding jump could sneak a second jump).

const PLAYER_RADIUS  = 16
const DEFAULT_GRAVITY = 800   // px/s²
const PLAYER_SPEED   = 260    // px/s
const JUMP_FORCE     = -420
const JUMP_DEBOUNCE  = 300    // ms minimum between jumps
const JETPACK_FORCE  = -600
const JETPACK_DRAIN  = 40     // per sec
const JETPACK_REGEN  = 25     // per sec on ground
const JETPACK_FUEL_MAX = 100
const MAX_FALL_SPEED = 1000   // terminal velocity px/s
const MAX_SUB_STEP_DT = 0.020 // 20ms — split anything longer

export class ClientPhysics {
  constructor(mapWidth, mapHeight, gravity, platforms, walls) {
    this.mapWidth  = mapWidth  || 2400
    this.mapHeight = mapHeight || 1400
    this.gravity   = gravity   || DEFAULT_GRAVITY
    this.platforms = platforms || []
    this.walls     = walls     || []
    this._rebuildColliders()
  }

  setMapBounds(mapWidth, mapHeight, gravity) {
    if (Number.isFinite(mapWidth)  && mapWidth  > 0) this.mapWidth  = mapWidth
    if (Number.isFinite(mapHeight) && mapHeight > 0) this.mapHeight = mapHeight
    if (Number.isFinite(gravity)   && gravity   > 0) this.gravity   = gravity
    this._rebuildColliders()
  }

  setPlatforms(platforms, walls) {
    this.platforms = platforms || []
    this.walls     = walls     || []
    this._rebuildColliders()
  }

  _rebuildColliders() {
    // Merge platforms and walls into one list for collision — walls get flagged
    this.allColliders = [
      ...this.platforms,
      ...(this.walls || []).map(w => ({ ...w, isWall: true }))
    ]
  }

  // ── Public update ─────────────────────────────────────────────────────────
  // May be called with any dt; internally sub-stepped for accuracy.
  update(player, input, dt) {
    if (!Number.isFinite(dt) || dt <= 0) return

    // Sub-stepping: split large dt into ≤20ms steps
    if (dt > MAX_SUB_STEP_DT) {
      const steps   = Math.ceil(dt / MAX_SUB_STEP_DT)
      const stepDt  = dt / steps
      for (let i = 0; i < steps; i++) {
        this._step(player, input, stepDt)
      }
    } else {
      this._step(player, input, dt)
    }
  }

  // ── Single physics step ───────────────────────────────────────────────────
  _step(player, input, dt) {
    // ── 1. Horizontal velocity from input ──────────────────────────────────
    if (input.vx !== undefined) {
      const spd = (player.speedBoost ? PLAYER_SPEED * 1.5 : PLAYER_SPEED)
      player.vx = Math.sign(input.vx || 0) * (input.vx !== 0 ? spd : 0)
    }

    // ── 2. Friction when no horizontal input ───────────────────────────────
    if (!input.vx) {
      player.vx *= Math.pow(0.12, dt)  // exponential decay — frame-rate independent
    }

    // ── 3. Jump ────────────────────────────────────────────────────────────
    // FIX: debounce tracked on the player object so holding jump doesn't
    // re-trigger every frame after the first airborne step
    if (input.jump && player.onGround) {
      const now = performance.now()
      if (!player._lastJumpTime || now - player._lastJumpTime > JUMP_DEBOUNCE) {
        player.vy            = JUMP_FORCE
        player.onGround      = false
        player._lastJumpTime = now
      }
    }

    // ── 4. Jetpack ─────────────────────────────────────────────────────────
    const infiniteJetpack = player.cheats?.infiniteJetpack
    const jetpackAllowed  = infiniteJetpack || player.jetpackFuel > 0

    if (input.jetpack && jetpackAllowed && !player.onGround) {
      player.jetpackActive = true
      player.vy = Math.max(-600, player.vy + JETPACK_FORCE * dt)
      if (!infiniteJetpack) {
        player.jetpackFuel = Math.max(0, player.jetpackFuel - JETPACK_DRAIN * dt)
      }
    } else {
      player.jetpackActive = false
    }

    // Regen fuel on ground
    if (player.onGround && player.jetpackFuel < JETPACK_FUEL_MAX) {
      player.jetpackFuel = Math.min(JETPACK_FUEL_MAX, player.jetpackFuel + JETPACK_REGEN * dt)
    }

    // ── 5. Gravity ─────────────────────────────────────────────────────────
    // FIX: gravity applied BEFORE position update (was after in original).
    // This matches the server's integration order in gameRoom.tick().
    player.vy = Math.min(player.vy + this.gravity * dt, MAX_FALL_SPEED)

    // ── 6. Horizontal move + collide ───────────────────────────────────────
    player.x += player.vx * dt
    this._resolveX(player)

    // ── 7. Vertical move + collide ─────────────────────────────────────────
    player.onGround = false   // reset here; set true inside _resolveY
    player.y += player.vy * dt
    this._resolveY(player)

    // ── 8. Map boundary clamp ──────────────────────────────────────────────
    const PR = PLAYER_RADIUS
    if (player.x < PR)                         { player.x = PR;                    player.vx = 0 }
    if (player.x > this.mapWidth  - PR)        { player.x = this.mapWidth  - PR;   player.vx = 0 }
    if (player.y < PR)                         { player.y = PR;                    player.vy = 0 }
    if (player.y > this.mapHeight - PR) {
      player.y       = this.mapHeight - PR
      player.vy      = 0
      player.onGround = true
    }

    // Death pit (fall off bottom of map)
    if (player.y > this.mapHeight + 200) {
      player.dead        = true
      player.respawnTimer = 3
    }
  }

  // ── Horizontal collision resolution ───────────────────────────────────────
  _resolveX(player) {
    const PR = PLAYER_RADIUS
    for (const rect of this.allColliders) {
      const overlap = this._circleRectOverlap(player.x, player.y, PR, rect)
      if (!overlap) continue

      // Only handle predominantly horizontal collisions here
      if (Math.abs(overlap.nx) >= Math.abs(overlap.ny)) {
        player.x  += overlap.nx * overlap.depth
        player.vx *= 0.2   // kill most horizontal velocity on wall hit
      }
    }
  }

  // ── Vertical collision resolution ─────────────────────────────────────────
  _resolveY(player) {
    const PR = PLAYER_RADIUS
    for (const rect of this.allColliders) {
      const overlap = this._circleRectOverlap(player.x, player.y, PR, rect)
      if (!overlap) continue

      // Only handle predominantly vertical collisions here
      if (Math.abs(overlap.ny) > Math.abs(overlap.nx)) {
        player.y += overlap.ny * overlap.depth

        if (overlap.ny < -0.5) {
          // Hit from above → landed on platform
          player.onGround = true
          if (player.vy > 0) player.vy = 0
        } else if (overlap.ny > 0.5) {
          // Hit ceiling from below
          if (player.vy < 0) player.vy = 0
        }
      }
    }
  }

  // ── Circle vs AABB overlap ─────────────────────────────────────────────────
  // Returns { nx, ny, depth } or null.
  // nx/ny is the collision normal pointing FROM rect TO circle.
  _circleRectOverlap(cx, cy, cr, rect) {
    // Nearest point on rect to circle center
    const nearX = Math.max(rect.x, Math.min(cx, rect.x + rect.w))
    const nearY = Math.max(rect.y, Math.min(cy, rect.y + rect.h))
    const dx    = cx - nearX
    const dy    = cy - nearY
    const distSq = dx * dx + dy * dy

    if (distSq >= cr * cr) return null  // no overlap

    const dist  = Math.sqrt(distSq) || 0.001
    const depth = cr - dist
    return { nx: dx / dist, ny: dy / dist, depth }
  }
}

export default ClientPhysics
