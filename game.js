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

// ---- Skins ----
// colors[0] = null (alineado con PIECES). boardBg/grid null => usa los del tema.
function roundRectPath(context, x, y, w, h, r) {
  context.beginPath();
  context.moveTo(x + r, y);
  context.lineTo(x + w - r, y);
  context.quadraticCurveTo(x + w, y, x + w, y + r);
  context.lineTo(x + w, y + h - r);
  context.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  context.lineTo(x + r, y + h);
  context.quadraticCurveTo(x, y + h, x, y + h - r);
  context.lineTo(x, y + r);
  context.quadraticCurveTo(x, y, x + r, y);
  context.closePath();
}

const SKINS = {
  retro: {
    label: 'Retro',
    colors: COLORS,
    boardBg: null,
    grid: null,
    drawCell(context, px, py, size, color, alpha) {
      context.globalAlpha = alpha;
      context.fillStyle = color;
      context.fillRect(px + 1, py + 1, size - 2, size - 2);
      context.fillStyle = 'rgba(255,255,255,0.12)';
      context.fillRect(px + 1, py + 1, size - 2, 4);
      context.globalAlpha = 1;
    },
  },
  neon: {
    label: 'Neón',
    colors: [null, '#00f0ff', '#fff200', '#d400ff', '#39ff14', '#ff1744', '#4d7cff', '#ff9100'],
    boardBg: '#000000',
    grid: '#1a1a22',
    drawCell(context, px, py, size, color, alpha) {
      context.globalAlpha = alpha;
      context.shadowColor = color;
      context.shadowBlur = 12;
      context.strokeStyle = color;
      context.lineWidth = 2;
      context.strokeRect(px + 3, py + 3, size - 6, size - 6);
      context.fillStyle = color;
      context.globalAlpha = alpha * 0.35;
      context.fillRect(px + 3, py + 3, size - 6, size - 6);
      context.shadowBlur = 0;
      context.shadowColor = 'transparent';
      context.globalAlpha = 1;
    },
  },
  pastel: {
    label: 'Pastel',
    colors: [null, '#a8e6ef', '#fff1b8', '#d9b8ec', '#b9e4bf', '#f7b8b8', '#b8d4f5', '#ffd6a5'],
    boardBg: null,
    grid: null,
    drawCell(context, px, py, size, color, alpha) {
      context.globalAlpha = alpha;
      context.fillStyle = color;
      roundRectPath(context, px + 2, py + 2, size - 4, size - 4, 8);
      context.fill();
      context.fillStyle = 'rgba(255,255,255,0.45)';
      roundRectPath(context, px + 6, py + 5, size - 12, 5, 2.5);
      context.fill();
      context.globalAlpha = 1;
    },
  },
  pixel: {
    label: 'Pixel art',
    colors: [null, '#29b6f6', '#fdd835', '#ab47bc', '#66bb6a', '#ef5350', '#5c6bc0', '#ff9800'],
    boardBg: null,
    grid: null,
    drawCell(context, px, py, size, color, alpha) {
      const u = size / 6; // "píxel" grande de la textura
      context.globalAlpha = alpha;
      context.fillStyle = color;
      context.fillRect(px, py, size, size);
      // sombra (abajo/derecha) y luz (arriba/izquierda)
      context.fillStyle = 'rgba(0,0,0,0.35)';
      context.fillRect(px, py + size - u, size, u);
      context.fillRect(px + size - u, py, u, size);
      context.fillStyle = 'rgba(255,255,255,0.4)';
      context.fillRect(px, py, size, u);
      context.fillRect(px, py, u, size);
      // patrón de damero interior
      context.fillStyle = 'rgba(0,0,0,0.15)';
      for (let i = 1; i < 5; i++)
        for (let j = 1; j < 5; j++)
          if ((i + j) % 2 === 0) context.fillRect(px + i * u, py + j * u, u, u);
      context.globalAlpha = 1;
    },
  },
};
const SKIN_NAMES = Object.keys(SKINS);
let currentSkin = 'retro';
let surfaceColor = '#1a1a25';

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
const pauseMenu = document.getElementById('pause-menu');
const pmItems = [
  document.getElementById('pm-resume'),
  document.getElementById('pm-restart'),
  document.getElementById('pm-controls'),
  document.getElementById('pm-level-row'),
];
const pmControlsList = document.getElementById('pm-controls-list');
const pmLevel = document.getElementById('pm-level');
const skinSelect = document.getElementById('skin-select');

let gridColor = '#22222e';
let startLevel = 1, pmIndex = 0, resumeGuardUntil = 0;
let combo = 0, bestCombo = 0, started = false;
let board, current, next, score, lines, level, paused, gameOver, lastTime, dropAccum, dropInterval, animId;

function intervalFor(lvl) {
  return Math.max(100, 1000 - (lvl - 1) * 90);
}

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
    level = startLevel + Math.floor(lines / 10);
    dropInterval = intervalFor(level);
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
  const skin = SKINS[currentSkin];
  skin.drawCell(context, x * size, y * size, size, skin.colors[colorIndex], alpha ?? 1);
}

function paintBackground(context, w, h) {
  context.clearRect(0, 0, w, h);
  context.fillStyle = SKINS[currentSkin].boardBg || surfaceColor;
  context.fillRect(0, 0, w, h);
}

function drawGrid() {
  ctx.strokeStyle = SKINS[currentSkin].grid || gridColor;
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
  paintBackground(ctx, canvas.width, canvas.height);
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
  paintBackground(nextCtx, nextCanvas.width, nextCanvas.height);
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
    closePauseMenu();
    resumeGuardUntil = performance.now() + 400; // ignora teclas retenidas al volver
    lastTime = performance.now();
    loop(lastTime);
  } else {
    cancelAnimationFrame(animId);
    openPauseMenu();
  }
}

// ---- Menú de pausa ----
function loadStartLevel() {
  let v = NaN;
  try { v = parseInt(localStorage.getItem('startLevel'), 10); } catch (e) {}
  startLevel = v >= 1 && v <= 10 ? v : 1;
}

function setPmIndex(i) {
  pmIndex = (i + pmItems.length) % pmItems.length;
  pmItems.forEach((el, n) => el.classList.toggle('selected', n === pmIndex));
}

function openPauseMenu() {
  pmLevel.value = String(startLevel);
  pmControlsList.classList.add('hidden');
  pmItems[2].setAttribute('aria-expanded', 'false');
  setPmIndex(0);
  pauseMenu.classList.remove('hidden');
}

function closePauseMenu() {
  pauseMenu.classList.add('hidden');
  if (document.activeElement && document.activeElement.blur) document.activeElement.blur();
}

function resumeGame() {
  if (paused && !gameOver) togglePause();
}

function activatePmItem(i) {
  if (i === 0) resumeGame();
  else if (i === 1) init();
  else if (i === 2) {
    const open = pmControlsList.classList.toggle('hidden') === false;
    pmItems[2].setAttribute('aria-expanded', String(open));
  }
}

function setStartLevel(v) {
  startLevel = Math.min(10, Math.max(1, v));
  pmLevel.value = String(startLevel);
  try { localStorage.setItem('startLevel', String(startLevel)); } catch (e) {}
}

// Devuelve true si la tecla fue consumida por el menú
function handleMenuKey(e) {
  if (!paused || gameOver || pauseMenu.classList.contains('hidden')) return false;
  switch (e.code) {
    case 'Escape': case 'KeyP': resumeGame(); break;
    case 'ArrowUp': setPmIndex(pmIndex - 1); break;
    case 'ArrowDown': setPmIndex(pmIndex + 1); break;
    case 'ArrowLeft': if (pmIndex === 3) setStartLevel(startLevel - 1); break;
    case 'ArrowRight': if (pmIndex === 3) setStartLevel(startLevel + 1); break;
    case 'Enter': case 'NumpadEnter': if (!e.repeat) activatePmItem(pmIndex); break;
    default: return false;
  }
  e.preventDefault();
  return true;
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
  const cs = getComputedStyle(document.documentElement);
  gridColor = cs.getPropertyValue('--grid').trim();
  surfaceColor = cs.getPropertyValue('--surface').trim() || surfaceColor;
  if (current) { draw(); drawNext(); }
}

function toggleTheme() {
  setTheme(document.documentElement.dataset.theme === 'light' ? 'dark' : 'light');
}

function setSkin(name) {
  if (!SKINS[name]) name = 'retro';
  currentSkin = name;
  try { localStorage.setItem('skin', name); } catch (e) {}
  skinSelect.value = name;
  if (current) { draw(); drawNext(); }
}

function cycleSkin() {
  setSkin(SKIN_NAMES[(SKIN_NAMES.indexOf(currentSkin) + 1) % SKIN_NAMES.length]);
}

function init() {
  board = createBoard();
  score = 0;
  combo = 0;
  bestCombo = 0;
  hideRecordUI();
  lines = 0;
  level = startLevel;
  paused = false;
  gameOver = false;
  dropInterval = intervalFor(level);
  dropAccum = 0;
  lastTime = performance.now();
  next = randomPiece();
  spawn();
  updateHUD();
  overlay.classList.add('hidden');
  closePauseMenu();
  resumeGuardUntil = performance.now() + 400;
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
  if (handleMenuKey(e)) return;
  if (e.code === 'KeyP' || e.code === 'Escape') { if (!e.repeat) togglePause(); return; }
  if (e.code === 'KeyT') { toggleTheme(); return; }
  if (e.code === 'KeyK') { if (!e.repeat && !e.ctrlKey && !e.metaKey && !e.altKey) cycleSkin(); return; }
  if (paused || gameOver) return;
  if (performance.now() < resumeGuardUntil) { if (e.code === 'Space') e.preventDefault(); return; }
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
for (let n = 1; n <= 10; n++) pmLevel.add(new Option(String(n), String(n)));
pmItems.forEach((el, n) => el.addEventListener('click', e => {
  if (e.target === pmLevel) return;
  setPmIndex(n);
  activatePmItem(n);
  if (el.blur) el.blur();
}));
pmLevel.addEventListener('change', () => { setStartLevel(parseInt(pmLevel.value, 10)); pmLevel.blur(); });
themeBtn.addEventListener('click', () => {
  toggleTheme();
  themeBtn.blur(); // evita que Espacio (caída) active el botón
});

skinSelect.innerHTML = SKIN_NAMES.map(n => `<option value="${n}">${SKINS[n].label}</option>`).join('');
skinSelect.addEventListener('change', () => {
  setSkin(skinSelect.value);
  skinSelect.blur(); // evita que Espacio (caída) cambie el selector
});

setTheme(document.documentElement.dataset.theme || 'dark');
loadStartLevel();
{
  let saved = null;
  try { saved = localStorage.getItem('skin'); } catch (e) {}
  setSkin(SKINS[saved] ? saved : 'retro');
}

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
