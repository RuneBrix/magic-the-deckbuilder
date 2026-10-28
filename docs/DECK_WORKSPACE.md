# Deck library and workspace

Issues [#16](https://github.com/RuneBrix/magic-the-deckbuilder/issues/16), [#17](https://github.com/RuneBrix/magic-the-deckbuilder/issues/17) and [#18](https://github.com/RuneBrix/magic-the-deckbuilder/issues/18) establish shared navigation, a full editor, and library management. GitHub issues/PRs track review and merge status.

## Navigation and adding cards

The header offers Explore cards, My decks and Settings at every viewport, with local-save status and Help. The logo opens exploration without reloading the app. Deck switching and creation belong in My decks rather than a duplicate navigation list.

Open deck and successful deck creation/import enter the dedicated editor. It contains Cards, Statistics and Checks, plus import/export and management actions. Find cards to add explicitly tracks the editor's deck and opens discovery without clearing its search. The compact tracker names that deck and Main deck destination, with Open full deck to return. Exploration can instead track another deck or none; hiding the tracker retains the named quick-add destination. Add to… selects a different destination without changing tracking. See [Exploration](EXPLORATION.md) for #19/#20 behavior, persistence and resize controls.

The editor shows main/sideboard/command counts, copy controls, zone selectors and mana costs. Zone moves transfer every copy and merge roles without deleting data on overflow. Commander identity is the union of designated command-zone card identities, not proof of eligibility; other formats show the main-deck identity, excluding sideboard cards.

## Roles, grouping and previews

Personal roles remain the existing ordered `tags` array. **The first tag is the primary function**; entries without a first role group as Unassigned. No new metadata or backup migration is needed. Inspect a card and edit its comma-separated roles to change their order. When entries merge, existing destination roles keep their order and incoming roles are appended without duplicates.

Grouping uses card type, primary function, or no groups, within each zone. Multi-type cards use the existing category precedence (for example, an artifact creature groups as Creature). The type filter can match each of a card's displayed types/supertypes; the role filter matches every assigned role, including secondary roles. Ordering supports name, mana value and descending quantity. Filters change the view, never the stored deck; counts show both full-zone totals and filtered quantities.

Full card images appear on desktop row-name hover/focus, with complete card details available by activating the name using mouse, keyboard or touch. No artwork is cropped.

## Creation, management and interoperability

All seven existing format presets remain available. New Commander decks offer a card-name lookup and optional designation. Choose later creates an incomplete deck; choosing a card puts one copy in the command zone. Search results are not an eligibility filter, and designation does not validate pairings or special commander rules (#13). Other formats ignore the commander selection.

Rename/format edits target the named library deck. Duplicate deep-copies every card, quantity, zone and ordered role into an independent deck with a new ID. Delete names its target and opens a deliberate confirmation with Keep deck focused first. Existing workspace/deck entry/copy limits still apply.

The library can import a new text decklist or add text cards to a named deck. Existing-deck imports merge atomically; new-deck imports commit only after all cards resolve and limits pass. Failed or dismissed imports retain existing data. Heading-aware text imports/exports preserve names, quantities and zones, but do not promise personal roles or printing preservation. Export also offers a complete single-deck JSON backup, compatible with Settings → Restore JSON backup. JSON preserves ordered roles, stored card data and zones. Settings still provides a complete workspace backup. Expanded external-format support remains #6.

## Verification and limits

Native Node tests cover non-primary role filtering, ordering without mutation, identity summaries, full-editor navigation, legacy backups, independent duplication, confirmed deletion, commander designation, atomic imports and cancelled import responses. Existing zone, comparison, appearance and server checks remain in the full suite.

Manual checks use a separate local origin on Windows: live commander lookup, zone-heading import, role grouping/filtering, quantity edits, zone moves, library duplication/rename and deletion cancellation, reload persistence, keyboard focus/Escape and desktop/390px layouts in light/dark appearance. macOS and Safari remain untested. The Impeccable engine/detector was unavailable; no automated visual-detector result is claimed. Checks retain their existing partial rules coverage and manual card-data refresh; #27/#28 are separate work.
