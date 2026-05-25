import React, { useState, useEffect } from 'react'
import { useStore } from '../store'
import { loadUsername, saveUsername } from '../config'
import client from '../game/gameClient'

export default function MainMenu() {
  const [username, setUsername] = useState(() => loadUsername())
  const connected = useStore(s => s.connected)

  useEffect(() => {
    client.connect()
  }, [])

  const handlePlay = (screen) => {
    const name = username.trim() || 'Player'
    saveUsername(name)
    useStore.getState().setScreen(screen)
  }

  const quickJoin = () => {
    const name = username.trim() || 'Player'
    saveUsername(name)
    client.quickJoin(name)
  }

  const matchmake = () => {
    const name = username.trim() || 'Player'
    saveUsername(name)
    client.matchmake(name)
  }

  return (
    <div className="menu-container">
      <div className="menu-bg" />
      <div className="menu-panel">
        <div className="menu-title-group">
          <h1 className="menu-title">⚡ GRID WARS</h1>
          <p className="menu-subtitle">Tactical Arena Combat</p>
        </div>

        <div className="menu-section">
          <label className="menu-label">Username</label>
          <input
            className="menu-input"
            value={username}
            onChange={e => setUsername(e.target.value)}
            maxLength={16}
            placeholder="Enter your name"
          />
        </div>

        <div className="menu-buttons">
          <button className="menu-btn primary large" onClick={quickJoin}>
            ▶ QUICK PLAY
          </button>
          <button className="menu-btn primary" onClick={matchmake}>
            🎮 MATCHMAKE
          </button>
          <div className="menu-btn-row">
            <button className="menu-btn secondary" onClick={() => handlePlay('createRoom')}>
              + Create Room
            </button>
            <button className="menu-btn secondary" onClick={() => handlePlay('browse')}>
              🔍 Browse Rooms
            </button>
          </div>
          <button className="menu-btn ghost" onClick={() => handlePlay('settings')}>
            ⚙ Settings
          </button>
        </div>

        <div className="menu-footer">
          <span className={`status-dot ${connected ? 'online' : 'offline'}`} />
          <span className="status-text">{connected ? 'Connected' : 'Connecting…'}</span>
        </div>
      </div>

      <div className="menu-info">
        <div className="info-card">
          <h3>🎮 Controls</h3>
          <p>A/D — Move · W — Jump</p>
          <p>Space — Jetpack · Mouse — Aim</p>
          <p>Click — Shoot · R — Reload</p>
          <p>G — Grenade · H — Gas</p>
          <p>Tab — Scoreboard · Esc — Pause</p>
        </div>
        <div className="info-card">
          <h3>⚡ Weapons</h3>
          <p>Pistol · SMG · Shotgun</p>
          <p>Sniper · Assault Rifle · RPG</p>
          <p>Pick up weapons from the map!</p>
        </div>
        <div className="info-card">
          <h3>🗺️ Maps</h3>
          <p>Enchanted Forest · Arid Canyon</p>
          <p>Dark Fortress · Abandoned Factory</p>
        </div>
      </div>
    </div>
  )
}