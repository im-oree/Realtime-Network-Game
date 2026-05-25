import React, { useMemo, useState } from 'react'
import { useStore } from '../store'
import client from '../game/gameClient'

export default function PauseMenu() {
  const [cheatInput, setCheatInput] = useState('')
  const [cheatMessage, setCheatMessage] = useState('')
  const cheats = useStore(s => s.cheats)

  const resume = () => useStore.getState().setPaused(false)

  const quit = () => {
    client.leaveRoom()
    useStore.getState().setPaused(false)
  }

  const goSettings = () => {
    useStore.getState().setPaused(false)
    useStore.getState().setScreen('settings')
  }

  const toggleFullscreen = async () => {
    try {
      if (document.fullscreenElement) {
        await document.exitFullscreen()
      } else if (document.documentElement.requestFullscreen) {
        await document.documentElement.requestFullscreen()
      }
    } catch (_) {}
  }

  const cheatPresets = useMemo(() => ([
    { label: 'Infinite Health', code: 'GODMODE', hint: 'GODMODE' },
    { label: 'Infinite Jetpack', code: 'INFJETPACK', hint: 'INFJETPACK' },
    { label: 'Infinite Bullets', code: 'INFBULLETS', hint: 'INFBULLETS' },
    { label: 'Infinite Life', code: 'INFLIFE', hint: 'INFLIFE' },
    { label: 'All Cheats', code: 'ALL', hint: 'ALL' },
  ]), [])

  const applyCheat = (rawCode) => {
    const code = String(rawCode || cheatInput).trim()
    if (!code) return
    client.applyCheatCode(code)
    setCheatMessage(`Applied: ${code}`)
    setCheatInput('')
  }

  const resetCheats = () => {
    client.applyCheatCode('RESET')
    setCheatMessage('Cheats reset')
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
        <button className="menu-btn secondary" onClick={toggleFullscreen}>
          ⤢ Toggle Fullscreen
        </button>
        <div className="pause-cheats">
          <div className="pause-cheats-header">
            <span>Cheat Codes</span>
            <span className="pause-cheat-status">
              H:{cheats.infiniteHealth ? 'ON' : 'OFF'} J:{cheats.infiniteJetpack ? 'ON' : 'OFF'} B:{cheats.infiniteBullets ? 'ON' : 'OFF'} L:{cheats.infiniteLives ? 'ON' : 'OFF'}
            </span>
          </div>
          <div className="pause-cheats-input-row">
            <input
              className="pause-cheats-input"
              value={cheatInput}
              onChange={e => setCheatInput(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter') applyCheat()
              }}
              placeholder="Enter code: GODMODE, INFJETPACK..."
              autoCapitalize="characters"
              autoCorrect="off"
              spellCheck={false}
            />
            <button className="menu-btn small primary" onClick={() => applyCheat()}>
              Apply
            </button>
          </div>
          <div className="pause-cheats-grid">
            {cheatPresets.map(item => (
              <button
                key={item.code}
                className="menu-btn ghost small"
                onClick={() => applyCheat(item.code)}
              >
                {item.label}
              </button>
            ))}
          </div>
          <div className="pause-cheats-actions">
            <button className="menu-btn ghost small" onClick={resetCheats}>
              Reset Cheats
            </button>
          </div>
          {cheatMessage && <div className="pause-cheats-message">{cheatMessage}</div>}
        </div>
        <button className="menu-btn danger" onClick={quit}>
          ✕ Quit to Menu
        </button>
      </div>
    </div>
  )
}