import { loadControls } from '../config'

class InputManager {
  constructor() {
    this.keys        = {}
    this.mouseDown   = {}
    this.mouseX      = 0
    this.mouseY       = 0
    this.pointerLocked = false
    this.controls    = loadControls()
    this._listeners  = []
    this._virtual    = {} // virtual/touch actions
    this._virtualAxis = { x: 0, y: 0 }
    this._virtualAimAngle = null // direct aim angle for mobile joystick
    this.requestPointerLockEnabled = true
  }

  init(canvas) {
    this.canvas = canvas
    this.controls = loadControls()
    this.mouseX = canvas.width / 2
    this.mouseY = canvas.height / 2

    const updatePointerLockState = () => {
      this.pointerLocked = document.pointerLockElement === this.canvas
      if (this.pointerLocked) {
        this.mouseX = this.canvas.width / 2
        this.mouseY = this.canvas.height / 2
      }
    }

    const requestPointerLock = () => {
      if (!this.canvas || document.pointerLockElement === this.canvas) return
      if (typeof this.canvas.requestPointerLock === 'function') {
        try { this.canvas.requestPointerLock() } catch (_) {}
      }
    }

    const keyDown = e => {
      this.keys[e.key]   = true
      this.keys[e.code]  = true
      if (e.key === 'Tab') e.preventDefault()
    }
    const keyUp = e => {
      this.keys[e.key]   = false
      this.keys[e.code]  = false
    }
    const mouseMove = e => {
      if (!this.canvas) return
      if (document.pointerLockElement === this.canvas) {
        this.mouseX += e.movementX || 0
        this.mouseY += e.movementY || 0
        this.mouseX = Math.max(0, Math.min(this.canvas.width, this.mouseX))
        this.mouseY = Math.max(0, Math.min(this.canvas.height, this.mouseY))
        return
      }
      const r = this.canvas.getBoundingClientRect()
      this.mouseX = e.clientX - r.left
      this.mouseY = e.clientY - r.top
    }
    const mouseDown = e => {
      if (e.target === this.canvas && this.requestPointerLockEnabled) requestPointerLock()
      this.mouseDown[`Mouse${e.button}`] = true
    }
    const mouseUp   = e => { this.mouseDown[`Mouse${e.button}`] = false }
    const ctxMenu   = e => e.preventDefault()

    window.addEventListener('keydown',     keyDown)
    window.addEventListener('keyup',       keyUp)
    this.canvas.addEventListener('mousemove',  mouseMove)
    this.canvas.addEventListener('mousedown',  mouseDown)
    this.canvas.addEventListener('mouseup',    mouseUp)
    this.canvas.addEventListener('contextmenu', ctxMenu)

    this._listeners = [
      ['keydown',     keyDown,   window],
      ['keyup',       keyUp,     window],
      ['mousemove',   mouseMove, this.canvas],
      ['mousedown',   mouseDown, this.canvas],
      ['mouseup',     mouseUp,   this.canvas],
      ['contextmenu', ctxMenu,   this.canvas],
      ['pointerlockchange', updatePointerLockState, document]
    ]

    document.addEventListener('pointerlockchange', updatePointerLockState)
  }

  destroy() {
    for (const [evt, fn, target] of this._listeners) {
      target.removeEventListener(evt, fn)
    }
    if (document.pointerLockElement === this.canvas && typeof document.exitPointerLock === 'function') {
      try { document.exitPointerLock() } catch (_) {}
    }
    this._listeners = []
  }

  updateControls(newControls) {
    this.controls = { ...this.controls, ...newControls }
  }

  disablePointerLock() {
    this.requestPointerLockEnabled = false
    // Exit pointer lock if already active
    if (document.pointerLockElement && typeof document.exitPointerLock === 'function') {
      try { document.exitPointerLock() } catch (_) {}
    }
  }

  // Methods for virtual/touch controls
  pressAction(action) {
    this._virtual[action] = true
  }

  releaseAction(action) {
    this._virtual[action] = false
  }

  setPointerPosition(x, y) {
    this.mouseX = x
    this.mouseY = y
  }

  // Virtual analog axis for movement (-1..1)
  setVirtualAxis(x, y) {
    this._virtualAxis.x = Math.max(-1, Math.min(1, x))
    this._virtualAxis.y = Math.max(-1, Math.min(1, y))
  }

  getVirtualAxis() {
    return { x: this._virtualAxis.x, y: this._virtualAxis.y }
  }

  setVirtualAimAngle(angle) {
    this._virtualAimAngle = angle
  }

  getVirtualAimAngle() {
    return this._virtualAimAngle
  }

  isPressed(action) {
    const key = this.controls[action]
    if (!key) return false
    // Check mouse buttons (also check virtual action)
    if (key.startsWith('Mouse')) return !!(this.mouseDown[key] || this._virtual[action])
    // Check key
    return !!(this.keys[key] || this.keys[key.toLowerCase()] || this._virtual[action])
  }

  isKeyDown(k) {
    return !!(this.keys[k] || this.keys[k?.toLowerCase?.()])
  }
}

export default new InputManager()