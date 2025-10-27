class ComboSystem {
    constructor() {
        this.combo = 0;
        this.comboMultiplier = 1;
        this.comboTimeout = null;
        this.maxCombo = parseInt(localStorage.getItem('maxCombo') || '0');
        this.comboHistory = [];
    }
    
    addKill() {
        this.combo++;
        clearTimeout(this.comboTimeout);
        
        // Update max combo
        if (this.combo > this.maxCombo) {
            this.maxCombo = this.combo;
            localStorage.setItem('maxCombo', this.maxCombo.toString());
        }
        
        // Calculate multiplier
        this.comboMultiplier = CONFIG.addictiveFeatures.comboMultipliers[
            Math.min(this.combo, CONFIG.addictiveFeatures.comboMultipliers.length - 1)
        ];
        
        // Set timeout to reset combo
        this.comboTimeout = setTimeout(() => {
            if (this.combo >= 5) {
                this.recordCombo(this.combo);
            }
            this.combo = 0;
            this.comboMultiplier = 1;
        }, CONFIG.addictiveFeatures.comboTimeWindow);
        
        // Visual feedback
        this.showComboFeedback();
        
        return this.comboMultiplier;
    }
    
    showComboFeedback() {
        if (this.combo >= 3) {
            // Show combo popup for significant combos
            const comboPopup = document.getElementById('comboPopup');
            const comboText = document.getElementById('comboText');
            
            comboText.textContent = `${this.combo} KILL COMBO! x${this.comboMultiplier.toFixed(1)}`;
            comboPopup.classList.add('show');
            
            setTimeout(() => {
                comboPopup.classList.remove('show');
            }, 1000);
        }
        
        // Create floating combo text
        if (window.player) {
            const comboText = {
                x: player.x,
                y: player.y - 50,
                text: this.combo > 1 ? `Combo x${this.combo}` : 'First Blood!',
                color: this.getComboColor(),
                size: 12 + (this.combo * 2),
                life: 1500,
                vy: -1,
                created: performance.now(),
                type: 'combo'
            };
            
            if (window.particles) {
                particles.push(comboText);
            }
        }
    }
    
    getComboColor() {
        const colors = [
            '#ffffff', // 1
            '#ffff00', // 2-3
            '#ffaa00', // 4-5
            '#ff5500', // 6-7
            '#ff0000', // 8-9
            '#ff00ff'  // 10+
        ];
        return colors[Math.min(this.combo - 1, colors.length - 1)];
    }
    
    recordCombo(comboCount) {
        this.comboHistory.push({
            count: comboCount,
            timestamp: Date.now(),
            wave: gameState.currentWave
        });
        
        // Keep only last 10 combos
        if (this.comboHistory.length > 10) {
            this.comboHistory.shift();
        }
    }
    
    getComboBonus() {
        return Math.floor(this.combo * CONFIG.addictiveFeatures.comboCoinBonus);
    }
    
    reset() {
        this.combo = 0;
        this.comboMultiplier = 1;
        clearTimeout(this.comboTimeout);
    }
}

const comboSystem = new ComboSystem();