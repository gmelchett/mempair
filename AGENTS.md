# AGENTS.md

Vanilla HTML/CSS/JS memory-pair (concentration) game. No build step, no dependencies, no package manager. Open `index.html` directly in a browser to play.

## Commands

There is no build, test, or lint tooling. To run the game:

- Serve statically or just open the file: open `index.html` in a browser (images use relative paths, so `file://` works with no server).

To regenerate the card backside image (`assets/back.png`):

```bash
magick -size 400x400 -colorspace sRGB gradient:"#2b6cb0-#1a365d" gradient.png
magick -size 400x400 xc:black -fill white -draw "roundrectangle 0,0,399,399,48,48" mask.png
magick gradient.png mask.png -compose copy_opacity -composite step1.png
magick step1.png \( -size 200x200 xc:none -fill "#ffffff55" -draw "circle 100,100 100,8" \) -gravity center -composite assets/back.png
rm gradient.png mask.png step1.png
```

Notes on the above: ImageMagick's `-flatten` step collapses color to grayscale, so the file is built from `gradient.png` + a white rounded-rect mask via `copy_opacity` and saved as TrueColorAlpha. Corners are transparent (not a solid color), so the backside only looks right over a non-image card face.

## Architecture

- `index.html` — static markup: header (Moves and Avg stats + Restart button), `#board` grid container, and a `#win-overlay` full-screen win dialog (h2 + `#win-stats` + `#play-again` button). Loads `style.css` and `game.js`.
- `style.css` — 4x4 CSS grid (`.board`), 3D flip via `perspective` + `transform-style: preserve-3d` + `rotateY(180deg)`, faces use `backface-visibility: hidden`. Card sizing is driven by the `--card-size`/`--gap`/`--radius` custom properties.
- `game.js` — self-contained, no modules. Builds a shuffled deck, renders `<button class="card">` elements, and handles click -> flip -> match evaluation.

## Game logic (game.js)

- 16 cards = 8 image pairs, shuffled (Fisher-Yates) each `init()`.
- Click flow: first card sets `firstCard`; second click increments `moves`, then `evaluate()`. Clicks are handled by a single delegated listener on `#board` (plus a `document` listener for clicks outside the board) rather than per-card listeners.
- Match: both cards get `.matched` (CSS hides them via `visibility: hidden` + fade) and `matched` counter increments.
- Match OR mismatch: after the second card is chosen, `evaluate()` sets `pendingPair` (the two revealed cards + an `isMatch` flag) and leaves them face up. Nothing is removed or flipped back automatically. The next click anywhere (a card, empty board space, or outside the board) calls `dismissPending()`: for a match it adds `.matched` (cards removed/faded out, `matched` counter increments, win checked); for a mismatch it removes `.flipped` (both turn back down). That dismissing click does NOTHING else, it does not flip the clicked card up or start a new turn. The player clicks again to choose the next card. A single already-revealed card (no second chosen yet) is never auto-dismissed.
- Win: when `matched === TOTAL_PAIRS`, `endGame()` records per-size stats to cookie `mempair_moves` (JSON `{small: {games, total, best}, medium: {...}, ...}`), refreshes the header `Avg` and `Best`, fills `#win-stats` with `Moves:`/`Average:`/`Best:`, and adds `.show` to `#win-overlay`. The `#play-again` button and the header Restart button both call `init()`, which removes `.show`.
- `Avg` and `Best` are tracked per board size. The header stats update automatically when switching sizes.
- There is deliberately NO timer; `Avg` (running average of moves to solve) is the only cross-game metric.
- Game state (board size, card layout, matched positions, and move count) persists via a `mempair_state` cookie. On page load, `init()` checks for a saved state and restores the board if found. State is saved after each move and each confirmed match. The state is cleared on win, restart, play-again, or size change, triggering a fresh shuffled deck. If the browser is closed mid-game (e.g. while a mismatched pair is showing), that pending pair is lost but all previously matched cards and the move count are restored.

## Conventions / gotchas

- Front images are referenced by zero-padded two-digit id: `assets/01.jpg` .. `assets/08.jpg`. The `pad(id)` helper in `game.js` builds the filename, so image files MUST be named with leading zeros (e.g. `07.jpg`, not `7.jpg`).
- Board size is selectable via the `#size-select` dropdown in `index.html` (Small 4x4, Medium 4x8, Large 6x8, X-Large 6x12). The `SIZES` map in `game.js` defines `{ cols, rows }` per option; `TOTAL_PAIRS` is derived as `cols*rows/2` and the grid's `--cols`/`--card-size` CSS vars are set from the selected preset (card size stays at BASE_CARD on desktop, scaling down only when the viewport is too narrow). Adding a new size means: add image files, add an `<option>` to the select, and add an entry to `SIZES`. The number of pairs is NOT derived from the assets folder, so the largest size must not exceed the number of available images (assets/01.jpg .. assets/NN.jpg).
- Cards are `<button>` elements (keyboard accessible, no extra ARIA needed). Clicking the already-flipped or already-matched card is ignored.
- The backside (`assets/back.png`) is a generated artifact, not source. Rounded corners are baked into the PNG transparency; the front faces get rounded corners purely from CSS `border-radius`. Keep the two radii in sync if you change `--radius` vs the `48` radius used at generation time.
- The `Avg` and `Best` stats persist per size via `document.cookie` (`mempair_moves` = JSON `{small: {games, total, best}, ...}`, 1-year max-age, `path=/`). Game state persists via a separate `mempair_state` cookie (same expiry). Browsers do NOT persist cookies on `file://` origins (Chromium silently drops them), so persistence only works when the page is served over `http(s)` (e.g. `python3 -m http.server`). Opening `index.html` directly still works for playing, but cookies reset each load.
