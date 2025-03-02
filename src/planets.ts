import * as THREE from 'three';
import { PlanetConfig } from './types';

export class PlanetFactory {
    planetConfigs: PlanetConfig[];

    constructor() {
        this.planetConfigs = [
            {
                name: 'Home',
                distance: 600,
                size: 100,
                color: 0x3a9d23,
                orbitSpeed: 0.0001,
                rotationSpeed: 0.0005,
                features: ['home'],
                upgrade: 'Basic Scanner'
            },
            {
                name: 'Rocky',
                distance: 400,
                size: 60,
                color: 0x9d6b3a,
                orbitSpeed: 0.00015,
                rotationSpeed: 0.0008,
                features: ['rocky'],
                upgrade: 'Improved Thrusters'
            },
            {
                name: 'Icy',
                distance: 900,
                size: 120,
                color: 0x91d5fa,
                orbitSpeed: 0.00008,
                rotationSpeed: 0.0003,
                features: ['icy'],
                upgrade: 'Enhanced Fuel Capacity'
            },
            {
                name: 'Desert',
                distance: 1200,
                size: 90,
                color: 0xd6c48d,
                orbitSpeed: 0.00005,
                rotationSpeed: 0.0004,
                features: ['desert'],
                upgrade: 'Advanced Scanner'
            },
            {
                name: 'Mysterious',
                distance: 1800,
                size: 150,
                color: 0x614785,
                orbitSpeed: 0.00003,
                rotationSpeed: 0.0002,
                features: ['mysterious'],
                upgrade: 'Warp Drive'
            }
        ];
    }

    createPlanets(scene: THREE.Scene): THREE.Mesh[] {
        const planets: THREE.Mesh[] = [];

        // Create planets
        this.planetConfigs.forEach((config, index) => {
            const planet = this.createPlanet(config, index, scene);
            planets.push(planet);
        });

        return planets;
    }

    createPlanet(config: PlanetConfig, index: number, scene: THREE.Scene): THREE.Mesh {
        // Create planet with improved material for better lighting
        const planetGeometry = new THREE.SphereGeometry(config.size, 32, 32);
        const planetMaterial = new THREE.MeshStandardMaterial({
            color: config.color,
            roughness: 0.7,
            metalness: 0.1,
            // Lower emissive intensity to allow day/night contrast
            emissive: new THREE.Color(config.color).multiplyScalar(0.05),
            emissiveIntensity: 0.1
        });
        const planet = new THREE.Mesh(planetGeometry, planetMaterial);

        // Enable shadows
        planet.castShadow = true;
        planet.receiveShadow = true;

        // Position planet
        const angle = Math.random() * Math.PI * 2;
        planet.position.x = Math.cos(angle) * config.distance;
        planet.position.z = Math.sin(angle) * config.distance;

        // Create orbit path (visible ring)
        const orbitGeometry = new THREE.RingGeometry(config.distance - 1, config.distance + 1, 128);
        const orbitMaterial = new THREE.MeshBasicMaterial({
            color: 0xffffff,
            side: THREE.DoubleSide,
            transparent: true,
            opacity: 0.2
        });
        const orbitPath = new THREE.Mesh(orbitGeometry, orbitMaterial);
        orbitPath.rotation.x = Math.PI / 2;
        scene.add(orbitPath);

        // Add planet data
        planet.userData = {
            name: config.name,
            distance: config.distance,
            orbitSpeed: config.orbitSpeed,
            rotationSpeed: config.rotationSpeed,
            orbitalAngle: angle,
            features: config.features,
            upgrade: config.upgrade,
            index: index,
            // Add day/night cycle tracking
            dayTime: Math.random() * Math.PI * 2, // Random initial time of day
            dayLength: 60 + Math.random() * 60 // Day length between 60-120 seconds
        };

        // Add atmosphere layer for planets (except sun)
        this.addAtmosphere(planet, config);

        // Add terrain features to planet
        this.addFeatures(planet, config);

        // Add city lights that will only be visible at night
        this.addNightLights(planet, config);

        scene.add(planet);
        return planet;
    }

    // Add atmospheric glow to planets
    addAtmosphere(planet: THREE.Mesh, config: PlanetConfig): THREE.Mesh | undefined {
        // Skip for planets without atmosphere
        if (config.features.includes('airless')) return;

        const planetGeometry = planet.geometry as THREE.SphereGeometry;
        const planetRadius = planetGeometry.parameters.radius;
        console.log(planetRadius);
        const atmosphereSize = planetRadius * 1.25; // 5% larger than the planet + 5m

        // Create slightly larger sphere for the atmosphere
        const atmosphereGeometry = new THREE.SphereGeometry(atmosphereSize, 32, 32);

        // Determine atmosphere color based on planet type
        let atmosphereColor;
        if (config.features.includes('home')) {
            atmosphereColor = new THREE.Color(0x4f99e8); // Earth-like blue
        } else if (config.features.includes('icy')) {
            atmosphereColor = new THREE.Color(0xc0e8ff); // Light blue for icy
        } else if (config.features.includes('desert')) {
            atmosphereColor = new THREE.Color(0xe8c090); // Tan/orange for desert
        } else if (config.features.includes('mysterious')) {
            atmosphereColor = new THREE.Color(0x8060a0); // Purple for mysterious
        } else {
            atmosphereColor = new THREE.Color(0xa0a0a0); // Default gray
        }

        // Create shader material for atmospheric effect
        const atmosphereMaterial = new THREE.ShaderMaterial({
            uniforms: {
                planetRadius: { value: planetRadius },
                atmosphereRadius: { value: atmosphereSize },
                atmosphereColor: { value: atmosphereColor }
            },
            vertexShader: `
                varying vec3 vNormal;
                varying vec3 vPosition;

                void main() {
                    vNormal = normalize(normalMatrix * normal);
                    vPosition = (modelViewMatrix * vec4(position, 1.0)).xyz;
                    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
                }
            `,
            fragmentShader: `
                uniform float planetRadius;
                uniform float atmosphereRadius;
                uniform vec3 atmosphereColor;

                varying vec3 vNormal;
                varying vec3 vPosition;

                void main() {
                    float intensity = pow(0.75 - dot(vNormal, vec3(0, 0, 1.0)), 2.0);
                    gl_FragColor = vec4(atmosphereColor, intensity * 0.3);
                }
            `,
            transparent: true,
            side: THREE.BackSide,
            blending: THREE.AdditiveBlending
        });

        const atmosphere = new THREE.Mesh(atmosphereGeometry, atmosphereMaterial);
        atmosphere.userData.isAtmosphere = true;
        planet.add(atmosphere);

        return atmosphere;
    }

    // Add city lights that will be visible only at night
    addNightLights(planet: THREE.Mesh, config: PlanetConfig): THREE.Mesh | undefined {
        // Skip for planets that don't have cities
        if (config.features.includes('airless') ||
            config.features.includes('icy') ||
            (typeof config.index === 'number' && config.index > 0 && config.index < 4)) return;

        const planetGeometry = planet.geometry as THREE.SphereGeometry;
        const planetRadius = planetGeometry.parameters.radius;

        // Create a sphere slightly larger than the planet for night lights
        const lightsGeometry = new THREE.SphereGeometry(planetRadius * 1.001, 32, 32);

        // Create a texture for night lights - we'll use a simple procedural approach
        const canvas = document.createElement('canvas');
        canvas.width = 512;
        canvas.height = 256;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        // Fill with black
        ctx.fillStyle = 'black';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        // Add random city lights
        ctx.fillStyle = 'rgba(255, 255, 170, 0.8)';

        // Different patterns for different planet types
        if (config.features.includes('home')) {
            // More organized pattern for home planet
            for (let i = 0; i < 40; i++) {
                const x = Math.random() * canvas.width;
                const y = Math.random() * canvas.height;
                const size = 1 + Math.random() * 3;
                ctx.globalAlpha = 0.5 + Math.random() * 0.5;
                ctx.beginPath();
                ctx.arc(x, y, size, 0, Math.PI * 2);
                ctx.fill();

                // Add a "city" with a few lights around it
                if (Math.random() > 0.5) {
                    for (let j = 0; j < 5; j++) {
                        const angle = Math.random() * Math.PI * 2;
                        const distance = 5 + Math.random() * 10;
                        const cx = x + Math.cos(angle) * distance;
                        const cy = y + Math.sin(angle) * distance;
                        const dotSize = 0.5 + Math.random();
                        ctx.globalAlpha = 0.3 + Math.random() * 0.4;
                        ctx.beginPath();
                        ctx.arc(cx, cy, dotSize, 0, Math.PI * 2);
                        ctx.fill();
                    }
                }
            }
        } else if (config.features.includes('mysterious')) {
            // Alien geometric patterns for mysterious planet
            for (let i = 0; i < 10; i++) {
                const x = Math.random() * canvas.width;
                const y = Math.random() * canvas.height;
                const size = 10 + Math.random() * 20;
                ctx.globalAlpha = 0.6 + Math.random() * 0.4;

                // Create alien patterns
                ctx.beginPath();
                if (Math.random() > 0.5) {
                    // Circular pattern
                    for (let j = 0; j < 8; j++) {
                        const angle = (j / 8) * Math.PI * 2;
                        const dist = size;
                        const cx = x + Math.cos(angle) * dist;
                        const cy = y + Math.sin(angle) * dist;
                        ctx.lineTo(cx, cy);
                    }
                } else {
                    // Line pattern
                    for (let j = 0; j < 3; j++) {
                        const x1 = x + (Math.random() - 0.5) * size * 2;
                        const y1 = y + (Math.random() - 0.5) * size * 2;
                        ctx.lineTo(x1, y1);
                    }
                }
                ctx.closePath();
                ctx.fill();
            }
        }

        // Create texture from canvas
        const texture = new THREE.CanvasTexture(canvas);

        // Create material for night lights
        const lightsMaterial = new THREE.MeshBasicMaterial({
            map: texture,
            transparent: true,
            opacity: 0.9,
            blending: THREE.AdditiveBlending,
            side: THREE.FrontSide
        });

        const nightLights = new THREE.Mesh(lightsGeometry, lightsMaterial);
        nightLights.rotation.y = Math.random() * Math.PI * 2; // Random rotation
        nightLights.userData.isNightLights = true;

        planet.add(nightLights);
        planet.userData.nightLights = nightLights;

        // Hide lights initially - they'll be shown during night cycle
        nightLights.visible = false;

        return nightLights;
    }

    addFeatures(planet: THREE.Mesh, config: PlanetConfig): void {
        if (config.features.includes('home')) {
            this.addHomeFeatures(planet);
        } else if (config.features.includes('rocky')) {
            this.addRockyFeatures(planet);
        } else if (config.features.includes('icy')) {
            this.addIcyFeatures(planet);
        } else if (config.features.includes('desert')) {
            this.addDesertFeatures(planet);
        } else if (config.features.includes('mysterious')) {
            this.addMysteriousFeatures(planet);
        }
    }

    // Helper method to position objects on a planet's surface
    positionOnPlanet(planet: THREE.Mesh, angle1: number, angle2: number): THREE.Vector3 {
        // Position an object on the surface of a planet
        // angle1 is the longitude, angle2 is the latitude
        const planetGeometry = planet.geometry as THREE.SphereGeometry;
        const planetRadius = planetGeometry.parameters.radius;
        const x = planetRadius * Math.cos(angle1) * Math.cos(angle2);
        const y = planetRadius * Math.sin(angle2);
        const z = planetRadius * Math.sin(angle1) * Math.cos(angle2);

        return new THREE.Vector3(x, y, z).add(planet.position);
    }

    // Create a basic tree
    createTree(): THREE.Group {
        const treeGroup = new THREE.Group();

        // Trunk
        const trunkGeometry = new THREE.CylinderGeometry(1, 1.5, 10);
        const trunkMaterial = new THREE.MeshLambertMaterial({ color: 0x8b4513 });
        const trunk = new THREE.Mesh(trunkGeometry, trunkMaterial);
        trunk.position.y = 5;
        treeGroup.add(trunk);

        // Foliage (multiple layers for fuller appearance)
        const foliageColor = 0x2d5e24;
        const foliageMaterial = new THREE.MeshLambertMaterial({ color: foliageColor });

        const foliage1 = new THREE.Mesh(
            new THREE.ConeGeometry(5, 8, 8),
            foliageMaterial
        );
        foliage1.position.y = 12;
        treeGroup.add(foliage1);

        const foliage2 = new THREE.Mesh(
            new THREE.ConeGeometry(4, 7, 8),
            foliageMaterial
        );
        foliage2.position.y = 16;
        treeGroup.add(foliage2);

        const foliage3 = new THREE.Mesh(
            new THREE.ConeGeometry(3, 5, 8),
            foliageMaterial
        );
        foliage3.position.y = 19;
        treeGroup.add(foliage3);

        return treeGroup;
    }

    // Add features to Home planet
    addHomeFeatures(planet: THREE.Mesh): void {
        const planetGeometry = planet.geometry as THREE.SphereGeometry;
        const planetRadius = planetGeometry.parameters.radius;

        // IMPROVED PLACEMENT: House
        const houseGroup = new THREE.Group();

        // Main structure
        const houseGeometry = new THREE.BoxGeometry(20, 15, 15);
        const houseMaterial = new THREE.MeshLambertMaterial({ color: 0xd69d61 });
        const house = new THREE.Mesh(houseGeometry, houseMaterial);
        house.position.y = 7.5;
        houseGroup.add(house);

        // Roof
        const roofGeometry = new THREE.ConeGeometry(15, 10, 4);
        const roofMaterial = new THREE.MeshLambertMaterial({ color: 0x8b4513 });
        const roof = new THREE.Mesh(roofGeometry, roofMaterial);
        roof.position.y = 20;
        roof.rotation.y = Math.PI / 4;
        houseGroup.add(roof);

        // Door
        const doorGeometry = new THREE.PlaneGeometry(5, 8);
        const doorMaterial = new THREE.MeshLambertMaterial({ color: 0x8b4513 });
        const door = new THREE.Mesh(doorGeometry, doorMaterial);
        door.position.set(0, 5, 7.6);
        houseGroup.add(door);

        // Position house directly on top of the planet (north pole)
        // This ensures it's exactly at the surface
        const houseDirection = new THREE.Vector3(0, 1, 0);
        const housePosition = houseDirection.clone().multiplyScalar(planetRadius);
        houseGroup.position.copy(housePosition);

        // Align the house with the planet surface normal
        houseGroup.up = houseDirection.clone();
        houseGroup.lookAt(housePosition.clone().add(new THREE.Vector3(0, 0, 1)));

        // Attach house directly to planet
        planet.add(houseGroup);

        // IMPROVED: Trees placement
        for (let i = 0; i < 20; i++) {
            const treeGroup = this.createTree();

            // Place trees randomly on the northern hemisphere
            const phi = Math.random() * Math.PI / 2; // 0 to PI/2 (north hemisphere only)
            const theta = Math.random() * Math.PI * 2; // 0 to 2*PI (all around)

            // Convert spherical to cartesian coordinates
            const x = planetRadius * Math.sin(phi) * Math.cos(theta);
            const y = planetRadius * Math.cos(phi);
            const z = planetRadius * Math.sin(phi) * Math.sin(theta);

            // Create direction vector from planet center to tree position
            const treeDirection = new THREE.Vector3(x, y, z).normalize();
            const treePosition = treeDirection.clone().multiplyScalar(planetRadius);

            // Position tree
            treeGroup.position.copy(treePosition);

            // Orient tree to be perpendicular to planet surface
            treeGroup.up = treeDirection.clone();

            // Make tree "look" in a tangent direction to the surface
            const tangent = new THREE.Vector3().crossVectors(treeDirection, new THREE.Vector3(0, 1, 0)).normalize();
            if (tangent.length() < 0.1) {
                tangent.set(1, 0, 0); // Fallback if tangent is too small
            }
            const lookTarget = treePosition.clone().add(tangent);
            treeGroup.lookAt(lookTarget);

            planet.add(treeGroup);
        }

        // IMPROVED: Mountain ridge
        const mountainGroup = new THREE.Group();
        for (let i = 0; i < 5; i++) {
            const height = 25 + Math.random() * 15;
            const mountainGeometry = new THREE.ConeGeometry(15, height, 4);
            const mountainMaterial = new THREE.MeshLambertMaterial({ color: 0x736f6d });
            const mountain = new THREE.Mesh(mountainGeometry, mountainMaterial);
            mountain.position.x = i * 15 - 30;
            mountain.position.y = height / 2;
            mountainGroup.add(mountain);
        }

        // Place mountain on the opposite side from the house
        const mountainDirection = new THREE.Vector3(0, -1, 0);
        const mountainPosition = mountainDirection.clone().multiplyScalar(planetRadius);

        mountainGroup.position.copy(mountainPosition);
        mountainGroup.up = mountainDirection.clone();
        mountainGroup.lookAt(mountainPosition.clone().add(new THREE.Vector3(0, 0, 1)));

        planet.add(mountainGroup);

        // IMPROVED: Pond
        const pondGeometry = new THREE.CircleGeometry(15, 32);
        const pondMaterial = new THREE.MeshLambertMaterial({
            color: 0x5580aa,
            transparent: true,
            opacity: 0.8
        });
        const pond = new THREE.Mesh(pondGeometry, pondMaterial);

        // Place pond on the "equator"
        const pondDirection = new THREE.Vector3(1, 0, 0);
        const pondPosition = pondDirection.clone().multiplyScalar(planetRadius);

        pond.position.copy(pondPosition);

        // Orient pond to face outward from planet center
        pond.up = pondDirection.clone();
        pond.lookAt(pondPosition.clone().add(new THREE.Vector3(0, 1, 0)));

        planet.add(pond);

        // IMPROVED: Upgrade station for home planet
        const stationDirection = new THREE.Vector3(0.5, 0.866, 0); // 60 degrees from vertical
        this.addImprovedUpgradeStation(planet, stationDirection, 'default');
    }

    // Add features to Rocky planet
    addRockyFeatures(planet: THREE.Mesh): void {
        const planetGeometry = planet.geometry as THREE.SphereGeometry;
        const planetRadius = planetGeometry.parameters.radius;

        // Add some rock formations with improved placement
        for (let i = 0; i < 30; i++) {
            const rockSize = 5 + Math.random() * 10;
            const rockGeometry = new THREE.DodecahedronGeometry(rockSize, 0);
            const rockMaterial = new THREE.MeshLambertMaterial({
                color: 0x7a7a7a
            });
            const rock = new THREE.Mesh(rockGeometry, rockMaterial);

            // Random position on planet
            const phi = Math.random() * Math.PI; // 0 to PI
            const theta = Math.random() * Math.PI * 2; // 0 to 2*PI

            // Convert spherical to cartesian coordinates
            const x = planetRadius * Math.sin(phi) * Math.cos(theta);
            const y = planetRadius * Math.cos(phi);
            const z = planetRadius * Math.sin(phi) * Math.sin(theta);

            // Create direction vector from planet center to rock position
            const rockDirection = new THREE.Vector3(x, y, z).normalize();
            const rockPosition = rockDirection.clone().multiplyScalar(planetRadius);

            // Position and orient rock
            rock.position.copy(rockPosition);
            rock.up = rockDirection.clone();

            // Random rotation around the up vector
            rock.rotateOnAxis(rockDirection, Math.random() * Math.PI * 2);

            planet.add(rock);
        }

        // IMPROVED: Research station (upgrade station)
        const stationDirection = new THREE.Vector3(0, 1, 0); // Top of planet
        this.addImprovedUpgradeStation(planet, stationDirection, 'rocky');
    }

    // Add features to Icy planet
    addIcyFeatures(planet: THREE.Mesh): void {
        const planetGeometry = planet.geometry as THREE.SphereGeometry;
        const planetRadius = planetGeometry.parameters.radius;

        // Add ice formations with improved placement
        for (let i = 0; i < 40; i++) {
            const iceSize = 5 + Math.random() * 15;
            const iceGeometry = new THREE.ConeGeometry(iceSize/3, iceSize, 5, 1);
            const iceMaterial = new THREE.MeshLambertMaterial({
                color: 0xccffff,
                transparent: true,
                opacity: 0.8
            });
            const ice = new THREE.Mesh(iceGeometry, iceMaterial);

            // Random position on planet
            const phi = Math.random() * Math.PI; // 0 to PI
            const theta = Math.random() * Math.PI * 2; // 0 to 2*PI

            // Convert spherical to cartesian coordinates
            const x = planetRadius * Math.sin(phi) * Math.cos(theta);
            const y = planetRadius * Math.cos(phi);
            const z = planetRadius * Math.sin(phi) * Math.sin(theta);

            // Create direction vector from planet center to ice position
            const iceDirection = new THREE.Vector3(x, y, z).normalize();
            const icePosition = iceDirection.clone().multiplyScalar(planetRadius);

            // Position ice
            ice.position.copy(icePosition);

            // Orient ice perpendicular to planet surface
            ice.up = iceDirection.clone();

            // Make the ice point outward from the planet
            const lookTarget = icePosition.clone().add(iceDirection);
            ice.lookAt(lookTarget);

            planet.add(ice);
        }

        // IMPROVED: Add frozen lake
        const lakeGeometry = new THREE.CircleGeometry(30, 32);
        const lakeMaterial = new THREE.MeshLambertMaterial({
            color: 0xaaddff,
            transparent: true,
            opacity: 0.7
        });
        const lake = new THREE.Mesh(lakeGeometry, lakeMaterial);

        // Place lake at a specific position (equator)
        const lakeDirection = new THREE.Vector3(1, 0, 0);
        const lakePosition = lakeDirection.clone().multiplyScalar(planetRadius);

        lake.position.copy(lakePosition);

        // Orient lake to face outward from planet center
        lake.up = lakeDirection.clone();
        lake.lookAt(lakePosition.clone().add(new THREE.Vector3(0, 1, 0)));

        planet.add(lake);

        // IMPROVED: Research station (upgrade station)
        const stationDirection = new THREE.Vector3(0, -1, 0); // Bottom of planet
        this.addImprovedUpgradeStation(planet, stationDirection, 'icy');
    }

    // Add features to Desert planet
    addDesertFeatures(planet: THREE.Mesh): void {
        const planetGeometry = planet.geometry as THREE.SphereGeometry;
        const planetRadius = planetGeometry.parameters.radius;

        // IMPROVED: Add sand dunes
        for (let i = 0; i < 20; i++) {
            const duneSize = 10 + Math.random() * 20;
            const duneGeometry = new THREE.SphereGeometry(duneSize, 8, 6, 0, Math.PI * 2, 0, Math.PI / 2);
            const duneMaterial = new THREE.MeshStandardMaterial({
                color: 0xe6c998,
                roughness: 1.0
            });
            const dune = new THREE.Mesh(duneGeometry, duneMaterial);

            // Random position on planet
            const phi = Math.random() * Math.PI; // 0 to PI
            const theta = Math.random() * Math.PI * 2; // 0 to 2*PI

            // Convert spherical to cartesian coordinates
            const x = planetRadius * Math.sin(phi) * Math.cos(theta);
            const y = planetRadius * Math.cos(phi);
            const z = planetRadius * Math.sin(phi) * Math.sin(theta);

            // Create direction vector from planet center to dune position
            const duneDirection = new THREE.Vector3(x, y, z).normalize();
            const dunePosition = duneDirection.clone().multiplyScalar(planetRadius);

            // Position dune
            dune.position.copy(dunePosition);

            // Orient dune to face outward from planet center
            dune.up = duneDirection.clone();

            // Align dune with the surface
            const lookTarget = dunePosition.clone().add(duneDirection.clone().cross(new THREE.Vector3(0, 1, 0)));
            dune.lookAt(lookTarget);

            planet.add(dune);
        }

        // IMPROVED: Add cacti
        for (let i = 0; i < 30; i++) {
            const cactusGroup = new THREE.Group();

            const height = 5 + Math.random() * 10;
            const mainGeometry = new THREE.CylinderGeometry(2, 2.5, height, 8);
            const cactusMaterial = new THREE.MeshLambertMaterial({ color: 0x2d7d3c });
            const mainCactus = new THREE.Mesh(mainGeometry, cactusMaterial);
            mainCactus.position.y = height / 2;
            cactusGroup.add(mainCactus);

            // Add arms to some cacti
            if (Math.random() > 0.5) {
                const armHeight = height * 0.6;
                const armGeometry = new THREE.CylinderGeometry(1.5, 1.5, armHeight, 8);
                const arm = new THREE.Mesh(armGeometry, cactusMaterial);
                arm.position.set(0, height * 0.7, 0);
                arm.position.x = 3;
                arm.rotation.z = Math.PI / 2;
                arm.position.y += armHeight / 4;
                cactusGroup.add(arm);

                if (Math.random() > 0.5) {
                    const arm2 = arm.clone();
                    arm2.position.x = -3;
                    arm2.rotation.z = -Math.PI / 2;
                    cactusGroup.add(arm2);
                }
            }

            // Random position on planet (preferably on equator)
            const phi = (Math.PI / 2) + (Math.random() * 0.6 - 0.3); // Around equator
            const theta = Math.random() * Math.PI * 2; // 0 to 2*PI

            // Convert spherical to cartesian coordinates
            const x = planetRadius * Math.sin(phi) * Math.cos(theta);
            const y = planetRadius * Math.cos(phi);
            const z = planetRadius * Math.sin(phi) * Math.sin(theta);

            // Create direction vector from planet center to cactus position
            const cactusDirection = new THREE.Vector3(x, y, z).normalize();
            const cactusPosition = cactusDirection.clone().multiplyScalar(planetRadius);

            // Position cactus
            cactusGroup.position.copy(cactusPosition);

            // Orient cactus to be perpendicular to planet surface
            cactusGroup.up = cactusDirection.clone();

            // Make the cactus face outward from the planet
            const lookTarget = cactusPosition.clone().add(cactusDirection);
            cactusGroup.lookAt(lookTarget);

            planet.add(cactusGroup);
        }

        // IMPROVED: Oasis
        const oasisGroup = new THREE.Group();

        const waterGeometry = new THREE.CircleGeometry(15, 32);
        const waterMaterial = new THREE.MeshLambertMaterial({
            color: 0x5580aa,
            transparent: true,
            opacity: 0.8
        });
        const water = new THREE.Mesh(waterGeometry, waterMaterial);
        oasisGroup.add(water);

        // Palm trees around oasis
        for (let i = 0; i < 5; i++) {
            const palmGroup = new THREE.Group();

            const trunkGeometry = new THREE.CylinderGeometry(1, 1.5, 15, 8);
            const trunkMaterial = new THREE.MeshLambertMaterial({ color: 0x8b6d3d });
            const trunk = new THREE.Mesh(trunkGeometry, trunkMaterial);
            trunk.position.y = 7.5;
            palmGroup.add(trunk);

            // Create palm leaves
            const leafMaterial = new THREE.MeshLambertMaterial({ color: 0x2d9d3a });
            for (let j = 0; j < 7; j++) {
                const leafGeometry = new THREE.PlaneGeometry(10, 2);
                const leaf = new THREE.Mesh(leafGeometry, leafMaterial);
                leaf.position.y = 15;
                leaf.rotation.x = Math.PI / 4;
                leaf.rotation.y = (j * Math.PI * 2) / 7;
                palmGroup.add(leaf);
            }

            const angle = (i * Math.PI * 2) / 5;
            palmGroup.position.set(Math.cos(angle) * 12, 0, Math.sin(angle) * 12);

            oasisGroup.add(palmGroup);
        }

        // Place oasis on the equator at a specific position
        const oasisDirection = new THREE.Vector3(0, 0, 1);
        const oasisPosition = oasisDirection.clone().multiplyScalar(planetRadius);

        oasisGroup.position.copy(oasisPosition);

        // Orient oasis to be perpendicular to planet surface
        oasisGroup.up = oasisDirection.clone();

        // Make the oasis face outward from the planet
        const oasisLookTarget = oasisPosition.clone().add(oasisDirection);
        oasisGroup.lookAt(oasisLookTarget);

        planet.add(oasisGroup);

        // IMPROVED: Research station (upgrade station)
        const stationDirection = new THREE.Vector3(-1, 0, 0); // Left side of planet
        this.addImprovedUpgradeStation(planet, stationDirection, 'desert');
    }

    // Add features to Mysterious planet
    addMysteriousFeatures(planet: THREE.Mesh): void {
        const planetGeometry = planet.geometry as THREE.SphereGeometry;
        const planetRadius = planetGeometry.parameters.radius;

        // IMPROVED: Add alien structures
        for (let i = 0; i < 10; i++) {
            const structureGroup = new THREE.Group();

            const height = 15 + Math.random() * 20;
            const baseGeometry = new THREE.CylinderGeometry(5, 8, height, 6);
            const baseMaterial = new THREE.MeshStandardMaterial({
                color: 0x2a2a4a,
                metalness: 0.7,
                roughness: 0.2,
                emissive: 0x1a1a2a,
                emissiveIntensity: 0.3
            });
            const base = new THREE.Mesh(baseGeometry, baseMaterial);
            base.position.y = height / 2;
            structureGroup.add(base);

            // Add glowing elements
            const glowGeometry = new THREE.SphereGeometry(3, 16, 16);
            const glowMaterial = new THREE.MeshBasicMaterial({
                color: 0x00ffaa,
                transparent: true,
                opacity: 0.8
            });
            const glow = new THREE.Mesh(glowGeometry, glowMaterial);
            glow.position.y = height + 3;
            structureGroup.add(glow);

            // Add floating rings
            const ringGeometry = new THREE.TorusGeometry(6, 0.5, 16, 32);
            const ringMaterial = new THREE.MeshLambertMaterial({
                color: 0x5508cc,
                emissive: 0x2204aa,
                emissiveIntensity: 0.5
            });
            const ring = new THREE.Mesh(ringGeometry, ringMaterial);
            ring.position.y = height / 2;
            ring.rotation.x = Math.PI / 2;
            structureGroup.add(ring);

            // Random position on planet
            const phi = Math.random() * Math.PI; // 0 to PI
            const theta = Math.random() * Math.PI * 2; // 0 to 2*PI

            // Convert spherical to cartesian coordinates
            const x = planetRadius * Math.sin(phi) * Math.cos(theta);
            const y = planetRadius * Math.cos(phi);
            const z = planetRadius * Math.sin(phi) * Math.sin(theta);

            // Create direction vector from planet center to structure position
            const structureDirection = new THREE.Vector3(x, y, z).normalize();
            const structurePosition = structureDirection.clone().multiplyScalar(planetRadius);

            // Position structure
            structureGroup.position.copy(structurePosition);

            // Orient structure to be perpendicular to planet surface
            structureGroup.up = structureDirection.clone();

            // Make the structure face outward from the planet
            const lookTarget = structurePosition.clone().add(structureDirection);
            structureGroup.lookAt(lookTarget);

            planet.add(structureGroup);
        }

        // IMPROVED: Add mysterious crystal formations
        for (let i = 0; i < 30; i++) {
            const crystalGroup = new THREE.Group();

            const height = 5 + Math.random() * 15;
            for (let j = 0; j < 3 + Math.floor(Math.random() * 5); j++) {
                const crystalGeometry = new THREE.ConeGeometry(1, height * (0.5 + Math.random() * 0.5), 5, 1);
                const crystalMaterial = new THREE.MeshLambertMaterial({
                    color: 0x9a36e6,
                    transparent: true,
                    opacity: 0.8,
                    emissive: 0x5a16a6,
                    emissiveIntensity: 0.5
                });
                const crystal = new THREE.Mesh(crystalGeometry, crystalMaterial);
                crystal.position.y = (height * 0.5) * Math.random();
                crystal.position.x = (Math.random() - 0.5) * 5;
                crystal.position.z = (Math.random() - 0.5) * 5;
                crystal.rotation.y = Math.random() * Math.PI;
                crystal.rotation.x = (Math.random() - 0.5) * 0.5;
                crystalGroup.add(crystal);
            }

            // Random position on planet
            const phi = Math.random() * Math.PI; // 0 to PI
            const theta = Math.random() * Math.PI * 2; // 0 to 2*PI

            // Convert spherical to cartesian coordinates
            const x = planetRadius * Math.sin(phi) * Math.cos(theta);
            const y = planetRadius * Math.cos(phi);
            const z = planetRadius * Math.sin(phi) * Math.sin(theta);

            // Create direction vector from planet center to crystal position
            const crystalDirection = new THREE.Vector3(x, y, z).normalize();
            const crystalPosition = crystalDirection.clone().multiplyScalar(planetRadius);

            // Position crystal group
            crystalGroup.position.copy(crystalPosition);

            // Orient crystal group to be perpendicular to planet surface
            crystalGroup.up = crystalDirection.clone();

            // Make the crystal group face outward from the planet
            const lookTarget = crystalPosition.clone().add(crystalDirection);
            crystalGroup.lookAt(lookTarget);

            planet.add(crystalGroup);
        }

        // IMPROVED: Final upgrade station
        const stationDirection = new THREE.Vector3(0, 1, 0); // Top of planet
        this.addImprovedUpgradeStation(planet, stationDirection, 'mysterious');
    }

    // IMPROVED: Add an upgrade station to a planet using the direction-based positioning
    addImprovedUpgradeStation(planet: THREE.Mesh, direction: THREE.Vector3, type = 'default'): THREE.Group {
        const planetGeometry = planet.geometry as THREE.SphereGeometry;
        const planetRadius = planetGeometry.parameters.radius;
        const stationGroup = new THREE.Group();

        if (type === 'default' || type === 'home') {
            // Basic blue upgrade station
            const stationGeometry = new THREE.BoxGeometry(10, 5, 10);
            const stationMaterial = new THREE.MeshLambertMaterial({ color: 0x4287f5 });
            const station = new THREE.Mesh(stationGeometry, stationMaterial);
            stationGroup.add(station);

            const antennaGeometry = new THREE.CylinderGeometry(0.5, 0.5, 10);
            const antenna = new THREE.Mesh(antennaGeometry, stationMaterial);
            antenna.position.y = 7.5;
            stationGroup.add(antenna);

            // Add glow effect
            const glowGeometry = new THREE.SphereGeometry(3, 16, 16);
            const glowMaterial = new THREE.MeshBasicMaterial({
                color: 0x00ffff,
                transparent: true,
                opacity: 0.6
            });
            const glow = new THREE.Mesh(glowGeometry, glowMaterial);
            glow.position.y = 10;
            stationGroup.add(glow);
        } else if (type === 'rocky') {
            // Rocky planet research station
            const baseGeometry = new THREE.CylinderGeometry(15, 15, 10, 8);
            const baseMaterial = new THREE.MeshLambertMaterial({ color: 0x888888 });
            const base = new THREE.Mesh(baseGeometry, baseMaterial);
            stationGroup.add(base);

            const domeGeometry = new THREE.SphereGeometry(15, 16, 16, 0, Math.PI * 2, 0, Math.PI / 2);
            const domeMaterial = new THREE.MeshLambertMaterial({
                color: 0xaaaaff,
                transparent: true,
                opacity: 0.7
            });
            const dome = new THREE.Mesh(domeGeometry, domeMaterial);
            dome.position.y = 10;
            stationGroup.add(dome);

            // Antennas
            const antennaGeometry = new THREE.CylinderGeometry(0.5, 0.5, 15);
            const antennaMaterial = new THREE.MeshLambertMaterial({ color: 0xdddddd });

            for (let i = 0; i < 3; i++) {
                const antenna = new THREE.Mesh(antennaGeometry, antennaMaterial);
                const angle = (i * Math.PI * 2) / 3;
                antenna.position.set(Math.cos(angle) * 10, 10, Math.sin(angle) * 10);
                antenna.rotation.x = Math.PI / 4;
                antenna.rotation.z = angle;
                stationGroup.add(antenna);
            }
        } else if (type === 'icy') {
            // Icy planet igloo station
            const domeGeometry = new THREE.SphereGeometry(15, 16, 16, 0, Math.PI * 2, 0, Math.PI / 2);
            const domeMaterial = new THREE.MeshLambertMaterial({
                color: 0xeeffff,
                transparent: true,
                opacity: 0.8
            });
            const dome = new THREE.Mesh(domeGeometry, domeMaterial);
            stationGroup.add(dome);

            const entranceGeometry = new THREE.CylinderGeometry(5, 5, 10, 8);
            const entrance = new THREE.Mesh(entranceGeometry, domeMaterial);
            entrance.rotation.x = Math.PI / 2;
            entrance.position.z = 15;
            entrance.position.y = -2.5;
            stationGroup.add(entrance);
        } else if (type === 'desert') {
            // Desert planet station
            const baseGeometry = new THREE.BoxGeometry(25, 12, 25);
            const baseMaterial = new THREE.MeshLambertMaterial({ color: 0xd69d61 });
            const base = new THREE.Mesh(baseGeometry, baseMaterial);
            base.position.y = 6;
            stationGroup.add(base);

            const roofGeometry = new THREE.BoxGeometry(30, 2, 30);
            const roofMaterial = new THREE.MeshLambertMaterial({ color: 0x8b4513 });
            const roof = new THREE.Mesh(roofGeometry, roofMaterial);
            roof.position.y = 13;
            stationGroup.add(roof);

            // Solar panels
            const panelGeometry = new THREE.BoxGeometry(8, 0.5, 8);
            const panelMaterial = new THREE.MeshStandardMaterial({
                color: 0x3162e0,
                metalness: 0.8,
                roughness: 0.2,
                emissive: 0x1142a0,
                emissiveIntensity: 0.3
            });

            for (let i = 0; i < 6; i++) {
                const panel = new THREE.Mesh(panelGeometry, panelMaterial);
                const angle = (i * Math.PI) / 3;
                panel.position.set(Math.cos(angle) * 15, 13, Math.sin(angle) * 15);
                stationGroup.add(panel);
            }
        } else if (type === 'mysterious') {
            // Mysterious planet alien temple
            const baseGeometry = new THREE.BoxGeometry(30, 10, 30);
            const baseMaterial = new THREE.MeshStandardMaterial({
                color: 0x28203c,
                metalness: 0.6,
                roughness: 0.2,
                emissive: 0x18102c,
                emissiveIntensity: 0.4
            });
            const base = new THREE.Mesh(baseGeometry, baseMaterial);
            base.position.y = 5;
            stationGroup.add(base);

            // Steps leading to the temple
            const stepsGroup = new THREE.Group();
            for (let i = 0; i < 5; i++) {
                const stepSize = 40 - i * 4;
                const stepGeometry = new THREE.BoxGeometry(stepSize, 2, stepSize);
                const step = new THREE.Mesh(stepGeometry, baseMaterial);
                step.position.y = i * 2;
                stepsGroup.add(step);
            }
            stepsGroup.position.y = -5;
            stationGroup.add(stepsGroup);

            // Temple top pyramid
            const pyramidGeometry = new THREE.ConeGeometry(15, 20, 4);
            const pyramidMaterial = new THREE.MeshStandardMaterial({
                color: 0x3a2f52,
                metalness: 0.7,
                roughness: 0.1,
                emissive: 0x2a1f42,
                emissiveIntensity: 0.4
            });
            const pyramid = new THREE.Mesh(pyramidGeometry, pyramidMaterial);
            pyramid.position.y = 20;
            pyramid.rotation.y = Math.PI / 4;
            stationGroup.add(pyramid);

            // Glowing orb at the top
            const orbGeometry = new THREE.SphereGeometry(5, 16, 16);
            const orbMaterial = new THREE.MeshBasicMaterial({
                color: 0xff00ff
            });
            const orb = new THREE.Mesh(orbGeometry, orbMaterial);
            orb.position.y = 35;
            stationGroup.add(orb);

            // Floating rings around the orb
            for (let i = 0; i < 3; i++) {
                const ringSize = 8 + i * 3;
                const ringGeometry = new THREE.TorusGeometry(ringSize, 0.5, 16, 64);
                const ringMaterial = new THREE.MeshBasicMaterial({
                    color: 0x9900ff,
                    transparent: true,
                    opacity: 0.7
                });
                const ring = new THREE.Mesh(ringGeometry, ringMaterial);
                ring.position.y = 35;
                ring.rotation.x = Math.PI / 3 * i;
                ring.rotation.y = Math.PI / 4 * i;
                stationGroup.add(ring);
            }
        }

        // Position station using the given direction
        const stationPosition = direction.clone().multiplyScalar(planetRadius);
        stationGroup.position.copy(stationPosition);

        // Orient station to be perpendicular to planet surface
        stationGroup.up = direction.clone();

        // Use a consistent look direction relative to the surface normal
        // This ensures proper alignment without guesswork
        const tangent = new THREE.Vector3().crossVectors(direction, new THREE.Vector3(0, 1, 0)).normalize();
        if (tangent.length() < 0.1) {
            // If tangent is too small (e.g., at poles), use a different reference
            tangent.set(1, 0, 0);
        }
        const lookTarget = stationPosition.clone().add(tangent);
        stationGroup.lookAt(lookTarget);

        stationGroup.userData = { type: 'upgradeStation' };
        planet.add(stationGroup);

        return stationGroup;
    }

    // Original method kept for backward compatibility
    addUpgradeStation(planet: THREE.Mesh, angle1: number, angle2: number, type = 'default'): THREE.Group {
        // Convert angles to direction and use improved method
        const planetGeometry = planet.geometry as THREE.SphereGeometry;
        const planetRadius = planetGeometry.parameters.radius;
        const x = Math.cos(angle1) * Math.cos(angle2);
        const y = Math.sin(angle2);
        const z = Math.sin(angle1) * Math.cos(angle2);

        const direction = new THREE.Vector3(x, y, z).normalize();
        return this.addImprovedUpgradeStation(planet, direction, type);
    }
}
