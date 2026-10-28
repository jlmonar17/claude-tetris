'use strict';

const COLS = 10;
const ROWS = 20;
const BLOCK = 30;

const COLORS = [
  null,
  '#4dd0e1', // I - cyan
  '#ffd54f', // O - yellow
  '#ba68c8', // T - purple
  '#81c784', // S - green
  '#e57373', // Z - red
  '#90caf9', // J - pale blue
  '#ffb74d', // L - orange
];

const PIECES = [
  null,
  [[0,0,0,0],[1,1,1,1],[0,0,0,0],[0,0,0,0]], // I
  [[2,2],[2,2]],                               // O
  [[0,3,0],[3,3,3],[0,0,0]],                  // T
  [[0,4,4],[4,4,0],[0,0,0]],                  // S
  [[5,5,0],[0,5,5],[0,0,0]],                  // Z
  [[6,0,0],[6,6,6],[0,0,0]],                  // J
  [[0,0,7],[7,7,7],[0,0,0]],                  // L
];

const LINE_SCORES = [0, 100, 300, 500, 800];

const canvas = document.getElementById('board');
const ctx = canvas.getContext('2d');
const nextCanvas = document.getElementById('next-canvas');
const nextCtx = nextCanvas.getContext('2d');
const scoreEl = document.getElementById('score');
const linesEl = document.getElementById('lines');
const levelEl = document.getElementById('level');
const overlay = document.getElementById('overlay');
const overlayTitle = document.getElementById('overlay-title');
const overlayScore = document.getElementById('overlay-score');
const restartBtn = document.getElementById('restart-btn');
const themeBtn = document.getElementById('theme-btn');

let gridColor = '#22222e';
let combo = 0, bestCombo = 0, started = false;
let board, current, next, score, lines, level, paused, gameOver, lastTime, dropAccum, dropInterval, animId;

function createBoard() {
  return Array.from({ length: ROWS }, () => new Array(COLS).fill(0));
}

function randomPiece() {
  const type = Math.floor(Math.random() * 7) + 1;
  const shape = PIECES[type].map(row => [...row]);
  return { type, shape, x: Math.floor(COLS / 2) - Math.floor(shape[0].length / 2), y: 0 };
}

function collide(shape, ox, oy) {
  for (let r = 0; r < shape.length; r++) {
    for (let c = 0; c < shape[r].length; c++) {
      if (!shape[r][c]) continue;
      const nx = ox + c;
      const ny = oy + r;
      if (nx < 0 || nx >= COLS || ny >= ROWS) return true;
      if (ny >= 0 && board[ny][nx]) return true;
    }
  }
  return false;
}

function rotateCW(shape) {
  const rows = shape.length, cols = shape[0].length;
  const result = Array.from({ length: cols }, () => new Array(rows).fill(0));
  for (let r = 0; r < rows; r++)
    for (let c = 0; c < cols; c++)
      result[c][rows - 1 - r] = shape[r][c];
  return result;
}

function tryRotate() {
  const rotated = rotateCW(current.shape);
  const kicks = [0, -1, 1, -2, 2];
  for (const kick of kicks) {
    if (!collide(rotated, current.x + kick, current.y)) {
      current.shape = rotated;
      current.x += kick;
      return;
    }
  }
}

function merge() {
  for (let r = 0; r < current.shape.length; r++)
    for (let c = 0; c < current.shape[r].length; c++)
      if (current.shape[r][c])
        board[current.y + r][current.x + c] = current.shape[r][c];
}

function clearLines() {
  let cleared = 0;
  for (let r = ROWS - 1; r >= 0; r--) {
    if (board[r].every(v => v !== 0)) {
      board.splice(r, 1);
      board.unshift(new Array(COLS).fill(0));
      cleared++;
      r++;
    }
  }
  if (cleared) {
    lines += cleared;
    score += (LINE_SCORES[cleared] || 0) * level;
    level = Math.floor(lines / 10) + 1;
    dropInterval = Math.max(100, 1000 - (level - 1) * 90);
    updateHUD();
  }
  return cleared;
}

function ghostY() {
  let gy = current.y;
  while (!collide(current.shape, current.x, gy + 1)) gy++;
  return gy;
}

function hardDrop() {
  const gy = ghostY();
  score += (gy - current.y) * 2;
  current.y = gy;
  lockPiece();
}

function softDrop() {
  if (!collide(current.shape, current.x, current.y + 1)) {
    current.y++;
    score += 1;
    updateHUD();
  } else {
    lockPiece();
  }
}

function lockPiece() {
  merge();
  const cleared = clearLines();
  combo = cleared ? combo + 1 : 0;
  if (combo > bestCombo) bestCombo = combo;
  spawn();
}

function spawn() {
  current = next;
  next = randomPiece();
  if (collide(current.shape, current.x, current.y)) {
    endGame();
  }
  drawNext();
}

function updateHUD() {
  scoreEl.textContent = score.toLocaleString();
  linesEl.textContent = lines;
  levelEl.textContent = level;
}

function drawBlock(context, x, y, colorIndex, size, alpha) {
  if (!colorIndex) return;
  const color = COLORS[colorIndex];
  context.globalAlpha = alpha ?? 1;
  context.fillStyle = color;
  context.fillRect(x * size + 1, y * size + 1, size - 2, size - 2);
  // highlight
  context.fillStyle = 'rgba(255,255,255,0.12)';
  context.fillRect(x * size + 1, y * size + 1, size - 2, 4);
  context.globalAlpha = 1;
}

function drawGrid() {
  ctx.strokeStyle = gridColor;
  ctx.lineWidth = 0.5;
  for (let c = 1; c < COLS; c++) {
    ctx.beginPath();
    ctx.moveTo(c * BLOCK, 0);
    ctx.lineTo(c * BLOCK, ROWS * BLOCK);
    ctx.stroke();
  }
  for (let r = 1; r < ROWS; r++) {
    ctx.beginPath();
    ctx.moveTo(0, r * BLOCK);
    ctx.lineTo(COLS * BLOCK, r * BLOCK);
    ctx.stroke();
  }
}

function draw() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  drawGrid();

  // board
  for (let r = 0; r < ROWS; r++)
    for (let c = 0; c < COLS; c++)
      drawBlock(ctx, c, r, board[r][c], BLOCK);

  // ghost
  const gy = ghostY();
  for (let r = 0; r < current.shape.length; r++)
    for (let c = 0; c < current.shape[r].length; c++)
      if (current.shape[r][c])
        drawBlock(ctx, current.x + c, gy + r, current.shape[r][c], BLOCK, 0.2);

  // current piece
  for (let r = 0; r < current.shape.length; r++)
    for (let c = 0; c < current.shape[r].length; c++)
      drawBlock(ctx, current.x + c, current.y + r, current.shape[r][c], BLOCK);
}

function drawNext() {
  const NB = 30;
  nextCtx.clearRect(0, 0, nextCanvas.width, nextCanvas.height);
  const shape = next.shape;
  const offX = Math.floor((4 - shape[0].length) / 2);
  const offY = Math.floor((4 - shape.length) / 2);
  for (let r = 0; r < shape.length; r++)
    for (let c = 0; c < shape[r].length; c++)
      drawBlock(nextCtx, offX + c, offY + r, shape[r][c], NB);
}

function endGame() {
  gameOver = true;
  cancelAnimationFrame(animId);
  overlayTitle.textContent = 'GAME OVER';
  overlayScore.textContent = `Puntuación: ${score.toLocaleString()}`;
  showGameOverRecords();
  overlay.classList.remove('hidden');
}

function togglePause() {
  if (gameOver || !started) return;
  paused = !paused;
  if (!paused) {
    lastTime = performance.now();
    loop(lastTime);
  } else {
    cancelAnimationFrame(animId);
    overlayTitle.textContent = 'PAUSA';
    overlayScore.textContent = '';
    overlay.classList.remove('hidden');
  }
}

function loop(ts) {
  if (paused || gameOver) return;
  const dt = ts - lastTime;
  lastTime = ts;
  dropAccum += dt;
  if (dropAccum >= dropInterval) {
    dropAccum = 0;
    if (!collide(current.shape, current.x, current.y + 1)) {
      current.y++;
    } else {
      lockPiece();
    }
  }
  draw();
  if (gameOver) return;
  animId = requestAnimationFrame(loop);
}

function setTheme(theme) {
  document.documentElement.dataset.theme = theme;
  try { localStorage.setItem('theme', theme); } catch (e) {}
  themeBtn.textContent = theme === 'light' ? 'Tema: claro' : 'Tema: oscuro';
  gridColor = getComputedStyle(document.documentElement).getPropertyValue('--grid').trim();
  if (current) { draw(); drawNext(); }
}

function toggleTheme() {
  setTheme(document.documentElement.dataset.theme === 'light' ? 'dark' : 'light');
}

function init() {
  board = createBoard();
  score = 0;
  combo = 0;
  bestCombo = 0;
  hideRecordUI();
  lines = 0;
  level = 1;
  paused = false;
  gameOver = false;
  dropInterval = 1000;
  dropAccum = 0;
  lastTime = performance.now();
  next = randomPiece();
  spawn();
  updateHUD();
  overlay.classList.add('hidden');
  cancelAnimationFrame(animId);
  animId = requestAnimationFrame(loop);
}

document.addEventListener('keydown', e => {
  if (e.target && e.target.tagName === 'INPUT') return; // escribir el nombre no mueve piezas
  if (!started) {
    if (e.code === 'Enter' && !(e.target && e.target.tagName === 'BUTTON')) startGame();
    else if (e.code === 'KeyT') toggleTheme();
    return;
  }
  if (e.code === 'KeyP') { togglePause(); return; }
  if (e.code === 'KeyT') { toggleTheme(); return; }
  if (paused || gameOver) return;
  switch (e.code) {
    case 'ArrowLeft':
      if (!collide(current.shape, current.x - 1, current.y)) current.x--;
      break;
    case 'ArrowRight':
      if (!collide(current.shape, current.x + 1, current.y)) current.x++;
      break;
    case 'ArrowDown':
      softDrop();
      break;
    case 'ArrowUp':
    case 'KeyX':
      tryRotate();
      break;
    case 'Space':
      e.preventDefault();
      hardDrop();
      break;
  }
  updateHUD();
});

restartBtn.addEventListener('click', () => { restartBtn.blur(); init(); });
themeBtn.addEventListener('click', () => {
  toggleTheme();
  themeBtn.blur(); // evita que Espacio (caída) active el botón
});

setTheme(document.documentElement.dataset.theme || 'dark');

// ---- Tabla de records (localStorage) ----
const MAX_RECORDS = 5;
const startScreen = document.getElementById('start-screen');
const startRecordsEl = document.getElementById('start-records');
const startBtn = document.getElementById('start-btn');
const resetRecordsBtn = document.getElementById('reset-records-btn');
const overlayRecordsEl = document.getElementById('overlay-records');
const recordForm = document.getElementById('record-form');
const recordNameInput = document.getElementById('record-name');
let resetArmed = false;

function loadRecords() {
  try {
    const data = JSON.parse(localStorage.getItem('records'));
    if (!Array.isArray(data)) return [];
    return data.filter(r => r && typeof r.name === 'string' && Number.isFinite(r.score))
      .map(r => ({
        name: r.name.slice(0, 12),
        score: r.score,
        lines: Number.isFinite(r.lines) ? r.lines : 0,
        combo: Number.isFinite(r.combo) ? r.combo : 0,
        date: typeof r.date === 'string' ? r.date : '',
      }))
      .sort((a, b) => b.score - a.score).slice(0, MAX_RECORDS);
  } catch (e) { return []; }
}

function saveRecords(list) {
  try { localStorage.setItem('records', JSON.stringify(list)); } catch (e) {}
}

function loadRecordStats() {
  try {
    const s = JSON.parse(localStorage.getItem('recordStats')) || {};
    return { combo: Number.isFinite(s.combo) ? s.combo : 0, lines: Number.isFinite(s.lines) ? s.lines : 0 };
  } catch (e) { return { combo: 0, lines: 0 }; }
}

function updateRecordStats() {
  const s = loadRecordStats();
  s.combo = Math.max(s.combo, bestCombo);
  s.lines = Math.max(s.lines, lines);
  try { localStorage.setItem('recordStats', JSON.stringify(s)); } catch (e) {}
}

function qualifiesForTop(sc) {
  if (sc <= 0) return false;
  const list = loadRecords();
  return list.length < MAX_RECORDS || sc > list[list.length - 1].score;
}

function renderRecords(container, highlight) {
  container.textContent = '';
  const list = loadRecords();
  if (!list.length) {
    const p = document.createElement('p');
    p.className = 'records-empty';
    p.textContent = 'Aún no hay records';
    container.appendChild(p);
  } else {
    const table = document.createElement('table');
    table.className = 'records-table';
    const head = table.createTHead().insertRow();
    ['#', 'Nombre', 'Puntos', 'Líneas'].forEach(t => {
      const th = document.createElement('th');
      th.textContent = t;
      head.appendChild(th);
    });
    const body = table.createTBody();
    list.forEach((r, i) => {
      const tr = body.insertRow();
      if (highlight && r.date === highlight.date && r.score === highlight.score && r.name === highlight.name) {
        tr.className = 'new-record';
        highlight = null; // solo una fila
      }
      [i + 1, r.name || 'Jugador', r.score.toLocaleString(), r.lines].forEach(v => {
        tr.insertCell().textContent = v;
      });
    });
    container.appendChild(table);
  }
  const st = loadRecordStats();
  const p = document.createElement('p');
  p.className = 'records-stats';
  p.append('Mejor combo: ');
  const b1 = document.createElement('b'); b1.textContent = st.combo; p.append(b1);
  p.append(' · Líneas máx.: ');
  const b2 = document.createElement('b'); b2.textContent = st.lines; p.append(b2);
  container.appendChild(p);
}

function disarmReset() {
  resetArmed = false;
  resetRecordsBtn.textContent = 'Borrar records';
  resetRecordsBtn.classList.remove('confirm');
}

function showStartScreen() {
  disarmReset();
  renderRecords(startRecordsEl);
  startScreen.classList.remove('hidden');
}

function startGame() {
  started = true;
  startScreen.classList.add('hidden');
  init();
}

function hideRecordUI() {
  recordForm.classList.add('hidden');
  overlayRecordsEl.textContent = '';
}

function showGameOverRecords() {
  updateRecordStats();
  renderRecords(overlayRecordsEl);
  if (qualifiesForTop(score)) {
    recordForm.classList.remove('hidden');
    recordNameInput.value = '';
    setTimeout(() => { if (gameOver) recordNameInput.focus(); }, 500); // tras mostrar el overlay y soltar teclas
  } else {
    recordForm.classList.add('hidden');
  }
}

recordForm.addEventListener('submit', e => {
  e.preventDefault();
  if (!gameOver || !qualifiesForTop(score)) return;
  const entry = {
    name: recordNameInput.value.trim().slice(0, 12) || 'Jugador',
    score, lines, combo: bestCombo, date: new Date().toISOString(),
  };
  const list = loadRecords();
  list.push(entry);
  list.sort((a, b) => b.score - a.score);
  saveRecords(list.slice(0, MAX_RECORDS));
  recordForm.classList.add('hidden');
  renderRecords(overlayRecordsEl, entry);
  recordNameInput.blur(); // evita que Espacio active algun boton
});

startBtn.addEventListener('click', () => { startBtn.blur(); startGame(); });
resetRecordsBtn.addEventListener('click', () => {
  if (!resetArmed) {
    resetArmed = true;
    resetRecordsBtn.textContent = '¿Seguro? Pulsa de nuevo';
    resetRecordsBtn.classList.add('confirm');
    setTimeout(disarmReset, 4000);
    return;
  }
  try { localStorage.removeItem('records'); localStorage.removeItem('recordStats'); } catch (e) {}
  disarmReset();
  renderRecords(startRecordsEl);
  resetRecordsBtn.blur();
});
resetRecordsBtn.addEventListener('blur', disarmReset);

showStartScreen();
