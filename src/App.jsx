import React       from 'react'
import { useStore } from './store'
import MainMenu    from './components/MainMenu'
import Settings    from './components/Settings'
import CreateRoom  from './components/CreateRoom'
import RoomBrowser from './components/RoomBrowser'
import GameCanvas  from './components/GameCanvas'
import HUD         from './components/HUD'
import PauseMenu   from './components/PauseMenu'
import DeathScreen from './components/DeathScreen'

export default function App() {
  const screen = useStore(s => s.screen)
  const paused = useStore(s => s.paused)

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
          <DeathScreen />
          {paused && <PauseMenu />}
        </div>
      )
    default:
      return <MainMenu />
  }
}