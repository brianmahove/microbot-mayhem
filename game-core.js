/* Microbot Mayhem — Core Game Engine */

/* ---------- Config ---------- */
const CONFIG = {
    width: 900,
    height: 600,
    maxEnemies: 12,
    spawnInterval: 1200,
    enemySpeedRange: [0.6, 1.6],
    playerSpeed: 320,
    projectileSpeed: 520,
    particleCount: 24,
    difficultyIncreaseInterval: 15000,
    colorAccent: '#7ae6a6',
    colorDanger: '#ff6b6b',
    
    powerUps: {
        rapidFire: { duration: 5000, fireRate: 80, color: '#ffaa00' },
        shield: { duration: 4000, color: '#00aaff' },
        tripleShot: { duration: 3000, color: '#ff00aa' },
        speedBoost: { duration: 4000, speedMultiplier: 1.8, color: '#aaff00' }
    },
    bossHealth: 200,
    waveEnemyMultiplier: 1.2
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
const upgradesBtn = document.getElementById('upgradesBtn');
const scoreEl = document.getElementById('score');
const healthEl = document.getElementById('health');
const waveEl = document.getElementById('wave');
const coinsEl = document.getElementById('coins');
const comboEl = document.getElementById('combo');

/* ---------- Game State ---------- */
let lastTime = performance.now();
let delta = 0;
let running = false;
let paused = false;
let state = 'menu';
let score = 0;
let difficultyTimer = 0;
let currentWave = 1;
let enemiesDefeated = 0;
let enemiesThisWave = 0;
let bossActive = false;
let gameTime = 0;

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

/* Mobile touch controls */
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

/* ---------- Audio ---------- */
const AudioCtx = window.AudioContext || window.webkitAudioContext;
const audioCtx = new AudioCtx();

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
    for(let i=0;i<3;i++){
        setTimeout(()=>playBeep(pitch + Math.random()*200, 0.08, 'sawtooth', vol/(i+1)), i*30);
    }
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
        this.bobOffset += dt/1000 * 3;
        this.y += Math.sin(this.bobOffset) * 0.1;
    }
    
    render(ctx) {
        ctx.save();
        
        const pulse = 0.8 + 0.2 * Math.sin(this.bobOffset * 4);
        ctx.globalAlpha = 0.9;
        
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
        
        ctx.globalAlpha = 1;
        ctx.fillStyle = this.color;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius * pulse, 0, Math.PI * 2);
        ctx.fill();
        
        ctx.fillStyle = 'rgba(255,255,255,0.9)';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.font = '10px Arial';
        
        let symbol = '?';
        switch(this.type) {
            case 'rapidFire': symbol = '⚡'; break;
            case 'shield': symbol = '🛡️'; break;
            case 'tripleShot': symbol = '🔺'; break;
            case 'speedBoost': symbol = '💨'; break;
        }
        
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
        
        if(Math.hypot(player.x - p.x, player.y - p.y) < (player.radius + p.radius)) {
            player.applyPowerUp(p.type);
            powerUps.splice(i, 1);
            createExplosion(p.x, p.y, p.color, 12);
            playBeep(800, 0.1, 'sine', 0.1);
        }
        else if(performance.now() - p.spawnTime > p.life) {
            powerUps.splice(i, 1);
        }
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
        this.fireRate = 180;
        this.color = CONFIG.colorAccent;
        this.activePowerUps = {};
        this.shieldActive = false;
        this.shieldEndTime = 0;
        this.trailPositions = [];
    }
    
    update(dt){
        this.updatePowerUps();
        
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

        if(input.touch && (Math.abs(input.mx - this.x) > 10 || Math.abs(input.my - this.y) > 10)){
            const dx = input.mx - this.x, dy = input.my - this.y;
            const dist = Math.hypot(dx,dy);
            ax += (dx/dist) * acc;
            ay += (dy/dist) * acc;
        }

        this.vx += ax * dt/1000;
        this.vy += ay * dt/1000;
        this.vx *= 0.92;
        this.vy *= 0.92;

        this.x += this.vx * dt/1000;
        this.y += this.vy * dt/1000;

        this.x = Math.max(this.radius, Math.min(CONFIG.width - this.radius, this.x));
        this.y = Math.max(this.radius, Math.min(CONFIG.height - this.radius, this.y));

        const dx = input.mx - this.x, dy = input.my - this.y;
        this.ang = Math.atan2(dy, dx);

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

        if(Math.hypot(this.vx, this.vy) > 50) {
            this.trailPositions.unshift({x: this.x, y: this.y});
            if(this.trailPositions.length > 5) {
                this.trailPositions.pop();
            }
        } else {
            this.trailPositions = [];
        }

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
        
        if(type === 'shield') {
            this.shieldActive = true;
            this.shieldEndTime = performance.now() + CONFIG.powerUps.shield.duration;
        }
        
        createExplosion(this.x, this.y, CONFIG.powerUps[type].color, 15);
    }

    updatePowerUps() {
        const now = performance.now();
        
        for(const type in this.activePowerUps) {
            if(now > this.activePowerUps[type]) {
                delete this.activePowerUps[type];
                if(type === 'shield') {
                    this.shieldActive = false;
                }
            }
        }
        
        if(this.shieldActive && now > this.shieldEndTime) {
            this.shieldActive = false;
        }
    }

    render(ctx){
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
        
        if(this.shieldActive) {
            ctx.strokeStyle = CONFIG.powerUps.shield.color;
            ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.arc(this.x, this.y, this.radius + 8, 0, Math.PI * 2);
            ctx.stroke();
            
            const pulse = 0.8 + 0.2 * Math.sin(performance.now() / 200);
            ctx.globalAlpha = 0.3 * pulse;
            ctx.fillStyle = CONFIG.powerUps.shield.color;
            ctx.beginPath();
            ctx.arc(this.x, this.y, this.radius + 6, 0, Math.PI * 2);
            ctx.fill();
            ctx.globalAlpha = 1;
        }
        
        const grad = ctx.createRadialGradient(this.x,this.y,2,this.x,this.y,this.radius*3);
        grad.addColorStop(0, 'rgba(122,230,166,0.2)');
        grad.addColorStop(1, 'rgba(122,230,166,0)');
        ctx.fillStyle = grad;
        ctx.beginPath(); ctx.arc(this.x,this.y,this.radius*2.2,0,Math.PI*2); ctx.fill();

        ctx.save();
        ctx.translate(this.x,this.y);
        ctx.rotate(this.ang || 0);
        ctx.fillStyle = this.color;
        roundRect(ctx, -this.radius, -this.radius, this.radius*2, this.radius*2, 6);
        ctx.fill();
        ctx.fillStyle='rgba(6,8,10,0.95)';
        ctx.fillRect(this.radius-2, -4, 8, 8);
        ctx.restore();
        
        this.renderPowerUpIndicators(ctx);
    }
    
    renderPowerUpIndicators(ctx) {
        const powerUpCount = Object.keys(this.activePowerUps).length;
        if(powerUpCount === 0) return;
        
        const now = performance.now();
        let index = 0;
        
        for(const type in this.activePowerUps) {
            const remaining = this.activePowerUps[type] - now;
            const progress = remaining / CONFIG.powerUps[type].duration;
            
            const x = 20 + index * 25;
            const y = 30;
            
            ctx.fillStyle = 'rgba(0,0,0,0.5)';
            ctx.fillRect(x - 8, y - 8, 16, 16);
            
            ctx.fillStyle = CONFIG.powerUps[type].color;
            ctx.fillRect(x - 6, y - 6, 12, 12);
            
            ctx.fillStyle = 'rgba(255,255,255,0.7)';
            ctx.fillRect(x - 6, y + 8, 12 * progress, 2);
            
            index++;
        }
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
        const dx = player.x - this.x, dy = player.y - this.y;
        const dist = Math.hypot(dx,dy) || 1;
        const nx = dx/dist, ny = dy/dist;
        this.vx += nx * this.speed * dt/1000;
        this.vy += ny * this.speed * dt/1000;

        const sp = Math.hypot(this.vx,this.vy);
        const maxsp = this.speed * 1.6;
        if(sp > maxsp){ this.vx = (this.vx/sp)*maxsp; this.vy = (this.vy/sp)*maxsp; }

        this.x += this.vx * dt/1000;
        this.y += this.vy * dt/1000;

        if(this.x < this.radius){ this.x = this.radius; this.vx *= -0.6; }
        if(this.x > CONFIG.width - this.radius){ this.x = CONFIG.width - this.radius; this.vx *= -0.6; }
        if(this.y < this.radius){ this.y = this.radius; this.vy *= -0.6; }
        if(this.y > CONFIG.height - this.radius){ this.y = CONFIG.height - this.radius; this.vy *= -0.6; }
    }
    render(ctx){
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
        const dx = player.x - this.x, dy = player.y - this.y;
        const dist = Math.hypot(dx,dy) || 1;
        const nx = dx/dist, ny = dy/dist;
        
        const desiredDist = 150;
        if(dist < desiredDist) {
            this.vx -= nx * this.speed * dt/1000;
            this.vy -= ny * this.speed * dt/1000;
        } else {
            this.vx += nx * this.speed * dt/1000 * 0.7;
            this.vy += ny * this.speed * dt/1000 * 0.7;
        }

        const sp = Math.hypot(this.vx,this.vy);
        const maxsp = this.speed * 1.2;
        if(sp > maxsp){ this.vx = (this.vx/sp)*maxsp; this.vy = (this.vy/sp)*maxsp; }

        this.x += this.vx * dt/1000;
        this.y += this.vy * dt/1000;

        if(performance.now() - this.lastAttack > this.attackCooldown) {
            this.performAttack(player);
            this.lastAttack = performance.now();
        }
        
        this.pulse += dt/1000 * 5;
    }
    
    performAttack(player) {
        switch(this.attackPattern) {
            case 0: this.circleAttack(); break;
            case 1: this.spiralAttack(); break;
            case 2: this.targetedSpread(player); break;
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
        const pulseSize = 1 + 0.1 * Math.sin(this.pulse);
        
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
        
        ctx.fillStyle = this.color;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius * pulseSize, 0, Math.PI * 2);
        ctx.fill();
        
        ctx.fillStyle = 'rgba(80,10,10,0.9)';
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius * 0.6, 0, Math.PI * 2);
        ctx.fill();
        
        const barWidth = this.radius * 3;
        const barHeight = 8;
        const barY = this.y - this.radius - 20;
        
        ctx.fillStyle = 'rgba(0,0,0,0.7)';
        ctx.fillRect(this.x - barWidth/2, barY, barWidth, barHeight);
        
        ctx.fillStyle = this.health/this.maxHealth > 0.5 ? '#7ae6a6' : '#ff6b6b';
        ctx.fillRect(this.x - barWidth/2, barY, barWidth * (this.health/this.maxHealth), barHeight);
        
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
    const side = Math.floor(Math.random()*4);
    let x,y;
    if(side===0){ x = -20; y = Math.random()*CONFIG.height; }
    else if(side===1){ x = CONFIG.width + 20; y = Math.random()*CONFIG.height; }
    else if(side===2){ x = Math.random()*CONFIG.width; y = -20; }
    else{ x = Math.random()*CONFIG.width; y = CONFIG.height + 20; }

    const speed = CONFIG.enemySpeedRange[0] + Math.random()*(CONFIG.enemySpeedRange[1] - CONFIG.enemySpeedRange[0]);
    enemies.push(new Enemy(x,y,speed));
    enemiesThisWave++;
}

function spawnBoss() {
    bossActive = true;
    enemies.push(new BossEnemy());
    enemiesThisWave++;
    
    createExplosion(CONFIG.width/2, -30, '#ff5555', 30);
    
    playBeep(100, 0.3, 'sawtooth', 0.2);
    setTimeout(() => playBeep(80, 0.3, 'sawtooth', 0.2), 400);
}

/* ---------- Wave System ---------- */
function checkWaveProgress() {
    if(enemies.length === 0 && enemiesDefeated >= enemiesThisWave) {
        currentWave++;
        waveEl.textContent = currentWave;
        enemiesDefeated = 0;
        enemiesThisWave = 0;
        
        if(currentWave % 3 === 0) {
            setTimeout(spawnBoss, 1000);
        } else {
            const baseEnemies = 5 + Math.floor(currentWave * 0.8);
            for(let i = 0; i < baseEnemies; i++) {
                setTimeout(spawnEnemy, i * 300);
            }
        }
        
        createExplosion(CONFIG.width/2, CONFIG.height/2, '#7ae6a6', 20);
        playBeep(600, 0.2, 'sine', 0.1);
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
        p.y += Math.sin((performance.now() - p.spawn)/200)/40;
        if(Math.hypot(player.x - p.x, player.y - p.y) < (player.radius + p.radius)){
            pickups.splice(i,1);
            player.health = Math.min(100, player.health + 24 + Math.random()*18);
            score += 6;
            playBeep(1150, 0.07, 'triangle', 0.09);
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

/* ---------- Background ---------- */
let bgSeed = Math.random()*9999;

function renderBackground(ctx){
    ctx.save();
    const g = ctx.createLinearGradient(0,0,0,canvas.height);
    g.addColorStop(0,'rgba(3,16,20,0.6)');
    g.addColorStop(1,'rgba(6,10,18,0.85)');
    ctx.fillStyle = g;
    ctx.fillRect(0,0,canvas.width,canvas.height);

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

/* ---------- UI Buttons ---------- */
playBtn.addEventListener('click', ()=>{ if(state==='menu'){ startGame(); } else if(state==='gameover'){ resetGame(); startGame(); }});
restartBtn.addEventListener('click', ()=>{ resetGame(); startGame(); });
instructionsBtn.addEventListener('click', ()=>{ alert('Microbot Mayhem\n\nControls:\n- Move: WASD / Arrow keys\n- Aim: Mouse / Touch\n- Shoot: Mouse click or Space\n\nPower-ups:\n- ⚡ Rapid Fire: Faster shooting\n- 🛡️ Shield: Temporary protection\n- 🔺 Triple Shot: Fire three projectiles\n- 💨 Speed Boost: Increased movement speed\n\nObjective: Survive waves of enemies, defeat bosses, and achieve high scores!'); });
pauseBtn.addEventListener('click', ()=>{ togglePause(); });

/* ---------- Start the loop ---------- */
function startLoop(){
    if(running) return;
    running = true;
    lastTime = performance.now();
    requestAnimationFrame(updateFrame);
}

/* ---------- Small helper: auto-start audio on first interaction ---------- */
function resumeAudio() {
    if(audioCtx.state === 'suspended') audioCtx.resume();
    window.removeEventListener('pointerdown', resumeAudio);
}
window.addEventListener('pointerdown', resumeAudio);

/* ---------- Game Loop Functions ---------- */
function updateFrame(now) {
    if(!running) return;
    delta = now - lastTime;
    lastTime = now;
    
    if(!paused && state === 'playing'){
        gameTime += delta;

        // update timers & difficulty
        spawnTimer += delta;
        difficultyTimer += delta;
        if(difficultyTimer > CONFIG.difficultyIncreaseInterval){
            CONFIG.enemySpeedRange[0] += 0.06;
            CONFIG.enemySpeedRange[1] += 0.08;
            CONFIG.spawnInterval = Math.max(500, CONFIG.spawnInterval - 80);
            difficultyTimer = 0;
        }

        // spawn enemies
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
                    
                    for(let k=0;k<10;k++){
                        spawnParticle(pr.x, pr.y, {
                            speed:80 + Math.random()*120, 
                            life:260 + Math.random()*200, 
                            size:1 + Math.random()*2, 
                            color:'#ffd8a8'
                        });
                    }
                    
                    const pan = (e.x / CONFIG.width - 0.5) * 2;
                    playBeep(200 + Math.random()*240, 0.04, 'square', 0.06, pan);
                    
                    projectiles.splice(j,1);
                    
                    // Call enhanced enemy hit (from addictive features)
                    if (window.onEnemyHit) window.onEnemyHit();
                }
            }

            // enemy dies
            if(e.health <= 0){
                // Use enhanced enemy death if available
                if (window.enhancedEnemyDeath) {
                    window.enhancedEnemyDeath(e, i);
                } else {
                    // Fallback to original death
                    for(let k=0;k<22;k++){
                        spawnParticle(e.x, e.y, {
                            speed:50 + Math.random()*210, 
                            life:380 + Math.random()*240, 
                            size:1 + Math.random()*3, 
                            color:'#ffd08a'
                        });
                    }
                    
                    const pan = (e.x / CONFIG.width - 0.5) * 2;
                    playExplosion(120 + Math.random()*100, 0.12);
                    
                    score += Math.floor(10 + Math.random()*20);
                    enemies.splice(i,1);
                    enemiesDefeated++;
                    
                    if(Math.random() < 0.35){
                        spawnPickup(e.x,e.y);
                    }
                    if(Math.random() < 0.15){
                        spawnPowerUp(e.x, e.y);
                    }
                }
            }
        }

        // enemy-player collisions
        for(let i=enemies.length-1;i>=0;i--){
            const e = enemies[i];
            if(Math.hypot(e.x-player.x, e.y-player.y) < (e.radius + player.radius - 6)){
                if(player.shieldActive) {
                    createExplosion(e.x, e.y, CONFIG.powerUps.shield.color, 10);
                    e.vx *= -0.8;
                    e.vy *= -0.8;
                    continue;
                }
                
                const impact = 8 + Math.random()*12;
                player.health -= impact;
                const dx = player.x - e.x, dy = player.y - e.y; 
                const dist = Math.hypot(dx,dy)||1;
                player.vx += (dx/dist) * 220;
                player.vy += (dy/dist) * 220;
                
                for(let k=0;k<8;k++) spawnParticle(player.x,player.y,{
                    speed:60 + Math.random()*120, 
                    life:220 + Math.random()*160, 
                    size:2, 
                    color:CONFIG.colorDanger
                });

                const pan = (player.x / CONFIG.width - 0.5) * 2;
                playBeep(160 + Math.random()*60, 0.06, 'sawtooth', 0.12, pan);

                e.vx *= -0.4; 
                e.vy *= -0.4;
            }
        }

        // enemy projectiles collision with player
        for(let i=projectiles.length-1;i>=0;i--){
            const p = projectiles[i];
            if(p instanceof EnemyProjectile && circleCollision(p, player)) {
                if(player.shieldActive) {
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
        for(let i=pickups.length-1;i>=0;i--){
            const p = pickups[i];
            p.y += Math.sin((performance.now() - p.spawn)/200)/40;
            
            if(Math.hypot(player.x - p.x, player.y - p.y) < (player.radius + p.radius)){
                // Use enhanced pickup collection if available
                if (window.enhancedPickupCollection) {
                    window.enhancedPickupCollection(p, i);
                } else {
                    // Fallback to original pickup
                    pickups.splice(i,1);
                    player.health = Math.min(100, player.health + 24 + Math.random()*18);
                    score += 6;
                    playBeep(1150, 0.07, 'triangle', 0.09);
                    
                    for(let k=0;k<14;k++){
                        spawnParticle(p.x + (Math.random()-0.5)*6, p.y + (Math.random()-0.5)*6, {
                            speed: 60 + Math.random()*90, 
                            life:240 + Math.random()*200, 
                            size:2, 
                            color:'#bfffe0'
                        });
                    }
                }
            } else if(performance.now() - p.spawn > p.life){
                pickups.splice(i,1);
            }
        }
        
        // power-ups update
        updatePowerUps(delta);

        // update particles
        updateParticles(delta);
        
        // check wave progress
        checkWaveProgress();

        // check game over
        if(player.health <= 0){
            state = 'gameover';
            playBeep(80, 0.25, 'sine', 0.28);
            
            // Call game over hook for addictive features
            if (window.onGameOver) window.onGameOver(score);
        }
        
        updateUI();
    }

    render();
    requestAnimationFrame(updateFrame);
}

function render(){
    ctx.clearRect(0,0,canvas.width,canvas.height);

    renderBackground(ctx);

    for(const p of pickups){
        ctx.save();
        ctx.globalAlpha = 0.95;
        ctx.beginPath();
        ctx.fillStyle = '#bfffe0';
        ctx.arc(p.x,p.y,p.radius,0,Math.PI*2);
        ctx.fill();
        ctx.restore();
    }
    
    for(const p of powerUps) {
        p.render(ctx);
    }

    player.render(ctx);

    for(const e of enemies) e.render(ctx);

    for(const pr of projectiles) pr.render(ctx);

    renderParticles(ctx);

    // Call addictive features render if available
    if (window.renderAddictiveFeatures) {
        window.renderAddictiveFeatures(ctx);
    }

    if(state === 'menu'){
        drawMenu(ctx);
    } else if(state === 'gameover'){
        drawGameOver(ctx);
    }
}

function drawMenu(ctx){
    ctx.save();
    ctx.fillStyle='rgba(0,0,0,0.42)';
    ctx.fillRect(60,60, CONFIG.width-120, CONFIG.height-120);
    ctx.fillStyle = 'white';
    ctx.globalAlpha = 0.98;
    ctx.textAlign='center';
    ctx.font = '28px Inter, system-ui, sans-serif';
    ctx.fillStyle = '#dff8f0';
    ctx.fillText('Microbot Mayhem', CONFIG.width/2, CONFIG.height/2 - 40);
    ctx.font = '14px Inter, sans-serif';
    ctx.fillStyle = '#bfeee0';
    ctx.fillText('Theme: SMALL — You are a tiny repair bot inside a human body. Survive & heal!', CONFIG.width/2, CONFIG.height/2 - 8);
    ctx.fillStyle = 'rgba(255,255,255,0.9)';
    ctx.font = '13px Inter, sans-serif';
    ctx.fillText('Controls: WASD / Arrow keys to move • Mouse to aim • Click or Space to shoot', CONFIG.width/2, CONFIG.height/2 + 18);
    ctx.fillText('Tip: Collect energy pickups to heal. Enemies get faster over time.', CONFIG.width/2, CONFIG.height/2 + 40);
    
    const highScore = localStorage.getItem('microbotHighScore') || '0';
    if(parseInt(highScore) > 0) {
        ctx.fillText(`High Score: ${highScore}`, CONFIG.width/2, CONFIG.height/2 + 70);
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
    ctx.fillText('SYSTEM FAILURE', CONFIG.width/2, CONFIG.height/2 - 20);
    ctx.font='18px Inter, sans-serif';
    ctx.fillStyle='white';
    ctx.fillText(`Score: ${score}`, CONFIG.width/2, CONFIG.height/2 + 10);
    
    const highScore = parseInt(localStorage.getItem('microbotHighScore') || '0');
    if(score === highScore && score > 0) {
        ctx.fillStyle = CONFIG.colorAccent;
        ctx.fillText('NEW HIGH SCORE!', CONFIG.width/2, CONFIG.height/2 + 35);
    } else if(highScore > 0) {
        ctx.fillStyle = 'rgba(255,255,255,0.7)';
        ctx.fillText(`High Score: ${highScore}`, CONFIG.width/2, CONFIG.height/2 + 35);
    }
    
    ctx.font='13px Inter, sans-serif';
    ctx.fillStyle='#d0ffd8';
    ctx.fillText('Press Restart to try again. Great run!', CONFIG.width/2, CONFIG.height/2 + 65);
    ctx.restore();
}

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
    state = 'menu';
    
    // Reset UI
    scoreEl.textContent = '0';
    healthEl.textContent = '100';
    waveEl.textContent = '1';
    
    // Call addictive features reset if available
    if (window.onGameReset) window.onGameReset();
}

function startGame(){
    state = 'playing';
    player.health = player.maxHealth;
    
    // Start with initial enemies
    for(let i = 0; i < 3; i++) {
        setTimeout(spawnEnemy, i * 500);
    }
    
    updateUI();
    
    // Call addictive features start if available
    if (window.onGameStart) window.onGameStart();
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

// Start the game loop when everything is loaded
window.addEventListener('load', function() {
    startLoop();
    
    // Kick off default menu particles
    for(let i=0;i<30;i++){
        spawnParticle(Math.random()*CONFIG.width, Math.random()*CONFIG.height, {
            speed: 10 + Math.random()*40, 
            life: 1000 + Math.random()*2400, 
            size:1 + Math.random()*2, 
            color: 'rgba(255,255,255,0.05)'
        });
    }
});