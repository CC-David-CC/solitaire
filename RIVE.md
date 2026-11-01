# Rive brief — Solitaire Table

**Asset to author:** `solitaire-host.riv` · **artboard:** `Main` · **state machine:** `Presentation`.

These are required names for the proposed asset contract, not existing files or built-in Rive API fields. No `.riv` binary is included. Verify the chosen authoring/runtime version supports the actual binding design.

## Role and staging

Friendly table host in header and completion sequence, not each card.

Use original coherent artwork consistent with this game's theme. Keep the activity readable in a narrow app window and phone portrait; animated overlays cannot hide controls.

## Data contract

| Property | Type / range | Authority |
|---|---|---|
| `moves` | integer >=0 | Game/application model |
| `remaining` | integer 0..52 | Game/application model |

One-shot presentation triggers: `hint`, `win`, `invalidMove`.

Authored visual states: `idle`, `thinking`, `cheer`. These states describe animation, not a second game-state machine.

Use app-controlled, typed data binding and a verified runtime bridge. Validate all names/types when loading. The asset may emit only allowlisted UI intents such as an activated menu action. It must not award score, spend currency, change physics or access host services directly. Keep one input-dispatch path to prevent duplicate commands.

## Render path

Rive → bounded source canvas → engine texture for in-scene elements; standard app-local Rive canvas is also appropriate for the ordinary menu.

The game owns advancement and texture updates. State machines advance once per presentation frame, not once per stereo eye. Freeze dirty/static panels; retain semantic labels and accessible actions. Test alpha, Y orientation, UV fit and phone-size sharpness. Do not create a new texture per frame or use Rive pose as a collision shape.

See [RIVE-COMPOSITION.md](../../docs/RIVE-COMPOSITION.md) for Phaser CanvasTexture / Three CanvasTexture / Babylon DynamicTexture guidance and renderer tradeoffs. This ZIP provides no tested adapter.

## Acceptance of the artwork

Actual asset loads; every required property has a visible verified effect; all named triggers are exercised; normal/reduced-motion modes are readable; authored imagery/fonts/audio have rights recorded; two app instances animate independently; disposal releases this instance only. A functional placeholder keeps this gate **open**.
