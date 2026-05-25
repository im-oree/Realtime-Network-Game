// ─── HUD elements drawn on canvas (scoreboard, kill feed, etc.) ────────────────

export class KillFeed {
  constructor() { this.entries = [] }

  add(text, color = '#ef4444') {
    this.entries.unshift({ text, color, life: 4 })
    if (this.entries.length > 6) this.entries.pop()
  }

  update(dt) {
    for (const e of this.entries) e.life -= dt
    this.entries = this.entries.filter(e => e.life > 0)
  }

  draw(ctx, x, y) {
    let cy = y
    for (const e of this.entries) {
      const alpha = Math.min(1, e.life)
      ctx.save()
      ctx.globalAlpha = alpha
      ctx.font = 'bold 11px Inter,Arial'
      ctx.textAlign = 'right'
      ctx.fillStyle = 'rgba(0,0,0,0.5)'
      ctx.fillText(e.text, x + 1, cy + 1)
      ctx.fillStyle = e.color
      ctx.fillText(e.text, x, cy)
      ctx.restore()
      cy += 16
    }
  }
}

export function drawScoreboard(ctx, scores, players, viewW) {
  if (!scores || !players) return
  const entries = Object.entries(scores)
    .map(([id, sc]) => ({
      id,
      kills:  sc.kills  || 0,
      deaths: sc.deaths || 0,
      name:   players[id]?.username || id.slice(0, 6),
      color:  players[id]?.color || '#888'
    }))
    .sort((a, b) => b.kills - a.kills)
    .slice(0, 8)

  const padX = 12, padY = 8, lineH = 18
  const width = 180
  const height = padY * 2 + entries.length * lineH + 24

  ctx.save()
  ctx.fillStyle = 'rgba(10,14,26,0.85)'
  ctx.strokeStyle = 'rgba(59,130,246,0.3)'
  ctx.lineWidth = 1
  ctx.beginPath()
  roundRect(ctx, 8, 8, width, height, 6)
  ctx.fill(); ctx.stroke()

  ctx.font = 'bold 10px Inter,Arial'
  ctx.fillStyle = '#64748b'
  ctx.textAlign = 'left'
  ctx.fillText('SCOREBOARD', padX + 8, padY + 12)
  ctx.textAlign = 'right'
  ctx.fillText('K / D', padX + width - 12, padY + 12)
  ctx.textAlign = 'left'

  entries.forEach((e, i) => {
    const y = padY + 24 + i * lineH
    ctx.fillStyle = e.color
    ctx.beginPath(); ctx.arc(padX + 14, y + 8, 4, 0, Math.PI * 2); ctx.fill()
    ctx.fillStyle = '#e2e8f0'
    ctx.font = '11px Inter,Arial'
    ctx.fillText(e.name.slice(0, 12), padX + 22, y + 12)
    ctx.textAlign = 'right'
    ctx.fillStyle = '#94a3b8'
    ctx.fillText(`${e.kills} / ${e.deaths}`, padX + width - 12, y + 12)
    ctx.textAlign = 'left'
  })

  ctx.restore()
}

export function drawRespawnOverlay(ctx, w, h, timer) {
  ctx.save()
  ctx.fillStyle = 'rgba(0,0,0,0.55)'
  ctx.fillRect(0, 0, w, h)
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
  ctx.font = 'bold 42px Inter,Arial'
  ctx.fillStyle = '#ef4444'
  ctx.fillText('ELIMINATED', w / 2, h / 2 - 30)
  ctx.font = '20px Inter,Arial'
  ctx.fillStyle = '#94a3b8'
  ctx.fillText(`Respawning in ${Math.max(0, timer).toFixed(1)}s`, w / 2, h / 2 + 20)
  ctx.restore()
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.moveTo(x + r, y)
  ctx.arcTo(x + w, y, x + w, y + h, r)
  ctx.arcTo(x + w, y + h, x, y + h, r)
  ctx.arcTo(x, y + h, x, y, r)
  ctx.arcTo(x, y, x + w, y, r)
}