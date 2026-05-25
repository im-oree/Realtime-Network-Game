import React from 'react'
import { useStore } from '../store'
import client from '../game/gameClient'

export default function PauseMenu() {
  const resume = () => useStore.getState().setPaused(false)

  const quit = () => {
    client.leaveRoom()
    useStore.getState().setPaused(false)
  }

  const goSettings = () => {
    useStore.getState().setPaused(false)
    useStore.getState().setScreen('settings')
  }

  return (
    <div className="pause-overlay">
      <div className="pause-panel">
        <h2>PAUSED</h2>
        <button className="menu-btn primary large" onClick={resume}>
          ▶ Resume
        </button>
        <button className="menu-btn secondary" onClick={goSettings}>
          ⚙ Settings
        </button>
        <button className="menu-btn danger" onClick={quit}>
          ✕ Quit to Menu
        </button>
      </div>
    </div>
  )
}