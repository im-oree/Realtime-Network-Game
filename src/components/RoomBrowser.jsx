import React, { useState, useEffect, useCallback } from 'react'
import { useStore } from '../store'
import { loadUsername } from '../config'
import client from '../game/gameClient'

export default function RoomBrowser() {
  const [rooms, setRooms] = useState([])
  const [loading, setLoading] = useState(false)

  const refresh = useCallback(() => {
    setLoading(true)
    client.requestRooms(list => {
      setRooms(list || [])
      setLoading(false)
    })
    // Also try REST
    fetch('/rooms').then(r => r.json()).then(d => {
      setRooms(d.rooms || [])
      setLoading(false)
    }).catch(() => setLoading(false))
  }, [])

  useEffect(() => { refresh() }, [refresh])

  const join = (roomId) => {
    const username = loadUsername() || 'Player'
    client.joinRoom(roomId, username)
  }

  const quickJoin = () => {
    const username = loadUsername() || 'Player'
    client.quickJoin(username)
  }

  return (
    <div className="menu-container">
      <div className="menu-bg" />
      <div className="settings-panel">
        <div className="settings-header">
          <button className="menu-btn ghost" onClick={() => useStore.getState().setScreen('menu')}>
            ← Back
          </button>
          <h2>Browse Rooms</h2>
          <div className="settings-header-actions">
            <button className="menu-btn ghost small" onClick={refresh}>
              {loading ? '⏳' : '↻'} Refresh
            </button>
            <button className="menu-btn primary small" onClick={quickJoin}>
              ⚡ Quick Join
            </button>
          </div>
        </div>

        <div className="rooms-grid">
          {rooms.length === 0 ? (
            <div className="empty-rooms">
              <p>No rooms available</p>
              <p className="hint">Create one or use Quick Play!</p>
            </div>
          ) : (
            rooms.map(r => (
              <div key={r.roomId} className="room-card-lg">
                <div className="room-card-info">
                  <div className="room-card-name">{r.mapName || r.mapId}</div>
                  <div className="room-card-id">{r.roomId.slice(0, 18)}</div>
                  <div className="room-card-players">
                    👥 {r.playerCount} / {r.maxPlayers}
                  </div>
                </div>
                <button
                  className="menu-btn secondary"
                  onClick={() => join(r.roomId)}
                  disabled={r.playerCount >= r.maxPlayers}
                >
                  {r.playerCount >= r.maxPlayers ? 'Full' : 'Join'}
                </button>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  )
}