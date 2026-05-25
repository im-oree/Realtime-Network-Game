import React, { useState } from 'react'
import { useStore } from '../store'
import {
  loadControls, saveControls, loadSettings, saveSettings, DEFAULT_CONTROLS
} from '../config'
import inputManager from '../game/inputManager'
import audioManager from '../game/audioManager'

export default function Settings() {
  const [controls, setControls] = useState(() => loadControls())
  const [settings, setSettings] = useState(() => loadSettings())
  const [binding,  setBinding]  = useState(null) // action being rebound

  const handleKeyBind = (action) => {
    setBinding(action)
    const handler = (e) => {
      e.preventDefault()
      const key = e.key === ' ' ? 'Space' : e.key
      const newControls = { ...controls, [action]: key }
      setControls(newControls)
      saveControls(newControls)
      inputManager.updateControls(newControls)
      setBinding(null)
      window.removeEventListener('keydown', handler)
    }
    window.addEventListener('keydown', handler)
  }

  const handleMouseBind = (action) => {
    setBinding(action)
    const handler = (e) => {
      e.preventDefault()
      const key = `Mouse${e.button}`
      const newControls = { ...controls, [action]: key }
      setControls(newControls)
      saveControls(newControls)
      inputManager.updateControls(newControls)
      setBinding(null)
      window.removeEventListener('mousedown', handler)
    }
    window.addEventListener('mousedown', handler)
  }

  const resetControls = () => {
    setControls({ ...DEFAULT_CONTROLS })
    saveControls(DEFAULT_CONTROLS)
    inputManager.updateControls(DEFAULT_CONTROLS)
  }

  const updateSetting = (key, value) => {
    const next = { ...settings, [key]: value }
    setSettings(next)
    saveSettings(next)
    audioManager.setVolumes(next.musicVolume, next.sfxVolume)
  }

  const ACTIONS = [
    ['moveLeft',   'Move Left'],
    ['moveRight',  'Move Right'],
    ['jump',       'Jump'],
    ['jetpack',    'Jetpack'],
    ['shoot',      'Shoot'],
    ['grenade',    'Grenade'],
    ['gas',        'Gas Canister'],
    ['reload',     'Reload'],
    ['pause',      'Pause'],
    ['scoreboard', 'Scoreboard']
  ]

  return (
    <div className="menu-container">
      <div className="menu-bg" />
      <div className="settings-panel">
        <div className="settings-header">
          <button className="menu-btn ghost" onClick={() => useStore.getState().setScreen('menu')}>
            ← Back
          </button>
          <h2>Settings</h2>
        </div>

        <div className="settings-section">
          <h3>Controls</h3>
          <div className="controls-grid">
            {ACTIONS.map(([action, label]) => (
              <div key={action} className="control-row">
                <span className="control-label">{label}</span>
                <button
                  className={`control-key ${binding === action ? 'binding' : ''}`}
                  onClick={() => {
                    if (action === 'shoot') handleMouseBind(action)
                    else handleKeyBind(action)
                  }}
                >
                  {binding === action ? 'Press key…' : controls[action] || '—'}
                </button>
              </div>
            ))}
          </div>
          <button className="menu-btn ghost small" onClick={resetControls}>
            Reset to Defaults
          </button>
        </div>

        <div className="settings-section">
          <h3>Audio</h3>
          <div className="slider-row">
            <span>Music</span>
            <input type="range" min="0" max="100" value={settings.musicVolume * 100}
              onChange={e => updateSetting('musicVolume', e.target.value / 100)} />
            <span>{Math.round(settings.musicVolume * 100)}%</span>
          </div>
          <div className="slider-row">
            <span>SFX</span>
            <input type="range" min="0" max="100" value={settings.sfxVolume * 100}
              onChange={e => updateSetting('sfxVolume', e.target.value / 100)} />
            <span>{Math.round(settings.sfxVolume * 100)}%</span>
          </div>
        </div>

        <div className="settings-section">
          <h3>Gameplay</h3>
          <label className="toggle-row">
            <input type="checkbox" checked={settings.cameraShake}
              onChange={e => updateSetting('cameraShake', e.target.checked)} />
            Camera Shake
          </label>
          <label className="toggle-row">
            <input type="checkbox" checked={settings.showParticles}
              onChange={e => updateSetting('showParticles', e.target.checked)} />
            Show Particles
          </label>
          <label className="toggle-row">
            <input type="checkbox" checked={settings.showMinimap}
              onChange={e => updateSetting('showMinimap', e.target.checked)} />
            Show Minimap
          </label>
        </div>
      </div>
    </div>
  )
}