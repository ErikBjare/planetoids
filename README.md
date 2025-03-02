# Mini Solar System Explorer

A 3D space exploration game built with Three.js and TypeScript where players navigate a procedurally-featured miniature solar system, collect discovery points, and upgrade their equipment.

![Game Screenshot](screenshot.png)

## Overview

Mini Solar System Explorer is a web-based 3D game where players begin on a small home planetoid equipped with a basic jetpack. The goal is to explore a solar system of 5 unique planets, discover new environments, and upgrade your equipment to reach increasingly distant worlds.

## Features

- **Immersive 3D Solar System**: 5 unique planets with their own characteristics and features
- **Realistic Physics**: Gravity and orbital mechanics simulation
- **Exploration-based Gameplay**: Discover new planets to earn points
- **Upgrade System**: Improve your jetpack, thrusters, and other equipment
- **First-person Controls**: Familiar WASD movement with jetpack capabilities

## Technical Details

- Built with Three.js for 3D rendering
- Written in TypeScript for better code organization and type safety
- Uses Vite as the build system for fast development and optimized production builds
- Uses ES modules for clean code organization
- Foundation for WebSocket-based multiplayer
- Fully client-side with no backend dependencies

## Installation and Running

### Prerequisites
- Node.js 16+ and npm 
- A modern web browser with WebGL support

### Setup
```bash
# Clone the repository
git clone https://github.com/yourusername/mini-solar-system-explorer.git
cd mini-solar-system-explorer

# Install dependencies
npm install
```

### Development
```bash
# Start the Vite development server
npm run dev
```

### Production Build
```bash
# Build for production
npm run build

# Preview the production build
npm run preview
```

## Game Controls

- **W, A, S, D**: Move forward, left, backward, right
- **Mouse**: Look around
- **Space**: Jump when on planet surface
- **Hold Space**: Activate jetpack/thrusters
- **E**: Interact with upgrade stations
- **Tab**: Toggle upgrade menu
- **Mouse Wheel**: Switch camera mode

## Gameplay

1. Start on your home planet with a house, trees, mountains, and a pond
2. Collect discovery points by exploring planets
3. Find upgrade stations to improve your equipment
4. Use upgrades to reach more distant planets
5. Manage your fuel and navigate using orbital mechanics
6. Complete the game by visiting all five planets

## Planet Types

1. **Home**: Green planet with a house, trees, mountain ridge, and pond
2. **Rocky**: Smaller planet with rock formations and a research station
3. **Icy**: Large blue planet with ice formations and a frozen lake
4. **Desert**: Sandy planet with dunes, cacti, and an oasis
5. **Mysterious**: Purple alien planet with strange structures and crystals

## Project Structure

```bash
├── src                 # Source code
│   ├── types.ts        # TypeScript interfaces and type definitions
│   ├── main.ts         # Game initialization and main loop
│   ├── world.ts        # Solar system generation and game objects
│   ├── physics.ts      # Physics simulation and planet gravity
│   ├── planets.ts      # Planet generation and features
│   ├── player.ts       # Player controller and movement
│   ├── celestial.ts    # Sun, stars, and space objects
│   └── ui.ts           # User interface and HUD elements
├── public              # Static assets
│   └── screenshot.png  # Game screenshot
├── index.html          # HTML entry point
├── vite.config.ts      # Vite configuration
├── tsconfig.json       # TypeScript configuration
└── package.json        # Project dependencies
```

## Future Development Tasks

### Core Gameplay
- [ ] Add player model visible when looking down
- [ ] Implement resource collection mechanics
- [ ] Add more interactive objects on planets
- [ ] Create mission system with objectives
- [ ] Add space hazards (meteoroids, radiation zones)

### Visual Improvements
- [ ] Add atmospheric effects for planets
- [ ] Implement day/night cycle
  - Partially completed, needs refinement
- [ ] Add particle effects for jetpack
- [ ] Improve planet textures with normal maps
- [x] Add skybox with distant stars

### UI/UX
- [ ] Create proper upgrade UI instead of alerts
- [ ] Add minimap or navigation compass
- [ ] Implement tutorial system for new players
- [ ] Add settings menu for controls and graphics
- [ ] Create pause menu

### Technical Enhancements
- [x] Migrate to TypeScript for better code organization
- [x] Implement Vite build system for faster development
- [ ] Optimize planet geometry for better performance
- [ ] Implement level of detail (LOD) for distant objects
- [ ] Add object pooling for particle effects
- [ ] Support for mobile devices with touch controls
- [ ] Save game progress to localStorage

### Multiplayer Features
- [ ] Complete WebSocket implementation
- [ ] Add player representation for other players
- [ ] Implement basic chat system
- [ ] Add cooperative missions
- [ ] Create competitive race or exploration modes

### Audio
- [ ] Add ambient background music
- [ ] Implement sound effects for jetpack, collisions, etc.
- [ ] Create unique ambient sounds for each planet
- [ ] Add UI sound feedback

### Content Expansion
- [ ] Gas station on home planet for refueling
- [ ] Orbital space station (researchable) for upgrades and missions, and refueling
- [ ] Add more planets with unique features
- [ ] Create space stations orbiting planets
- [ ] Implement alien NPCs with simple interactions
- [ ] Add collectible artifacts on each planet
- [ ] Create unique structures for each planet type

## Issues

- [ ] Player is not upright when landing on a planet, camera tries to adjust, but the player is still oriented "upwards" in global coordinates instead of the "local" planet surface normal
- [ ] Weird shadow/lighting "spots" on the home planet surface, that suddenly cut off

## License

[MIT License](LICENSE)

## Credits

Created by [Your Name]

Built with [Three.js](https://threejs.org/)