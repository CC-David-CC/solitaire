# Independent Solitaire source baseline

This meaningful game has its own repository at `apps/solitaire/` in the parent assembly. Source, design/WIP documentation, model, view, audio, codec, package lock and three test files retain their original history. The initial filtered commit has exactly the original 24-file Git tree, including blob identities and Git modes. A separate metadata commit adds only this note and generated-output exclusions.

History includes the earlier unfinished game tree, `apps/system/solitaire/`, and the current source-group path. Private commit maps link original and filtered commits. Similarity-based Git follow records for identical wrappers/empty manifests and copied lock/config/RNG templates also point at other games; those records remain in provenance, without incorrectly assigning the other games' entire trees to Solitaire. Original complete histories remain privately preserved.

Run `npm ci --ignore-scripts`, `npm run typecheck`, and `npm test -- --maxWorkers=1` at this repository root. Typecheck and all 16 existing tests passed in the original-byte baseline copy and filtered fresh clone. These are component unit checks, not new Desktop/browser/account synchronization acceptance.

The active source still expects its historical Desktop/mirror host. Its new public host, shared human/agent operations and server-backed save integration are pending, so the parent does not enable it yet. The old README's monorepo commands describe the preserved baseline. Root old-workspace `tests/solitaire-*` whole-system tests remain preserved and assigned to the parent test-port work. No source/deployment was removed or changed.
