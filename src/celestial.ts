import * as THREE from 'three';

export class CelestialFactory {
    constructor() {
        // Configuration options
    }

    createSun(scene: THREE.Scene): THREE.Mesh {
        // Create sun
        const sunGeometry = new THREE.SphereGeometry(50, 32, 32);
        const sunMaterial = new THREE.MeshStandardMaterial({
            color: 0xffff00,
            emissive: 0xffff00,
            emissiveIntensity: 1.0
        });
        const sun = new THREE.Mesh(sunGeometry, sunMaterial);
        sun.userData.isSun = true;
        scene.add(sun);

        // Create a sun glow effect
        const glowGeometry = new THREE.SphereGeometry(60, 32, 32);
        const glowMaterial = new THREE.ShaderMaterial({
            uniforms: {
                'c': { value: 0.2 },
                'p': { value: 1.2 },
                glowColor: { value: new THREE.Color(0xffdd66) },
                viewVector: { value: new THREE.Vector3(0, 0, 0) }
            },
            vertexShader: `
                uniform vec3 viewVector;
                uniform float c;
                uniform float p;
                varying float intensity;
                void main() {
                    vec3 vNormal = normalize(normalMatrix * normal);
                    vec3 vNormel = normalize(normalMatrix * viewVector);
                    intensity = pow(c - dot(vNormal, vNormel), p);
                    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
                }
            `,
            fragmentShader: `
                uniform vec3 glowColor;
                varying float intensity;
                void main() {
                    vec3 glow = glowColor * intensity;
                    gl_FragColor = vec4(glow, 1.0);
                }
            `,
            side: THREE.BackSide,
            blending: THREE.AdditiveBlending,
            transparent: true
        });

        const sunGlow = new THREE.Mesh(glowGeometry, glowMaterial);
        sun.add(sunGlow);

        // LIGHTING OVERHAUL:

        // 1. Directional light - like the sun's rays, no falloff with distance
        const sunDirectional = new THREE.DirectionalLight(0xffffff, 1.0);
        sunDirectional.castShadow = true;
        sunDirectional.shadow.mapSize.width = 2048;
        sunDirectional.shadow.mapSize.height = 2048;

        // More balanced shadow volume - not too large to maintain quality
        const d = 1000; // Reduced from 2000 to provide higher resolution shadows
        sunDirectional.shadow.camera.left = -d;
        sunDirectional.shadow.camera.right = d;
        sunDirectional.shadow.camera.top = d;
        sunDirectional.shadow.camera.bottom = -d;
        sunDirectional.shadow.camera.near = 1; // Slightly increased to avoid artifacts at very close range
        sunDirectional.shadow.camera.far = 3000; // Reduced to focus shadow detail where needed

        // Carefully tuned shadow bias to prevent shadow acne while minimizing peter-panning
        sunDirectional.shadow.bias = -0.0005; // Reduced bias value helps with shadow cutoff issues
        sunDirectional.shadow.normalBias = 0.02; // Adding normal bias for better surface contact shadows

        // Improved shadow map settings
        sunDirectional.shadow.mapSize.width = 4096; // Doubled for higher detail
        sunDirectional.shadow.mapSize.height = 4096;

        // Improved PCF filtering for softer shadow edges
        sunDirectional.shadow.radius = 1.5;

        scene.add(sunDirectional);
        sun.userData.directionalLight = sunDirectional;

        // 2. High-intensity point light with VERY slow falloff for local emphasis
        const sunPointLight = new THREE.PointLight(0xffdd66, 5.0, 2000, 0.5); // 0.5 is decay rate (slower than default 2)
        sunPointLight.castShadow = false; // Directional light handles shadows
        sun.add(sunPointLight);

        // 3. Ambient light - slightly brighter to prevent completely dark shadowed areas
        const ambientLight = new THREE.AmbientLight(0x303040, 0.3);
        scene.add(ambientLight);

        // 4. Hemisphere light for better sky/ground distinction
        const hemisphereLight = new THREE.HemisphereLight(0xffffbb, 0x080820, 0.5);
        scene.add(hemisphereLight);

        // Store lights for later reference/updates
        sun.userData.lights = {
            directional: sunDirectional,
            point: sunPointLight,
            ambient: ambientLight,
            hemisphere: hemisphereLight
        };

        // Create a lens flare update function for future use
        sun.userData.updateFlare = (camera: THREE.Camera) => {
            // Update the glow shader view vector based on camera position
            if (glowMaterial.uniforms && camera) {
                const viewVector = new THREE.Vector3().subVectors(camera.position, sun.position);
                glowMaterial.uniforms.viewVector.value = viewVector;
            }
        };

        return sun;
    }

    // Method to update sun position and lighting
    updateSun(sun: THREE.Mesh, deltaTime: number, camera?: THREE.Camera): void {
        if (!sun) return;

        // Update any directional lights to follow the camera
        // This makes shadows work properly as the player moves around
        if (sun.userData.directionalLight && camera) {
            // Update directional light position to always cast shadows toward camera
            const dirLight = sun.userData.directionalLight as THREE.DirectionalLight;

            // Position the directional light at the sun's position
            dirLight.position.copy(sun.position);

            // Make the directional light point from sun toward the origin
            dirLight.target.position.set(0, 0, 0);
        }

        // Update lens flare and glow effects
        if (sun.userData.updateFlare && camera) {
            sun.userData.updateFlare(camera);
        }
    }

    createStarfield(scene: THREE.Scene): THREE.Points {
        // Create a starfield in the background
        const starCount = 2000;
        const starsGeometry = new THREE.BufferGeometry();
        const starPositions = new Float32Array(starCount * 3);

        for (let i = 0; i < starCount; i++) {
            const i3 = i * 3;
            // Create stars in a large sphere around the scene
            const radius = 5000;
            const theta = Math.random() * Math.PI * 2;
            const phi = Math.acos(Math.random() * 2 - 1);

            starPositions[i3] = radius * Math.sin(phi) * Math.cos(theta);
            starPositions[i3 + 1] = radius * Math.sin(phi) * Math.sin(theta);
            starPositions[i3 + 2] = radius * Math.cos(phi);
        }

        starsGeometry.setAttribute('position', new THREE.BufferAttribute(starPositions, 3));

        const starsMaterial = new THREE.PointsMaterial({
            color: 0xffffff,
            size: 2,
            sizeAttenuation: false
        });

        const starfield = new THREE.Points(starsGeometry, starsMaterial);
        scene.add(starfield);

        return starfield;
    }

    // Create a distant nebula
    createNebula(scene: THREE.Scene): THREE.Points {
        // Size is used to determine the scale of the nebula (but not directly referenced)
        const nebulaSizeRange = 5000;
        const geometry = new THREE.BufferGeometry();
        const particles = 2000;

        const positions = new Float32Array(particles * 3);
        const colors = new Float32Array(particles * 3);

        const colorChoices = [
            new THREE.Color(0x3355ff), // Blue
            new THREE.Color(0xff5533), // Orange
            new THREE.Color(0x33ff55), // Green
            new THREE.Color(0xaa33ff)  // Purple
        ];

        // Position the nebula evenly around the scene
        for (let i = 0; i < particles; i++) {
            const i3 = i * 3;

            // Use spherical coordinates to distribute particles
            const radius = 4000 + Math.random() * 1000;
            const theta = Math.random() * Math.PI * 2;
            const phi = Math.acos(Math.random() * 2 - 1);

            // Convert to Cartesian coordinates
            positions[i3] = radius * Math.sin(phi) * Math.cos(theta);
            positions[i3 + 1] = radius * Math.sin(phi) * Math.sin(theta);
            positions[i3 + 2] = radius * Math.cos(phi);

            // Random color from choices
            const color = colorChoices[Math.floor(Math.random() * colorChoices.length)];
            color.toArray(colors, i3);
        }

        geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

        const material = new THREE.PointsMaterial({
            size: 15,
            transparent: true,
            opacity: 0.8,
            vertexColors: true,
            sizeAttenuation: true,
            blending: THREE.AdditiveBlending
        });

        const nebula = new THREE.Points(geometry, material);
        scene.add(nebula);

        return nebula;
    }

    // Create asteroid belt between planets
    createAsteroidBelt(scene: THREE.Scene, innerRadius: number, outerRadius: number, count = 200): THREE.Group {
        const asteroids = new THREE.Group();

        for (let i = 0; i < count; i++) {
            // Random size for each asteroid
            const size = 1 + Math.random() * 5;
            const geometry = new THREE.DodecahedronGeometry(size, 0);

            // Random color variations of gray
            const grayness = 0.4 + Math.random() * 0.2;
            const material = new THREE.MeshStandardMaterial({
                color: new THREE.Color(grayness, grayness, grayness),
                roughness: 0.9,
                metalness: 0.1
            });

            const asteroid = new THREE.Mesh(geometry, material);

            // Position in a ring with some variation in height
            const radius = innerRadius + Math.random() * (outerRadius - innerRadius);
            const angle = Math.random() * Math.PI * 2;

            asteroid.position.x = Math.cos(angle) * radius;
            asteroid.position.y = (Math.random() * 2 - 1) * 30;
            asteroid.position.z = Math.sin(angle) * radius;

            // Random rotation
            asteroid.rotation.x = Math.random() * Math.PI;
            asteroid.rotation.y = Math.random() * Math.PI;
            asteroid.rotation.z = Math.random() * Math.PI;

            // Add some orbital data for movement
            asteroid.userData = {
                orbitRadius: radius,
                orbitSpeed: 0.00005 + Math.random() * 0.00005,
                orbitAngle: angle,
                rotationSpeed: {
                    x: Math.random() * 0.01,
                    y: Math.random() * 0.01,
                    z: Math.random() * 0.01
                }
            };

            asteroids.add(asteroid);
        }

        scene.add(asteroids);
        return asteroids;
    }

    // Update the asteroid belt rotation
    updateAsteroidBelt(asteroidBelt: THREE.Group, deltaTime: number): void {
        if (!asteroidBelt) return;

        // Update each asteroid
        asteroidBelt.children.forEach(asteroid => {
            if (!asteroid.userData) return;

            // Update orbital position
            asteroid.userData.orbitAngle += asteroid.userData.orbitSpeed * deltaTime;
            const radius = asteroid.userData.orbitRadius;

            asteroid.position.x = Math.cos(asteroid.userData.orbitAngle) * radius;
            asteroid.position.z = Math.sin(asteroid.userData.orbitAngle) * radius;

            // Rotate the asteroid
            asteroid.rotation.x += asteroid.userData.rotationSpeed.x * deltaTime;
            asteroid.rotation.y += asteroid.userData.rotationSpeed.y * deltaTime;
            asteroid.rotation.z += asteroid.userData.rotationSpeed.z * deltaTime;
        });
    }
}
