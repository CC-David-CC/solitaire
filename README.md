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
npm ci --prefix apps/system/solitaire --ignore-scripts
npm run typecheck --prefix apps/system/solitaire
npm test --prefix apps/system/solitaire
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
Physical-phone testing and a complete deal-to-victory playthrough remain open.

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

A constructed near-win state was exercised on live desktop and phone-sized browser views: the last king was moved to its foundation, the winning state synced to the server, and a fresh browser reopened it. A model test also moves all four final kings, verifies all 52 cards and undoes/replays the win. These checks do not establish a full deal-to-victory playthrough or physical touch.
