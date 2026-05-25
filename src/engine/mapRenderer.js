// ─── Map Rendering (platforms, walls, decorations) ─────────────────────────────

export function drawMap(ctx, mapData, camera, now) {
  if (!mapData) return

  // Background
  ctx.fillStyle = mapData.background || '#0a1a0f'
  const mw = mapData.width, mh = mapData.height
  ctx.fillRect(0, 0, mw, mh)

  // Background grid
  ctx.save()
  ctx.strokeStyle = 'rgba(255,255,255,0.015)'
  ctx.lineWidth = 1
  const gs = 60
  for (let x = 0; x < mw; x += gs) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, mh); ctx.stroke() }
  for (let y = 0; y < mh; y += gs) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(mw, y); ctx.stroke() }
  ctx.restore()

  // Decorations (behind platforms)
  drawDecorations(ctx, mapData.decorations, now)

  // Platforms
  for (const plat of (mapData.platforms || [])) {
    drawPlatform(ctx, plat)
  }

  // Walls
  for (const wall of (mapData.walls || [])) {
    ctx.save()
    ctx.fillStyle = '#1e2d4a'
    ctx.fillRect(wall.x, wall.y, wall.w, wall.h)
    ctx.fillStyle = 'rgba(255,255,255,0.06)'
    ctx.fillRect(wall.x, wall.y, wall.w, 3)
    ctx.strokeStyle = 'rgba(59,130,246,0.3)'
    ctx.lineWidth = 1
    ctx.strokeRect(wall.x, wall.y, wall.w, wall.h)
    ctx.restore()
  }
}

function drawPlatform(ctx, plat) {
  ctx.save()
  const isGround = plat.type === 'ground'

  // Main body
  if (isGround) {
    const grd = ctx.createLinearGradient(plat.x, plat.y, plat.x, plat.y + plat.h)
    grd.addColorStop(0, plat.color || '#3d2b16')
    grd.addColorStop(1, darken(plat.color || '#3d2b16', 30))
    ctx.fillStyle = grd
  } else {
    ctx.fillStyle = plat.color || '#5a3e1b'
  }
  ctx.fillRect(plat.x, plat.y, plat.w, plat.h)

  // Top edge highlight
  ctx.fillStyle = isGround ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.12)'
  ctx.fillRect(plat.x, plat.y, plat.w, isGround ? 4 : 3)

  // Bottom shadow
  if (!isGround) {
    ctx.fillStyle = 'rgba(0,0,0,0.2)'
    ctx.fillRect(plat.x, plat.y + plat.h - 2, plat.w, 2)
  }

  // Edge line
  ctx.strokeStyle = 'rgba(255,255,255,0.05)'
  ctx.lineWidth = 1
  ctx.strokeRect(plat.x, plat.y, plat.w, plat.h)

  ctx.restore()
}

function drawDecorations(ctx, decorations, now) {
  if (!decorations) return
  const t = now / 1000

  for (const dec of decorations) {
    ctx.save()
    ctx.translate(dec.x, dec.y)
    const s = dec.size || 1

    switch (dec.type) {
      case 'tree':
        drawTree(ctx, s, t)
        break
      case 'rock':
        drawRock(ctx, s)
        break
      case 'bush':
        drawBush(ctx, s, t)
        break
      case 'cactus':
        drawCactus(ctx, s)
        break
      case 'skull':
        drawSkull(ctx, s)
        break
      case 'torch':
        drawTorch(ctx, s, t)
        break
      case 'banner':
        drawBanner(ctx, s, t)
        break
      case 'barrel':
        drawBarrel(ctx, s)
        break
      case 'crate':
        drawCrate(ctx, s)
        break
      case 'pipe':
        drawPipe(ctx, s)
        break
      default:
        break
    }
    ctx.restore()
  }
}

function drawTree(ctx, s, t) {
  const sway = Math.sin(t * 0.8) * 2 * s
  // Trunk
  ctx.fillStyle = '#3d2b16'
  ctx.fillRect(-6 * s, -60 * s, 12 * s, 60 * s)
  // Canopy layers
  const layers = [
    { y: -60, r: 35, c: '#1a4a1a' },
    { y: -75, r: 28, c: '#226622' },
    { y: -88, r: 20, c: '#2a8a2a' }
  ]
  for (const l of layers) {
    ctx.fillStyle = l.c
    ctx.beginPath()
    ctx.arc(sway * 0.3, l.y * s, l.r * s, 0, Math.PI * 2)
    ctx.fill()
  }
}

function drawRock(ctx, s) {
  ctx.fillStyle = '#4a4a4a'
  ctx.beginPath()
  ctx.moveTo(-18 * s, 0)
  ctx.lineTo(-15 * s, -14 * s)
  ctx.lineTo(-4 * s, -20 * s)
  ctx.lineTo(10 * s, -16 * s)
  ctx.lineTo(18 * s, -8 * s)
  ctx.lineTo(16 * s, 0)
  ctx.closePath()
  ctx.fill()
  ctx.fillStyle = 'rgba(255,255,255,0.08)'
  ctx.beginPath()
  ctx.moveTo(-12 * s, -12 * s)
  ctx.lineTo(-4 * s, -18 * s)
  ctx.lineTo(6 * s, -14 * s)
  ctx.lineTo(-5 * s, -10 * s)
  ctx.closePath()
  ctx.fill()
}

function drawBush(ctx, s, t) {
  const sway = Math.sin(t * 1.2 + ctx.canvas?.width || 0) * 1.5 * s
  const colors = ['#1a5a1a', '#226622', '#2a7a2a']
  for (let i = 0; i < 3; i++) {
    ctx.fillStyle = colors[i]
    ctx.beginPath()
    ctx.arc(-10 * s + i * 10 * s + sway * 0.2, -8 * s, (12 + i * 2) * s, 0, Math.PI * 2)
    ctx.fill()
  }
}

function drawCactus(ctx, s) {
  ctx.fillStyle = '#2d6b2d'
  // Main body
  ctx.fillRect(-6 * s, -50 * s, 12 * s, 50 * s)
  // Arms
  ctx.fillRect(-20 * s, -35 * s, 14 * s, 8 * s)
  ctx.fillRect(-20 * s, -35 * s, 8 * s, -15 * s)
  ctx.fillRect(6 * s, -25 * s, 14 * s, 8 * s)
  ctx.fillRect(12 * s, -25 * s, 8 * s, -12 * s)
  ctx.fillStyle = 'rgba(255,255,255,0.1)'
  ctx.fillRect(-4 * s, -48 * s, 3 * s, 45 * s)
}

function drawSkull(ctx, s) {
  ctx.fillStyle = '#d4c8a0'
  ctx.beginPath()
  ctx.arc(0, -6 * s, 8 * s, 0, Math.PI * 2)
  ctx.fill()
  ctx.fillStyle = '#1a150a'
  ctx.beginPath(); ctx.arc(-3 * s, -7 * s, 2 * s, 0, Math.PI * 2); ctx.fill()
  ctx.beginPath(); ctx.arc(3 * s, -7 * s, 2 * s, 0, Math.PI * 2); ctx.fill()
}

function drawTorch(ctx, s, t) {
  ctx.fillStyle = '#5a3e1b'
  ctx.fillRect(-3 * s, -20 * s, 6 * s, 20 * s)
  // Flame
  const flicker = Math.sin(t * 8) * 2
  const grad = ctx.createRadialGradient(flicker, -22 * s, 0, 0, -22 * s, 12 * s)
  grad.addColorStop(0, '#ffcc00cc')
  grad.addColorStop(0.5, '#ff660066')
  grad.addColorStop(1, 'transparent')
  ctx.fillStyle = grad
  ctx.beginPath()
  ctx.arc(flicker, -22 * s, 12 * s, 0, Math.PI * 2)
  ctx.fill()
}

function drawBanner(ctx, s, t) {
  ctx.fillStyle = '#4a3e2a'
  ctx.fillRect(-2 * s, -40 * s, 4 * s, 40 * s)
  const sway = Math.sin(t * 1.5) * 3
  ctx.fillStyle = '#8b1a1a'
  ctx.beginPath()
  ctx.moveTo(2 * s, -38 * s)
  ctx.lineTo(20 * s + sway, -35 * s)
  ctx.lineTo(18 * s + sway, -22 * s)
  ctx.lineTo(2 * s, -20 * s)
  ctx.closePath()
  ctx.fill()
}

function drawBarrel(ctx, s) {
  ctx.fillStyle = '#5a4a3a'
  ctx.beginPath()
  ctx.ellipse(0, 0, 12 * s, 6 * s, 0, 0, Math.PI * 2)
  ctx.fill()
  ctx.fillStyle = '#6a5a4a'
  ctx.fillRect(-12 * s, -22 * s, 24 * s, 22 * s)
  ctx.strokeStyle = '#3a3a2a'
  ctx.lineWidth = 2
  ctx.beginPath()
  ctx.moveTo(-12 * s, -8 * s)
  ctx.lineTo(12 * s, -8 * s)
  ctx.stroke()
}

function drawCrate(ctx, s) {
  ctx.fillStyle = '#6a5a3a'
  ctx.fillRect(-14 * s, -18 * s, 28 * s, 18 * s)
  ctx.strokeStyle = '#4a3a2a'
  ctx.lineWidth = 2 * s
  ctx.strokeRect(-14 * s, -18 * s, 28 * s, 18 * s)
  ctx.beginPath()
  ctx.moveTo(-14 * s, -18 * s); ctx.lineTo(14 * s, 0); ctx.stroke()
  ctx.moveTo(14 * s, -18 * s); ctx.lineTo(-14 * s, 0); ctx.stroke()
}

function drawPipe(ctx, s) {
  ctx.fillStyle = '#5a6a7a'
  ctx.fillRect(-4 * s, -40 * s, 8 * s, 80 * s)
  ctx.fillStyle = '#4a5a6a'
  ctx.fillRect(-6 * s, -5 * s, 12 * s, 10 * s)
  ctx.fillStyle = 'rgba(255,255,255,0.08)'
  ctx.fillRect(-2 * s, -38 * s, 2 * s, 76 * s)
}

function darken(hex, amount) {
  const r = Math.max(0, parseInt(hex.slice(1, 3), 16) - amount)
  const g = Math.max(0, parseInt(hex.slice(3, 5), 16) - amount)
  const b = Math.max(0, parseInt(hex.slice(5, 7), 16) - amount)
  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`
}