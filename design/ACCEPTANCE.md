> Original design reference from 2026-10-30. This describes intended behavior, not current implementation or qualification. The current app README is authoritative for status. Pseudocode and template JSON here are documentation, not build entries.

# Acceptance — Solitaire Table

**All runtime cases are NOT RUN.** This file is a plan; document checks are not gameplay evidence.

Apply all C01–C24 in [common acceptance](../../../../../docs/games/design-reference/ACCEPTANCE-COMMON.md). No immersive support is claimed or required for this flat-screen app.

## Game-specific cases

| ID | Experiment / invariant | Status |
|---|---|---|
| solitaire-G01 | Card count and uniqueness remain 52 after every move. | not_run |
| solitaire-G02 | Invalid drop changes no pile. | not_run |
| solitaire-G03 | Undo restores reveal, stock and score together. | not_run |
| solitaire-G04 | Double-tap cannot move one card twice. | not_run |
| solitaire-G05 | Portrait overlap still permits selecting each exposed rank. | not_run |
| solitaire-G06 | Save/load preserves exact stock order and draw-three offset. | not_run |

## Release evidence

Record rules/content and dependency versions, actual asset names/hashes, desktop browser, real phone and (where required) Galaxy XR build, commands/logs, complete-playthrough result, save restoration result, multiwindow/late-disposal behavior, frame timing and unresolved defects. Exercise actual Rive properties and texture input rather than substituting an HTML mock.

A pure rules unit test, a visual smoke test and a hardware XR test are different evidence. Preserve that distinction. All promised features must be demonstrated or explicitly left incomplete; do not relabel a generic engine scene as the finished game.
