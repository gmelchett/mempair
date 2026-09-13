// Memory Pair game logic.
// 8 image pairs (assets/01.jpg .. assets/08.jpg) -> 16 cards in a 4x4 grid.

const TOTAL_PAIRS = 8;
const IMAGE_BASE = "assets/";
const BACK_IMAGE = "assets/back.png";

const boardEl = document.getElementById("board");
const movesEl = document.getElementById("moves");
const pairsEl = document.getElementById("pairs");
const timeEl = document.getElementById("time");
const winOverlayEl = document.getElementById("win-overlay");
const winStatsEl = document.getElementById("win-stats");
const restartBtn = document.getElementById("restart");

let firstCard = null;
let secondCard = null;
let pendingPair = null; // { first, second, isMatch } while a revealed pair awaits dismissal
let moves = 0;
let matched = 0;
let timerId = null;
let startTime = 0;

function pad(n) {
  return n.toString().padStart(2, "0");
}

function formatTime(ms) {
  const total = Math.floor(ms / 1000);
  return `${Math.floor(total / 60)}:${pad(total % 60)}`;
}

function startTimer() {
  if (timerId) return;
  startTime = Date.now();
  timerId = setInterval(() => {
    timeEl.textContent = formatTime(Date.now() - startTime);
  }, 500);
}

function stopTimer() {
  clearInterval(timerId);
  timerId = null;
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
    pairsEl.textContent = matched;
    if (matched === TOTAL_PAIRS) endGame();
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

  startTimer();
  card.classList.add("flipped");

  if (!firstCard) {
    firstCard = card;
    return;
  }

  secondCard = card;
  moves++;
  movesEl.textContent = moves;
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
  stopTimer();
  winStatsEl.textContent = `Moves: ${moves}   Time: ${formatTime(Date.now() - startTime)}`;
  winOverlayEl.classList.add("show");
}

function init() {
  stopTimer();
  boardEl.innerHTML = "";
  winOverlayEl.classList.remove("show");
  firstCard = null;
  secondCard = null;
  pendingPair = null;
  moves = 0;
  matched = 0;
  movesEl.textContent = "0";
  pairsEl.textContent = "0";
  timeEl.textContent = "0:00";

  const deck = buildDeck();
  deck.forEach((id) => boardEl.appendChild(createCard(id)));
}

restartBtn.addEventListener("click", init);
document.getElementById("play-again").addEventListener("click", init);
init();
