# Portable workspace files

The confirmed transfer/recovery direction is portable local JSON files (#4); cloud accounts and synchronization are deferred. This contract owns compatibility and preservation. Verify current serialization and save/restore handlers in `public/core.js` and `public/app.js`, with `test/workspace-file.test.mjs` and `test/workspace-storage.test.mjs`.

## Storage and compatibility

- Browser autosave writes the complete version-2 `arcana-workspace` envelope to `arcana.workspace.v2`, including decks and collection. Startup prefers it and falls back to the legacy `arcana.decks.v1` value when absent. Preserve legacy data; an unreadable saved workspace shows a warning and blocks saving rather than overwriting it.
- Complete workspace downloads use `{format:"arcana-workspace", version:2, exportedAt, decks, collection}`. Deck-only exports use version 1 without collection. `readWorkspaceFile` accepts legacy deck arrays and versions 1/2, validates the entire contents and rejects unsupported versions. Empty collection and absent collection have distinct restore meanings.
- Preserve stored card/face records, printing/finish, quantities, zones, ordered functions, brackets, companion designation and saved deck settings. Text interchange is narrower; see [DECKLIST_INTEROP.md](DECKLIST_INTEROP.md). Complete inventory keeps exact lots and quantities.
- Malformed, unsupported or oversized imports leave existing data intact. Downloads/imports have a 15 MB limit. Never rewrite an old backup as migration or silently downgrade a complete workspace to a deck-only format.

## Open, save and recovery

Browser autosave is an origin/profile-specific working copy. A requested download is a separate snapshot, not proof that a file reached disk. Settings records the request time and whether the workspace has changed since that request, for this session only; reload resets that reminder. A single-deck or pending-import export does not reset the complete-workspace reminder.

Opening JSON previews its contents and adds independent deck copies with fresh IDs. A version-2 file offers explicit keep/replace inventory choices; version 1/legacy files leave inventory unchanged. Replacement applies to collection, not the whole deck workspace. Validate and persist the staged workspace before applying it. Cancellation, stale reads and failed writes retain current data; offer retry and recovery-copy downloads where available. A future whole-workspace replacement requires a separate explicit decision and safeguards.

Do not silently merge independently edited deck copies by ID/timestamp or add quantities from repeated backup imports. Manual file transfer does not supply app-level conflict resolution. Keep dated copies and distinguish unsaved browser changes from downloaded files. A failed autosave must remain visible even after a recovery-download request.

## Offline and verification limits

Stored editing and JSON open/export do not require upstream access once the app runs. Search, name resolution, printing lookup, uncached artwork and legality refresh do. Keep last usable data and represent uncertainty honestly; this does not promise an offline installer or automatic retention/encryption.

Use synthetic success/failure, compatibility, collection keep/replace and same-origin reload checks for changes here. Record actual platform/browser evidence in the implementing PR under [the verification workflow](DEVELOPMENT.md#verification-and-data), not as a permanent test-count claim in this contract.
