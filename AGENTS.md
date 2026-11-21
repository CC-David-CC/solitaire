# Solitaire Table — Agent Guidelines & 2026 Display Architecture

## Role and Scope
This repository (`apps/solitaire/`) owns the desktop-native Klondike Solitaire implementation for WebOS. It is an independent Git submodule. All code, tests, styles, and assets must remain self-contained within this directory. Do not introduce external CDN dependencies or rely on parent-level tooling.

---

## 3-Tier Responsive Display Architecture

Solitaire must adapt seamlessly across three distinct display tiers based on window and screen dimensions:

```
+-------------------------------------------------------------------------+
| Tier 1: Phone (< 768px)   | Tier 2: 1080p Desktop     | Tier 3: 4K UHD   |
| • 7 dynamic auto-fit cols | • 1000×800+ comfortable   | • 4x HiDPI crisp |
| • Touch gestures & swipe  | • Full keyboard shortcuts | • Luxury felt    |
| • Pinned bottom controls  | • Move history sidebar    | • Telemetry HUD  |
+-------------------------------------------------------------------------+
```

### Tier 1: Simplified Phone Display (Mobile / Viewport < 768px)
* **Target Viewport**: 360×640 to 430×932 (mobile portrait or compact desktop window).
* **Tableau Layout**:
  - Replace the fixed `COL=88`, `CARD_W=72` with dynamic percentage calculation:
    `CARD_W = Math.floor((viewportWidth - margins) / 7.2)`
  - Columns auto-fit the screen width with tight 4–6px gutters.
  - Top row: Stock and Waste on the left, 4 Foundations on the right.
* **Touch-First Controls**:
  - Oversized touch targets (minimum 48×48px hitbox per card/pile).
  - Tap card to select, tap destination to move.
  - **Quick-Actions**:
    - Double-tap any face-up card to auto-move to the lowest eligible foundation.
    - Tap or swipe down on the Stock pile to draw cards.
* **Simplified UI & HUD**:
  - Top header shows only essential status (Moves, Score, Timer).
  - Floating bottom thumb bar: **[Draw]**, **[Undo]**, **[Hint]**, **[Menu]**.
  - Settings, How to Play, and Save Location collapse into an off-canvas slide-up bottom sheet.

### Tier 2: Full 1080p Desktop Display (Standard Desktop 1920×1080)
* **Target Viewport**: 1024×768 to 1920×1080 window / screen.
* **Layout**:
  - Standard comfortable card dimensions (`CARD_W=80`, `CARD_H=112`), centered green baize table.
  - Optional right-hand collapsible sidebar displaying:
    - Complete move history notation (e.g. `♠A → Foundation`, `♥7 → ♠8`).
    - Session statistics (Win rate, best time, fewest moves, current streak).
* **Keyboard Navigation**:
  - Arrow keys: Navigate between tableau columns and cards.
  - `Space` / `D`: Draw from stock.
  - `U` / `Ctrl+Z`: Undo last move.
  - `H`: Highlight hint move.
  - `A`: Auto-move all eligible cards to foundations.
  - `Esc`: Pause / open settings menu.
* **Audio & High-DPI**:
  - Dynamic `devicePixelRatio` scaling (1.0–2.0) for razor-sharp suits and card text.
  - Web Audio API procedural sound synthesis (shuffle, deal swish, card snap, victory fanfares).

### Tier 3: Complete 4K Display (Ultra-HD 3840×2160 / Retina)
* **Target Viewport**: Width > 2560px or HiDPI Retina (3840×2160, 4K).
* **HiDPI Vector Crispness**:
  - Canvas buffer dimensions must scale explicitly:
    ```typescript
    const dpr = Math.min(window.devicePixelRatio || 1, 4);
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);
    ```
  - Vector suit rendering (`♥`, `♦`, `♣`, `♠`) and card corners remain mathematically crisp with zero pixelation or blurry edges.
* **Spacious Visual Polish**:
  - Generous vertical cascading spacing so 13-card runs never compress or truncate.
  - High-resolution procedural felt texture rendering (customizable Green, Midnight Blue, Charcoal Felt).
  - Typography scaled with `rem` and CSS `clamp()` to guarantee readability from distance.
* **Diagnostic Telemetry Overlay (Optional)**:
  - Toggleable HUD displaying real-time FPS, frame render time (ms), and active Web Audio nodes.

---

## Technical Standards & WebOS Contract

### 1. Zero-Dependency Testing (Node 24 Native Test Runner)
* All tests run using Node 24's built-in `node:test` and `node:assert/strict`:
  ```bash
  node --test tests/*.test.mjs
  ```
* Do not rely on external `vitest` binaries.
* Tests must cover:
  - 52-card uniqueness and seeded PRNG reproducibility.
  - Klondike rules: alternating colors, descending order, king-to-empty-column.
  - Undo/redo state reversibility.
  - Serialization round-trip (`encodeSave` / `decodeSave`).

### 2. WebOS Host Lifecycle Contract
* Export synchronous `mount(host)` from `src/mount.ts`:
  ```typescript
  export interface SolitaireMountResult {
    element: HTMLElement;
    dispose(): void;
  }
  ```
* **Strict Cleanup Requirements on `dispose()`**:
  - Cancel any active `requestAnimationFrame` loops.
  - Suspend/close the `AudioContext` in `SynthAudio`.
  - Remove all DOM listeners (`pointerdown`, `keydown`, `resize`, `focus`, `blur`).
  - Clear pending microtasks and timers.
* **Persistence**:
  - Save states to `/My files/Solitaire.game.json` using `host.storage.mirrorFileContext()`.
  - Support debounced auto-saving on move completion.

### 3. Local Git Workflow
* All development occurs on the local branch (e.g. `webos/rebuild` or `webos/modernize-2026`).
* Push commits to the local bare origin:
  ```bash
  git push origin HEAD
  ```
* Do not push to external remotes without explicit instruction.
