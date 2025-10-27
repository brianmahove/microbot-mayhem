class GameState {
    constructor() {
        this.lastTime = performance.now();
        this.delta = 0;
        this.running = false;
        this.paused = false;
        this.state = 'menu'; // menu, playing, gameover, shop
        this.score = 0;
        this.difficultyTimer = 0;
        this.currentWave = 1;
        this.enemiesDefeated = 0;
        this.enemiesThisWave = 0;
        this.bossActive = false;
        this.gameTime = 0;
        this.totalCoins = parseInt(localStorage.getItem('totalCoins') || '0');
        this.highScore = parseInt(localStorage.getItem('microbotHighScore') || '0');
    }
    
    reset() {
        this.score = 0;
        this.difficultyTimer = 0;
        this.currentWave = 1;
        this.enemiesDefeated = 0;
        this.enemiesThisWave = 0;
        this.bossActive = false;
        this.gameTime = 0;
        this.state = 'menu';
    }
    
    saveProgress() {
        localStorage.setItem('totalCoins', this.totalCoins.toString());
        localStorage.setItem('microbotHighScore', this.highScore.toString());
    }
    
    addCoins(amount) {
        this.totalCoins += amount;
        this.saveProgress();
        return this.totalCoins;
    }
    
    checkHighScore() {
        if (this.score > this.highScore) {
            this.highScore = this.score;
            this.saveProgress();
            return true;
        }
        return false;
    }
}

// Global game state instance
const gameState = new GameState();