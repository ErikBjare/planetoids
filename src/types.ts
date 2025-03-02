import * as THREE from 'three';

export interface GameState {
  discoveryPoints: number;
  currentPlanet: number;
  planetDiscovered: boolean[];
  upgradesAvailable: boolean;
  nearStation: boolean;
  inSpace: boolean;
  noclip: boolean;
  nearInteractable: boolean;
  currentInteractable: InteractableObject | null;
  currentAtmosphereZone?: string;
}

export interface UpgradeLevels {
  jetpackPower: number;
  jetpackFuel: number;
  jetpackRecharge: number;
  rocketThrust: number;
  scanRange: number;
}

export interface ControlsState {
  moveForward: boolean;
  moveBackward: boolean;
  moveLeft: boolean;
  moveRight: boolean;
  jump: boolean;
  jetpack: boolean;
  sprint: boolean;
  downThrusters: boolean;
}

export interface CollisionResult {
  onGround: boolean;
  collidedPlanet: THREE.Mesh | null;
  surfaceNormal: THREE.Vector3 | null;
}

export interface EnvironmentResult {
  inSpace: boolean;
  inTransition?: boolean;
  inAtmosphere?: boolean;
  onGround: boolean;
  nearest: {
    planet: THREE.Mesh | null;
    distance: number;
  };
  atmosphereZone: string;
  transitionFactor?: number;
}

export interface PhysicsResult {
  environment: EnvironmentResult;
  collision: CollisionResult;
  alignment: {
    upDirection: THREE.Vector3;
    aligned?: boolean;
    alignmentDistance?: number;
    alignmentSpeed?: number;
  };
}

export interface Upgrade {
  name: string;
  cost: number;
  effect: string;
}

export interface PlanetConfig {
  name: string;
  distance: number;
  size: number;
  color: number;
  orbitSpeed: number;
  rotationSpeed: number;
  features: string[];
  upgrade: string;
  index?: number;
}

export interface InteractableObject {
  type: string;
  planetIndex?: number;
  distance?: number;
}

export interface GameObject {
  id: string;
  type: string;
  mesh: THREE.Mesh | THREE.Group | null;
  position: THREE.Vector3;
  rotation: THREE.Euler;
  scale: THREE.Vector3;
  parent: GameObject | null;
  children: GameObject[];
  userData: Record<string, any>;
  interactable: boolean;
  interactionDistance: number;
  onInteract: (game: any) => void;
  update: (deltaTime: number, world?: any) => void;
  addToScene: (scene: THREE.Scene | THREE.Object3D) => GameObject;
}

export interface UIStats {
  points?: number;
  planetName?: string;
  altitude?: number;
  velocity?: number;
  fuel?: number;
  stamina?: number;
  maxStamina?: number;
  timeOfDay?: string;
  timeIcon?: string;
  dayNightProgress?: number;
  bodyUpDirection?: THREE.Vector3;
  lookDirection?: THREE.Vector3;
  zone?: string;
}

export interface Message {
  text: string;
  duration: number;
}

export interface DebugArrows {
  velocity: THREE.ArrowHelper;
  force: THREE.ArrowHelper;
  planetUp: THREE.ArrowHelper;
  distance: number;
}

// Augment the window object to include our game instance
declare global {
  interface Window {
    game: any;
  }
}
