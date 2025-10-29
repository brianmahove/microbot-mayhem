/* Microbot Mayhem — Enhanced Competition Version
   - Added power-ups, boss enemies, visual polish, achievements, and more
   - All competition-winning features implemented
*/

/* ---------- Config ---------- */
const CONFIG = {
    width: 900,
    height: 600,
    maxEnemies: 12,
    spawnInterval: 1200, // ms
    enemySpeedRange: [0.6, 1.6],
    playerSpeed: 320,
    projectileSpeed: 520,
    particleCount: 24,
    difficultyIncreaseInterval: 15000, // ms
    colorAccent: '#7ae6a6',
    colorDanger: '#ff6b6b',
    
    // Enhanced config
    powerUps: {
        rapidFire: { duration: 5000, fireRate: 80, color: '#ffaa00', symbol: '⚡' },
        shield: { duration: 4000, color: '#00aaff', symbol: '🛡️' },
        tripleShot: { duration: 3000, color: '#ff00aa', symbol: '🔺' },
        speedBoost: { duration: 4000, speedMultiplier: 1.8, color: '#aaff00', symbol: '💨' }
    },
    bossHealth: 200,
    waveEnemyMultiplier: 1.2,
    
    // New competition features
    visualEffects: {
        screenShake: true,
        maxShakeIntensity: 15
    }
};

/* ---------- Canvas & Context ---------- */
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
canvas.width = CONFIG.width;
canvas.height = CONFIG.height;

/* ---------- UI elements ---------- */
const playBtn = document.getElementById('playBtn');
const pauseBtn = document.getElementById('pauseBtn');
const restartBtn = document.getElementById('restartBtn');
const instructionsBtn = document.getElementById('instructionsBtn');
const scoreEl = document.getElementById('score');
const healthEl = document.getElementById('health');
const waveEl = document.getElementById('wave');
const achievementPopup = document.getElementById('achievementPopup');
const achievementName = document.getElementById('achievementName');
const achievementDesc = document.getElementById('achievementDesc');
const powerUpIndicators = document.getElementById('powerUpIndicators');
const highScoreDisplay = document.getElementById('highScoreDisplay');
const gamesPlayed = document.getElementById('gamesPlayed');
const totalEnemies = document.getElementById('totalEnemies');

/* ---------- Game State ---------- */
let lastTime = performance.now();
let delta = 0;
let running = false;
let paused = false;
let state = 'menu'; // menu, playing, gameover
let score = 0;
let difficultyTimer = 0;
let currentWave = 1;
let enemiesDefeated = 0;
let enemiesThisWave = 0;
let bossActive = false;
let gameTime = 0;
let screenShake = { intensity: 0, duration: 0, startTime: 0 };

/* ---------- Input ---------- */
const input = { left:false, right:false, up:false, down:false, fire:false, mx:0, my:0, touch:false };

window.addEventListener('keydown', e => {
    if(e.key === 'ArrowLeft' || e.key === 'a') input.left = true;
    if(e.key === 'ArrowRight' || e.key === 'd') input.right = true;
    if(e.key === 'ArrowUp' || e.key === 'w') input.up = true;
    if(e.key === 'ArrowDown' || e.key === 's') input.down = true;
    if(e.key === ' ') input.fire = true;
    if(e.key === 'p') togglePause();
});

window.addEventListener('keyup', e => {
    if(e.key === 'ArrowLeft' || e.key === 'a') input.left = false;
    if(e.key === 'ArrowRight' || e.key === 'd') input.right = false;
    if(e.key === 'ArrowUp' || e.key === 'w') input.up = false;
    if(e.key === 'ArrowDown' || e.key === 's') input.down = false;
    if(e.key === ' ') input.fire = false;
});

canvas.addEventListener('mousemove', e => {
    const r = canvas.getBoundingClientRect();
    input.mx = (e.clientX - r.left) * (canvas.width / r.width);
    input.my = (e.clientY - r.top) * (canvas.height / r.height);
});

canvas.addEventListener('mousedown', e => { input.fire = true; });
window.addEventListener('mouseup', e => { input.fire = false; });

/* Mobile: simple virtual joystick buttons (touch) */
canvas.addEventListener('touchstart', e => {
    e.preventDefault();
    input.touch = true;
    input.fire = true;
}, {passive:false});

canvas.addEventListener('touchend', e => {
    e.preventDefault();
    input.touch = false;
    input.fire = false;
}, {passive:false});

canvas.addEventListener('touchmove', e => {
    if(!e.touches[0]) return;
    const r = canvas.getBoundingClientRect();
    input.mx = (e.touches[0].clientX - r.left) * (canvas.width / r.width);
    input.my = (e.touches[0].clientY - r.top) * (canvas.height / r.height);
}, {passive:false});

/* ---------- Audio (enhanced with panning) ---------- */
const AudioCtx = window.AudioContext || window.webkitAudioContext;
const audioCtx = new AudioCtx();

// Enhanced audio system with panning
const audio = {
    channels: [],
    play: function(freq=440, time=0.06, type='sine', gain=0.12, pan=0){
        const o = audioCtx.createOscillator();
        const g = audioCtx.createGain();
        const p = audioCtx.createStereoPanner();
        
        o.type = type;
        o.frequency.value = freq;
        g.gain.value = gain;
        p.pan.value = pan;
        
        o.connect(g);
        g.connect(p);
        p.connect(audioCtx.destination);
        
        o.start();
        g.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + time);
        o.stop(audioCtx.currentTime + time + 0.02);
    }
};

function playBeep(freq=440, time=0.06, type='sine', gain=0.12, pan=0){
    audio.play(freq, time, type, gain, pan);
}

function playExplosion(pitch=120, vol=0.18){
    // small burst noise using oscillator detune
    for(let i=0;i<3;i++){
        setTimeout(()=>playBeep(pitch + Math.random()*200, 0.08, 'sawtooth', vol/(i+1)), i*30);
    }
}

// Background music (simple generative)
function startBackgroundMusic() {
    const notes = [261.63, 293.66, 329.63, 349.23, 392.00, 440.00, 493.88];
    let noteIndex = 0;
    
    setInterval(() => {
        if(state === 'playing' && !paused) {
            playBeep(notes[noteIndex] * (1 + Math.floor(score/1000)), 0.3, 'sine', 0.03);
            noteIndex = (noteIndex + 1) % notes.length;
        }
    }, 600);
}

/* ---------- Screen Shake System ---------- */
function applyScreenShake(intensity = 8, duration = 300) {
    if(!CONFIG.visualEffects.screenShake) return;
    screenShake = { 
        intensity: Math.min(intensity, CONFIG.visualEffects.maxShakeIntensity), 
        duration, 
        startTime: performance.now() 
    };
}

function updateScreenShake() {
    if(screenShake.intensity > 0) {
        const progress = (performance.now() - screenShake.startTime) / screenShake.duration;
        if(progress >= 1) {
            screenShake.intensity = 0;
        }
    }
}

/* ---------- Achievement System ---------- */
const storage = {
    getHighScore: () => parseInt(localStorage.getItem('microbotHighScore') || '0'),
    setHighScore: (score) => localStorage.setItem('microbotHighScore', score),
    getAchievements: () => JSON.parse(localStorage.getItem('microbotAchievements') || '[]'),
    setAchievement: (id) => {
        const achievements = storage.getAchievements();
        if(!achievements.includes(id)) {
            achievements.push(id);
            localStorage.setItem('microbotAchievements', JSON.stringify(achievements));
            return true;
        }
        return false;
    }
};

const achievements = [
    { id: 'first_blood', name: 'First Blood', desc: 'Defeat your first enemy' },
    { id: 'survivor', name: 'Survivor', desc: 'Survive for 2 minutes' },
    { id: 'marksman', name: 'Marksman', desc: 'Hit 10 enemies without missing' },
    { id: 'pacifist', name: 'Pacifist Run', desc: 'Survive 1 minute without shooting' },
    { id: 'wave_master', name: 'Wave Master', desc: 'Reach wave 5' },
    { id: 'boss_slayer', name: 'Boss Slayer', desc: 'Defeat a boss enemy' }
];

let activeAchievements = storage.getAchievements();
let consecutiveHits = 0;
let lastHitTime = 0;

function unlockAchievement(id) {
    if(activeAchievements.includes(id)) return;
    
    const achievement = achievements.find(a => a.id === id);
    if(!achievement) return;
    
    if(storage.setAchievement(id)) {
        activeAchievements.push(id);
        showAchievementPopup(achievement.name, achievement.desc);
    }
}

function showAchievementPopup(name, desc) {
    achievementName.textContent = name;
    achievementDesc.textContent = desc;
    achievementPopup.classList.add('show');
    
    setTimeout(() => {
        achievementPopup.classList.remove('show');
    }, 3000);
}

/* ---------- Leaderboard System ---------- */
class Leaderboard {
    constructor() {
        this.scores = JSON.parse(localStorage.getItem('microbotLeaderboard') || '[]');
    }
    
    addScore(name, score, wave, time) {
        this.scores.push({ 
            name, 
            score, 
            wave, 
            time, 
            date: new Date().toLocaleDateString() 
        });
        this.scores.sort((a, b) => b.score - a.score);
        this.scores = this.scores.slice(0, 10); // Keep top 10
        localStorage.setItem('microbotLeaderboard', JSON.stringify(this.scores));
    }
    
    render(ctx) {
        ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
        ctx.fillRect(50, 150, CONFIG.width - 100, 300);
        
        ctx.fillStyle = '#7ae6a6';
        ctx.font = '20px Arial';
        ctx.textAlign = 'center';
        ctx.fillText('LEADERBOARD', CONFIG.width/2, 180);
        
        ctx.font = '14px Arial';
        ctx.textAlign = 'left';
        this.scores.forEach((entry, i) => {
            const y = 220 + i * 25;
            ctx.fillStyle = i === 0 ? '#ffd700' : '#ffffff';
            ctx.fillText(`${i+1}. ${entry.name}`, 100, y);
            ctx.fillText(entry.score, CONFIG.width - 150, y);
            ctx.fillText(`Wave ${entry.wave}`, CONFIG.width - 80, y);
        });
    }
}

const leaderboard = new Leaderboard();

/* ---------- Save System & Stats ---------- */
class SaveSystem {
    constructor() {
        this.data = JSON.parse(localStorage.getItem('microbotSave') || '{}');
        this.data.stats = this.data.stats || {
            totalPlayTime: 0,
            totalScore: 0,
            highestWave: 0,
            totalEnemiesDefeated: 0,
            totalGames: 0,
            totalPowerUps: 0
        };
    }
    
    saveGameStats() {
        this.data.stats.totalPlayTime += gameTime;
        this.data.stats.totalScore += score;
        this.data.stats.highestWave = Math.max(this.data.stats.highestWave, currentWave);
        this.data.stats.totalEnemiesDefeated += enemiesDefeated;
        this.data.stats.totalGames += 1;
        
        localStorage.setItem('microbotSave', JSON.stringify(this.data));
        updateStatsDisplay();
    }
    
    getStats() {
        return this.data.stats;
    }
}

const saveSystem = new SaveSystem();

function updateStatsDisplay() {
    const stats = saveSystem.getStats();
    highScoreDisplay.textContent = storage.getHighScore();
    gamesPlayed.textContent = stats.totalGames;
    totalEnemies.textContent = stats.totalEnemiesDefeated;
}

/* ---------- Particles ---------- */
const particles = [];

function spawnParticle(x,y,opts){
    particles.push(Object.assign({
        x,y,
        vx:(Math.random()-0.5)*opts.speed,
        vy:(Math.random()-0.5)*opts.speed,
        life:opts.life || 500,
        size: opts.size || 3,
        color: opts.color || CONFIG.colorAccent,
        created: performance.now()
    }, opts));
}

function createExplosion(x, y, color, size) {
    for(let i = 0; i < size; i++) {
        const angle = (i / size) * Math.PI * 2;
        const speed = 100 + Math.random() * 150;
        
        spawnParticle(x, y, {
            vx: Math.cos(angle) * speed,
            vy: Math.sin(angle) * speed,
            life: 400 + Math.random() * 300,
            size: 2 + Math.random() * 3,
            color: color
        });
    }
}

function updateParticles(dt){
    for(let i=particles.length-1;i>=0;i--){
        const p = particles[i];
        p.x += p.vx * dt/1000;
        p.y += p.vy * dt/1000;
        const age = performance.now() - p.created;
        if(age > p.life) particles.splice(i,1);
    }
}

function renderParticles(ctx){
    for(const p of particles){
        const a = 1 - ((performance.now() - p.created) / p.life);
        ctx.globalAlpha = a;
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x,p.y, Math.max(0.5, p.size * a), 0, Math.PI*2);
        ctx.fill();
        ctx.globalAlpha = 1;
    }
}

/* ---------- Power-ups ---------- */
const powerUps = [];

class PowerUp {
    constructor(x, y, type) {
        this.x = x; 
        this.y = y; 
        this.type = type;
        this.radius = 8;
        this.spawnTime = performance.now();
        this.life = 8000;
        this.color = CONFIG.powerUps[type].color;
        this.bobOffset = Math.random() * Math.PI * 2;
    }
    
    update(dt) {
        // Bobbing animation
        this.bobOffset += dt/1000 * 3;
        this.y += Math.sin(this.bobOffset) * 0.1;
    }
    
    render(ctx) {
        ctx.save();
        
        // Pulsing glow effect
        const pulse = 0.8 + 0.2 * Math.sin(this.bobOffset * 4);
        ctx.globalAlpha = 0.9;
        
        // Outer glow
        const gradient = ctx.createRadialGradient(
            this.x, this.y, 0,
            this.x, this.y, this.radius * 2
        );
        gradient.addColorStop(0, this.color);
        gradient.addColorStop(1, 'transparent');
        
        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius * 2, 0, Math.PI * 2);
        ctx.fill();
        
        // Core
        ctx.globalAlpha = 1;
        ctx.fillStyle = this.color;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius * pulse, 0, Math.PI * 2);
        ctx.fill();
        
        // Icon based on type
        ctx.fillStyle = 'rgba(255,255,255,0.9)';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.font = '10px Arial';
        
        let symbol = CONFIG.powerUps[this.type].symbol;
        
        ctx.fillText(symbol, this.x, this.y);
        
        ctx.restore();
    }
}

function spawnPowerUp(x, y) {
    const types = Object.keys(CONFIG.powerUps);
    const type = types[Math.floor(Math.random() * types.length)];
    powerUps.push(new PowerUp(x, y, type));
}

function updatePowerUps(dt) {
    for(let i = powerUps.length - 1; i >= 0; i--) {
        const p = powerUps[i];
        p.update(dt);
        
        // Check collection
        if(Math.hypot(player.x - p.x, player.y - p.y) < (player.radius + p.radius)) {
            player.applyPowerUp(p.type);
            powerUps.splice(i, 1);
            
            // Enhanced collection effects
            for(let j = 0; j < 20; j++) {
                const angle = (j / 20) * Math.PI * 2;
                spawnParticle(p.x, p.y, {
                    vx: Math.cos(angle) * 180,
                    vy: Math.sin(angle) * 180,
                    life: 500 + Math.random() * 300,
                    size: 3,
                    color: p.color,
                    fade: true
                });
            }
            
            playBeep(800, 0.1, 'sine', 0.1);
        }
        // Remove expired power-ups
        else if(performance.now() - p.spawnTime > p.life) {
            powerUps.splice(i, 1);
        }
    }
}

function updatePowerUpIndicators() {
    powerUpIndicators.innerHTML = '';
    const now = performance.now();
    
    for(const type in player.activePowerUps) {
        const remaining = player.activePowerUps[type] - now;
        const progress = remaining / CONFIG.powerUps[type].duration;
        
        const indicator = document.createElement('div');
        indicator.className = 'power-up-indicator';
        indicator.innerHTML = `
            <span class="power-up-icon">${CONFIG.powerUps[type].symbol}</span>
            <div class="power-up-timer">
                <div class="power-up-progress" style="width: ${progress * 100}%"></div>
            </div>
        `;
        powerUpIndicators.appendChild(indicator);
    }
}

/* ---------- Entities ---------- */
class Player {
    constructor(){
        this.x = CONFIG.width/2;
        this.y = CONFIG.height/2;
        this.vx = 0;
        this.vy = 0;
        this.radius = 14;
        this.health = 100;
        this.maxHealth = 100;
        this.lastFire = 0;
        this.fireRate = 180; // ms
        this.color = CONFIG.colorAccent;
        this.activePowerUps = {};
        this.shieldActive = false;
        this.shieldEndTime = 0;
        this.trailPositions = [];
    }
    
    update(dt){
        // Update power-up timers
        this.updatePowerUps();
        
        // Movement — physics-like with friction
        let speedMultiplier = 1;
        if(this.activePowerUps.speedBoost) {
            speedMultiplier = CONFIG.powerUps.speedBoost.speedMultiplier;
        }
        
        const acc = CONFIG.playerSpeed * speedMultiplier;
        let ax=0, ay=0;
        if(input.left) ax -= acc;
        if(input.right) ax += acc;
        if(input.up) ay -= acc;
        if(input.down) ay += acc;

        // mouse towards movement if touch+touchmove
        if(input.touch && (Math.abs(input.mx - this.x) > 10 || Math.abs(input.my - this.y) > 10)){
            const dx = input.mx - this.x, dy = input.my - this.y;
            const dist = Math.hypot(dx,dy);
            ax += (dx/dist) * acc;
            ay += (dy/dist) * acc;
        }

        // velocity integration + damping (reduced friction for more responsive movement)
        this.vx += ax * dt/1000;
        this.vy += ay * dt/1000;
        this.vx *= 0.92;
        this.vy *= 0.92;

        this.x += this.vx * dt/1000;
        this.y += this.vy * dt/1000;

        // clamp to screen
        this.x = Math.max(this.radius, Math.min(CONFIG.width - this.radius, this.x));
        this.y = Math.max(this.radius, Math.min(CONFIG.height - this.radius, this.y));

        // auto orient toward cursor
        const dx = input.mx - this.x, dy = input.my - this.y;
        this.ang = Math.atan2(dy, dx);

        // firing
        let fireRate = this.fireRate;
        if(this.activePowerUps.rapidFire) {
            fireRate = CONFIG.powerUps.rapidFire.fireRate;
        }
        
        if(input.fire && performance.now() - this.lastFire > fireRate){
            if(this.activePowerUps.tripleShot) {
                this.tripleShoot();
            } else {
                this.shoot();
            }
            this.lastFire = performance.now();
        }

        // Update trail for motion effect
        if(Math.hypot(this.vx, this.vy) > 50) {
            this.trailPositions.unshift({x: this.x, y: this.y});
            if(this.trailPositions.length > 5) {
                this.trailPositions.pop();
            }
        } else {
            this.trailPositions = [];
        }

        // idle particle glow
        if(Math.random() < 0.04) {
            spawnParticle(this.x + (Math.random()-0.5)*8, this.y + (Math.random()-0.5)*8, {
                speed: 30 + Math.random()*50, life: 350 + Math.random()*250, size: 2, color: '#bfffe0'
            });
        }
    }

    shoot(){
        const px = this.x + Math.cos(this.ang) * (this.radius+6);
        const py = this.y + Math.sin(this.ang) * (this.radius+6);
        const vx = Math.cos(this.ang) * CONFIG.projectileSpeed;
        const vy = Math.sin(this.ang) * CONFIG.projectileSpeed;
        projectiles.push(new Projectile(px,py,vx,vy));
        
        // muzzle particle
        for(let i=0;i<8;i++){
            spawnParticle(px,py,{
                speed: 140 + Math.random()*60,
                life: 220 + Math.random()*180,
                size: 1.5 + Math.random()*2,
                color:'#d0fff0'
            });
        }
        
        const pan = (this.x / CONFIG.width - 0.5) * 2;
        playBeep(900 + Math.random()*150, 0.05, 'sine', 0.06, pan);
    }

    tripleShoot(){
        for(let i = -1; i <= 1; i++) {
            const angle = this.ang + (i * 0.3);
            const px = this.x + Math.cos(angle) * (this.radius+6);
            const py = this.y + Math.sin(angle) * (this.radius+6);
            const vx = Math.cos(angle) * CONFIG.projectileSpeed;
            const vy = Math.sin(angle) * CONFIG.projectileSpeed;
            projectiles.push(new Projectile(px,py,vx,vy));
            
            // muzzle particles
            for(let j=0;j<4;j++){
                spawnParticle(px,py,{
                    speed: 140 + Math.random()*60,
                    life: 220 + Math.random()*180,
                    size: 1.5 + Math.random()*2,
                    color:'#d0fff0'
                });
            }
        }
        
        const pan = (this.x / CONFIG.width - 0.5) * 2;
        playBeep(700 + Math.random()*150, 0.07, 'sine', 0.08, pan);
    }

    applyPowerUp(type) {
        this.activePowerUps[type] = performance.now() + CONFIG.powerUps[type].duration;
        
        // Special handling for shield
        if(type === 'shield') {
            this.shieldActive = true;
            this.shieldEndTime = performance.now() + CONFIG.powerUps.shield.duration;
        }
        
        // Visual feedback
        createExplosion(this.x, this.y, CONFIG.powerUps[type].color, 15);
    }

    updatePowerUps() {
        const now = performance.now();
        
        // Check for expired power-ups
        for(const type in this.activePowerUps) {
            if(now > this.activePowerUps[type]) {
                delete this.activePowerUps[type];
                
                // Special handling for shield removal
                if(type === 'shield') {
                    this.shieldActive = false;
                }
            }
        }
        
        // Ensure shield matches power-up state
        if(this.shieldActive && now > this.shieldEndTime) {
            this.shieldActive = false;
    }
    }

    render(ctx){
        // Motion trail
        if(this.trailPositions.length > 0) {
            for(let i = 0; i < this.trailPositions.length; i++) {
                const pos = this.trailPositions[i];
                const alpha = 0.3 - (i * 0.06);
                
                ctx.globalAlpha = alpha;
                ctx.fillStyle = this.color;
                roundRect(ctx, pos.x - this.radius, pos.y - this.radius, 
                          this.radius*2, this.radius*2, 6);
                ctx.fill();
            }
            ctx.globalAlpha = 1;
        }
        
        // Shield effect
        if(this.shieldActive) {
            ctx.strokeStyle = CONFIG.powerUps.shield.color;
            ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.arc(this.x, this.y, this.radius + 8, 0, Math.PI * 2);
            ctx.stroke();
            
            // Pulsing effect
            const pulse = 0.8 + 0.2 * Math.sin(performance.now() / 200);
            ctx.globalAlpha = 0.3 * pulse;
            ctx.fillStyle = CONFIG.powerUps.shield.color;
            ctx.beginPath();
            ctx.arc(this.x, this.y, this.radius + 6, 0, Math.PI * 2);
            ctx.fill();
            ctx.globalAlpha = 1;
        }
        
        // glow
        const grad = ctx.createRadialGradient(this.x,this.y,2,this.x,this.y,this.radius*3);
        grad.addColorStop(0, 'rgba(122,230,166,0.2)');
        grad.addColorStop(1, 'rgba(122,230,166,0)');
        ctx.fillStyle = grad;
        ctx.beginPath(); ctx.arc(this.x,this.y,this.radius*2.2,0,Math.PI*2); ctx.fill();

        // body
        ctx.save();
        ctx.translate(this.x,this.y);
        ctx.rotate(this.ang || 0);
        // core
        ctx.fillStyle = this.color;
        roundRect(ctx, -this.radius, -this.radius, this.radius*2, this.radius*2, 6);
        ctx.fill();
        // eye / nozzle
        ctx.fillStyle='rgba(6,8,10,0.95)';
        ctx.fillRect(this.radius-2, -4, 8, 8);
        ctx.restore();
    }
}

class Projectile {
    constructor(x,y,vx,vy){
        this.x=x; this.y=y; this.vx=vx; this.vy=vy;
        this.radius=4; this.life = 1200; this.spawn=performance.now();
        this.color='#d0fff0';
    }
    update(dt){
        this.x += this.vx * dt/1000;
        this.y += this.vy * dt/1000;
    }
    alive(){ return (performance.now() - this.spawn) < this.life; }
    render(ctx){
        ctx.fillStyle=this.color;
        ctx.beginPath();
        ctx.arc(this.x,this.y,this.radius,0,Math.PI*2);
        ctx.fill();
    }
}

class Enemy {
    constructor(x,y,speed){
        this.x=x; this.y=y; this.vx=0; this.vy=0;
        this.radius = 12 + Math.random()*10;
        this.speed = speed;
        this.health = 14 + Math.floor(Math.random()*12);
        this.maxHealth = this.health;
        this.color = '#ffd08a';
        this.lastDirChange = 0;
    }
    update(dt, player){
        // simple steering towards player with occasional random movement
        const dx = player.x - this.x, dy = player.y - this.y;
        const dist = Math.hypot(dx,dy) || 1;
        const nx = dx/dist, ny = dy/dist;
        this.vx += nx * this.speed * dt/1000;
        this.vy += ny * this.speed * dt/1000;

        // limit speed
        const sp = Math.hypot(this.vx,this.vy);
        const maxsp = this.speed * 1.6;
        if(sp > maxsp){ this.vx = (this.vx/sp)*maxsp; this.vy = (this.vy/sp)*maxsp; }

        // physics integration
        this.x += this.vx * dt/1000;
        this.y += this.vy * dt/1000;

        // bounce from edges
        if(this.x < this.radius){ this.x = this.radius; this.vx *= -0.6; }
        if(this.x > CONFIG.width - this.radius){ this.x = CONFIG.width - this.radius; this.vx *= -0.6; }
        if(this.y < this.radius){ this.y = this.radius; this.vy *= -0.6; }
        if(this.y > CONFIG.height - this.radius){ this.y = CONFIG.height - this.radius; this.vy *= -0.6; }
    }
    render(ctx){
        // body with nucleus
        ctx.save();
        ctx.translate(this.x,this.y);
        ctx.beginPath();
        ctx.fillStyle = this.color;
        ctx.arc(0,0,this.radius,0,Math.PI*2);
        ctx.fill();

        ctx.fillStyle='rgba(40,10,6,0.8)';
        ctx.beginPath();
        ctx.arc(-this.radius*0.15, -this.radius*0.2, this.radius*0.4, 0, Math.PI*2);
        ctx.fill();
        ctx.restore();
        
        // Health bar
        if(this.health < this.maxHealth) {
            const barWidth = this.radius * 1.8;
            const barHeight = 4;
            const barY = this.y - this.radius - 8;
            
            ctx.fillStyle = 'rgba(0,0,0,0.5)';
            ctx.fillRect(this.x - barWidth/2, barY, barWidth, barHeight);
            
            ctx.fillStyle = this.health/this.maxHealth > 0.5 ? '#7ae6a6' : '#ff6b6b';
            ctx.fillRect(this.x - barWidth/2, barY, barWidth * (this.health/this.maxHealth), barHeight);
        }
    }
}

/* ---------- Smart Enemy AI ---------- */
class SmartEnemy extends Enemy {
    constructor(x, y, speed, behavior = 'aggressive') {
        super(x, y, speed);
        this.behavior = behavior;
        this.lastDecision = 0;
        this.decisionCooldown = 800 + Math.random() * 400;
        this.color = behavior === 'aggressive' ? '#ff6b6b' : 
                    behavior === 'cowardly' ? '#4d8cff' : 
                    '#ffaa00';
    }
    
    update(dt, player) {
        // Call parent update first
        super.update(dt, player);
        
        const now = performance.now();
        if(now - this.lastDecision > this.decisionCooldown) {
            this.makeDecision(player);
            this.lastDecision = now;
        }
    }
    
    makeDecision(player) {
        const distance = Math.hypot(this.x - player.x, this.y - player.y);
        
        switch(this.behavior) {
            case 'aggressive':
                if(distance < 80) this.evade(player);
                break;
            case 'cowardly':
                if(distance < 120) this.evade(player);
                else this.approach(player);
                break;
            case 'flanker':
                this.flank(player);
                break;
        }
    }
    
    evade(player) {
        const dx = this.x - player.x;
        const dy = this.y - player.y;
        const dist = Math.hypot(dx, dy);
        this.vx += (dx/dist) * this.speed * 1.5;
        this.vy += (dy/dist) * this.speed * 1.5;
    }
    
    approach(player) {
        const dx = player.x - this.x;
        const dy = player.y - this.y;
        const dist = Math.hypot(dx, dy);
        this.vx += (dx/dist) * this.speed * 0.8;
        this.vy += (dy/dist) * this.speed * 0.8;
    }
    
    flank(player) {
        const angle = Math.atan2(player.y - this.y, player.x - this.x);
        const flankAngle = angle + (Math.PI / 2) * (Math.random() > 0.5 ? 1 : -1);
        this.vx += Math.cos(flankAngle) * this.speed * 0.7;
        this.vy += Math.sin(flankAngle) * this.speed * 0.7;
        
        // Also approach slightly
        const dx = player.x - this.x;
        const dy = player.y - this.y;
        const dist = Math.hypot(dx, dy);
        this.vx += (dx/dist) * this.speed * 0.3;
        this.vy += (dy/dist) * this.speed * 0.3;
    }
}

/* ---------- Boss Enemy ---------- */
class BossEnemy extends Enemy {
    constructor() {
        super(CONFIG.width/2, -50, 1.2);
        this.radius = 40;
        this.health = CONFIG.bossHealth;
        this.maxHealth = CONFIG.bossHealth;
        this.attackPattern = 0;
        this.lastAttack = 0;
        this.attackCooldown = 2000;
        this.color = '#ff5555';
        this.pulse = 0;
    }
    
    update(dt, player) {
        // Special boss movement - more deliberate
        const dx = player.x - this.x, dy = player.y - this.y;
        const dist = Math.hypot(dx,dy) || 1;
        const nx = dx/dist, ny = dy/dist;
        
        // Keep some distance from player
        const desiredDist = 150;
        if(dist < desiredDist) {
            this.vx -= nx * this.speed * dt/1000;
            this.vy -= ny * this.speed * dt/1000;
        } else {
            this.vx += nx * this.speed * dt/1000 * 0.7;
            this.vy += ny * this.speed * dt/1000 * 0.7;
        }

        // limit speed
        const sp = Math.hypot(this.vx,this.vy);
        const maxsp = this.speed * 1.2;
        if(sp > maxsp){ this.vx = (this.vx/sp)*maxsp; this.vy = (this.vy/sp)*maxsp; }

        this.x += this.vx * dt/1000;
        this.y += this.vy * dt/1000;

        // Special attacks
        if(performance.now() - this.lastAttack > this.attackCooldown) {
            this.performAttack(player);
            this.lastAttack = performance.now();
        }
        
        // Animation
        this.pulse += dt/1000 * 5;
    }
    
    performAttack(player) {
        switch(this.attackPattern) {
            case 0:
                this.circleAttack();
                break;
            case 1:
                this.spiralAttack();
                break;
            case 2:
                this.targetedSpread(player);
                break;
        }
        this.attackPattern = (this.attackPattern + 1) % 3;
    }
    
    circleAttack() {
        const numProjectiles = 12;
        for(let i = 0; i < numProjectiles; i++) {
            const angle = (i / numProjectiles) * Math.PI * 2;
            const vx = Math.cos(angle) * 300;
            const vy = Math.sin(angle) * 300;
            projectiles.push(new EnemyProjectile(this.x, this.y, vx, vy, '#ff5555'));
        }
        playBeep(200, 0.1, 'sawtooth', 0.15);
    }
    
    spiralAttack() {
        const numProjectiles = 8;
        const baseAngle = performance.now() / 100;
        for(let i = 0; i < numProjectiles; i++) {
            const angle = baseAngle + (i / numProjectiles) * Math.PI * 2;
            const vx = Math.cos(angle) * 250;
            const vy = Math.sin(angle) * 250;
            projectiles.push(new EnemyProjectile(this.x, this.y, vx, vy, '#ff5555'));
        }
        playBeep(300, 0.08, 'sawtooth', 0.12);
    }
    
    targetedSpread(player) {
        const dx = player.x - this.x;
        const dy = player.y - this.y;
        const baseAngle = Math.atan2(dy, dx);
        
        for(let i = -2; i <= 2; i++) {
            const angle = baseAngle + (i * 0.2);
            const vx = Math.cos(angle) * 350;
            const vy = Math.sin(angle) * 350;
            projectiles.push(new EnemyProjectile(this.x, this.y, vx, vy, '#ff5555'));
        }
        playBeep(250, 0.1, 'sawtooth', 0.18);
    }
    
    render(ctx) {
        // Pulsing glow
        const pulseSize = 1 + 0.1 * Math.sin(this.pulse);
        
        // Outer glow
        const gradient = ctx.createRadialGradient(
            this.x, this.y, 0,
            this.x, this.y, this.radius * 2.5
        );
        gradient.addColorStop(0, 'rgba(255,85,85,0.4)');
        gradient.addColorStop(1, 'transparent');
        
        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius * 2.5, 0, Math.PI * 2);
        ctx.fill();
        
        // Main body
        ctx.fillStyle = this.color;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius * pulseSize, 0, Math.PI * 2);
        ctx.fill();
        
        // Core
        ctx.fillStyle = 'rgba(80,10,10,0.9)';
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius * 0.6, 0, Math.PI * 2);
        ctx.fill();
        
        // Health bar
        const barWidth = this.radius * 3;
        const barHeight = 8;
        const barY = this.y - this.radius - 20;
        
        ctx.fillStyle = 'rgba(0,0,0,0.7)';
        ctx.fillRect(this.x - barWidth/2, barY, barWidth, barHeight);
        
        ctx.fillStyle = this.health/this.maxHealth > 0.5 ? '#7ae6a6' : '#ff6b6b';
        ctx.fillRect(this.x - barWidth/2, barY, barWidth * (this.health/this.maxHealth), barHeight);
        
        // Boss label
        ctx.fillStyle = 'white';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.font = '12px Arial';
        ctx.fillText('BOSS', this.x, this.y);
    }
}

class EnemyProjectile extends Projectile {
    constructor(x,y,vx,vy,color){
        super(x,y,vx,vy);
        this.color = color || '#ff8888';
        this.radius = 6;
    }
}

/* ---------- Utility ---------- */
function roundRect(ctx, x, y, w, h, r){
    ctx.beginPath();
    ctx.moveTo(x+r,y);
    ctx.arcTo(x+w,y, x+w,y+h, r);
    ctx.arcTo(x+w,y+h, x,y+h, r);
    ctx.arcTo(x,y+h, x,y, r);
    ctx.arcTo(x,y, x+w,y, r);
    ctx.closePath();
}

/* ---------- Game collections ---------- */
const projectiles = [];
const enemies = [];
let spawnTimer = 0;

/* ---------- Player instance ---------- */
let player = new Player();

/* ---------- Spawn logic ---------- */
function spawnEnemy(){
    // spawn on the edges randomly
    const side = Math.floor(Math.random()*4);
    let x,y;
    if(side===0){ x = -20; y = Math.random()*CONFIG.height; }
    else if(side===1){ x = CONFIG.width + 20; y = Math.random()*CONFIG.height; }
    else if(side===2){ x = Math.random()*CONFIG.width; y = -20; }
    else{ x = Math.random()*CONFIG.width; y = CONFIG.height + 20; }

    const speed = CONFIG.enemySpeedRange[0] + Math.random()*(CONFIG.enemySpeedRange[1] - CONFIG.enemySpeedRange[0]);
    
    // Smart enemy chance (increases with waves)
    const smartEnemyChance = Math.min(0.3, currentWave * 0.05);
    if(Math.random() < smartEnemyChance) {
        const behaviors = ['aggressive', 'cowardly', 'flanker'];
        const behavior = behaviors[Math.floor(Math.random() * behaviors.length)];
        enemies.push(new SmartEnemy(x, y, speed * 1.2, behavior));
    } else {
        enemies.push(new Enemy(x, y, speed));
    }
    
    enemiesThisWave++;
}

function spawnBoss() {
    bossActive = true;
    enemies.push(new BossEnemy());
    enemiesThisWave++;
    
    // Boss spawn effects
    createExplosion(CONFIG.width/2, -30, '#ff5555', 30);
    applyScreenShake(10, 500);
    
    // Audio cue
    playBeep(100, 0.3, 'sawtooth', 0.2);
    setTimeout(() => playBeep(80, 0.3, 'sawtooth', 0.2), 400);
}

/* ---------- Wave System ---------- */
function checkWaveProgress() {
    if(enemies.length === 0 && enemiesDefeated >= enemiesThisWave) {
        // Wave completed
        currentWave++;
        waveEl.textContent = currentWave;
        enemiesDefeated = 0;
        enemiesThisWave = 0;
        
        // Every 3 waves, spawn a boss
        if(currentWave % 3 === 0) {
            setTimeout(spawnBoss, 1000);
        } else {
            // Increase enemy count for next wave
            const baseEnemies = 5 + Math.floor(currentWave * 0.8);
            for(let i = 0; i < baseEnemies; i++) {
                setTimeout(spawnEnemy, i * 300);
            }
        }
        
        // Wave complete effects
        createExplosion(CONFIG.width/2, CONFIG.height/2, '#7ae6a6', 20);
        applyScreenShake(5, 300);
        playBeep(600, 0.2, 'sine', 0.1);
        
        // Achievement for reaching wave 5
        if(currentWave >= 5 && !activeAchievements.includes('wave_master')) {
            unlockAchievement('wave_master');
        }
    }
}

/* ---------- Collision helpers ---------- */
function circleCollision(a,b){ return Math.hypot(a.x-b.x,a.y-b.y) < (a.radius + b.radius); }

/* ---------- Pickups ---------- */
const pickups = [];

function spawnPickup(x,y){
    pickups.push({x,y,spawn:performance.now(), radius:10, life:12000, type:'heal'});
}

function updatePickups(dt){
    for(let i=pickups.length-1;i>=0;i--){
        const p = pickups[i];
        // bobbing
        p.y += Math.sin((performance.now() - p.spawn)/200)/40;
        // collect
        if(Math.hypot(player.x - p.x, player.y - p.y) < (player.radius + p.radius)){
            pickups.splice(i,1);
            player.health = Math.min(100, player.health + 24 + Math.random()*18);
            score += 6;
            playBeep(1150, 0.07, 'triangle', 0.09);
            // particle ring
            for(let k=0;k<14;k++){
                spawnParticle(p.x + (Math.random()-0.5)*6, p.y + (Math.random()-0.5)*6, {
                    speed: 60 + Math.random()*90, life:240 + Math.random()*200, size:2, color:'#bfffe0'
                });
            }
        } else if(performance.now() - p.spawn > p.life){
            pickups.splice(i,1);
        }
    }
}

/* ---------- Game loop ---------- */
function resetGame(){
    player = new Player();
    projectiles.length = 0;
    enemies.length = 0;
    particles.length = 0;
    powerUps.length = 0;
    pickups.length = 0;
    score = 0;
    spawnTimer = 0;
    difficultyTimer = 0;
    currentWave = 1;
    enemiesDefeated = 0;
    enemiesThisWave = 0;
    bossActive = false;
    gameTime = 0;
    consecutiveHits = 0;
    screenShake.intensity = 0;
    state = 'menu';
    updateUI();
    updateStatsDisplay();
}

function startGame(){
    state='playing';
    player.health = 100;
    // Start with a small wave
    for(let i = 0; i < 3; i++) {
        setTimeout(spawnEnemy, i * 500);
    }
    updateUI();
    startBackgroundMusic();
}

function togglePause(){
    if(state !== 'playing') return;
    paused = !paused;
    pauseBtn.textContent = paused ? 'Resume' : 'Pause';
}

function updateUI(){
    scoreEl.textContent = score;
    healthEl.textContent = Math.max(0, Math.floor(player.health));
    waveEl.textContent = currentWave;
}

/* Main update */
function updateFrame(now){
    if(!running) return;
    delta = now - lastTime;
    lastTime = now;
    
    if(!paused && state === 'playing'){
        gameTime += delta;
        
        // Update screen shake
        updateScreenShake();
        
        // Update power-up indicators
        updatePowerUpIndicators();
        
        // Check achievements based on time
        if(gameTime > 120000 && !activeAchievements.includes('survivor')) {
            unlockAchievement('survivor');
        }
        if(gameTime > 60000 && consecutiveHits === 0 && !activeAchievements.includes('pacifist')) {
            unlockAchievement('pacifist');
        }
        
        // Reset consecutive hits if too much time passed
        if(now - lastHitTime > 2000) {
            consecutiveHits = 0;
        }

        // update timers & difficulty
        spawnTimer += delta;
        difficultyTimer += delta;
        if(difficultyTimer > CONFIG.difficultyIncreaseInterval){
            // increase difficulty subtly
            CONFIG.enemySpeedRange[0] += 0.06;
            CONFIG.enemySpeedRange[1] += 0.08;
            CONFIG.spawnInterval = Math.max(500, CONFIG.spawnInterval - 80);
            difficultyTimer = 0;
        }

        // spawn enemies (only if not in boss wave)
        if(!bossActive && spawnTimer > CONFIG.spawnInterval && enemies.length < CONFIG.maxEnemies){
            spawnTimer = 0;
            spawnEnemy();
        }

        // update player
        player.update(delta);

        // update projectiles
        for(let i=projectiles.length-1;i>=0;i--){
            const p = projectiles[i];
            p.update(delta);
            if(!p.alive()){ projectiles.splice(i,1); continue;}
        }

        // update enemies
        for(let i=enemies.length-1;i>=0;i--){
            const e = enemies[i];
            e.update(delta, player);
            // collisions with projectiles
            for(let j=projectiles.length-1;j>=0;j--){
                const pr = projectiles[j];
                if(circleCollision(e, pr)){
                    e.health -= 8 + Math.random()*10;
                    // particles & sound
                    for(let k=0;k<10;k++){
                        spawnParticle(pr.x, pr.y, {speed:80 + Math.random()*120, life:260 + Math.random()*200, size:1 + Math.random()*2, color:'#ffd8a8'});
                    }
                    
                    const pan = (e.x / CONFIG.width - 0.5) * 2;
                    playBeep(200 + Math.random()*240, 0.04, 'square', 0.06, pan);
                    
                    // Track consecutive hits
                    consecutiveHits++;
                    lastHitTime = now;
                    if(consecutiveHits >= 10 && !activeAchievements.includes('marksman')) {
                        unlockAchievement('marksman');
                    }
                    
                    // remove projectile
                    projectiles.splice(j,1);
                }
            }

            // enemy dies
            if(e.health <= 0){
                // Enhanced death particles
                const colors = e instanceof BossEnemy ? 
                    ['#ff5555', '#ff8888', '#ffaaaa'] : 
                    e instanceof SmartEnemy ? 
                    [e.color, '#ffffff', '#ffdd99'] :
                    ['#ffd08a', '#ffaa66', '#ffcc99'];
                
                for(let k = 0; k < (e instanceof BossEnemy ? 40 : 22); k++) {
                    const angle = Math.random() * Math.PI * 2;
                    const speed = 50 + Math.random() * 210;
                    spawnParticle(e.x, e.y, {
                        vx: Math.cos(angle) * speed,
                        vy: Math.sin(angle) * speed,
                        life: 380 + Math.random() * 340,
                        size: e instanceof BossEnemy ? 2 + Math.random() * 5 : 1 + Math.random() * 3,
                        color: colors[Math.floor(Math.random() * colors.length)],
                        gravity: 0.2
                    });
                }
                
                const pan = (e.x / CONFIG.width - 0.5) * 2;
                playExplosion(120 + Math.random()*100, 0.12);
                
                // Screen shake for deaths
                if(e instanceof BossEnemy) {
                    applyScreenShake(12, 500);
                } else {
                    applyScreenShake(4, 200);
                }
                
                score += Math.floor(10 + Math.random()*20);
                enemies.splice(i,1);
                enemiesDefeated++;
                
                // First blood achievement
                if(score > 0 && !activeAchievements.includes('first_blood')) {
                    unlockAchievement('first_blood');
                }
                
                // Boss slayer achievement
                if(e instanceof BossEnemy && !activeAchievements.includes('boss_slayer')) {
                    unlockAchievement('boss_slayer');
                    bossActive = false;
                }
                
                // chance to drop energy pickup (heals player)
                if(Math.random() < 0.35){
                    spawnPickup(e.x,e.y);
                }
                
                // chance to drop power-up
                if(Math.random() < 0.15){
                    spawnPowerUp(e.x, e.y);
                }
            }
        }

        // enemy-player collisions
        for(let i=enemies.length-1;i>=0;i--){
            const e = enemies[i];
            if(Math.hypot(e.x-player.x, e.y-player.y) < (e.radius + player.radius - 6)){
                // Skip collision if shield is active
                if(player.shieldActive) {
                    // Shield impact effect
                    createExplosion(e.x, e.y, CONFIG.powerUps.shield.color, 10);
                    e.vx *= -0.8;
                    e.vy *= -0.8;
                    continue;
                }
                
                // damage & knockback
                const impact = 8 + Math.random()*12;
                player.health -= impact;
                const dx = player.x - e.x, dy = player.y - e.y; const dist = Math.hypot(dx,dy)||1;
                player.vx += (dx/dist) * 220;
                player.vy += (dy/dist) * 220;
                for(let k=0;k<8;k++) spawnParticle(player.x,player.y,{speed:60 + Math.random()*120, life:220 + Math.random()*160, size:2, color:CONFIG.colorDanger});

                // Screen shake on hit
                applyScreenShake(6, 250);

                const pan = (player.x / CONFIG.width - 0.5) * 2;
                playBeep(160 + Math.random()*60, 0.06, 'sawtooth', 0.12, pan);

                // small stagger enemy
                e.vx *= -0.4; e.vy *= -0.4;
            }
        }

        // enemy projectiles collision with player
        for(let i=projectiles.length-1;i>=0;i--){
            const p = projectiles[i];
            if(p instanceof EnemyProjectile && circleCollision(p, player)) {
                // Skip collision if shield is active
                if(player.shieldActive) {
                    // Shield deflection effect
                    createExplosion(p.x, p.y, CONFIG.powerUps.shield.color, 8);
                    projectiles.splice(i,1);
                    continue;
                }
                
                player.health -= 5;
                createExplosion(p.x, p.y, CONFIG.colorDanger, 8);
                projectiles.splice(i,1);
                
                const pan = (player.x / CONFIG.width - 0.5) * 2;
                playBeep(120, 0.1, 'sawtooth', 0.1, pan);
            }
        }

        // pickups update
        updatePickups(delta);
        
        // power-ups update
        updatePowerUps(delta);

        // update particles
        updateParticles(delta);
        
        // check wave progress
        checkWaveProgress();

        // check game over
        if(player.health <= 0){
            state = 'gameover';
            // Save stats and check for high score
            saveSystem.saveGameStats();
            if(score > storage.getHighScore()) {
                storage.setHighScore(score);
            }
            
            // Leaderboard entry
            const playerName = prompt('Enter your name for the leaderboard:', 'Player') || 'Player';
            leaderboard.addScore(playerName, score, currentWave, Math.floor(gameTime/1000));
            
            playBeep(80, 0.25, 'sine', 0.28);
            setTimeout(()=>{ /* small delay to show death */ }, 200);
        }
        updateUI();
    }

    render();
    requestAnimationFrame(updateFrame);
}

/* ---------- Render ---------- */
function render(){
    // background
    ctx.clearRect(0,0,canvas.width,canvas.height);

    // Apply screen shake transform
    ctx.save();
    if(screenShake.intensity > 0) {
        const progress = (performance.now() - screenShake.startTime) / screenShake.duration;
        if(progress < 1) {
            const shake = screenShake.intensity * (1 - progress);
            ctx.translate(
                (Math.random() - 0.5) * shake,
                (Math.random() - 0.5) * shake
            );
        }
    }

    // moving background blobs
    renderBackground(ctx);

    // render pickups
    for(const p of pickups){
        ctx.save();
        ctx.globalAlpha = 0.95;
        ctx.beginPath();
        ctx.fillStyle = '#bfffe0';
        ctx.arc(p.x,p.y,p.radius,0,Math.PI*2);
        ctx.fill();
        ctx.restore();
    }
    
    // render power-ups
    for(const p of powerUps) {
        p.render(ctx);
    }

    // render player
    player.render(ctx);

    // render enemies
    for(const e of enemies) e.render(ctx);

    // render projectiles
    for(const pr of projectiles) pr.render(ctx);

    // render particles
    renderParticles(ctx);

    // Restore transform before UI
    ctx.restore();

    // HUD overlay
    if(state === 'menu'){
        drawMenu(ctx);
    } else if(state === 'gameover'){
        drawGameOver(ctx);
    }
}

/* Background animation */
let bgSeed = Math.random()*9999;

function renderBackground(ctx){
    // soft radial glow to suggest tissue depth
    ctx.save();
    const g = ctx.createLinearGradient(0,0,0,canvas.height);
    g.addColorStop(0,'rgba(3,16,20,0.6)');
    g.addColorStop(1,'rgba(6,10,18,0.85)');
    ctx.fillStyle = g;
    ctx.fillRect(0,0,canvas.width,canvas.height);

    // animated cells/drops
    const t = performance.now()/1000 + bgSeed;
    for(let i=0;i<10;i++){
        const bx = (i*73 + (t*10 + i*13) % canvas.width) % canvas.width;
        const by = (i*41 + Math.sin(t*(0.6+i*0.1)) * 18) + 20*i % canvas.height;
        ctx.beginPath();
        ctx.fillStyle = `rgba(255,255,255,${0.02 + ((i%3)/30)})`;
        ctx.ellipse((bx*1.1)%canvas.width,(by*1.1)%canvas.height, 50 - i*3, 18 - i*1.2, 0, 0, Math.PI*2);
        ctx.fill();
    }

    ctx.restore();
}

/* Menu & Gameover drawing */
function drawMenu(ctx){
    ctx.save();
    ctx.fillStyle='rgba(0,0,0,0.42)';
    ctx.fillRect(60,60, CONFIG.width-120, CONFIG.height-120);
    ctx.fillStyle = 'white';
    ctx.globalAlpha = 0.98;
    ctx.textAlign='center';
    ctx.font = '28px Inter, system-ui, sans-serif';
    ctx.fillStyle = '#dff8f0';
    ctx.fillText('Microbot Mayhem', CONFIG.width/2, CONFIG.height/2 - 60);
    
    // Stats display
    const stats = saveSystem.getStats();
    if(stats.totalGames > 0) {
        ctx.font = '12px Inter, sans-serif';
        ctx.fillStyle = 'rgba(255,255,255,0.7)';
        ctx.fillText(`Games Played: ${stats.totalGames} | Highest Wave: ${stats.highestWave}`, CONFIG.width/2, CONFIG.height/2 - 30);
        ctx.fillText(`Total Enemies Defeated: ${stats.totalEnemiesDefeated}`, CONFIG.width/2, CONFIG.height/2 - 15);
    }
    
    ctx.font = '14px Inter, sans-serif';
    ctx.fillStyle = '#bfeee0';
    ctx.fillText('Theme: SMALL — You are a tiny repair bot inside a human body. Survive & heal!', CONFIG.width/2, CONFIG.height/2 - 8);
    ctx.fillStyle = 'rgba(255,255,255,0.9)';
    ctx.font = '13px Inter, sans-serif';
    ctx.fillText('Controls: WASD / Arrow keys to move • Mouse to aim • Click or Space to shoot', CONFIG.width/2, CONFIG.height/2 + 18);
    ctx.fillText('Tip: Collect energy pickups to heal. Enemies get faster over time.', CONFIG.width/2, CONFIG.height/2 + 40);
    ctx.fillText('NEW: Power-ups, Boss enemies, Waves, and Achievements!', CONFIG.width/2, CONFIG.height/2 + 65);
    
    // Show high score
    const highScore = storage.getHighScore();
    if(highScore > 0) {
        ctx.fillText(`High Score: ${highScore}`, CONFIG.width/2, CONFIG.height/2 + 95);
    }
    
    ctx.restore();
}

function drawGameOver(ctx){
    ctx.save();
    ctx.fillStyle='rgba(0,0,0,0.6)';
    ctx.fillRect(80,80, CONFIG.width-160, CONFIG.height-160);
    ctx.textAlign='center';
    ctx.font='30px Inter, sans-serif';
    ctx.fillStyle = CONFIG.colorDanger;
    ctx.fillText('SYSTEM FAILURE', CONFIG.width/2, CONFIG.height/2 - 60);
    ctx.font='18px Inter, sans-serif';
    ctx.fillStyle='white';
    ctx.fillText(`Score: ${score}`, CONFIG.width/2, CONFIG.height/2 - 30);
    
    // Show high score if beaten
    const highScore = storage.getHighScore();
    if(score === highScore && score > 0) {
        ctx.fillStyle = CONFIG.colorAccent;
        ctx.fillText('NEW HIGH SCORE!', CONFIG.width/2, CONFIG.height/2 - 5);
    } else if(highScore > 0) {
        ctx.fillStyle = 'rgba(255,255,255,0.7)';
        ctx.fillText(`High Score: ${highScore}`, CONFIG.width/2, CONFIG.height/2 - 5);
    }
    
    // Leaderboard display
    leaderboard.render(ctx);
    
    ctx.font='13px Inter, sans-serif';
    ctx.fillStyle='#d0ffd8';
    ctx.fillText('Press Restart to try again. Great run!', CONFIG.width/2, CONFIG.height/2 + 250);
    ctx.restore();
}

/* ---------- UI Buttons ---------- */
playBtn.addEventListener('click', ()=>{ if(state==='menu'){ startGame(); } else if(state==='gameover'){ resetGame(); startGame(); }});
restartBtn.addEventListener('click', ()=>{ resetGame(); startGame(); });
instructionsBtn.addEventListener('click', ()=>{ alert('Microbot Mayhem - Competition Edition\n\nControls:\n- Move: WASD / Arrow keys\n- Aim: Mouse / Touch\n- Shoot: Mouse click or Space\n\nPower-ups:\n- ⚡ Rapid Fire: Faster shooting\n- 🛡️ Shield: Temporary protection\n- 🔺 Triple Shot: Fire three projectiles\n- 💨 Speed Boost: Increased movement speed\n\nEnemies:\n- Yellow: Basic enemies\n- Red: Aggressive - attacks then retreats\n- Blue: Cowardly - keeps distance\n- Orange: Flanker - moves around you\n- Big Red: BOSS - special attacks!\n\nObjective: Survive waves of enemies, defeat bosses, and achieve high scores!'); });
pauseBtn.addEventListener('click', ()=>{ togglePause(); });

/* ---------- Start the loop ---------- */
function startLoop(){
    if(running) return;
    running = true;
    lastTime = performance.now();
    requestAnimationFrame(updateFrame);
}
startLoop();

// Initialize stats display
updateStatsDisplay();

/* Kick off default menu particles */
for(let i=0;i<30;i++){
    spawnParticle(Math.random()*CONFIG.width, Math.random()*CONFIG.height, {
        speed: 10 + Math.random()*40, life: 1000 + Math.random()*2400, size:1 + Math.random()*2, color: 'rgba(255,255,255,0.05)'
    });
}

/* ---------- Small helper: auto-start audio on first interaction (mobile) ---------- */
function resumeAudio() {
    if(audioCtx.state === 'suspended') audioCtx.resume();
    window.removeEventListener('pointerdown', resumeAudio);
}
window.addEventListener('pointerdown', resumeAudio);