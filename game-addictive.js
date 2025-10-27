/* Microbot Mayhem — Addictive Features */

// Make functions globally available
window.ADDICTIVE_CONFIG = {
    comboTimeWindow: 3000,
    comboMultipliers: [1, 1.2, 1.5, 2, 2.5, 3],
    dailyMissionCount: 3,
    specialEventChance: 0.1,
    coinMultiplier: 1,
    upgradeCosts: {
        speed: 500,
        health: 800,
        firerate: 600
    }
};

// Addictive State
window.combo = 0;
window.comboMultiplier = 1;
window.comboTimeout = null;
window.maxCombo = 0;
window.totalCoins = parseInt(localStorage.getItem('microbotCoins') || '0');
window.playerUpgrades = JSON.parse(localStorage.getItem('microbotUpgrades') || '{}');
window.scorePopups = [];
window.floatingTexts = [];
window.gameTime = 0;

// Daily Missions
window.dailyMissions = {
    today: {
        missions: [
            { 
                id: 'kill_50', 
                target: 50, 
                current: 0, 
                reward: 100, 
                type: 'enemies_killed',
                name: 'Exterminator',
                desc: 'Kill 50 enemies'
            },
            { 
                id: 'survive_3min', 
                target: 180000, 
                current: 0, 
                reward: 150, 
                type: 'survival_time',
                name: 'Survivor',
                desc: 'Survive for 3 minutes'
            },
            { 
                id: 'collect_10', 
                target: 10, 
                current: 0, 
                reward: 80, 
                type: 'pickups_collected',
                name: 'Collector',
                desc: 'Collect 10 power-ups'
            }
        ],
        completed: [],
        date: new Date().toDateString()
    }
};

/* ---------- Combo System ---------- */
function addCombo() {
    window.combo++;
    clearTimeout(window.comboTimeout);
    
    const multiplierIndex = Math.min(Math.floor(window.combo / 5), window.ADDICTIVE_CONFIG.comboMultipliers.length - 1);
    window.comboMultiplier = window.ADDICTIVE_CONFIG.comboMultipliers[multiplierIndex];
    
    showComboFeedback();
    
    window.comboTimeout = setTimeout(() => {
        if (window.combo > window.maxCombo) {
            window.maxCombo = window.combo;
            showFloatingText(player.x, player.y - 30, `Max Combo: ${window.maxCombo}!`, '#ffaa00');
        }
        window.combo = 0;
        window.comboMultiplier = 1;
        updateComboDisplay();
    }, window.ADDICTIVE_CONFIG.comboTimeWindow);
    
    updateComboDisplay();
}

function showComboFeedback() {
    if (window.combo >= 5) {
        showComboPopup();
        
        if (window.combo % 5 === 0) {
            createExplosion(player.x, player.y, '#ffaa00', 15 + window.combo);
            playBeep(800 + window.combo * 10, 0.1, 'sine', 0.15);
        }
    }
    
    if (window.combo > 1) {
        showFloatingText(player.x, player.y - 20, `${window.combo} KILLS! x${window.comboMultiplier.toFixed(1)}`, '#ffaa00');
    }
}

function showComboPopup() {
    const comboPopup = document.getElementById('comboPopup');
    const comboText = document.getElementById('comboText');
    
    if (comboPopup && comboText) {
        comboText.textContent = `${window.combo} COMBO! x${window.comboMultiplier.toFixed(1)}`;
        comboPopup.classList.add('show');
        
        setTimeout(() => {
            comboPopup.classList.remove('show');
        }, 1000);
    }
}

function updateComboDisplay() {
    const comboEl = document.getElementById('combo');
    if (comboEl) {
        comboEl.textContent = window.combo;
        comboEl.style.color = window.comboMultiplier > 1 ? '#ffaa00' : '#ffffff';
        comboEl.style.fontWeight = window.comboMultiplier > 1 ? 'bold' : 'normal';
    }
}

/* ---------- Score & Coin System ---------- */
function addScoreWithMultiplier(baseScore, x, y) {
    const finalScore = Math.floor(baseScore * window.comboMultiplier);
    score += finalScore;
    
    const coinsEarned = Math.floor(baseScore / 10) * window.ADDICTIVE_CONFIG.coinMultiplier;
    window.totalCoins += coinsEarned;
    
    showScorePopup(x, y, finalScore, coinsEarned);
    updateScoreDisplay();
    updateCoinsDisplay();
    
    return finalScore;
}

function showScorePopup(x, y, points, coins) {
    window.scorePopups.push({
        x: x,
        y: y,
        points: points,
        coins: coins,
        life: 1200,
        created: performance.now(),
        vy: -2
    });
}

function updateScorePopups() {
    for (let i = window.scorePopups.length - 1; i >= 0; i--) {
        const popup = window.scorePopups[i];
        popup.y += popup.vy * (delta / 16);
        popup.vy *= 0.95;
        
        const age = performance.now() - popup.created;
        if (age > popup.life) {
            window.scorePopups.splice(i, 1);
        }
    }
}

function renderScorePopups(ctx) {
    ctx.save();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    
    for (const popup of window.scorePopups) {
        const age = performance.now() - popup.created;
        const alpha = 1 - (age / popup.life);
        
        ctx.globalAlpha = alpha;
        ctx.fillStyle = '#ffd700';
        ctx.font = 'bold 16px Arial';
        ctx.fillText(`+${popup.points}`, popup.x, popup.y);
        
        ctx.fillStyle = '#ffff00';
        ctx.font = '12px Arial';
        ctx.fillText(`+${popup.coins} coins`, popup.x, popup.y + 20);
        
        ctx.globalAlpha = 1;
    }
    
    ctx.restore();
}

/* ---------- Mission System ---------- */
function updateMissions(type, amount = 1) {
    let missionCompleted = false;
    
    window.dailyMissions.today.missions.forEach(mission => {
        if (mission.type === type && !window.dailyMissions.today.completed.includes(mission.id)) {
            mission.current = Math.min(mission.current + amount, mission.target);
            
            if (mission.current >= mission.target) {
                window.dailyMissions.today.completed.push(mission.id);
                window.totalCoins += mission.reward;
                showMissionComplete(mission);
                missionCompleted = true;
                saveGameData();
            }
        }
    });
    
    return missionCompleted;
}

function showMissionComplete(mission) {
    const missionPopup = document.getElementById('missionPopup');
    const missionDesc = document.getElementById('missionDesc');
    const missionReward = document.getElementById('missionReward');
    
    if (missionPopup && missionDesc && missionReward) {
        missionDesc.textContent = mission.desc;
        missionReward.textContent = mission.reward;
        
        missionPopup.classList.add('show');
        
        createExplosion(player.x, player.y, '#4a9eff', 20);
        playBeep(600, 0.2, 'sine', 0.2);
        
        setTimeout(() => {
            missionPopup.classList.remove('show');
        }, 3000);
    }
}

/* ---------- Floating Text System ---------- */
function showFloatingText(x, y, text, color = '#ffffff') {
    window.floatingTexts.push({
        x: x,
        y: y,
        text: text,
        color: color,
        life: 1500,
        created: performance.now(),
        vy: -1
    });
}

function updateFloatingTexts() {
    for (let i = window.floatingTexts.length - 1; i >= 0; i--) {
        const text = window.floatingTexts[i];
        text.y += text.vy * (delta / 16);
        
        const age = performance.now() - text.created;
        if (age > text.life) {
            window.floatingTexts.splice(i, 1);
        }
    }
}

function renderFloatingTexts(ctx) {
    ctx.save();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    
    for (const text of window.floatingTexts) {
        const age = performance.now() - text.created;
        const alpha = 1 - (age / text.life);
        
        ctx.globalAlpha = alpha;
        ctx.fillStyle = text.color;
        ctx.font = 'bold 14px Arial';
        ctx.fillText(text.text, text.x, text.y);
    }
    
    ctx.globalAlpha = 1;
    ctx.restore();
}

/* ---------- Upgrade System ---------- */
function setupUpgradeShop() {
    const upgradesShop = document.getElementById('upgradesShop');
    const closeShop = document.getElementById('closeShop');
    const shopCoins = document.getElementById('shopCoins');
    const buyButtons = document.querySelectorAll('.buy-btn');
    const upgradesBtn = document.getElementById('upgradesBtn');
    
    if (upgradesBtn && upgradesShop && closeShop && shopCoins) {
        upgradesBtn.addEventListener('click', () => {
            shopCoins.textContent = window.totalCoins;
            updateUpgradeButtons();
            upgradesShop.classList.add('show');
        });
        
        closeShop.addEventListener('click', () => {
            upgradesShop.classList.remove('show');
        });
        
        buyButtons.forEach(button => {
            button.addEventListener('click', (e) => {
                const upgradeId = e.target.dataset.id;
                buyUpgrade(upgradeId);
            });
        });
    }
}

function updateUpgradeButtons() {
    const buyButtons = document.querySelectorAll('.buy-btn');
    
    buyButtons.forEach(button => {
        const upgradeId = button.dataset.id;
        const cost = window.ADDICTIVE_CONFIG.upgradeCosts[upgradeId];
        const owned = window.playerUpgrades[upgradeId] || 0;
        
        if (owned >= 3) {
            button.textContent = 'MAXED';
            button.disabled = true;
        } else if (window.totalCoins >= cost) {
            button.disabled = false;
        } else {
            button.disabled = true;
        }
    });
}

function buyUpgrade(upgradeId) {
    const cost = window.ADDICTIVE_CONFIG.upgradeCosts[upgradeId];
    
    if (window.totalCoins >= cost) {
        window.totalCoins -= cost;
        window.playerUpgrades[upgradeId] = (window.playerUpgrades[upgradeId] || 0) + 1;
        
        applyUpgrade(upgradeId);
        updateCoinsDisplay();
        updateUpgradeButtons();
        
        showFloatingText(player.x, player.y - 40, 'UPGRADED!', '#7ae6a6');
        playBeep(800, 0.2, 'sine', 0.15);
        saveGameData();
    }
}

function applyUpgrade(upgradeId) {
    switch(upgradeId) {
        case 'speed':
            CONFIG.playerSpeed += 20;
            break;
        case 'health':
            player.maxHealth += 25;
            player.health = player.maxHealth;
            healthEl.textContent = Math.floor(player.health);
            break;
        case 'firerate':
            player.fireRate = Math.max(80, player.fireRate - 15);
            break;
    }
}

/* ---------- Special Events ---------- */
function checkSpecialEvents() {
    if (Math.random() < window.ADDICTIVE_CONFIG.specialEventChance) {
        spawnSpecialEvent();
    }
    
    const now = new Date();
    if (now.getDay() === 0 || now.getDay() === 6) {
        window.ADDICTIVE_CONFIG.coinMultiplier = 2;
    } else {
        window.ADDICTIVE_CONFIG.coinMultiplier = 1;
    }
}

function spawnSpecialEvent() {
    const events = ['coinRain', 'rapidFire', 'invincibility'];
    const event = events[Math.floor(Math.random() * events.length)];
    
    showFloatingText(CONFIG.width / 2, 100, `SPECIAL EVENT: ${event.toUpperCase()}!`, '#ff00ff');
    
    switch(event) {
        case 'coinRain':
            spawnCoinRain();
            break;
        case 'rapidFire':
            player.applyPowerUp('rapidFire');
            break;
        case 'invincibility':
            player.applyPowerUp('shield');
            break;
    }
}

function spawnCoinRain() {
    for (let i = 0; i < 10; i++) {
        setTimeout(() => {
            const x = Math.random() * CONFIG.width;
            const y = -20;
            spawnPickup(x, y);
        }, i * 200);
    }
}

/* ---------- Save/Load System ---------- */
function saveGameData() {
    localStorage.setItem('microbotCoins', window.totalCoins.toString());
    localStorage.setItem('microbotUpgrades', JSON.stringify(window.playerUpgrades));
    localStorage.setItem('microbotHighScore', Math.max(score, parseInt(localStorage.getItem('microbotHighScore') || '0')).toString());
}

function loadGameData() {
    window.totalCoins = parseInt(localStorage.getItem('microbotCoins') || '0');
    window.playerUpgrades = JSON.parse(localStorage.getItem('microbotUpgrades') || '{}');
    updateCoinsDisplay();
    
    Object.keys(window.playerUpgrades).forEach(upgradeId => {
        for (let i = 0; i < window.playerUpgrades[upgradeId]; i++) {
            applyUpgrade(upgradeId);
        }
    });
}

/* ---------- UI Updates ---------- */
function updateScoreDisplay() {
    const scoreEl = document.getElementById('score');
    if (scoreEl) scoreEl.textContent = score;
}

function updateCoinsDisplay() {
    const coinsEl = document.getElementById('coins');
    if (coinsEl) {
        coinsEl.textContent = window.totalCoins;
        coinsEl.style.color = window.totalCoins > 0 ? '#ffd700' : '#ffffff';
    }
}

/* ---------- Enhanced Game Functions ---------- */
window.enhancedEnemyDeath = function(enemy, index) {
    const baseScore = Math.floor(10 + Math.random() * 20);
    const finalScore = addScoreWithMultiplier(baseScore, enemy.x, enemy.y);
    addCombo();
    updateMissions('enemies_killed', 1);
    
    // Original death effects
    for(let k=0;k<22;k++){
        spawnParticle(enemy.x, enemy.y, {
            speed:50 + Math.random()*210, 
            life:380 + Math.random()*240, 
            size:1 + Math.random()*3, 
            color:'#ffd08a'
        });
    }
    
    const pan = (enemy.x / CONFIG.width - 0.5) * 2;
    playExplosion(120 + Math.random()*100, 0.12);
    
    enemies.splice(index, 1);
    enemiesDefeated++;
    
    const powerUpChance = 0.15 + (window.combo * 0.01);
    if(Math.random() < powerUpChance){
        spawnPowerUp(enemy.x, enemy.y);
    }
    
    if(Math.random() < 0.35){
        spawnPickup(enemy.x, enemy.y);
    }
};

window.enhancedPickupCollection = function(pickup, index) {
    player.health = Math.min(player.maxHealth, player.health + 24 + Math.random()*18);
    addScoreWithMultiplier(6, pickup.x, pickup.y);
    updateMissions('pickups_collected', 1);
    
    playBeep(1150, 0.07, 'triangle', 0.09);
    for(let k=0;k<14;k++){
        spawnParticle(pickup.x + (Math.random()-0.5)*6, pickup.y + (Math.random()-0.5)*6, {
            speed: 60 + Math.random()*90, 
            life:240 + Math.random()*200, 
            size:2, 
            color:'#bfffe0'
        });
    }
    
    pickups.splice(index, 1);
};

window.onEnemyHit = function() {
    // Called when enemy is hit but not killed
};

window.onGameOver = function(finalScore) {
    saveGameData();
};

window.onGameStart = function() {
    loadGameData();
    updateCoinsDisplay();
    
    // Reset daily missions if new day
    const today = new Date().toDateString();
    if (window.dailyMissions.today.date !== today) {
        window.dailyMissions.today.missions.forEach(mission => {
            mission.current = 0;
        });
        window.dailyMissions.today.completed = [];
        window.dailyMissions.today.date = today;
    }
};

window.onGameReset = function() {
    window.combo = 0;
    window.comboMultiplier = 1;
    window.scorePopups = [];
    window.floatingTexts = [];
    window.gameTime = 0;
    updateComboDisplay();
    updateCoinsDisplay();
};

window.renderAddictiveFeatures = function(ctx) {
    updateScorePopups();
    updateFloatingTexts();
    renderScorePopups(ctx);
    renderFloatingTexts(ctx);
    
    // Update missions and check events during gameplay
    if (state === 'playing' && !paused) {
        window.gameTime += delta;
        updateMissions('survival_time', delta);
        checkSpecialEvents();
        
        // Low health warning
        if (player.health < 30 && Math.random() < 0.02) {
            showFloatingText(player.x, player.y - 60, 'LOW HEALTH!', '#ff6b6b');
        }
    }
};

/* ---------- Initialize Addictive Features ---------- */
document.addEventListener('DOMContentLoaded', function() {
    setupUpgradeShop();
    loadGameData();
    updateCoinsDisplay();
    
    // Make sure coins element is updated
    const coinsEl = document.getElementById('coins');
    if (coinsEl) {
        coinsEl.textContent = window.totalCoins;
    }
    
    // Save game on unload
    window.addEventListener('beforeunload', saveGameData);
});

// Make functions globally available
window.addCombo = addCombo;
window.addScoreWithMultiplier = addScoreWithMultiplier;
window.updateMissions = updateMissions;
window.showFloatingText = showFloatingText;