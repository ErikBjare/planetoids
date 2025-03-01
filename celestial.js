import * as THREE from 'three';

export class CelestialFactory {
    constructor() {
        // Configuration options
    }
    
    createSun(scene) {
        // Create sun
        const sunGeometry = new THREE.SphereGeometry(50, 32, 32);
        const sunMaterial = new THREE.MeshBasicMaterial({ 
            color: 0xffff00,
        });
        const sun = new THREE.Mesh(sunGeometry, sunMaterial);
        sun.userData.isSun = true;
        scene.add(sun);
        
        // Add sun light with greater intensity and range
        const sunLight = new THREE.PointLight(0xffffff, 1.5, 10000);
        sun.add(sunLight);
        
        // Create stronger ambient light for general visibility
        const ambientLight = new THREE.AmbientLight(0xffffff, 0.5); // Brighter ambient
        scene.add(ambientLight);
        
        // Add hemisphere light for better overall lighting
        const hemisphereLight = new THREE.HemisphereLight(0xffffbb, 0x080820, 0.5);
        scene.add(hemisphereLight);
        
        return sun;
    }
    
    createStarfield(scene) {
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
    createNebula(scene) {
        const size = 5000;
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
    createAsteroidBelt(scene, innerRadius, outerRadius, count = 200) {
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
    updateAsteroidBelt(asteroidBelt, deltaTime) {
        if (!asteroidBelt) return;
        
        // Update each asteroid
        asteroidBelt.children.forEach(asteroid => {
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
