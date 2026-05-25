// ─── Projectile / Grenade / Gas cloud rendering ────────────────────────────────.

export function drawProjectiles(ctx, projectiles) {
  for (const pr of (projectiles || [])) {
    const speed = Math.sqrt(pr.vx ** 2 + pr.vy ** 2)
    const nx = speed > 0 ? pr.vx / speed : 1
    const ny = speed > 0 ? pr.vy / speed : 0
    const trailL = (pr.size || 4) * 5

    ctx.save()
    // Trail
    const tGrd = ctx.createLinearGradient(pr.x - nx * trailL, pr.y - ny * trailL, pr.x, pr.y)
    tGrd.addColorStop(0, 'transparent')
    tGrd.addColorStop(1, pr.color || '#ffdd00')
    ctx.strokeStyle = tGrd
    ctx.lineWidth = (pr.size || 4) * 0.7
    ctx.lineCap = 'round'
    ctx.beginPath()
    ctx.moveTo(pr.x - nx * trailL, pr.y - ny * trailL)
    ctx.lineTo(pr.x, pr.y)
    ctx.stroke()

    // Core
    const bGrd = ctx.createRadialGradient(pr.x, pr.y, 0, pr.x, pr.y, (pr.size || 4) * 1.5)
    bGrd.addColorStop(0, '#fff')
    bGrd.addColorStop(0.4, pr.color || '#ffdd00')
    bGrd.addColorStop(1, 'transparent')
    ctx.fillStyle = bGrd
    ctx.beginPath()
    ctx.arc(pr.x, pr.y, (pr.size || 4) * 1.5, 0, Math.PI * 2)
    ctx.fill()

    ctx.restore()
  }
}

export function drawGrenades(ctx, grenades, now) {
  const t = now / 1000
  for (const gr of (grenades || [])) {
    ctx.save()
    ctx.translate(gr.x, gr.y)

    // Body
    ctx.fillStyle = '#4a5a2a'
    ctx.beginPath()
    ctx.arc(0, 0, 7, 0, Math.PI * 2)
    ctx.fill()

    // Flash if about to explode
    if (gr.fuse < 0.8) {
      const flash = Math.sin(t * 20) > 0
      if (flash) {
        ctx.fillStyle = '#ff4444'
        ctx.beginPath()
        ctx.arc(0, -3, 3, 0, Math.PI * 2)
        ctx.fill()
      }
    }
    ctx.restore()
  }
}

export function drawGasClouds(ctx, gasClouds, now) {
  const t = now / 1000
  for (const gas of (gasClouds || [])) {
    ctx.save()
    const alpha = Math.min(0.4, gas.life / gas.duration)
    const r = gas.radius * (1 + Math.sin(t * 2) * 0.05)

    const grd = ctx.createRadialGradient(gas.x, gas.y, 0, gas.x, gas.y, r)
    grd.addColorStop(0, `rgba(80,200,80,${alpha})`)
    grd.addColorStop(0.7, `rgba(60,150,60,${alpha * 0.5})`)
    grd.addColorStop(1, 'transparent')
    ctx.fillStyle = grd
    ctx.beginPath()
    ctx.arc(gas.x, gas.y, r, 0, Math.PI * 2)
    ctx.fill()

    ctx.restore()
  }
}

export function drawPickups(ctx, pickups, now) {
  const t = now / 1000
  const configs = {
    health:    { fill: '#22c55e', symbol: '+',  glow: '34,197,94'   },
    armor:     { fill: '#60a5fa', symbol: '⛊', glow: '96,165,250'  },
    jetfuel:   { fill: '#3b82f6', symbol: '⛽', glow: '59,130,246'  },
    grenade:   { fill: '#a3a3a3', symbol: '◎', glow: '163,163,163' },
    weapon:    { fill: '#f59e0b', symbol: '⚔',  glow: '245,158,11'  },
    speed:     { fill: '#facc15', symbol: '⚡', glow: '250,204,21'  },
    rapidfire: { fill: '#f97316', symbol: '●',  glow: '249,115,22'  }
  }

  for (const pk of (pickups || [])) {
    const cfg = configs[pk.type] || configs.health
    const bob = Math.sin(t * 2.5 + pk.x * 0.01) * 3
    const pulse = 0.7 + Math.sin(t * 4) * 0.3

    ctx.save()
    ctx.translate(pk.x, pk.y + bob)

    // Glow
    const grd = ctx.createRadialGradient(0, 0, 0, 0, 0, 30)
    grd.addColorStop(0, `rgba(${cfg.glow},${0.35 * pulse})`)
    grd.addColorStop(1, 'transparent')
    ctx.fillStyle = grd
    ctx.beginPath(); ctx.arc(0, 0, 30, 0, Math.PI * 2); ctx.fill()

    // Body
    ctx.fillStyle = cfg.fill
    ctx.strokeStyle = 'rgba(255,255,255,0.5)'
    ctx.lineWidth = 1.5
    ctx.beginPath(); ctx.arc(0, 0, 12, 0, Math.PI * 2); ctx.fill(); ctx.stroke()

    // Symbol
    ctx.fillStyle = '#fff'
    ctx.font = 'bold 10px Inter,Arial'
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
    ctx.fillText(cfg.symbol, 0, 0)

    // Weapon name
    if (pk.type === 'weapon' && pk.weaponId) {
      ctx.font = '8px Inter,Arial'
      ctx.fillStyle = '#fffa'
      ctx.fillText(pk.weaponId.toUpperCase(), 0, 18)
    }

    ctx.restore()
  }
}