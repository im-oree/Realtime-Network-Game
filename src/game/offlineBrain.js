import { OFFLINE_MAP, OFFLINE_WEAPONS, createOfflinePlayer } from './offlinePractice'

const BOT_NAMES = [
  'Atlas',
  'Nova',
  'Echo',
  'Blaze',
  'Viper',
  'Rook'
]

const BOT_WEAPONS = ['smg', 'rifle', 'shotgun', 'pistol', 'rifle', 'smg']

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value))
}

function distanceSquared(a, b) {
  const dx = a.x - b.x
  const dy = a.y - b.y
  return dx * dx + dy * dy
}

function normalizeAngle(angle) {
  let next = angle
  while (next > Math.PI) next -= Math.PI * 2
  while (next < -Math.PI) next += Math.PI * 2
  return next
}

function pointHitsSolid(x, y, map = OFFLINE_MAP) {
  const solids = [...(map.platforms || []), ...(map.walls || [])]
  return solids.some(rect => x >= rect.x && x <= rect.x + rect.w && y >= rect.y && y <= rect.y + rect.h)
}

function hasLineOfSight(from, to, map = OFFLINE_MAP) {
  const distance = Math.sqrt(distanceSquared(from, to))
  const steps = Math.max(8, Math.ceil(distance / 40))
  for (let i = 1; i < steps; i++) {
    const t = i / steps
    const x = from.x + (to.x - from.x) * t
    const y = from.y + (to.y - from.y) * t
    if (pointHitsSolid(x, y, map)) return false
  }
  return true
}

function makeBrain(index) {
  return {
    strafeDir: index % 2 === 0 ? 1 : -1,
    strafeTimer: 0.8 + index * 0.2,
    fireCooldown: 0.8 + index * 0.2,     // Added initial hesitation on spawn
    grenadeCooldown: 8.0 + index * 1.5,  // Substantially longer base grenade cooldown
    jetpackBias: 0,
    roamTimer: 1.2 + index * 0.15,
    panicTimer: 0,
    aimOffset: 0                         // Simulates a trailing human aim wobble
  }
}

export function createOfflineBots(count = 3) {
  const spawnPoints = OFFLINE_MAP.spawnPoints.slice(1)
  const colors = ['#f97316', '#ef4444', '#22c55e', '#f59e0b', '#a855f7', '#14b8a6']

  return Array.from({ length: count }, (_, index) => {
    const base = createOfflinePlayer(BOT_NAMES[index % BOT_NAMES.length])
    const spawn = spawnPoints[index % spawnPoints.length] || OFFLINE_MAP.spawnPoints[0]
    const weaponId = BOT_WEAPONS[index % BOT_WEAPONS.length]
    const weapon = OFFLINE_WEAPONS[weaponId] || OFFLINE_WEAPONS.pistol

    return {
      ...base,
      id: `offline_bot_${index + 1}`,
      username: BOT_NAMES[index % BOT_NAMES.length],
      x: spawn.x,
      y: spawn.y,
      color: colors[index % colors.length],
      weapon: weaponId,
      ammo: weapon.magSize,
      grenades: 2,
      gasCanisters: 1,
      isBot: true,
      brain: makeBrain(index)
    }
  })
}

export function thinkOfflineBot(bot, world, dt) {
  const brain = bot.brain || makeBrain(0)
  bot.brain = brain

  const players = Object.values(world.players || {}).filter(
    player => player && player.id !== bot.id && !player.dead && !player.isBot
  )
  
  if (!players.length) {
    brain.roamTimer = Math.max(0, brain.roamTimer - dt)
    if (brain.roamTimer <= 0) {
      brain.strafeDir *= -1
      brain.roamTimer = 1.2 + Math.random() * 0.8
    }
    return {
      vx: brain.strafeDir * 0.55,
      jump: false,
      jetpack: false,
      angle: bot.angle || 0,
      shoot: false,
      grenade: false,
      gas: false
    }
  }

  let target = players[0]
  let bestDist = distanceSquared(bot, target)
  for (const candidate of players.slice(1)) {
    const dist = distanceSquared(bot, candidate)
    if (dist < bestDist) {
      bestDist = dist
      target = candidate
    }
  }

  const dx = target.x - bot.x
  const dy = target.y - bot.y
  const distance = Math.sqrt(bestDist)
  const leadX = (target.vx || 0) * 0.12
  const leadY = (target.vy || 0) * 0.08
  const aimTarget = {
    x: target.x + leadX,
    y: target.y + leadY
  }
  
  // Natural aim drift so they don't perfectly laser-track the coordinates
  brain.aimOffset = (brain.aimOffset * 0.85) + ((Math.random() - 0.5) * 0.12)
  const perfectAngle = Math.atan2(aimTarget.y - bot.y, aimTarget.x - bot.x)
  const angle = perfectAngle + brain.aimOffset
  
  const aimError = Math.abs(normalizeAngle(angle - (bot.angle || 0)))
  const sight = hasLineOfSight(bot, target, world.map || OFFLINE_MAP)

  brain.strafeTimer = Math.max(0, brain.strafeTimer - dt)
  if (brain.strafeTimer <= 0) {
    brain.strafeDir = Math.random() < 0.5 ? -1 : 1
    brain.strafeTimer = 0.7 + Math.random() * 1.3
  }

  brain.fireCooldown = Math.max(0, brain.fireCooldown - dt)
  brain.grenadeCooldown = Math.max(0, brain.grenadeCooldown - dt)

  const preferredRange = 280 + (bot.weapon === 'sniper' ? 180 : 0)
  let vx = 0
  if (distance > preferredRange + 120) {
    vx = clamp(Math.sign(dx) * 1, -1, 1)
  } else if (distance < 150) {
    vx = clamp(-Math.sign(dx) * 1, -1, 1)
  } else {
    vx = brain.strafeDir * 0.7
  }

  const jump = bot.onGround && dy < -55 && distance < 420 && Math.random() < 0.18
  const jetpack = !bot.onGround && dy < -80 && distance < 650 && bot.jetpackFuel > 18 && Math.random() < 0.5
  
  // Shooting threshold adjusted slightly to account for the aim wobble mechanics
  const shoot = sight && distance < preferredRange + 220 && aimError < 0.35 && brain.fireCooldown <= 0
  
  // Drastically reduced the update-tick probabilities to curb constant utility spam
  const grenade = !sight && distance > 360 && distance < 980 && brain.grenadeCooldown <= 0 && (bot.grenades || 0) > 0 && Math.random() < 0.005
  const gas = !sight && distance > 520 && distance < 1000 && (bot.gasCanisters || 0) > 0 && Math.random() < 0.002

  if (shoot) {
    const weapon = OFFLINE_WEAPONS[bot.weapon] || OFFLINE_WEAPONS.pistol
    
    // 15% chance to simulate user clicking hesitation or manual burst firing patterns
    if (Math.random() < 0.15) {
      brain.fireCooldown = 0.3 + Math.random() * 0.4
    } else {
      brain.fireCooldown = (weapon.fireRate / 1000) * (bot.rapidFire ? 0.5 : 1) + 0.06
    }
  }
  
  if (grenade) {
    brain.grenadeCooldown = 8.0 + Math.random() * 4.0 
  }
  if (gas) {
    brain.grenadeCooldown = Math.max(brain.grenadeCooldown, 6.0)
  }

  return {
    vx,
    jump,
    jetpack,
    angle,
    shoot,
    grenade,
    gas
  }
}