# Arcana interface

The workspace serves card discovery and deck editing. Issue [#9](https://github.com/RuneBrix/magic-the-deckbuilder/issues/9) established a collector’s index: warm paper, forest-green ink, crisp rules and restrained square controls. The shared header, dedicated deck editor and library in issues [#16](https://github.com/RuneBrix/magic-the-deckbuilder/issues/16), [#17](https://github.com/RuneBrix/magic-the-deckbuilder/issues/17) and [#18](https://github.com/RuneBrix/magic-the-deckbuilder/issues/18) extend this visual world. Card imagery remains complete and uncropped.

## Typography and icons

Self-hosted Newsreader gives headings and the wordmark an editorial character. Public Sans carries controls and dense deck rows. Font licenses and provenance live in public/fonts/. Headings use moderate weight and tracking no tighter than -0.025em. Body copy names concrete tasks, with no decorative slogans.

Authored SVGs share a 24-unit grid, 1.7-unit stroke and rounded joins. The overlapping card mark contains a diamond; the search lens repeats that diamond. Functional plus, close, transfer and help symbols retain familiar shapes. Icons accompany labels or accessible names.

## Appearance tokens

All interface surfaces use CSS variables in public/style.css. Mana colors keep their game meaning in either theme.

| Role | Light | Dark |
| --- | --- | --- |
| Ground | #f4f1e9 | #171e1b |
| Surface | #fffdf7 | #202a24 |
| Ink | #243a30 | #e4e9dc |
| Supporting text | #60685f | #acb9ac |
| Action | #276047 | #acd2a5 |
| Action text | #fffdf7 | #16251b |
| Divider | #d5d6ca | #435147 |
| Selection | #e5eadf | #2f4134 |

Settings offers Light, Dark and Use device setting. The default follows the device; explicit choices persist under arcana.theme.v1, separate from deck storage. A blocked preference write retains the current session’s choice and shows feedback. System appearance changes update the app only in device mode. Native form controls, focus, selection, scrollbars and browser theme color follow the palette.

## Focus and disclosure

The initial explorer shows the primary search, collapsed Filters and Browse by function, an optional query disclosure and three starting searches. Filters contains type, mana value, color identity, card name, Oracle text and cost. Selected function tags stay visible as removable chips even when the browser is collapsed. Clear filters appears when a query is active. Open disclosure state survives search and deck rerenders.

The function browser searches the dated Scryfall Oracle Tags snapshot by name and alias, with curated starting labels and descriptions. Results appear in batches of 30. Each tag has a separate add/remove control and relationship arrow; browsing recorded broader/narrower links moves focus to the detail heading without changing filters. Source date, missing-snapshot guidance and all/any semantics remain explicit. The catalog provenance and update procedure are in `docs/TAG_TAXONOMY.md`.

Compare alternatives is a native disclosure beside the search tools. Compare controls on results and card details select two cards; selection moves focus to the comparison heading. A semantic table keeps mana, colors, full Oracle text and search/role context aligned, including on phones. Ignore-condition buttons retain every other original filter, show both queries and the reason, and offer Return to original search. Relaxation and restoration move focus to results after completion. Searches do not remove comparison selections. Scope and interpretation are documented in `docs/EFFECT_COMPARISON.md`.

The shared horizontal header contains Explore cards, My decks and Settings, with compact browser-local save status and Help. My decks remains visibly selected in both the library and its editor; the editor identifies it as the current location. Settings opens a dialog for appearance and complete workspace JSON backup/restore. Deck import/export stays with its deck.

The dedicated editor leads with the deck name, format, playing-deck and sideboard counts, and labeled color identity. Find cards to add is the primary action; rename/format and import, export, duplicate and confirmed deletion remain secondary. Cards, Statistics and Checks divide editing, analysis and construction feedback. Find cards to add opens the existing explorer, retains search state and names the destination deck and Main deck zone; Open full deck returns to the editor. Discovery retains its secondary deck panel and mobile shortcut. The optional/resizable tracker remains separate work in [#19](https://github.com/RuneBrix/magic-the-deckbuilder/issues/19).

Cards separates Main deck, Sideboard and Command zone with individual counts. Rows expose quantities, card names, mana costs, zone selectors and copy controls. Type or primary-function grouping, no grouping, name/mana-value/quantity ordering, and type/all-role filters stay above the rows. Primary function uses the first existing ordered personal role tag; every assigned role remains filterable, with no new role schema. Zone moves preserve all copies and merged roles. Inspect opens full details by keyboard or touch; desktop hover/focus previews keep the complete portrait. Ordered roles and zone edits still require Save zone and roles; autosave remains [#25](https://github.com/RuneBrix/magic-the-deckbuilder/issues/25).

Playing-deck progress and Statistics exclude the sideboard. Commander decks label command-zone identity and explicitly show when no commander is designated; other decks label main-deck identity. Checks separates failed rules, unavailable data and manual-review notices; manual items use supporting text rather than failure styling. Modern coverage and remaining rule families are documented in `docs/DECK_ZONES.md`.

My decks uses restrained bordered cards with complete card portraits, deck names, formats, labeled identity, summary statistics and Open deck. Management actions wrap below a fine divider. New deck and Import deck lead the library. Creation permits an incomplete deck and optional commander designation; designation adds one command-zone copy and does not certify eligibility or pairings. Rename/format, independent duplication, text import and text/complete per-deck JSON export are available in the library and editor. Delete names the deck in a confirmation dialog and initially focuses Keep deck. Text export states its metadata losses; JSON preserves the complete deck. See `docs/DECK_WORKSPACE.md` for behavior and limits.

## Layout and states

Every surface uses the same top header without a duplicate navigation sidebar. The editor and library occupy the main width within a centered 1200px maximum. Wide discovery pairs a flexible explorer with a sticky secondary deck panel; at 960px that panel enters document flow. At 600px the header wraps its navigation onto a second horizontal row, keeping the brand and compact save status above it. Editor actions stack or wrap, four filter/group/order controls become two columns, and rows place mana and zone controls below the name while retaining adjacent copy controls. The library grid adapts to available width and becomes one column on phones. Discovery retains two card columns and a fixed deck shortcut. Expanded text filters stack vertically; settings actions wrap or stack. Dialogs stay within the viewport and preserve native focus containment and Escape dismissal.

Use small radii for controls and generous separation between work areas. Card images preserve portrait proportions and their existing brief hover lift; reduced-motion preferences suppress transitions and animations. Native details/summary controls expose state and keyboard activation. All controls retain visible keyboard focus. Loading, empty, error, disabled and storage-warning states use the same theme tokens.

## Verification limits

The retained appearance was checked for issue #9 in the Windows browser at desktop and 390px mobile widths in both themes, including live Scryfall search, card addition, persistence, settings, keyboard disclosure and dialog dismissal. For issues #16–#18, Windows desktop and 390px light/dark checks covered the shared header, editor, library and details, live lookup/import, role edits, zone moves, copy controls, duplication, renaming, deletion cancellation, reload and keyboard use. Screenshot review supports the responsive composition; automated workspace/core checks cover behavior separately. Impeccable’s context and visual-detector engine was unavailable, so no automated visual-detector result is claimed. macOS and Safari remain untested.
