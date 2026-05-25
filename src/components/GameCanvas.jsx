import React, { useEffect, useRef } from 'react'
import { useStore }       from '../store'
import { GameRenderer }   from '../engine/renderer'
import inputManager       from '../game/inputManager'
import client             from '../game/gameClient'
import audioManager       from '../game/audioManager'
import { loadControls, loadSettings, PLAYER_SPEED, TICK_MS } from '../config'

const renderer = new GameRenderer()

export default function GameCanvas() {
  const canvasRef = useRef(null)
  const isMobile = useStore(s => s.isMobileMode)
  const lastJumpTrigger = useRef(0)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    // Load settings
    const settings = loadSettings()
    renderer.camera.shakeEnabled = settings.cameraShake
    renderer.particles.enabled   = settings.showParticles
    audioManager.init()
    audioManager.setVolumes(settings.musicVolume, settings.sfxVolume)

    // Init input
    inputManager.init(canvas)
    inputManager.updateControls(loadControls())
    
    // Disable pointer lock in mobile mode
    if (isMobile) {
      inputManager.disablePointerLock()
    }

    // Start renderer
    renderer.start(canvas, () => useStore.getState())

    // Game loop for client-side physics prediction
    let lastFrameTime = Date.now()
    let gameLoopRaf = null
    const gameLoop = () => {
      const now = Date.now()
      const dt = (now - lastFrameTime) / 1000
      lastFrameTime = now
      
      const state = useStore.getState()
      if (!state.paused && state.screen === 'playing') {
        // Update client-side physics for smooth local movement
        client.updateClientPhysics(Math.min(dt, 0.05)) // Cap dt to prevent large jumps
      }
      
      gameLoopRaf = requestAnimationFrame(gameLoop)
    }
    gameLoopRaf = requestAnimationFrame(gameLoop)

    // Input tick - sends input to server at fixed rate
    const inputTick = setInterval(() => {
      const state = useStore.getState()
      const me = state.players[state.myId]
      if (!me || me.dead || state.paused) return

      const isMobileMode = state.isMobileMode

      // Movement
      let vx = 0
      if (isMobileMode) {
        const axis = inputManager.getVirtualAxis()
        vx = axis.x * PLAYER_SPEED
      } else {
        if (inputManager.isPressed('moveLeft'))  vx -= PLAYER_SPEED
        if (inputManager.isPressed('moveRight')) vx += PLAYER_SPEED
      }

      // Jump/Jetpack logic for mobile
      let jump = false
      let jetpack = false
      if (isMobileMode) {
        const axis = inputManager.getVirtualAxis()
        const upDrag = axis.y < -0.6
        const now = Date.now()
        
        // Trigger jump when transitioning to upward drag (debounce to prevent ground clip)
        if (upDrag && (now - lastJumpTrigger.current) > 300) {
          jump = true
          lastJumpTrigger.current = now
        }
        
        // Jetpack: hold upward drag longer after jump to activate
        if (upDrag && axis.y < -0.75) {
          jetpack = true
        }
      } else {
        jump = inputManager.isPressed('jump')
        jetpack = inputManager.isPressed('jetpack')
      }

      client.sendMovement(vx, 0, jump, jetpack, TICK_MS / 1000)

      // Aim - use virtual angle on mobile, mouse position on desktop
      let angle
      if (isMobileMode && inputManager.getVirtualAimAngle() !== null) {
        // Use direct angle from right joystick
        angle = inputManager.getVirtualAimAngle()
      } else {
        // Desktop: calculate from mouse position
        const worldPos = renderer.camera.screenToWorld(inputManager.mouseX, inputManager.mouseY)
        angle = Math.atan2(worldPos.y - me.y, worldPos.x - me.x)
      }
      client.sendAim(angle)

      // Shoot (auto-fire support)
      const wpn = state.weapons?.[me.weapon]
      if (inputManager.isPressed('shoot')) {
        client.shoot(angle)
      }

      // Grenade
      if (inputManager.isPressed('grenade')) {
        client.throwGrenade(angle)
      }

      // Gas
      if (inputManager.isPressed('gas')) {
        client.throwGas(angle)
      }

      // Reload
      if (inputManager.isPressed('reload')) {
        client.reload()
      }

      // Scoreboard
      useStore.getState().setShowScoreboard(
        inputManager.isKeyDown('Tab')
      )

      // Pause
      if (inputManager.isKeyDown('Escape')) {
        useStore.getState().setPaused(true)
      }
    }, TICK_MS)

    return () => {
      if (gameLoopRaf) cancelAnimationFrame(gameLoopRaf)
      clearInterval(inputTick)
      renderer.stop()
      inputManager.destroy()
    }
  }, [])

  const handleMobilePause = () => {
    useStore.getState().setPaused(true)
  }

  return (
    <>
      <canvas ref={canvasRef} className="game-canvas-full" />
      {isMobile && (
        <button className="mobile-pause-btn" onClick={handleMobilePause}>⏸</button>
      )}
    </>
  )
}