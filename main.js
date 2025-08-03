/*
 * Chihuahua Toy Dash
 *
 * Jogo estilo Pac‑Man onde um chihuahua de pelo comprido coleta brinquedos enquanto foge de papagaios.
 * Implementado com HTML5 Canvas e JavaScript puro. Movimento em grade com animação suave, colisor de paredes, 
 * IA simples para perseguidores e cronômetro de 60 segundos.
 */

// Constants defining tile size and map layout
const TILE_SIZE = 64; // pixels per tile
const ROWS = 13;
const COLS = 15;

// Maze definition: '1' = wall, '0' = empty path. The maze dimensions correspond to ROWS x COLS.
const MAZE = [
  '111111111111111',
  '100000000000001',
  '101111011111101',
  '101000010000101',
  '101011111110101',
  '101010000010101',
  '101010111010101',
  '101010100010101',
  '101010101010101',
  '101000001000101',
  '101111011111101',
  '100000010000001',
  '111111111111111'
];

// Helper to check if a given row/col is a wall
function isWall(row, col) {
  // If outside the maze boundaries treat as a wall to prevent moving off screen
  if (row < 0 || row >= ROWS || col < 0 || col >= COLS) return true;
  return MAZE[row][col] === '1';
}

// Load images for player, enemy and toys
const images = {};
function loadAssets() {
  const assetPaths = {
    chihuahua: 'assets/chihuahua.png',
    parrot: 'assets/parrot.png',
    teddy: 'assets/teddy.png',
    ball: 'assets/ball.png'
  };
  const promises = [];
  for (const key in assetPaths) {
    const img = new Image();
    img.src = assetPaths[key];
    images[key] = img;
    // Each image load returns a promise that resolves when the image is fully loaded
    promises.push(new Promise((resolve) => {
      img.onload = resolve;
    }));
  }
  return Promise.all(promises);
}

// Representing the player (chihuahua)
class Player {
  constructor(x, y) {
    this.x = x;
    this.y = y;
    this.speed = 3.0; // pixels per frame
    this.direction = { x: 0, y: 0 }; // current moving direction
    this.nextDirection = { x: 0, y: 0 }; // direction queued by arrow input
    this.size = TILE_SIZE; // width/height of sprite
  }

  // Attempt to set a new direction if not blocked
  tryChangeDirection() {
    // Only change direction when aligned in the middle of tile
    if (this.x % TILE_SIZE === 0 && this.y % TILE_SIZE === 0) {
      const currentRow = Math.floor(this.y / TILE_SIZE);
      const currentCol = Math.floor(this.x / TILE_SIZE);
      const nextCol = currentCol + this.nextDirection.x;
      const nextRow = currentRow + this.nextDirection.y;
      if (!isWall(nextRow, nextCol)) {
        this.direction = { ...this.nextDirection };
      }
    }
  }

  update() {
    this.tryChangeDirection();
    // Compute tentative new position
    let newX = this.x + this.direction.x * this.speed;
    let newY = this.y + this.direction.y * this.speed;
    // Check wall collisions separately for X and Y axes
    // Horizontal collision
    if (this.direction.x !== 0) {
      const col = this.direction.x > 0
        ? Math.floor((newX + this.size - 1) / TILE_SIZE) // right edge
        : Math.floor(newX / TILE_SIZE); // left edge
      const rowTop = Math.floor(this.y / TILE_SIZE);
      const rowBottom = Math.floor((this.y + this.size - 1) / TILE_SIZE);
      // If any tile in the column for the vertical span is a wall, cancel horizontal move
      if (isWall(rowTop, col) || isWall(rowBottom, col)) {
        newX = this.x; // revert horizontal movement
        // Align to grid to avoid jitter
        this.x = Math.round(this.x / TILE_SIZE) * TILE_SIZE;
        this.direction.x = 0;
      }
    }
    // Vertical collision
    if (this.direction.y !== 0) {
      const row = this.direction.y > 0
        ? Math.floor((newY + this.size - 1) / TILE_SIZE) // bottom edge
        : Math.floor(newY / TILE_SIZE); // top edge
      const colLeft = Math.floor(this.x / TILE_SIZE);
      const colRight = Math.floor((this.x + this.size - 1) / TILE_SIZE);
      if (isWall(row, colLeft) || isWall(row, colRight)) {
        newY = this.y;
        this.y = Math.round(this.y / TILE_SIZE) * TILE_SIZE;
        this.direction.y = 0;
      }
    }
    this.x = newX;
    this.y = newY;
  }

  draw(ctx) {
    ctx.drawImage(images.chihuahua, this.x, this.y, this.size, this.size);
  }
}

// Representing an enemy (parrot)
class Enemy {
  constructor(x, y) {
    this.x = x;
    this.y = y;
    this.speed = 1.2;
    this.direction = { x: 0, y: 0 };
    this.size = TILE_SIZE;
    this.startDelay = 3000; // ms delay before enemy begins chasing
    this.spawnTimestamp = Date.now();
  }

  chooseDirection() {
    // Only pick a new direction when aligned at tile center
    if (this.x % TILE_SIZE !== 0 || this.y % TILE_SIZE !== 0) return;
    const row = Math.floor(this.y / TILE_SIZE);
    const col = Math.floor(this.x / TILE_SIZE);
    const possible = [];
    const dirs = [
      { x: 1, y: 0 },
      { x: -1, y: 0 },
      { x: 0, y: 1 },
      { x: 0, y: -1 }
    ];
    dirs.forEach(dir => {
      const nextRow = row + dir.y;
      const nextCol = col + dir.x;
      if (!isWall(nextRow, nextCol)) {
        // Avoid immediate reversal unless it's the only option
        if (this.direction.x === -dir.x && this.direction.y === -dir.y) {
          possible.push({ dir, reverse: true });
        } else {
          possible.push({ dir, reverse: false });
        }
      }
    });
    // Filter out reverses if other options exist
    let candidates = possible.filter(p => !p.reverse);
    if (candidates.length === 0) candidates = possible;
    // Pick a random direction from candidates
    const choice = candidates[Math.floor(Math.random() * candidates.length)];
    this.direction = choice.dir;
  }

  update(player) {
    // Wait for spawn delay before activating
    if (Date.now() - this.spawnTimestamp < this.startDelay) {
      return;
    }
    // Choose a new direction when at an intersection
    this.chooseDirection();
    let newX = this.x + this.direction.x * this.speed;
    let newY = this.y + this.direction.y * this.speed;
    // Horizontal collision detection
    if (this.direction.x !== 0) {
      const col = this.direction.x > 0
        ? Math.floor((newX + this.size - 1) / TILE_SIZE)
        : Math.floor(newX / TILE_SIZE);
      const rowTop = Math.floor(this.y / TILE_SIZE);
      const rowBottom = Math.floor((this.y + this.size - 1) / TILE_SIZE);
      if (isWall(rowTop, col) || isWall(rowBottom, col)) {
        newX = this.x;
        this.direction = { x: 0, y: 0 };
      }
    }
    // Vertical collision detection
    if (this.direction.y !== 0) {
      const row = this.direction.y > 0
        ? Math.floor((newY + this.size - 1) / TILE_SIZE)
        : Math.floor(newY / TILE_SIZE);
      const colLeft = Math.floor(this.x / TILE_SIZE);
      const colRight = Math.floor((this.x + this.size - 1) / TILE_SIZE);
      if (isWall(row, colLeft) || isWall(row, colRight)) {
        newY = this.y;
        this.direction = { x: 0, y: 0 };
      }
    }
    this.x = newX;
    this.y = newY;
  }

  draw(ctx) {
    ctx.drawImage(images.parrot, this.x, this.y, this.size, this.size);
  }
}

// Toy item that increases score when collected
class Toy {
  constructor(row, col, type) {
    this.row = row;
    this.col = col;
    this.size = TILE_SIZE;
    this.collected = false;
    this.type = type; // 'teddy' or 'ball'
  }
  draw(ctx) {
    if (this.collected) return;
    const x = this.col * TILE_SIZE + (TILE_SIZE - TILE_SIZE * 0.6) / 2;
    const y = this.row * TILE_SIZE + (TILE_SIZE - TILE_SIZE * 0.6) / 2;
    const w = TILE_SIZE * 0.6;
    ctx.drawImage(images[this.type], x, y, w, w);
  }
}

// Game class to handle state, update loop and UI
class Game {
  constructor() {
    this.canvas = document.getElementById('gameCanvas');
    this.ctx = this.canvas.getContext('2d');
    this.player = null;
    this.enemies = [];
    this.toys = [];
    this.score = 0;
    this.timeLeft = 60; // seconds
    this.timerInterval = null;
    this.running = false;
    this.lastFrameTime = 0;
    this.requestId = null;
  }

  init() {
    // Place player at starting location (1,1)
    this.player = new Player(1 * TILE_SIZE, 1 * TILE_SIZE);
    // Place enemies at preconfigured positions
    this.enemies = [
      // Spawn a single enemy far from player start to avoid immediate collision
      // coordinates: col * TILE_SIZE for x, row * TILE_SIZE for y
      new Enemy(1 * TILE_SIZE, 11 * TILE_SIZE)
    ];
    // Generate toys randomly on empty tiles
    this.toys = [];
    const emptyCells = [];
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        if (!isWall(r, c) && !(r === 1 && c === 1)) {
          emptyCells.push({ r, c });
        }
      }
    }
    // Shuffle cells and pick first 10
    for (let i = emptyCells.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [emptyCells[i], emptyCells[j]] = [emptyCells[j], emptyCells[i]];
    }
    const toyTypes = ['teddy', 'ball'];
    const toyCount = Math.min(10, emptyCells.length);
    for (let i = 0; i < toyCount; i++) {
      const cell = emptyCells[i];
      const type = toyTypes[i % toyTypes.length];
      this.toys.push(new Toy(cell.r, cell.c, type));
    }
    // Reset score and time
    this.score = 0;
    this.timeLeft = 60;
    document.getElementById('score').textContent = `Pontuação: ${this.score}`;
    document.getElementById('timer').textContent = `Tempo: ${this.timeLeft}`;
    // Setup keyboard controls
    this.setupControls();
    // Start timer countdown
    clearInterval(this.timerInterval);
    this.timerInterval = setInterval(() => {
      if (!this.running) return;
      this.timeLeft--;
      document.getElementById('timer').textContent = `Tempo: ${this.timeLeft}`;
      if (this.timeLeft <= 0) {
        this.endGame(false);
      }
    }, 1000);
    this.running = true;
    this.lastFrameTime = 0;
    // Start game loop
    this.loop(0);
  }

  setupControls() {
    window.onkeydown = (e) => {
      const key = e.key;
      const dirs = {
        ArrowUp: { x: 0, y: -1 },
        ArrowDown: { x: 0, y: 1 },
        ArrowLeft: { x: -1, y: 0 },
        ArrowRight: { x: 1, y: 0 }
      };
      if (dirs[key]) {
        this.player.nextDirection = dirs[key];
        e.preventDefault();
      }
    };
  }

  loop(timestamp) {
    if (!this.running) return;
    const delta = timestamp - this.lastFrameTime;
    this.lastFrameTime = timestamp;
    this.update(delta / 16.67); // normalized to 60fps units
    this.draw();
    this.requestId = requestAnimationFrame((t) => this.loop(t));
  }

  update(dt) {
    // Update player position
    this.player.update();
    // Check toy collection
    const playerRow = Math.floor(this.player.y / TILE_SIZE);
    const playerCol = Math.floor(this.player.x / TILE_SIZE);
    this.toys.forEach((toy) => {
      if (!toy.collected && toy.row === playerRow && toy.col === playerCol) {
        toy.collected = true;
        this.score++;
        document.getElementById('score').textContent = `Pontuação: ${this.score}`;
        // Check if all toys collected -> win
        if (this.toys.every(t => t.collected)) {
          this.endGame(true);
        }
      }
    });
    // Update enemies
    this.enemies.forEach((enemy) => {
      enemy.update(this.player);
      // Collision detection with player (simple overlap check)
      if (this.checkCollision(this.player, enemy)) {
        this.endGame(false);
      }
    });
  }

  draw() {
    const ctx = this.ctx;
    // Clear canvas
    ctx.fillStyle = '#e8f0fe';
    ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    // Draw maze
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        if (isWall(r, c)) {
          ctx.fillStyle = '#374785';
          ctx.fillRect(c * TILE_SIZE, r * TILE_SIZE, TILE_SIZE, TILE_SIZE);
        } else {
          // Path background
          ctx.fillStyle = '#dfe7fd';
          ctx.fillRect(c * TILE_SIZE, r * TILE_SIZE, TILE_SIZE, TILE_SIZE);
        }
      }
    }
    // Draw toys
    this.toys.forEach(toy => toy.draw(ctx));
    // Draw enemies
    this.enemies.forEach(enemy => enemy.draw(ctx));
    // Draw player
    this.player.draw(ctx);
    // Draw grid lines (optional for style)
    /*ctx.strokeStyle = 'rgba(0,0,0,0.1)';
    ctx.lineWidth = 1;
    for (let r = 0; r <= ROWS; r++) {
      ctx.beginPath();
      ctx.moveTo(0, r * TILE_SIZE);
      ctx.lineTo(COLS * TILE_SIZE, r * TILE_SIZE);
      ctx.stroke();
    }
    for (let c = 0; c <= COLS; c++) {
      ctx.beginPath();
      ctx.moveTo(c * TILE_SIZE, 0);
      ctx.lineTo(c * TILE_SIZE, ROWS * TILE_SIZE);
      ctx.stroke();
    }*/
  }

  checkCollision(a, b) {
    const ax1 = a.x;
    const ay1 = a.y;
    const ax2 = a.x + a.size;
    const ay2 = a.y + a.size;
    const bx1 = b.x;
    const by1 = b.y;
    const bx2 = b.x + b.size;
    const by2 = b.y + b.size;
    return ax1 < bx2 && ax2 > bx1 && ay1 < by2 && ay2 > by1;
  }

  endGame(win) {
    this.running = false;
    clearInterval(this.timerInterval);
    cancelAnimationFrame(this.requestId);
    // Show overlay
    const overlay = document.getElementById('overlay');
    const endTitle = document.getElementById('end-title');
    const endScore = document.getElementById('end-score');
    overlay.classList.remove('hidden');
    if (win) {
      endTitle.textContent = 'Parabéns!';
      endScore.textContent = `Você coletou todos os brinquedos! Pontuação: ${this.score}`;
    } else {
      endTitle.textContent = 'Fim de Jogo!';
      endScore.textContent = `Sua pontuação: ${this.score}`;
    }
  }
}

// Main entry point: load assets then start game
document.addEventListener('DOMContentLoaded', () => {
  loadAssets().then(() => {
    const game = new Game();
    const overlay = document.getElementById('overlay');
    const restartBtn = document.getElementById('restart-btn');
    // Start first game
    game.init();
    // Restart button resets overlay and game
    restartBtn.addEventListener('click', () => {
      overlay.classList.add('hidden');
      game.init();
    });
  });
});