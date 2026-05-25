// ─── Minimap ────────────────────────────────────────────────────────────────────

export function drawMinimap(ctx, canvasW, canvasH, mapData, players, myId, pickups) {
  if (!mapData) return
  const mmW = 160, mmH = 90, pad = 10
  const mx = canvasW - mmW - pad
  const my = canvasH - mmH - pad
  const scaleX = mmW / mapData.width
  const scaleY = mmH / mapData.height

  ctx.save()

  // Background
  ctx.fillStyle = 'rgba(10,14,26,0.8)'
  ctx.strokeStyle = 'rgba(59,130,246,0.4)'
  ctx.lineWidth = 1
  ctx.fillRect(mx, my, mmW, mmH)
  ctx.strokeRect(mx, my, mmW, mmH)

  // Platforms
  ctx.fillStyle = 'rgba(100,120,140,0.4)'
  for (const plat of (mapData.platforms || [])) {
    ctx.fillRect(mx + plat.x * scaleX, my + plat.y * scaleY, plat.w * scaleX, plat.h * scaleY)
  }

  // Walls
  ctx.fillStyle = 'rgba(80,100,130,0.5)'
  for (const wall of (mapData.walls || [])) {
    ctx.fillRect(mx + wall.x * scaleX, my + wall.y * scaleY, wall.w * scaleX, wall.h * scaleY)
  }

  // Pickups
  for (const pk of (pickups || [])) {
    ctx.fillStyle = '#ffaa0088'
    ctx.fillRect(mx + pk.x * scaleX - 1, my + pk.y * scaleY - 1, 3, 3)
  }

  // Players
  for (const [id, p] of Object.entries(players || {})) {
    if (p.dead) continue
    const px = mx + p.x * scaleX
    const py = my + p.y * scaleY
    if (id === myId) {
      ctx.fillStyle = '#ffffff'
      ctx.beginPath(); ctx.arc(px, py, 3, 0, Math.PI * 2); ctx.fill()
    } else {
      ctx.fillStyle = p.color || '#ef4444'
      ctx.beginPath(); ctx.arc(px, py, 2.5, 0, Math.PI * 2); ctx.fill()
    }
  }

  // Label
  ctx.fillStyle = '#64748b'
  ctx.font = '8px Inter,Arial'
  ctx.textAlign = 'right'
  ctx.fillText('MAP', mx + mmW - 3, my + 8)

  ctx.restore()
}