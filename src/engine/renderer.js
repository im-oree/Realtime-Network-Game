// ─── Main render orchestrator ─────────────────────────────────────────────────

import { Camera }           from './camera'
import { ParticleSystem }   from './particles'
import { drawMap }          from './mapRenderer'
import { drawCharacter }    from './characterRenderer'
import {
  drawProjectiles, drawGrenades, drawGasClouds, drawPickups
} from './weaponRenderer'
import {
  KillFeed, drawScoreboard, drawRespawnOverlay
} from './effectsRenderer'
import { drawMinimap }      from './minimapRenderer'
import audioManager         from '../game/audioManager'

export class GameRenderer {
  constructor() {
    this.camera    = new Camera(window.innerWidth, window.innerHeight)
    this.particles = new ParticleSystem()
    this.killFeed  = new KillFeed()
    this.grenadeAudioState = new Map()
    this.jetpackAudioState = new Map()
    this.lastTime  = performance.now()
    this.raf       = null
  }

  start(canvas, getState) {
    this.canvas   = canvas
    this.ctx      = canvas.getContext('2d')
    this.getState = getState
    audioManager.init()

    const loop = (now) => {
      const dt = Math.min((now - this.lastTime) / 1000, 0.05)
      this.lastTime = now
      this.render(dt, now)
      this.raf = requestAnimationFrame(loop)
    }
    this.raf = requestAnimationFrame(loop)
  }

  stop() {
    if (this.raf) cancelAnimationFrame(this.raf)
    this.raf = null
  }

  render(dt, now) {
    const state = this.getState()
    const { players, projectiles, grenades, gasClouds, pickups, scores,
            mapData, mapSize, myId, events, weapons, paused, showScoreboard, predictedPlayer } = state

    const canvas = this.canvas
    const ctx    = this.ctx

    // Resize canvas to viewport
    const vw = window.innerWidth
    const vh = window.innerHeight
    if (canvas.width !== vw || canvas.height !== vh) {
      canvas.width  = vw
      canvas.height = vh
      this.camera.setViewSize(vw, vh)
    }

    // ── Process events ──────────────────────────────────────────────────────
    for (const ev of (events || [])) {
      switch (ev.type) {
        case 'grenade':
          audioManager.grenadeThrow()
          break
        case 'shoot':
          if (ev.playerId === myId) {
            this.camera.shake(4, 0.1)
            audioManager.shoot(ev.weaponId)
          } else {
            audioManager.shoot(ev.weaponId)
          }
          this.particles.muzzleFlash(ev.x, ev.y, ev.angle, players[ev.playerId]?.color || '#fff')
          break
        case 'hit':
          this.particles.bulletHit(ev.x, ev.y)
          audioManager.hit()
          if (ev.targetId === myId) this.camera.shake(8, 0.15)
          break
        case 'kill': {
          const kn = players[ev.killer]?.username || '???'
          const vn = players[ev.victim]?.username || '???'
          this.killFeed.add(`${kn} ⚡ ${vn}`, '#ef4444')
          this.particles.playerDeath(ev.x, ev.y, ev.color || '#ef4444')
          audioManager.death()
          if (ev.victim === myId) this.camera.shake(15, 0.3)
          break
        }
        case 'explosion':
          this.particles.explosion(ev.x, ev.y, ev.radius)
          audioManager.explosion()
          this.camera.shake(12, 0.25)
          break
        case 'pickup':
          this.particles.pickupCollect(ev.x, ev.y, '#facc15')
          audioManager.pickup()
          break
        case 'jetpack': {
          this.particles.jetpackFlame(ev.x, ev.y + 18)
          const lastJetpack = this.jetpackAudioState.get(ev.playerId) || 0
          if (now - lastJetpack > 120) {
            audioManager.jetpack()
            this.jetpackAudioState.set(ev.playerId, now)
          }
          break
        }
        case 'wall_hit':
          this.particles.bulletHit(ev.x, ev.y, '#6a7a8a')
          break
        case 'respawn':
          break
      }
    }

    const activeGrenades = new Set()
    for (const gren of (grenades || [])) {
      if (!gren?.id) continue
      activeGrenades.add(gren.id)
      const fuse = Math.max(0, gren.fuse ?? 0)
      const bucket = Math.floor(fuse / 0.35)
      const prevBucket = this.grenadeAudioState.get(gren.id)
      if (prevBucket == null) {
        this.grenadeAudioState.set(gren.id, bucket)
        continue
      }
      if (bucket < prevBucket) {
        audioManager.grenadeTick(1 - Math.min(1, fuse / 2.5))
        this.grenadeAudioState.set(gren.id, bucket)
      }
    }
    for (const id of this.grenadeAudioState.keys()) {
      if (!activeGrenades.has(id)) this.grenadeAudioState.delete(id)
    }

    for (const [playerId, lastPlayed] of this.jetpackAudioState.entries()) {
      if (now - lastPlayed > 250) this.jetpackAudioState.delete(playerId)
    }

    // Bullet trails
    for (const pr of (projectiles || [])) {
      this.particles.bulletTrail(pr.x, pr.y, pr.color || '#ffdd00')
    }

    // Gas cloud particles
    for (const gas of (gasClouds || [])) {
      this.particles.gasTick(gas.x, gas.y, gas.radius)
    }

    this.particles.update(dt)
    this.killFeed.update(dt)

    // ── Camera ──────────────────────────────────────────────────────────────
    const me = predictedPlayer || players[myId]
    if (me && !me.dead) {
      // Sniper zoom
      const wpn = weapons?.[me.weapon]
      const targetZoom = wpn?.zoomFactor || 1.0
      this.camera.setZoom(targetZoom)
      this.camera.follow(me.x, me.y, mapSize.w, mapSize.h, dt)
    }
    this.camera.updateShake(dt)

    // ── Draw ────────────────────────────────────────────────────────────────
    ctx.clearRect(0, 0, canvas.width, canvas.height)

    // Fill with very dark
    ctx.fillStyle = '#050810'
    ctx.fillRect(0, 0, canvas.width, canvas.height)

    // Apply camera
    this.camera.apply(ctx)

    // Map
    drawMap(ctx, mapData, this.camera, now)

    // Pickups
    drawPickups(ctx, pickups, now)

    // Gas clouds
    drawGasClouds(ctx, gasClouds, now)

    // Projectiles
    drawProjectiles(ctx, projectiles)

    // Grenades
    drawGrenades(ctx, grenades, now)

    // Players (draw self last for on-top)
    const visiblePlayers = { ...(players || {}) }
    if (predictedPlayer && myId) {
      visiblePlayers[myId] = predictedPlayer
    }

    const sortedPlayers = Object.entries(visiblePlayers).sort(([a], [b]) => {
      if (a === myId) return 1
      if (b === myId) return -1
      return 0
    })
    for (const [id, p] of sortedPlayers) {
      drawCharacter(ctx, p, id === myId, now, weapons)
    }

    // Particles
    this.particles.draw(ctx)

    // Draw trajectory line from player to aim target
    if (me && !me.dead) {
      this.drawTrajectoryLine(ctx, me, weapons)
    }

    // Restore camera
    this.camera.restore(ctx)

    // ── HUD (screen-space) ──────────────────────────────────────────────────
    const vWidth  = canvas.width
    const vHeight = canvas.height

    // Kill feed
    this.killFeed.draw(ctx, vWidth - 14, 50)

    // Scoreboard (Tab held)
    if (showScoreboard) {
      drawScoreboard(ctx, scores, players, vWidth)
    }

    // Minimap (pass mobile flag so it can be drawn top-right for mobile)
    drawMinimap(ctx, vWidth, vHeight, mapData, players, myId, pickups, state.isMobileMode, predictedPlayer)

    // Respawn overlay
    if (me && me.dead) {
      drawRespawnOverlay(ctx, vWidth, vHeight, me.respawnTimer)
    }

    // Pause overlay
    if (paused) {
      // Handled by React component
    }
  }

  drawTrajectoryLine(ctx, player, weapons) {
    const wpn = weapons?.[player.weapon]
    const lineLength = 300 // pixels to extend the line
    
    // Start from gun position (slightly offset from player center)
    const gunDist = 12
    const startX = player.x + Math.cos(player.angle) * gunDist
    const startY = player.y + Math.sin(player.angle) * gunDist
    
    // End point along aim direction
    const endX = startX + Math.cos(player.angle) * lineLength
    const endY = startY + Math.sin(player.angle) * lineLength
    
    // Draw line
    ctx.save()
    ctx.strokeStyle = 'rgba(255, 200, 0, 0.6)'
    ctx.lineWidth = 2.5
    ctx.lineCap = 'round'
    ctx.setLineDash([8, 4]) // dashed line
    ctx.beginPath()
    ctx.moveTo(startX, startY)
    ctx.lineTo(endX, endY)
    ctx.stroke()
    
    // Draw target dot at end
    ctx.fillStyle = 'rgba(255, 200, 0, 0.8)'
    ctx.beginPath()
    ctx.arc(endX, endY, 3, 0, Math.PI * 2)
    ctx.fill()
    
    ctx.restore()
  }
}