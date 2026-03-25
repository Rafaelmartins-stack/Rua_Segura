/**
 * Rua Segura - v7.1 (Visual Assets Restored + Collision Fixes)
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
const inspectFineBtn = document.getElementById('inspect-fine-btn');
const inspectReleaseBtn = document.getElementById('inspect-release-btn');

const finalScoreEl = document.getElementById('final-score');
const restartBtn = document.getElementById('restart-btn');
const failRestartBtn = document.getElementById('fail-restart-btn');
const startBtn = document.getElementById('start-btn');
const blitzBtn = document.getElementById('blitz-btn');

// --- Configurações ---
const DIFFICULTY = {
    carSpawnRate: 0.035,
    minCarSpeed: 2.2,
    maxCarSpeed: 4.5,
    phoneInfractionRate: 0.3,
    redLightInfractionRate: 0.3,
    gameDurationSeconds: 300,  // 5 Minutos (300 segundos)
    stopLineX: 650,
    blitzLineX: 520,  // Ajustado para o modelo PM original
    safeDistance: 140,
    minimumGap: 45,   // FIX: Mantido gap maior para evitar overlap
    laneCount: 4,
};

// --- Assets ---
const CAR_IMAGES = {
    red_sedan: new Image(),
    green_sedan: new Image(),
    van: new Image(),
    police: new Image()
};
CAR_IMAGES.red_sedan.src = 'assets/car_red_sedan.png';
CAR_IMAGES.green_sedan.src = 'assets/car_green_sedan.png';
CAR_IMAGES.van.src = 'assets/car_van.png';
CAR_IMAGES.police.src = 'PM.png';

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
    skyline: [] // Cenário restaurado
};

// --- Cores ---
const COLORS = {
    road: '#2c3e50',
    line: '#ecf0f1',
    trafficGreen: '#2ecc71',
    trafficRed: '#e74c3c',
    police: '#2980b9'
};

// --- Classes ---

class Car {
    constructor(lane) {
        this.width = 110;
        this.height = 55; // Altura restaurada para os sprites
        this.lane = lane;
        this.x = -150;
        this.y = 210 + (this.lane * 50);
        this.baseSpeed = DIFFICULTY.minCarSpeed + Math.random() * (DIFFICULTY.maxCarSpeed - DIFFICULTY.minCarSpeed);
        this.speed = this.baseSpeed;
        
        // Atribui sprite aleatório (restaurado)
        const keys = Object.keys(CAR_IMAGES).filter(k => k !== 'police');
        this.sprite = CAR_IMAGES[keys[Math.floor(Math.random() * keys.length)]];

        this.name = NAMES[Math.floor(Math.random() * NAMES.length)] + " " + SURNAMES[Math.floor(Math.random() * SURNAMES.length)];
        this.age = Math.floor(Math.random() * 60) + 12;
        this.plate = "RSG" + Math.floor(Math.random()*9000 + 1000);
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

    update(trafficLight, isBlitzActive) {
        if (gameState.isPaused) return false;

        if (isBlitzActive && !this.isInspected) {
            this.lane = 0;
        }

        const targetY = 200 + (this.lane * 50) + 5;
        if (Math.abs(this.y - targetY) > 0.5) { this.y += (targetY - this.y) * 0.1; }

        if (this.isApprehended) { this.y -= 4.5; this.x += 1; return false; }

        const frontX = this.x + this.width;
        // FIX: Mantida lógica de detecção precisa com ordenação
        const carAhead = gameState.cars
            .filter(c => {
                if (c === this || c.x <= this.x) return false;
                // Durante a Blitz, considera todos os carros à frente na fila (faixa 0)
                if (isBlitzActive && !this.isInspected && !c.isInspected) return true;
                // Trânsito normal: apenas carros na mesma faixa (distância Y < 45)
                return Math.abs(c.y - this.y) < 45;
            })
            .sort((a, b) => a.x - b.x)[0];

        let targetSpeed = this.baseSpeed;

        if (!this.willIgnoreRedLight && !isBlitzActive) {
            if (trafficLight === 'RED' && frontX < DIFFICULTY.stopLineX - 10 && frontX > DIFFICULTY.stopLineX - 300) targetSpeed = 0;
        }

        if (isBlitzActive && !this.isInspected && this.lane === 0) {
            // Avança até a linha da blitz (perto do policial)
            if (frontX >= DIFFICULTY.blitzLineX - 5) {
                targetSpeed = 0;
                if (frontX >= DIFFICULTY.blitzLineX) this.speed = 0;
            }
        }

        if (carAhead) {
            const currentGap = carAhead.x - frontX;
            if (currentGap < DIFFICULTY.safeDistance) {
                const ratio = Math.max(0, (currentGap - DIFFICULTY.minimumGap) / (DIFFICULTY.safeDistance - DIFFICULTY.minimumGap));
                targetSpeed = Math.min(targetSpeed, carAhead.speed * ratio);
            }
        }

        if (this.speed > targetSpeed) { this.speed = Math.max(targetSpeed, this.speed - 0.7); }
        else if (this.speed < targetSpeed) { this.speed = Math.min(targetSpeed, this.speed + 0.3); }

        let nextX = this.x + this.speed;
        if (carAhead) {
            if (nextX + this.width > carAhead.x - DIFFICULTY.minimumGap) {
                nextX = carAhead.x - this.width - DIFFICULTY.minimumGap;
                this.speed = 0;
            }
        }
        this.x = nextX;

        if (!isBlitzActive && trafficLight === 'RED' && frontX > DIFFICULTY.stopLineX && this.x < DIFFICULTY.stopLineX + 40 && this.speed > 0.6) {
            if (!this.hasBeenPenalized) {
                gameState.score -= 25; this.hasBeenPenalized = true;
                addFeedback('-25 AVANÇO!', this.x + 50, this.y, '#ff9f43'); scoreEl.innerText = gameState.score;
            }
        }

        if (this.x > canvas.width && this.hasPhoneInfraction && !this.isFined) { showFailScreen(); return true; }
        return false;
    }

    draw(ctx) {
        // Sombra suave (restaurada)
        ctx.fillStyle = "rgba(0,0,0,0.3)";
        ctx.fillRect(this.x + 5, this.y + 10, this.width - 10, this.height - 10);
        
        ctx.imageSmoothingEnabled = false; 
        
        // Desenho com Sprites e Inversão (restaurado)
        if (this.sprite === CAR_IMAGES.red_sedan) {
            ctx.save();
            ctx.translate(this.x + this.width, this.y);
            ctx.scale(-1, 1);
            ctx.drawImage(this.sprite, 0, 0, this.width, this.height);
            ctx.restore();
        } else {
            ctx.drawImage(this.sprite, this.x, this.y, this.width, this.height);
        }

        // Ícone Celular (restaurado)
        if (this.hasPhoneInfraction) {
            ctx.fillStyle = '#222'; ctx.fillRect(this.x + this.width - 30, this.y + 10, 8, 14);
            ctx.fillStyle = this.isFined || this.isApprehended ? COLORS.trafficGreen : '#3498db';
            ctx.fillRect(this.x + this.width - 29, this.y + 11, 6, 6);
        }

        if (this.isFined) {
            ctx.strokeStyle = COLORS.trafficGreen;
            ctx.lineWidth = 3; ctx.strokeRect(this.x - 2, this.y - 2, this.width + 4, this.height + 4);
        }

        // Balão de Blitz (restaurado)
        if (gameState.isBlitzActive && this.lane === 0 && !this.isInspected && !this.isApprehended) {
            const carAhead = gameState.cars.find(c => c.lane === 0 && c.x > this.x && !c.isInspected && !c.isApprehended);
            if (!carAhead && (this.x + this.width) > DIFFICULTY.blitzLineX - 350) {
                ctx.fillStyle = "#fff";
                ctx.fillRect(this.x + 30, this.y - 45, 80, 25);
                ctx.fillStyle = "#222";
                ctx.font = "bold 10px Arial";
                ctx.fillText("CLIQUE AQUI", this.x + 35, this.y - 28);
            }
        }
    }
}

// --- Funções core ---
function init() { 
    canvas.width = 900; 
    canvas.height = 500; 
    generateSkyline(); // Restaurado
    drawBackground(); 
}

function generateSkyline() {
    gameState.skyline = [];
    let x = -50;
    while (x < 950) {
        const isBuilding = Math.random() > 0.4;
        const w = isBuilding ? (40 + Math.random() * 60) : (50 + Math.random() * 40);
        const h = isBuilding ? (80 + Math.random() * 120) : (40 + Math.random() * 30);
        
        gameState.skyline.push({
            x: x, w: w, h: h,
            type: isBuilding ? 'building' : 'house',
            color: isBuilding ? `hsl(210, 20%, ${15 + Math.random() * 10}%)` : `hsl(20, 20%, ${20 + Math.random() * 10}%)`,
            windows: generateWindows(isBuilding, w, h)
        });
        x += w + (5 + Math.random() * 15);
    }
}

function generateWindows(isBuilding, w, h) {
    const windows = [];
    if (isBuilding) {
        const rows = Math.floor(h / 20);
        const cols = Math.floor(w / 15);
        for (let r = 0; r < rows; r++) {
            for (let c = 0; c < cols; c++) {
                if (Math.random() > 0.4) windows.push({ x: 5 + c * 15, y: 10 + r * 20, on: Math.random() > 0.3 });
            }
        }
    } else {
        windows.push({ x: w * 0.2, y: h * 0.4, w: 10, h: 10, type: 'window' });
        windows.push({ x: w * 0.6, y: h * 0.5, w: 12, h: h * 0.5, type: 'door' });
    }
    return windows;
}

function startGame() { gameState.hasStarted = true; startScreen.style.display = 'none'; resetGame(); }
function showFailScreen() { gameState.isGameOver = true; failScreen.classList.remove('hidden'); }

function openInspection(car) {
    gameState.isPaused = true; gameState.currentLicenseCar = car;
    cnhName.innerText = car.name; cnhAge.innerText = car.age; cnhPlate.innerText = car.plate;
    cnhStatus.innerText = car.hasLicense ? 'HABILITADO' : '!!! SEM HABILITAÇÃO !!!';
    cnhStatus.style.color = car.hasLicense ? '#27ae60' : COLORS.trafficRed;
    cnhPoints.innerText = car.hasLicense ? car.licensePoints : '---';
    inspectionScreen.classList.remove('hidden');
}

function resolveInspection(isFining) {
    inspectionScreen.classList.add('hidden'); gameState.isPaused = false;
    const car = gameState.currentLicenseCar; car.isInspected = true;
    const isIrregular = !car.hasLicense || car.age < 18 || car.hasPhoneInfraction || car.licensePoints >= 40;

    if (isFining) {
        if (isIrregular) {
            gameState.score += 150;
            addFeedback('+150 APREENDIDO!', car.x, car.y - 50, COLORS.trafficGreen);
            car.isApprehended = true;
        } else {
            gameState.score -= 50; addFeedback('-50 REGULAR!', car.x, car.y, COLORS.trafficRed);
        }
    } else {
        if (isIrregular) { gameState.score -= 100; addFeedback('-100 ESCAPOU!', car.x, car.y, COLORS.trafficRed); }
        else { gameState.score += 30; addFeedback('+30 LIBERADO!', car.x, car.y, COLORS.trafficGreen); }
    }
    scoreEl.innerText = gameState.score; gameState.currentLicenseCar = null;
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
    if (window.gameTimer) clearInterval(window.gameTimer);
    window.gameTimer = setInterval(() => {
        if (gameState.isGameOver || !gameState.hasStarted || gameState.isPaused) return;
        gameState.timeLeft--;
        const mins = Math.floor(gameState.timeLeft / 60).toString().padStart(2, '0');
        const secs = (gameState.timeLeft % 60).toString().padStart(2, '0');
        timerEl.innerText = `${mins}:${secs}`;
        if (gameState.timeLeft <= 0) { endGame(); clearInterval(window.gameTimer); }
    }, 1000);
}

function endGame() { gameState.isGameOver = true; finalScoreEl.innerText = gameState.score; gameOverScreen.classList.remove('hidden'); }
function addFeedback(text, x, y, color) { gameState.feedbackMessages.push({ t: text, x, y: y - 20, c: color, a: 1, timer: 180 }); }
function canSpawn(lane) { return !gameState.cars.some(car => car.lane === lane && car.x < 150); }

// --- Inputs ---
canvas.addEventListener('mousedown', (e) => {
    if (gameState.isGameOver || !gameState.hasStarted || gameState.isPaused) return;
    const rect = canvas.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;
    
    // Semáforo (restaurado coordenadas e lógica)
    if (mx > 600 && mx < 720 && my > 80 && my < 450) {
        gameState.trafficLight = gameState.trafficLight === 'GREEN' ? 'RED' : 'GREEN'; return;
    }

    // Clique na Blitz (restaurado)
    if (gameState.isBlitzActive && my > 180 && my < 260) {
        const validCars = gameState.cars.filter(c => c.lane === 0 && !c.isInspected && !c.isApprehended && (c.x + c.width) > (DIFFICULTY.blitzLineX - 450));
        if (validCars.length > 0) {
            validCars.sort((a,b) => b.x - a.x);
            const headCar = validCars[0];
            if (mx > headCar.x - 50 && mx < headCar.x + headCar.width + 50) { openInspection(headCar); return; }
        }
    }

    for (let car of gameState.cars) {
        if (mx > car.x - 10 && mx < car.x + car.width + 10 && my > car.y - 10 && my < car.y + car.height + 10) {
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
    gameState.isBlitzActive = true; gameState.trafficLight = 'RED'; blitzBtn.disabled = true;
    let bTime = 20;
    const bItv = setInterval(() => {
        bTime--; blitzBtn.innerText = `BLITZ (${bTime}s)`;
        if (bTime <= 0) {
            clearInterval(bItv); gameState.isBlitzActive = false; gameState.trafficLight = 'GREEN'; gameState.blitzCooldown = true;
            gameState.cars.forEach(c => { if (c.lane === 0 && !c.isInspected) c.isInspected = true; });
            let cTime = 20;
            const cItv = setInterval(() => {
                cTime--; blitzBtn.innerText = `RECARGA (${cTime}s)`;
                if (cTime <= 0) { clearInterval(cItv); gameState.blitzCooldown = false; blitzBtn.disabled = false; blitzBtn.innerText = "ACIONAR BLITZ"; }
            }, 1000);
        }
    }, 1000);
});

// --- Desenho do Cenário (Restaurado v6) ---
function drawBackground() {
    // Céu/Fundo Superior
    const skyGradient = ctx.createLinearGradient(0, 0, 0, 200);
    skyGradient.addColorStop(0, "#0a0a12"); skyGradient.addColorStop(1, "#1a1a2e");
    ctx.fillStyle = skyGradient; ctx.fillRect(0, 0, 900, 200);

    // Desenha Skyline (Prédios e Casas)
    gameState.skyline.forEach(el => {
        const groundY = 200;
        const y = groundY - el.h;
        ctx.fillStyle = "rgba(0,0,0,0.3)"; ctx.fillRect(el.x + 4, y + 4, el.w, el.h);
        ctx.fillStyle = el.color; ctx.fillRect(el.x, y, el.w, el.h);
        el.windows.forEach(w => {
            if (el.type === 'building') {
                ctx.fillStyle = w.on ? "#f1c40f" : "#2c3e50"; ctx.fillRect(el.x + w.x, y + w.y, 8, 12);
            } else if (w.type === 'window') {
                ctx.fillStyle = "#f1c40f"; ctx.fillRect(el.x + w.x, y + w.y, w.w, w.h);
            } else {
                ctx.fillStyle = "#1a110a"; ctx.fillRect(el.x + w.x, y + w.y, w.w, w.h);
            }
        });
        if (el.type === 'house') {
            ctx.fillStyle = "#4a2311"; ctx.beginPath(); ctx.moveTo(el.x - 5, y); ctx.lineTo(el.x + el.w / 2, y - 20); ctx.lineTo(el.x + el.w + 5, y); ctx.closePath(); ctx.fill();
        }
    });

    ctx.fillStyle = "#161616"; ctx.fillRect(0, 190, 900, 10);
    ctx.fillStyle = "#34495e"; ctx.fillRect(0, 180, 900, 240);
    ctx.fillStyle = COLORS.road; ctx.fillRect(0, 200, 900, 210);

    ctx.strokeStyle = "rgba(255, 255, 255, 0.2)"; ctx.setLineDash([30, 20]); ctx.lineWidth = 2;
    for(let i = 1; i < 4; i++) { ctx.beginPath(); ctx.moveTo(0, 200 + i * 50); ctx.lineTo(900, 200 + i * 50); ctx.stroke(); }
    ctx.setLineDash([]); 

    ctx.fillStyle = "rgba(0,0,0,0.1)";
    for(let i=0; i<900; i+=25) { ctx.fillRect(i, 180, 2, 20); ctx.fillRect(i, 410, 2, 50); }

    // Manchas e Rachaduras
    ctx.fillStyle = "rgba(0,0,0,0.15)";
    ctx.beginPath(); ctx.ellipse(200, 280, 20, 8, 0, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(750, 360, 15, 6, 0.4, 0, Math.PI * 2); ctx.fill();

    // Linha de Parada Brilhante
    ctx.fillStyle = "#fff"; ctx.shadowColor = "#fff"; ctx.shadowBlur = 5;
    ctx.fillRect(DIFFICULTY.stopLineX - 5, 200, 10, 210); ctx.shadowBlur = 0;
    
    // Semáforo
    ctx.fillStyle = "#222"; ctx.fillRect(665, 80, 40, 90);
    ctx.fillStyle = gameState.trafficLight === 'RED' ? COLORS.trafficRed : "#111";
    ctx.beginPath(); ctx.arc(685, 105, 15, 0, 7); ctx.fill();
    ctx.fillStyle = gameState.trafficLight === 'GREEN' ? COLORS.trafficGreen : "#111";
    ctx.beginPath(); ctx.arc(685, 145, 15, 0, 7); ctx.fill();

    // Policiais (Sprite restaurado)
    if (gameState.isBlitzActive) {
        if (CAR_IMAGES.police.complete) {
            ctx.fillStyle = "rgba(0,0,0,0.4)";
            ctx.beginPath(); ctx.ellipse(530, 203, 12, 5, 0, 0, Math.PI * 2); ctx.fill();
            ctx.beginPath(); ctx.ellipse(530, 463, 12, 5, 0, 0, Math.PI * 2); ctx.fill();
            ctx.drawImage(CAR_IMAGES.police, 515, 145, 30, 60); 
            ctx.drawImage(CAR_IMAGES.police, 515, 405, 30, 60); 
        } else {
            ctx.fillStyle = COLORS.police; ctx.fillRect(525, 175, 20, 30);
            ctx.fillStyle = COLORS.police; ctx.fillRect(525, 410, 20, 30);
        }
    }
}

function gameLoop() {
    if (!gameState.isGameOver && gameState.hasStarted) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        if (!gameState.isPaused) {
            if (Math.random() < DIFFICULTY.carSpawnRate) {
                let lane = Math.floor(Math.random() * DIFFICULTY.laneCount);
                if (canSpawn(lane)) { gameState.cars.push(new Car(lane)); }
            }
            // FIX: Mantida ordenação para evitar overlap
            gameState.cars.sort((a, b) => b.x - a.x);
            gameState.cars = gameState.cars.filter(car => { return car.x < canvas.width + 150 && !car.update(gameState.trafficLight, gameState.isBlitzActive); });
        }
        drawBackground();
        gameState.cars.sort((a, b) => b.x - a.x).forEach(c => c.draw(ctx));
        
        ctx.textAlign = 'center';
        for (let i = gameState.feedbackMessages.length - 1; i >= 0; i--) {
            let m = gameState.feedbackMessages[i]; ctx.fillStyle = m.c; ctx.globalAlpha = m.a;
            ctx.font = "bold 16px Arial"; ctx.fillText(m.t, m.x, m.y);
            if (!gameState.isPaused) { m.y -= 0.6; m.a -= 0.01; m.timer--; }
            if (m.timer <= 0) gameState.feedbackMessages.splice(i, 1);
        }
        ctx.globalAlpha = 1; requestAnimationFrame(gameLoop);
    } else { gameState.loopRunning = false; }
}

init();
