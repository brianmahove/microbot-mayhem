class MissionSystem {
    constructor() {
        this.missions = this.loadMissions();
        this.completedToday = this.loadCompleted();
    }
    
    generateDailyMissions() {
        const missionTemplates = [
            {
                type: 'enemies_killed',
                target: 50,
                reward: 100,
                title: 'Enemy Exterminator',
                description: 'Defeat 50 enemies'
            },
            {
                type: 'survival_time',
                target: 180, // seconds
                reward: 150,
                title: 'Survival Expert',
                description: 'Survive for 3 minutes'
            },
            {
                type: 'pickups_collected',
                target: 10,
                reward: 80,
                title: 'Resource Collector',
                description: 'Collect 10 energy pickups'
            },
            {
                type: 'bosses_killed',
                target: 2,
                reward: 200,
                title: 'Boss Hunter',
                description: 'Defeat 2 boss enemies'
            },
            {
                type: 'high_combo',
                target: 8,
                reward: 120,
                title: 'Combo Master',
                description: 'Achieve an 8-kill combo'
            },
            {
                type: 'waves_completed',
                target: 5,
                reward: 180,
                title: 'Wave Warrior',
                description: 'Complete 5 waves'
            }
        ];
        
        // Shuffle and pick 3 random missions
        const shuffled = [...missionTemplates].sort(() => Math.random() - 0.5);
        return shuffled.slice(0, CONFIG.addictiveFeatures.dailyMissionCount).map(mission => ({
            ...mission,
            id: this.generateMissionId(),
            current: 0,
            completed: false
        }));
    }
    
    loadMissions() {
        const today = new Date().toDateString();
        const saved = localStorage.getItem('dailyMissions');
        
        if (saved) {
            const data = JSON.parse(saved);
            if (data.date === today) {
                return data.missions;
            }
        }
        
        // Generate new missions for today
        const newMissions = this.generateDailyMissions();
        this.saveMissions(newMissions, today);
        return newMissions;
    }
    
    saveMissions(missions, date) {
        localStorage.setItem('dailyMissions', JSON.stringify({
            date: date || new Date().toDateString(),
            missions: missions
        }));
    }
    
    loadCompleted() {
        const today = new Date().toDateString();
        const saved = localStorage.getItem('completedMissions');
        return saved ? JSON.parse(saved) : [];
    }
    
    generateMissionId() {
        return 'mission_' + Math.random().toString(36).substr(2, 9);
    }
    
    updateProgress(type, amount = 1) {
        let completedAny = false;
        
        this.missions.forEach(mission => {
            if (!mission.completed && mission.type === type) {
                mission.current = Math.min(mission.current + amount, mission.target);
                
                if (mission.current >= mission.target) {
                    mission.completed = true;
                    this.completeMission(mission);
                    completedAny = true;
                }
            }
        });
        
        this.saveMissions(this.missions);
        return completedAny;
    }
    
    completeMission(mission) {
        // Add coins reward
        gameState.addCoins(mission.reward);
        
        // Show completion popup
        this.showMissionComplete(mission);
        
        // Record completion
        this.completedToday.push({
            id: mission.id,
            title: mission.title,
            reward: mission.reward,
            completedAt: Date.now()
        });
        
        localStorage.setItem('completedMissions', JSON.stringify(this.completedToday));
    }
    
    showMissionComplete(mission) {
        const popup = document.getElementById('missionPopup');
        const reward = document.getElementById('missionReward');
        
        reward.textContent = `+${mission.reward} Coins - ${mission.title}`;
        popup.classList.add('show');
        
        setTimeout(() => {
            popup.classList.remove('show');
        }, 3000);
        
        // Play celebration sound
        if (window.audio) {
            for (let i = 0; i < 3; i++) {
                setTimeout(() => {
                    audio.playBeep(600 + (i * 100), 0.1, 'sine', 0.1);
                }, i * 200);
            }
        }
    }
    
    getProgress() {
        const total = this.missions.length;
        const completed = this.missions.filter(m => m.completed).length;
        return { completed, total };
    }
}

const missionSystem = new MissionSystem();