import React from 'react'
import { useStore } from '../store'

export default function HUD() {
  const myId    = useStore(s => s.myId)
  const players = useStore(s => s.players)
  const weapons = useStore(s => s.weapons)
  const me      = players[myId]
  const isMobile = useStore(s => s.isMobileMode)

  if (!me || me.dead) return null

  const wpn = weapons?.[me.weapon]

  return (
    <div className="hud-container">
      {/* Bottom left: weapon + ammo */}
      <div className={`hud-weapon ${isMobile ? 'mobile-top-left' : ''}`}>
        <div className="hud-weapon-name" style={{ color: wpn?.color || '#fff' }}>
          {wpn?.name || me.weapon}
        </div>
        <div className="hud-ammo">
          <span className="hud-ammo-current">{me.ammo}</span>
          <span className="hud-ammo-sep">/</span>
          <span className="hud-ammo-max">{wpn?.magSize || '?'}</span>
          {me.reloading && <span className="hud-reloading">RELOADING</span>}
        </div>
      </div>

      {/* Center: HP */}
      <div className="hud-health">
        <div className="hud-hp-bar">
          <div
            className="hud-hp-fill"
            style={{
              width: `${Math.max(0, (me.hp / me.maxHp) * 100)}%`,
              background: me.hp > 50 ? '#22c55e' : me.hp > 25 ? '#facc15' : '#ef4444'
            }}
          />
        </div>
        <div className="hud-hp-text">{Math.ceil(me.hp)} HP</div>
        {me.armor > 0 && (
          <div className="hud-armor">
            <div className="hud-armor-fill" style={{ width: `${me.armor}%` }} />
            <span>{Math.ceil(me.armor)} Armor</span>
          </div>
        )}
      </div>

      {/* Items (moved to top-right on mobile) */}
      <div className={`hud-items ${isMobile ? 'mobile-top-right' : ''}`}>
        <div className="hud-item">
          <span className="hud-item-icon">💣</span>
          <span>{me.grenades}</span>
        </div>
        <div className="hud-item">
          <span className="hud-item-icon">☁️</span>
          <span>{me.gasCanisters}</span>
        </div>
        <div className="hud-item">
          <div className="hud-fuel-bar">
            <div
              className="hud-fuel-fill"
              style={{ width: `${me.jetpackFuel}%` }}
            />
          </div>
          <span className="hud-fuel-label">⛽ Fuel</span>
        </div>
      </div>

      {/* Crosshair */}
      <div className="crosshair" style={{ '--aim-angle': `${me.angle || 0}rad` }}>
        <div className="crosshair-ring" />
        <div className="crosshair-center" />
        <div className="crosshair-ray" />
        <div className="crosshair-tip" />
      </div>

      {/* Kill count */}
      <div className="hud-kills">
        <span>⚡ {me.kills}</span>
      </div>
    </div>
  )
}