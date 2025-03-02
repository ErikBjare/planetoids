import * as THREE from 'three';
import { PlanetFactory } from './planets';
import { CelestialFactory } from './celestial';
import { GameObject, UpgradeLevels } from './types';

// Factory function to create a game object
function createGameObject(params: Partial<GameObject> = {}): GameObject {
    return {
        id: params.id || `obj_${Math.floor(Math.random() * 100000)}`,
        type: params.type || 'generic',
        mesh: params.mesh || null,
        position: params.position || new THREE.Vector3(),
        rotation: params.rotation || new THREE.Euler(),
        scale: params.scale || new THREE.Vector3(1, 1, 1),
        parent: params.parent || null,
        children: params.children || [],
        userData: params.userData || {},
        interactable: params.interactable || false,
        interactionDistance: params.interactionDistance || 10,
        onInteract: params.onInteract || (() => console.log('Interaction not implemented')),
        update: params.update || (() => {}),

        // Method to add this object to a scene or parent
        addToScene: function(scene: THREE.Scene | THREE.Object3D): GameObject {
            if (this.mesh) {
                scene.add(this.mesh);

                // Position, rotate, and scale the mesh
                this.mesh.position.copy(this.position);
                this.mesh.rotation.copy(this.rotation);
                this.mesh.scale.copy(this.scale);

                // Add userData to the mesh
                Object.assign(this.mesh.userData, this.userData);
                this.mesh.userData.gameObjectId = this.id;
                this.mesh.userData.interactable = this.interactable;

                // Add children
                this.children.forEach(child => {
                    if (child.addToScene && this.mesh) {
                        child.parent = this;
                        child.addToScene(this.mesh);
                    }
                });
            }
            return this;
        }
    };
}

export class World {
    scene: THREE.Scene;
    planets: THREE.Mesh[];
    sun: THREE.Mesh | null;
    starfield: THREE.Points | null;
    nebula: THREE.Points | null;
    asteroidBelt: THREE.Group | null;
    unlocked: boolean[];
    upgrades: UpgradeLevels;
    gameObjects: Record<string, GameObject>;
    planetFactory: PlanetFactory;
    celestialFactory: CelestialFactory;

    constructor(scene: THREE.Scene) {
        this.scene = scene;
        this.planets = [];
        this.sun = null;
        this.starfield = null;
        this.nebula = null;
        this.asteroidBelt = null;
        this.unlocked = [true, false, false, false, false]; // Home planet is unlocked by default
        this.upgrades = {
            jetpackPower: 10,
            jetpackFuel: 100,
            jetpackRecharge: 0.5,
            rocketThrust: 1,
            scanRange: 500
        };

        // Game objects registry
        this.gameObjects = {};

        // Create factories
        this.planetFactory = new PlanetFactory();
        this.celestialFactory = new CelestialFactory();

        // Create solar system
        this.createSolarSystem();
    }

    // Helper function to get the base atmosphere color for a planet
    getBaseAtmosphereColor(planet: THREE.Mesh | null): THREE.Color {
        // Determine atmosphere color based on planet type
        if (!planet || !planet.userData) {
            return new THREE.Color(0x4f99e8); // Default blue if no planet data
        }

        // Use the planet's features to determine the appropriate atmosphere color
        const features = planet.userData.features || [];

        if (features.includes('home')) {
            return new THREE.Color(0x4f99e8); // Earth-like blue
        } else if (features.includes('icy')) {
            return new THREE.Color(0xc0e8ff); // Light blue for icy
        } else if (features.includes('desert')) {
            return new THREE.Color(0xe8c090); // Tan/orange for desert
        } else if (features.includes('mysterious')) {
            return new THREE.Color(0x8060a0); // Purple for mysterious
        } else if (features.includes('rocky')) {
            return new THREE.Color(0xa0a0a0); // Gray for rocky
        } else {
            return new THREE.Color(0x4f99e8); // Default blue
        }
    }

    // Register a game object for easy lookup
    registerGameObject(gameObject: GameObject): GameObject {
        if (gameObject && gameObject.id) {
            this.gameObjects[gameObject.id] = gameObject;
        }
        return gameObject;
    }

    // Find a game object by ID
    getGameObject(id: string): GameObject | null {
        return this.gameObjects[id] || null;
    }

    // Find game objects by type
    getGameObjectsByType(type: string): GameObject[] {
        return Object.values(this.gameObjects).filter(obj => obj.type === type);
    }

    // Create a standard game object and register it
    createObject(params: Partial<GameObject>): GameObject {
        const gameObject = createGameObject(params);
        this.registerGameObject(gameObject);
        return gameObject;
    }

    createSolarSystem(): void {
        // Create sun
        this.sun = this.celestialFactory.createSun(this.scene);

        // Create stars in the background
        this.starfield = this.celestialFactory.createStarfield(this.scene);

        // Create distant nebula
        this.nebula = this.celestialFactory.createNebula(this.scene);

        // Create planets
        this.planets = this.planetFactory.createPlanets(this.scene);

        // Create asteroid belt between planets
        this.asteroidBelt = this.celestialFactory.createAsteroidBelt(
            this.scene,
            750, // inner radius between icy and desert planets
            1000 // outer radius
        );

        // Register all planets as game objects for interaction
        this.planets.forEach(planet => {
            const planetObject = this.createObject({
                id: `planet_${planet.userData.name}`,
                type: 'planet',
                mesh: planet,
                userData: planet.userData,
                interactable: false
            });

            // Find and register all upgrade stations on this planet
            planet.children.forEach(child => {
                if (child.userData && child.userData.type === 'upgradeStation') {
                    const stationObject = this.createObject({
                        id: `upgrade_station_${planet.userData.name}`,
                        type: 'upgradeStation',
                        mesh: child as THREE.Mesh | THREE.Group,
                        parent: planetObject,
                        userData: {
                            planetIndex: planet.userData.index,
                            planetName: planet.userData.name
                        },
                        interactable: true,
                        interactionDistance: 20,
                        onInteract: (game) => {
                            console.log(`Interacting with station on ${planet.userData.name}`);
                            // This would be called by the game when interaction occurs
                        }
                    });
                }
            });
        });
    }

    updatePlanets(deltaTime: number): void {
        // Get player position if available
        const playerPosition = window.game?.player?.position;

        // Update planet positions and rotations
        this.planets.forEach(planet => {
            // Update orbital position
            planet.userData.orbitalAngle += planet.userData.orbitSpeed * deltaTime;
            const distance = planet.userData.distance;
            planet.position.x = Math.cos(planet.userData.orbitalAngle) * distance;
            planet.position.z = Math.sin(planet.userData.orbitalAngle) * distance;

            // Rotate the planet
            planet.rotation.y += planet.userData.rotationSpeed * deltaTime;

            // Update day/night cycle with player position
            this.updateDayNightCycle(planet, deltaTime, playerPosition);
        });

        // Update sun lighting (pass camera for better directional lighting)
        if (this.sun && this.celestialFactory.updateSun) {
            // Get the camera from main.js if available
            const camera = window.game?.camera;
            this.celestialFactory.updateSun(this.sun, deltaTime, camera);
        }

        // Update asteroid belt
        if (this.asteroidBelt) {
            this.celestialFactory.updateAsteroidBelt(this.asteroidBelt, deltaTime);
        }

        // Update any custom game objects
        Object.values(this.gameObjects).forEach(obj => {
            if (typeof obj.update === 'function') {
                obj.update(deltaTime, this);
            }
        });
    }

    // Handle day/night cycle for a planet
    updateDayNightCycle(planet: THREE.Mesh, deltaTime: number, playerPosition?: THREE.Vector3): void {
        // Skip if the planet doesn't have day/night cycle data
        if (!planet.userData.dayLength) return;

        // Update the planet's time of day
        planet.userData.dayTime += (planet.userData.rotationSpeed * deltaTime);
        // Keep within 0-2π range
        planet.userData.dayTime %= (Math.PI * 2);

        // Get the sun position relative to the planet
        const sunDirection = new THREE.Vector3();
        if (this.sun) {
            sunDirection.subVectors(this.sun.position, planet.position).normalize();
        } else {
            // Default sun direction if no sun exists
            sunDirection.set(1, 0, 0);
        }

        // Get the planet's current rotational position
        // This determines which side is facing the sun
        const planetForward = new THREE.Vector3(0, 0, 1);
        planetForward.applyQuaternion(planet.quaternion);

        // Dot product between planet forward and sun direction
        // 1 = noon (full sun), 0 = sunrise/sunset, -1 = midnight (full dark)
        const planetDayFactor = planetForward.dot(sunDirection);

        // Store the day factor for other uses (like UI)
        planet.userData.dayFactor = planetDayFactor;

        // Calculate day factor from player's perspective
        let playerDayFactor = planetDayFactor; // Default to planet's day factor

        if (playerPosition) {
            // Calculate if player is close enough to the planet to have a unique perspective
            const distanceToPlanet = playerPosition.distanceTo(planet.position);
            const planetGeometry = planet.geometry as THREE.SphereGeometry;
            const planetRadius = planetGeometry.parameters.radius;

            // If player is close to the planet, calculate custom day factor
            if (distanceToPlanet < planetRadius * 3) {
                // Vector from player to planet (gravity direction)
                const playerToPlanet = new THREE.Vector3()
                    .subVectors(planet.position, playerPosition)
                    .normalize();

                // Vector from player to sun
                const playerToSun = new THREE.Vector3()
                    .subVectors(this.sun?.position || new THREE.Vector3(1000, 0, 0), playerPosition)
                    .normalize();

                // The "up" vector for the player is opposite the gravity direction
                const playerUp = playerToPlanet.clone().negate();

                // Calculate dot product between player's "up" and sun direction
                // This tells us if it's day or night from the player's position
                playerDayFactor = playerUp.dot(playerToSun);
            }
        }

        // Update atmosphere visibility and glow based on day/night from player's perspective
        planet.children.forEach(child => {
            // Handle atmosphere
            if (child.userData?.isAtmosphere) {
                // Make atmosphere more visible at sunset/sunrise
                const atmosphereOpacity = 0.3 + Math.max(0, 0.4 * (1 - Math.abs(playerDayFactor)));

                // Change atmosphere color based on time of day from player's perspective
                const childMesh = child as THREE.Mesh;
                const material = childMesh.material as THREE.ShaderMaterial;
                if (material && material.uniforms) {
                    // Adjust glow intensity
                    const uniforms = material.uniforms;

                    // Determine the appropriate atmosphere color based on time of day
                    if (playerDayFactor > -0.3 && playerDayFactor < 0.3) {
                        // Sunrise/sunset - shift toward orange/red
                        const baseColor = this.getBaseAtmosphereColor(planet);
                        const sunsetColor = new THREE.Color(0xff7730);
                        const blendFactor = 1 - Math.abs(playerDayFactor / 0.3);

                        // Create a new color for the blend
                        const blendedColor = baseColor.clone().lerp(sunsetColor, blendFactor * 0.7);
                        uniforms.atmosphereColor.value = blendedColor;
                    } else if (playerDayFactor >= 0.3) {
                        // Full daylight - reset to the original atmosphere color
                        uniforms.atmosphereColor.value = this.getBaseAtmosphereColor(planet);
                    } else {
                        // Night - slightly darker version of the base color
                        const nightColor = this.getBaseAtmosphereColor(planet).clone().multiplyScalar(0.7);
                        uniforms.atmosphereColor.value = nightColor;
                    }
                }
            }

            // Handle night lights - using player's perspective for better immersion
            if (child.userData?.isNightLights) {
                // Check if it's night time from the player's perspective
                const isNightVisible = playerDayFactor < 0.3; // Lights start to appear at dusk

                // Show lights at night, with increasing intensity as it gets darker
                child.visible = isNightVisible;

                const childMesh = child as THREE.Mesh;
                if (isNightVisible && childMesh.material) {
                    // Adjust opacity based on how dark it is from the player's perspective
                    // Fully visible at night, fading during dusk/dawn
                    const opacity = Math.min(1, (0.3 - playerDayFactor) * 3);
                    (childMesh.material as THREE.Material).opacity = opacity * 0.9;
                }

                // Always rotate lights with the planet
                child.rotation.copy(planet.rotation);
            }
        });

        // Update material properties based on the general planet day/night cycle
        // (not player specific, as this affects the whole planet)
        const planetMesh = planet as THREE.Mesh;
        if (planetMesh.material) {
            // Adjust emissive intensity based on day/night
            // Slightly more self-illumination at night for visibility
            const nightGlow = Math.max(0, -planetDayFactor * 0.05);
            (planetMesh.material as THREE.MeshStandardMaterial).emissiveIntensity = 0.1 + nightGlow;
        }
    }

    getNearestPlanet(position: THREE.Vector3): { planet: THREE.Mesh | null; distance: number } {
        let nearestPlanet: THREE.Mesh | null = null;
        let minDistance = Infinity;

        this.planets.forEach(planet => {
            const planetGeometry = planet.geometry as THREE.SphereGeometry;
            const distance = position.distanceTo(planet.position) - planetGeometry.parameters.radius;
            if (distance < minDistance) {
                minDistance = distance;
                nearestPlanet = planet;
            }
        });

        return { planet: nearestPlanet, distance: minDistance };
    }

    isUpgradeStationNearby(position: THREE.Vector3, range = 20): number {
        // Check if player is near an upgrade station
        for (const planet of this.planets) {
            // Only check unlocked planets
            if (!this.unlocked[planet.userData.index]) continue;

            // Find upgrade stations on this planet
            for (let i = 0; i < planet.children.length; i++) {
                const child = planet.children[i];
                if (child.userData && child.userData.type === 'upgradeStation') {
                    // Get world position of the station
                    const stationWorldPos = new THREE.Vector3();
                    child.getWorldPosition(stationWorldPos);

                    // Check distance
                    if (position.distanceTo(stationWorldPos) < range) {
                        return planet.userData.index;
                    }
                }
            }
        }

        return -1; // No station nearby
    }

    unlockPlanet(index: number): boolean {
        if (index >= 0 && index < this.unlocked.length) {
            this.unlocked[index] = true;
            return true;
        }
        return false;
    }

    getAllCelestialBodies(): THREE.Object3D[] {
        const bodies = [...this.planets];
        if (this.sun) bodies.push(this.sun);
        return bodies;
    }

    // Helper to import objects from external modules
    importGameObject(objectModule: any, params: Record<string, any> = {}): GameObject | null {
        if (typeof objectModule.create === 'function') {
            const object = objectModule.create(params);
            this.registerGameObject(object);
            return object;
        }
        console.error('Invalid game object module - missing create function');
        return null;
    }
}
