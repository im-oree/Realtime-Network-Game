// ─── Character (Player) Rendering ──────────────────────────────────────────────

const BODY_R = 16

export function drawCharacter(ctx, p, isMe, now, weapons) {
  if (p.dead) return
  const t = now / 1000

  ctx.save()
  ctx.translate(p.x, p.y)

  // ── Shadow ──────────────────────────────────────────────────────────────
  ctx.save()
  ctx.scale(1, 0.3)
  ctx.translate(0, BODY_R * 4)
  const shGrd = ctx.createRadialGradient(0, 0, 0, 0, 0, BODY_R)
  shGrd.addColorStop(0, 'rgba(0,0,0,0.4)')
  shGrd.addColorStop(1, 'transparent')
  ctx.fillStyle = shGrd
  ctx.beginPath(); ctx.arc(0, 0, BODY_R, 0, Math.PI * 2); ctx.fill()
  ctx.restore()

  // ── Speed aura ──────────────────────────────────────────────────────────
  if (p.speedBoost) {
    ctx.strokeStyle = `rgba(250,204,21,${0.3 + Math.sin(t * 8) * 0.2})`
    ctx.lineWidth = 2.5
    ctx.beginPath(); ctx.arc(0, 0, BODY_R + 6, 0, Math.PI * 2); ctx.stroke()
  }

  // ── RapidFire indicator ─────────────────────────────────────────────────
  if (p.rapidFire) {
    ctx.fillStyle = `rgba(249,115,22,${0.4 + Math.sin(t * 6) * 0.3})`
    ctx.beginPath(); ctx.arc(0, -BODY_R - 10, 5, 0, Math.PI * 2); ctx.fill()
  }

  // ── Armor ring ──────────────────────────────────────────────────────────
  if (p.armor > 0) {
    const armorRatio = p.armor / 100
    ctx.strokeStyle = `rgba(96,165,250,${0.6 * armorRatio})`
    ctx.lineWidth = 3
    ctx.beginPath()
    ctx.arc(0, 0, BODY_R + 4, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * armorRatio)
    ctx.stroke()
  }

  // ── Glow ────────────────────────────────────────────────────────────────
  const rgb = hexToRgb(p.color)
  const glowGrd = ctx.createRadialGradient(0, 0, BODY_R * 0.5, 0, 0, BODY_R * 2)
  glowGrd.addColorStop(0, `rgba(${rgb},0.2)`)
  glowGrd.addColorStop(1, 'transparent')
  ctx.fillStyle = glowGrd
  ctx.beginPath(); ctx.arc(0, 0, BODY_R * 2, 0, Math.PI * 2); ctx.fill()

  // ── Legs (simple) ──────────────────────────────────────────────────────
  const walkPhase = p.onGround && Math.abs(p.vx) > 10 ? Math.sin(t * 12) : 0
  ctx.fillStyle = darken(p.color, 40)
  // Left leg
  ctx.fillRect(-7, BODY_R - 2, 5, 8 + walkPhase * 3)
  // Right leg
  ctx.fillRect(2, BODY_R - 2, 5, 8 - walkPhase * 3)

  // ── Body ────────────────────────────────────────────────────────────────
  const bodyGrd = ctx.createRadialGradient(-3, -3, 2, 0, 0, BODY_R)
  bodyGrd.addColorStop(0, lighten(p.color, 30))
  bodyGrd.addColorStop(1, p.color)
  ctx.fillStyle = bodyGrd
  ctx.beginPath(); ctx.arc(0, 0, BODY_R, 0, Math.PI * 2); ctx.fill()

  // Body rim
  ctx.strokeStyle = `rgba(${rgb},0.7)`
  ctx.lineWidth = 2
  ctx.stroke()

  // Highlight
  ctx.fillStyle = 'rgba(255,255,255,0.15)'
  ctx.beginPath()
  ctx.ellipse(-4, -5, BODY_R * 0.5, BODY_R * 0.3, -0.5, 0, Math.PI * 2)
  ctx.fill()

  // ── Face ────────────────────────────────────────────────────────────────
  const eyeX = p.facing > 0 ? 4 : -4
  ctx.fillStyle = '#fff'
  ctx.beginPath(); ctx.arc(eyeX - 3, -3, 3, 0, Math.PI * 2); ctx.fill()
  ctx.beginPath(); ctx.arc(eyeX + 3, -3, 3, 0, Math.PI * 2); ctx.fill()
  ctx.fillStyle = '#111'
  ctx.beginPath(); ctx.arc(eyeX - 2, -3, 1.5, 0, Math.PI * 2); ctx.fill()
  ctx.beginPath(); ctx.arc(eyeX + 4, -3, 1.5, 0, Math.PI * 2); ctx.fill()

  // ── Weapon arm ──────────────────────────────────────────────────────────
  ctx.save()
  ctx.rotate(p.angle || 0)
  const wpn = weapons && weapons[p.weapon]
  drawWeaponOnCharacter(ctx, p, wpn)
  ctx.restore()

  // ── Jetpack ─────────────────────────────────────────────────────────────
  ctx.fillStyle = '#4a5568'
  ctx.fillRect(-12, -4, 5, 14)
  ctx.fillRect(7, -4, 5, 14)
  // Fuel indicator
  const fuelRatio = (p.jetpackFuel ?? 100) / 100
  ctx.fillStyle = fuelRatio > 0.3 ? '#3b82f6' : '#ef4444'
  ctx.fillRect(-11, -3 + 12 * (1 - fuelRatio), 3, 12 * fuelRatio)
  ctx.fillRect(8, -3 + 12 * (1 - fuelRatio), 3, 12 * fuelRatio)

  // ── "Me" indicator ──────────────────────────────────────────────────────
  if (isMe) {
    ctx.strokeStyle = '#fff'
    ctx.lineWidth = 1.5
    ctx.setLineDash([4, 4])
    ctx.lineDashOffset = t * 15
    ctx.beginPath(); ctx.arc(0, 0, BODY_R + 16, 0, Math.PI * 2); ctx.stroke()
    ctx.setLineDash([])

    // Arrow above head
    ctx.fillStyle = '#ffffff88'
    ctx.beginPath()
    ctx.moveTo(0, -BODY_R - 28)
    ctx.lineTo(-5, -BODY_R - 22)
    ctx.lineTo(5, -BODY_R - 22)
    ctx.closePath()
    ctx.fill()
  }

  ctx.restore()

  // ── Username ────────────────────────────────────────────────────────────
  ctx.save()
  ctx.font = 'bold 11px Inter, Arial, sans-serif'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'bottom'
  ctx.fillStyle = 'rgba(0,0,0,0.6)'
  ctx.fillText(p.username || '', p.x + 1, p.y - BODY_R - 15)
  ctx.fillStyle = '#e2e8f0'
  ctx.fillText(p.username || '', p.x, p.y - BODY_R - 16)
  ctx.restore()

  // ── HP bar ──────────────────────────────────────────────────────────────
  drawHealthBar(ctx, p)
}

function drawWeaponOnCharacter(ctx, p, wpn) {
  const gunLen = wpn ? 14 + wpn.name.length * 0.5 : 14
  // Arm
  ctx.fillStyle = '#2a2a3a'
  ctx.fillRect(BODY_R - 4, -3, gunLen + 6, 6)
  // Gun body
  ctx.fillStyle = '#1a1a2a'
  ctx.fillRect(BODY_R + 2, -4, gunLen, 8)
  // Gun color accent
  if (wpn) {
    ctx.fillStyle = wpn.color || '#aaa'
    ctx.fillRect(BODY_R + gunLen - 2, -4, 4, 8)
  }
  // Muzzle
  ctx.fillStyle = '#333'
  ctx.fillRect(BODY_R + gunLen + 2, -2, 4, 4)

  // Reload indicator
  if (p.reloading) {
    ctx.fillStyle = '#ef444488'
    ctx.font = 'bold 9px Arial'
    ctx.textAlign = 'center'
    ctx.fillText('R', BODY_R + gunLen / 2, -8)
  }
}

function drawHealthBar(ctx, p) {
  const bw = 34, bh = 4
  const bx = p.x - bw / 2
  const by = p.y - BODY_R - 12
  const ratio = Math.max(0, p.hp / p.maxHp)

  ctx.fillStyle = 'rgba(0,0,0,0.5)'
  ctx.beginPath()
  roundRect(ctx, bx, by, bw, bh, 2)
  ctx.fill()

  const hpColor = ratio > 0.5 ? '#22c55e' : ratio > 0.25 ? '#facc15' : '#ef4444'
  ctx.fillStyle = hpColor
  ctx.beginPath()
  roundRect(ctx, bx, by, bw * ratio, bh, 2)
  ctx.fill()

  ctx.fillStyle = 'rgba(255,255,255,0.15)'
  ctx.fillRect(bx + 1, by, bw * ratio - 2, bh / 2)
}

function roundRect(ctx, x, y, w, h, r) {
  if (w < 2 * r) r = w / 2
  if (h < 2 * r) r = h / 2
  ctx.moveTo(x + r, y)
  ctx.arcTo(x + w, y, x + w, y + h, r)
  ctx.arcTo(x + w, y + h, x, y + h, r)
  ctx.arcTo(x, y + h, x, y, r)
  ctx.arcTo(x, y, x + w, y, r)
}

function hexToRgb(hex) {
  if (!hex || hex.length < 7) return '100,100,100'
  return `${parseInt(hex.slice(1, 3), 16)},${parseInt(hex.slice(3, 5), 16)},${parseInt(hex.slice(5, 7), 16)}`
}
function lighten(hex, n) {
  if (!hex) return '#888'
  const r = Math.min(255, parseInt(hex.slice(1, 3), 16) + n)
  const g = Math.min(255, parseInt(hex.slice(3, 5), 16) + n)
  const b = Math.min(255, parseInt(hex.slice(5, 7), 16) + n)
  return `rgb(${r},${g},${b})`
}
function darken(hex, n) {
  if (!hex) return '#222'
  const r = Math.max(0, parseInt(hex.slice(1, 3), 16) - n)
  const g = Math.max(0, parseInt(hex.slice(3, 5), 16) - n)
  const b = Math.max(0, parseInt(hex.slice(5, 7), 16) - n)
  return `rgb(${r},${g},${b})`
}