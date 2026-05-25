import React, { useState, useEffect } from 'react'
import { useStore } from '../store'
import { loadUsername } from '../config'
import client from '../game/gameClient'

export default function CreateRoom() {
  const [mapId, setMapId] = useState('forest')
  const [maps, setMaps]   = useState([])

  useEffect(() => {
    fetch('/maps').then(r => r.json()).then(d => setMaps(d.maps || [])).catch(() => {})
  }, [])

  const create = () => {
    const username = loadUsername() || 'Player'
    client.createRoom(mapId, username)
  }

  const mapPreviews = {
    forest:     { emoji: '🌲', color: '#1a4a1a' },
    desert:     { emoji: '🏜️', color: '#8B6914' },
    castle:     { emoji: '🏰', color: '#4a4a5a' },
    industrial: { emoji: '🏭', color: '#3a3e42' }
  }

  return (
    <div className="menu-container">
      <div className="menu-bg" />
      <div className="settings-panel">
        <div className="settings-header">
          <button className="menu-btn ghost" onClick={() => useStore.getState().setScreen('menu')}>
            ← Back
          </button>
          <h2>Create Room</h2>
        </div>

        <div className="settings-section">
          <h3>Select Map</h3>
          <div className="map-grid">
            {maps.map(m => {
              const preview = mapPreviews[m.id] || { emoji: '🗺️', color: '#333' }
              return (
                <div
                  key={m.id}
                  className={`map-card ${mapId === m.id ? 'selected' : ''}`}
                  onClick={() => setMapId(m.id)}
                  style={{ '--map-color': preview.color }}
                >
                  <div className="map-card-emoji">{preview.emoji}</div>
                  <div className="map-card-name">{m.name}</div>
                  <div className="map-card-desc">{m.desc}</div>
                </div>
              )
            })}
          </div>
        </div>

        <button className="menu-btn primary large" onClick={create}>
          🚀 Create & Join
        </button>
      </div>
    </div>
  )
}