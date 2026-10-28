# Changelog

Record completed user-facing changes here. Future work belongs in [GitHub issues and the roadmap](docs/ROADMAP.md).

## Unreleased

### Changed

- Replace the duplicate navigation sidebar with a shared top navigation and compact local-save status ([#16](https://github.com/RuneBrix/magic-the-deckbuilder/issues/16)).
- Open decks in a dedicated editor with zone moves, mana costs, identity summaries, type/primary-function grouping, ordering, all-role filtering and complete card previews. The first ordered personal role is the primary function; existing JSON data stays compatible ([#17](https://github.com/RuneBrix/magic-the-deckbuilder/issues/17); [workflow](docs/DECK_WORKSPACE.md)).
- Add library rename, deliberate delete confirmation, independent duplication, deck import/export, and optional commander designation during creation. New text imports create a deck only after all cards resolve; complete per-deck JSON exports preserve roles and zones ([#18](https://github.com/RuneBrix/magic-the-deckbuilder/issues/18)).
- Add explicit main deck, sideboard and command zones with safe zone moves, per-zone quantities and zone-preserving text/JSON round trips. Modern checks now combine copy limits across main/sideboard and separate failed checks, missing data and manual-review rules; statistics exclude sideboards. Preserve legacy Commander decks and track remaining Commander/companion rules separately ([D03 / #3](https://github.com/RuneBrix/magic-the-deckbuilder/issues/3); [coverage](docs/DECK_ZONES.md)).
- Add manual two-card effect comparison with mana, colors, Oracle text and role/search context. Broaden one guided condition with an explicit reason, preserved original query and return action; retain comparisons across searches without automatic ranking ([D02 / #2](https://github.com/RuneBrix/magic-the-deckbuilder/issues/2)).
- Expand function discovery to a bundled Scryfall snapshot of 4,590 tags with alias search, broader/narrower navigation, dated source information and custom-tag guidance. Replace unsupported starting suggestions with verified canonical names ([D01 / #1](https://github.com/RuneBrix/magic-the-deckbuilder/issues/1)); [source and updates](docs/TAG_TAXONOMY.md).
- Redesign the workspace with self-hosted Newsreader/Public Sans typography, forest-green and paper surfaces, custom card/search icons, and direct task-focused copy ([#9](https://github.com/RuneBrix/magic-the-deckbuilder/issues/9)).
- Keep search and the working deck central: expand filters, function tags and query only when needed; show the mana curve in Statistics; move JSON backup/restore into Settings on desktop and mobile.
- Add light, dark and device-following appearance in Settings. Save the choice separately from deck data, with a session fallback when browser storage is unavailable.

### Development

- Add GitHub issue and pull-request templates, a feature inventory, roadmap and development workflow.
- Record GitHub as the preferred tracker in project instructions. Transfer the initial roadmap into [GitHub issues #1–#8](https://github.com/RuneBrix/magic-the-deckbuilder/issues).

## Initial MVP — 2026-10-26

Initial local delivery; this is not a published GitHub release or signed desktop application.

### Added

- Local deck creation and editing, quantities, commander selection and personal role tags.
- Scryfall search with guided filters, full syntax, curated function tags and related narrower suggestions.
- Deck curve, average nonland mana value, type, color and role statistics.
- Partial format legality checks and card-data refresh.
- Atomic text imports, text export and JSON workspace backup/restore.
- Responsive interface with mobile deck access and backup controls.

### Validation

- Eight automated checks passed; live browser checks covered search, persistence, imports and desktop/mobile layouts on Windows.
- macOS execution, complete tag discovery and comprehensive format rules remain unverified or unimplemented as described in [FEATURES.md](docs/FEATURES.md).
