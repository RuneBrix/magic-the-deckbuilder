# Portable workspace files

Decision for [D04 / #4](https://github.com/RuneBrix/magic-the-deckbuilder/issues/4), 1 November 2026: the user chose **portable local files**. Cloud synchronization and accounts are deferred. The versioned file reader/writer and staged additive open are implemented for review in #63; file-status workflow improvements remain tracked in #64.

## Ownership and working copy

The player owns the downloaded JSON file and chooses where to keep or transfer it. No sign-in, cloud provider, server-side deck storage or paid infrastructure is required. The browser workspace remains the editable working copy with local autosave; a portable file is an explicitly saved snapshot. Changing an origin or clearing browser storage can still lose edits made since the last exported file. The app must distinguish browser autosave from file export and cannot certify that a download reached disk.

## Compatibility and migration

Continue accepting the current array-of-decks JSON backups. New exports use `{format:"arcana-workspace", version:1, exportedAt, decks}`. The reader validates the version and entire contents before changing any deck. Browser autosave remains the legacy array format, so this adds no browser-storage migration. Older app versions cannot read the new envelope; use a compatible version to open it. Retain full stored card/face and printing records, quantities, all zones, ordered functions, bracket choices, names, formats and timestamps. Do not use text exports as a migration format. Unsupported newer versions and malformed/oversized files leave the existing workspace untouched and explain the recovery action. Never delete or rewrite an old backup as part of migration.

## Open, save and recovery

Use explicit browser download/save-copy and file-open controls first. No automatic filesystem access or permission-dependent API is required. Keep the current workspace and source file intact if selection is cancelled. Validate and stage a complete import before committing it; preserve a rollback snapshot when persistence fails and offer an export of recoverable in-memory data. Never show a failed localStorage write as saved.

Opening a file adds independent deck copies by default, consistent with current restore. A future replacement action must first offer export of the current workspace, show exactly which decks will be replaced and require explicit confirmation. Recovery means opening a known-good JSON copy; the UI should warn that later edits are absent. The player should retain multiple dated copies. Automatic retention, encryption and filesystem backup are not promised.

## Conflicts and devices

Two edited copies remain independent. Do not choose a winner by deck id or modification timestamp, silently merge card quantities or overwrite either copy. Additive import gives restored decks new local identifiers, preserves their contents, and lets the player compare/rename/delete duplicates explicitly. Moving a file between devices is manual; external file synchronization tools do not create app-level conflict resolution.

## Offline limits

Editing stored deck data and opening/exporting JSON must not need a network connection once the app is running. Live search, name-based text resolution, printing lookup, artwork not already cached and legality refresh still need internet. Retain stored facts when offline and label freshness honestly. This decision does not promise offline application installation or cached server startup.

## Implementation follow-ups

- [#63: versioned files and safe recovery](https://github.com/RuneBrix/magic-the-deckbuilder/issues/63): reader/writer compatibility, staging, additive conflict behavior and failed-write recovery tests.
- [#64: backup and recovery workflow](https://github.com/RuneBrix/magic-the-deckbuilder/issues/64): browser-save versus file-save status, portability instructions and explicit replacement safeguards.

Current behavior: explicit complete JSON download requests (15 MB limit), versioned/legacy file opening with a named-deck preview, and additive confirmation. A staged import receives fresh deck ids and is persisted before replacing the in-memory working copy. A failed write leaves every current deck intact; Retry, Save current workspace copy and Save pending import copy retain recovery options. No replace-workspace action exists. Browser download initiation is not a guarantee that the file reached disk.

Verification: Windows Node v24.14.1, 111 automated checks pass. Live Windows in-app-browser download and native file selection produced the expected independent-copy preview. Keyboard confirmation added a second independent deck that persisted after reload. Cancellation/stale reads are covered automatically; macOS/Safari and physical touch are untested.

Decision review: [PR #66](https://github.com/RuneBrix/magic-the-deckbuilder/pull/66).

File implementation review: [PR #68](https://github.com/RuneBrix/magic-the-deckbuilder/pull/68).
