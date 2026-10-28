# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

Vanilla JS Tetris (HTML5 Canvas). No dependencies, no build step, no tests, no linter, no `package.json`. The README and UI strings are in Spanish; keep user-facing text in Spanish.

## Running

Open `index.html` directly, or serve statically: `python3 -m http.server 8000` then visit `http://localhost:8000`.

## Architecture

Three files: `index.html` (DOM + two canvases: `#board` 300×600 and `#next-canvas`, HUD, `#overlay`), `style.css`, and `game.js` (all logic, ~300 lines, one script, `'use strict'`, no modules).

`game.js` details that span the file:

- **Global mutable state**: `board, current, next, score, lines, level, paused, gameOver, lastTime, dropAccum, dropInterval, animId` are declared together with `let` and reset in `init()`. Restart is just `init()` again (it cancels the pending animation frame first).
- **Board/piece encoding**: the board is a `ROWS×COLS` matrix of `0` or a color index 1–7. Piece shapes in `PIECES` embed their own index as the cell value, so `COLORS[index]` and `PIECES[index]` must stay aligned (index 0 is `null` in both). `randomPiece()` picks uniformly from 1–7 (no bag).
- **Game loop**: `loop(ts)` is `requestAnimationFrame`-based; it accumulates `dropAccum` and does gravity when it exceeds `dropInterval`, then `draw()`. Pausing and game over stop the loop via `cancelAnimationFrame`; unpausing restarts it with a fresh `lastTime`.
- **Piece lifecycle**: `lockPiece()` → `merge()` → `clearLines()` → `spawn()`. `spawn()` promotes `next` to `current` and ends the game if the new piece collides immediately.
- **Scoring/speed** lives in `clearLines()` (line table × level, level = `startLevel + floor(lines/10)`, `dropInterval = intervalFor(level)` = `max(100, 1000 − (level−1)·90)`) and in `softDrop`/`hardDrop` (+1 / +2 per cell). Gravity in `loop` does not award points.
- **Rotation**: `rotateCW` returns a new matrix; `tryRotate` tries horizontal kicks `[0, -1, 1, -2, 2]` only (no vertical kicks, no SRS).
- **Pause menu**: `#pause-menu` (separate from `#overlay`, which is only GAME OVER). `togglePause()` opens/closes it; `handleMenuKey(e)` runs first in the `keydown` listener and consumes keys while it is open (↑/↓/Enter/←/→, Escape/P close). After resuming, `resumeGuardUntil` ignores game keys for 400 ms. `startLevel` (1–10, `localStorage['startLevel']`) is the base level: `init()` uses it for `level`/`dropInterval`, and `clearLines()` computes `level = startLevel + floor(lines/10)`.
- **Input**: single `keydown` listener using `e.code`; `KeyP` works while paused, everything else is ignored when `paused || gameOver` (while the pause menu is open `handleMenuKey` takes over first).

## Gotchas

- Changing `COLS`, `ROWS`, or `BLOCK` requires manually updating the `width`/`height` attributes of `<canvas id="board">` in `index.html` (`COLS×BLOCK` by `ROWS×BLOCK`). The next-piece canvas assumes a 4×4 grid of 30px blocks (`drawNext`).
