/**
 * Rua Segura - v5.0 (Blitz 20s / Jogo 5min)
 * @description Jogo de fiscalização de trânsito desenvolvido em JavaScript Vanilla.
 * @author Antigravity
 */

const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const scoreEl = document.getElementById('score-value');
const timerEl = document.getElementById('timer-value');
const gameOverScreen = document.getElementById('game-over-screen');
const startScreen = document.getElementById('start-screen');
const failScreen = document.getElementById('fail-screen');
const inspectionScreen = document.getElementById('document-inspection');

// Modal Fields
const cnhName = document.getElementById('cnh-name');
const cnhAge = document.getElementById('cnh-age');
const cnhPlate = document.getElementById('cnh-plate');
const cnhStatus = document.getElementById('cnh-status');
const cnhPoints = document.getElementById('cnh-points');
const cnhPhone = document.getElementById('cnh-phone'); // NOVO: Campo de celular no modal
const inspectFineBtn = document.getElementById('inspect-fine-btn');
const inspectReleaseBtn = document.getElementById('inspect-release-btn');

const finalScoreEl = document.getElementById('final-score');
const restartBtn = document.getElementById('restart-btn');
const failRestartBtn = document.getElementById('fail-restart-btn');
const startBtn = document.getElementById('start-btn');
const blitzBtn = document.getElementById('blitz-btn');

// --- Configurações ---
const DIFFICULTY = {
    carSpawnRate: 0.025,       
    minCarSpeed: 2.2,           
    maxCarSpeed: 4.5,           
    phoneInfractionRate: 0.3, 
    redLightInfractionRate: 0.3, 
    gameDurationSeconds: 300,  
    stopLineX: 650,           
    blitzLineX: 520,          
    safeDistance: 140,        
    minimumGap: 35,           
    laneCount: 4,             
};

const NAMES = ["José", "Maria", "João", "Ana", "Carlos", "Francisca", "Paulo", "Antônia", "Lucas", "Adriana", "Pedro", "Juliana"];
const SURNAMES = ["Silva", "Santos", "Oliveira", "Souza", "Rodrigues", "Ferreira", "Alves", "Pereira", "Lima", "Gomes"];

// --- Estado do Jogo ---
let gameState = {
    score: 0,
    timeLeft: DIFFICULTY.gameDurationSeconds,
    isGameOver: false,
    hasStarted: false,
    isPaused: false, 
    trafficLight: 'GREEN', 
    isBlitzActive: false,
    blitzCooldown: false,
    currentLicenseCar: null, 
    cars: [],
    feedbackMessages: [], 
};

// --- Cores ---
const COLORS = {
    road: '#2c3e50',
    line: '#ecf0f1',
    trafficGreen: '#2ecc71',
    trafficRed: '#e74c3c',
    police: '#2980b9',
    carColors: [
        { main: '#3498db', dark: '#2980b9' }, 
        { main: '#e74c3c', dark: '#c0392b' }, 
        { main: '#f1c40f', dark: '#f39c12' }, 
        { main: '#9b59b6', dark: '#8e44ad' }, 
        { main: '#1abc9c', dark: '#16a085' }, 
        { main: '#ecf0f1', dark: '#bdc3c7' }  
    ],
};

// --- Classes ---

class Car {
    constructor(lane) {
        this.width = 110;
        this.height = 42; 
        this.baseLane = lane;
        this.lane = lane;
        this.y = 200 + (this.lane * 50) + 4; // Posicionado no centro da faixa de 50px
        this.baseSpeed = DIFFICULTY.minCarSpeed + Math.random() * (DIFFICULTY.maxCarSpeed - DIFFICULTY.minCarSpeed);
        this.speed = this.baseSpeed;
        const colorSet = COLORS.carColors[Math.floor(Math.random() * COLORS.carColors.length)];
        this.color = colorSet.main;
        this.darkColor = colorSet.dark;
        
        // Driver Data
        this.name = NAMES[Math.floor(Math.random() * NAMES.length)] + " " + SURNAMES[Math.floor(Math.random() * SURNAMES.length)];
        this.age = Math.floor(Math.random() * 60) + 12; 
        this.plate = this.generatePlate();
        this.hasLicense = Math.random() < 0.82; 
        this.licensePoints = Math.floor(Math.random() * 60);

        this.hasPhoneInfraction = Math.random() < DIFFICULTY.phoneInfractionRate;
        this.willIgnoreRedLight = Math.random() < DIFFICULTY.redLightInfractionRate;

        this.committedRedLightInfraction = false;
        this.hasBeenPenalized = false; 
        this.isFined = false;
        this.isInspected = false; 
        this.isApprehended = false; 
    }

    generatePlate() {
        const letters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
        return letters[Math.floor(Math.random()*26)] + letters[Math.floor(Math.random()*26)] + letters[Math.floor(Math.random()*26)] + 
               Math.floor(Math.random()*10) + letters[Math.floor(Math.random()*26)] + Math.floor(Math.random()*10) + Math.floor(Math.random()*10);
    }

    update(trafficLight, isBlitzActive) {
        if (gameState.isPaused) return false;

        // Fila única na blitz (força Lane 0)
        if (isBlitzActive && !this.isInspected && this.x < DIFFICULTY.blitzLineX) {
            this.lane = 0;
        }

        const targetY = 200 + (this.lane * 50) + 4;
        if (Math.abs(this.y - targetY) > 0.5) { this.y += (targetY - this.y) * 0.1; }

        if (this.isApprehended) { this.y -= 4.5; this.x += 1; return false; }

        const frontX = this.x + this.width;
        
        // Carro à frente na mesma faixa visual
        const carAhead = gameState.cars
            .filter(c => c !== this && Math.abs(c.y - this.y) < 30 && c.x > this.x)
            .sort((a, b) => a.x - b.x)[0];
        
        let targetSpeed = this.baseSpeed;

        if (!this.willIgnoreRedLight && !isBlitzActive) {
            if (trafficLight === 'RED' && frontX < DIFFICULTY.stopLineX - 10 && frontX > DIFFICULTY.stopLineX - 300) targetSpeed = 0;
        }

        if (isBlitzActive && !this.isInspected && this.lane === 0) {
            if (frontX < DIFFICULTY.blitzLineX && frontX > DIFFICULTY.blitzLineX - 450) {
                targetSpeed = 0;
                if (frontX > DIFFICULTY.blitzLineX - 5) this.speed = 0;
            }
        }

        if (carAhead) {
            const currentGap = carAhead.x - frontX;
            if (currentGap < DIFFICULTY.safeDistance) {
                const ratio = Math.max(0, (currentGap - DIFFICULTY.minimumGap) / (DIFFICULTY.safeDistance - DIFFICULTY.minimumGap));
                targetSpeed = Math.min(targetSpeed, carAhead.speed * ratio);
            }
        }

        if (this.speed > targetSpeed) { this.speed = Math.max(targetSpeed, this.speed - 0.4); }
        else if (this.speed < targetSpeed) { this.speed = Math.min(targetSpeed, this.speed + 0.2); }
        
        let nextX = this.x + this.speed;
        if (carAhead) {
            if (nextX + this.width > carAhead.x - DIFFICULTY.minimumGap) {
                nextX = carAhead.x - this.width - DIFFICULTY.minimumGap;
                this.speed = 0;
            }
        }
        this.x = nextX;

        // Avanço de sinal fora da blitz
        if (!isBlitzActive && trafficLight === 'RED' && frontX > DIFFICULTY.stopLineX && this.x < DIFFICULTY.stopLineX + 40 && this.speed > 0.6) {
            if (!this.hasBeenPenalized) {
                gameState.score -= 25; this.hasBeenPenalized = true;
                addFeedback('-25 AVANÇO!', this.x + 50, this.y, '#ff9f43');
                scoreEl.innerText = gameState.score;
            }
        }

        if (this.x > canvas.width && this.hasPhoneInfraction && !this.isFined) { showFailScreen(); return true; }
        return false;
    }

    draw(ctx) {
        ctx.fillStyle = 'rgba(0,0,0,0.2)';
        ctx.beginPath(); ctx.roundRect(this.x + 5, this.y + 8, this.width, this.height, 8); ctx.fill();
        const grad = ctx.createLinearGradient(this.x, this.y, this.x, this.y + this.height);
        grad.addColorStop(0, this.color); grad.addColorStop(1, this.darkColor);
        ctx.fillStyle = grad;
        ctx.beginPath(); ctx.roundRect(this.x, this.y, this.width, this.height, 8); ctx.fill();
        ctx.fillStyle = 'rgba(174, 190, 196, 0.9)';
        ctx.beginPath(); ctx.roundRect(this.x + 75, this.y + 6, 25, this.height - 12, [0, 5, 5, 0]); ctx.fill();
        this.drawWheel(ctx, this.x + 15, this.y - 3);
        this.drawWheel(ctx, this.x + 15, this.y + this.height - 5);
        this.drawWheel(ctx, this.x + 80, this.y - 3);
        this.drawWheel(ctx, this.x + 80, this.y + this.height - 5);
        if (this.hasPhoneInfraction) {
            ctx.fillStyle = '#101010'; ctx.roundRect(this.x + 82, this.y + 15, 8, 14, 2); ctx.fill();
            ctx.fillStyle = this.isFined || this.isApprehended ? COLORS.trafficGreen : '#3498db';
            ctx.fillRect(this.x + 83, this.y + 17, 6, 10);
        }
        if (this.isFined) {
            ctx.strokeStyle = this.wasWronglyFined ? COLORS.trafficRed : COLORS.trafficGreen;
            ctx.lineWidth = 4; ctx.setLineDash([6, 4]); ctx.strokeRect(this.x - 5, this.y - 5, this.width + 10, this.height + 10); ctx.setLineDash([]);
        }

        // Inspeção Blitz (Garantir que apareça para o primeiro da fila)
        if (gameState.isBlitzActive && this.lane === 0 && !this.isInspected && !this.isApprehended) {
             const carAhead = gameState.cars.find(c => c.lane === 0 && c.x > this.x && !c.isInspected && !c.isApprehended);
             if (!carAhead && this.x + this.width > DIFFICULTY.blitzLineX - 250) {
                 this.drawRequestBubble(ctx);
             }
        }
    }

    drawWheel(ctx, x, y) { ctx.fillStyle = '#111'; ctx.beginPath(); ctx.roundRect(x, y, 22, 8, 3); ctx.fill(); }

    drawRequestBubble(ctx) {
        const bx = this.x + this.width / 2;
        const by = this.y - 50;
        ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.roundRect(bx - 55, by - 30, 110, 40, 20); ctx.fill();
        ctx.strokeStyle = '#2980b9'; ctx.lineWidth = 2; ctx.stroke();
        ctx.fillStyle = '#222'; ctx.font = 'bold 12px Arial'; ctx.textAlign = 'center';
        ctx.fillText('VER DOCS', bx, by - 8); ctx.textAlign = 'left';
    }
}

// --- Funções core ---
function init() { canvas.width = 900; canvas.height = 500; drawStaticFrame(); }
function startGame() { gameState.hasStarted = true; startScreen.classList.add('hidden'); resetGame(); }
function showFailScreen() { gameState.isGameOver = true; failScreen.classList.remove('hidden'); }

function openInspection(car) {
    gameState.isPaused = true;
    gameState.currentLicenseCar = car;
    
    // Fill Modal
    cnhName.innerText = car.name;
    cnhAge.innerText = car.age;
    cnhPlate.innerText = car.plate;
    cnhStatus.innerText = car.hasLicense ? 'HABILITADO' : '!!! SEM HABILITAÇÃO !!!';
    cnhStatus.style.color = car.hasLicense ? '#27ae60' : COLORS.trafficRed;
    cnhPoints.innerText = car.hasLicense ? car.licensePoints : '---';
    
    // NOVO: Mostrar se está no celular
    cnhPhone.innerText = car.hasPhoneInfraction ? 'SIM (Manuseando Celular)' : 'NÃO (Nenhuma Distração)';
    cnhPhone.style.color = car.hasPhoneInfraction ? COLORS.trafficRed : COLORS.trafficGreen;
    
    inspectionScreen.classList.remove('hidden');
}

function resolveInspection(isFining) {
    inspectionScreen.classList.add('hidden');
    gameState.isPaused = false;
    const car = gameState.currentLicenseCar;
    car.isInspected = true;
    
    // Regras de Irregularidade
    const hasNoLicense = !car.hasLicense;
    const isMinor = car.age < 18;
    const isPhone = car.hasPhoneInfraction;
    const highPoints = car.licensePoints >= 40;
    
    const isIrregular = hasNoLicense || isMinor || isPhone || highPoints;
    
    if (isFining) {
        if (isIrregular) {
            gameState.score += 150;
            if (isMinor) {
                addFeedback('CARRO APREENDIDO POR ESTAR NA MÃO DE UM MENOR DE IDADE', car.x - 50, car.y - 120, COLORS.trafficRed);
            } else if (hasNoLicense) {
                addFeedback('+150 SEM HABILITAÇÃO!', car.x, car.y - 50, COLORS.trafficGreen);
            } else if (isPhone) {
                addFeedback('+150 USO DE CELULAR!', car.x, car.y - 50, COLORS.trafficGreen);
            } else {
                addFeedback('+150 INFRAÇÕES PENDENTES!', car.x, car.y - 50, COLORS.trafficGreen);
            }
            car.isApprehended = true;
        } else {
            gameState.score -= 50;
            addFeedback('-50 REGULAR!', car.x, car.y, COLORS.trafficRed);
        }
    } else {
        // Liberou
        if (isIrregular) {
            gameState.score -= 100; addFeedback('-100 ESCAPOU!', car.x, car.y, COLORS.trafficRed);
        } else {
            gameState.score += 30; addFeedback('+30 LIBERADO!', car.x, car.y, COLORS.trafficGreen);
        }
    }
    scoreEl.innerText = gameState.score;
    gameState.currentLicenseCar = null;
}

function resetGame() {
    gameState.score = 0; gameState.timeLeft = DIFFICULTY.gameDurationSeconds; gameState.isGameOver = false; gameState.isBlitzActive = false;
    gameState.blitzCooldown = false; gameState.isPaused = false; gameState.cars = []; gameState.trafficLight = 'GREEN'; scoreEl.innerText = '0';
    gameOverScreen.classList.add('hidden'); failScreen.classList.add('hidden'); inspectionScreen.classList.add('hidden');
    timerEl.innerText = '05:00'; blitzBtn.disabled = false; blitzBtn.innerText = 'ACIONAR BLITZ';
    if (!gameState.loopRunning) { gameState.loopRunning = true; requestAnimationFrame(gameLoop); }
    startTimer();
}

function startTimer() {
    if (this.itv) clearInterval(this.itv);
    this.itv = setInterval(() => {
        if (gameState.isGameOver || !gameState.hasStarted || gameState.isPaused) return;
        gameState.timeLeft--;
        const mins = Math.floor(gameState.timeLeft / 60).toString().padStart(2, '0');
        const secs = (gameState.timeLeft % 60).toString().padStart(2, '0');
        timerEl.innerText = `${mins}:${secs}`;
        if (gameState.timeLeft <= 0) { endGame(); clearInterval(this.itv); }
    }, 1000);
}

function endGame() { gameState.isGameOver = true; finalScoreEl.innerText = gameState.score; gameOverScreen.classList.remove('hidden'); }
function addFeedback(text, x, y, color) { gameState.feedbackMessages.push({ text, x, y: y - 20, color, opacity: 1, timer: 180 }); }
function canSpawn(lane) { return !gameState.cars.some(car => car.baseLane === lane && car.x < 150); }

// --- Inputs ---
canvas.addEventListener('mousedown', (e) => {
    if (gameState.isGameOver || !gameState.hasStarted || gameState.isPaused) return;
    const rect = canvas.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;
    
    // Semáforo (Área maior)
    if (mx > DIFFICULTY.stopLineX - 10 && mx < DIFFICULTY.stopLineX + 80 && my > 80 && my < 450) {
        gameState.trafficLight = gameState.trafficLight === 'GREEN' ? 'RED' : 'GREEN'; return;
    }

    for (let car of gameState.cars) {
        if (mx > car.x && mx < car.x + car.width && my > car.y && my < car.y + car.height) {
            // Blitz
            // Blitz: Se clicar em qualquer carro que não foi inspecionado ainda na fila
            if (gameState.isBlitzActive && car.lane === 0 && !car.isInspected && !car.isApprehended) {
                // Abre apenas se for o primeiro da fila (o mais à frente)
                const carAhead = gameState.cars.find(c => c.lane === 0 && c.x > car.x && !c.isInspected && !c.isApprehended);
                if (!carAhead) { 
                    openInspection(car); 
                    return; 
                }
            }
            // Multa Normal
            if (car.isFined || car.isApprehended) return;
            if (car.committedRedLightInfraction || car.hasPhoneInfraction) {
                gameState.score += 100; addFeedback('+100', mx, my, COLORS.trafficGreen); car.isFined = true;
            } else {
                gameState.score -= 50; addFeedback('-50', mx, my, COLORS.trafficRed); car.isFined = true;
            }
            scoreEl.innerText = gameState.score; break;
        }
    }
});

inspectFineBtn.addEventListener('click', () => resolveInspection(true));
inspectReleaseBtn.addEventListener('click', () => resolveInspection(false));

startBtn.addEventListener('click', startGame);
restartBtn.addEventListener('click', resetGame);
failRestartBtn.addEventListener('click', resetGame);

blitzBtn.addEventListener('click', () => {
    if (gameState.isBlitzActive || gameState.blitzCooldown || !gameState.hasStarted) return;
    
    gameState.isBlitzActive = true;
    blitzBtn.disabled = true;
    let bTime = 20; 
    const bItv = setInterval(() => {
        bTime--;
        blitzBtn.innerText = `BLITZ (${bTime}s)`;
        if (bTime <= 0) {
            clearInterval(bItv);
            gameState.isBlitzActive = false;
            gameState.blitzCooldown = true;
            gameState.cars.forEach(c => { if(!c.isInspected) c.isInspected = true; });
            
            let cTime = 20;
            const cItv = setInterval(() => {
                cTime--;
                blitzBtn.innerText = `RECARGA (${cTime}s)`;
                if (cTime <= 0) {
                    clearInterval(cItv);
                    gameState.blitzCooldown = false;
                    blitzBtn.disabled = false;
                    blitzBtn.innerText = "ACIONAR BLITZ";
                }
            }, 1000);
        }
    }, 1000);
});

// --- Loop ---
function drawBackground() {
    ctx.fillStyle = '#34495e'; ctx.fillRect(0, 180, canvas.width, 240);
    ctx.fillStyle = COLORS.road; ctx.fillRect(0, 200, canvas.width, 220); 
    
    // Desenhar 4 faixas
    ctx.setLineDash([40, 30]); ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)'; ctx.lineWidth = 3;
    for(let i = 1; i < DIFFICULTY.laneCount; i++) {
        ctx.beginPath(); ctx.moveTo(0, 200 + (i * 50)); ctx.lineTo(canvas.width, 200 + (i * 50)); ctx.stroke();
    }
    ctx.setLineDash([]);
    
    const zebraX = DIFFICULTY.stopLineX - 80; ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
    for(let i = 0; i < 11; i++) { ctx.fillRect(zebraX, 205 + (i * 20), 60, 10); }
    ctx.fillStyle = COLORS.line; ctx.fillRect(DIFFICULTY.stopLineX - 8, 200, 16, 220);
    
    const lightX = DIFFICULTY.stopLineX + 20; ctx.fillStyle = '#444'; ctx.fillRect(lightX - 6, 150, 12, 300);
    ctx.fillStyle = '#222'; ctx.beginPath(); ctx.roundRect(lightX - 25, 80, 50, 110, 10); ctx.fill();
    drawLight(ctx, lightX, 110, gameState.trafficLight === 'RED' ? COLORS.trafficRed : '#111');
    drawLight(ctx, lightX, 165, gameState.trafficLight === 'GREEN' ? COLORS.trafficGreen : '#111');
    
    if (gameState.isBlitzActive) {
        drawOfficer(ctx, DIFFICULTY.blitzLineX + 10, 180);
        drawOfficer(ctx, DIFFICULTY.blitzLineX + 10, 415);
    }
}

function drawLight(ctx, x, y, color) {
    if (color !== '#111') { ctx.shadowBlur = 20; ctx.shadowColor = color; }
    ctx.fillStyle = color; ctx.beginPath(); ctx.arc(x, y, 18, 0, Math.PI * 2); ctx.fill(); ctx.shadowBlur = 0;
}

function drawOfficer(ctx, x, y) {
    ctx.fillStyle = COLORS.police; ctx.beginPath(); ctx.roundRect(x - 10, y, 20, 30, 5); ctx.fill();
    ctx.fillStyle = '#ffdbac'; ctx.beginPath(); ctx.arc(x, y + 10, 8, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = COLORS.police; ctx.fillRect(x - 12, y - 2, 24, 6);
}

function drawStaticFrame() { ctx.clearRect(0, 0, canvas.width, canvas.height); drawBackground(); }

function gameLoop() {
    if (!gameState.isGameOver && gameState.hasStarted) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        if (!gameState.isPaused) {
            if (Math.random() < DIFFICULTY.carSpawnRate) { 
                let lane = Math.floor(Math.random() * DIFFICULTY.laneCount); 
                if (canSpawn(lane)) { gameState.cars.push(new Car(lane)); } 
            }
            gameState.cars = gameState.cars.filter(car => { return car.y > -150 && !car.update(gameState.trafficLight, gameState.isBlitzActive); });
        }
        drawBackground();
        gameState.cars.sort((a,b) => b.x - a.x).forEach(c => c.draw(ctx));
        
        ctx.textAlign = 'center';
        for (let i = gameState.feedbackMessages.length-1; i>=0; i--) {
            let m = gameState.feedbackMessages[i];
            ctx.fillStyle = m.color; ctx.globalAlpha = m.opacity;
            ctx.font = m.text.length > 30 ? "bold 13px Arial" : "bold 18px Arial";
            ctx.fillText(m.text, m.x, m.y);
            if (!gameState.isPaused) { m.y -= 0.6; m.opacity -= 0.007; m.timer--; }
            if (m.timer <= 0) gameState.feedbackMessages.splice(i,1);
        }
        ctx.globalAlpha = 1;
        requestAnimationFrame(gameLoop);
    } else { gameState.loopRunning = false; }
}

init();
