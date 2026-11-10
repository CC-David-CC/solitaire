# Solitaire Table — desktop integration

Solitaire Table is a desktop-native Klondike game with a 52-card seeded deal,
draw-one and draw-three modes, tableau and foundation rules, undo, hints,
explicit auto-foundation and local move/time feedback.

The app exports a synchronous `mount(host)` and disposes its canvas loop,
listeners, account-file subscription and audio context idempotently. Save and
Open use the signed-in desktop's My files through
`host.storage.mirrorFileContext()`. Files contain the logical stock, waste,
tableau, foundations, undo stack and counters; loading validates the document
before replacement and resumes paused.

Desktop play supports selection by pointer, Space to draw, Escape to pause,
Ctrl/Cmd+Z to undo and H for a hint. The phone layout retains large controls and
round-trippable save/open actions.

The game pauses on browser blur, desktop focus loss, workspace changes,
minimization and roll-up. Save captures the exact paused state and destination
before touching storage; Open and New deal reject stale results if the table
changed while a confirmation was open. Controls stay locked until the file
operation finishes, and closing during a save remains protected by the desktop
dirty-state guard.

## Verification

```sh
npm ci --prefix apps/games/01-phaser-arcade/solitaire --ignore-scripts
npm run typecheck --prefix apps/games/01-phaser-arcade/solitaire
npm test --prefix apps/games/01-phaser-arcade/solitaire
python3 active-system/scripts/build-public-apps.py --output .build/solitaire-test --apps solitaire
cp tests/solitaire-fixture.html .build/solitaire-test/index.html
python3 -m http.server 18341 --bind 127.0.0.1 --directory .build/solitaire-test
CODI_TEST_CDP=http://127.0.0.1:19341 CODI_SOLITAIRE_URL=http://127.0.0.1:18341/ CODI_SOLITAIRE_MANIFEST=.build/solitaire-test/apps.json node tests/solitaire-browser.test.mjs
CODI_TEST_CDP=http://127.0.0.1:19341 CODI_SOLITAIRE_URL=http://127.0.0.1:18341/ CODI_SOLITAIRE_MANIFEST=.build/solitaire-test/apps.json CODI_PHONE=1 node tests/solitaire-browser.test.mjs
CODI_TEST_CDP=http://127.0.0.1:19341 CODI_TEST_URL=http://127.0.0.1:18345/ node tests/solitaire-account.test.mjs
```

The focused suite covers card conservation, invalid-move atomicity, undo,
draw/redeal order, save validation, mount/disposal, the two-window desktop and
phone harness, focus pause, save locking, and an isolated real-account workflow.
Physical-phone testing remains open. A solver-generated, seeded draw-one deal
was replayed through all 126 actions on the actual board using desktop mouse
and emulated-phone touch; both reached victory, synchronized the resulting
save and reopened it in a fresh browser. This proves that particular deal and
sequence, not every deal, draw-three play or physical touch.

Saving pauses the table before taking its snapshot, holds conflicting controls
at that boundary, and reports later edits as unsaved. Opening a replacement
captures the current table and rejects a stale result if it changes while a
confirmation or file read is pending. Losing desktop-window focus, minimizing,
rolling up, switching workspaces or leaving the browser pauses the game; Resume
is explicit. Imported saves are bounded to 52 unique cards with valid tableau,
foundation, undo and counter state.

## Current limitation

No authored `solitaire-host.riv` asset is available. The header currently shows
a clearly labeled procedural host preview. The Rive artboard, state machine,
properties, triggers and reduced-motion animation must still be authored and
tested, so the Rive/polish acceptance gate remains open.

Tall tableau piles compress vertically so their bottom cards remain visible and
selectable. Keyboard navigation highlights the focused column: use left/right
arrows to choose a column and Enter to select its top card or move it to the
focused tableau column. These keyboard controls currently handle top-card
tableau-to-tableau moves only; use the pointer or touch for waste, foundations
and longer runs. Space draws a card when the board has keyboard focus.

A constructed near-win state was exercised on live desktop and phone-sized browser views: the last king was moved to its foundation, the winning state synced to the server, and a fresh browser reopened it. A model test also moves all four final kings, verifies all 52 cards and undoes/replays the win. The later complete-deal replay is described above.

A model invariant test also follows more than 150 actions across 12 seeded deals, checking card conservation, face-up counts, undo and save-state round trips. It is automated coverage rather than a complete human-played deal.

While a save is in progress, board input, keyboard shortcuts, draw-mode
changes, and the touch controls cannot modify the game. Local desktop and
phone-sized registered-account tests held a write open, tried Undo, resume and
draw through both controls and keyboard, then verified the saved move and undo
history after synchronization and fresh-browser reopening.

## Design requirements

The original [design brief, controls, save rules, artwork and acceptance plans](design/README.md) are retained as reference. They describe targets; the implementation and qualification status above takes precedence.
