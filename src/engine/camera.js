// ─── Camera with smoothing, shake, and sniper zoom ─────────────────────────────

export class Camera {
  constructor(viewW, viewH) {
    this.x        = 0
    this.y        = 0
    this.viewW    = viewW
    this.viewH    = viewH
    this.zoom     = 1
    this.targetZoom = 1
    this.shakeX   = 0
    this.shakeY   = 0
    this.shakeIntensity = 0
    this.shakeDuration  = 0
    this.shakeTimer     = 0
    this.shakeEnabled   = true
  }

  setViewSize(w, h) {
    this.viewW = w
    this.viewH = h
  }

  follow(targetX, targetY, mapW, mapH, dt) {
    // Smooth lerp
    const lerpSpeed = 6
    const tx = targetX - this.viewW / (2 * this.zoom)
    const ty = targetY - this.viewH / (2 * this.zoom)
    this.x += (tx - this.x) * Math.min(1, lerpSpeed * dt)
    this.y += (ty - this.y) * Math.min(1, lerpSpeed * dt)

    // Clamp to map bounds
    const maxX = mapW - this.viewW / this.zoom
    const maxY = mapH - this.viewH / this.zoom
    this.x = Math.max(0, Math.min(maxX, this.x))
    this.y = Math.max(0, Math.min(maxY, this.y))

    // Zoom smooth
    this.zoom += (this.targetZoom - this.zoom) * Math.min(1, 4 * dt)
  }

  setZoom(z) {
    this.targetZoom = Math.max(0.4, Math.min(2.5, z))
  }

  shake(intensity, duration) {
    if (!this.shakeEnabled) return
    this.shakeIntensity = Math.max(this.shakeIntensity, intensity)
    this.shakeDuration  = Math.max(this.shakeDuration,  duration)
    this.shakeTimer     = this.shakeDuration
  }

  updateShake(dt) {
    if (this.shakeTimer > 0) {
      this.shakeTimer -= dt
      const t = this.shakeTimer / (this.shakeDuration || 1)
      this.shakeX = (Math.random() - 0.5) * 2 * this.shakeIntensity * t
      this.shakeY = (Math.random() - 0.5) * 2 * this.shakeIntensity * t
    } else {
      this.shakeX = 0
      this.shakeY = 0
      this.shakeIntensity = 0
    }
  }

  apply(ctx) {
    ctx.save()
    ctx.translate(this.shakeX, this.shakeY)
    ctx.scale(this.zoom, this.zoom)
    ctx.translate(-this.x, -this.y)
  }

  restore(ctx) {
    ctx.restore()
  }

  // Convert screen coords to world coords
  screenToWorld(sx, sy) {
    return {
      x: sx / this.zoom + this.x,
      y: sy / this.zoom + this.y
    }
  }
}