/**
 * Rua Segura - v6.0 (ULTIMATE STABILITY FIX)
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
const cnhPhone = document.getElementById('cnh-phone'); 
const inspectFineBtn = document.getElementById('inspect-fine-btn');
const inspectReleaseBtn = document.getElementById('inspect-release-btn');

const finalScoreEl = document.getElementById('final-score');
const restartBtn = document.getElementById('restart-btn');
const failRestartBtn = document.getElementById('fail-restart-btn');
const startBtn = document.getElementById('start-btn');
const blitzBtn = document.getElementById('blitz-btn');

// --- Configurações ---
const DIFFICULTY = {
    carSpawnRate: 0.04,        // AUMENTADO AGRESSIVAMENTE
    minCarSpeed: 2.2,           
    maxCarSpeed: 4.5,           
    phoneInfractionRate: 0.3, 
    redLightInfractionRate: 0.3, 
    gameDurationSeconds: 300,  
    stopLineX: 650,           
    blitzLineX: 520,          
    safeDistance: 130,        
    minimumGap: 30,           
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
    frameToken: 0 // Para validar se o loop está rodando
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
        { main: '#1abc9c', dark: '#16a085' }
    ],
};

// --- Classe Carro (REESCRITA PARA MÁXIMA SIMPLICIDADE) ---
class Car {
    constructor(lane) {
        this.width = 100;
        this.height = 40; 
        this.lane = lane;
        this.baseLane = lane;
        this.x = -150; 
        this.y = 200 + (lane * 50) + 5;
        this.baseSpeed = DIFFICULTY.minCarSpeed + Math.random() * (DIFFICULTY.maxCarSpeed - DIFFICULTY.minCarSpeed);
        this.speed = this.baseSpeed;
        const colorSet = COLORS.carColors[Math.floor(Math.random() * COLORS.carColors.length)];
        this.color = colorSet.main;
        
        // Dados
        this.name = NAMES[Math.floor(Math.random()*NAMES.length)] + " " + SURNAMES[Math.floor(Math.random()*SURNAMES.length)];
        this.age = Math.floor(Math.random() * 50) + 14;
        this.plate = "RSG" + Math.floor(Math.random()*9000 + 1000);
        this.hasLicense = Math.random() > 0.2;
        this.licensePoints = Math.floor(Math.random()*60);
        this.hasPhoneInfraction = Math.random() < 0.3;
        this.isInspected = false;
        this.isApprehended = false;
        this.isFined = false;
    }

    update(trafficLight, isBlitzActive) {
        if (gameState.isPaused) return false;

        // Se for Blitz e não revistado, vai para a faixa 0
        if (isBlitzActive && !this.isInspected) {
            this.lane = 0;
        }

        const targetY = 200 + (this.lane * 50) + 5;
        this.y += (targetY - this.y) * 0.1;

        if (this.isApprehended) {
            this.y -= 5; this.x += 1;
            return false;
        }

        let targetSpeed = this.baseSpeed;
        
        // Semáforo
        if (trafficLight === 'RED' && !isBlitzActive && (this.x + this.width) < DIFFICULTY.stopLineX - 5 && (this.x + this.width) > DIFFICULTY.stopLineX - 250) {
            targetSpeed = 0;
        }

        // Parada na Blitz
        if (isBlitzActive && this.lane === 0 && !this.isInspected) {
            if ((this.x + this.width) < DIFFICULTY.blitzLineX && (this.x + this.width) > DIFFICULTY.blitzLineX - 350) {
                targetSpeed = 0;
            }
        }

        // Colisão com o da frente
        const carAhead = gameState.cars.find(c => c !== this && c.lane === this.lane && c.x > this.x);
        if (carAhead) {
            const gap = carAhead.x - (this.x + this.width);
            if (gap < 40) targetSpeed = 0;
            else if (gap < 120) targetSpeed = Math.min(targetSpeed, carAhead.speed);
        }

        if (this.speed > targetSpeed) this.speed = Math.max(targetSpeed, this.speed - 0.2);
        else if (this.speed < targetSpeed) this.speed = Math.min(targetSpeed, this.speed + 0.1);

        this.x += this.speed;

        // Avanço de sinal
        if (!isBlitzActive && trafficLight === 'RED' && (this.x + this.width) > DIFFICULTY.stopLineX && (this.x + this.width) < DIFFICULTY.stopLineX + 20 && this.speed > 1) {
             if (!this.infractionHandled) {
                 gameState.score -= 25; this.infractionHandled = true;
                 addFeedback("-25 SINAL!", this.x, this.y, COLORS.trafficRed);
                 scoreEl.innerText = gameState.score;
             }
        }

        return this.x > canvas.width + 100;
    }

    draw(ctx) {
        // Sombra
        ctx.fillStyle = "rgba(0,0,0,0.3)";
        ctx.fillRect(this.x + 4, this.y + 4, this.width, this.height);
        
        ctx.fillStyle = this.color;
        ctx.fillRect(this.x, this.y, this.width, this.height);
        
        // Janela
        ctx.fillStyle = "rgba(255,255,255,0.4)";
        ctx.fillRect(this.x + 70, this.y + 5, 20, this.height - 10);
        
        // Celular
        if (this.hasPhoneInfraction) {
            ctx.fillStyle = "#222";
            ctx.fillRect(this.x + 80, this.y + 20, 6, 10);
            ctx.fillStyle = "#3498db";
            ctx.fillRect(this.x + 81, this.y + 21, 4, 3);
        }

        // Inspeção Blitz (Garantir que apareça para o primeiro da fila)
        if (gameState.isBlitzActive && this.lane === 0 && !this.isInspected && !this.isApprehended) {
             const carAhead = gameState.cars.find(c => c.lane === 0 && c.x > this.x && !c.isInspected && !c.isApprehended);
             // Se não tiver ninguém na frente, sou o primeiro. Desenha o balão se estiver perto o suficiente.
             if (!carAhead && (this.x + this.width) > DIFFICULTY.blitzLineX - 350) {
                 ctx.fillStyle = "#fff";
                 ctx.fillRect(this.x + 30, this.y - 45, 80, 25);
                 ctx.fillStyle = "#222";
                 ctx.font = "bold 10px Arial";
                 ctx.fillText("CLIQUE AQUI", this.x + 35, this.y - 28);
             }
        }
        
        if (this.isFined) {
            ctx.strokeStyle = "#2ecc71"; ctx.lineWidth = 3;
            ctx.strokeRect(this.x-2, this.y-2, this.width+4, this.height+4);
        }
    }
}

// --- Funções core ---

function init() {
    canvas.width = 900;
    canvas.height = 500;
    drawBackground();
}

function startGame() {
    gameState.hasStarted = true;
    startScreen.style.display = 'none';
    resetGame();
}

function resetGame() {
    gameState.score = 0;
    gameState.timeLeft = DIFFICULTY.gameDurationSeconds;
    gameState.cars = [];
    gameState.isGameOver = false;
    gameState.isPaused = false;
    gameState.isBlitzActive = false;
    gameState.blitzCooldown = false;
    scoreEl.innerText = "0";
    timerEl.innerText = "05:00";
    gameOverScreen.classList.add('hidden');
    failScreen.classList.add('hidden');
    inspectionScreen.classList.add('hidden');
    blitzBtn.disabled = false;
    blitzBtn.innerText = "ACIONAR BLITZ";
    
    requestAnimationFrame(gameLoop);
}

function startTimer() {
    if (window.gameTimer) clearInterval(window.gameTimer);
    window.gameTimer = setInterval(() => {
        if (gameState.isGameOver || !gameState.hasStarted || gameState.isPaused) return;
        gameState.timeLeft--;
        const m = Math.floor(gameState.timeLeft / 60).toString().padStart(2, '0');
        const s = (gameState.timeLeft % 60).toString().padStart(2, '0');
        timerEl.innerText = `${m}:${s}`;
        if (gameState.timeLeft <= 0) {
             gameState.isGameOver = true;
             finalScoreEl.innerText = gameState.score;
             gameOverScreen.classList.remove('hidden');
        }
    }, 1000);
}

function showFailScreen() {
    gameState.isGameOver = true;
    failScreen.classList.remove('hidden');
}

function addFeedback(t, x, y, c) {
    gameState.feedbackMessages.push({t, x, y, c, a: 1, timer: 120});
}

function canSpawn(l) {
    return !gameState.cars.some(c => c.baseLane === l && c.x < 150);
}

// --- Inspeção ---
function openInspection(car) {
    gameState.isPaused = true;
    gameState.currentLicenseCar = car;
    cnhName.innerText = car.name;
    cnhAge.innerText = car.age;
    cnhPlate.innerText = car.plate;
    cnhStatus.innerText = car.hasLicense ? "HABILITADO" : "SEM HABILITAÇÃO";
    cnhStatus.style.color = car.hasLicense ? "#27ae60" : COLORS.trafficRed;
    cnhPoints.innerText = car.hasLicense ? car.licensePoints : "---";
    cnhPhone.innerText = car.hasPhoneInfraction ? "SIM" : "NÃO";
    cnhPhone.style.color = car.hasPhoneInfraction ? COLORS.trafficRed : "#222";
    inspectionScreen.classList.remove('hidden');
}

function resolve(isFining) {
    inspectionScreen.classList.add('hidden');
    gameState.isPaused = false;
    const car = gameState.currentLicenseCar;
    if (!car) return;
    car.isInspected = true;
    
    const bad = !car.hasLicense || car.age < 18 || car.hasPhoneInfraction || car.licensePoints >= 40;
    
    if (isFining) {
        if (bad) {
            gameState.score += 150;
            addFeedback("+150 APREENDIDO!", car.x, car.y, COLORS.trafficGreen);
            car.isApprehended = true;
        } else {
            gameState.score -= 50;
            addFeedback("-50 REGULAR!", car.x, car.y, COLORS.trafficRed);
        }
    } else {
        if (bad) { gameState.score -= 100; addFeedback("-100 INFRAÇÃO!", car.x, car.y, COLORS.trafficRed); }
        else { gameState.score += 30; addFeedback("+30 LIBERADO", car.x, car.y, COLORS.trafficGreen); }
    }
    scoreEl.innerText = gameState.score;
    gameState.currentLicenseCar = null;
}

// --- Inputs ---
canvas.addEventListener('mousedown', (e) => {
    if (!gameState.hasStarted || gameState.isGameOver || gameState.isPaused) return;
    const r = canvas.getBoundingClientRect();
    const mx = e.clientX - r.left;
    const my = e.clientY - r.top;

    // Sinal
    if (mx > 600 && mx < 720 && my > 80 && my < 450) {
        gameState.trafficLight = gameState.trafficLight === 'GREEN' ? 'RED' : 'GREEN';
        return;
    }

    // Carros
    // Força o clique no primeiro carro da fila da Blitz se clicar em qualquer lugar da faixa 0 durante a Blitz
    if (gameState.isBlitzActive && my > 200 && my < 250) {
        const headCar = gameState.cars
            .filter(c => c.lane === 0 && !c.isInspected && !c.isApprehended && (c.x + c.width) > (DIFFICULTY.blitzLineX - 400))
            .sort((a,b) => b.x - a.x)[0];
        if (headCar) { openInspection(headCar); return; }
    }

    for (const car of gameState.cars) {
        if (mx > car.x && mx < car.x + car.width && my > car.y && my < car.y + car.height) {
            if (!car.isFined && !car.isApprehended) {
                if (car.hasPhoneInfraction) { gameState.score += 100; addFeedback("+100 CELULAR", mx, my, COLORS.trafficGreen); }
                else { gameState.score -= 50; addFeedback("-50 LIMPO", mx, my, COLORS.trafficRed); }
                car.isFined = true;
                scoreEl.innerText = gameState.score;
            }
            break;
        }
    }
});

blitzBtn.addEventListener('click', () => {
    if (gameState.isBlitzActive || gameState.blitzCooldown) return;
    gameState.isBlitzActive = true;
    blitzBtn.disabled = true;
    let bt = 20;
    const bi = setInterval(() => {
        bt--; blitzBtn.innerText = `BLITZ (${bt}s)`;
        if (bt <= 0) {
            clearInterval(bi);
            gameState.isBlitzActive = false;
            gameState.blitzCooldown = true;
            gameState.cars.forEach(c => { if(c.lane===0 && !c.isInspected) c.isInspected=true; });
            let ct = 20;
            const ci = setInterval(() => {
                ct--; blitzBtn.innerText = `RECARGA (${ct}s)`;
                if (ct <= 0) { clearInterval(ci); gameState.blitzCooldown = false; blitzBtn.disabled = false; blitzBtn.innerText = "ACIONAR BLITZ"; }
            }, 1000);
        }
    }, 1000);
});

inspectFineBtn.onclick = () => resolve(true);
inspectReleaseBtn.onclick = () => resolve(false);
startBtn.onclick = startGame;
restartBtn.onclick = resetGame;
failRestartBtn.onclick = resetGame;

// --- Loop ---
function drawBackground() {
    ctx.fillStyle = "#34495e"; ctx.fillRect(0, 180, 900, 240);
    ctx.fillStyle = COLORS.road; ctx.fillRect(0, 200, 900, 210);
    ctx.fillStyle = "rgba(255,255,255,0.3)";
    for(let i=1; i<4; i++) { ctx.fillRect(0, 200 + i*50, 900, 2); }
    ctx.fillStyle = "#fff"; ctx.fillRect(DIFFICULTY.stopLineX - 5, 200, 10, 210);
    
    // Sinal
    ctx.fillStyle = "#222"; ctx.fillRect(665, 80, 40, 90);
    ctx.fillStyle = gameState.trafficLight === 'RED' ? COLORS.trafficRed : "#111";
    ctx.beginPath(); ctx.arc(685, 105, 15, 0, 7); ctx.fill();
    ctx.fillStyle = gameState.trafficLight === 'GREEN' ? COLORS.trafficGreen : "#111";
    ctx.beginPath(); ctx.arc(685, 145, 15, 0, 7); ctx.fill();

    // Policiais
    if (gameState.isBlitzActive) {
        ctx.fillStyle = COLORS.police; ctx.fillRect(525, 175, 20, 30);
        ctx.fillStyle = COLORS.police; ctx.fillRect(525, 410, 20, 30);
    }
}

function gameLoop() {
    if (gameState.isGameOver || !gameState.hasStarted) return;
    try {
        ctx.clearRect(0,0,900,500);
        if (!gameState.isPaused) {
            if (Math.random() < DIFFICULTY.carSpawnRate) {
                let l = Math.floor(Math.random()*4);
                if (canSpawn(l)) gameState.cars.push(new Car(l));
            }
            gameState.cars = gameState.cars.filter(c => !c.update(gameState.trafficLight, gameState.isBlitzActive));
        }
        drawBackground();
        gameState.cars.forEach(c => c.draw(ctx));
        
        // Feedbacks
        for(let i=gameState.feedbackMessages.length-1; i>=0; i--) {
            const m = gameState.feedbackMessages[i];
            ctx.fillStyle = m.c; ctx.globalAlpha = m.a;
            ctx.font = "bold 16px Arial"; ctx.fillText(m.t, m.x, m.y);
            m.y -= 0.5; m.a -= 0.01; if (m.a <= 0) gameState.feedbackMessages.splice(i,1);
        }
        ctx.globalAlpha = 1;
        requestAnimationFrame(gameLoop);
    } catch(e) { console.error(e); requestAnimationFrame(gameLoop); }
}

init();
startTimer();
