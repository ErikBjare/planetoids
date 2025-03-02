import * as THREE from 'three';
import { PointerLockControls } from 'three/examples/jsm/controls/PointerLockControls.js';
import { UI } from './ui';
import { Physics } from './physics';
import { DebugArrows } from './types';

export class PlayerController {
    scene: THREE.Scene;
    camera: THREE.Camera;
    ui: UI;

    // Player properties
    position: THREE.Vector3;
    velocity: THREE.Vector3;
    scale: THREE.Vector3;

    // Two-part rotation system
    bodyQuaternion: THREE.Quaternion;
    headRotation: THREE.Euler;

    // Legacy rotation properties (for compatibility)
    rotation: THREE.Euler;
    quaternion: THREE.Quaternion;

    // Thruster states
    jetpackActive: boolean;
    downThrustersActive: boolean;

    // Alignment tracking
    alignmentNeeded: number;
    alignmentStrength: number;
    currentUpDirection: THREE.Vector3;

    // Player state
    onGround: boolean;
    fuel: number;
    maxFuel: number;
    fuelRechargeRate: number;
    lastPlanetVisited: number;
    noclip: boolean;

    // Stamina for sprinting
    stamina: number;
    maxStamina: number;
    staminaRechargeRate: number;
    staminaDrainRate: number;
    isSprinting: boolean;

    // Movement controls state for animation
    moveForward: boolean;
    moveBackward: boolean;
    moveLeft: boolean;
    moveRight: boolean;

    // Camera settings
    cameraMode: string;
    cameraDistance: number;
    targetCameraDistance: number;
    cameraHeight: number;
    cameraZoomSpeed: number;
    scopeZoom: number;
    normalFOV: number;
    scopeFOV: number;

    // Player model parts
    model: THREE.Group;
    playerBody: THREE.Mesh;
    helmet: THREE.Mesh;
    visor: THREE.Mesh;
    backpack: THREE.Mesh;
    flame: THREE.Mesh;
    leftArm: THREE.Mesh;
    rightArm: THREE.Mesh;
    leftLeg: THREE.Mesh;
    rightLeg: THREE.Mesh;
    cameraPivot: THREE.Object3D;
    dummyCamera: THREE.PerspectiveCamera;

    // Controls
    pointerLockControls: PointerLockControls;
    mouseSensitivity: number;

    // Debug arrows
    debugArrows?: DebugArrows;

    constructor(scene: THREE.Scene, camera: THREE.Camera, ui: UI) {
        this.scene = scene;
        this.camera = camera;
        this.ui = ui;

        // Player properties
        this.position = new THREE.Vector3(150, 150, 150);
        this.velocity = new THREE.Vector3(0, 0, 0);
        this.scale = new THREE.Vector3(1, 1, 1);

        // Two-part rotation system
        this.bodyQuaternion = new THREE.Quaternion(); // Physics-based, planet-aligned orientation
        this.headRotation = new THREE.Euler(0, 0, 0, 'YXZ'); // Local head rotation controlled by player

        // Legacy rotation properties (for compatibility)
        this.rotation = new THREE.Euler(0, 0, 0);
        this.quaternion = new THREE.Quaternion();

        // Thruster states
        this.jetpackActive = false;
        this.downThrustersActive = false;

        // Alignment tracking
        this.alignmentNeeded = 0;
        this.alignmentStrength = 0;
        this.currentUpDirection = new THREE.Vector3(0, 1, 0);

        // Player state
        this.onGround = false;
        this.fuel = 100;
        this.maxFuel = 100;
        this.fuelRechargeRate = 10;
        this.lastPlanetVisited = 0;
        this.noclip = false;

        // Stamina for sprinting
        this.stamina = 100;
        this.maxStamina = 100;
        this.staminaRechargeRate = 15; // per second
        this.staminaDrainRate = 25;     // per second when sprinting
        this.isSprinting = false;

        // Movement controls state for animation
        this.moveForward = false;
        this.moveBackward = false;
        this.moveLeft = false;
        this.moveRight = false;

        // Camera settings
        this.cameraMode = 'firstPerson'; // 'firstPerson', 'thirdPerson', 'scope'
        this.cameraDistance = 0; // Distance from player (0 for first person)
        this.targetCameraDistance = 0;
        this.cameraHeight = 1.7; // Height of camera above player position
        this.cameraZoomSpeed = 5; // How fast the camera moves between modes
        this.scopeZoom = 0.3; // FOV multiplier for scope mode
        this.normalFOV = 75; // Normal camera FOV
        this.scopeFOV = 30;  // FOV when in scope mode

        // Create player model and required properties (will be initialized in createPlayerModel)
        this.model = new THREE.Group();
        this.playerBody = new THREE.Mesh();
        this.helmet = new THREE.Mesh();
        this.visor = new THREE.Mesh();
        this.backpack = new THREE.Mesh();
        this.flame = new THREE.Mesh();
        this.leftArm = new THREE.Mesh();
        this.rightArm = new THREE.Mesh();
        this.leftLeg = new THREE.Mesh();
        this.rightLeg = new THREE.Mesh();
        this.cameraPivot = new THREE.Object3D();
        this.dummyCamera = new THREE.PerspectiveCamera();
        this.pointerLockControls = new PointerLockControls(this.dummyCamera, document.body);
        this.mouseSensitivity = 0.002;

        // Create player model
        this.createPlayerModel();

        // Setup camera and controls
        this.setupCamera();

        // Add to scene
        this.scene.add(this.model);

        // Update UI with current camera mode
        this.ui.updateCameraMode(this.cameraMode);
    }

    createPlayerModel(): void {
        // Create a simple astronaut model
        // Main body group
        this.model = new THREE.Group();
        this.model.position.copy(this.position);
        this.model.rotation.copy(this.rotation);

        // Create player body
        const bodyGeometry = new THREE.CapsuleGeometry(0.5, 1, 4, 8);
        const bodyMaterial = new THREE.MeshLambertMaterial({ color: 0x3f88eb });
        this.playerBody = new THREE.Mesh(bodyGeometry, bodyMaterial);
        this.playerBody.position.y = 1; // Center of capsule at y=1
        this.model.add(this.playerBody);

        // Create a helmet
        const helmetGeometry = new THREE.SphereGeometry(0.5, 16, 16);
        const helmetMaterial = new THREE.MeshLambertMaterial({
            color: 0x555555,
            transparent: true,
            opacity: 0.7
        });
        this.helmet = new THREE.Mesh(helmetGeometry, helmetMaterial);
        this.helmet.position.y = 2; // Top of body
        this.model.add(this.helmet);

        // Create visor
        const visorGeometry = new THREE.SphereGeometry(0.4, 16, 16, 0, Math.PI * 2, 0, Math.PI / 2);
        const visorMaterial = new THREE.MeshLambertMaterial({
            color: 0x3f88eb,
            transparent: true,
            opacity: 0.7
        });
        this.visor = new THREE.Mesh(visorGeometry, visorMaterial);
        this.visor.position.y = 2;
        this.visor.position.z = 0.1;
        this.visor.rotation.x = Math.PI / 2;
        this.model.add(this.visor);

        // Create backpack (jetpack)
        const backpackGeometry = new THREE.BoxGeometry(0.7, 0.7, 0.3);
        const backpackMaterial = new THREE.MeshLambertMaterial({ color: 0x444444 });
        this.backpack = new THREE.Mesh(backpackGeometry, backpackMaterial);
        this.backpack.position.y = 1;
        this.backpack.position.z = -0.4;
        this.model.add(this.backpack);

        // Add jetpack flames (visible when active)
        const flameGeometry = new THREE.ConeGeometry(0.2, 0.5, 8);
        const flameMaterial = new THREE.MeshBasicMaterial({
            color: 0xff6600,
            transparent: true,
            opacity: 0.7
        });
        this.flame = new THREE.Mesh(flameGeometry, flameMaterial);
        this.flame.position.y = -0.3;
        this.flame.rotation.x = Math.PI;
        this.flame.visible = false; // Hidden by default
        this.backpack.add(this.flame);

        // Create arms
        const armGeometry = new THREE.CylinderGeometry(0.15, 0.15, 0.8);
        const armMaterial = new THREE.MeshLambertMaterial({ color: 0x3f88eb });

        // Left arm
        this.leftArm = new THREE.Mesh(armGeometry, armMaterial);
        this.leftArm.position.set(-0.6, 1.3, 0);
        this.leftArm.rotation.z = -Math.PI / 4;
        this.model.add(this.leftArm);

        // Right arm
        this.rightArm = new THREE.Mesh(armGeometry, armMaterial);
        this.rightArm.position.set(0.6, 1.3, 0);
        this.rightArm.rotation.z = Math.PI / 4;
        this.model.add(this.rightArm);

        // Create legs
        const legGeometry = new THREE.CylinderGeometry(0.15, 0.15, 1);
        const legMaterial = new THREE.MeshLambertMaterial({ color: 0x3f88eb });

        // Left leg
        this.leftLeg = new THREE.Mesh(legGeometry, legMaterial);
        this.leftLeg.position.set(-0.3, 0.5, 0);
        this.model.add(this.leftLeg);

        // Right leg
        this.rightLeg = new THREE.Mesh(legGeometry, legMaterial);
        this.rightLeg.position.set(0.3, 0.5, 0);
        this.model.add(this.rightLeg);

        // Make the model invisible in first person
        this.updateModelVisibility();
    }

    setupCamera(): void {
        // Add a pivot point for third-person camera
        this.cameraPivot = new THREE.Object3D();
        this.cameraPivot.position.y = this.cameraHeight;
        this.model.add(this.cameraPivot);

        // Set mouse sensitivity
        this.mouseSensitivity = 0.002;

        // Create a separate object for PointerLockControls that won't affect our camera
        this.dummyCamera = new THREE.PerspectiveCamera();
        this.scene.add(this.dummyCamera); // Must add to scene for controls to work

        // Use a different approach - completely abandon PointerLockControls' camera management
        this.pointerLockControls = new PointerLockControls(this.dummyCamera, document.body);

        // Debug
        console.warn('DEBUG: Using totally separate camera system for orientation');

        // Handle pointer lock state
        document.addEventListener('click', () => {
            if (!this.pointerLockControls.isLocked) {
                this.pointerLockControls.lock();
            }
        });

        this.pointerLockControls.addEventListener('lock', () => {
            this.ui.setCrosshairVisible(true);
            // Force a camera update immediately
            this.updateCamera(0.016);
        });

        this.pointerLockControls.addEventListener('unlock', () => {
            this.ui.setCrosshairVisible(false);
        });

        // IMPORTANT: Direct mouse movement to head rotation only
        document.addEventListener('mousemove', (event) => {
            if (this.pointerLockControls.isLocked) {
                // Update only the head rotation (not body)
                this.headRotation.y -= event.movementX * this.mouseSensitivity;
                this.headRotation.x -= event.movementY * this.mouseSensitivity;

                // Clamp vertical rotation to avoid flipping
                this.headRotation.x = Math.max(-Math.PI/2, Math.min(Math.PI/2, this.headRotation.x));

                // Force immediate camera update for responsive controls
                this.updateCamera(0.016);
            }
        });

        // Setup mouse wheel for changing camera mode
        document.addEventListener('wheel', (event) => {
            this.handleMouseWheel(event);
        });

        // Add visual debugger for orientation
        this.createOrientationDebugger();
    }

    // Add a visual indicator to help debug orientation issues
    createOrientationDebugger(): void {
        // Create arrows with different representations
        // Red arrow - shows velocity
        const velocityArrow = new THREE.ArrowHelper(
            new THREE.Vector3(0, 0, -1), // Direction (will be updated)
            new THREE.Vector3(0, 0, 0),  // Origin (will be updated)
            2,                           // Length
            0xff0000                     // Color (red)
        );

        // Green arrow - shows combined forces (gravity, jetpack, movement)
        const forceArrow = new THREE.ArrowHelper(
            new THREE.Vector3(0, 0, -1), // Direction (will be updated)
            new THREE.Vector3(0, 0, 0),  // Origin (will be updated)
            1.5,                         // Length
            0x00ff00                     // Color (green)
        );

        // Grey arrow - shows "up" direction relative to nearest planet
        const planetUpArrow = new THREE.ArrowHelper(
            new THREE.Vector3(0, 1, 0),  // Direction (will be updated)
            new THREE.Vector3(0, 0, 0),  // Origin (will be updated)
            1.8,                         // Length
            0xaaaaaa                     // Color (grey)
        );

        // Add debug arrows directly to scene
        this.scene.add(velocityArrow);
        this.scene.add(forceArrow);
        this.scene.add(planetUpArrow);

        // Store references to update in updateCamera method
        this.debugArrows = {
            velocity: velocityArrow,     // Red - shows actual movement
            force: forceArrow,           // Green - shows combined forces
            planetUp: planetUpArrow,     // Grey - shows up direction relative to planet
            distance: 3                  // How far in front of camera to place arrows
        };
    }

    handleMouseWheel(event: WheelEvent): void {
        // Only process if pointer is locked (active gameplay)
        if (!this.pointerLockControls.isLocked) return;

        // Determine direction (scroll up or down)
        const scrollingUp = event.deltaY < 0;

        // Change camera mode based on current mode and scroll direction
        if (scrollingUp) {
            // Zoom in: third-person -> first-person -> scope
            if (this.cameraMode === 'thirdPerson') {
                this.setCameraMode('firstPerson');
            } else if (this.cameraMode === 'firstPerson') {
                this.setCameraMode('scope');
            }
        } else {
            // Zoom out: scope -> first-person -> third-person
            if (this.cameraMode === 'scope') {
                this.setCameraMode('firstPerson');
            } else if (this.cameraMode === 'firstPerson') {
                this.setCameraMode('thirdPerson');
            }
        }
    }

    setCameraMode(mode: string): void {
        this.cameraMode = mode;

        // Set camera distance based on mode
        switch (mode) {
        case 'scope':
            this.targetCameraDistance = 0;
            (this.camera as THREE.PerspectiveCamera).fov = this.scopeFOV;
            (this.camera as THREE.PerspectiveCamera).updateProjectionMatrix();
            break;

        case 'firstPerson':
            this.targetCameraDistance = 0;
            (this.camera as THREE.PerspectiveCamera).fov = this.normalFOV;
            (this.camera as THREE.PerspectiveCamera).updateProjectionMatrix();
            break;

        case 'thirdPerson':
            this.targetCameraDistance = 5; // Distance behind player
            (this.camera as THREE.PerspectiveCamera).fov = this.normalFOV;
            (this.camera as THREE.PerspectiveCamera).updateProjectionMatrix();
            break;
        }

        // Update model visibility based on camera mode
        this.updateModelVisibility();

        // Update UI with current mode
        this.ui.updateCameraMode(mode);
    }

    updateModelVisibility(): void {
        // Show model in third person, hide in first person
        const isVisible = this.cameraMode === 'thirdPerson';

        // Toggle visibility of all model parts
        this.playerBody.visible = isVisible;
        this.helmet.visible = isVisible;
        this.visor.visible = isVisible;
        this.backpack.visible = isVisible;
        this.leftArm.visible = isVisible;
        this.rightArm.visible = isVisible;
        this.leftLeg.visible = isVisible;
        this.rightLeg.visible = isVisible;
    }

    update(deltaTime: number, physics?: Physics, planets?: THREE.Mesh[]): void {
        // Update model position
        this.model.position.copy(this.position);

        // Synchronize legacy quaternion with bodyQuaternion for compatibility
        this.quaternion.copy(this.bodyQuaternion);
        this.rotation.setFromQuaternion(this.bodyQuaternion);

        // Smoothly interpolate camera distance for view transitions
        if (Math.abs(this.cameraDistance - this.targetCameraDistance) > 0.01) {
            this.cameraDistance = THREE.MathUtils.lerp(
                this.cameraDistance,
                this.targetCameraDistance,
                deltaTime * this.cameraZoomSpeed
            );
        } else {
            this.cameraDistance = this.targetCameraDistance;
        }

        // Update camera using our two-part rotation system
        this.updateCamera(deltaTime);

        // Update player model animations
        this.updateModelAnimations(deltaTime);

        // Update jetpack flame
        this.updateJetpackFlame();
    }

    updateCamera(deltaTime?: number): void {
        // Create quaternion from head rotation (player look direction)
        const headQuat = new THREE.Quaternion().setFromEuler(this.headRotation);

        // Fix for distorted first-person camera - more direct calculation
        if (this.cameraMode === 'firstPerson' || this.cameraMode === 'scope') {
            // Position camera at player's head position
            this.camera.position.copy(this.position);
            this.camera.position.y += this.cameraHeight;

            // Create the final orientation with careful order of operations
            // 1. Start with identity quaternion
            const cameraQuat = new THREE.Quaternion();

            // 2. Apply body rotation first (planet alignment)
            cameraQuat.copy(this.bodyQuaternion);

            // 3. Apply head rotation as a separate step
            // This specific order prevents distortion issues
            cameraQuat.multiply(headQuat);

            // Apply to camera
            this.camera.quaternion.copy(cameraQuat);

            // Model orientation matches body orientation only
            this.model.quaternion.copy(this.bodyQuaternion);

        } else if (this.cameraMode === 'thirdPerson') {
            // In third-person, use body orientation for model and combine with head for camera

            // Position camera based on combined orientation
            const combinedQuat = this.bodyQuaternion.clone().multiply(headQuat);

            // Get directional vectors from the combined rotation
            const direction = new THREE.Vector3(0, 0, -1).applyQuaternion(combinedQuat);
            const up = new THREE.Vector3(0, 1, 0).applyQuaternion(this.bodyQuaternion);

            // Calculate an offset position behind and above the player
            const offset = new THREE.Vector3();
            offset.copy(direction).multiplyScalar(-this.cameraDistance); // Move backward

            // Use the body's up direction for vertical offset
            offset.add(up.clone().multiplyScalar(this.cameraHeight * 0.8));

            // Apply the offset to the player's position
            this.camera.position.copy(this.position).add(offset);

            // Have the camera look toward the player's head position
            const target = this.position.clone().add(up.multiplyScalar(this.cameraHeight));

            // Also look slightly in the direction the camera is facing
            target.add(direction.clone().multiplyScalar(this.cameraDistance * 0.3));

            this.camera.lookAt(target);

            // Apply body orientation to the model
            this.model.quaternion.copy(this.bodyQuaternion);

            // For third-person, also apply some heading rotation based on movement
            // This is handled in updateModelAnimations when moving
        }

        // Update debug arrows if they exist - NEW IMPLEMENTATION
        if (this.debugArrows) {
            // Calculate position in front of camera
            const arrowDistance = this.debugArrows.distance || 3;
            const cameraDirection = new THREE.Vector3(0, 0, -1).applyQuaternion(this.camera.quaternion);
            const arrowPosition = this.camera.position.clone().add(
                cameraDirection.multiplyScalar(arrowDistance)
            );

            // Position all arrows in front of the camera
            this.debugArrows.velocity.position.copy(arrowPosition);
            this.debugArrows.force.position.copy(arrowPosition);
            this.debugArrows.planetUp.position.copy(arrowPosition);

            // Get physics engine and nearest planet data
            const planets = window.game?.world?.planets || [];

            // 1. RED ARROW - Shows actual velocity
            const velocityVector = this.velocity.clone().normalize();
            // Only show if we're actually moving
            if (this.velocity.length() > 0.1) {
                this.debugArrows.velocity.visible = true;
                this.debugArrows.velocity.setDirection(velocityVector);

                // Scale length based on actual speed
                const velocityLength = Math.min(2, 0.5 + this.velocity.length() * 0.05);
                this.debugArrows.velocity.setLength(velocityLength);
            } else {
                this.debugArrows.velocity.visible = false;
            }

            // 2. Calculate forces for GREEN ARROW (combined force)
            let forceVector = new THREE.Vector3(0, 0, 0);
            let nearestPlanet: THREE.Mesh | null = null;
            let minDistance = Infinity;

            // Find nearest planet for gravity
            for (const planet of planets) {
                if (!planet || !planet.geometry || !planet.position) continue;

                const distance = this.position.distanceTo(planet.position);
                if (distance < minDistance) {
                    minDistance = distance;
                    nearestPlanet = planet;
                }
            }

            // Add gravity force
            if (nearestPlanet) {
                const gravityDir = new THREE.Vector3().subVectors(
                    nearestPlanet.position,
                    this.position
                ).normalize();

                // Scale gravity by approximate strength
                const gravityStrength = 0.7;
                forceVector.add(gravityDir.multiplyScalar(gravityStrength));

                // 3. GREY ARROW - Points "up" relative to nearest planet (opposite gravity)
                const planetUpVector = new THREE.Vector3().subVectors(
                    this.position,
                    nearestPlanet.position
                ).normalize();

                this.debugArrows.planetUp.visible = true;
                this.debugArrows.planetUp.setDirection(planetUpVector);
                this.debugArrows.planetUp.setLength(1.8);
            } else {
                // No planets nearby, show a default up
                this.debugArrows.planetUp.visible = true;
                this.debugArrows.planetUp.setDirection(new THREE.Vector3(0, 1, 0));
                this.debugArrows.planetUp.setLength(1.8);
            }

            // Add jetpack force if active
            if (this.jetpackActive && this.fuel > 0) {
                const jetpackDir = new THREE.Vector3(0, 0, -1).applyQuaternion(this.camera.quaternion);
                const jetpackStrength = 0.8;
                forceVector.add(jetpackDir.multiplyScalar(jetpackStrength));
            }

            // Add movement force if actively moving
            if (this.moveForward || this.moveBackward || this.moveLeft || this.moveRight) {
                // This is simplified - ideally we'd use the actual movement vector
                const movementDir = new THREE.Vector3(0, 0, -1).applyQuaternion(this.camera.quaternion);
                if (this.moveBackward) movementDir.negate();

                const movementStrength = 0.4;
                forceVector.add(movementDir.multiplyScalar(movementStrength));
            }

            // Only show force arrow if there are forces
            if (forceVector.length() > 0.1) {
                this.debugArrows.force.visible = true;
                // Normalize and set direction
                forceVector.normalize();
                this.debugArrows.force.setDirection(forceVector);

                // Set length proportional to combined force
                this.debugArrows.force.setLength(1.8);
            } else {
                this.debugArrows.force.visible = false;
            }
        }
    }

    updateModelAnimations(deltaTime: number): void {
        // Simple animations based on movement
        if (this.onGround && this.velocity.length() > 0.5) {
            // Walking animation - swing legs and arms
            const walkSpeed = Math.min(10, this.velocity.length() * 3); // Speed up animation with movement
            const walkAmount = Math.sin(Date.now() * 0.005 * walkSpeed) * 0.3;

            // Leg movement
            this.leftLeg.rotation.x = walkAmount;
            this.rightLeg.rotation.x = -walkAmount;

            // Arm movement (opposite to legs)
            this.leftArm.rotation.x = -walkAmount;
            this.leftArm.rotation.z = -Math.PI / 4 + walkAmount * 0.5;
            this.rightArm.rotation.x = walkAmount;
            this.rightArm.rotation.z = Math.PI / 4 - walkAmount * 0.5;
        } else if (!this.onGround) {
            // Flying/falling animation
            // Extend arms slightly out to sides
            this.leftArm.rotation.z = -Math.PI / 3;
            this.rightArm.rotation.z = Math.PI / 3;

            // Straighten legs slightly
            this.leftLeg.rotation.x = -0.2;
            this.rightLeg.rotation.x = 0.2;
        } else {
            // Reset to neutral pose when standing still
            this.leftLeg.rotation.x = 0;
            this.rightLeg.rotation.x = 0;
            this.leftArm.rotation.x = 0;
            this.leftArm.rotation.z = -Math.PI / 4;
            this.rightArm.rotation.x = 0;
            this.rightArm.rotation.z = Math.PI / 4;
        }

        // For third-person mode, rotate model based on movement direction
        if (this.cameraMode === 'thirdPerson') {
            if (this.velocity.length() > 0.5) {
                // Calculate the target rotation based on movement direction relative to camera
                // Get the camera's forward direction projected onto the XZ plane
                const cameraForward = new THREE.Vector3(0, 0, -1).applyQuaternion(this.camera.quaternion);
                cameraForward.y = 0;
                cameraForward.normalize();

                // Get camera's right direction
                const cameraRight = new THREE.Vector3(1, 0, 0).applyQuaternion(this.camera.quaternion);
                cameraRight.y = 0;
                cameraRight.normalize();

                // Calculate movement direction based on input controls
                const moveDir = new THREE.Vector3(0, 0, 0);
                if (this.moveForward) moveDir.add(cameraForward);
                if (this.moveBackward) moveDir.sub(cameraForward);
                if (this.moveRight) moveDir.add(cameraRight);
                if (this.moveLeft) moveDir.sub(cameraRight);

                if (moveDir.length() > 0.01) {
                    moveDir.normalize();

                    // Calculate target rotation based on movement direction
                    const targetRotation = Math.atan2(moveDir.x, moveDir.z);

                    // Get the current model heading
                    const modelEuler = new THREE.Euler().setFromQuaternion(this.model.quaternion, 'YXZ');

                    // Smoothly rotate the model's Y rotation (heading)
                    modelEuler.y = THREE.MathUtils.lerp(
                        modelEuler.y,
                        targetRotation,
                        deltaTime * 5
                    );

                    // Create a quaternion just for the heading change
                    const headingQuat = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, modelEuler.y, 0));

                    // Apply the new heading while preserving the up orientation
                    // (This is a simplification - for a complete solution we would decompose the full orientation)
                    const upQuat = new THREE.Quaternion().setFromEuler(
                        new THREE.Euler(modelEuler.x, 0, modelEuler.z)
                    );

                    // Combine the rotations (heading first, then up orientation)
                    const finalQuat = new THREE.Quaternion().multiplyQuaternions(upQuat, headingQuat);

                    // Apply to model
                    this.model.quaternion.copy(finalQuat);
                }
            }
        }
    }

    updateJetpackFlame(): void {
        // Show flame when jetpack is active
        if (this.jetpackActive && this.fuel > 0) {
            this.flame.visible = true;

            // Animate flame
            this.flame.scale.set(
                1 + Math.random() * 0.2,
                1 + Math.random() * 0.5,
                1 + Math.random() * 0.2
            );
        } else {
            this.flame.visible = false;
        }
    }

    setJetpackActive(active: boolean): void {
        this.jetpackActive = active;
    }

    setDownThrustersActive(active: boolean): void {
        this.downThrustersActive = active;
    }

    // Getters/setters for controlling rotation - updated for two-part system
    setRotationFromCamera(): void {
        // In our new system, we extract the body orientation from the camera's
        // This maintains compatibility with any code that calls this method

        // Copy camera orientation to body quaternion
        this.bodyQuaternion.copy(this.camera.quaternion);

        // Reset head rotation (assume camera orientation becomes the new base)
        this.headRotation.set(0, 0, 0);

        // Update legacy properties for compatibility
        this.quaternion.copy(this.bodyQuaternion);
        this.rotation.setFromQuaternion(this.quaternion);
    }

    // Apply external rotation to player - updated for two-part system
    setRotationFromQuaternion(quaternion: THREE.Quaternion): void {
        // Update body orientation with the provided quaternion
        this.bodyQuaternion.copy(quaternion);

        // Reset head rotation since we're setting a new base orientation
        this.headRotation.set(0, 0, 0);

        // Update legacy properties for compatibility
        this.quaternion.copy(this.bodyQuaternion);
        this.rotation.setFromQuaternion(this.quaternion);

        // Note: We no longer directly set camera quaternion
        // This will happen naturally in the next update cycle
    }

    // Helper method to get the complete final orientation (body + head)
    getCombinedQuaternion(): THREE.Quaternion {
        // Convert head rotation to quaternion
        const headQuat = new THREE.Quaternion().setFromEuler(this.headRotation);

        // Combine body orientation with head rotation
        return this.bodyQuaternion.clone().multiply(headQuat);
    }

    // Physics-based alignment system - now only affects body orientation
    alignWithSurface(upDirection: THREE.Vector3, deltaTime: number, alignmentSpeed: number): boolean {
        // Don't align in noclip mode
        if (this.noclip) {
            return false;
        }

        // Store up direction for reference
        this.currentUpDirection = upDirection.clone();

        // Get physics and planets data from game if available
        const physics = window.game?.physics;
        const planets = window.game?.world?.planets || [];

        // 1. Calculate gravitational influence to determine alignment strength
        let gravityFactor = 0;
        let nearestPlanet: THREE.Mesh | null = null;
        let minDistance = Infinity;
        let escapeVelocity = 0;

        // Find nearest planet and calculate its gravitational influence
        for (const planet of planets) {
            if (!planet || !planet.geometry || !planet.position) continue;

            const planetGeometry = planet.geometry as THREE.SphereGeometry;
            const planetMass = planetGeometry.parameters.radius * 10; // Mass proportional to radius
            const distance = Math.max(0.1, this.position.distanceTo(planet.position));
            const surfaceDistance = distance - planetGeometry.parameters.radius;

            // Calculate escape velocity for this planet
            const planetEscapeVel = Math.sqrt(2 * (physics?.gravitationalConstant || 100) * planetMass / distance) || 0;

            // Calculate gravity influence using inverse square law
            const planetGravityFactor = ((physics?.gravitationalConstant || 100) * planetMass) / (distance * distance);

            if (surfaceDistance < minDistance) {
                minDistance = surfaceDistance;
                nearestPlanet = planet;
                escapeVelocity = planetEscapeVel;
                gravityFactor = planetGravityFactor;
            }
        }

        // If no planets or very far away, no alignment needed
        if (!nearestPlanet || minDistance > 500) {
            this.alignmentNeeded = 0;
            return false;
        }

        // 2. Calculate how much the player should align based on physics
        // Normalize gravity factor to 0-1 range (1 = full alignment, 0 = no alignment)
        let alignFactor = Math.min(1.0, gravityFactor * 0.1);

        // Calculate player velocity relative to escape velocity
        const velocityMagnitude = this.velocity.length();
        const velocityRatio = velocityMagnitude / Math.max(0.1, escapeVelocity);

        // Reduce alignment as velocity approaches escape velocity
        if (velocityRatio > 0.5) {
            alignFactor *= Math.max(0, 1 - (velocityRatio - 0.5) * 2);
        }

        // Force full alignment when on ground
        if (this.onGround) {
            alignFactor = 1.0;
        }

        // Store alignment needed for reference
        this.alignmentNeeded = alignFactor;

        // 3. Create target orientation - this is now ONLY for the body, not the head/camera

        // Calculate the current heading direction (horizontal direction in world space)
        // We use the body's current orientation to extract heading
        const bodyEuler = new THREE.Euler().setFromQuaternion(this.bodyQuaternion, 'YXZ');
        const headingY = bodyEuler.y; // This preserves which way the player is facing

        // Create an orthogonal basis aligned with the planet surface
        const planetRight = new THREE.Vector3(1, 0, 0);
        // If upDirection is too close to worldRight, use a different reference vector
        if (Math.abs(upDirection.dot(planetRight)) > 0.9) {
            planetRight.set(0, 0, 1);
        }

        // Calculate perpendicular vectors to create an aligned coordinate system
        const planetForward = new THREE.Vector3().crossVectors(planetRight, upDirection).normalize();
        planetRight.crossVectors(upDirection, planetForward).normalize();

        // Create matrix for base alignment with surface (ignoring heading)
        const baseAlignMatrix = new THREE.Matrix4().makeBasis(
            planetRight,
            upDirection,
            planetForward.clone().negate() // Forward is -Z in ThreeJS
        );

        // Convert to quaternion for the basic surface alignment
        const baseAlignQuat = new THREE.Quaternion().setFromRotationMatrix(baseAlignMatrix);

        // Now add the heading rotation around the planet's up direction
        const headingQuat = new THREE.Quaternion().setFromAxisAngle(upDirection, headingY);

        // Combine to get oriented alignment (aligned with surface but preserving heading)
        const targetBodyQuat = baseAlignQuat.clone().premultiply(headingQuat);

        // 4. Apply alignment only to the body quaternion with appropriate strength

        // Calculate effective alignment strength - more aggressive alignment
        const effectiveStrength = this.onGround ?
            1.0 : // Immediate full alignment when on ground
            Math.min(1.0, alignFactor * alignmentSpeed * deltaTime * 30); // Increased multiplier for faster alignment

        // Store for diagnostics
        this.alignmentStrength = effectiveStrength;

        // Apply alignment to body quaternion only
        this.bodyQuaternion.slerp(targetBodyQuat, effectiveStrength);

        // Return true if we're well-aligned
        return alignFactor < 0.1;
    }

    getControls(): PointerLockControls {
        return this.pointerLockControls;
    }

    isPointerLocked(): boolean {
        return this.pointerLockControls.isLocked;
    }
}
