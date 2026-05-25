// ─── Character (Player) Rendering ──────────────────────────────────────────────
// A polished, layered 2D character with torso, head, limbs, gear, and VFX.
// Try to force redeploy

const BODY_W = 20
const BODY_H = 26
const HEAD_R = 11
const ARM_LEN = 14
const ARM_W = 5
const LEG_W = 6
const LEG_H = 14
const SHOULDER_Y = -6
const HIP_Y = BODY_H / 2 - 2

// ─── Utility ────────────────────────────────────────────────────────────────────

function hexToRgb(hex) {
  if (!hex || hex.length < 7) return '120,120,120'
  return `${parseInt(hex.slice(1, 3), 16)},${parseInt(hex.slice(3, 5), 16)},${parseInt(hex.slice(5, 7), 16)}`
}

function lighten(hex, n) {
  if (!hex) return '#aaa'
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

function lerpColor(a, b, t) {
  const ar = parseInt(a.slice(1, 3), 16), ag = parseInt(a.slice(3, 5), 16), ab = parseInt(a.slice(5, 7), 16)
  const br = parseInt(b.slice(1, 3), 16), bg = parseInt(b.slice(3, 5), 16), bb = parseInt(b.slice(5, 7), 16)
  const rr = Math.round(ar + (br - ar) * t)
  const rg = Math.round(ag + (bg - ag) * t)
  const rb = Math.round(ab + (bb - ab) * t)
  return `rgb(${rr},${rg},${rb})`
}

function roundRect(ctx, x, y, w, h, r) {
  r = Math.min(r, w / 2, h / 2)
  if (w <= 0) return
  ctx.moveTo(x + r, y)
  ctx.arcTo(x + w, y, x + w, y + h, r)
  ctx.arcTo(x + w, y + h, x, y + h, r)
  ctx.arcTo(x, y + h, x, y, r)
  ctx.arcTo(x, y, x + w, y, r)
  ctx.closePath()
}

function capsule(ctx, x, y, w, h) {
  const r = w / 2
  ctx.moveTo(x, y + r)
  ctx.arcTo(x, y, x + w, y, r)
  ctx.arcTo(x + w, y, x + w, y + h, r)
  ctx.arcTo(x + w, y + h, x, y + h, r)
  ctx.arcTo(x, y + h, x, y, r)
  ctx.closePath()
}

// ─── Main Draw ──────────────────────────────────────────────────────────────────

export function drawCharacter(ctx, p, isMe, now, weapons) {
  if (p.dead) return
  const t = now / 1000
  const facing = p.facing || 1
  const isMoving = p.onGround && Math.abs(p.vx) > 15
  const isFalling = !p.onGround
  const walkCycle = isMoving ? Math.sin(t * 14) : 0
  const breathe = Math.sin(t * 2.5) * 0.8
  const rgb = hexToRgb(p.color || '#6688cc')
  const angle = p.angle || 0

  ctx.save()
  ctx.translate(p.x, p.y)

  // ── Ground Shadow ─────────────────────────────────────────────────────────
  drawShadow(ctx, p, isFalling)

  // ── Status Effects (behind character) ─────────────────────────────────────
  drawStatusEffects(ctx, p, t, rgb)

  // ── Flip based on facing ──────────────────────────────────────────────────
  ctx.save()
  ctx.scale(facing, 1)

  // ── Jetpack (behind body) ─────────────────────────────────────────────────
  drawJetpack(ctx, p, t)

  // ── Back Arm ──────────────────────────────────────────────────────────────
  drawArm(ctx, p, t, facing, angle, weapons, true, walkCycle)

  // ── Legs ──────────────────────────────────────────────────────────────────
  drawLegs(ctx, p, t, walkCycle, isFalling)

  // ── Torso ─────────────────────────────────────────────────────────────────
  drawTorso(ctx, p, breathe)

  // ── Head ──────────────────────────────────────────────────────────────────
  drawHead(ctx, p, t, facing, angle, breathe)

  // ── Front Arm + Weapon ────────────────────────────────────────────────────
  drawArm(ctx, p, t, facing, angle, weapons, false, walkCycle)

  ctx.restore() // un-flip

  // ── Armor Ring ────────────────────────────────────────────────────────────
  if (p.armor > 0) {
    drawArmorRing(ctx, p, t)
  }

  // ── "Me" Indicator ────────────────────────────────────────────────────────
  if (isMe) {
    drawMeIndicator(ctx, t)
  }

  ctx.restore() // un-translate

  // ── Username ──────────────────────────────────────────────────────────────
  drawUsername(ctx, p)

  // ── HP Bar ────────────────────────────────────────────────────────────────
  drawHealthBar(ctx, p)
}

// ─── Shadow ─────────────────────────────────────────────────────────────────────

function drawShadow(ctx, p, isFalling) {
  ctx.save()
  const shadowScale = isFalling ? 0.6 : 1
  const shadowY = isFalling ? BODY_H + 20 : BODY_H + 6
  ctx.translate(0, shadowY)
  ctx.scale(1 * shadowScale, 0.25)
  const shGrd = ctx.createRadialGradient(0, 0, 0, 0, 0, BODY_W)
  shGrd.addColorStop(0, `rgba(0,0,0,${isFalling ? 0.15 : 0.35})`)
  shGrd.addColorStop(1, 'transparent')
  ctx.fillStyle = shGrd
  ctx.beginPath()
  ctx.arc(0, 0, BODY_W, 0, Math.PI * 2)
  ctx.fill()
  ctx.restore()
}

// ─── Status Effects ─────────────────────────────────────────────────────────────

function drawStatusEffects(ctx, p, t, rgb) {
  // Ambient glow
  const glowGrd = ctx.createRadialGradient(0, 0, 4, 0, 0, 36)
  glowGrd.addColorStop(0, `rgba(${rgb},0.12)`)
  glowGrd.addColorStop(1, 'transparent')
  ctx.fillStyle = glowGrd
  ctx.beginPath()
  ctx.arc(0, 0, 36, 0, Math.PI * 2)
  ctx.fill()

  // Speed boost — electric arcs
  if (p.speedBoost) {
    const pulseA = 0.4 + Math.sin(t * 10) * 0.3
    ctx.save()
    ctx.strokeStyle = `rgba(250,204,21,${pulseA})`
    ctx.lineWidth = 1.5
    ctx.shadowColor = 'rgba(250,204,21,0.6)'
    ctx.shadowBlur = 8
    for (let i = 0; i < 3; i++) {
      const a = (t * 4 + i * 2.1) % (Math.PI * 2)
      const r = 24 + Math.sin(t * 8 + i) * 3
      ctx.beginPath()
      ctx.arc(0, 0, r, a, a + 0.6)
      ctx.stroke()
    }
    ctx.restore()
  }

  // Rapid fire — orbiting ember
  if (p.rapidFire) {
    ctx.save()
    const orbAngle = t * 5
    const ox = Math.cos(orbAngle) * 22
    const oy = Math.sin(orbAngle) * 22 - 4
    const fireGrd = ctx.createRadialGradient(ox, oy, 0, ox, oy, 6)
    fireGrd.addColorStop(0, `rgba(249,115,22,${0.8 + Math.sin(t * 8) * 0.2})`)
    fireGrd.addColorStop(0.5, 'rgba(239,68,68,0.4)')
    fireGrd.addColorStop(1, 'transparent')
    ctx.fillStyle = fireGrd
    ctx.beginPath()
    ctx.arc(ox, oy, 6, 0, Math.PI * 2)
    ctx.fill()
    ctx.restore()
  }
}

// ─── Jetpack ────────────────────────────────────────────────────────────────────

function drawJetpack(ctx, p, t) {
  const fuelRatio = (p.jetpackFuel ?? 100) / 100
  const jx = -BODY_W / 2 - 6
  const jy = -4
  const jw = 8
  const jh = 18

  // Jetpack body
  ctx.fillStyle = '#3a3a4a'
  ctx.beginPath()
  roundRect(ctx, jx, jy, jw, jh, 3)
  ctx.fill()

  // Metallic edge
  ctx.strokeStyle = '#55556a'
  ctx.lineWidth = 1
  ctx.beginPath()
  roundRect(ctx, jx, jy, jw, jh, 3)
  ctx.stroke()

  // Fuel gauge
  const gaugeH = jh - 4
  const fuelH = gaugeH * fuelRatio
  ctx.fillStyle = 'rgba(0,0,0,0.4)'
  ctx.beginPath()
  roundRect(ctx, jx + 2, jy + 2, jw - 4, gaugeH, 1)
  ctx.fill()

  const fuelColor = fuelRatio > 0.3 ? '#3b82f6' : fuelRatio > 0.15 ? '#f59e0b' : '#ef4444'
  ctx.fillStyle = fuelColor
  ctx.beginPath()
  roundRect(ctx, jx + 2, jy + 2 + (gaugeH - fuelH), jw - 4, fuelH, 1)
  ctx.fill()

  // Nozzles
  ctx.fillStyle = '#2a2a38'
  ctx.beginPath()
  roundRect(ctx, jx + 1, jy + jh - 1, 3, 4, 1)
  ctx.fill()
  ctx.beginPath()
  roundRect(ctx, jx + jw - 4, jy + jh - 1, 3, 4, 1)
  ctx.fill()

  // Thruster flames when in air
  if (!p.onGround && fuelRatio > 0) {
    const flicker = Math.sin(t * 30) * 3 + Math.sin(t * 47) * 2
    const flameH = 8 + flicker

    for (let ni = 0; ni < 2; ni++) {
      const nx = jx + 1 + ni * (jw - 4) + 1.5
      const ny = jy + jh + 3

      const flameGrd = ctx.createLinearGradient(nx, ny, nx, ny + flameH)
      flameGrd.addColorStop(0, 'rgba(100,180,255,0.9)')
      flameGrd.addColorStop(0.3, 'rgba(59,130,246,0.7)')
      flameGrd.addColorStop(0.7, 'rgba(249,115,22,0.4)')
      flameGrd.addColorStop(1, 'transparent')
      ctx.fillStyle = flameGrd

      ctx.beginPath()
      ctx.moveTo(nx - 2.5, ny)
      ctx.quadraticCurveTo(nx, ny + flameH, nx + 2.5, ny)
      ctx.fill()
    }

    // Glow under jetpack
    ctx.save()
    ctx.shadowColor = 'rgba(59,130,246,0.5)'
    ctx.shadowBlur = 12
    ctx.fillStyle = 'rgba(59,130,246,0.08)'
    ctx.beginPath()
    ctx.arc(jx + jw / 2, jy + jh + 6, 10, 0, Math.PI * 2)
    ctx.fill()
    ctx.restore()
  }
}

// ─── Legs ───────────────────────────────────────────────────────────────────────

function drawLegs(ctx, p, t, walkCycle, isFalling) {
  const hipLX = -BODY_W / 2 + 3
  const hipRX = BODY_W / 2 - LEG_W - 3

  // Leg animation
  let leftAngle = 0
  let rightAngle = 0
  let leftLen = LEG_H
  let rightLen = LEG_H

  if (isFalling) {
    leftAngle = -0.2
    rightAngle = 0.2
    leftLen = LEG_H - 2
    rightLen = LEG_H - 2
  } else if (Math.abs(walkCycle) > 0.01) {
    leftAngle = walkCycle * 0.4
    rightAngle = -walkCycle * 0.4
    leftLen = LEG_H + walkCycle * 2
    rightLen = LEG_H - walkCycle * 2
  }

  // Left leg
  ctx.save()
  ctx.translate(hipLX + LEG_W / 2, HIP_Y)
  ctx.rotate(leftAngle)
  drawLimb(ctx, p, -LEG_W / 2, 0, LEG_W, leftLen, true)
  ctx.restore()

  // Right leg
  ctx.save()
  ctx.translate(hipRX + LEG_W / 2, HIP_Y)
  ctx.rotate(rightAngle)
  drawLimb(ctx, p, -LEG_W / 2, 0, LEG_W, rightLen, true)
  ctx.restore()
}

function drawLimb(ctx, p, x, y, w, h, isLeg) {
  const baseColor = isLeg ? darken(p.color, 55) : darken(p.color, 40)
  const highlightColor = isLeg ? darken(p.color, 35) : darken(p.color, 20)

  // Main limb shape
  ctx.fillStyle = baseColor
  ctx.beginPath()
  capsule(ctx, x, y, w, h)
  ctx.fill()

  // Inner highlight
  ctx.fillStyle = highlightColor
  ctx.beginPath()
  capsule(ctx, x + 1, y + 1, w - 2, h * 0.5)
  ctx.fill()

  // Boot / hand
  if (isLeg) {
    const bootH = 5
    ctx.fillStyle = '#2a2a3a'
    ctx.beginPath()
    roundRect(ctx, x - 1, y + h - bootH, w + 2, bootH, 2)
    ctx.fill()

    // Boot sole
    ctx.fillStyle = '#1a1a28'
    ctx.fillRect(x - 1, y + h - 1.5, w + 2, 1.5)
  }
}

// ─── Torso ──────────────────────────────────────────────────────────────────────

function drawTorso(ctx, p, breathe) {
  const tx = -BODY_W / 2
  const ty = -BODY_H / 2 + 2
  const tw = BODY_W
  const th = BODY_H - 4

  // Main torso
  const torsoGrd = ctx.createLinearGradient(tx, ty, tx, ty + th)
  torsoGrd.addColorStop(0, lighten(p.color, 15))
  torsoGrd.addColorStop(0.4, p.color)
  torsoGrd.addColorStop(1, darken(p.color, 25))
  ctx.fillStyle = torsoGrd
  ctx.beginPath()
  roundRect(ctx, tx, ty + breathe * 0.5, tw, th - breathe * 0.3, 5)
  ctx.fill()

  // Torso outline
  ctx.strokeStyle = darken(p.color, 40)
  ctx.lineWidth = 1.2
  ctx.beginPath()
  roundRect(ctx, tx, ty + breathe * 0.5, tw, th - breathe * 0.3, 5)
  ctx.stroke()

  // Chest detail — center stripe
  ctx.fillStyle = lighten(p.color, 25)
  ctx.globalAlpha = 0.2
  ctx.beginPath()
  roundRect(ctx, -2, ty + 4 + breathe * 0.5, 4, th - 12, 2)
  ctx.fill()
  ctx.globalAlpha = 1

  // Collar / neckline
  ctx.fillStyle = darken(p.color, 15)
  ctx.beginPath()
  ctx.ellipse(0, ty + 2 + breathe * 0.5, 7, 3, 0, 0, Math.PI)
  ctx.fill()

  // Belt
  ctx.fillStyle = '#2a2a3a'
  ctx.fillRect(tx + 2, ty + th - 6 - breathe * 0.3, tw - 4, 4)
  // Belt buckle
  ctx.fillStyle = '#c8a832'
  ctx.beginPath()
  roundRect(ctx, -3, ty + th - 7 - breathe * 0.3, 6, 5, 1)
  ctx.fill()
}

// ─── Head ───────────────────────────────────────────────────────────────────────

function drawHead(ctx, p, t, facing, angle, breathe) {
  const headY = -BODY_H / 2 - HEAD_R + 2 + breathe * 0.3
  const lookX = Math.cos(angle * facing) * 1.5
  const lookY = Math.sin(angle * facing) * 1

  ctx.save()
  ctx.translate(0, headY)

  // Neck
  ctx.fillStyle = darken(p.color, 10)
  ctx.fillRect(-3, HEAD_R - 4, 6, 6)

  // Head shape
  const headGrd = ctx.createRadialGradient(-2, -3, 2, 0, 0, HEAD_R)
  headGrd.addColorStop(0, lighten(p.color, 35))
  headGrd.addColorStop(0.6, lighten(p.color, 10))
  headGrd.addColorStop(1, darken(p.color, 10))
  ctx.fillStyle = headGrd
  ctx.beginPath()
  ctx.arc(0, 0, HEAD_R, 0, Math.PI * 2)
  ctx.fill()

  // Head outline
  ctx.strokeStyle = darken(p.color, 30)
  ctx.lineWidth = 1
  ctx.beginPath()
  ctx.arc(0, 0, HEAD_R, 0, Math.PI * 2)
  ctx.stroke()

  // Helmet / visor
  drawHelmet(ctx, p, HEAD_R)

  // Eyes
  drawEyes(ctx, lookX, lookY, t)

  // Mouth — slight expression
  const mouthY = 4
  ctx.strokeStyle = 'rgba(0,0,0,0.35)'
  ctx.lineWidth = 1.2
  ctx.lineCap = 'round'
  ctx.beginPath()
  ctx.moveTo(-3 + lookX * 0.3, mouthY)
  ctx.quadraticCurveTo(0 + lookX * 0.3, mouthY + 1.5, 3 + lookX * 0.3, mouthY)
  ctx.stroke()

  ctx.restore()
}

function drawHelmet(ctx, p, r) {
  // Visor band across forehead
  ctx.fillStyle = 'rgba(0,0,0,0.25)'
  ctx.beginPath()
  ctx.arc(0, 0, r + 0.5, -Math.PI * 0.85, -Math.PI * 0.15)
  ctx.lineTo(Math.cos(-Math.PI * 0.15) * (r - 4), Math.sin(-Math.PI * 0.15) * (r - 4))
  ctx.arc(0, 0, r - 4, -Math.PI * 0.15, -Math.PI * 0.85, true)
  ctx.closePath()
  ctx.fill()

  // Visor shine
  ctx.fillStyle = 'rgba(255,255,255,0.08)'
  ctx.beginPath()
  ctx.arc(0, 0, r + 0.5, -Math.PI * 0.75, -Math.PI * 0.35)
  ctx.lineTo(Math.cos(-Math.PI * 0.35) * (r - 2), Math.sin(-Math.PI * 0.35) * (r - 2))
  ctx.arc(0, 0, r - 2, -Math.PI * 0.35, -Math.PI * 0.75, true)
  ctx.closePath()
  ctx.fill()
}

function drawEyes(ctx, lookX, lookY, t) {
  const eyeY = -2
  const eyeSpacing = 4

  for (let side = -1; side <= 1; side += 2) {
    const ex = side * eyeSpacing + lookX
    const ey = eyeY + lookY

    // Eye white
    ctx.fillStyle = '#f0f0f0'
    ctx.beginPath()
    ctx.ellipse(ex, ey, 3.2, 3.5, 0, 0, Math.PI * 2)
    ctx.fill()

    // Eye outline
    ctx.strokeStyle = 'rgba(0,0,0,0.3)'
    ctx.lineWidth = 0.6
    ctx.beginPath()
    ctx.ellipse(ex, ey, 3.2, 3.5, 0, 0, Math.PI * 2)
    ctx.stroke()

    // Iris
    ctx.fillStyle = '#2563eb'
    ctx.beginPath()
    ctx.arc(ex + lookX * 0.5, ey + lookY * 0.3, 2, 0, Math.PI * 2)
    ctx.fill()

    // Pupil
    ctx.fillStyle = '#0a0a0a'
    ctx.beginPath()
    ctx.arc(ex + lookX * 0.6, ey + lookY * 0.4, 1, 0, Math.PI * 2)
    ctx.fill()

    // Eye shine
    ctx.fillStyle = 'rgba(255,255,255,0.85)'
    ctx.beginPath()
    ctx.arc(ex + lookX * 0.3 - 0.8, ey + lookY * 0.2 - 1, 0.8, 0, Math.PI * 2)
    ctx.fill()
  }

  // Blink (occasional)
  const blinkPhase = t % 4
  if (blinkPhase > 3.85 && blinkPhase < 4) {
    ctx.fillStyle = darken('#6688cc', 10)
    for (let side = -1; side <= 1; side += 2) {
      ctx.beginPath()
      ctx.ellipse(side * eyeSpacing + lookX, eyeY + lookY, 3.5, 3.8, 0, 0, Math.PI * 2)
      ctx.fill()
    }
  }
}

// ─── Arms ───────────────────────────────────────────────────────────────────────

function drawArm(ctx, p, t, facing, angle, weapons, isBack, walkCycle) {
  const shoulderX = isBack ? -BODY_W / 2 + 1 : BODY_W / 2 - 1
  const armAngle = isBack ? (walkCycle * 0.3 + Math.PI * 0.05) : angle * facing

  ctx.save()
  ctx.translate(shoulderX, SHOULDER_Y)

  if (isBack) {
    // Back arm — simple swing
    ctx.rotate(armAngle)
    ctx.globalAlpha = 0.7

    // Upper arm
    ctx.fillStyle = darken(p.color, 30)
    ctx.beginPath()
    capsule(ctx, -ARM_W / 2, 0, ARM_W, ARM_LEN)
    ctx.fill()

    // Glove
    ctx.fillStyle = '#2a2a3a'
    ctx.beginPath()
    ctx.arc(0, ARM_LEN, ARM_W / 2 + 0.5, 0, Math.PI * 2)
    ctx.fill()

    ctx.globalAlpha = 1
  } else {
    // Front arm — holds weapon, aims
    ctx.rotate(armAngle)

    // Upper arm
    ctx.fillStyle = darken(p.color, 20)
    ctx.beginPath()
    capsule(ctx, -ARM_W / 2, 0, ARM_W, ARM_LEN)
    ctx.fill()

    // Arm highlight
    ctx.fillStyle = lighten(p.color, 5)
    ctx.globalAlpha = 0.25
    ctx.beginPath()
    capsule(ctx, -ARM_W / 2 + 1, 1, ARM_W - 2, ARM_LEN * 0.4)
    ctx.fill()
    ctx.globalAlpha = 1

    // Glove
    ctx.fillStyle = '#2a2a3a'
    ctx.beginPath()
    ctx.arc(0, ARM_LEN, ARM_W / 2 + 0.5, 0, Math.PI * 2)
    ctx.fill()

    // Weapon
    const wpn = weapons && weapons[p.weapon]
    drawWeapon(ctx, p, wpn, ARM_LEN)
  }

  ctx.restore()
}

// ─── Weapon ─────────────────────────────────────────────────────────────────────

function drawWeapon(ctx, p, wpn, armLen) {
  const gunStart = armLen - 2
  const gunLen = wpn ? Math.min(24, 12 + wpn.name.length * 0.8) : 14
  const gunH = 6
  const barrelLen = 6
  const wpnColor = wpn?.color || '#888'

  ctx.save()
  ctx.translate(0, gunStart)

  // Gun body — dark base
  ctx.fillStyle = '#1c1c2e'
  ctx.beginPath()
  roundRect(ctx, -gunH / 2, -2, gunLen, gunH, 2)
  ctx.fill()

  // Gun body — top panel
  const gunGrd = ctx.createLinearGradient(0, -2, 0, gunH - 2)
  gunGrd.addColorStop(0, '#3a3a52')
  gunGrd.addColorStop(0.5, '#2a2a3e')
  gunGrd.addColorStop(1, '#1c1c2e')
  ctx.fillStyle = gunGrd
  ctx.beginPath()
  roundRect(ctx, -gunH / 2, -2, gunLen, gunH - 1, 2)
  ctx.fill()

  // Weapon accent stripe
  ctx.fillStyle = wpnColor
  ctx.globalAlpha = 0.7
  ctx.fillRect(-gunH / 2 + 2, -2, gunLen - 4, 2)
  ctx.globalAlpha = 1

  // Accent glow
  ctx.shadowColor = wpnColor
  ctx.shadowBlur = 4
  ctx.fillStyle = wpnColor
  ctx.fillRect(gunLen - gunH / 2 - 3, -1, 2, gunH - 2)
  ctx.shadowBlur = 0

  // Barrel
  ctx.fillStyle = '#252538'
  ctx.beginPath()
  roundRect(ctx, gunLen - gunH / 2, -1.5, barrelLen, 3, 1)
  ctx.fill()

  // Muzzle
  ctx.fillStyle = '#111'
  ctx.beginPath()
  ctx.arc(gunLen - gunH / 2 + barrelLen, 0, 2, 0, Math.PI * 2)
  ctx.fill()

  // Grip
  ctx.fillStyle = '#222'
  ctx.beginPath()
  roundRect(ctx, 2, gunH - 3, 4, 5, 1)
  ctx.fill()

  // Scope (for sniper-like weapons)
  if (wpn && (wpn.name.toLowerCase().includes('sniper') || wpn.name.toLowerCase().includes('rifle'))) {
    ctx.fillStyle = '#444'
    ctx.beginPath()
    roundRect(ctx, gunLen / 3, -5, 6, 3, 1.5)
    ctx.fill()
    // Scope lens
    ctx.fillStyle = '#88bbff'
    ctx.globalAlpha = 0.5
    ctx.beginPath()
    ctx.arc(gunLen / 3 + 5, -3.5, 1.5, 0, Math.PI * 2)
    ctx.fill()
    ctx.globalAlpha = 1
  }

  // Magazine (for SMG/AR type)
  if (wpn && (wpn.name.toLowerCase().includes('smg') || wpn.name.toLowerCase().includes('assault'))) {
    ctx.fillStyle = '#2a2a3a'
    ctx.beginPath()
    roundRect(ctx, 6, gunH - 2, 3, 7, 1)
    ctx.fill()
  }

  // Reload indicator
  if (p.reloading) {
    ctx.save()
    ctx.fillStyle = 'rgba(245,158,11,0.9)'
    ctx.font = 'bold 8px Inter, Arial, sans-serif'
    ctx.textAlign = 'center'
    ctx.fillText('⟳', gunLen / 2, -8)
    ctx.restore()
  }

  ctx.restore()
}

// ─── Armor Ring ─────────────────────────────────────────────────────────────────

function drawArmorRing(ctx, p, t) {
  const armorRatio = p.armor / 100
  const maxR = 26
  const pulseR = maxR + Math.sin(t * 3) * 1

  ctx.save()
  ctx.strokeStyle = `rgba(96,165,250,${0.3 + armorRatio * 0.4})`
  ctx.lineWidth = 2.5
  ctx.shadowColor = 'rgba(96,165,250,0.3)'
  ctx.shadowBlur = 6

  // Main arc
  ctx.beginPath()
  ctx.arc(0, 0, pulseR, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * armorRatio)
  ctx.stroke()

  // Tick marks
  ctx.lineWidth = 1
  ctx.globalAlpha = 0.3
  for (let i = 0; i < 8; i++) {
    const a = -Math.PI / 2 + (Math.PI * 2 / 8) * i
    if (a - (-Math.PI / 2) <= Math.PI * 2 * armorRatio) {
      ctx.beginPath()
      ctx.moveTo(Math.cos(a) * (pulseR - 3), Math.sin(a) * (pulseR - 3))
      ctx.lineTo(Math.cos(a) * (pulseR + 2), Math.sin(a) * (pulseR + 2))
      ctx.stroke()
    }
  }
  ctx.globalAlpha = 1

  ctx.restore()
}

// ─── Me Indicator ───────────────────────────────────────────────────────────────

function drawMeIndicator(ctx, t) {
  const r = 30

  // Dashed rotating ring
  ctx.save()
  ctx.strokeStyle = 'rgba(255,255,255,0.35)'
  ctx.lineWidth = 1.2
  ctx.setLineDash([5, 5])
  ctx.lineDashOffset = t * 20
  ctx.beginPath()
  ctx.arc(0, 0, r, 0, Math.PI * 2)
  ctx.stroke()
  ctx.setLineDash([])
  ctx.restore()

  // Arrow above head
  const arrowY = -BODY_H / 2 - HEAD_R * 2 - 12
  const bob = Math.sin(t * 3) * 3

  ctx.save()
  ctx.translate(0, arrowY + bob)

  // Arrow glow
  ctx.fillStyle = 'rgba(245,158,11,0.3)'
  ctx.beginPath()
  ctx.moveTo(0, -6)
  ctx.lineTo(-6, 2)
  ctx.lineTo(6, 2)
  ctx.closePath()
  ctx.fill()

  // Arrow solid
  ctx.fillStyle = 'rgba(245,158,11,0.8)'
  ctx.beginPath()
  ctx.moveTo(0, -4)
  ctx.lineTo(-4, 1)
  ctx.lineTo(4, 1)
  ctx.closePath()
  ctx.fill()

  ctx.restore()
}

// ─── Username ───────────────────────────────────────────────────────────────────

function drawUsername(ctx, p) {
  const name = p.username || ''
  if (!name) return

  const nameY = p.y - BODY_H / 2 - HEAD_R * 2 - 6

  ctx.save()
  ctx.font = 'bold 11px Inter, Arial, sans-serif'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'bottom'

  // Measure for background
  const metrics = ctx.measureText(name)
  const tw = metrics.width + 10
  const th = 16

  // Background pill
  ctx.fillStyle = 'rgba(0,0,0,0.55)'
  ctx.beginPath()
  roundRect(ctx, p.x - tw / 2, nameY - th + 2, tw, th, 4)
  ctx.fill()

  // Text
  ctx.fillStyle = '#e7e5e4'
  ctx.fillText(name, p.x, nameY)
  ctx.restore()
}

// ─── Health Bar ─────────────────────────────────────────────────────────────────

function drawHealthBar(ctx, p) {
  const bw = 36
  const bh = 5
  const bx = p.x - bw / 2
  const by = p.y - BODY_H / 2 - HEAD_R * 2 - 22
  const ratio = Math.max(0, Math.min(1, p.hp / p.maxHp))

  if (ratio >= 1) return // Don't show at full HP

  // Background
  ctx.fillStyle = 'rgba(0,0,0,0.6)'
  ctx.beginPath()
  roundRect(ctx, bx - 1, by - 1, bw + 2, bh + 2, 3)
  ctx.fill()

  // HP fill
  const hpColor = ratio > 0.6 ? '#22c55e' : ratio > 0.3 ? '#f59e0b' : '#ef4444'
  const hpGrd = ctx.createLinearGradient(bx, by, bx, by + bh)
  hpGrd.addColorStop(0, lighten(hpColor.replace('rgb', '#'), 20) || hpColor)
  hpGrd.addColorStop(1, hpColor)
  ctx.fillStyle = hpColor
  ctx.beginPath()
  roundRect(ctx, bx, by, Math.max(0, bw * ratio), bh, 2)
  ctx.fill()

  // Shine
  ctx.fillStyle = 'rgba(255,255,255,0.2)'
  ctx.beginPath()
  roundRect(ctx, bx, by, Math.max(0, bw * ratio), bh / 2, 2)
  ctx.fill()

  // Border
  ctx.strokeStyle = 'rgba(255,255,255,0.1)'
  ctx.lineWidth = 0.5
  ctx.beginPath()
  roundRect(ctx, bx, by, bw, bh, 2)
  ctx.stroke()
}