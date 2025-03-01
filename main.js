import * as THREE from 'three';
import { PointerLockControls } from 'three/addons/controls/PointerLockControls.js';
import { World } from './world.js';
import { Physics } from './physics.js';

// Main game engine
class Game {
    constructor() {
        // Three.js basics
        this.scene = new THREE.Scene();
        this.camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 10000);
        this.renderer = new THREE.WebGLRenderer({ antialias: true });
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.shadowMap.enabled = true;
        this.scene.background = new THREE.Color(0x000011); // Very dark blue background
        this.renderer.setClearColor(0x000011);
        document.body.appendChild(this.renderer.domElement);
        
        // Game state
        this.gameState = {
            discoveryPoints: 0,
            currentPlanet: 0,
            planetDiscovered: [true, false, false, false, false],
            upgradesAvailable: true,
            nearStation: false,
            inSpace: false,
            noclip: false
        };
        
        // Player state
        this.player = {
            position: new THREE.Vector3(150, 150, 150), // Start with a view of home planet and sun
            velocity: new THREE.Vector3(0, 0, 0),
            rotation: new THREE.Euler(0, 0, 0),
            onGround: false,
            fuel: 100,
            maxFuel: 100,
            fuelRechargeRate: 10, // per second
            lastPlanetVisited: 0
        };
        
        // Initialize physics
        this.physics = new Physics();
        
        // Controls
        this.controls = {
            moveForward: false,
            moveBackward: false,
            moveLeft: false,
            moveRight: false,
            jump: false,
            jetpack: false,
            pointerLocked: false
        };
        
        // Time tracking
        this.clock = new THREE.Clock();
        this.deltaTime = 0;
        
        // Initialize the world
        this.world = new World(this.scene);
        
        // Create Player "body" (just a camera for now)
        this.camera.position.copy(this.player.position);
        
        // Make the camera look toward the home planet initially
        this.camera.lookAt(new THREE.Vector3(0, 0, 0));
        
        // Setup everything else
        this.setupPointerLock();
        this.setupEventListeners();
        this.setupNetworking();
        
        // Start the game loop
        this.animate();
    }
    
    setupPointerLock() {
        // Setup pointer lock for mouse control
        this.pointerLockControls = new PointerLockControls(this.camera, document.body);
        
        document.addEventListener('click', () => {
            if (!this.controls.pointerLocked) {
                this.pointerLockControls.lock();
            }
        });
        
        this.pointerLockControls.addEventListener('lock', () => {
            this.controls.pointerLocked = true;
            document.getElementById('crosshair').style.display = 'block';
        });
        
        this.pointerLockControls.addEventListener('unlock', () => {
            this.controls.pointerLocked = false;
            document.getElementById('crosshair').style.display = 'none';
        });
    }
    
    setupEventListeners() {
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
    
    handleKeyDown(event) {
        switch (event.code) {
            case 'KeyW':
                this.controls.moveForward = true;
                break;
            case 'KeyS':
                this.controls.moveBackward = true;
                break;
            case 'KeyA':
                this.controls.moveLeft = true;
                break;
            case 'KeyD':
                this.controls.moveRight = true;
                break;
            case 'Space':
                if (!this.controls.jump && this.player.onGround) {
                    this.jump();
                }
                this.controls.jump = true;
                this.controls.jetpack = true;
                break;
            case 'KeyE':
                this.tryInteract();
                break;
            case 'KeyV':
                // Toggle noclip mode
                this.gameState.noclip = !this.gameState.noclip;
                console.log(`Noclip mode: ${this.gameState.noclip ? 'ON' : 'OFF'}`);
                
                // Show message on screen
                const message = document.createElement('div');
                message.textContent = `Noclip mode: ${this.gameState.noclip ? 'ON' : 'OFF'}`;
                message.style.position = 'absolute';
                message.style.top = '50%';
                message.style.left = '50%';
                message.style.transform = 'translate(-50%, -50%)';
                message.style.color = 'white';
                message.style.fontSize = '24px';
                message.style.fontWeight = 'bold';
                message.style.textShadow = '2px 2px 4px black';
                message.style.padding = '10px';
                message.style.pointerEvents = 'none';
                document.body.appendChild(message);
                
                // Remove message after 2 seconds
                setTimeout(() => {
                    document.body.removeChild(message);
                }, 2000);
                break;
            case 'Tab':
                this.toggleUpgradeMenu();
                break;
        }
    }
    
    handleKeyUp(event) {
        switch (event.code) {
            case 'KeyW':
                this.controls.moveForward = false;
                break;
            case 'KeyS':
                this.controls.moveBackward = false;
                break;
            case 'KeyA':
                this.controls.moveLeft = false;
                break;
            case 'KeyD':
                this.controls.moveRight = false;
                break;
            case 'Space':
                this.controls.jump = false;
                this.controls.jetpack = false;
                break;
        }
    }
    
    jump() {
        if (this.player.onGround) {
            this.player.velocity.y = this.physics.jumpForce;
            this.player.onGround = false;
        }
    }
    
    tryInteract() {
        // Check if near an upgrade station
        const playerPosition = this.camera.position.clone();
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
                alert(`You've discovered ${this.world.planets[stationPlanet].userData.name} planet! Gained ${100 * stationPlanet} discovery points.`);
            }
        }
    }
    
    toggleUpgradeMenu() {
        const upgradesMenu = document.getElementById('upgrades');
        upgradesMenu.classList.toggle('hidden');
    }
    
    showUpgrades(planetIndex) {
        // Show available upgrades for this planet
        const upgrades = {
            0: [
                { name: "Basic Scanner", cost: 50, effect: "Allows you to detect Rocky planet" },
                { name: "Improved Jetpack", cost: 100, effect: "Increases jetpack power by 20%" }
            ],
            1: [
                { name: "Improved Thrusters", cost: 200, effect: "Increases movement speed by 30%" },
                { name: "Fuel Efficiency", cost: 150, effect: "Reduces fuel consumption by 25%" }
            ],
            2: [
                { name: "Enhanced Fuel Capacity", cost: 300, effect: "Increases max fuel by 50%" },
                { name: "Advanced Propulsion", cost: 350, effect: "Improves maneuverability in space" }
            ],
            3: [
                { name: "Advanced Scanner", cost: 500, effect: "Detects resources from greater distances" },
                { name: "Gravitational Stabilizers", cost: 450, effect: "Reduces gravity effects by 30%" }
            ],
            4: [
                { name: "Warp Drive", cost: 1000, effect: "Allows instantaneous travel between planets" },
                { name: "Anti-Gravity Field", cost: 800, effect: "Negates gravity effects completely" }
            ]
        };
        
        // Just show an alert for now, in a real game this would be a proper UI
        const planetUpgrades = upgrades[planetIndex];
        let message = `Available upgrades on ${this.world.planets[planetIndex].userData.name} planet:\n\n`;
        
        planetUpgrades.forEach((upgrade, index) => {
            message += `${index + 1}. ${upgrade.name} (${upgrade.cost} points): ${upgrade.effect}\n`;
        });
        
        const choice = prompt(message + "\nEnter upgrade number to purchase (or cancel):");
        
        if (choice && !isNaN(choice)) {
            const upgradeIndex = parseInt(choice) - 1;
            if (upgradeIndex >= 0 && upgradeIndex < planetUpgrades.length) {
                const selectedUpgrade = planetUpgrades[upgradeIndex];
                
                if (this.gameState.discoveryPoints >= selectedUpgrade.cost) {
                    this.purchaseUpgrade(selectedUpgrade, planetIndex);
                } else {
                    alert("Not enough discovery points for this upgrade!");
                }
            }
        }
    }
    
    purchaseUpgrade(upgrade, planetIndex) {
        // Apply the upgrade effect
        this.gameState.discoveryPoints -= upgrade.cost;
        
        // Apply effects based on the upgrade
        switch (upgrade.name) {
            case "Basic Scanner":
                this.world.unlockPlanet(1); // Unlock Rocky planet
                break;
            case "Improved Jetpack":
                this.world.upgrades.jetpackPower *= 1.2;
                this.physics.jetpackForce *= 1.2;
                break;
            case "Improved Thrusters":
                this.physics.moveSpeed *= 1.3;
                break;
            case "Fuel Efficiency":
                // Reduce fuel consumption
                this.world.upgrades.jetpackRecharge *= 1.25;
                break;
            case "Enhanced Fuel Capacity":
                this.player.maxFuel *= 1.5;
                this.player.fuel = this.player.maxFuel;
                break;
            case "Advanced Propulsion":
                // Reduce space drag for better maneuverability
                this.physics.inSpaceDrag *= 0.7;
                break;
            case "Advanced Scanner":
                this.world.upgrades.scanRange *= 2;
                this.world.unlockPlanet(3); // Unlock Desert planet
                break;
            case "Gravitational Stabilizers":
                // Reduce gravity effects
                this.physics.gravity *= 0.7;
                break;
            case "Warp Drive":
                // Would implement warp function here
                alert("Warp drive installed! You can now travel between any discovered planets instantly.");
                break;
            case "Anti-Gravity Field":
                this.physics.gravity *= 0.1; // Almost no gravity
                break;
        }
        
        alert(`Purchased: ${upgrade.name}!`);
        this.updateUI();
    }
    
    addDiscoveryPoints(points) {
        this.gameState.discoveryPoints += points;
        this.updateUI();
    }
    
    updateUI() {
        // Update UI elements
        document.getElementById('points').textContent = this.gameState.discoveryPoints;
        document.getElementById('fuel').textContent = Math.round(this.player.fuel);
        
        // Update current planet display
        const nearest = this.physics.getNearestPlanet(this.camera.position, this.world.planets);
        document.getElementById('planet').textContent = nearest.planet ? nearest.planet.userData.name : 'In Space';
        document.getElementById('altitude').textContent = Math.round(nearest.distance);
        
        // Update velocity display
        const speed = this.player.velocity.length();
        document.getElementById('velocity').textContent = Math.round(speed * 10) / 10;
    }
    
    setupNetworking() {
        // Simple stub for future WebSocket implementation
        this.networkReady = false;
        
        // In a real implementation, we would connect to a WebSocket server here
        // this.socket = new WebSocket('ws://your-game-server.com');
        // this.socket.onopen = () => { this.networkReady = true; };
        // etc.
        
        console.log("Network functionality would be initialized here");
    }
    
    updatePlayer() {
        // Sync player position with camera
        this.player.position.copy(this.camera.position);
        
        // Get all bodies that affect physics
        const allBodies = this.world.getAllCelestialBodies();
        
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
        
        // Update player state
        this.gameState.inSpace = physicsResults.environment.inSpace;
        
        // Sync camera position with player
        this.camera.position.copy(this.player.position);
        
        // Recharge fuel when not using jetpack and in atmosphere
        if (!this.controls.jetpack && !this.gameState.inSpace) {
            this.player.fuel += this.world.upgrades.jetpackRecharge * this.deltaTime;
            if (this.player.fuel > this.player.maxFuel) this.player.fuel = this.player.maxFuel;
        }
        
        // Check for discovery on new planets
        this.checkPlanetDiscovery(physicsResults);
        
        // Update UI
        this.updateUI();
    }
    
    checkPlanetDiscovery(physicsResults) {
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
                
                alert(`You've landed on ${planet.userData.name} planet! +${points} discovery points.`);
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
    
    animate() {
        requestAnimationFrame(() => this.animate());
        
        // Calculate delta time
        this.deltaTime = Math.min(0.1, this.clock.getDelta()); // Cap at 0.1 to prevent huge jumps
        
        // Update planets
        this.world.updatePlanets(this.deltaTime);
        
        // Update player position, physics, etc.
        this.updatePlayer();
        
        // Render the scene
        this.renderer.render(this.scene, this.camera);
    }
}

// Initialize the game when the document is loaded
window.addEventListener('load', () => {
    const game = new Game();
});
