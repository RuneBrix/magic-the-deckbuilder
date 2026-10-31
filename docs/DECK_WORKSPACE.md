# Deck library and workspace

Issues [#16](https://github.com/RuneBrix/magic-the-deckbuilder/issues/16), [#17](https://github.com/RuneBrix/magic-the-deckbuilder/issues/17) and [#18](https://github.com/RuneBrix/magic-the-deckbuilder/issues/18) establish shared navigation, a full editor, and library management. GitHub issues/PRs track review and merge status.

## Navigation and adding cards

The header offers My decks, Explore cards and Settings at every viewport, with local-save status and Help. Startup/reload and the logo open My decks; in-session navigation preserves search (#37). Deck switching and creation belong in My decks rather than a duplicate navigation list.

Clicking library artwork or a title, and successful deck creation/import, enter the dedicated editor. It contains Cards, Statistics and Checks, plus import/export and management actions. Find cards to add explicitly tracks the editor's deck and opens discovery without clearing its search. The compact tracker names that deck and Main deck destination, with Open full deck to return. Exploration can instead track another deck or none; hiding the tracker retains the named quick-add destination. Add to… selects a different destination without changing tracking. See [Exploration](EXPLORATION.md) for #19/#20 behavior, persistence and resize controls.

The editor shows main/sideboard/command counts, copy controls, zone selectors and mana costs. Zone moves transfer every copy and merge roles without deleting data on overflow. Commander identity is the union of designated command-zone card identities, not proof of eligibility; other formats show the main-deck identity, excluding sideboard cards.

## Compact presentation (#38 / #39)

Library cards lead with landscape artwork and open through either their artwork or title. The first designated command-zone card supplies the cover even when a main-deck card was added first. Without a designation, the first main-deck card with a usable portrait supplies it; otherwise the existing card mark is shown. Multiple commanders use the first command-zone entry. Use the stored printing's Scryfall `art_crop`, including its first face when present, before a CSS portrait crop fallback. The fallback uses `object-fit: cover` at 25% vertical position; unusual/full-art frames can differ. No new image source, extra card-data request or saved-data migration is required. The normal portrait remains available in card details.

Covers use a 16:10 landscape frame with a 176px minimum; the information area grows with its content from a 132px minimum. Title, centered color markers and bracket text stay together with 10px gaps. Long titles display at most two lines while retaining their full accessible name. The library grid reserves columns for additional decks rather than stretching a single cover across the page. Named color-identity mana symbols show letters as well as game colors; commander-not-designated and colorless states remain explicit. Listings omit card/land/average-mana statistics, redundant identity wording and the separate Open deck button. Bracket text is only the assignment or No bracket assigned. Management stays in a named ⋮ disclosure.

The editor uses available page width with a top-left title, visible Find cards to add and a shared management menu. Capitalized format, counts, color symbols and a quieter Commander bracket selector wrap beneath the title. The header omits Command-zone identity wording. Bracket discussion guidance opens Checks, scrolls to the discussion and focuses it for keyboard/screen-reader use. Assignment remains personal; freshness, source limits and unsupported rules remain visible in Checks. Deck-card layouts and filtering improvements remain #40–#43.

## Roles, grouping and previews

Personal roles remain the existing ordered `tags` array. **The first tag is the primary function**; entries without a first role group as Unassigned. No new metadata or backup migration is needed. Inspect a card and edit its comma-separated roles to change their order; validated edits now save immediately in the named deck context ([#25/#26 workflow](CARD_DETAILS.md)). When entries merge, existing destination roles keep their order and incoming roles are appended without duplicates.

Grouping uses card type, primary function, or no groups, within each zone. Multi-type cards use the existing category precedence (for example, an artifact creature groups as Creature). The type filter can match each of a card's displayed types/supertypes; the role filter matches every assigned role, including secondary roles. Ordering supports name, mana value and descending quantity. Filters change the view, never the stored deck; counts show both full-zone totals and filtered quantities.

Full card images appear on desktop row-name hover/focus, with complete card details available by activating the name using mouse, keyboard or touch. Card-row previews and details retain complete imagery; only library covers use an art-focused crop.

## Creation, management and interoperability

All seven existing format presets remain available. New Commander decks offer a card-name lookup and optional designation. Choose later creates an incomplete deck; choosing a card puts one copy in the command zone. Search results are not an eligibility filter, and designation does not validate pairings or special commander rules (#13). Other formats ignore the commander selection.

Library and editor ⋮ disclosures contain Rename / format, Import cards, Export deck, Duplicate and Delete deck. Native Enter/Space and Tab work alongside Arrow Up/Down, Home/End and Escape; Escape returns focus to the trigger, outside clicks dismiss the disclosure, and launching an action closes it before opening a dialog. Actions target the named deck. Rename/format edits target that deck. Duplicate deep-copies every card, quantity, zone and ordered role into an independent deck with a new ID. Delete names its target and opens a deliberate confirmation with Keep deck focused first. Existing workspace/deck entry/copy limits still apply.

The library can import a new text decklist or add text cards to a named deck. Existing-deck imports merge atomically; new-deck imports commit only after all cards resolve and limits pass. Failed or dismissed imports retain existing data. Heading-aware text imports/exports preserve names, quantities and zones, but do not promise personal roles or printing preservation. Export also offers a complete single-deck JSON backup, compatible with Settings → Restore JSON backup. JSON preserves ordered roles, stored card data, zones and player-assigned Commander brackets. Text decklists do not preserve assigned brackets. See [bracket discussion](COMMANDER_BRACKETS.md) for assignment, conditional guidance and source freshness. Settings still provides a complete workspace backup. Expanded external-format support remains #6.

## Verification and limits

Native Node tests cover non-primary role filtering, ordering without mutation, identity summaries, full-editor navigation, legacy backups, independent duplication, confirmed deletion, commander designation, atomic imports and cancelled import responses. Existing zone, broadening, appearance and server checks remain in the full suite.

Manual checks use a separate local origin on Windows: live commander lookup, zone-heading import, role grouping/filtering, quantity edits, zone moves, library duplication/rename and deletion cancellation, reload persistence, keyboard focus/Escape and desktop/390px layouts in light/dark appearance. macOS and Safari remain untested. The Impeccable engine/detector was unavailable; no automated visual-detector result is claimed. Checks retain partial rules coverage; [#27/#28 freshness and presentation](DECK_ZONES.md) are implemented.
