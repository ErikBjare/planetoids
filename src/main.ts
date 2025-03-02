import * as THREE from 'three';
import { World } from './world';
import { Physics } from './physics';
import { UI } from './ui';
import { PlayerController } from './player';
import { GameState, ControlsState, Upgrade } from './types';

// Main game engine
class Game {
    scene: THREE.Scene;
    camera: THREE.PerspectiveCamera;
    renderer: THREE.WebGLRenderer;
    gameState: GameState;
    ui: UI;
    physics: Physics;
    controls: ControlsState;
    clock: THREE.Clock;
    deltaTime: number;
    world: World;
    player: PlayerController;

    constructor() {
        // Three.js basics
        this.scene = new THREE.Scene();
        this.camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 10000);

        // Store reference to game and camera globally for other modules to access
        window.game = this;

        // Enhanced renderer with improved shadows
        this.renderer = new THREE.WebGLRenderer({
            antialias: true,
            powerPreference: 'high-performance'
        });
        this.renderer.setSize(window.innerWidth, window.innerHeight);

        // Enable and configure shadow mapping
        this.renderer.shadowMap.enabled = true;
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

        // Set background and configure pixel ratio for better quality
        this.renderer.setPixelRatio(window.devicePixelRatio);
        this.scene.background = new THREE.Color(0x000011); // Very dark blue background
        this.renderer.setClearColor(0x000011);

        // Add tone mapping for more realistic lighting
        this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
        this.renderer.toneMappingExposure = 1.2;

        document.body.appendChild(this.renderer.domElement);

        // Game state
        this.gameState = {
            discoveryPoints: 0,
            currentPlanet: 0,
            planetDiscovered: [true, false, false, false, false],
            upgradesAvailable: true,
            nearStation: false,
            inSpace: false,
            noclip: false,
            nearInteractable: false,
            currentInteractable: null
        };

        // Create UI system
        this.ui = new UI(this);

        // Initialize physics
        this.physics = new Physics();

        // Controls state
        this.controls = {
            moveForward: false,
            moveBackward: false,
            moveLeft: false,
            moveRight: false,
            jump: false,
            jetpack: false,
            sprint: false,
            downThrusters: false // New control for downward movement
        };

        // Time tracking
        this.clock = new THREE.Clock();
        this.deltaTime = 0;

        // Initialize the world
        this.world = new World(this.scene);

        // Setup player
        this.player = new PlayerController(this.scene, this.camera, this.ui);

        // Make the camera look toward the home planet initially
        this.camera.lookAt(new THREE.Vector3(0, 0, 0));

        // Setup event listeners
        this.setupEventListeners();
        this.setupNetworking();

        // Start the game loop
        this.animate();
    }

    setupEventListeners(): void {
        // Keyboard controls
        document.addEventListener('keydown', (event) => {
            this.handleKeyDown(event);
        });

        document.addEventListener('keyup', (event) => {
            this.handleKeyUp(event);
        });

        // Window resize
        window.addEventListener('resize', () => {
            this.camera.aspect = window.innerWidth / window.innerHeight;
            this.camera.updateProjectionMatrix();
            this.renderer.setSize(window.innerWidth, window.innerHeight);
        });
    }

    handleKeyDown(event: KeyboardEvent): void {
        switch (event.code) {
        case 'KeyW':
            this.controls.moveForward = true;
            this.player.moveForward = true;
            break;
        case 'KeyS':
            this.controls.moveBackward = true;
            this.player.moveBackward = true;
            break;
        case 'KeyA':
            this.controls.moveLeft = true;
            this.player.moveLeft = true;
            break;
        case 'KeyD':
            this.controls.moveRight = true;
            this.player.moveRight = true;
            break;
        case 'ShiftLeft':
        case 'ShiftRight':
            if (this.player.onGround) {
                // On ground: shift is sprint
                this.controls.sprint = true;
                this.player.isSprinting = true;
            } else {
                // In air/space: shift is down thrusters
                this.controls.downThrusters = true;
                this.player.setDownThrustersActive(true);
            }
            break;
        case 'Space':
            if (!this.controls.jump && this.player.onGround) {
                this.jump();
            }
            this.controls.jump = true;
            this.controls.jetpack = true;
            this.player.setJetpackActive(true);
            break;
        case 'KeyE':
            this.tryInteract();
            break;
        case 'KeyV':
            // Toggle noclip mode
            this.gameState.noclip = !this.gameState.noclip;
            this.player.noclip = this.gameState.noclip; // Sync with player
            this.ui.showMessage(`Noclip mode: ${this.gameState.noclip ? 'ON' : 'OFF'}`);
            break;
        case 'Tab':
            this.toggleUpgradeMenu();
            break;
        case 'KeyC':
            // Manual camera mode toggle
            this.cycleCameraMode();
            break;
        }
    }

    handleKeyUp(event: KeyboardEvent): void {
        switch (event.code) {
        case 'KeyW':
            this.controls.moveForward = false;
            this.player.moveForward = false;
            break;
        case 'KeyS':
            this.controls.moveBackward = false;
            this.player.moveBackward = false;
            break;
        case 'KeyA':
            this.controls.moveLeft = false;
            this.player.moveLeft = false;
            break;
        case 'KeyD':
            this.controls.moveRight = false;
            this.player.moveRight = false;
            break;
        case 'ShiftLeft':
        case 'ShiftRight':
            this.controls.sprint = false;
            this.player.isSprinting = false;
            this.controls.downThrusters = false;
            this.player.setDownThrustersActive(false);
            break;
        case 'Space':
            this.controls.jump = false;
            this.controls.jetpack = false;
            this.player.setJetpackActive(false);
            break;
        }
    }

    cycleCameraMode(): void {
        // Cycle between camera modes: first-person -> third-person -> scope -> first-person
        const currentMode = this.player.cameraMode;
        let nextMode;

        switch (currentMode) {
        case 'firstPerson':
            nextMode = 'thirdPerson';
            break;
        case 'thirdPerson':
            nextMode = 'scope';
            break;
        case 'scope':
            nextMode = 'firstPerson';
            break;
        default:
            nextMode = 'firstPerson';
        }

        this.player.setCameraMode(nextMode);
        this.ui.showMessage(`Camera mode: ${nextMode}`);
    }

    jump(): void {
        if (this.player.onGround) {
            // Get the up direction based on planet alignment
            const upDir = this.physics.calculateUpDirection(this.player.position, this.world.planets);

            // Apply jump force in the "up" direction
            const jumpVector = upDir.multiplyScalar(this.physics.jumpForce);
            this.player.velocity.add(jumpVector);
            this.player.onGround = false;
        }
    }

    tryInteract(): void {
        // Only interact if near an interactable object
        if (!this.gameState.nearInteractable) return;

        // Check if near an upgrade station
        const playerPosition = this.player.position.clone();
        const stationPlanet = this.world.isUpgradeStationNearby(playerPosition);

        if (stationPlanet >= 0) {
            // Near a station, show upgrade options based on planet
            console.log(`Interacting with upgrade station on planet ${stationPlanet}`);
            this.showUpgrades(stationPlanet);

            // Unlock the next planet if we're at a new one
            if (stationPlanet > 0 && !this.gameState.planetDiscovered[stationPlanet]) {
                this.gameState.planetDiscovered[stationPlanet] = true;
                const nextPlanet = (stationPlanet + 1) % this.world.planets.length;
                this.world.unlockPlanet(nextPlanet);

                // Reward discovery points
                this.addDiscoveryPoints(100 * stationPlanet);
                this.ui.showMessage(`You've discovered ${this.world.planets[stationPlanet].userData.name} planet! Gained ${100 * stationPlanet} discovery points.`, 4000);
            }
        }
    }

    toggleUpgradeMenu(): void {
        // We'll use our improved UI now
        // this.ui.toggleUpgradeMenu();
    }

    showUpgrades(planetIndex: number): void {
        // Show available upgrades for this planet
        const upgrades: Record<number, Upgrade[]> = {
            0: [
                { name: 'Basic Scanner', cost: 50, effect: 'Allows you to detect Rocky planet' },
                { name: 'Improved Jetpack', cost: 100, effect: 'Increases jetpack power by 20%' }
            ],
            1: [
                { name: 'Improved Thrusters', cost: 200, effect: 'Increases movement speed by 30%' },
                { name: 'Fuel Efficiency', cost: 150, effect: 'Reduces fuel consumption by 25%' }
            ],
            2: [
                { name: 'Enhanced Fuel Capacity', cost: 300, effect: 'Increases max fuel by 50%' },
                { name: 'Advanced Propulsion', cost: 350, effect: 'Improves maneuverability in space' }
            ],
            3: [
                { name: 'Advanced Scanner', cost: 500, effect: 'Detects resources from greater distances' },
                { name: 'Gravitational Stabilizers', cost: 450, effect: 'Reduces gravity effects by 30%' }
            ],
            4: [
                { name: 'Warp Drive', cost: 1000, effect: 'Allows instantaneous travel between planets' },
                { name: 'Anti-Gravity Field', cost: 800, effect: 'Negates gravity effects completely' }
            ]
        };

        // Use our new UI system to show the upgrade menu
        this.ui.showUpgradeMenu(
            planetIndex,
            upgrades[planetIndex],
            this.gameState.discoveryPoints,
            (upgrade, planetIndex) => this.purchaseUpgrade(upgrade, planetIndex)
        );
    }

    purchaseUpgrade(upgrade: Upgrade, planetIndex: number): void {
        // Apply the upgrade effect
        this.gameState.discoveryPoints -= upgrade.cost;

        // Apply effects based on the upgrade
        switch (upgrade.name) {
        case 'Basic Scanner':
            this.world.unlockPlanet(1); // Unlock Rocky planet
            break;
        case 'Improved Jetpack':
            this.world.upgrades.jetpackPower *= 1.2;
            this.physics.jetpackForce *= 1.2;
            break;
        case 'Improved Thrusters':
            this.physics.moveSpeed *= 1.3;
            break;
        case 'Fuel Efficiency':
            // Reduce fuel consumption
            this.world.upgrades.jetpackRecharge *= 1.25;
            break;
        case 'Enhanced Fuel Capacity':
            this.player.maxFuel *= 1.5;
            this.player.fuel = this.player.maxFuel;
            break;
        case 'Advanced Propulsion':
            // Reduce space drag for better maneuverability
            this.physics.inSpaceDrag *= 0.7;
            break;
        case 'Advanced Scanner':
            this.world.upgrades.scanRange *= 2;
            this.world.unlockPlanet(3); // Unlock Desert planet
            break;
        case 'Gravitational Stabilizers':
            // Reduce gravity effects
            this.physics.gravity *= 0.7;
            break;
        case 'Warp Drive':
            // Would implement warp function here
            this.ui.showMessage('Warp drive installed! You can now travel between any discovered planets instantly.');
            break;
        case 'Anti-Gravity Field':
            this.physics.gravity *= 0.1; // Almost no gravity
            break;
        }

        this.ui.showMessage(`Purchased: ${upgrade.name}!`);
        this.updateUI();
    }

    addDiscoveryPoints(points: number): void {
        this.gameState.discoveryPoints += points;
        this.updateUI();
    }

    updateUI(): void {
        // Update UI with current stats
        const nearest = this.physics.getNearestPlanet(this.player.position, this.world.planets);

        // Get time of day info based on player position relative to sun
        let timeOfDay = 'Space';
        let dayNightFactor = 0.5;
        let timeIcon = '🌠';

        if (nearest.planet && nearest.distance < 500) {
            // Calculate time based on player position relative to sun
            // Get vectors from player to sun and player to planet
            const sunDirection = new THREE.Vector3().subVectors(this.world.sun?.position || new THREE.Vector3(), this.player.position).normalize();
            const planetDirection = new THREE.Vector3().subVectors(nearest.planet.position, this.player.position).normalize();

            // The "up" vector for the player relative to the planet is opposite to planet direction
            const upVector = planetDirection.clone().negate();

            // Calculate dot product: 1 = noon (sun directly overhead), -1 = midnight (sun directly below)
            dayNightFactor = upVector.dot(sunDirection);

            // Determine time of day text and icon based on player's position
            if (dayNightFactor > 0.6) {
                timeOfDay = 'Day';
                timeIcon = '☀️';
            } else if (dayNightFactor > 0.2) {
                timeOfDay = 'Evening';
                timeIcon = '🌇';
            } else if (dayNightFactor > -0.2) {
                timeOfDay = 'Sunset';
                timeIcon = '🌆';
            } else if (dayNightFactor > -0.6) {
                timeOfDay = 'Dusk';
                timeIcon = '🌃';
            } else {
                timeOfDay = 'Night';
                timeIcon = '🌙';
            }
        }

        // Get the player's orientation vectors
        let bodyUpDirection: THREE.Vector3;
        let lookDirection: THREE.Vector3;

        if (this.player) {
            // Get body up direction (from body quaternion)
            bodyUpDirection = new THREE.Vector3(0, 1, 0)
                .applyQuaternion(this.player.bodyQuaternion);

            // Get look direction (from combined body+head orientation)
            lookDirection = new THREE.Vector3(0, 0, -1)
                .applyQuaternion(this.player.getCombinedQuaternion());
        } else {
            // Default values if player not available
            bodyUpDirection = new THREE.Vector3(0, 1, 0);
            lookDirection = new THREE.Vector3(0, 0, -1);
        }

        this.ui.updateStats({
            points: this.gameState.discoveryPoints,
            planetName: nearest.planet ? nearest.planet.userData.name : 'In Space',
            altitude: nearest.distance,
            velocity: this.player.velocity.length(),
            fuel: this.player.fuel,
            stamina: this.player.stamina,
            maxStamina: this.player.maxStamina,
            timeOfDay: timeOfDay,
            timeIcon: timeIcon,
            dayNightProgress: (dayNightFactor + 1) / 2, // Convert from -1,1 to 0,1 range
            bodyUpDirection: bodyUpDirection,
            lookDirection: lookDirection,
            zone: this.gameState.currentAtmosphereZone // Add zone information
        });
    }

    checkForInteractables(): void {
        // Distance to check for interactables
        const interactionDistance = 20;
        let nearestInteractable = null;
        let minDistance = interactionDistance;

        // First check upgrade stations
        const playerPosition = this.player.position.clone();
        const stationPlanet = this.world.isUpgradeStationNearby(playerPosition, interactionDistance);

        if (stationPlanet >= 0) {
            nearestInteractable = {
                type: 'upgradeStation',
                planetIndex: stationPlanet,
                distance: minDistance // We don't have exact distance, but it's within range
            };

            // Update game state for interaction
            this.gameState.nearInteractable = true;
            this.gameState.currentInteractable = nearestInteractable;

            // Show interaction prompt
            this.ui.setInteractionPrompt(true);
            return;
        }

        // No interactables found
        this.gameState.nearInteractable = false;
        this.gameState.currentInteractable = null;
        this.ui.setInteractionPrompt(false);
    }

    setupNetworking(): void {
        // Simple stub for future WebSocket implementation
        console.log('Network functionality would be initialized here');
    }

    updatePlayer(): void {
        // Update player physics using the Physics class
        const physicsResults = this.physics.updatePlayerPhysics(
            this.player,
            this.controls,
            this.deltaTime,
            this.world.planets,
            this.world.sun,
            this.camera,
            this.gameState
        );

        // Update game state
        this.gameState.inSpace = physicsResults.environment.inSpace;
        this.gameState.currentAtmosphereZone = physicsResults.environment.atmosphereZone;

        // Update player model rotation based on planet alignment
        if (physicsResults.alignment && physicsResults.alignment.upDirection) {
            // Pass alignment information to the player to align body with planet surface
            this.player.alignWithSurface(
                physicsResults.alignment.upDirection,
                this.deltaTime,
                this.physics.alignmentSpeed
            );

            // Force camera update with the latest orientations
            this.player.updateCamera(this.deltaTime);
        }

        // Update player controller
        this.player.update(this.deltaTime, this.physics, this.world.planets);

        // Recharge fuel when not using jetpack and in atmosphere
        if (!this.controls.jetpack && !this.gameState.inSpace) {
            this.player.fuel += this.world.upgrades.jetpackRecharge * this.deltaTime;
            if (this.player.fuel > this.player.maxFuel) this.player.fuel = this.player.maxFuel;
        }

        // Check for discovery on new planets
        this.checkPlanetDiscovery(physicsResults);

        // Check for interactable objects
        this.checkForInteractables();

        // Update UI
        this.updateUI();
    }

    checkPlanetDiscovery(physicsResults: any): void {
        // Check if we've landed on a planet
        if (physicsResults.collision && physicsResults.collision.collidedPlanet) {
            const planet = physicsResults.collision.collidedPlanet;

            // Check for discovery points when landing
            if (!this.gameState.planetDiscovered[planet.userData.index] &&
                this.world.unlocked[planet.userData.index]) {

                this.gameState.planetDiscovered[planet.userData.index] = true;
                // Give discovery points based on planet index (farther = more points)
                const points = 50 * (planet.userData.index + 1);
                this.addDiscoveryPoints(points);

                this.ui.showMessage(`You've landed on ${planet.userData.name} planet! +${points} discovery points.`, 4000);
            }

            // Update last visited planet
            this.player.lastPlanetVisited = planet.userData.index;
        }

        // If we're near a planet that we haven't fully discovered yet
        const nearestData = physicsResults.environment.nearest;
        if (nearestData.planet &&
            this.world.unlocked[nearestData.planet.userData.index] &&
            nearestData.distance < 50 &&
            this.player.lastPlanetVisited !== nearestData.planet.userData.index) {

            // Add some discovery points for exploring a new area
            this.addDiscoveryPoints(10);
        }
    }

    animate(): void {
        requestAnimationFrame(() => this.animate());

        // Calculate delta time
        this.deltaTime = Math.min(0.1, this.clock.getDelta()); // Cap at 0.1 to prevent huge jumps

        // Update planets
        this.world.updatePlanets(this.deltaTime);

        // Update player position, physics, etc.
        this.updatePlayer();

        // Ensure camera has correct final orientation from our system
        // This is important - ensures our orientation code has final authority
        if (this.player && typeof this.player.updateCamera === 'function') {
            this.player.updateCamera(this.deltaTime);
        }

        // Render the scene
        this.renderer.render(this.scene, this.camera);
    }
}

// Initialize the game when the document is loaded
window.addEventListener('load', () => {
    const game = new Game();
    window.game = game;
});
