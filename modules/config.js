const CONFIG = {
    // Core Game Settings
    width: 900,
    height: 600,
    maxEnemies: 12,
    spawnInterval: 1200,
    enemySpeedRange: [0.6, 1.6],
    playerSpeed: 320,
    projectileSpeed: 520,
    particleCount: 24,
    difficultyIncreaseInterval: 15000,
    
    // Colors
    colorAccent: '#7ae6a6',
    colorDanger: '#ff6b6b',
    colorWarning: '#ffaa00',
    
    // Addictive Features
    addictiveFeatures: {
        comboTimeWindow: 3000,
        comboMultipliers: [1, 1.2, 1.5, 2.0, 2.5, 3.0],
        dailyMissionCount: 3,
        specialEventChance: 0.1,
        coinDropChance: 0.3,
        rareDropChance: 0.05
    },
    
    // Power-ups
    powerUps: {
        rapidFire: { 
            duration: 5000, 
            fireRate: 80, 
            color: '#ffaa00',
            rarity: 'common'
        },
        shield: { 
            duration: 4000, 
            color: '#00aaff',
            rarity: 'common'
        },
        tripleShot: { 
            duration: 3000, 
            color: '#ff00aa',
            rarity: 'uncommon'
        },
        speedBoost: { 
            duration: 4000, 
            speedMultiplier: 1.8, 
            color: '#aaff00',
            rarity: 'common'
        },
        // Rare power-ups
        megaShot: {
            duration: 6000,
            fireRate: 60,
            tripleShot: true,
            color: '#ff00ff',
            rarity: 'rare'
        },
        timeSlow: {
            duration: 3000,
            enemySlow: 0.5,
            color: '#00ffff',
            rarity: 'epic'
        }
    },
    
    // Boss Settings
    bossHealth: 200,
    waveEnemyMultiplier: 1.2,
    
    // Progression
    baseCoinReward: 10,
    comboCoinBonus: 5
};