const PLAYER_RADIUS = 16
const BULLET_RADIUS = 4

function circleVsRect(cx, cy, cr, rx, ry, rw, rh) {
  const nearX = Math.max(rx, Math.min(cx, rx + rw))
  const nearY = Math.max(ry, Math.min(cy, ry + rh))
  const dx = cx - nearX
  const dy = cy - nearY
  return dx * dx + dy * dy < cr * cr
}

function resolveCircleRect(obj, cr, rx, ry, rw, rh) {
  const nearX = Math.max(rx, Math.min(obj.x, rx + rw))
  const nearY = Math.max(ry, Math.min(obj.y, ry + rh))
  const dx = obj.x - nearX
  const dy = obj.y - nearY
  const dist = Math.sqrt(dx * dx + dy * dy) || 0.001
  const overlap = cr - dist
  if (overlap > 0) {
    obj.x += (dx / dist) * overlap
    obj.y += (dy / dist) * overlap
    return { nx: dx / dist, ny: dy / dist, overlap }
  }
  return null
}

function playerVsPlatforms(player, platforms, walls) {
  const all = [...(platforms || []), ...(walls || []).map(w => ({ ...w, type: 'wall' }))]
  player.onGround = false

  for (const plat of all) {
    if (circleVsRect(player.x, player.y, PLAYER_RADIUS, plat.x, plat.y, plat.w, plat.h)) {
      const result = resolveCircleRect(player, PLAYER_RADIUS, plat.x, plat.y, plat.w, plat.h)
      if (result) {
        // If resolved upward (landed on top)
        if (result.ny < -0.5) {
          player.onGround = true
          if (player.vy > 0) player.vy = 0
        }
        // If hit bottom
        if (result.ny > 0.5 && player.vy < 0) {
          player.vy = 0
        }
        // Side hit
        if (Math.abs(result.nx) > 0.5) {
          player.vx *= 0.3
        }
      }
    }
  }
}

function bulletVsPlatforms(bullet, platforms, walls) {
  const all = [...(platforms || []), ...(walls || []).map(w => ({ ...w, type: 'wall' }))]
  for (const plat of all) {
    if (circleVsRect(bullet.x, bullet.y, BULLET_RADIUS, plat.x, plat.y, plat.w, plat.h)) {
      return { hit: true, x: bullet.x, y: bullet.y }
    }
  }
  return { hit: false }
}

function playerVsPlayer(pList) {
  const minDist = PLAYER_RADIUS * 2
  for (let i = 0; i < pList.length; i++) {
    for (let j = i + 1; j < pList.length; j++) {
      const a = pList[i], b = pList[j]
      const dx = b.x - a.x, dy = b.y - a.y
      const dist2 = dx * dx + dy * dy
      if (dist2 < minDist * minDist && dist2 > 0.001) {
        const dist = Math.sqrt(dist2)
        const nx = dx / dist, ny = dy / dist
        const overlap = (minDist - dist) / 2
        a.x -= nx * overlap
        a.y -= ny * overlap
        b.x += nx * overlap
        b.y += ny * overlap
      }
    }
  }
}

function bulletVsPlayer(bullet, player) {
  if (player.dead) return false
  const dx = player.x - bullet.x
  const dy = player.y - bullet.y
  return dx * dx + dy * dy < (PLAYER_RADIUS + BULLET_RADIUS) ** 2
}

module.exports = {
  PLAYER_RADIUS,
  BULLET_RADIUS,
  circleVsRect,
  resolveCircleRect,
  playerVsPlatforms,
  bulletVsPlatforms,
  playerVsPlayer,
  bulletVsPlayer
}