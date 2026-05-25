// ─── Client Configuration ──────────────────────────────────────────────────────

export const DEFAULT_CONTROLS = {
  moveLeft:     'a',
  moveRight:    'd',
  jump:         'w',
  jetpack:      'Space',
  shoot:        'Mouse0',
  grenade:      'g',
  gas:          'h',
  reload:       'r',
  pause:        'Escape',
  scoreboard:   'Tab'
}

export function loadControls() {
  try {
    const saved = localStorage.getItem('gridwars_controls')
    if (saved) return { ...DEFAULT_CONTROLS, ...JSON.parse(saved) }
  } catch (_) {}
  return { ...DEFAULT_CONTROLS }
}

export function saveControls(controls) {
  try { localStorage.setItem('gridwars_controls', JSON.stringify(controls)) } catch (_) {}
}

export function loadUsername() {
  try { return localStorage.getItem('gridwars_username') || '' } catch (_) { return '' }
}

export function saveUsername(name) {
  try { localStorage.setItem('gridwars_username', name) } catch (_) {}
}

export function loadSettings() {
  try {
    const s = localStorage.getItem('gridwars_settings')
    if (s) return JSON.parse(s)
  } catch (_) {}
  return {
    musicVolume:    0.3,
    sfxVolume:      0.7,
    cameraShake:    true,
    showParticles:  true,
    showMinimap:    true,
    fullscreen:     true
  }
}

export function saveSettings(settings) {
  try { localStorage.setItem('gridwars_settings', JSON.stringify(settings)) } catch (_) {}
}

export const PLAYER_SPEED = 260
export const TICK_MS      = 1000 / 60