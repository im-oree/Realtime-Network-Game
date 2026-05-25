import React, { useState, useEffect } from 'react'
import { useStore } from '../store'
import { loadUsername, saveUsername } from '../config'
import client from '../game/gameClient'
import audioManager from '../game/audioManager'
import { loadSettings } from '../config'

export default function MainMenu() {
  const [username, setUsername] = useState(() => loadUsername())
  const connected = useStore(s => s.connected)

  useEffect(() => {
    client.connect()
    const settings = loadSettings()
    audioManager.init()
    audioManager.setVolumes(settings.musicVolume, settings.sfxVolume)
    audioManager.startMenuMusic()

    return () => {
      audioManager.stopMenuMusic()
    }
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
          <h1 className="menu-title">GRID WARS</h1>
          <p className="menu-subtitle">Tactical Arena Combat</p>
        </div>

        <div className="menu-section">
          <label className="menu-label" htmlFor="username-input">
            Username
          </label>
          <input
            id="username-input"
            className="menu-input"
            value={username}
            onChange={e => setUsername(e.target.value)}
            maxLength={16}
            placeholder="Enter your name"
            autoComplete="off"
            spellCheck={false}
          />
        </div>

        <div className="menu-buttons">
          <button
            className="menu-btn primary large"
            onClick={quickJoin}
            disabled={!connected}
          >
            Quick Play
          </button>

          <button
            className="menu-btn primary"
            onClick={matchmake}
            disabled={!connected}
          >
            Matchmake
          </button>

          <div className="menu-btn-row">
            <button
              className="menu-btn secondary"
              onClick={() => handlePlay('createRoom')}
            >
              Create Room
            </button>
            <button
              className="menu-btn secondary"
              onClick={() => handlePlay('browse')}
            >
              Browse
            </button>
          </div>

          <button
            className="menu-btn ghost"
            onClick={() => handlePlay('settings')}
          >
            Settings
          </button>
        </div>

        <div className="menu-footer">
          <span
            className={`status-dot ${connected ? 'online' : 'offline'}`}
            role="status"
            aria-label={connected ? 'Connected' : 'Disconnected'}
          />
          <span className="status-text">
            {connected ? 'Connected' : 'Connecting…'}
          </span>
        </div>
      </div>

      <aside className="menu-info" aria-label="Game information">
        <div className="info-card">
          <h3>Controls</h3>
          <p>
            A/D — Move&ensp;·&ensp;W — Jump<br />
            Space — Jetpack&ensp;·&ensp;Mouse — Aim<br />
            Click — Shoot&ensp;·&ensp;R — Reload<br />
            G — Grenade&ensp;·&ensp;H — Gas<br />
            Tab — Scoreboard&ensp;·&ensp;Esc — Pause
          </p>
        </div>

        <div className="info-card">
          <h3>Weapons</h3>
          <p>
            Pistol&ensp;·&ensp;SMG&ensp;·&ensp;Shotgun<br />
            Sniper&ensp;·&ensp;Assault Rifle&ensp;·&ensp;RPG<br />
            Pick up weapons from the map!
          </p>
        </div>

        <div className="info-card">
          <h3>Maps</h3>
          <p>
            Enchanted Forest&ensp;·&ensp;Arid Canyon<br />
            Dark Fortress&ensp;·&ensp;Abandoned Factory
          </p>
        </div>
      </aside>
    </div>
  )
}