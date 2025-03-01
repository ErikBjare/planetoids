import * as THREE from 'three';
import { PlanetFactory } from './planets.js';
import { CelestialFactory } from './celestial.js';

export class World {
    constructor(scene) {
        this.scene = scene;
        this.planets = [];
        this.sun = null;
        this.unlocked = [true, false, false, false, false]; // Home planet is unlocked by default
        this.upgrades = {
            jetpackPower: 1,
            jetpackFuel: 100,
            jetpackRecharge: 0.5,
            rocketThrust: 1,
            scanRange: 500
        };
        
        // Create factories
        this.planetFactory = new PlanetFactory();
        this.celestialFactory = new CelestialFactory();
        
        // Create solar system
        this.createSolarSystem();
    }

    createSolarSystem() {
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
    }

    updatePlanets(deltaTime) {
        // Update planet positions and rotations
        this.planets.forEach(planet => {
            // Update orbital position
            planet.userData.orbitalAngle += planet.userData.orbitSpeed * deltaTime;
            const distance = planet.userData.distance;
            planet.position.x = Math.cos(planet.userData.orbitalAngle) * distance;
            planet.position.z = Math.sin(planet.userData.orbitalAngle) * distance;
            
            // Rotate the planet
            planet.rotation.y += planet.userData.rotationSpeed * deltaTime;
        });
        
        // Update asteroid belt
        this.celestialFactory.updateAsteroidBelt(this.asteroidBelt, deltaTime);
    }

    getNearestPlanet(position) {
        let nearestPlanet = null;
        let minDistance = Infinity;
        
        this.planets.forEach(planet => {
            const distance = position.distanceTo(planet.position) - planet.geometry.parameters.radius;
            if (distance < minDistance) {
                minDistance = distance;
                nearestPlanet = planet;
            }
        });
        
        return { planet: nearestPlanet, distance: minDistance };
    }

    isUpgradeStationNearby(position, range = 20) {
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

    unlockPlanet(index) {
        if (index >= 0 && index < this.unlocked.length) {
            this.unlocked[index] = true;
            return true;
        }
        return false;
    }

    getAllCelestialBodies() {
        const bodies = [...this.planets];
        if (this.sun) bodies.push(this.sun);
        return bodies;
    }
}
