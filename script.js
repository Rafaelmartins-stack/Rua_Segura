/**
 * Rua Segura - Lógica do Jogo
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
const finalScoreEl = document.getElementById('final-score');
const restartBtn = document.getElementById('restart-btn');
const failRestartBtn = document.getElementById('fail-restart-btn');
const startBtn = document.getElementById('start-btn');
const blitzBtn = document.getElementById('blitz-btn');

// --- Configurações de Dificuldade ---
const DIFFICULTY = {
    carSpawnRate: 0.012,       
    minCarSpeed: 2.2,           
    maxCarSpeed: 4.5,           
    phoneInfractionRate: 0.3, 
    redLightInfractionRate: 0.3, 
    gameDurationSeconds: 120, 
    stopLineX: 620,           
    blitzLineX: 300,          // Onde a blitz acontece
    safeDistance: 160,        
    minimumGap: 40,           
};

// --- Estado do Jogo ---
let gameState = {
    score: 0,
    timeLeft: DIFFICULTY.gameDurationSeconds,
    isGameOver: false,
    hasStarted: false,
    trafficLight: 'GREEN', 
    isBlitzActive: false,
    currentLicenseCar: null, // Carro sendo avaliado na Blitz
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
        this.height = 55;
        this.x = -this.width - 60; 
        this.lane = lane;
        this.y = 250 + (this.lane === 0 ? -55 : 55); 
        this.baseSpeed = DIFFICULTY.minCarSpeed + Math.random() * (DIFFICULTY.maxCarSpeed - DIFFICULTY.minCarSpeed);
        this.speed = this.baseSpeed;
        
        const colorSet = COLORS.carColors[Math.floor(Math.random() * COLORS.carColors.length)];
        this.color = colorSet.main;
        this.darkColor = colorSet.dark;
        
        // Infrações Normais
        this.hasPhoneInfraction = Math.random() < DIFFICULTY.phoneInfractionRate;
        this.willIgnoreRedLight = Math.random() < DIFFICULTY.redLightInfractionRate;
        
        // Dados da Carteira (CNH) para a Blitz
        this.license = {
            points: Math.floor(Math.random() * 50), // 0 a 49 pontos
            hasFines: Math.random() < 0.3,         // 30% chance de ter multas pendentes
            isIrregular: false
        };
        // CNH irregular se pontos > 40 ou tem multas
        this.license.isIrregular = this.license.points >= 40 || this.license.hasFines;

        this.committedRedLightInfraction = false;
        this.hasBeenPenalized = false; 
        this.isFined = false;
        this.wasWronglyFined = false;
        this.isInspected = false; // Se já passou pela blitz
    }

    update(trafficLight, stopLineX, carsInLane, isBlitzActive) {
        const carAhead = carsInLane
            .filter(c => c !== this && c.x > this.x)
            .sort((a, b) => a.x - b.x)[0];

        let targetSpeed = this.baseSpeed;
        const frontX = this.x + this.width;

        // 1. Semáforo
        if (!this.willIgnoreRedLight && !isBlitzActive) {
            if (trafficLight === 'RED' && frontX < stopLineX - 10 && frontX > stopLineX - 300) {
                targetSpeed = 0;
            }
        }

        // 2. Lógica da Blitz (Para antes do ponto da blitz)
        if (isBlitzActive && !this.isInspected) {
            if (frontX < DIFFICULTY.blitzLineX && frontX > DIFFICULTY.blitzLineX - 250) {
                targetSpeed = 0;
                if (frontX > DIFFICULTY.blitzLineX - 10) this.speed = 0;
            }
        }

        // 3. Colisão / Distância
        if (carAhead) {
            const currentGap = carAhead.x - frontX;
            if (currentGap < DIFFICULTY.safeDistance) {
                const ratio = Math.max(0, (currentGap - DIFFICULTY.minimumGap) / (DIFFICULTY.safeDistance - DIFFICULTY.minimumGap));
                targetSpeed = Math.min(targetSpeed, carAhead.speed * ratio);
            }
        }

        // Movimentação
        if (this.speed > targetSpeed) { this.speed = Math.max(targetSpeed, this.speed - 0.3); }
        else if (this.speed < targetSpeed) { this.speed = Math.min(targetSpeed, this.speed + 0.15); }
        
        let nextX = this.x + this.speed;
        if (carAhead) {
            if (nextX + this.width > carAhead.x - DIFFICULTY.minimumGap) {
                nextX = carAhead.x - this.width - DIFFICULTY.minimumGap;
                this.speed = 0;
            }
        }
        this.x = nextX;

        // 4. Infrações
        if (trafficLight === 'RED' && !isBlitzActive && frontX > stopLineX && this.x < stopLineX + 40 && this.speed > 0.4) {
            this.committedRedLightInfraction = true;
            if (!this.hasBeenPenalized) {
                gameState.score -= 25;
                this.hasBeenPenalized = true;
                addFeedback('-25 SINAL!', this.x + 50, this.y, '#ff9f43');
                scoreEl.innerText = gameState.score;
            }
        }

        // 5. Condição de Celular Escapa
        if (this.x > canvas.width && this.hasPhoneInfraction && !this.isFined) {
            showFailScreen();
            return true;
        }
        return false;
    }

    draw(ctx) {
        // Sombra
        ctx.fillStyle = 'rgba(0,0,0,0.2)';
        ctx.beginPath(); ctx.roundRect(this.x + 5, this.y + 8, this.width, this.height, 10); ctx.fill();

        // Corpo
        const grad = ctx.createLinearGradient(this.x, this.y, this.x, this.y + this.height);
        grad.addColorStop(0, this.color); grad.addColorStop(1, this.darkColor);
        ctx.fillStyle = grad;
        ctx.beginPath(); ctx.roundRect(this.x, this.y, this.width, this.height, 8); ctx.fill();

        // Vidros
        ctx.fillStyle = 'rgba(174, 190, 196, 0.9)';
        ctx.beginPath(); ctx.roundRect(this.x + 75, this.y + 8, 25, this.height - 16, [0, 5, 5, 0]); ctx.fill();

        // Rodas
        this.drawWheel(ctx, this.x + 20, this.y - 4);
        this.drawWheel(ctx, this.x + 20, this.y + this.height - 6);
        this.drawWheel(ctx, this.x + 80, this.y - 4);
        this.drawWheel(ctx, this.x + 80, this.y + this.height - 6);

        // Celular
        if (this.hasPhoneInfraction) {
            ctx.fillStyle = '#000'; ctx.roundRect(this.x + 82, this.y + 20, 8, 14, 2); ctx.fill();
            ctx.fillStyle = this.isFined ? COLORS.trafficGreen : '#3498db';
            ctx.fillRect(this.x + 83, this.y + 22, 6, 10);
        }

        // Feedback
        if (this.isFined) {
            ctx.strokeStyle = this.wasWronglyFined ? COLORS.trafficRed : COLORS.trafficGreen;
            ctx.lineWidth = 4; ctx.setLineDash([6, 4]);
            ctx.strokeRect(this.x - 5, this.y - 5, this.width + 10, this.height + 10);
            ctx.setLineDash([]);
        }

        // UI de Blitz (CNH visível se estiver parado na blitz)
        if (gameState.isBlitzActive && Math.abs(this.x + this.width - DIFFICULTY.blitzLineX) < 20 && !this.isInspected) {
            this.drawLicensePopup(ctx);
        }
    }

    drawWheel(ctx, x, y) {
        ctx.fillStyle = '#111'; ctx.beginPath(); ctx.roundRect(x, y, 22, 10, 3); ctx.fill();
    }

    drawLicensePopup(ctx) {
        const px = this.x + 10;
        const py = this.y - 120;
        
        // Fundo da CNH
        ctx.fillStyle = '#fdfdfd';
        ctx.beginPath(); ctx.roundRect(px, py, 130, 100, 10); ctx.fill();
        ctx.strokeStyle = '#27ae60'; ctx.lineWidth = 2; ctx.stroke();
        
        // Cabeçalho
        ctx.fillStyle = '#27ae60';
        ctx.fillRect(px, py, 130, 20);
        ctx.fillStyle = '#fff'; ctx.font = 'bold 10px Segoe UI';
        ctx.fillText('CARTEIRA (CNH)', px + 10, py + 14);

        // Dados
        ctx.fillStyle = '#1a1a1a'; ctx.font = '12px Courier New';
        ctx.fillText(`PONTOS: ${this.license.points}`, px + 10, py + 45);
        ctx.fillText(`MULTAS: ${this.license.hasFines ? 'SIM' : 'NÃO'}`, px + 10, py + 65);
        
        ctx.fillStyle = this.license.isIrregular ? COLORS.trafficRed : COLORS.trafficGreen;
        ctx.font = 'bold 11px Segoe UI';
        ctx.fillText(this.license.isIrregular ? '!!! IRREGULAR !!!' : 'REGULARIZADA', px + 10, py + 85);
        
        // Dica de clique
        ctx.fillStyle = 'rgba(0,0,0,0.5)'; ctx.font = 'italic 8px Arial';
        ctx.fillText('Clique no carro p/ multar', px + 10, py + 105);
    }
}

// --- Funções core ---

function init() {
    canvas.width = 900;
    canvas.height = 500;
    drawStaticFrame(); 
}

function startGame() {
    gameState.hasStarted = true;
    startScreen.classList.add('hidden');
    resetGame();
}

function showFailScreen() {
    gameState.isGameOver = true;
    failScreen.classList.remove('hidden');
}

function resetGame() {
    gameState.score = 0;
    gameState.timeLeft = DIFFICULTY.gameDurationSeconds;
    gameState.isGameOver = false;
    gameState.isBlitzActive = false;
    gameState.cars = [];
    gameState.trafficLight = 'GREEN';
    gameState.feedbackMessages = [];
    scoreEl.innerText = '0';
    gameOverScreen.classList.add('hidden');
    failScreen.classList.add('hidden');
    timerEl.innerText = '02:00';
    blitzBtn.disabled = false;
    blitzBtn.innerText = 'ACIONAR BLITZ';
    if (!gameState.loopRunning) {
        gameState.loopRunning = true;
        requestAnimationFrame(gameLoop);
    }
    startTimer();
}

let timerInterval = null;
function startTimer() {
    if (timerInterval) clearInterval(timerInterval);
    timerInterval = setInterval(() => {
        if (gameState.isGameOver || !gameState.hasStarted) {
            clearInterval(timerInterval); return;
        }
        gameState.timeLeft--;
        const mins = Math.floor(gameState.timeLeft / 60).toString().padStart(2, '0');
        const secs = (gameState.timeLeft % 60).toString().padStart(2, '0');
        timerEl.innerText = `${mins}:${secs}`;
        if (gameState.timeLeft <= 0) { endGame(); clearInterval(timerInterval); }
    }, 1000);
}

function endGame() {
    gameState.isGameOver = true;
    finalScoreEl.innerText = gameState.score;
    gameOverScreen.classList.remove('hidden');
}

function addFeedback(text, x, y, color) {
    gameState.feedbackMessages.push({ text, x, y: y - 20, color, opacity: 1, timer: 70, scale: 1 });
}

function canSpawn(lane) {
    return !gameState.cars.some(car => car.lane === lane && car.x < 220);
}

// --- Inputs ---

canvas.addEventListener('mousedown', (e) => {
    if (gameState.isGameOver || !gameState.hasStarted) return;
    const rect = canvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    // Semáforo
    const lightX = DIFFICULTY.stopLineX + 20;
    const lightY = 150;
    if (mouseX > lightX - 55 && mouseX < lightX + 55 && mouseY > lightY - 110 && mouseY < lightY + 110) {
        gameState.trafficLight = gameState.trafficLight === 'GREEN' ? 'RED' : 'GREEN'; return;
    }

    // Carros
    for (let car of gameState.cars) {
        if (mouseX > car.x && mouseX < car.x + car.width && mouseY > car.y && mouseY < car.y + car.height) {
            if (car.isFined) return;
            
            // Especial Blitz
            if (gameState.isBlitzActive && Math.abs(car.x + car.width - DIFFICULTY.blitzLineX) < 30 && !car.isInspected) {
                if (car.license.isIrregular) {
                    gameState.score += 150; // Bônus Blitz
                    addFeedback('+150 CNH IRREGULAR!', mouseX, mouseY, COLORS.trafficGreen);
                    car.isFined = true;
                } else {
                    gameState.score -= 50;
                    addFeedback('-50 CNH REGULAR!', mouseX, mouseY, COLORS.trafficRed);
                    car.isInspected = true; // Liberar mesmo sem multa
                }
            } else {
                // Multas Normais
                if (car.committedRedLightInfraction || car.hasPhoneInfraction) {
                    gameState.score += 100; addFeedback('+100', mouseX, mouseY, COLORS.trafficGreen);
                    car.isFined = true;
                } else {
                    gameState.score -= 50; car.wasWronglyFined = true; addFeedback('-50', mouseX, mouseY, COLORS.trafficRed);
                    car.isFined = true;
                }
            }
            scoreEl.innerText = gameState.score; break;
        }
    }
});

startBtn.addEventListener('click', startGame);
restartBtn.addEventListener('click', resetGame);
failRestartBtn.addEventListener('click', resetGame);

blitzBtn.addEventListener('click', () => {
    if (gameState.isBlitzActive || !gameState.hasStarted || gameState.isGameOver) return;
    
    gameState.isBlitzActive = true;
    blitzBtn.disabled = true;
    blitzBtn.innerText = 'BLITZ EM CURSO...';
    
    // Blitz dura 15 segundos
    setTimeout(() => {
        gameState.isBlitzActive = false;
        blitzBtn.innerText = 'RECARREGANDO...';
        // Liberar todos os carros que estavam na blitz
        gameState.cars.forEach(car => car.isInspected = true);
        
        // Cooldown de 30 segundos
        setTimeout(() => {
            blitzBtn.disabled = false;
            blitzBtn.innerText = 'ACIONAR BLITZ';
        }, 20000);
    }, 15000);
});

// --- Loop ---

function drawPolicemen(ctx) {
    if (!gameState.isBlitzActive) return;
    const x = DIFFICULTY.blitzLineX;
    
    // Policial 1 (Pista Superior)
    drawOfficer(ctx, x, 175);
    // Policial 2 (Pista Inferior)
    drawOfficer(ctx, x, 395);
}

function drawOfficer(ctx, x, y) {
    ctx.fillStyle = COLORS.police;
    ctx.beginPath(); ctx.roundRect(x - 10, y, 20, 30, 5); ctx.fill(); // Corpo
    ctx.fillStyle = '#ffdbac';
    ctx.beginPath(); ctx.arc(x, y - 5, 8, 0, Math.PI * 2); ctx.fill(); // Cabeça
    ctx.fillStyle = COLORS.police;
    ctx.fillRect(x - 12, y - 12, 24, 6); // Chapéu
}

function drawBackground() {
    ctx.fillStyle = '#34495e'; ctx.fillRect(0, 180, canvas.width, 240);
    ctx.fillStyle = COLORS.road; ctx.fillRect(0, 200, canvas.width, 200);
    ctx.setLineDash([40, 30]); ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)'; ctx.lineWidth = 4;
    ctx.beginPath(); ctx.moveTo(0, 300); ctx.lineTo(canvas.width, 300); ctx.stroke();
    ctx.setLineDash([]);
    const zebraX = DIFFICULTY.stopLineX - 80;
    ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
    for(let i = 0; i < 8; i++) { ctx.fillRect(zebraX, 205 + (i * 25), 60, 15); }
    ctx.fillStyle = COLORS.line; ctx.fillRect(DIFFICULTY.stopLineX - 8, 200, 16, 200);
    const lightX = DIFFICULTY.stopLineX + 20;
    const lightY = 150;
    ctx.fillStyle = '#444'; ctx.fillRect(lightX - 6, lightY, 12, 300);
    ctx.fillStyle = '#222'; ctx.beginPath(); ctx.roundRect(lightX - 25, lightY - 70, 50, 110, 10); ctx.fill();
    drawLight(ctx, lightX, lightY - 40, gameState.trafficLight === 'RED' ? COLORS.trafficRed : '#111');
    drawLight(ctx, lightX, lightY + 15, gameState.trafficLight === 'GREEN' ? COLORS.trafficGreen : '#111');
    
    drawPolicemen(ctx);
}

function drawLight(ctx, x, y, color) {
    if (color !== '#111') { ctx.shadowBlur = 20; ctx.shadowColor = color; }
    ctx.fillStyle = color; ctx.beginPath(); ctx.arc(x, y, 18, 0, Math.PI * 2); ctx.fill();
    ctx.shadowBlur = 0;
}

function drawStaticFrame() { ctx.clearRect(0, 0, canvas.width, canvas.height); drawBackground(); }

function gameLoop() {
    if (!gameState.isGameOver && gameState.hasStarted) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        if (Math.random() < DIFFICULTY.carSpawnRate) {
            let lane = Math.random() > 0.5 ? 0 : 1;
            if (canSpawn(lane)) { gameState.cars.push(new Car(lane)); }
        }
        drawBackground();
        let resetRequested = false;
        gameState.cars = gameState.cars.filter(car => {
            const shouldRemove = car.x < canvas.width + 250;
            const triggerFail = car.update(gameState.trafficLight, DIFFICULTY.stopLineX, gameState.cars.filter(c => c.lane === car.lane), gameState.isBlitzActive);
            if (triggerFail) resetRequested = true;
            return shouldRemove;
        });
        if (resetRequested) return;
        gameState.cars.sort((a, b) => b.x - a.x);
        for (let car of gameState.cars) { car.draw(ctx); }
        ctx.textAlign = 'center';
        for (let i = gameState.feedbackMessages.length - 1; i >= 0; i--) {
            let msg = gameState.feedbackMessages[i];
            ctx.fillStyle = msg.color; ctx.globalAlpha = msg.opacity;
            ctx.font = `bold ${24 * msg.scale}px 'Segoe UI'`; ctx.fillText(msg.text, msg.x, msg.y);
            msg.y -= 1.2; msg.timer--; msg.opacity -= 0.015; msg.scale += 0.005;
            if (msg.timer <= 0) gameState.feedbackMessages.splice(i, 1);
        }
        ctx.globalAlpha = 1; requestAnimationFrame(gameLoop);
    } else { gameState.loopRunning = false; }
}

init();
