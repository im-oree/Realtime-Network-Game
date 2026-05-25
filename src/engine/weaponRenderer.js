// ─── Projectile / Grenade / Gas Cloud / Pickup Rendering ────────────────────────

// ─── Utility ────────────────────────────────────────────────────────────────────

function lerp(a, b, t) { return a + (b - a) * t }

function roundRect(ctx, x, y, w, h, r) {
  r = Math.min(r, w / 2, h / 2)
  ctx.moveTo(x + r, y)
  ctx.arcTo(x + w, y,     x + w, y + h, r)
  ctx.arcTo(x + w, y + h, x,     y + h, r)
  ctx.arcTo(x,     y + h, x,     y,     r)
  ctx.arcTo(x,     y,     x + w, y,     r)
  ctx.closePath()
}

// ─── Projectiles ─────────────────────────────────────────────────────────────────

export function drawProjectiles(ctx, projectiles, now) {
  const t = now / 1000

  for (const pr of (projectiles || [])) {
    const speed = Math.sqrt((pr.vx ?? 0) ** 2 + (pr.vy ?? 0) ** 2)
    const nx    = speed > 0 ? pr.vx / speed : 1
    const ny    = speed > 0 ? pr.vy / speed : 0
    const size  = pr.size || 4
    const color = pr.color || '#ffdd00'
    const isRocket = pr.type === 'rocket' || pr.type === 'rpg'
    const isLaser  = pr.type === 'laser'  || pr.type === 'sniper'
    const isShotgun = pr.type === 'shotgun'

    ctx.save()

    if (isRocket) {
      drawRocket(ctx, pr, nx, ny, size, color, t)
    } else if (isLaser) {
      drawLaserBolt(ctx, pr, nx, ny, size, color)
    } else if (isShotgun) {
      drawPellet(ctx, pr, nx, ny, size, color)
    } else {
      drawBullet(ctx, pr, nx, ny, size, color)
    }

    ctx.restore()
  }
}

// Standard bullet ─────────────────────────────────────────────────────────────

function drawBullet(ctx, pr, nx, ny, size, color) {
  const trailLen = size * 6
  const bx = pr.x, by = pr.y

  // Outer glow trail
  const tGrd = ctx.createLinearGradient(
    bx - nx * trailLen, by - ny * trailLen, bx, by
  )
  tGrd.addColorStop(0, 'transparent')
  tGrd.addColorStop(0.6, hexToRgba(color, 0.08))
  tGrd.addColorStop(1, hexToRgba(color, 0.25))
  ctx.strokeStyle = tGrd
  ctx.lineWidth = size * 1.8
  ctx.lineCap = 'round'
  ctx.beginPath()
  ctx.moveTo(bx - nx * trailLen, by - ny * trailLen)
  ctx.lineTo(bx, by)
  ctx.stroke()

  // Core trail
  const coreGrd = ctx.createLinearGradient(
    bx - nx * trailLen * 0.5, by - ny * trailLen * 0.5, bx, by
  )
  coreGrd.addColorStop(0, 'transparent')
  coreGrd.addColorStop(1, color)
  ctx.strokeStyle = coreGrd
  ctx.lineWidth = size * 0.6
  ctx.beginPath()
  ctx.moveTo(bx - nx * trailLen * 0.5, by - ny * trailLen * 0.5)
  ctx.lineTo(bx, by)
  ctx.stroke()

  // Core orb
  const orbR = size * 1.4
  const orbGrd = ctx.createRadialGradient(bx, by, 0, bx, by, orbR)
  orbGrd.addColorStop(0,   '#ffffff')
  orbGrd.addColorStop(0.3, color)
  orbGrd.addColorStop(1,   'transparent')
  ctx.fillStyle = orbGrd
  ctx.beginPath()
  ctx.arc(bx, by, orbR, 0, Math.PI * 2)
  ctx.fill()

  // Sparkle center
  ctx.fillStyle = '#fff'
  ctx.beginPath()
  ctx.arc(bx, by, size * 0.35, 0, Math.PI * 2)
  ctx.fill()
}

// Laser / sniper bolt ─────────────────────────────────────────────────────────

function drawLaserBolt(ctx, pr, nx, ny, size, color) {
  const bx = pr.x, by = pr.y
  const trailLen = size * 14

  // Wide glow
  const wideGrd = ctx.createLinearGradient(
    bx - nx * trailLen, by - ny * trailLen, bx, by
  )
  wideGrd.addColorStop(0, 'transparent')
  wideGrd.addColorStop(0.5, hexToRgba(color, 0.08))
  wideGrd.addColorStop(1, hexToRgba(color, 0.3))
  ctx.strokeStyle = wideGrd
  ctx.lineWidth = size * 4
  ctx.lineCap = 'round'
  ctx.beginPath()
  ctx.moveTo(bx - nx * trailLen, by - ny * trailLen)
  ctx.lineTo(bx, by)
  ctx.stroke()

  // Bright core
  const coreGrd = ctx.createLinearGradient(
    bx - nx * trailLen * 0.7, by - ny * trailLen * 0.7, bx, by
  )
  coreGrd.addColorStop(0, 'transparent')
  coreGrd.addColorStop(0.4, hexToRgba(color, 0.6))
  coreGrd.addColorStop(1, '#ffffff')
  ctx.strokeStyle = coreGrd
  ctx.lineWidth = size * 0.8
  ctx.beginPath()
  ctx.moveTo(bx - nx * trailLen * 0.7, by - ny * trailLen * 0.7)
  ctx.lineTo(bx, by)
  ctx.stroke()

  // Head flash
  ctx.fillStyle = '#fff'
  ctx.shadowColor = color
  ctx.shadowBlur = 12
  ctx.beginPath()
  ctx.arc(bx, by, size * 0.8, 0, Math.PI * 2)
  ctx.fill()
  ctx.shadowBlur = 0
}

// Shotgun pellet ──────────────────────────────────────────────────────────────

function drawPellet(ctx, pr, nx, ny, size, color) {
  const bx = pr.x, by = pr.y
  const trailLen = size * 3

  const tGrd = ctx.createLinearGradient(
    bx - nx * trailLen, by - ny * trailLen, bx, by
  )
  tGrd.addColorStop(0, 'transparent')
  tGrd.addColorStop(1, hexToRgba(color, 0.5))
  ctx.strokeStyle = tGrd
  ctx.lineWidth = size * 0.9
  ctx.lineCap = 'round'
  ctx.beginPath()
  ctx.moveTo(bx - nx * trailLen, by - ny * trailLen)
  ctx.lineTo(bx, by)
  ctx.stroke()

  ctx.fillStyle = '#ffe'
  ctx.beginPath()
  ctx.arc(bx, by, size * 0.8, 0, Math.PI * 2)
  ctx.fill()
}

// Rocket ──────────────────────────────────────────────────────────────────────

function drawRocket(ctx, pr, nx, ny, size, color, t) {
  const bx = pr.x, by = pr.y
  const angle = Math.atan2(ny, nx)

  ctx.save()
  ctx.translate(bx, by)
  ctx.rotate(angle)

  // Exhaust flame
  const flicker = Math.sin(t * 40) * 3
  const fLen = size * 4 + flicker
  const flamGrd = ctx.createLinearGradient(-size * 2 - fLen, 0, -size * 2, 0)
  flamGrd.addColorStop(0, 'transparent')
  flamGrd.addColorStop(0.3, 'rgba(96,180,255,0.5)')
  flamGrd.addColorStop(0.7, 'rgba(255,140,20,0.8)')
  flamGrd.addColorStop(1, 'rgba(255,220,50,0.9)')
  ctx.strokeStyle = flamGrd
  ctx.lineWidth = size * 1.6
  ctx.lineCap = 'round'
  ctx.beginPath()
  ctx.moveTo(-size * 2 - fLen, 0)
  ctx.lineTo(-size * 2, 0)
  ctx.stroke()

  // Wide glow trail
  const trailLen = size * 10
  const trailGrd = ctx.createLinearGradient(-trailLen, 0, 0, 0)
  trailGrd.addColorStop(0, 'transparent')
  trailGrd.addColorStop(1, hexToRgba(color, 0.12))
  ctx.strokeStyle = trailGrd
  ctx.lineWidth = size * 3
  ctx.beginPath()
  ctx.moveTo(-trailLen, 0)
  ctx.lineTo(0, 0)
  ctx.stroke()

  // Rocket body
  const bodyGrd = ctx.createLinearGradient(0, -size, 0, size)
  bodyGrd.addColorStop(0, '#b0b8cc')
  bodyGrd.addColorStop(0.4, '#e8ecf4')
  bodyGrd.addColorStop(1, '#6a7080')
  ctx.fillStyle = bodyGrd
  ctx.beginPath()
  roundRect(ctx, -size * 1.5, -size * 0.7, size * 3, size * 1.4, size * 0.4)
  ctx.fill()

  // Warhead nose cone
  ctx.fillStyle = color
  ctx.beginPath()
  ctx.moveTo(size * 1.5, 0)
  ctx.lineTo(size * 0.6, -size * 0.7)
  ctx.lineTo(size * 0.6, size * 0.7)
  ctx.closePath()
  ctx.fill()

  // Fins
  ctx.fillStyle = '#88aacc'
  // Top fin
  ctx.beginPath()
  ctx.moveTo(-size, -size * 0.7)
  ctx.lineTo(-size * 1.8, -size * 1.8)
  ctx.lineTo(-size * 0.4, -size * 0.7)
  ctx.closePath()
  ctx.fill()
  // Bottom fin
  ctx.beginPath()
  ctx.moveTo(-size, size * 0.7)
  ctx.lineTo(-size * 1.8, size * 1.8)
  ctx.lineTo(-size * 0.4, size * 0.7)
  ctx.closePath()
  ctx.fill()

  // Center band stripe
  ctx.fillStyle = color
  ctx.globalAlpha = 0.5
  ctx.fillRect(-size * 0.2, -size * 0.7, size * 0.5, size * 1.4)
  ctx.globalAlpha = 1

  ctx.restore()
}

// ─── Grenades ────────────────────────────────────────────────────────────────────

export function drawGrenades(ctx, grenades, now) {
  const t = now / 1000

  for (const gr of (grenades || [])) {
    const fuse     = gr.fuse ?? 3
    const maxFuse  = gr.maxFuse ?? 3
    const fuseRatio = Math.max(0, fuse / maxFuse)
    const critical  = fuse < 0.8
    const pulse     = critical ? (Math.sin(t * 24) * 0.5 + 0.5) : 0

    ctx.save()
    ctx.translate(gr.x, gr.y)

    // Rotation from physics
    if (gr.spin !== undefined) {
      ctx.rotate(gr.spin * t)
    }

    // Outer glow when critical
    if (critical) {
      const glowR = 14 + pulse * 6
      const glowGrd = ctx.createRadialGradient(0, 0, 0, 0, 0, glowR)
      glowGrd.addColorStop(0, `rgba(255,60,60,${0.2 * pulse})`)
      glowGrd.addColorStop(1, 'transparent')
      ctx.fillStyle = glowGrd
      ctx.beginPath()
      ctx.arc(0, 0, glowR, 0, Math.PI * 2)
      ctx.fill()
    }

    // Shell body
    const bodyGrd = ctx.createRadialGradient(-2, -2, 1, 0, 0, 8)
    bodyGrd.addColorStop(0, '#6a7a42')
    bodyGrd.addColorStop(0.5, '#4a5a2a')
    bodyGrd.addColorStop(1, '#2e3a18')
    ctx.fillStyle = bodyGrd
    ctx.beginPath()
    ctx.arc(0, 0, 7.5, 0, Math.PI * 2)
    ctx.fill()

    // Shell edge
    ctx.strokeStyle = '#3a4a22'
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.arc(0, 0, 7.5, 0, Math.PI * 2)
    ctx.stroke()

    // Texture lines — seam
    ctx.strokeStyle = 'rgba(0,0,0,0.25)'
    ctx.lineWidth = 0.8
    ctx.beginPath()
    ctx.moveTo(-7, 0)
    ctx.bezierCurveTo(-5, -4, 5, -4, 7, 0)
    ctx.stroke()
    ctx.beginPath()
    ctx.moveTo(-7, 0)
    ctx.bezierCurveTo(-5, 4, 5, 4, 7, 0)
    ctx.stroke()

    // Top cap
    ctx.fillStyle = '#2a3018'
    ctx.beginPath()
    ctx.arc(0, -7, 3, 0, Math.PI * 2)
    ctx.fill()

    // Safety pin lever
    ctx.strokeStyle = '#aab080'
    ctx.lineWidth = 1.2
    ctx.lineCap = 'round'
    ctx.beginPath()
    ctx.moveTo(0, -10)
    ctx.lineTo(5, -13)
    ctx.stroke()

    // Fuse indicator LED
    if (critical) {
      const ledColor = pulse > 0.5
        ? `rgba(255,60,60,${0.7 + pulse * 0.3})`
        : `rgba(255,120,60,${0.3 + pulse * 0.5})`
      ctx.fillStyle = ledColor
      ctx.shadowColor = 'rgba(255,60,60,0.8)'
      ctx.shadowBlur = pulse * 10
      ctx.beginPath()
      ctx.arc(0, -7, 2.2, 0, Math.PI * 2)
      ctx.fill()
      ctx.shadowBlur = 0
    } else {
      ctx.fillStyle = `rgba(80,200,80,${0.5 + fuseRatio * 0.5})`
      ctx.beginPath()
      ctx.arc(0, -7, 1.8, 0, Math.PI * 2)
      ctx.fill()
    }

    ctx.restore()
  }
}

// ─── Gas Clouds ──────────────────────────────────────────────────────────────────

export function drawGasClouds(ctx, gasClouds, now) {
  const t = now / 1000

  for (const gas of (gasClouds || [])) {
    const alpha    = Math.min(0.55, (gas.life / gas.duration) * 0.55)
    const radius   = gas.radius ?? 60
    const puffs    = gas._puffs || buildGasPuffs(gas)
    if (!gas._puffs) gas._puffs = puffs

    ctx.save()

    // Puff clouds
    for (const puff of puffs) {
      const drift  = Math.sin(t * puff.freq + puff.phase) * 4
      const sway   = Math.cos(t * puff.freq * 0.7 + puff.phase) * 3
      const px     = gas.x + puff.ox + sway
      const py     = gas.y + puff.oy + drift
      const pr     = puff.r * (0.9 + Math.sin(t * 1.5 + puff.phase) * 0.1)
      const pAlpha = alpha * puff.a

      const pGrd = ctx.createRadialGradient(px - pr * 0.2, py - pr * 0.2, 0, px, py, pr)
      pGrd.addColorStop(0, `rgba(110,220,110,${pAlpha})`)
      pGrd.addColorStop(0.4, `rgba(60,180,70,${pAlpha * 0.7})`)
      pGrd.addColorStop(0.75, `rgba(30,120,40,${pAlpha * 0.35})`)
      pGrd.addColorStop(1, 'transparent')
      ctx.fillStyle = pGrd
      ctx.beginPath()
      ctx.arc(px, py, pr, 0, Math.PI * 2)
      ctx.fill()
    }

    // Central dense core
    const coreGrd = ctx.createRadialGradient(gas.x, gas.y, 0, gas.x, gas.y, radius * 0.4)
    coreGrd.addColorStop(0, `rgba(80,210,90,${alpha * 0.5})`)
    coreGrd.addColorStop(1, 'transparent')
    ctx.fillStyle = coreGrd
    ctx.beginPath()
    ctx.arc(gas.x, gas.y, radius * 0.4, 0, Math.PI * 2)
    ctx.fill()

    // Particle specks
    ctx.fillStyle = `rgba(180,255,180,${alpha * 0.4})`
    for (const puff of puffs) {
      const sx = gas.x + puff.ox + Math.sin(t * 3.1 + puff.phase) * 6
      const sy = gas.y + puff.oy + Math.cos(t * 2.7 + puff.phase) * 6
      ctx.beginPath()
      ctx.arc(sx, sy, 1.2, 0, Math.PI * 2)
      ctx.fill()
    }

    ctx.restore()
  }
}

function buildGasPuffs(gas) {
  const radius = gas.radius ?? 60
  const count  = 14
  const puffs  = []
  for (let i = 0; i < count; i++) {
    const angle = (Math.PI * 2 / count) * i + Math.random() * 0.4
    const dist  = radius * (0.25 + Math.random() * 0.6)
    puffs.push({
      ox:    Math.cos(angle) * dist,
      oy:    Math.sin(angle) * dist,
      r:     radius * (0.3 + Math.random() * 0.35),
      a:     0.6 + Math.random() * 0.4,
      freq:  1.2 + Math.random() * 1.2,
      phase: Math.random() * Math.PI * 2,
    })
  }
  return puffs
}

// ─── Pickups ──────────────────────────────────────────────────────────────────────

const PICKUP_CONFIGS = {
  health:    { colors: ['#16a34a', '#22c55e'], symbol: '+',  glow: '34,197,94',   shape: 'cross'    },
  armor:     { colors: ['#1d4ed8', '#60a5fa'], symbol: '◈',  glow: '96,165,250',  shape: 'diamond'  },
  jetfuel:   { colors: ['#1e40af', '#3b82f6'], symbol: '⟁',  glow: '59,130,246',  shape: 'hexagon'  },
  grenade:   { colors: ['#525252', '#a3a3a3'], symbol: '●',  glow: '163,163,163', shape: 'circle'   },
  weapon:    { colors: ['#b45309', '#f59e0b'], symbol: '⊹',  glow: '245,158,11',  shape: 'octagon'  },
  speed:     { colors: ['#a16207', '#facc15'], symbol: '≫',  glow: '250,204,21',  shape: 'circle'   },
  rapidfire: { colors: ['#9a3412', '#f97316'], symbol: '◆',  glow: '249,115,22',  shape: 'circle'   },
}

export function drawPickups(ctx, pickups, now) {
  const t = now / 1000

  for (const pk of (pickups || [])) {
    const cfg   = PICKUP_CONFIGS[pk.type] || PICKUP_CONFIGS.health
    const bob   = Math.sin(t * 2.5 + (pk.x ?? 0) * 0.02) * 4
    const spin  = t * (pk.type === 'weapon' ? 0.8 : 0.4)
    const pulse = 0.65 + Math.sin(t * 3.5) * 0.35

    ctx.save()
    ctx.translate(pk.x, pk.y + bob)

    // Ground halo
    ctx.save()
    ctx.scale(1, 0.2)
    const haloGrd = ctx.createRadialGradient(0, 0, 0, 0, 0, 20)
    haloGrd.addColorStop(0, `rgba(${cfg.glow},${0.15 * pulse})`)
    haloGrd.addColorStop(1, 'transparent')
    ctx.fillStyle = haloGrd
    ctx.beginPath()
    ctx.arc(0, bob * 4 + 70, 20, 0, Math.PI * 2)
    ctx.fill()
    ctx.restore()

    // Outer glow ring
    const glowGrd = ctx.createRadialGradient(0, 0, 8, 0, 0, 32)
    glowGrd.addColorStop(0, `rgba(${cfg.glow},${0.2 * pulse})`)
    glowGrd.addColorStop(0.5, `rgba(${cfg.glow},${0.08 * pulse})`)
    glowGrd.addColorStop(1, 'transparent')
    ctx.fillStyle = glowGrd
    ctx.beginPath()
    ctx.arc(0, 0, 32, 0, Math.PI * 2)
    ctx.fill()

    // Rotating ring
    ctx.save()
    ctx.rotate(spin)
    ctx.strokeStyle = `rgba(${cfg.glow},${0.3 * pulse})`
    ctx.lineWidth = 1
    ctx.setLineDash([4, 6])
    ctx.beginPath()
    ctx.arc(0, 0, 16, 0, Math.PI * 2)
    ctx.stroke()
    ctx.setLineDash([])
    ctx.restore()

    // Outer body shell
    const shellGrd = ctx.createRadialGradient(-3, -3, 1, 0, 0, 13)
    shellGrd.addColorStop(0, cfg.colors[1])
    shellGrd.addColorStop(0.6, cfg.colors[0])
    shellGrd.addColorStop(1, shadeColor(cfg.colors[0], -40))
    ctx.fillStyle = shellGrd

    ctx.save()
    ctx.rotate(spin * 0.5)
    drawPickupShape(ctx, cfg.shape, 12)
    ctx.restore()

    // Rim
    ctx.strokeStyle = `rgba(255,255,255,0.3)`
    ctx.lineWidth = 1.2
    ctx.save()
    ctx.rotate(spin * 0.5)
    drawPickupShape(ctx, cfg.shape, 12, true)
    ctx.restore()

    // Inner highlight
    const highlightGrd = ctx.createRadialGradient(-3, -4, 0, 0, 0, 7)
    highlightGrd.addColorStop(0, 'rgba(255,255,255,0.4)')
    highlightGrd.addColorStop(1, 'transparent')
    ctx.fillStyle = highlightGrd
    ctx.beginPath()
    ctx.arc(0, 0, 7, 0, Math.PI * 2)
    ctx.fill()

    // Symbol
    ctx.fillStyle = '#fff'
    ctx.shadowColor = `rgba(${cfg.glow},0.8)`
    ctx.shadowBlur = 6
    ctx.font = `bold ${pk.type === 'health' ? 13 : 10}px Inter, Arial, sans-serif`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(cfg.symbol, 0, 0)
    ctx.shadowBlur = 0

    // Weapon label badge
    if (pk.type === 'weapon' && pk.weaponId) {
      const label = pk.weaponId.toUpperCase()
      ctx.font = 'bold 7px Inter, Arial, sans-serif'
      const lw = ctx.measureText(label).width + 6
      ctx.fillStyle = 'rgba(0,0,0,0.6)'
      ctx.beginPath()
      roundRect(ctx, -lw / 2, 15, lw, 11, 3)
      ctx.fill()
      ctx.fillStyle = '#fde68a'
      ctx.fillText(label, 0, 21)
    }

    ctx.restore()
  }
}

// ─── Pickup Shape Helper ─────────────────────────────────────────────────────────

function drawPickupShape(ctx, shape, r, stroke = false) {
  ctx.beginPath()
  switch (shape) {
    case 'cross': {
      const arm = r * 0.4, half = r * 0.75
      ctx.moveTo(-arm, -half)
      ctx.lineTo( arm, -half)
      ctx.lineTo( arm, -arm)
      ctx.lineTo( half, -arm)
      ctx.lineTo( half,  arm)
      ctx.lineTo( arm,  arm)
      ctx.lineTo( arm,  half)
      ctx.lineTo(-arm,  half)
      ctx.lineTo(-arm,  arm)
      ctx.lineTo(-half,  arm)
      ctx.lineTo(-half, -arm)
      ctx.lineTo(-arm, -arm)
      ctx.closePath()
      break
    }
    case 'diamond': {
      ctx.moveTo(0, -r)
      ctx.lineTo(r * 0.7, 0)
      ctx.lineTo(0, r)
      ctx.lineTo(-r * 0.7, 0)
      ctx.closePath()
      break
    }
    case 'hexagon': {
      for (let i = 0; i < 6; i++) {
        const a = (Math.PI / 3) * i - Math.PI / 6
        i === 0
          ? ctx.moveTo(Math.cos(a) * r, Math.sin(a) * r)
          : ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r)
      }
      ctx.closePath()
      break
    }
    case 'octagon': {
      for (let i = 0; i < 8; i++) {
        const a = (Math.PI / 4) * i - Math.PI / 8
        i === 0
          ? ctx.moveTo(Math.cos(a) * r, Math.sin(a) * r)
          : ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r)
      }
      ctx.closePath()
      break
    }
    default: {
      ctx.arc(0, 0, r, 0, Math.PI * 2)
      break
    }
  }
  stroke ? ctx.stroke() : ctx.fill()
}

// ─── Color Utils ─────────────────────────────────────────────────────────────────

function hexToRgba(hex, alpha) {
  if (!hex || hex[0] !== '#') return `rgba(200,200,200,${alpha})`
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  return `rgba(${r},${g},${b},${alpha})`
}

function shadeColor(hex, amt) {
  if (!hex || hex[0] !== '#') return '#888'
  const r = Math.max(0, Math.min(255, parseInt(hex.slice(1, 3), 16) + amt))
  const g = Math.max(0, Math.min(255, parseInt(hex.slice(3, 5), 16) + amt))
  const b = Math.max(0, Math.min(255, parseInt(hex.slice(5, 7), 16) + amt))
  return `rgb(${r},${g},${b})`
}