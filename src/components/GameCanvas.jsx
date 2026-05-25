import React, { useEffect, useRef } from 'react'
import { useStore }       from '../store'
import { GameRenderer }   from '../engine/renderer'
import inputManager       from '../game/inputManager'
import client             from '../game/gameClient'
import { loadControls, loadSettings, PLAYER_SPEED, TICK_MS } from '../config'

const renderer = new GameRenderer()

export default function GameCanvas() {
  const canvasRef = useRef(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    // Load settings
    const settings = loadSettings()
    renderer.camera.shakeEnabled = settings.cameraShake
    renderer.particles.enabled   = settings.showParticles

    // Init input
    inputManager.init(canvas)
    inputManager.updateControls(loadControls())

    // Start renderer
    renderer.start(canvas, () => useStore.getState())

    // Input tick
    const inputTick = setInterval(() => {
      const state = useStore.getState()
      const me = state.players[state.myId]
      if (!me || me.dead || state.paused) return

      // Movement
      let vx = 0
      if (inputManager.isPressed('moveLeft'))  vx -= PLAYER_SPEED
      if (inputManager.isPressed('moveRight')) vx += PLAYER_SPEED
      const jump    = inputManager.isPressed('jump')
      const jetpack = inputManager.isPressed('jetpack')

      client.sendMovement(vx, 0, jump, jetpack, TICK_MS / 1000)

      // Aim
      const worldPos = renderer.camera.screenToWorld(inputManager.mouseX, inputManager.mouseY)
      const angle = Math.atan2(worldPos.y - me.y, worldPos.x - me.x)
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
      clearInterval(inputTick)
      renderer.stop()
      inputManager.destroy()
    }
  }, [])

  return <canvas ref={canvasRef} className="game-canvas-full" />
}