class MenuSystem {
    constructor() {
        this.setupEventListeners();
    }
    
    setupEventListeners() {
        // Upgrade Shop
        const upgradeBtn = document.getElementById('upgradesBtn');
        const upgradeModal = document.getElementById('upgradeShop');
        const upgradeClose = upgradeModal.querySelector('.close');
        
        upgradeBtn.addEventListener('click', () => {
            unlockSystem.renderUpgradeShop();
            upgradeModal.style.display = 'block';
        });
        
        upgradeClose.addEventListener('click', () => {
            upgradeModal.style.display = 'none';
        });
        
        // Missions Modal
        const missionsBtn = document.getElementById('missionsBtn');
        const missionsModal = document.getElementById('missionsModal');
        const missionsClose = missionsModal.querySelector('.close');
        
        missionsBtn.addEventListener('click', () => {
            this.renderMissions();
            missionsModal.style.display = 'block';
        });
        
        missionsClose.addEventListener('click', () => {
            missionsModal.style.display = 'none';
        });
        
        // Close modals when clicking outside
        window.addEventListener('click', (e) => {
            if (e.target === upgradeModal) {
                upgradeModal.style.display = 'none';
            }
            if (e.target === missionsModal) {
                missionsModal.style.display = 'none';
            }
        });
    }
    
    renderMissions() {
        const container = document.getElementById('missionsList');
        container.innerHTML = '';
        
        missionSystem.missions.forEach(mission => {
            const progress = (mission.current / mission.target) * 100;
            const item = document.createElement('div');
            item.className = 'mission-item';
            
            item.innerHTML = `
                <div class="upgrade-header">
                    <div class="upgrade-name">${mission.title}</div>
                    <div class="upgrade-cost">+${mission.reward} Coins</div>
                </div>
                <div class="upgrade-description">${mission.description}</div>
                <div class="mission-progress">
                    <div class="progress-bar">
                        <div class="progress-fill" style="width: ${progress}%"></div>
                    </div>
                    <div class="progress-text">${mission.current}/${mission.target}</div>
                </div>
                ${mission.completed ? 
                    '<div style="color: #7ae6a6; font-size: 12px; margin-top: 5px;">✓ Completed</div>' : ''
                }
            `;
            
            container.appendChild(item);
        });
        
        // Add progress summary
        const progress = missionSystem.getProgress();
        const summary = document.createElement('div');
        summary.style.marginTop = '20px';
        summary.style.padding = '10px';
        summary.style.background = 'rgba(122,230,166,0.1)';
        summary.style.borderRadius = '5px';
        summary.style.textAlign = 'center';
        summary.innerHTML = `
            Daily Progress: ${progress.completed}/${progress.total} Missions Completed
            ${progress.completed === progress.total ? '🎉 All missions complete!' : ''}
        `;
        
        container.appendChild(summary);
    }
    
    updateUI() {
        // Update main game UI
        document.getElementById('score').textContent = gameState.score;
        document.getElementById('health').textContent = Math.max(0, Math.floor(window.player?.health || 0));
        document.getElementById('wave').textContent = gameState.currentWave;
        document.getElementById('combo').textContent = `x${comboSystem.comboMultiplier.toFixed(1)}`;
    }
    
    showGameOver() {
        const newHighScore = gameState.checkHighScore();
        
        // You can enhance this with more detailed stats
        if (newHighScore) {
            alert(`🎉 NEW HIGH SCORE! ${gameState.score} points!`);
        }
        
        // Show end game stats
        this.showEndGameStats();
    }
    
    showEndGameStats() {
        // Could show a modal with detailed stats
        const stats = `
Wave Reached: ${gameState.currentWave}
Total Score: ${gameState.score}
Enemies Defeated: ${gameState.enemiesDefeated}
Max Combo: ${comboSystem.combo}
Coins Earned: ${Math.floor(gameState.score / 10)}
        `;
        
        console.log('Game Over Stats:', stats);
    }
}

const menuSystem = new MenuSystem();