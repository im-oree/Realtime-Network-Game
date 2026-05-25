export class ParticleSystem {
  constructor() {
    this.particles = []
    this.enabled = true
  }

  emit(x, y, opts = {}) {
    if (!this.enabled) return
    const count = opts.count ?? 8
    for (let i = 0; i < count; i++) {
      const angle  = opts.angle ?? (Math.random() * Math.PI * 2)
      const spread = opts.spread ?? Math.PI * 2
      const a      = angle + (Math.random() - 0.5) * spread
      const speed  = (opts.speedMin ?? 40) + Math.random() * ((opts.speedMax ?? 120) - (opts.speedMin ?? 40))
      this.particles.push({
        x, y,
        vx:      Math.cos(a) * speed,
        vy:      Math.sin(a) * speed,
        life:    1,
        maxLife: opts.life ?? (0.2 + Math.random() * 0.3),
        size:    (opts.sizeMin ?? 2) + Math.random() * ((opts.sizeMax ?? 4) - (opts.sizeMin ?? 2)),
        color:   Array.isArray(opts.colors) ? opts.colors[Math.floor(Math.random() * opts.colors.length)] : (opts.color ?? '#ffaa00'),
        type:    opts.type ?? 'spark',
        gravity: opts.gravity ?? 200,
        friction: opts.friction ?? 0.97
      })
    }
  }

  muzzleFlash(x, y, angle, color) {
    this.emit(x, y, { count: 5, angle, spread: 0.6, speedMin: 100, speedMax: 200, life: 0.1, sizeMin: 2, sizeMax: 4, color, gravity: 0, type: 'spark' })
    this.emit(x, y, { count: 3, angle, spread: 0.3, speedMin: 20, speedMax: 50, life: 0.2, sizeMin: 4, sizeMax: 8, colors: ['#fff8', '#ff8'], type: 'smoke', gravity: -30 })
  }

  bulletHit(x, y, color = '#ffdd00') {
    this.emit(x, y, { count: 10, speedMin: 80, speedMax: 180, life: 0.35, sizeMin: 2, sizeMax: 4, colors: [color, '#fff', '#ff8800'], gravity: 300, type: 'spark' })
    this.emit(x, y, { count: 4, speedMin: 10, speedMax: 30, life: 0.5, sizeMin: 5, sizeMax: 10, colors: ['#555', '#333'], type: 'smoke', gravity: -40 })
  }

  explosion(x, y, radius) {
    const r = radius || 80
    const scale = r / 80
    this.emit(x, y, { count: Math.floor(25 * scale), speedMin: 100, speedMax: 300 * scale, life: 0.6, sizeMin: 3, sizeMax: 6, colors: ['#ff4400', '#ff8800', '#ffcc00', '#fff'], gravity: 400, type: 'spark' })
    this.emit(x, y, { count: Math.floor(12 * scale), speedMin: 20, speedMax: 80, life: 1.0, sizeMin: 10, sizeMax: 25 * scale, colors: ['#ff440088', '#33333388', '#88440088'], type: 'smoke', gravity: -60 })
    // Shockwave ring
    this.particles.push({
      x, y, vx: 0, vy: 0, life: 1, maxLife: 0.4,
      size: r, color: '#ff880044',
      type: 'ring', gravity: 0, friction: 1
    })
  }

  playerDeath(x, y, color) {
    this.emit(x, y, { count: 20, speedMin: 100, speedMax: 250, life: 0.7, sizeMin: 3, sizeMax: 5, colors: [color, '#fff', '#ff4444'], gravity: 400, type: 'spark' })
    this.emit(x, y, { count: 8, speedMin: 30, speedMax: 80, life: 1.0, sizeMin: 8, sizeMax: 16, colors: ['#ff220066', '#22222088'], type: 'smoke', gravity: -40 })
  }

  jetpackFlame(x, y) {
    this.emit(x, y, { count: 2, angle: Math.PI / 2, spread: 0.6, speedMin: 60, speedMax: 120, life: 0.3, sizeMin: 3, sizeMax: 7, colors: ['#ff8800', '#ffcc00', '#ff4400'], gravity: 100, type: 'smoke' })
  }

  gasTick(x, y, radius) {
    if (Math.random() > 0.3) return
    const ox = (Math.random() - 0.5) * radius * 2
    const oy = (Math.random() - 0.5) * radius * 2
    this.emit(x + ox, y + oy, { count: 1, speedMin: 5, speedMax: 15, life: 1.5, sizeMin: 10, sizeMax: 20, color: '#44ff4433', type: 'smoke', gravity: -10 })
  }

  pickupCollect(x, y, color) {
    this.emit(x, y, { count: 12, speedMin: 60, speedMax: 120, life: 0.4, sizeMin: 3, sizeMax: 5, color, gravity: -60, type: 'spark' })
  }

  bulletTrail(x, y, color) {
    if (Math.random() > 0.4) return
    this.particles.push({
      x, y, vx: (Math.random() - 0.5) * 5, vy: (Math.random() - 0.5) * 5,
      life: 1, maxLife: 0.15, size: 2, color: color + '66',
      type: 'smoke', gravity: 0, friction: 1
    })
  }

  update(dt) {
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i]
      p.life -= dt / p.maxLife
      p.x    += p.vx * dt
      p.y    += p.vy * dt
      p.vy   += (p.gravity || 0) * dt
      p.vx   *= (p.friction ?? 0.97)
      p.vy   *= (p.friction ?? 0.97)
      if (p.life <= 0) this.particles.splice(i, 1)
    }
  }

  draw(ctx) {
    for (const p of this.particles) {
      const alpha = Math.max(0, Math.min(1, p.life))
      ctx.save()
      ctx.globalAlpha = alpha

      if (p.type === 'ring') {
        const progress = 1 - p.life
        const r = p.size * (0.3 + progress * 1.5)
        ctx.strokeStyle = p.color
        ctx.lineWidth = Math.max(1, 4 * p.life)
        ctx.beginPath()
        ctx.arc(p.x, p.y, r, 0, Math.PI * 2)
        ctx.stroke()
      } else if (p.type === 'smoke') {
        const r = p.size * (1.5 - p.life * 0.5)
        const grad = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, r)
        grad.addColorStop(0, p.color)
        grad.addColorStop(1, 'transparent')
        ctx.fillStyle = grad
        ctx.beginPath()
        ctx.arc(p.x, p.y, r, 0, Math.PI * 2)
        ctx.fill()
      } else {
        // Spark — line
        const speed = Math.sqrt(p.vx ** 2 + p.vy ** 2)
        const nx = speed > 0.1 ? p.vx / speed : 1
        const ny = speed > 0.1 ? p.vy / speed : 0
        const len = p.size * 3 * p.life
        ctx.strokeStyle = p.color
        ctx.lineWidth   = Math.max(0.5, p.size * p.life)
        ctx.lineCap     = 'round'
        ctx.beginPath()
        ctx.moveTo(p.x, p.y)
        ctx.lineTo(p.x - nx * len, p.y - ny * len)
        ctx.stroke()
      }
      ctx.restore()
    }
  }
}