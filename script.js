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

// --- Configurações de Dificuldade (Ajuste aqui) ---
const DIFFICULTY = {
    carSpawnRate: 0.015,       // Chance de um carro aparecer a cada frame
    minCarSpeed: 2,           // Velocidade mínima dos carros
    maxCarSpeed: 4.5,         // Velocidade máxima dos carros (reduzido para fluidez)
    phoneInfractionRate: 0.3, // 30% de chance de motorista no celular
    gameDurationSeconds: 120, // 2 minutos por turno
    stopLineX: 600,           // Posição X da linha de parada
};

// --- Estado do Jogo ---
let gameState = {
    score: 0,
    timeLeft: DIFFICULTY.gameDurationSeconds,
    isGameOver: false,
    hasStarted: false,
    trafficLight: 'GREEN', // 'GREEN' | 'RED'
    cars: [],
    feedbackMessages: [], // Para mostrar +100 ou -50 na tela
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
        { main: '#3498db', dark: '#2980b9' }, // Azul
        { main: '#e74c3c', dark: '#c0392b' }, // Vermelho
        { main: '#f1c40f', dark: '#f39c12' }, // Amarelo
        { main: '#9b59b6', dark: '#8e44ad' }, // Roxo
        { main: '#1abc9c', dark: '#16a085' }, // Verde Água
        { main: '#ecf0f1', dark: '#bdc3c7' }  // Branco
    ],
};

// --- Classes ---

class Car {
    constructor() {
        this.width = 110;
        this.height = 55;
        this.x = -this.width;
        this.y = 250 + (Math.random() > 0.5 ? 50 : -50); // Variar entre duas pistas
        this.speed = DIFFICULTY.minCarSpeed + Math.random() * (DIFFICULTY.maxCarSpeed - DIFFICULTY.minCarSpeed);
        const colorSet = COLORS.carColors[Math.floor(Math.random() * COLORS.carColors.length)];
        this.color = colorSet.main;
        this.darkColor = colorSet.dark;
        
        // Infrações
        this.hasPhoneInfraction = Math.random() < DIFFICULTY.phoneInfractionRate;
        this.committedRedLightInfraction = false;
        this.isFined = false;
        this.wasWronglyFined = false;
        
        // Estética
        this.wheelRotation = 0;
    }

    update(trafficLight, stopLineX) {
        const frontX = this.x + this.width;
        
        // Lógica de frenagem no semáforo
        if (trafficLight === 'RED' && frontX < stopLineX - 10 && frontX > stopLineX - 150) {
            this.speed *= 0.94; // Desaceleração mais suave
            if (this.speed < 0.1) this.speed = 0;
        } else if (trafficLight === 'GREEN' || frontX > stopLineX) {
            // Recuperar velocidade se estiver parado ou já passou a linha
            if (this.speed < 2) this.speed += 0.1;
        }

        // Detectar avanço de sinal
        if (trafficLight === 'RED' && frontX > stopLineX && this.x < stopLineX + 20) {
            this.committedRedLightInfraction = true;
        }

        this.x += this.speed;
        this.wheelRotation += this.speed * 0.1;
    }

    draw(ctx) {
        // Sombra suave
        ctx.fillStyle = 'rgba(0,0,0,0.2)';
        ctx.roundRect(this.x + 5, this.y + 8, this.width, this.height, 10);
        ctx.fill();

        // Corpo Principal (Gradiente para profundidade)
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

        // Faróis (Branco na frente, vermelho atrás)
        ctx.fillStyle = '#fff9c4'; // Farol frontal
        ctx.fillRect(this.x + this.width - 5, this.y + 5, 5, 10);
        ctx.fillRect(this.x + this.width - 5, this.y + this.height - 15, 5, 10);
        
        ctx.fillStyle = '#ef5350'; // Lanterna traseira
        ctx.fillRect(this.x, this.y + 5, 3, 10);
        ctx.fillRect(this.x, this.y + this.height - 15, 3, 10);

        // Rodas
        this.drawWheel(ctx, this.x + 20, this.y - 2);
        this.drawWheel(ctx, this.x + 20, this.y + this.height + 2);
        this.drawWheel(ctx, this.x + 80, this.y - 2);
        this.drawWheel(ctx, this.x + 80, this.y + this.height + 2);

        // Ícone de Celular (se houver infração)
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
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(this.wheelRotation);
        ctx.fillStyle = '#222';
        ctx.beginPath();
        ctx.roundRect(-12, -4, 24, 8, 3);
        ctx.fill();
        ctx.restore();
    }
}

// --- Funções de Suporte ---

function init() {
    canvas.width = 900;
    canvas.height = 500;
    // Não inicia o loop até clicar em Iniciar
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

// --- Input Handling ---

canvas.addEventListener('mousedown', (e) => {
    if (gameState.isGameOver || !gameState.hasStarted) return;

    const rect = canvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    // 1. Checar semáforo
    const lightX = DIFFICULTY.stopLineX + 20;
    const lightY = 150;
    if (mouseX > lightX - 40 && mouseX < lightX + 40 && mouseY > lightY - 100 && mouseY < lightY + 100) {
        gameState.trafficLight = gameState.trafficLight === 'GREEN' ? 'RED' : 'GREEN';
        return;
    }

    // 2. Checar carros
    let clickedAny = false;
    for (let car of gameState.cars) {
        if (mouseX > car.x && mouseX < car.x + car.width && mouseY > car.y && mouseY < car.y + car.height) {
            if (car.isFined) return;

            car.isFined = true;
            clickedAny = true;
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
restartBtn.addEventListener('click', () => {
    gameOverScreen.classList.add('hidden');
    resetGame();
});

// --- Loop Principal ---

function drawBackground() {
    // Calçada
    ctx.fillStyle = '#34495e';
    ctx.fillRect(0, 180, canvas.width, 240);

    // Estrada Principal
    ctx.fillStyle = COLORS.road;
    ctx.fillRect(0, 200, canvas.width, 200);

    // Faixas da Estrada
    ctx.setLineDash([40, 30]);
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(0, 300);
    ctx.lineTo(canvas.width, 300);
    ctx.stroke();
    ctx.setLineDash([]);

    // Faixa de Pedestres (Zebrada)
    const zebraX = DIFFICULTY.stopLineX - 80;
    ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
    for(let i = 0; i < 8; i++) {
        ctx.fillRect(zebraX, 205 + (i * 25), 60, 15);
    }

    // Linha de Parada
    ctx.fillStyle = COLORS.line;
    ctx.fillRect(DIFFICULTY.stopLineX - 8, 200, 16, 200);

    // Estrutura do Semáforo
    const lightX = DIFFICULTY.stopLineX + 20;
    const lightY = 150;
    
    // Poste
    ctx.fillStyle = '#444';
    ctx.fillRect(lightX - 6, lightY, 12, 300);
    
    // Caixa
    ctx.fillStyle = '#222';
    ctx.beginPath();
    ctx.roundRect(lightX - 25, lightY - 70, 50, 110, 10);
    ctx.fill();
    
    // Luzes (com brilho)
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

        // Spawn
        if (Math.random() < DIFFICULTY.carSpawnRate) {
            gameState.cars.push(new Car());
        }

        drawBackground();

        // Carros
        gameState.cars = gameState.cars.filter(car => car.x < canvas.width + 200);
        for (let car of gameState.cars) {
            car.update(gameState.trafficLight, DIFFICULTY.stopLineX);
            car.draw(ctx);
        }

        // Pop-ups de pontos
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
        ctx.textAlign = 'left';

        requestAnimationFrame(gameLoop);
    }
}

// Iniciar
init();
