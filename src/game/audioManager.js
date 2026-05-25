// ─── Simple audio stub (no actual files needed, uses Web Audio API for synthesis) ─

class AudioManager {
  constructor() {
    this.ctx      = null
    this.volumes  = { music: 0.3, sfx: 0.7 }
    this.enabled  = true
    this.menuMusicTimer = null
    this.menuMusicStep  = 0
    this.menuMusicActive = false
  }

  init() {
    if (this.ctx) return this.ctx
    try {
      this.ctx = new (window.AudioContext || window.webkitAudioContext)()
      this._bindAutoResume()
    } catch (_) {
      this.enabled = false
    }
    return this.ctx
  }

  setVolumes(music, sfx) {
    this.volumes.music = music
    this.volumes.sfx   = sfx
    if (this.ctx && this.musicGain) this.musicGain.gain.value = music
  }

  async resume() {
    if (!this.ctx || !this.enabled) return
    try {
      if (this.ctx.state === 'suspended') await this.ctx.resume()
    } catch (_) {}
  }

  _bindAutoResume() {
    if (!this.ctx || this._autoResumeBound) return
    this._autoResumeBound = true
    const unlock = () => {
      this.resume()
      window.removeEventListener('pointerdown', unlock)
      window.removeEventListener('keydown', unlock)
      window.removeEventListener('touchstart', unlock)
    }
    window.addEventListener('pointerdown', unlock, { passive: true })
    window.addEventListener('keydown', unlock, { passive: true })
    window.addEventListener('touchstart', unlock, { passive: true })
  }

  _ensureContext() {
    if (!this.ctx) this.init()
    this.resume()
  }

  _tone(freq, dur, vol, type = 'square') {
    if (!this.ctx || !this.enabled) return
    try {
      this._ensureContext()
      const osc = this.ctx.createOscillator()
      const gain = this.ctx.createGain()
      osc.type = type
      osc.frequency.value = freq
      gain.gain.setValueAtTime(vol * this.volumes.sfx, this.ctx.currentTime)
      gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + dur)
      osc.connect(gain)
      gain.connect(this.ctx.destination)
      osc.start()
      osc.stop(this.ctx.currentTime + dur)
    } catch (_) {}
  }

  _noise(dur, vol) {
    if (!this.ctx || !this.enabled) return
    try {
      this._ensureContext()
      const bufSize = this.ctx.sampleRate * dur
      const buffer  = this.ctx.createBuffer(1, bufSize, this.ctx.sampleRate)
      const data    = buffer.getChannelData(0)
      for (let i = 0; i < bufSize; i++) data[i] = (Math.random() * 2 - 1) * 0.5
      const src  = this.ctx.createBufferSource()
      const gain = this.ctx.createGain()
      src.buffer = buffer
      gain.gain.setValueAtTime(vol * this.volumes.sfx, this.ctx.currentTime)
      gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + dur)
      src.connect(gain)
      gain.connect(this.ctx.destination)
      src.start()
    } catch (_) {}
  }

  _click(freq, dur, vol, type = 'square', ramp = 1.9) {
    if (!this.ctx || !this.enabled) return
    try {
      this._ensureContext()
      const osc = this.ctx.createOscillator()
      const gain = this.ctx.createGain()
      osc.type = type
      osc.frequency.setValueAtTime(freq, this.ctx.currentTime)
      osc.frequency.exponentialRampToValueAtTime(Math.max(40, freq / ramp), this.ctx.currentTime + dur)
      gain.gain.setValueAtTime(vol * this.volumes.sfx, this.ctx.currentTime)
      gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + dur)
      osc.connect(gain)
      gain.connect(this.ctx.destination)
      osc.start()
      osc.stop(this.ctx.currentTime + dur)
    } catch (_) {}
  }

  shoot(weaponId) {
    switch (weaponId) {
      case 'pistol':
        this._click(640, 0.07, 0.14, 'square', 2.4)
        this._noise(0.03, 0.06)
        break
      case 'smg':
        this._click(760, 0.03, 0.07, 'square', 1.6)
        this._noise(0.02, 0.04)
        break
      case 'shotgun':
        this._noise(0.12, 0.18)
        this._tone(180, 0.08, 0.12, 'sawtooth')
        this._click(120, 0.05, 0.08, 'triangle', 1.2)
        break
      case 'sniper':
        this._click(980, 0.09, 0.16, 'triangle', 3.2)
        this._noise(0.05, 0.08)
        break
      case 'rifle':
        this._click(560, 0.05, 0.09, 'square', 2.0)
        this._noise(0.03, 0.05)
        break
      case 'rpg':
        this._noise(0.22, 0.24)
        this._tone(90, 0.24, 0.22, 'sawtooth')
        this._click(70, 0.12, 0.08, 'triangle', 1.1)
        break
      default:
        this._tone(400, 0.08, 0.1)
        break
    }
  }

  hit()         { this._tone(200, 0.08, 0.12); this._noise(0.06, 0.1) }
  explosion()   { this._noise(0.45, 0.28); this._tone(70, 0.28, 0.22, 'sawtooth'); this._click(40, 0.08, 0.06, 'triangle', 1.1) }
  pickup()      { this._tone(800, 0.05, 0.1); this._tone(1000, 0.05, 0.1) }
  death()       { this._tone(150, 0.3, 0.15, 'sawtooth'); this._noise(0.2, 0.15) }
  jump()        { this._tone(350, 0.06, 0.06) }
  jetpack()     { this._tone(170, 0.05, 0.05, 'sawtooth'); this._noise(0.02, 0.025) }
  reload()      { this._tone(600, 0.04, 0.05); this._tone(700, 0.04, 0.05) }
  grenadeThrow(){ this._click(220, 0.08, 0.14, 'triangle', 1.7); this._noise(0.04, 0.05) }
  grenadeTick(intensity = 0) {
    const vol = 0.03 + Math.min(0.12, intensity * 0.1)
    const freq = 820 + Math.min(380, intensity * 420)
    const dur = 0.018 + Math.min(0.02, intensity * 0.01)
    this._click(freq, dur, vol, 'square', 1.2)
  }

  _musicNote(freq, dur, vol, type = 'triangle') {
    if (!this.ctx || !this.enabled) return
    try {
      const osc = this.ctx.createOscillator()
      const gain = this.ctx.createGain()
      osc.type = type
      osc.frequency.value = freq
      gain.gain.setValueAtTime(vol * this.volumes.music, this.ctx.currentTime)
      gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + dur)
      osc.connect(gain)
      gain.connect(this.musicGain || this.ctx.destination)
      osc.start()
      osc.stop(this.ctx.currentTime + dur)
    } catch (_) {}
  }

  startMenuMusic() {
    if (!this.enabled) return
    this.init()
    this.menuMusicActive = true
    if (this.menuMusicTimer) return

    if (!this.musicGain && this.ctx) {
      this.musicGain = this.ctx.createGain()
      this.musicGain.gain.value = this.volumes.music
      this.musicGain.connect(this.ctx.destination)
    }

    const pattern = [
      { root: 196.00, chord: [196.00, 246.94, 293.66], bass: 98.00 },
      { root: 174.61, chord: [174.61, 220.00, 261.63], bass: 87.31 },
      { root: 164.81, chord: [164.81, 207.65, 246.94], bass: 82.41 },
      { root: 220.00, chord: [220.00, 277.18, 329.63], bass: 110.00 }
    ]

    const playStep = () => {
      if (!this.menuMusicActive || !this.ctx || this.ctx.state !== 'running') return
      const step = pattern[this.menuMusicStep % pattern.length]
      this._musicNote(step.root * 0.5, 0.9, 0.08, 'sine')
      this._musicNote(step.bass, 0.7, 0.06, 'triangle')
      this._musicNote(step.chord[0], 0.35, 0.03, 'triangle')
      this._musicNote(step.chord[1], 0.35, 0.02, 'triangle')
      this._musicNote(step.chord[2], 0.35, 0.02, 'triangle')
      this.menuMusicStep += 1
    }

    this.menuMusicTimer = setInterval(playStep, 900)
    this.resume().catch(() => {})
  }

  stopMenuMusic() {
    this.menuMusicActive = false
    this.menuMusicStep = 0
    if (this.menuMusicTimer) {
      clearInterval(this.menuMusicTimer)
      this.menuMusicTimer = null
    }
  }
}

export default new AudioManager()