import React from 'react'
import { useStore } from '../store'

export default function DeviceModePrompt() {
  const setMobile = useStore(state => state.setMobileMode)
  const setShow = useStore(state => state.setShowDevicePrompt)

  const choose = (mobile) => {
    try { localStorage.setItem('gridwars_mobileMode', mobile ? 'true' : 'false') } catch (_) {}
    setMobile(mobile)
    setShow(false)
  }

  return (
    <div style={{position:'fixed',inset:0,display:'flex',alignItems:'center',justifyContent:'center',zIndex:200}}>
      <div style={{background:'rgba(10,14,26,0.96)',border:'1px solid rgba(255,255,255,0.04)',padding:28,borderRadius:12,textAlign:'center'}}>
        <h2 style={{marginBottom:8}}>Choose interface</h2>
        <p style={{color:'#9aa6bd',marginBottom:18}}>Are you playing on a desktop or a mobile device?</p>
        <div style={{display:'flex',gap:12,justifyContent:'center'}}>
          <button className="menu-btn primary" onClick={() => choose(false)}>Desktop</button>
          <button className="menu-btn secondary" onClick={() => choose(true)}>Mobile</button>
        </div>
        <div style={{marginTop:12}}>
          <button className="menu-btn ghost" onClick={() => choose(/Mobi|Android|iPhone|iPad|Mobile/i.test(navigator.userAgent))}>Detect Automatically</button>
        </div>
      </div>
    </div>
  )
}
