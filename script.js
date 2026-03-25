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
const finalScoreEl = document.getElementById('final-score');
const restartBtn = document.getElementById('restart-btn');
const startBtn = document.getElementById('start-btn');

// --- Configurações de Dificuldade ---
const DIFFICULTY = {
    carSpawnRate: 0.012,       // Chance de um carro aparecer (reduzido para evitar congestionamento)
    minCarSpeed: 2,           
    maxCarSpeed: 4,           
    phoneInfractionRate: 0.3, 
    gameDurationSeconds: 120, 
    stopLineX: 620,           // Posição ajustada para alinhar com a visualização
    safeDistance: 130,        // Distância mínima entre carros (maior que o comprimento do carro)
};

// --- Estado do Jogo ---
let gameState = {
    score: 0,
    timeLeft: DIFFICULTY.gameDurationSeconds,
    isGameOver: false,
    hasStarted: false,
    trafficLight: 'GREEN', 
    cars: [],
    feedbackMessages: [], 
};

// --- Cores e Estética ---
const COLORS = {
    road: '#2c3e50',
    grass: '#1a1a1a',
    line: '#ecf0f1',
    trafficGreen: '#2ecc71',
    trafficRed: '#e74c3c',
    trafficYellow: '#f1c40f',
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
        this.x = -this.width - 20; // Começar um pouco antes para suavizar spawn
        this.lane = lane; // 0 para cima, 1 para baixo
        this.y = 250 + (this.lane === 0 ? -50 : 50); 
        this.baseSpeed = DIFFICULTY.minCarSpeed + Math.random() * (DIFFICULTY.maxCarSpeed - DIFFICULTY.minCarSpeed);
        this.speed = this.baseSpeed;
        
        const colorSet = COLORS.carColors[Math.floor(Math.random() * COLORS.carColors.length)];
        this.color = colorSet.main;
        this.darkColor = colorSet.dark;
        
        this.hasPhoneInfraction = Math.random() < DIFFICULTY.phoneInfractionRate;
        this.committedRedLightInfraction = false;
        this.isFined = false;
        this.wasWronglyFined = false;
    }

    update(trafficLight, stopLineX, carsInLane) {
        const frontX = this.x + this.width;
        let targetSpeed = this.baseSpeed;

        // 1. Lógica de frenagem no semáforo
        if (trafficLight === 'RED' && frontX < stopLineX - 10 && frontX > stopLineX - 180) {
            targetSpeed = 0;
        }

        // 2. Lógica de "Hitbox" / Distância de segurança (não bater no carro da frente)
        const carAhead = carsInLane.find(other => other.x > this.x);
        if (carAhead) {
            const distance = carAhead.x - frontX;
            if (distance < 20) {
                targetSpeed = 0; // Para imediatamente se estiver muito perto
            } else if (distance < DIFFICULTY.safeDistance) {
                targetSpeed = Math.min(targetSpeed, carAhead.speed); // Iguala velocidade
                if (distance < 50) targetSpeed *= 0.5; // Desacelera mais se estiver encostando
            }
        }

        // Suavização do movimento (aceleração/frenagem)
        if (this.speed > targetSpeed) {
            this.speed = Math.max(targetSpeed, this.speed - 0.2);
        } else if (this.speed < targetSpeed) {
            this.speed = Math.min(targetSpeed, this.speed + 0.1);
        }

        // 3. Detectar avanço de sinal (Infração)
        // Só conta se o sinal estiver vermelho E o carro cruzar a linha (não apenas se estiver parado nela)
        if (trafficLight === 'RED' && frontX > stopLineX && this.x < stopLineX + 30 && this.speed > 0.5) {
            this.committedRedLightInfraction = true;
        }

        this.x += this.speed;
    }

    draw(ctx) {
        // Sombra
        ctx.fillStyle = 'rgba(0,0,0,0.2)';
        ctx.beginPath();
        ctx.roundRect(this.x + 5, this.y + 8, this.width, this.height, 10);
        ctx.fill();

        // Corpo Principal
        const grad = ctx.createLinearGradient(this.x, this.y, this.x, this.y + this.height);
        grad.addColorStop(0, this.color);
        grad.addColorStop(1, this.darkColor);
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.roundRect(this.x, this.y, this.width, this.height, 8);
        ctx.fill();

        // Teto/Cabine
        ctx.fillStyle = 'rgba(0,0,0,0.15)';
        ctx.beginPath();
        ctx.roundRect(this.x + 20, this.y + 5, 60, this.height - 10, 5);
        ctx.fill();

        // Para-brisa
        ctx.fillStyle = '#aebec4';
        ctx.beginPath();
        ctx.roundRect(this.x + 75, this.y + 8, 25, this.height - 16, [0, 5, 5, 0]);
        ctx.fill();

        // Faróis Frontais
        ctx.fillStyle = '#fff9c4'; 
        ctx.fillRect(this.x + this.width - 5, this.y + 5, 5, 10);
        ctx.fillRect(this.x + this.width - 5, this.y + this.height - 15, 5, 10);
        
        // Lanternas Traseiras
        ctx.fillStyle = '#ef5350'; 
        ctx.fillRect(this.x, this.y + 5, 3, 10);
        ctx.fillRect(this.x, this.y + this.height - 15, 3, 10);

        // Rodas (Agora fixas horizontalmente conforme pedido)
        this.drawWheel(ctx, this.x + 20, this.y - 3);
        this.drawWheel(ctx, this.x + 20, this.y + this.height - 5);
        this.drawWheel(ctx, this.x + 80, this.y - 3);
        this.drawWheel(ctx, this.x + 80, this.y + this.height - 5);

        // Ícone de Celular
        if (this.hasPhoneInfraction) {
            ctx.fillStyle = '#000';
            ctx.roundRect(this.x + 82, this.y + 20, 8, 14, 2);
            ctx.fill();
            ctx.fillStyle = this.isFined ? COLORS.trafficGreen : '#3498db';
            ctx.fillRect(this.x + 83, this.y + 22, 6, 10);
        }

        // Feedback se multado
        if (this.isFined) {
            ctx.strokeStyle = this.wasWronglyFined ? COLORS.trafficRed : COLORS.trafficGreen;
            ctx.lineWidth = 4;
            ctx.setLineDash([5, 5]);
            ctx.strokeRect(this.x - 5, this.y - 5, this.width + 10, this.height + 10);
            ctx.setLineDash([]);
        }
    }

    drawWheel(ctx, x, y) {
        // Roda horizontal estática
        ctx.fillStyle = '#111';
        ctx.beginPath();
        ctx.roundRect(x, y, 22, 10, 3);
        ctx.fill();
    }
}

// --- Funções de Suporte ---

function init() {
    canvas.width = 900;
    canvas.height = 500;
    drawStaticFrame(); 
}

function startGame() {
    gameState.hasStarted = true;
    startScreen.classList.add('hidden');
    resetGame();
    requestAnimationFrame(gameLoop);
}

function resetGame() {
    gameState.score = 0;
    gameState.timeLeft = DIFFICULTY.gameDurationSeconds;
    gameState.isGameOver = false;
    gameState.cars = [];
    gameState.trafficLight = 'GREEN';
    gameState.feedbackMessages = [];
    scoreEl.innerText = '0';
    gameOverScreen.classList.add('hidden');
    startTimer();
}

function startTimer() {
    const timerInterval = setInterval(() => {
        if (gameState.isGameOver || !gameState.hasStarted) {
            clearInterval(timerInterval);
            return;
        }
        
        gameState.timeLeft--;
        const mins = Math.floor(gameState.timeLeft / 60).toString().padStart(2, '0');
        const secs = (gameState.timeLeft % 60).toString().padStart(2, '0');
        timerEl.innerText = `${mins}:${secs}`;

        if (gameState.timeLeft <= 0) {
            endGame();
            clearInterval(timerInterval);
        }
    }, 1000);
}

function endGame() {
    gameState.isGameOver = true;
    finalScoreEl.innerText = gameState.score;
    gameOverScreen.classList.remove('hidden');
}

function addFeedback(text, x, y, color) {
    gameState.feedbackMessages.push({
        text, x, y, color, opacity: 1, timer: 60, scale: 1
    });
}

function canSpawn(lane) {
    // Verifica se há espaço no início da pista para um novo carro
    return !gameState.cars.some(car => car.lane === lane && car.x < 120);
}

// --- Input Handling ---

canvas.addEventListener('mousedown', (e) => {
    if (gameState.isGameOver || !gameState.hasStarted) return;

    const rect = canvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    // Clique no semáforo
    const lightX = DIFFICULTY.stopLineX + 20;
    const lightY = 150;
    if (mouseX > lightX - 50 && mouseX < lightX + 50 && mouseY > lightY - 100 && mouseY < lightY + 100) {
        gameState.trafficLight = gameState.trafficLight === 'GREEN' ? 'RED' : 'GREEN';
        return;
    }

    // Clique nos carros
    for (let car of gameState.cars) {
        if (mouseX > car.x && mouseX < car.x + car.width && mouseY > car.y && mouseY < car.y + car.height) {
            if (car.isFined) return;

            car.isFined = true;
            if (car.committedRedLightInfraction || car.hasPhoneInfraction) {
                gameState.score += 100;
                addFeedback('+100', mouseX, mouseY, COLORS.trafficGreen);
            } else {
                gameState.score -= 50;
                car.wasWronglyFined = true;
                addFeedback('-50', mouseX, mouseY, COLORS.trafficRed);
            }
            scoreEl.innerText = gameState.score;
            break;
        }
    }
});

startBtn.addEventListener('click', startGame);
restartBtn.addEventListener('click', resetGame);

// --- Loop Principal ---

function drawBackground() {
    ctx.fillStyle = '#34495e';
    ctx.fillRect(0, 180, canvas.width, 240);

    ctx.fillStyle = COLORS.road;
    ctx.fillRect(0, 200, canvas.width, 200);

    ctx.setLineDash([40, 30]);
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(0, 300);
    ctx.lineTo(canvas.width, 300);
    ctx.stroke();
    ctx.setLineDash([]);

    const zebraX = DIFFICULTY.stopLineX - 80;
    ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
    for(let i = 0; i < 8; i++) {
        ctx.fillRect(zebraX, 205 + (i * 25), 60, 15);
    }

    ctx.fillStyle = COLORS.line;
    ctx.fillRect(DIFFICULTY.stopLineX - 8, 200, 16, 200);

    const lightX = DIFFICULTY.stopLineX + 20;
    const lightY = 150;
    
    ctx.fillStyle = '#444';
    ctx.fillRect(lightX - 6, lightY, 12, 300);
    
    ctx.fillStyle = '#222';
    ctx.beginPath();
    ctx.roundRect(lightX - 25, lightY - 70, 50, 110, 10);
    ctx.fill();
    
    drawLight(ctx, lightX, lightY - 40, gameState.trafficLight === 'RED' ? COLORS.trafficRed : '#111');
    drawLight(ctx, lightX, lightY + 15, gameState.trafficLight === 'GREEN' ? COLORS.trafficGreen : '#111');
}

function drawLight(ctx, x, y, color) {
    if (color !== '#111') {
        ctx.shadowBlur = 20;
        ctx.shadowColor = color;
    }
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(x, y, 18, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
}

function drawStaticFrame() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    drawBackground();
}

function gameLoop() {
    if (!gameState.isGameOver && gameState.hasStarted) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        // Spawn de carros (com verificação de espaço)
        if (Math.random() < DIFFICULTY.carSpawnRate) {
            let lane = Math.random() > 0.5 ? 0 : 1;
            if (canSpawn(lane)) {
                gameState.cars.push(new Car(lane));
            }
        }

        drawBackground();

        // Ordenar carros por X para facilitar a lógica de distância
        gameState.cars.sort((a, b) => b.x - a.x);

        gameState.cars = gameState.cars.filter(car => car.x < canvas.width + 200);
        for (let car of gameState.cars) {
            const laneCars = gameState.cars.filter(c => c.lane === car.lane);
            car.update(gameState.trafficLight, DIFFICULTY.stopLineX, laneCars);
            car.draw(ctx);
        }

        ctx.textAlign = 'center';
        for (let i = gameState.feedbackMessages.length - 1; i >= 0; i--) {
            let msg = gameState.feedbackMessages[i];
            ctx.fillStyle = msg.color;
            ctx.globalAlpha = msg.opacity;
            ctx.font = `bold ${24 * msg.scale}px 'Segoe UI'`;
            ctx.fillText(msg.text, msg.x, msg.y);
            
            msg.y -= 1.2;
            msg.timer--;
            msg.opacity -= 0.015;
            msg.scale += 0.005;
            if (msg.timer <= 0) gameState.feedbackMessages.splice(i, 1);
        }
        ctx.globalAlpha = 1;

        requestAnimationFrame(gameLoop);
    }
}

init();
