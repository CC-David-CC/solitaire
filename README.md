# Solitaire Table

**Klondike cards · Phaser · single-player · phone required · flat-screen app**

> Planned design, not implemented or browser-tested. `index.pseudo.mjs` is an explanatory entry point, not a playable game.

## Experience

A tactile single-player Klondike table with forgiving touch selection, clear legal-drop feedback and honest deal outcomes.

## What this demonstrates

- Layered sprites and z-order
- Drag hit-testing and responsive layout
- Undo transactions and smooth card animation

## Rules and complete loop

- 52 unique cards; seven tableau columns; descending alternating-color sequences; foundations ascending by suit.
- Draw-one and draw-three are explicit modes. Redeals use a documented policy. Legal move applies atomically before its visual tween.
- Hints identify legal moves, not a guaranteed solution. Random deals are not labeled solvable. Victory only when all cards reach foundations.

## Bounded polished release

One polished deck/backs, draw-one and draw-three, seeded deals and local move/time statistics.

- Enlarged touch targets without hiding cards behind toolbar
- Auto-foundation requires explicit user action
- Card sounds independent from victory music and mute

No multiplayer, accounts, server simulation or generic editor is required. Start, rules/help, play/activity, pause, outcome/goal feedback and retry must all be complete. Settings include volume/mute, reduced motion, contrast and game-specific options where meaningful. State changes occur in the game model; animations illustrate them.

## Rive inside this app

Friendly table host in header and completion sequence, not each card. The requested asset is `solitaire-host.riv`; it is **not included**. See [RIVE.md](RIVE.md) for the authoring/integration contract. A placeholder or unrelated animated logo does not satisfy this requirement.

## Save behavior

Logical piles, visibility and undo transactions; no saved sprite coordinates. See [SAVE.md](SAVE.md). Loading starts paused; resume is explicit. Restart and load cancel stale callbacks and any owned AI work.

## Build sequence

Implement the rule loop in [gameplay.pseudo.txt](gameplay.pseudo.txt); bind the exact app lifecycle from [index.pseudo.mjs](index.pseudo.mjs); complete [CONTROLS.md](CONTROLS.md); author/integrate [RIVE.md](RIVE.md); then satisfy [ACCEPTANCE.md](ACCEPTANCE.md). Do not add XR or a 3D engine solely to widen the technology list.

Target wave: **2**. Integrator first reads [AGENTS.md](../../AGENTS.md); do not guess host APIs from symbolic helper names.

Use original/licensed artwork and audio. Keep the scope small enough to polish; expand content only after the release gates pass.
