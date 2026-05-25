# Grid Wars

I built Grid Wars as a real-time multiplayer arena shooter with a server-authoritative game loop, client-side prediction, custom canvas rendering, and a lightweight room-based multiplayer flow. The goal of the project was to make a fast, browser-playable shooter that feels responsive even over the network while still keeping the server in charge of the real game state.

This README is the full project documentation for the codebase. It explains what I built, how each part works, what technologies I used, how the game flows from menu to match, and how to run it locally.

## Table of Contents

1. [Project Overview](#project-overview)
2. [What I Built](#what-i-built)
3. [Tech Stack](#tech-stack)
4. [Project Structure](#project-structure)
5. [Game Features](#game-features)
6. [Controls](#controls)
7. [Gameplay Systems](#gameplay-systems)
8. [Networking and Multiplayer Flow](#networking-and-multiplayer-flow)
9. [Rendering and UI](#rendering-and-ui)
10. [Maps and Weapons](#maps-and-weapons)
11. [Storage and Settings](#storage-and-settings)
12. [How to Run the Project](#how-to-run-the-project)
13. [Notes and Current Limitations](#notes-and-current-limitations)

## Project Overview

Grid Wars is a 2D browser-based multiplayer shooter where multiple players join the same room, move across platform maps, shoot each other, throw grenades, deploy gas, pick up powerups, and respawn after being eliminated. The server owns the actual world simulation, while the client predicts movement locally so the game stays smooth.

The app is split into two major parts:

- A Vite + React frontend in the repository root under `src/`
- An Express + Socket.io backend in `backend/`

The frontend handles the menu flow, local input, rendering, HUD, and user settings. The backend handles room creation, matchmaking, authoritative physics, combat, pickups, respawning, and world state broadcasts.

## What I Built

I built the game with these main pieces:

- A main menu with quick play, matchmaking, room creation, room browsing, and settings
- A room-based multiplayer flow with create room, join room, quick join, and matchmake actions
- A server-authoritative combat loop with bullets, grenades, gas clouds, damage, kills, and respawns
- Custom maps with platforms, walls, spawn points, pickup spawns, and background data
- A canvas renderer with camera follow, particle effects, minimap, scoreboards, and respawn overlays
- A HUD that shows weapon, ammo, health, armor, jetpack fuel, grenades, gas, and kills
- Persisted local settings for username, controls, and visual/audio preferences

## Tech Stack

### Frontend

- React 18.2.0 for the UI
- Vite 5.1.0 for development and production builds
- Socket.io-client 4.7.2 for multiplayer networking
- Zustand 4.4.0 for global game state
- Canvas 2D for the actual gameplay rendering layer

### Backend

- Node.js runtime
- Express 4.18.2 for HTTP endpoints and static file serving
- Socket.io 4.7.2 for realtime multiplayer communication
- Native game-loop logic written in plain JavaScript

### Browser and Platform APIs

- Pointer Lock API for mouse aiming and camera-friendly controls
- Web Audio API for synthesized sound effects
- localStorage for username, controls, and settings persistence

## Project Structure

### Root

- `index.html` bootstraps the React app and loads the Inter font
- `vite.config.js` configures the Vite dev server
- `styles.css` contains the main app styling for the shell and menu screens
- `package.json` defines the frontend scripts and dependencies

### Frontend source

- `src/main.jsx` mounts the React app into the root DOM node
- `src/App.jsx` switches between the menu, settings, room browser, create room flow, and gameplay screen
- `src/store.js` stores global game state in Zustand
- `src/config.js` defines default controls and persisted settings helpers
- `src/game/gameClient.js` wraps the Socket.io client and multiplayer actions
- `src/game/inputManager.js` tracks keyboard, mouse, and pointer-lock state
- `src/game/audioManager.js` generates procedural sound effects
- `src/components/` contains the UI screens and overlays
- `src/engine/` contains the canvas renderer, camera, particles, minimap, weapon drawing, and other visual systems

### Backend

- `backend/server.js` starts the Express/Socket.io server and game loop
- `backend/gameRoom.js` owns room state and authoritative simulation
- `backend/physics.js` contains collision and separation helpers
- `backend/weapons.js` defines the weapon stats and pickup pool
- `backend/maps/` contains the map definitions and map list helpers

## Game Features

### Multiplayer Flow

- Quick Play searches for any room with space and joins it, or creates a new one if none exist
- Matchmake queues players and creates a new room when at least two players are waiting
- Create Room lets me choose a map and create a room directly
- Browse Rooms shows the current room list, player counts, and join buttons

### Combat and Movement

- Left and right movement with A and D
- Jumping with W
- Jetpack movement with Space
- Mouse aiming
- Shooting with the mouse button
- Reloading with R
- Grenade throwing with G
- Gas deployment with H
- Respawning after elimination with a 3 second timer

### Weapons

The game includes these weapons:

- Pistol
- SMG
- Shotgun
- Sniper
- Assault Rifle
- RPG

Each weapon has its own damage, fire rate, spread, magazine size, reload time, projectile speed, and visual/audio behavior.

### Pickups and Powerups

The server spawns pickups on maps and supports these pickup types:

- Health
- Armor
- Jet fuel
- Grenades
- Weapon pickups
- Speed boost
- Rapid fire

### Match Feedback

- Hit markers and bullet impact effects
- Explosion effects
- Kill feed notifications
- Scoreboard overlay
- Minimap
- Respawn overlay after death
- Camera shake on combat events

## Controls

I set the default controls in `src/config.js` and exposed them in the Settings screen so they can be changed and saved.

- A and D: move left and right
- W: jump
- Space: jetpack
- Mouse: aim
- Left click: shoot
- R: reload
- G: throw grenade
- H: deploy gas
- Tab: scoreboard
- Escape: pause

## Gameplay Systems

### Server-Authoritative Simulation

The server owns the truth for the world. Players do not directly control their final positions in the browser; instead, the client sends inputs and the server simulates movement, gravity, collisions, projectiles, grenades, damage, pickup collection, death, and respawn timing.

This is important because it makes the multiplayer state more consistent across clients and reduces the chance of desync from local-only simulation.

### Client-Side Prediction

The client keeps movement feeling responsive by predicting its own horizontal movement locally. It sends movement input with sequence numbers, then later reconciles with the server snapshot by removing acknowledged inputs and replaying the remaining pending movement.

That gives the game a responsive feel without giving the client authority over the world.

### Physics

The physics layer handles:

- Circle-versus-rectangle collision checks
- Player-versus-platform collision resolution
- Bullet-versus-platform collision checks
- Bullet-versus-player hit detection
- Player-versus-player separation so players do not overlap

### Combat

I added several combat mechanics on the server:

- Bullet projectiles with weapon-specific spread, speed, damage, and knockback
- Grenades with travel, bounce, fuse timer, and explosion damage
- Gas clouds with area damage over time
- Armor that absorbs part of incoming damage
- Respawn handling with score tracking
- Pickup collection and timed powerups

### Player State

Each player tracks data such as:

- Position and velocity
- Aim angle and facing direction
- Health and armor
- Current weapon and ammo
- Reload state
- Jetpack fuel and jetpack activity
- Grenades and gas canisters
- Powerup timers
- Kills and deaths
- Respawn timer

## Networking and Multiplayer Flow

### Connection Setup

The client creates a Socket.io connection from `src/game/gameClient.js`. When the app runs on localhost and the frontend is not already on port 3000, it connects to the backend at `http://localhost:3000`.

### Server Events

The backend exposes these HTTP endpoints:

- `GET /rooms` for the active room list
- `GET /maps` for the available maps
- `GET /weapons` for the weapon catalog

The Socket.io server listens for:

- `create_room`
- `join_room`
- `quick_join`
- `matchmake`
- `input`
- `shoot`
- `grenade`
- `gas`
- `leave_room`

### Room Join Flow

When a player joins a room, the server sends a `room_joined` payload containing:

- The room ID
- A full world snapshot
- Map metadata
- The weapon table

The server also broadcasts player join and leave events to everyone in the room.

### World Updates

The server runs a fixed game loop at 60 ticks per second. Every tick it:

- Processes queued inputs
- Updates the world simulation
- Applies physics and collision resolution
- Handles pickups, damage, projectiles, grenades, and gas
- Builds a fresh snapshot
- Broadcasts `world_state` to the room

### Reconciliation

The client stores pending movement inputs with sequence numbers. When a new world state arrives, it uses the last processed sequence reported by the server to clear acknowledged inputs and replay any remaining ones. That keeps the local player position close to the authoritative state.

## Rendering and UI

### React Screen Flow

`src/App.jsx` routes the app between these screens:

- Main menu
- Settings
- Create room
- Room browser
- Playing

### Menu Screens

I built the following screens in `src/components/`:

- `MainMenu.jsx` for username entry, quick play, matchmake, create room, browse rooms, and settings
- `CreateRoom.jsx` for selecting a map and creating a room
- `RoomBrowser.jsx` for fetching and joining live rooms
- `Settings.jsx` for controls, audio, camera shake, particles, minimap, and fullscreen preferences
- `PauseMenu.jsx` for resume, settings, and quit actions
- `DeathScreen.jsx` for the elimination overlay and respawn countdown
- `HUD.jsx` for the in-game bottom HUD and crosshair overlay
- `GameCanvas.jsx` for the actual input/render loop bridge

### Canvas Rendering

The canvas renderer is split into focused modules:

- `src/engine/renderer.js` orchestrates the frame loop and drawing order
- `src/engine/camera.js` handles follow, zoom, and shake behavior
- `src/engine/characterRenderer.js` draws the players
- `src/engine/weaponRenderer.js` draws bullets, grenades, gas clouds, and pickups
- `src/engine/mapRenderer.js` draws the current map
- `src/engine/minimapRenderer.js` draws the minimap
- `src/engine/effectsRenderer.js` draws the kill feed, scoreboard, and respawn overlay
- `src/engine/particles.js` creates and animates visual effects

### Audio

I used a synthesized audio approach instead of shipping sound files. `src/game/audioManager.js` creates procedural tones and noise bursts for:

- Shooting
- Hits
- Explosions
- Pickups
- Death
- Grenade throws
- Grenade ticking

That keeps the project self-contained and avoids needing a separate asset pipeline for audio.

## Maps and Weapons

### Maps

The backend exposes four maps:

- Forest
- Desert
- Castle
- Industrial

Each map definition provides the data the server and renderer need, including:

- Width and height
- Background values
- Gravity
- Platforms
- Walls
- Spawn points
- Pickup spawns
- Decorative elements

### Weapons

The weapon definitions in `backend/weapons.js` drive both server combat behavior and the HUD display. The game includes:

- Pistol for reliable basic shots
- SMG for fast automatic fire
- Shotgun for close-range burst damage
- Sniper for high-damage long-range shots
- Assault Rifle for balanced automatic fire
- RPG for explosive damage

Weapon pickups can replace the player’s current weapon when collected.

## Storage and Settings

I persist player preferences in `localStorage` so the app remembers them across sessions.

Stored values include:

- Username
- Control bindings
- Audio and visual settings

The settings helpers live in `src/config.js` and are used by the menu and input systems.

## How to Run the Project

### Frontend Development

From the repository root:

```bash
npm install
npm run dev
```

This starts the Vite dev server on port 5173.

### Backend Server

From the backend folder:

```bash
cd backend
npm install
npm start
```

The backend listens on port 3000 by default.

### Full Local Setup

For the standard local workflow, I run the frontend and backend in separate terminals:

```bash
npm install
cd backend
npm install
cd ..
npm run dev
cd backend
npm start
```

### Production Build

```bash
npm run build
cd backend
npm start
```

The backend serves the built frontend from `dist/` when it is available.

## Notes and Current Limitations

I documented the project as it exists now, which means a few important implementation details are worth calling out:

- The game loop runs at 60 ticks per second, not 20.
- The project already includes rooms, matchmaking, combat, weapons, projectiles, grenades, gas, respawning, and a scoreboard.
- The backend uses plain JavaScript rather than TypeScript.
- Some of the game behavior is intentionally server-led, so the client only predicts part of the movement locally.
- The server currently trusts incoming input events and does not add explicit rate limiting.

If I keep expanding this project, the most natural next steps are better anti-abuse checks, more map content, more polished UI transitions, and a formal deployment guide.

