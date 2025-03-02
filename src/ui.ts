import * as THREE from 'three';
import { UIStats, Message } from './types';

export class UI {
    game: any;
    elements: Record<string, HTMLElement | null>;
    container: HTMLElement | null;
    messageQueue: Message[];
    isShowingMessage: boolean;
    staminaTimerId: number | null;
    lastStaminaPercent: number;

    constructor(game: any) {
        this.game = game;
        this.elements = {};

        // Get reference to UI container
        this.container = document.getElementById('game-ui');

        // Get references to UI elements
        this.initializeUIElements();

        // Message queue for notifications
        this.messageQueue = [];
        this.isShowingMessage = false;

        // Variables to track stamina wheel visibility
        this.staminaTimerId = null;
        this.lastStaminaPercent = 1.0;
    }

    initializeUIElements(): void {
        // Get references to all UI elements
        this.elements.debugPanel = document.getElementById('ui');
        this.elements.dashboard = document.getElementById('dashboard');
        this.elements.staminaWheel = document.getElementById('stamina-container');
        this.elements.fuelGauge = document.getElementById('fuel-container');
        this.elements.crosshair = document.getElementById('crosshair');
        this.elements.interactionPrompt = document.getElementById('interaction-prompt');
        this.elements.cameraMode = document.getElementById('camera-mode');
        this.elements.upgradeMenu = document.getElementById('upgrades');
    }

    showMessage(message: string, duration = 2000): void {
        // Add message to queue
        this.messageQueue.push({
            text: message,
            duration: duration
        });

        // If not currently showing a message, show the next one
        if (!this.isShowingMessage) {
            this.showNextMessage();
        }
    }

    showNextMessage(): void {
        // Check if there are messages in the queue
        if (this.messageQueue.length === 0) {
            this.isShowingMessage = false;
            return;
        }

        // Get the next message
        const nextMessage = this.messageQueue.shift();
        if (!nextMessage) return;

        this.isShowingMessage = true;

        // Create message element
        const msgElement = document.createElement('div');
        msgElement.textContent = nextMessage.text;
        msgElement.style.cssText = `
            position: absolute;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            color: white;
            font-size: 24px;
            font-weight: bold;
            text-shadow: 2px 2px 4px black;
            padding: 10px;
            pointer-events: none;
            text-align: center;
            background-color: rgba(0, 0, 0, 0.5);
            border-radius: 5px;
            z-index: 100;
        `;
        if (this.container) {
            this.container.appendChild(msgElement);
        }

        // Remove message after duration
        setTimeout(() => {
            if (this.container && this.container.contains(msgElement)) {
                this.container.removeChild(msgElement);
            }
            // Show next message if there is one
            this.showNextMessage();
        }, nextMessage.duration);
    }

    setInteractionPrompt(show: boolean): void {
        if (this.elements.interactionPrompt) {
            this.elements.interactionPrompt.style.display = show ? 'block' : 'none';
        }
    }

    setCrosshairVisible(visible: boolean): void {
        if (this.elements.crosshair) {
            this.elements.crosshair.style.display = visible ? 'block' : 'none';
        }
    }

    updateStats(stats: UIStats): void {
        // Helper function to safely update element text
        const safeUpdateText = (id: string, text: string | number) => {
            const element = document.getElementById(id);
            if (element) element.textContent = String(text);
        };

        // Update debug panel information
        if (stats.points !== undefined) {
            safeUpdateText('points', stats.points);
        }

        if (stats.planetName) {
            safeUpdateText('planet', stats.planetName);
        }

        if (stats.altitude !== undefined) {
            safeUpdateText('altitude', Math.round(stats.altitude));
        }

        if (stats.velocity !== undefined) {
            safeUpdateText('velocity', Math.round(stats.velocity * 10) / 10);
        }

        // Update zone in debug panel
        if (stats.zone) {
            safeUpdateText('zone-text', stats.zone);
        }

        // Update fuel gauge
        if (stats.fuel !== undefined) {
            // Update fuel text in the instrument panel
            safeUpdateText('fuel-text', `${Math.round(stats.fuel)}%`);

            // Update fuel circle
            const fuelCircle = document.getElementById('fuel-circle');
            if (fuelCircle) {
                const fuelPercent = stats.fuel / 100; // Assuming max fuel is 100
                const circumference = 2 * Math.PI * 45;
                const offset = circumference * (1 - fuelPercent);
                fuelCircle.setAttribute('stroke-dashoffset', offset.toString());

                // Change color based on fuel level
                if (fuelPercent > 0.6) {
                    fuelCircle.setAttribute('stroke', '#4CAF50'); // Green
                } else if (fuelPercent > 0.3) {
                    fuelCircle.setAttribute('stroke', '#FFC107'); // Yellow
                } else {
                    fuelCircle.setAttribute('stroke', '#F44336'); // Red
                }
            }
        }

        // Update stamina wheel and manage visibility
        if (stats.stamina !== undefined && stats.maxStamina) {
            const staminaPercent = stats.stamina / stats.maxStamina;
            const staminaCircle = document.getElementById('stamina-circle');

            if (staminaCircle) {
                // Calculate stroke-dashoffset based on percentage
                // Full circle circumference is 2πr = 2π * 45 ≈ 282.7
                const circumference = 2 * Math.PI * 45;
                const offset = circumference * (1 - staminaPercent);
                staminaCircle.setAttribute('stroke-dashoffset', offset.toString());

                // Change color based on stamina level
                if (staminaPercent > 0.6) {
                    staminaCircle.setAttribute('stroke', '#4CAF50'); // Green
                } else if (staminaPercent > 0.3) {
                    staminaCircle.setAttribute('stroke', '#FFC107'); // Yellow
                } else {
                    staminaCircle.setAttribute('stroke', '#F44336'); // Red
                }

                // Show stamina wheel when not full
                if (staminaPercent < 1.0) {
                    this.showStaminaWheel();
                    this.lastStaminaPercent = staminaPercent;
                }
                // Or if stamina just reached full recently
                else if (this.lastStaminaPercent < 1.0) {
                    // Show wheel and start timer to hide it
                    this.showStaminaWheel();
                    this.lastStaminaPercent = staminaPercent;

                    // Clear any existing timer
                    if (this.staminaTimerId !== null) {
                        clearTimeout(this.staminaTimerId);
                    }

                    // Set new timer to hide wheel after 2 seconds
                    this.staminaTimerId = window.setTimeout(() => {
                        this.hideStaminaWheel();
                    }, 2000);
                }
            }
        }

        // Update orientation displays
        if (stats.bodyUpDirection && stats.lookDirection) {
            this.updateOrientationDisplays(
                stats.bodyUpDirection,
                stats.lookDirection
            );
        }

        // Show/hide time indicator based on whether player is near a planet
        const timeContainer = document.getElementById('time-container');
        if (timeContainer) {
            // Only show time when near a planet (based on altitude)
            const nearPlanet = stats.altitude !== undefined && stats.altitude < 500;
            timeContainer.style.display = nearPlanet ? 'block' : 'none';

            // Update time indicator content if shown
            if (nearPlanet && stats.timeOfDay) {
                safeUpdateText('day-night-indicator', stats.timeOfDay);

                if (stats.timeIcon) {
                    safeUpdateText('time-icon', stats.timeIcon);
                }
            }
        }
    }

    // Show/hide stamina wheel
    showStaminaWheel(): void {
        if (this.elements.staminaWheel) {
            this.elements.staminaWheel.style.display = 'block';
        }
    }

    hideStaminaWheel(): void {
        if (this.elements.staminaWheel) {
            this.elements.staminaWheel.style.display = 'none';
        }
    }

    updateOrientationDisplays(bodyUpDirection: THREE.Vector3, lookDirection: THREE.Vector3): void {
        // Update body orientation display
        this.updateArrow('body-up', bodyUpDirection, 1, 'left');
        this.updateArrow('body-forward', new THREE.Vector3(0, 0, -1).applyQuaternion(
            window.game?.player?.bodyQuaternion || new THREE.Quaternion()
        ), 1, 'top');

        // Update head/view direction display
        this.updateArrow('look-direction', lookDirection, 1, 'top');
        this.updateArrow('look-up', new THREE.Vector3(0, 1, 0).applyQuaternion(
            window.game?.player?.camera?.quaternion || new THREE.Quaternion()
        ), 1, 'left');
    }

    // Updated arrow method with direction parameter
    updateArrow(prefix: string, direction: THREE.Vector3, magnitude: number, arrowType: 'top' | 'left'): void {
        // Get arrow element
        const arrow = document.getElementById(`${prefix}-arrow`);
        if (!arrow) return;

        // Normalize vector for display
        const dir = direction.clone().normalize();

        // Scale factor for arrow length
        const scale = Math.min(Math.max(magnitude / 5, 0.2), 1);

        // Set appropriate dimension based on arrow type
        if (arrowType === 'top') {
            // Horizontal arrow (forward/back, left/right)
            const xLength = Math.abs(dir.x) * 25 * scale;
            arrow.style.width = `${xLength}px`;

            // Determine direction
            if (dir.z >= 0) {
                arrow.style.borderTopWidth = '0';
                arrow.style.borderBottomWidth = '4px';
                arrow.style.borderTop = 'none';
                arrow.style.borderBottom = `4px solid ${prefix.includes('body') ? '#F44336' : '#4CAF50'}`;
            } else {
                arrow.style.borderBottomWidth = '0';
                arrow.style.borderTopWidth = '4px';
                arrow.style.borderBottom = 'none';
                arrow.style.borderTop = `4px solid ${prefix.includes('body') ? '#F44336' : '#4CAF50'}`;
            }
        } else {
            // Vertical arrow (up/down)
            const yLength = Math.abs(dir.y) * 25 * scale;
            arrow.style.height = `${yLength}px`;

            // Determine direction
            if (dir.y >= 0) {
                arrow.style.borderRightWidth = '0';
                arrow.style.borderLeftWidth = '4px';
                arrow.style.borderRight = 'none';
                arrow.style.borderLeft = `4px solid ${prefix.includes('body') ? '#F44336' : '#4CAF50'}`;
            } else {
                arrow.style.borderLeftWidth = '0';
                arrow.style.borderRightWidth = '4px';
                arrow.style.borderLeft = 'none';
                arrow.style.borderRight = `4px solid ${prefix.includes('body') ? '#F44336' : '#4CAF50'}`;
            }
        }
    }

    updateArrows(prefix: string, direction: THREE.Vector3, magnitude: number): void {
        // Get arrow elements
        const xArrow = document.getElementById(`${prefix}-x-arrow`);
        const yArrow = document.getElementById(`${prefix}-y-arrow`);

        if (!xArrow || !yArrow) return;

        // Normalize vector for display
        const dir = direction.clone().normalize();

        // Scale factor for arrow length
        const scale = Math.min(Math.max(magnitude / 10, 0.2), 1);

        // Set X arrow width (horizontal component)
        const xLength = Math.abs(dir.x) * 25 * scale;
        xArrow.style.width = `${xLength}px`;

        // Set X arrow direction (left or right)
        if (dir.x >= 0) {
            xArrow.style.borderRightWidth = '0';
            xArrow.style.borderLeftWidth = '4px';
            xArrow.style.borderRight = 'none';
            xArrow.style.borderLeft = `4px solid ${prefix === 'vel' ? '#2196F3' : '#F44336'}`;
        } else {
            xArrow.style.borderLeftWidth = '0';
            xArrow.style.borderRightWidth = '4px';
            xArrow.style.borderLeft = 'none';
            xArrow.style.borderRight = `4px solid ${prefix === 'vel' ? '#2196F3' : '#F44336'}`;
        }

        // Set Y arrow height (vertical component, using Z for the 2D display)
        const yLength = Math.abs(dir.z) * 25 * scale;
        yArrow.style.height = `${yLength}px`;

        // Set Y arrow direction (up or down)
        if (dir.z >= 0) {
            yArrow.style.borderTopWidth = '0';
            yArrow.style.borderBottomWidth = '4px';
            yArrow.style.borderTop = 'none';
            yArrow.style.borderBottom = `4px solid ${prefix === 'vel' ? '#2196F3' : '#F44336'}`;
        } else {
            yArrow.style.borderBottomWidth = '0';
            yArrow.style.borderTopWidth = '4px';
            yArrow.style.borderBottom = 'none';
            yArrow.style.borderTop = `4px solid ${prefix === 'vel' ? '#2196F3' : '#F44336'}`;
        }
    }

    updateCameraMode(mode: string): void {
        if (!this.elements.cameraMode) return;

        let modeText = 'Unknown';
        switch (mode) {
        case 'firstPerson': modeText = 'First Person'; break;
        case 'thirdPerson': modeText = 'Third Person'; break;
        case 'scope': modeText = 'Scope View'; break;
        }

        this.elements.cameraMode.textContent = `Camera: ${modeText}`;
    }

    showUpgradeMenu(
        planetIndex: number,
        upgrades: Array<{name: string; cost: number; effect: string}>,
        discoveryPoints: number,
        onPurchase: (upgrade: {name: string; cost: number; effect: string}, planetIndex: number) => void
    ): void {
        const menu = this.elements.upgradeMenu;
        if (!menu) return;

        // Clear previous content
        menu.innerHTML = '';

        // Show menu
        menu.style.display = 'block';

        // Create content
        menu.innerHTML = `
            <h2 style="text-align: center; margin-top: 0;">Upgrade Station</h2>
            <p style="text-align: center;">Available points: <span style="color: #4fc3f7;">${discoveryPoints}</span></p>
            <div id="upgrade-options" style="margin-top: 15px;"></div>
            <div style="text-align: center; margin-top: 20px;">
                <button id="close-upgrade-menu" style="padding: 8px 15px; background: #333; color: white; border: none; border-radius: 5px; cursor: pointer;">Close</button>
            </div>
        `;

        // Add upgrade options
        const optionsContainer = menu.querySelector('#upgrade-options');
        if (!optionsContainer) return;

        upgrades.forEach((upgrade, index) => {
            const option = document.createElement('div');
            option.style.cssText = `
                padding: 10px;
                margin: 5px 0;
                background-color: rgba(255, 255, 255, 0.1);
                border-radius: 5px;
                cursor: ${discoveryPoints >= upgrade.cost ? 'pointer' : 'not-allowed'};
                opacity: ${discoveryPoints >= upgrade.cost ? '1' : '0.5'};
            `;

            option.innerHTML = `
                <div style="display: flex; justify-content: space-between;">
                    <strong>${upgrade.name}</strong>
                    <span style="color: ${discoveryPoints >= upgrade.cost ? '#4fc3f7' : '#ff5252'};">${upgrade.cost} points</span>
                </div>
                <div style="margin-top: 5px; font-size: 0.9em; color: #aaa;">${upgrade.effect}</div>
            `;

            if (discoveryPoints >= upgrade.cost) {
                option.addEventListener('click', () => {
                    if (onPurchase) {
                        onPurchase(upgrade, planetIndex);
                        menu.style.display = 'none';
                    }
                });
            }

            optionsContainer.appendChild(option);
        });

        // Close button event
        const closeButton = menu.querySelector('#close-upgrade-menu');
        if (closeButton) {
            closeButton.addEventListener('click', () => {
                menu.style.display = 'none';
            });
        }
    }
}
