// Memory Pair game logic.
// Board size is selectable (see SIZES); cards use assets/01.jpg .. assets/NN.jpg.

// Board size presets: { cols, rows }. Pairs = cols*rows/2.
const SIZES = {
  small:  { cols: 4, rows: 4 },
  medium: { cols: 8, rows: 4 },
  large:  { cols: 8, rows: 6 },
  xlarge: { cols: 12, rows: 6 },
};
const BASE_CARD = 110;   // preferred card size on desktop
const MIN_CARD = 48;     // smallest a card may shrink to
let currentSize = "small";
let TOTAL_PAIRS = (SIZES[currentSize].cols * SIZES[currentSize].rows) / 2;
const IMAGE_BASE = "assets/";
const BACK_IMAGE = "assets/back.png";

const boardEl = document.getElementById("board");
const movesEl = document.getElementById("moves");
const avgEl = document.getElementById("avg");
const bestEl = document.getElementById("best");
const winOverlayEl = document.getElementById("win-overlay");
const winStatsEl = document.getElementById("win-stats");
const restartBtn = document.getElementById("restart");
const sizeSelect = document.getElementById("size-select");

let firstCard = null;
let secondCard = null;
let pendingPair = null; // { first, second, isMatch } while a revealed pair awaits dismissal
let moves = 0;
let matched = 0;
let gameOver = false;

// ── Persistent per-size stats (stored in localStorage) ──
function readStats() {
  try {
    return JSON.parse(localStorage.getItem('mempair_moves')) || {};
  } catch { return {}; }
}

function getStatsForSize(size) {
  const all = readStats();
  return all[size] || { games: 0, total: 0, best: null };
}

function writeStats(all) {
  localStorage.setItem('mempair_moves', JSON.stringify(all));
}

function averageMoves() {
  const { games, total } = getStatsForSize(currentSize);
  return games > 0 ? Math.round(total / games) : null;
}

function bestMoves() {
  const { best } = getStatsForSize(currentSize);
  return best;
}

function renderStats() {
  const avg = averageMoves();
  avgEl.textContent = avg === null ? "-" : avg;
  const best = bestMoves();
  bestEl.textContent = best === null ? "-" : best;
}

function saveState() {
  const deck = [];
  boardEl.querySelectorAll(".card").forEach((card) => {
    deck.push({
      id: parseInt(card.dataset.id),
      matched: card.classList.contains("matched"),
    });
  });
  const state = { size: currentSize, deck, moves };
  localStorage.setItem('mempair_state', JSON.stringify(state));
}

function loadState() {
  try {
    return JSON.parse(localStorage.getItem('mempair_state'));
  } catch { return null; }
}

function clearState() {
  localStorage.removeItem('mempair_state');
}

function saveSizePreference(size) {
  localStorage.setItem('mempair_size', size);
}

function loadSizePreference() {
  const size = localStorage.getItem('mempair_size');
  return (size && SIZES[size]) ? size : null;
}

function pad(n) {
  return n.toString().padStart(2, "0");
}

// Build a shuffled deck: each image id appears twice.
function buildDeck() {
  const deck = [];
  for (let id = 1; id <= TOTAL_PAIRS; id++) {
    deck.push(id, id);
  }
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  return deck;
}

function createCard(id) {
  const card = document.createElement("button");
  card.className = "card";
  card.type = "button";
  card.dataset.id = id;

  const inner = document.createElement("div");
  inner.className = "card-inner";

  const back = document.createElement("div");
  back.className = "face back";
  const backImg = document.createElement("img");
  backImg.src = BACK_IMAGE;
  backImg.alt = "card back";
  back.appendChild(backImg);

  const front = document.createElement("div");
  front.className = "face front";
  const frontImg = document.createElement("img");
  frontImg.src = `${IMAGE_BASE}${pad(id)}.jpg`;
  frontImg.alt = `pair ${id}`;
  front.appendChild(frontImg);

  inner.append(back, front);
  card.appendChild(inner);
  return card;
}

function dismissPending() {
  if (!pendingPair) return;
  if (pendingPair.isMatch) {
    // Matched pair: remove both cards from play.
    pendingPair.first.classList.add("matched");
    pendingPair.second.classList.add("matched");
    matched++;
    if (matched === TOTAL_PAIRS) endGame();
    if (!gameOver) saveState();
  } else {
    // Mismatched pair: turn both back face down.
    pendingPair.first.classList.remove("flipped");
    pendingPair.second.classList.remove("flipped");
  }
  pendingPair = null;
}

// Delegated click handling on the board.
boardEl.addEventListener("click", (event) => {
  const card = event.target.closest(".card");

  // If a revealed pair is still showing, the next click only dismisses it
  // (match -> removed, mismatch -> face down). It does not also flip up the
  // clicked card or start a new turn.
  if (pendingPair) {
    dismissPending();
    return;
  }

  if (!card) return;
  handleCard(card);
});

// Clicking anywhere outside the board also dismisses a shown pair.
document.addEventListener("click", (event) => {
  if (pendingPair && !event.target.closest(".board")) {
    dismissPending();
  }
});

function handleCard(card) {
  if (card.classList.contains("matched") || card.classList.contains("flipped")) return;
  if (card === firstCard) return;

  card.classList.add("flipped");

  if (!firstCard) {
    firstCard = card;
    return;
  }

  secondCard = card;
  moves++;
  movesEl.textContent = moves;
  saveState();
  evaluate();
}

function evaluate() {
  const isMatch = firstCard.dataset.id === secondCard.dataset.id;
  // Leave the revealed pair showing; wait for a click to dismiss it
  // (mismatch flips back down, match gets removed). See dismissPending().
  pendingPair = { first: firstCard, second: secondCard, isMatch };
  firstCard = null;
  secondCard = null;
}

function endGame() {
  gameOver = true;
  const all = readStats();
  const sizeStats = all[currentSize] || { games: 0, total: 0, best: null };
  sizeStats.games += 1;
  sizeStats.total += moves;
  if (sizeStats.best === null || moves < sizeStats.best) {
    sizeStats.best = moves;
  }
  all[currentSize] = sizeStats;
  writeStats(all);
  renderStats();
  const avg = averageMoves();
  const best = bestMoves();
  winStatsEl.textContent =
    `Moves: ${moves}` +
    (avg === null ? "" : `   Average: ${avg}`) +
    (best === null ? "" : `   Best: ${best}`);
  winOverlayEl.classList.add("show");
  clearState();
}

function applyLayout() {
  const { cols, rows } = SIZES[currentSize];
  const gap = parseInt(
    getComputedStyle(document.documentElement).getPropertyValue("--gap")
  ) || 12;
  const headerH = document.getElementById("header").offsetHeight;
  const availW = window.innerWidth - 32;            // body side padding/margins
  const availH = window.innerHeight - headerH - 64; // header + board margins + breathing room
  const byWidth = Math.floor((availW - (cols - 1) * gap) / cols);
  const byHeight = Math.floor((availH - (rows - 1) * gap) / rows);
  const card = Math.max(MIN_CARD, Math.min(BASE_CARD, byWidth, byHeight));
  boardEl.style.setProperty("--card-size", card + "px");
  boardEl.style.gridTemplateColumns = `repeat(${cols}, ${card}px)`;
  boardEl.style.gridAutoRows = `${card}px`;
}

function init() {
  const saved = loadState();
  if (saved && SIZES[saved.size]) {
    currentSize = saved.size;
    sizeSelect.value = currentSize;
  } else {
    const preferred = loadSizePreference();
    if (preferred) {
      currentSize = preferred;
      sizeSelect.value = currentSize;
    }
  }
  const { cols, rows } = SIZES[currentSize];
  TOTAL_PAIRS = (cols * rows) / 2;
  applyLayout();
  winOverlayEl.classList.remove("show");
  firstCard = null;
  secondCard = null;
  pendingPair = null;
  moves = 0;
  matched = 0;
  gameOver = false;
  movesEl.textContent = "0";
  renderStats();

  if (saved && saved.deck && saved.deck.length === cols * rows) {
    boardEl.innerHTML = "";
    saved.deck.forEach((item) => {
      const card = createCard(item.id);
      if (item.matched) card.classList.add("matched");
      boardEl.appendChild(card);
    });
    moves = saved.moves || 0;
    matched = saved.deck.filter((item) => item.matched).length;
    movesEl.textContent = moves;
  } else {
    const deck = buildDeck();
    boardEl.innerHTML = "";
    deck.forEach((id) => boardEl.appendChild(createCard(id)));
    saveState();
  }
}

restartBtn.addEventListener("click", () => {
  clearState();
  init();
});
document.getElementById("play-again").addEventListener("click", () => {
  clearState();
  init();
});
sizeSelect.addEventListener("change", (e) => {
  currentSize = e.target.value;
  saveSizePreference(currentSize);
  clearState();
  init();
});
init();

// Keep cards at BASE_CARD on desktop; scale down only when the viewport is too narrow.
window.addEventListener("resize", applyLayout);
