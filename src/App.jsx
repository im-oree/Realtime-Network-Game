import React, { useEffect } from 'react'
import { useStore } from './store'
import MainMenu    from './components/MainMenu'
import Settings    from './components/Settings'
import CreateRoom  from './components/CreateRoom'
import RoomBrowser from './components/RoomBrowser'
import GameCanvas  from './components/GameCanvas'
import HUD         from './components/HUD'
import PauseMenu   from './components/PauseMenu'
import DeathScreen from './components/DeathScreen'
import DeviceModePrompt from './components/DeviceModePrompt'
import MobileControls from './components/MobileControls'

export default function App() {
  const screen = useStore(s => s.screen)
  const paused = useStore(s => s.paused)
  const isMobileMode = useStore(s => s.isMobileMode)
  const showDevicePrompt = useStore(s => s.showDevicePrompt)

  useEffect(() => {
    // Auto-enter fullscreen on mobile mode when gameplay starts
    if (screen === 'playing' && isMobileMode) {
      const el = document.documentElement
      if (el && el.requestFullscreen) {
        try { el.requestFullscreen().catch?.(() => {}) } catch (_) {}
      }
    }
  }, [screen, isMobileMode])

  if (showDevicePrompt) return <DeviceModePrompt />

  switch (screen) {
    case 'menu':
      return <MainMenu />
    case 'settings':
      return <Settings />
    case 'createRoom':
      return <CreateRoom />
    case 'browse':
      return <RoomBrowser />
    case 'playing':
      return (
        <div className="game-fullscreen">
          <GameCanvas />
          <HUD />
          {isMobileMode && <MobileControls />}
          <DeathScreen />
          {paused && <PauseMenu />}
        </div>
      )
    default:
      return <MainMenu />
  }
}