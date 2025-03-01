import * as THREE from 'three';

export class Physics {
    constructor() {
        this.gravity = 9.8;
        this.jumpForce = 10;
        this.moveSpeed = 5;
        this.jetpackForce = 20;
        this.dragCoefficient = 0.1;
        this.inSpaceDrag = 0.001;
        this.inAtmosphereDrag = 0.1;
        this.collisionRadius = 2;
        this.gravitationalConstant = 100; // Reduced from 1000 to prevent excessive force
    }

    // Check if player is on ground or in space
    checkPlayerEnvironment(playerPosition, planets) {
        const nearest = this.getNearestPlanet(playerPosition, planets);
        
        if (!nearest.planet) return { inSpace: true, onGround: false, nearest };
        
        const planetRadius = nearest.planet.geometry.parameters.radius;
        const atmosphereThreshold = planetRadius * 1.5;
        const groundThreshold = 2.0; // Distance to be considered "on ground"
        
        // Determine environment
        const inSpace = nearest.distance > atmosphereThreshold;
        const onGround = nearest.distance < groundThreshold;
        
        return {
            inSpace,
            onGround,
            nearest
        };
    }

    // Get nearest planet and distance to its surface
    getNearestPlanet(position, planets) {
        let nearestPlanet = null;
        let minDistance = Infinity;
        
        planets.forEach(planet => {
            const distance = position.distanceTo(planet.position) - planet.geometry.parameters.radius;
            if (distance < minDistance) {
                minDistance = distance;
                nearestPlanet = planet;
            }
        });
        
        return { planet: nearestPlanet, distance: minDistance };
    }

    // Calculate gravity from all celestial bodies
    getGravityForce(position, celestialBodies, mass = 1) {
        const gravityVector = new THREE.Vector3(0, 0, 0);
        
        // Process each celestial body (sun and planets)
        celestialBodies.forEach(body => {
            // Skip if body has no position or no radius (shouldn't happen, but just in case)
            if (!body.position || !body.geometry?.parameters?.radius) return;
            
            const direction = new THREE.Vector3().subVectors(body.position, position).normalize();
            const distance = position.distanceTo(body.position);
            
            // Skip if too close to center (inside the body)
            if (distance <= 0.1) return;
            
            // Calculate mass based on body type
            let bodyMass;
            if (body.userData?.isSun) {
                bodyMass = 50; // Sun has special mass
            } else {
                bodyMass = body.geometry.parameters.radius;
            }
            
            // Gravity falls off with square of distance
            // Limit minimum distance to prevent extreme forces
            const clampedDistance = Math.max(distance, body.geometry.parameters.radius * 0.5);
            const force = this.gravitationalConstant * (bodyMass * mass) / (clampedDistance * clampedDistance);
            
            // Apply softer gravity curves for better gameplay
            const scaledForce = Math.min(force, 50); // Cap maximum force
            
            gravityVector.add(direction.clone().multiplyScalar(scaledForce));
        });
        
        return gravityVector;
    }

    // Handle collisions with planets
    handlePlanetCollisions(playerPosition, playerVelocity, planets, collisionRadius) {
        let onGround = false;
        let collidedPlanet = null;
        
        // Check collisions with all planets
        for (const planet of planets) {
            const planetPos = planet.position;
            const planetRadius = planet.geometry.parameters.radius;
            
            const distanceToCenter = playerPosition.distanceTo(planetPos);
            const distanceToSurface = distanceToCenter - planetRadius;
            
            if (distanceToSurface < collisionRadius) {
                // Collision with planet surface
                
                // Calculate normal direction (away from planet center)
                const normal = new THREE.Vector3().subVectors(playerPosition, planetPos).normalize();
                
                // Position correction - push out to surface
                const correctionDistance = collisionRadius - distanceToSurface;
                playerPosition.add(normal.clone().multiplyScalar(correctionDistance));
                
                // Velocity correction - reflect velocity along normal with some damping
                const dot = playerVelocity.dot(normal);
                if (dot < 0) { // Only reflect if moving toward the planet
                    playerVelocity.sub(normal.multiplyScalar(dot * 1.6)); // 1.6 for some bounce
                    
                    // Add friction to slow down sliding
                    const tangentialVelocity = new THREE.Vector3().copy(playerVelocity);
                    tangentialVelocity.sub(normal.clone().multiplyScalar(playerVelocity.dot(normal)));
                    tangentialVelocity.multiplyScalar(0.95); // 5% friction
                    
                    playerVelocity.copy(tangentialVelocity);
                    playerVelocity.add(normal.clone().multiplyScalar(Math.max(0, dot * 0.6))); // Bounce
                }
                
                // Mark as on ground
                onGround = true;
                collidedPlanet = planet;
                break; // Stop after first collision
            }
        }
        
        return { onGround, collidedPlanet };
    }

    // Update player physics
    updatePlayerPhysics(player, controls, deltaTime, planets, sun, camera, gameState) {
        // Check if noclip mode is active
        if (gameState.noclip) {
            // In noclip mode, apply direct camera-based movement with no physics
            const moveDirection = this.calculateMoveDirection(controls, camera, true, false);
            
            if (moveDirection.length() > 0) {
                // Faster movement in noclip mode
                const noclipSpeed = this.moveSpeed * 3;
                moveDirection.normalize().multiplyScalar(noclipSpeed * deltaTime);
                player.position.add(moveDirection);
            }
            
            // Reset velocity in noclip mode
            player.velocity.set(0, 0, 0);
            player.onGround = false;
            
            // Return simplified physics results
            return {
                environment: { inSpace: true, onGround: false, nearest: { planet: null, distance: Infinity } },
                collision: { onGround: false, collidedPlanet: null }
            };
        }
        
        // Regular physics when not in noclip mode
        // All celestial bodies that affect gravity
        const celestialBodies = [...planets];
        if (sun) celestialBodies.push(sun);
        
        // Check environment (space or atmosphere)
        const environment = this.checkPlayerEnvironment(player.position, planets);
        const inSpace = environment.inSpace;
        player.onGround = environment.onGround;
        
        // Set drag based on environment
        const dragCoefficient = inSpace ? this.inSpaceDrag : this.inAtmosphereDrag;
        
        // Apply drag to slow down movement
        player.velocity.multiplyScalar(1 - dragCoefficient);
        
        // Apply movement
        const moveDirection = this.calculateMoveDirection(controls, camera, inSpace, player.onGround);
        
        // Normalize and apply movement speed - slower in space for better control
        if (moveDirection.length() > 0) {
            const speedMultiplier = inSpace ? 0.5 : 1.0; // Slower movement in space
            moveDirection.normalize().multiplyScalar(this.moveSpeed * deltaTime * speedMultiplier);
            player.velocity.add(moveDirection);
        }
        
        // Apply gravity or calculate orbital mechanics
        let gravityVector;
        
        if (inSpace) {
            // In space - use orbital mechanics with gravity from all bodies
            gravityVector = this.getGravityForce(player.position, celestialBodies);
            gravityVector.multiplyScalar(deltaTime); // Apply over time
        } else {
            // Near a planet - simplified gravity
            const directionToCenter = new THREE.Vector3()
                .subVectors(environment.nearest.planet.position, player.position)
                .normalize();
            gravityVector = directionToCenter.multiplyScalar(this.gravity * deltaTime);
        }
        
        player.velocity.add(gravityVector);
        
        // Apply jetpack force if active
        if (controls.jetpack && player.fuel > 0) {
            const jetpackDirection = new THREE.Vector3();
            camera.getWorldDirection(jetpackDirection);
            
            // Apply force in look direction
            const jetpackForce = jetpackDirection.multiplyScalar(this.jetpackForce * deltaTime);
            player.velocity.add(jetpackForce);
            
            // Consume fuel
            player.fuel -= 20 * deltaTime; // Fuel consumption rate
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
        
        return {
            environment,
            collision
        };
    }

    calculateMoveDirection(controls, camera, inSpace, onGround) {
        const moveDirection = new THREE.Vector3();
        
        // Get camera direction vectors
        const forward = new THREE.Vector3();
        const right = new THREE.Vector3();
        camera.getWorldDirection(forward);
        right.crossVectors(forward, new THREE.Vector3(0, 1, 0)).normalize();
        
        // Flatten forward direction for ground movement
        if (!inSpace && onGround) {
            // Make forward parallel to ground when on a planet
            forward.y = 0;
            forward.normalize();
        }
        
        // Calculate movement based on input
        if (controls.moveForward) moveDirection.add(forward);
        if (controls.moveBackward) moveDirection.sub(forward);
        if (controls.moveRight) moveDirection.add(right);
        if (controls.moveLeft) moveDirection.sub(right);
        
        return moveDirection;
    }
}
