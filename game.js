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

// In vertical (portrait) mode the board is taller than wide, so we swap the
// layout's cols/rows to keep cards comfortably sized (e.g. 8x4 becomes 4x8).
function effectiveDims() {
  const { cols, rows } = SIZES[currentSize];
  return window.innerHeight > window.innerWidth
    ? { cols: rows, rows: cols }
    : { cols, rows };
}
let currentSize = "small";
let currentSet = "random"; // "random" or "setN"
let selectedImages = [];    // selectedImages[logicalId-1] = actual image number (1..60)
let TOTAL_PAIRS = (SIZES[currentSize].cols * SIZES[currentSize].rows) / 2;
const IMAGE_BASE = "assets/";
const BACK_IMAGE = "assets/back.png";
const TOTAL_IMAGES = 72; // available card images: assets/01.jpg .. assets/72.jpg

// Per-set back coloring. The single blue back.png is recolored at runtime via
// a CSS hue-rotate filter, so every Set gets a distinct hue without generating
// extra image files. Keyed by set number (1..availableSets()). "random" keeps
// the default blue (filter "none").
const SET_BACK_FILTERS = {
  1: "hue-rotate(0deg)",     // blue
  2: "hue-rotate(40deg)",    // indigo (contrasts the green page bg)
  3: "hue-rotate(108deg)",   // magenta
  4: "hue-rotate(138deg)",   // red
  5: "hue-rotate(178deg)",   // orange
  6: "hue-rotate(200deg)",   // yellow
  7: "hue-rotate(-22deg)",   // cyan
  8: "hue-rotate(63deg)",    // purple
  9: "hue-rotate(123deg)",   // pink
};

const boardEl = document.getElementById("board");
const movesEl = document.getElementById("moves");
const avgEl = document.getElementById("avg");
const bestEl = document.getElementById("best");
const winOverlayEl = document.getElementById("win-overlay");
const winStatsEl = document.getElementById("win-stats");
const restartBtn = document.getElementById("restart");
const sizeSelect = document.getElementById("size-select");
const setSelect = document.getElementById("set-select");

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
  if (games === 0) return null;
  return Math.round((total / games) * 10) / 10;
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
  const state = { size: currentSize, deck, moves, images: selectedImages };
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

// ── Per-layout set (image-group) selection, persisted in localStorage ──
function setStorageKey(size) {
  return `mempair_set_${size}`;
}

function saveSetPreference(size, set) {
  localStorage.setItem(setStorageKey(size), set);
}

function loadSetPreference(size) {
  const set = localStorage.getItem(setStorageKey(size));
  const pairs = (SIZES[size].cols * SIZES[size].rows) / 2;
  const count = Math.floor(TOTAL_IMAGES / pairs);
  if (set === "random") return "random";
  if (set && set.startsWith("set")) {
    const k = parseInt(set.slice(3), 10);
    if (k >= 1 && k <= count) return set;
  }
  return null;
}

// Number of contiguous Set N groups that fit within TOTAL_IMAGES for the
// current layout. Each set is a block of TOTAL_PAIRS images.
function availableSets() {
  return Math.floor(TOTAL_IMAGES / TOTAL_PAIRS);
}

// Build the <option> list for the set dropdown based on the current layout.
function populateSetSelect() {
  const count = availableSets();
  setSelect.innerHTML = "";
  const randomOpt = document.createElement("option");
  randomOpt.value = "random";
  randomOpt.textContent = "Random";
  setSelect.appendChild(randomOpt);
  for (let k = 1; k <= count; k++) {
    const opt = document.createElement("option");
    opt.value = `set${k}`;
    opt.textContent = `Set ${k}`;
    setSelect.appendChild(opt);
  }
}

// Map logical pair ids (1..TOTAL_PAIRS) to actual image numbers (1..60).
function computeSelectedImages(setKey) {
  const arr = new Array(TOTAL_PAIRS);
  if (setKey === "random") {
    const pool = [];
    for (let i = 1; i <= TOTAL_IMAGES; i++) pool.push(i);
    for (let i = pool.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [pool[i], pool[j]] = [pool[j], pool[i]];
    }
    for (let i = 0; i < TOTAL_PAIRS; i++) arr[i] = pool[i];
  } else {
    const k = parseInt(setKey.slice(3), 10);
    const start = (k - 1) * TOTAL_PAIRS + 1;
    for (let i = 0; i < TOTAL_PAIRS; i++) arr[i] = start + i;
  }
  return arr;
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

function createCard(id, imageNumber) {
  const card = document.createElement("button");
  card.className = "card";
  card.type = "button";
  card.dataset.id = id;
  card.dataset.image = imageNumber;

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
  frontImg.src = `${IMAGE_BASE}${pad(imageNumber)}.jpg`;
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
  const { cols, rows } = effectiveDims();
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

// Apply the per-set back color by setting a CSS hue-rotate filter on the
// single back.png. "random" (or any unknown set) leaves it default blue.
function applyBackColor() {
  let filter = "none";
  if (currentSet && currentSet.startsWith("set")) {
    const k = parseInt(currentSet.slice(3), 10);
    filter = SET_BACK_FILTERS[k] || "none";
  }
  document.documentElement.style.setProperty("--back-filter", filter);
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

  // Resolve the image-set selection (falls back to Random) and build the UI.
  const storedSet = loadSetPreference(currentSize);
  currentSet = storedSet || "random";
  populateSetSelect();
  setSelect.value = currentSet;
  applyBackColor();

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
    selectedImages = (saved.images && saved.images.length === TOTAL_PAIRS)
      ? saved.images
      : computeSelectedImages(currentSet);
    boardEl.innerHTML = "";
    saved.deck.forEach((item) => {
      const card = createCard(item.id, item.image);
      if (item.matched) card.classList.add("matched");
      boardEl.appendChild(card);
    });
    moves = saved.moves || 0;
    matched = saved.deck.filter((item) => item.matched).length;
    movesEl.textContent = moves;
  } else {
    selectedImages = computeSelectedImages(currentSet);
    const deck = buildDeck();
    boardEl.innerHTML = "";
    deck.forEach((id) => boardEl.appendChild(createCard(id, selectedImages[id - 1])));
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
setSelect.addEventListener("change", (e) => {
  currentSet = e.target.value;
  saveSetPreference(currentSize, currentSet);
  clearState();
  init();
});
init();

// Keep cards at BASE_CARD on desktop; scale down only when the viewport is too narrow.
window.addEventListener("resize", applyLayout);
