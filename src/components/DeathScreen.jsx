import React from 'react'
import { useStore } from '../store'

export default function DeathScreen() {
  const myId    = useStore(s => s.myId)
  const players = useStore(s => s.players)
  const me      = players[myId]

  if (!me || !me.dead) return null

  return (
    <div className="death-overlay">
      <div className="death-panel">
        <h2 className="death-title">ELIMINATED</h2>
        <p className="death-timer">
          Respawning in {Math.max(0, me.respawnTimer).toFixed(1)}s
        </p>
        <div className="death-stats">
          <span>⚡ {me.kills} Kills</span>
          <span>💀 {me.deaths} Deaths</span>
        </div>
      </div>
    </div>
  )
}