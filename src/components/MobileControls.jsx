import React, { useRef, useEffect, useState } from 'react'
import inputManager from '../game/inputManager'
import { useStore } from '../store'

function clamp(v, a, b) { return Math.max(a, Math.min(b, v)) }

export default function MobileControls() {
  const isMobile = useStore(s => s.isMobileMode)
  const leftRef = useRef(null)
  const rightRef = useRef(null)
  const leftStickRef = useRef(null)
  const rightStickRef = useRef(null)
  const leftTouchId = useRef(null)
  const rightTouchId = useRef(null)
  const [leftStickPos, setLeftStickPos] = useState({ x: 0, y: 0 })
  const [rightStickPos, setRightStickPos] = useState({ x: 0, y: 0 })

  useEffect(() => {
    return () => {
      inputManager.setVirtualAxis(0,0)
      inputManager.releaseAction('shoot')
    }
  }, [])

  if (!isMobile) return null

  // Handle joystick math - takes a raw touch object
  const handleLeft = (touch) => {
    const el = leftRef.current
    if (!el || !touch) return
    const r = el.getBoundingClientRect()
    const cx = r.left + r.width/2
    const cy = r.top + r.height/2
    const dx = touch.clientX - cx
    const dy = touch.clientY - cy
    const max = Math.min(r.width, r.height) * 0.45
    const nx = clamp(dx / max, -1, 1)
    const ny = clamp(dy / max, -1, 1)
    // Clamp to circular area
    const len = Math.sqrt(nx*nx + ny*ny)
    const scale = len > 1 ? 1 / len : 1
    const fx = nx * scale
    const fy = ny * scale
    inputManager.setVirtualAxis(fx, fy)
    // Update visual position
    setLeftStickPos({ x: fx * max * 0.7, y: fy * max * 0.7 })
  }

  const handleRight = (touch) => {
    const el = rightRef.current
    if (!el || !touch) return
    
    const r = el.getBoundingClientRect()
    const cx = r.left + r.width / 2
    const cy = r.top + r.height / 2
    const dx = touch.clientX - cx
    const dy = touch.clientY - cy
    const dist = Math.sqrt(dx * dx + dy * dy)
    const max = Math.min(r.width, r.height) * 0.45
    
    // Calculate angle from joystick drag
    const angle = Math.atan2(dy, dx)
    inputManager.setVirtualAimAngle(angle)
    
    // Visual stick position
    const stickDist = Math.min(dist, max)
    setRightStickPos({ 
      x: Math.cos(angle) * stickDist * 0.7, 
      y: Math.sin(angle) * stickDist * 0.7 
    })
    
    // Fire if dragged at all beyond center (very low threshold)
    if (dist > 8) {
      inputManager.pressAction('shoot')
    } else {
      inputManager.releaseAction('shoot')
    }
  }

  // Touch handlers with ref-based tracking (no state)
  const onLeftStart = (e) => {
    e.preventDefault()
    const touch = e.touches?.[0] || e
    if (e.touches) leftTouchId.current = touch.identifier
    handleLeft(touch)
  }

  const onLeftMove = (e) => {
    e.preventDefault()
    let touch
    if (e.touches) {
      touch = Array.from(e.touches).find(t => t.identifier === leftTouchId.current) || e.touches[0]
    } else {
      touch = e
    }
    if (touch) handleLeft(touch)
  }

  const onLeftEnd = (e) => {
    e.preventDefault()
    leftTouchId.current = null
    setLeftStickPos({ x: 0, y: 0 })
    inputManager.setVirtualAxis(0, 0)
  }

  const onRightStart = (e) => {
    e.preventDefault()
    const touch = e.touches?.[0] || e
    if (e.touches) rightTouchId.current = touch.identifier
    handleRight(touch)
  }

  const onRightMove = (e) => {
    e.preventDefault()
    let touch
    if (e.touches) {
      touch = Array.from(e.touches).find(t => t.identifier === rightTouchId.current) || e.touches[0]
    } else {
      touch = e
    }
    if (touch) handleRight(touch)
  }

  const onRightEnd = (e) => {
    e.preventDefault()
    rightTouchId.current = null
    setRightStickPos({ x: 0, y: 0 })
    inputManager.setVirtualAimAngle(null)
    inputManager.releaseAction('shoot')
  }

  return (
    <div className="mobile-controls">
      <div className="joystick left" ref={leftRef}
        onTouchStart={onLeftStart} onTouchMove={onLeftMove} onTouchEnd={onLeftEnd}
        onMouseDown={onLeftStart} onMouseMove={onLeftMove} onMouseUp={onLeftEnd}
      >
        <div className="stick" ref={leftStickRef} style={{ transform: `translate(${leftStickPos.x}px, ${leftStickPos.y}px)` }} />
      </div>

      <div className="joystick right" ref={rightRef}
        onTouchStart={onRightStart} onTouchMove={onRightMove} onTouchEnd={onRightEnd}
        onMouseDown={onRightStart} onMouseMove={onRightMove} onMouseUp={onRightEnd}
      >
        <div className="stick aim" ref={rightStickRef} style={{ transform: `translate(${rightStickPos.x}px, ${rightStickPos.y}px)` }} />
      </div>

      <div className="mobile-actions-panel">
        <button className="mobile-btn small" onTouchStart={(e)=>{e.preventDefault(); inputManager.pressAction('reload')}} onTouchEnd={(e)=>{e.preventDefault(); inputManager.releaseAction('reload')}}>R</button>
        <button className="mobile-btn small" onTouchStart={(e)=>{e.preventDefault(); inputManager.pressAction('grenade')}} onTouchEnd={(e)=>{e.preventDefault(); inputManager.releaseAction('grenade')}}>💣</button>
        <button className="mobile-btn small" onTouchStart={(e)=>{e.preventDefault(); inputManager.pressAction('gas')}} onTouchEnd={(e)=>{e.preventDefault(); inputManager.releaseAction('gas')}}>☁️</button>
      </div>
    </div>
  )
}
