# Changelog

Record completed user-facing changes here. Future work belongs in [GitHub issues and the roadmap](docs/ROADMAP.md).

## Unreleased

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
