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

- `index.html` — static markup: header (moves/pairs/time stats + Restart button), `#board` grid container, and a `#win-overlay` full-screen win dialog (h2 + `#win-stats` + `#play-again` button). Loads `style.css` and `game.js`.
- `style.css` — 4x4 CSS grid (`.board`), 3D flip via `perspective` + `transform-style: preserve-3d` + `rotateY(180deg)`, faces use `backface-visibility: hidden`. Card sizing is driven by the `--card-size`/`--gap`/`--radius` custom properties.
- `game.js` — self-contained, no modules. Builds a shuffled deck, renders `<button class="card">` elements, and handles click -> flip -> match evaluation.

## Game logic (game.js)

- 16 cards = 8 image pairs, shuffled (Fisher-Yates) each `init()`.
- Click flow: first card sets `firstCard`; second click increments `moves`, then `evaluate()`. Clicks are handled by a single delegated listener on `#board` (plus a `document` listener for clicks outside the board) rather than per-card listeners.
- Match: both cards get `.matched` (CSS hides them via `visibility: hidden` + fade) and `matched` counter increments.
- Match OR mismatch: after the second card is chosen, `evaluate()` sets `pendingPair` (the two revealed cards + an `isMatch` flag) and leaves them face up. Nothing is removed or flipped back automatically. The next click anywhere (a card, empty board space, or outside the board) calls `dismissPending()`: for a match it adds `.matched` (cards removed/faded out, `matched` counter increments, win checked); for a mismatch it removes `.flipped` (both turn back down). That dismissing click does NOTHING else, it does not flip the clicked card up or start a new turn. The player clicks again to choose the next card. A single already-revealed card (no second chosen yet) is never auto-dismissed.
- Win: when `matched === TOTAL_PAIRS`, `endGame()` stops the timer, fills `#win-stats` with `Moves:`/`Time:`, and adds `.show` to `#win-overlay` (full-screen dark overlay, same style as Yukon's `#win-overlay`). The `#play-again` button and the header Restart button both call `init()`, which removes `.show`.
- Timer starts on the first card flip, not on page load.

## Conventions / gotchas

- Front images are referenced by zero-padded two-digit id: `assets/01.jpg` .. `assets/08.jpg`. The `pad(id)` helper in `game.js` builds the filename, so image files MUST be named with leading zeros (e.g. `07.jpg`, not `7.jpg`).
- The number of pairs is NOT derived from the assets folder. `TOTAL_PAIRS = 8` in `game.js` and `grid-template-columns: repeat(4, ...)` in `style.css` are both hardcoded. To change the grid (e.g. 6x6 = 18 pairs), you must edit all three: add the image files, `TOTAL_PAIRS`, and the CSS column count.
- Cards are `<button>` elements (keyboard accessible, no extra ARIA needed). Clicking the already-flipped or already-matched card is ignored.
- The backside (`assets/back.png`) is a generated artifact, not source. Rounded corners are baked into the PNG transparency; the front faces get rounded corners purely from CSS `border-radius`. Keep the two radii in sync if you change `--radius` vs the `48` radius used at generation time.
- `frontImg.alt` uses `pair ${id}`; `backImg.alt` is `"card back"`.
