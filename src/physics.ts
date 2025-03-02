import * as THREE from 'three';
import { PhysicsResult, EnvironmentResult, CollisionResult } from './types';

export class Physics {
    gravity: number;
    jumpForce: number;
    moveSpeed: number;
    jetpackForce: number;
    dragCoefficient: number;
    inSpaceDrag: number;
    inAtmosphereDrag: number;
    collisionRadius: number;
    gravitationalConstant: number;
    alignmentSpeed: number;
    alignmentDistance: number;
    atmosphereRatio: number;
    outerAtmosphereRatio: number;
    lastZone: string | null;
    zoneHysteresis: number;
    zoneSwitchDelay: number;

    constructor() {
        this.gravity = 9.8;
        this.jumpForce = 10;
        this.moveSpeed = 5;
        this.jetpackForce = 20;
        this.dragCoefficient = 0.1;
        this.inSpaceDrag = 0.001;
        this.inAtmosphereDrag = 0.01; // Reduced from 0.1 for more realistic momentum preservation
        this.collisionRadius = 2;
        this.gravitationalConstant = 100; // Reduced from 1000

        // Surface alignment properties
        this.alignmentSpeed = 0.05; // How quickly to align with surface
        this.alignmentDistance = 50; // When to start aligning with surface

        // Transition zone settings
        this.atmosphereRatio = 1.25; // Atmosphere extends 50% beyond planet radius
        this.outerAtmosphereRatio = 1.5; // Outer atmosphere for transition

        // Store last zone to prevent flickering
        this.lastZone = null;
        this.zoneHysteresis = 1.0; // Buffer to prevent zone flickering
        this.zoneSwitchDelay = 0; // Counter for zone switching delay
    }

    // Check if player is on ground or in space with more nuanced zones and hysteresis
    checkPlayerEnvironment(playerPosition: THREE.Vector3, planets: THREE.Mesh[]): EnvironmentResult {
        const nearest = this.getNearestPlanet(playerPosition, planets);

        if (!nearest.planet) return {
            inSpace: true,
            onGround: false,
            nearest,
            atmosphereZone: 'deep-space'
        };

        const planetRadius = (nearest.planet.geometry as THREE.SphereGeometry).parameters.radius;
        const atmosphereThreshold = planetRadius * this.atmosphereRatio;
        const outerAtmosphereThreshold = planetRadius * this.outerAtmosphereRatio;

        // Adjust ground threshold to be much smaller for more precise ground detection
        const groundThreshold = 0.8; // Significantly reduced from 2.5 for exact ground detection

        // Determine environment with transition zones
        const inDeepSpace = nearest.distance > outerAtmosphereThreshold;
        const inUpperAtmosphere = nearest.distance <= outerAtmosphereThreshold && nearest.distance > atmosphereThreshold;
        const inAtmosphere = nearest.distance <= atmosphereThreshold;

        // Add hysteresis to ground detection to prevent flickering
        let onGround = false;

        if (this.lastZone === 'surface') {
            // If we were on the surface, stay there until we're clearly not on the ground
            onGround = nearest.distance < (groundThreshold + this.zoneHysteresis);
        } else {
            // If we weren't on the surface, only switch when clearly on the ground
            onGround = nearest.distance < groundThreshold;
        }

        // Calculate transition factor for smooth physics blending
        // 0 = fully in atmosphere, 1 = fully in space
        let transitionFactor = 0;
        if (inUpperAtmosphere) {
            // Linear interpolation in the transition zone
            transitionFactor = (nearest.distance - atmosphereThreshold) /
                (outerAtmosphereThreshold - atmosphereThreshold);
        } else if (inDeepSpace) {
            transitionFactor = 1;
        }

        // Determine the current zone with hysteresis to prevent flickering
        let atmosphereZone = 'deep-space';

        if (onGround) {
            atmosphereZone = 'surface';
        } else if (nearest.distance < atmosphereThreshold * 0.3) {
            // Add extra check to prevent flickering between surface and low-atmosphere
            if (this.lastZone === 'surface' && nearest.distance < (groundThreshold + this.zoneHysteresis * 3)) {
                atmosphereZone = 'surface';
            } else {
                atmosphereZone = 'low-atmosphere';
            }
        } else if (inAtmosphere) {
            atmosphereZone = 'atmosphere';
        } else if (inUpperAtmosphere) {
            atmosphereZone = 'upper-atmosphere';
        }

        // Check if we need to delay zone switching to prevent rapid flickering
        if (this.lastZone && this.lastZone !== atmosphereZone) {
            this.zoneSwitchDelay++;

            // Only switch zones after a few consistent frames
            if (this.zoneSwitchDelay < 3) {  // Wait for 3 frames of consistent zone
                atmosphereZone = this.lastZone;
            } else {
                this.zoneSwitchDelay = 0;
            }
        } else {
            this.zoneSwitchDelay = 0;
        }

        // Store current zone for next frame
        this.lastZone = atmosphereZone;

        return {
            inSpace: inDeepSpace,
            inTransition: inUpperAtmosphere,
            inAtmosphere: inAtmosphere,
            onGround: onGround,
            nearest,
            atmosphereZone,
            transitionFactor
        };
    }

    // Get nearest planet and distance to its surface
    getNearestPlanet(position: THREE.Vector3, planets: THREE.Mesh[]): { planet: THREE.Mesh | null; distance: number } {
        let nearestPlanet: THREE.Mesh | null = null;
        let minDistance = Infinity;

        planets.forEach(planet => {
            const planetGeometry = planet.geometry as THREE.SphereGeometry;
            const distance = position.distanceTo(planet.position) - planetGeometry.parameters.radius;
            if (distance < minDistance) {
                minDistance = distance;
                nearestPlanet = planet;
            }
        });

        return { planet: nearestPlanet, distance: minDistance };
    }

    // Calculate gravity from all celestial bodies
    getGravityForce(position: THREE.Vector3, celestialBodies: THREE.Object3D[], mass = 1): THREE.Vector3 {
        const gravityVector = new THREE.Vector3(0, 0, 0);

        // Process each celestial body (sun and planets)
        celestialBodies.forEach(body => {
            // Skip if body has no position (shouldn't happen, but just in case)
            if (!body.position) return;

            // Check if body is a Mesh with geometry
            const bodyMesh = body as THREE.Mesh;
            if (!bodyMesh.geometry || !(bodyMesh.geometry as THREE.SphereGeometry)?.parameters?.radius) return;

            const direction = new THREE.Vector3().subVectors(body.position, position).normalize();
            const distance = position.distanceTo(body.position);

            // Skip if too close to center (inside the body)
            if (distance <= 0.1) return;

            // Calculate mass based on body type
            let bodyMass;
            if (body.userData?.isSun) {
                bodyMass = 50; // Sun has special mass
            } else {
                bodyMass = (bodyMesh.geometry as THREE.SphereGeometry).parameters.radius;
            }

            // Gravity falls off with square of distance
            // Limit minimum distance to prevent extreme forces
            const clampedDistance = Math.max(distance, (bodyMesh.geometry as THREE.SphereGeometry).parameters.radius * 0.5);
            const force = this.gravitationalConstant * (bodyMass * mass) / (clampedDistance * clampedDistance);

            // Apply softer gravity curves for better gameplay
            const scaledForce = Math.min(force, 20); // Cap maximum force

            gravityVector.add(direction.clone().multiplyScalar(scaledForce));
        });

        return gravityVector;
    }

    // Handle collisions with planets - improved for proper landing
    handlePlanetCollisions(
        playerPosition: THREE.Vector3,
        playerVelocity: THREE.Vector3,
        planets: THREE.Mesh[],
        collisionRadius: number
    ): CollisionResult {
        let onGround = false;
        let collidedPlanet: THREE.Mesh | null = null;
        let surfaceNormal: THREE.Vector3 | null = null;

        // Reduce collision radius for more precise ground detection
        const groundCollisionRadius = 0.5; // Reduced from 2.0 or whatever it was before

        // Check collisions with all planets
        for (const planet of planets) {
            const planetPos = planet.position;
            const planetRadius = (planet.geometry as THREE.SphereGeometry).parameters.radius;

            const distanceToCenter = playerPosition.distanceTo(planetPos);
            const distanceToSurface = distanceToCenter - planetRadius;

            if (distanceToSurface < groundCollisionRadius) {
                // Collision with planet surface

                // Calculate normal direction (away from planet center)
                const normal = new THREE.Vector3().subVectors(playerPosition, planetPos).normalize();
                surfaceNormal = normal.clone();

                // Position correction - place exactly on surface with no floating
                const correctionDistance = (groundCollisionRadius - distanceToSurface);
                playerPosition.add(normal.clone().multiplyScalar(correctionDistance));

                // Velocity correction - cancel out velocity component towards the planet
                const dot = playerVelocity.dot(normal);
                if (dot < 0) { // Only apply if moving toward the planet
                    playerVelocity.sub(normal.clone().multiplyScalar(dot));

                    // Apply stronger damping to prevent sliding
                    playerVelocity.multiplyScalar(0.8);
                }

                // Mark as on ground
                onGround = true;
                collidedPlanet = planet;
                break; // Stop after first collision
            }
        }

        return { onGround, collidedPlanet, surfaceNormal };
    }

    // Calculate the UP direction based on nearest planet
    calculateUpDirection(playerPosition: THREE.Vector3, planets: THREE.Mesh[]): THREE.Vector3 {
        const nearest = this.getNearestPlanet(playerPosition, planets);

        if (!nearest.planet || nearest.distance > this.alignmentDistance) {
            // Default to global up if no planet or too far
            return new THREE.Vector3(0, 1, 0);
        }

        // Calculate direction away from planet center (this is "up" relative to the planet)
        return new THREE.Vector3().subVectors(playerPosition, nearest.planet.position).normalize();
    }

    // Update player physics with smoother transitions
    updatePlayerPhysics(
        player: any,
        controls: any,
        deltaTime: number,
        planets: THREE.Mesh[],
        sun: THREE.Mesh | null,
        camera: THREE.Camera,
        gameState: any
    ): PhysicsResult {
        // Handle stamina for sprinting
        this.updateStamina(player, controls, deltaTime);

        // Check if noclip mode is active
        if (gameState.noclip) {
            // In noclip mode, apply direct camera-based movement with no physics
            const moveDirection = this.calculateMoveDirection(controls, camera, true, false);

            if (moveDirection.length() > 0) {
                // Faster movement in noclip mode
                let noclipSpeed = this.moveSpeed * 100;

                // Apply sprint multiplier in noclip mode if sprinting
                if (controls.sprint) {
                    // 3x speed in noclip while sprinting (9x base speed)
                    noclipSpeed *= 3;
                }

                moveDirection.normalize().multiplyScalar(noclipSpeed * deltaTime);
                player.position.add(moveDirection);
            }

            // Reset velocity in noclip mode
            player.velocity.set(0, 0, 0);
            player.onGround = false;

            // Return simplified physics results
            return {
                environment: {
                    inSpace: true,
                    onGround: false,
                    nearest: { planet: null, distance: Infinity },
                    atmosphereZone: 'noclip'
                },
                collision: { onGround: false, collidedPlanet: null, surfaceNormal: null },
                alignment: { aligned: false, upDirection: new THREE.Vector3(0, 1, 0) }
            };
        }

        // Regular physics when not in noclip mode
        // All celestial bodies that affect gravity
        const celestialBodies = [...planets];
        if (sun) celestialBodies.push(sun);

        // Calculate up direction for alignment
        const upDirection = this.calculateUpDirection(player.position, planets);

        // Check environment (space or atmosphere) with zones
        const environment = this.checkPlayerEnvironment(player.position, planets);
        player.onGround = environment.onGround;

        // Set drag based on environment with smooth transition
        const spaceDrag = this.inSpaceDrag;
        const atmosphereDrag = this.inAtmosphereDrag;

        // Calculate a more sophisticated drag coefficient based on environment
        let dragCoefficient;

        if (environment.inSpace) {
            // In deep space, minimal drag
            dragCoefficient = spaceDrag;
        } else if (environment.inTransition) {
            // In the transition zone (outer atmosphere), scale drag gradually
            dragCoefficient = spaceDrag + (atmosphereDrag - spaceDrag) * (1 - (environment.transitionFactor ?? 0));
        } else if (!environment.onGround) {
            // In atmosphere but not on ground, scale drag based on altitude
            // Preserve momentum at higher altitudes in the atmosphere
            const planetRadius = environment.nearest.planet ?
                (environment.nearest.planet.geometry as THREE.SphereGeometry).parameters.radius : 100;

            // Calculate a normalized distance (0 = at surface, 1 = at atmosphere boundary)
            const distanceFromSurface = environment.nearest.distance;
            const normalizedAltitude = Math.min(1, distanceFromSurface / (planetRadius * 0.25));

            // Apply very low drag at high altitudes, increasing as we get closer to surface
            dragCoefficient = spaceDrag + (atmosphereDrag - spaceDrag) * (1 - normalizedAltitude * 0.9);
        } else {
            // On ground, apply normal atmospheric drag
            dragCoefficient = atmosphereDrag;
        }

        // Apply drag to slow down movement (but ensure we don't lose too much momentum)
        player.velocity.multiplyScalar(1 - Math.min(dragCoefficient, 0.05 * deltaTime / 0.016));

        // Apply movement relative to camera orientation
        const moveDirection = this.calculateMoveDirection(controls, camera, !environment.onGround, environment.onGround);

        // Normalize and apply movement speed - with smooth transition
        if (moveDirection.length() > 0) {
            const spaceSpeedFactor = 0.5;
            const groundSpeedFactor = 1.0;

            // Blend speed factors based on transition factor
            let speedFactor = environment.inTransition ?
                groundSpeedFactor + (spaceSpeedFactor - groundSpeedFactor) * (environment.transitionFactor ?? 0) :
                environment.inSpace ? spaceSpeedFactor : groundSpeedFactor;

            // Apply sprint multiplier if sprinting and on ground or in atmosphere
            if (controls.sprint && player.stamina > 0 && !environment.inSpace) {
                // 1.5x speed on ground while sprinting
                speedFactor *= 1.5;
            }

            moveDirection.normalize().multiplyScalar(this.moveSpeed * deltaTime * speedFactor);
            player.velocity.add(moveDirection);
        }

        // Apply gravity with smooth transition
        let gravityVector;

        if (environment.inSpace && !environment.inTransition) {
            // Deep space - full orbital mechanics
            gravityVector = this.getGravityForce(player.position, celestialBodies);
            gravityVector.multiplyScalar(deltaTime);
        } else if (environment.inTransition) {
            // Transition zone - blend between orbital mechanics and directional gravity
            const orbitalGravity = this.getGravityForce(player.position, celestialBodies)
                .multiplyScalar(deltaTime);

            const dirGravity = environment.nearest.planet ?
                new THREE.Vector3().subVectors(environment.nearest.planet.position, player.position)
                    .normalize()
                    .multiplyScalar(this.gravity * deltaTime) :
                new THREE.Vector3(0, -this.gravity * deltaTime, 0);

            // Blend between the two types of gravity
            gravityVector = new THREE.Vector3()
                .addVectors(
                    orbitalGravity.multiplyScalar(environment.transitionFactor ?? 0),
                    dirGravity.multiplyScalar(1 - (environment.transitionFactor ?? 0))
                );
        } else {
            // In atmosphere - simplified directional gravity
            if (environment.nearest.planet) {
                const directionToCenter = new THREE.Vector3()
                    .subVectors(environment.nearest.planet.position, player.position)
                    .normalize();
                gravityVector = directionToCenter.multiplyScalar(this.gravity * deltaTime);
            } else {
                // Fallback if no nearest planet
                gravityVector = new THREE.Vector3(0, -this.gravity * deltaTime, 0);
            }
        }

        // Only apply gravity if not on ground
        if (!environment.onGround) {
            player.velocity.add(gravityVector);
        }

        // Apply jetpack force if active
        if (controls.jetpack && player.fuel > 0) {
            let jetpackDirection = new THREE.Vector3();

            // Determine if we're near enough to a planet to use its "up" direction
            if (environment.nearest.planet && environment.nearest.distance < 500) {
                // When near a planet, jetpack should propel "up" away from the planet
                jetpackDirection = this.calculateUpDirection(player.position, planets);
            } else {
                // In deep space, use the look direction as before
                camera.getWorldDirection(jetpackDirection);
            }

            // Apply force in the determined direction
            const jetpackForce = jetpackDirection.multiplyScalar(this.jetpackForce * deltaTime);
            player.velocity.add(jetpackForce);

            // Consume fuel
            player.fuel -= 20 * deltaTime; // Fuel consumption rate
            if (player.fuel < 0) player.fuel = 0;
        }

        // Apply down thrusters if active
        if (controls.downThrusters && player.fuel > 0) {
            let downDirection = new THREE.Vector3();

            // Determine if we're near enough to a planet to use its "down" direction
            if (environment.nearest.planet && environment.nearest.distance < 500) {
                // When near a planet, down thrusters should propel "down" toward the planet
                const upDirection = this.calculateUpDirection(player.position, planets);
                downDirection = upDirection.clone().negate();
            } else {
                // In deep space, go opposite to the look direction
                camera.getWorldDirection(downDirection);
                downDirection.negate(); // Reverse the direction
            }

            // Apply force in the downward direction
            const downForce = downDirection.multiplyScalar(this.jetpackForce * 0.8 * deltaTime);
            player.velocity.add(downForce);

            // Consume fuel (slightly less than jetpack)
            player.fuel -= 15 * deltaTime;
            if (player.fuel < 0) player.fuel = 0;
        }

        // Handle collisions before updating position
        const collision = this.handlePlanetCollisions(
            player.position,
            player.velocity,
            planets,
            this.collisionRadius
        );

        // Update position with velocity
        player.position.add(player.velocity.clone().multiplyScalar(deltaTime));

        // Update onGround state based on collision detection
        player.onGround = collision.onGround;

        // Apply additional friction when on ground
        if (player.onGround) {
            // Keep some velocity parallel to the surface for sliding effects
            const normal = collision.surfaceNormal;
            if (normal) {
                // Get velocity component along the surface
                const dot = player.velocity.dot(normal);
                const normalComponent = normal.clone().multiplyScalar(dot);
                const tangentialComponent = new THREE.Vector3().subVectors(player.velocity, normalComponent);

                // Apply friction to tangential component
                tangentialComponent.multiplyScalar(0.9);

                // Remove normal component (prevents pushing into the ground)
                player.velocity.copy(tangentialComponent);
            }
        }

        // Return all the physics results for the game to use
        return {
            environment,
            collision,
            alignment: {
                upDirection: upDirection,
                alignmentDistance: this.alignmentDistance,
                alignmentSpeed: this.alignmentSpeed
            }
        };
    }

    // Handle stamina consumption and regeneration
    updateStamina(player: any, controls: any, deltaTime: number): void {
        // Consume stamina if sprinting and moving
        if (controls.sprint && player.stamina > 0) {
            // Consume stamina while sprinting
            player.stamina -= player.staminaDrainRate * deltaTime;
            if (player.stamina < 0) player.stamina = 0;
        } else if (!controls.sprint || player.stamina <= 0) {
            // Regenerate stamina when not sprinting
            player.stamina += player.staminaRechargeRate * deltaTime;
            if (player.stamina > player.maxStamina) {
                player.stamina = player.maxStamina;
            }

            // Disable sprinting if out of stamina
            if (player.stamina <= 0) {
                player.isSprinting = false;
            }
        }
    }

    calculateMoveDirection(
        controls: any,
        camera: THREE.Camera,
        inSpace: boolean,
        onGround: boolean
    ): THREE.Vector3 {
        const moveDirection = new THREE.Vector3();

        // Get camera direction vectors
        const forward = new THREE.Vector3();
        const right = new THREE.Vector3();
        camera.getWorldDirection(forward);
        right.crossVectors(forward, new THREE.Vector3(0, 1, 0)).normalize();

        // When on ground, movement should be parallel to the surface
        if (onGround) {
            // Make forward parallel to ground when on a planet
            const upVector = new THREE.Vector3(0, 1, 0).applyQuaternion(camera.quaternion);
            forward.projectOnPlane(upVector).normalize();
            right.crossVectors(forward, upVector).normalize();
        }

        // Calculate movement based on input
        if (controls.moveForward) moveDirection.add(forward);
        if (controls.moveBackward) moveDirection.sub(forward);
        if (controls.moveRight) moveDirection.add(right);
        if (controls.moveLeft) moveDirection.sub(right);

        return moveDirection;
    }
}
