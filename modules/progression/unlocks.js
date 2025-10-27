class UnlockSystem {
    constructor() {
        this.ships = this.loadShips();
        this.weapons = this.loadWeapons();
        this.selectedShip = localStorage.getItem('selectedShip') || 'basic';
        this.selectedWeapon = localStorage.getItem('selectedWeapon') || 'basic';
    }
    
    loadShips() {
        const defaultShips = [
            {
                id: 'basic',
                name: 'Standard Bot',
                description: 'Well-balanced starting ship',
                unlocked: true,
                cost: 0,
                stats: {
                    speed: 320,
                    health: 100,
                    fireRate: 180,
                    radius: 14
                },
                color: '#7ae6a6'
            },
            {
                id: 'speedster',
                name: 'Speedster',
                description: 'Extreme mobility at the cost of firepower',
                unlocked: false,
                cost: 1000,
                stats: {
                    speed: 380,
                    health: 80,
                    fireRate: 200,
                    radius: 12
                },
                color: '#00aaff'
            },
            {
                id: 'tank',
                name: 'Heavy Bot',
                description: 'Slower but much more durable',
                unlocked: false,
                cost: 1500,
                stats: {
                    speed: 280,
                    health: 150,
                    fireRate: 220,
                    radius: 18
                },
                color: '#ffaa00'
            },
            {
                id: 'sniper',
                name: 'Sniper',
                description: 'Long-range precision attacks',
                unlocked: false,
                cost: 2000,
                stats: {
                    speed: 300,
                    health: 90,
                    fireRate: 300,
                    projectileSpeed: 700,
                    radius: 13
                },
                color: '#ff00aa'
            }
        ];
        
        const saved = localStorage.getItem('unlockedShips');
        if (saved) {
            const unlocked = JSON.parse(saved);
            return defaultShips.map(ship => ({
                ...ship,
                unlocked: unlocked.includes(ship.id)
            }));
        }
        
        return defaultShips;
    }
    
    loadWeapons() {
        // Similar structure for weapons
        return [
            {
                id: 'basic',
                name: 'Standard Laser',
                unlocked: true,
                cost: 0
            }
        ];
    }
    
    unlockShip(shipId) {
        const ship = this.ships.find(s => s.id === shipId);
        if (ship && !ship.unlocked && gameState.totalCoins >= ship.cost) {
            ship.unlocked = true;
            gameState.addCoins(-ship.cost);
            this.saveUnlocks();
            return true;
        }
        return false;
    }
    
    saveUnlocks() {
        const unlockedShips = this.ships.filter(s => s.unlocked).map(s => s.id);
        localStorage.setItem('unlockedShips', JSON.stringify(unlockedShips));
        localStorage.setItem('selectedShip', this.selectedShip);
        localStorage.setItem('selectedWeapon', this.selectedWeapon);
    }
    
    selectShip(shipId) {
        if (this.ships.find(s => s.id === shipId && s.unlocked)) {
            this.selectedShip = shipId;
            this.saveUnlocks();
            return true;
        }
        return false;
    }
    
    getCurrentShip() {
        return this.ships.find(s => s.id === this.selectedShip) || this.ships[0];
    }
    
    renderUpgradeShop() {
        const container = document.getElementById('upgradeList');
        const coinsDisplay = document.getElementById('coinsCount');
        
        coinsDisplay.textContent = gameState.totalCoins;
        container.innerHTML = '';
        
        this.ships.forEach(ship => {
            const item = document.createElement('div');
            item.className = `upgrade-item ${ship.unlocked ? '' : 'locked'}`;
            
            item.innerHTML = `
                <div class="upgrade-header">
                    <div class="upgrade-name">${ship.name}</div>
                    ${!ship.unlocked ? 
                        `<div class="upgrade-cost">${ship.cost} Coins</div>` : 
                        `<div class="upgrade-cost" style="background: #7ae6a6;">UNLOCKED</div>`
                    }
                </div>
                <div class="upgrade-description">${ship.description}</div>
                <div class="upgrade-stats">
                    Speed: ${ship.stats.speed} | Health: ${ship.stats.health} | Fire Rate: ${ship.stats.fireRate}
                </div>
                ${!ship.unlocked ? 
                    `<button class="buy-btn" onclick="unlockSystem.purchaseShip('${ship.id}')" 
                      ${gameState.totalCoins < ship.cost ? 'disabled' : ''}>
                        ${gameState.totalCoins < ship.cost ? 'Need More Coins' : 'Purchase'}
                    </button>` :
                    `<button class="buy-btn" onclick="unlockSystem.selectShip('${ship.id}')"
                      ${ship.id === unlockSystem.selectedShip ? 'disabled' : ''}>
                        ${ship.id === unlockSystem.selectedShip ? 'Selected' : 'Select Ship'}
                    </button>`
                }
            `;
            
            container.appendChild(item);
        });
    }
    
    purchaseShip(shipId) {
        if (this.unlockShip(shipId)) {
            this.renderUpgradeShop();
            
            // Show success message
            const ship = this.ships.find(s => s.id === shipId);
            if (ship) {
                alert(`Congratulations! You unlocked the ${ship.name}!`);
            }
            
            return true;
        }
        return false;
    }
}

const unlockSystem = new UnlockSystem();