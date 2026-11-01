# Changelog

## Deck view review refinements — 2026-11-01

- Keep earlier cards fixed during hover reveals: horizontal stacks move only later cards right; vertical stacks move only later cards down. Compact vertical toolbars are 33px high on desktop, and full artwork continues behind the next rounded toolbar with consistent portrait joins. Narrow/touch views wrap full cards and retain larger controls.

- Align horizontal text entries to the same page-width three-column grid as vertical text. Add 8px gaps to sparse horizontal visual groups and an immediate hover/focus fan that pushes following cards right, redistributes overlap and uses reserved opening space without a sideways scroller.

- Horizontal visual cards remain separate until they fill the group, then overlap progressively with card count and available width without sideways scrolling. Hover/focus reveals covered controls. Every vertical toolbar keeps rounded upper corners, vertical visual groups wrap, and text +/− buttons gain the same hover outline.

- Unified full-width visual toolbars with outlined, tinted surfaces attached to artwork; options borders appear on hover, and options/quantity symbols are centered. Vertical stacks join at straight edges, spacing between groups/zones is tighter, and vertical text keeps three desktop group slots even for a single commander ([PR #51](https://github.com/RuneBrix/magic-the-deckbuilder/pull/51)).

## Deck views, card actions and Maybeboard — 2026-10-31

- Refined PR #51 after review: visual quantity/actions sit above artwork with reserved vertical-stack spacing; Command zone comes first in every view. Text rows are slimmer, align quantity/name sizing, put mana costs beside ellipsized names with full-name hover titles, and wrap vertical text groups into new rows.

- Added four visual/text deck views with horizontal visual stacks as default, shared grouping/filtering/sorting and responsive quantity/menu controls ([#41](https://github.com/RuneBrix/magic-the-deckbuilder/issues/41)).
- Added compact card menus for details, private function assignment/creation, zone moves, name copying, explicit copying to another deck and confirmed removal across all zones ([#43](https://github.com/RuneBrix/magic-the-deckbuilder/issues/43)).
- Added persistent Maybeboard, excluded from playing totals, statistics, construction checks and brackets by user decision. Moves, duplication, JSON backups and sectioned text preserve it; text still omits roles/printing/bracket metadata ([#44](https://github.com/RuneBrix/magic-the-deckbuilder/issues/44)).

## Deck controls and left preview — 2026-10-31

- Added live deck text filtering, Type/Function/No grouping labels and Sort by modes for stored-printing USD price, power and toughness. Missing/nonnumeric values sort last; existing name, mana value and quantity sorts remain ([#40](https://github.com/RuneBrix/magic-the-deckbuilder/issues/40)).
- Moved desktop card previews into a sticky left rail beside the card area with matching row highlighting. Keyboard focus updates previews; narrow screens retain full-details access without overlays ([#42](https://github.com/RuneBrix/magic-the-deckbuilder/issues/42)). Filtering, sorting and previews preserve deck data.

## Deck library and editor presentation — 2026-10-31

- Centered letters within the larger color-identity circles in listings and editor headers; tightened title-to-identity spacing and reduced empty listing space.
- Deck listings open through artwork or titles, show commander art crops and compact color/bracket information, and put management in accessible ⋮ disclosures ([#38](https://github.com/RuneBrix/magic-the-deckbuilder/issues/38)).
- The editor uses a compact full-width header with a shared management disclosure, visible Find cards to add, capitalized format and smaller Commander bracket selector. Bracket discussion guidance opens and focuses Checks ([#39](https://github.com/RuneBrix/magic-the-deckbuilder/issues/39)). Deck data and existing management confirmations remain intact.

## Home and exploration simplification — 2026-10-31

- My decks is first in the top navigation, followed by Explore cards and Settings. It opens on startup/reload and from the Arcana logo; Explore cards retains its search state during session navigation ([#37](https://github.com/RuneBrix/magic-the-deckbuilder/issues/37)).
- Removed candidate saving, overview/navigation and optional pair comparison at user request. Reversible search broadening, details, printing selection and deck additions remain ([#47](https://github.com/RuneBrix/magic-the-deckbuilder/issues/47)). No deck-storage migration.

Record completed user-facing changes here. Future work belongs in [GitHub issues and the roadmap](docs/ROADMAP.md).

## Unreleased

### Changed

- Collect up to 20 session-only candidates from results/details and review them separately, with optional two-card comparison; keep reversible search broadening secondary and independent ([#24](https://github.com/RuneBrix/magic-the-deckbuilder/issues/24); [scope](docs/CANDIDATES.md)).
- Assign Commander brackets manually and review named Game Changers against a dated official snapshot with conditional discussion ranges, human-review caveats and stale/missing-data states. Preserve assignments in JSON and duplication ([#29](https://github.com/RuneBrix/magic-the-deckbuilder/issues/29); [sources and bounds](docs/COMMANDER_BRACKETS.md)).

- Separate card facts/artwork from explicit named-deck controls, autosave validated role and zone edits, and keep invalid drafts visible for correction or deliberate discard ([#25](https://github.com/RuneBrix/magic-the-deckbuilder/issues/25)).
- Browse paginated paper printings with consistent artwork/release facts; preview without deck mutation, then explicitly apply to a named entry while preserving copies, roles and zone. JSON preserves printing choices; text lists do not ([#26](https://github.com/RuneBrix/magic-the-deckbuilder/issues/26); [workflow](docs/CARD_DETAILS.md)).

- Distinguish supported passes, failures, stale/unavailable legality and manual review with labeled icons and semantic colors in deck Checks ([#27](https://github.com/RuneBrix/magic-the-deckbuilder/issues/27)).
- Refresh legality automatically for the tracked/open deck each app session and after card-set changes; retain stored printing and live edits, surface cache/freshness limits and offer retry on failure ([#28](https://github.com/RuneBrix/magic-the-deckbuilder/issues/28)).
- Add persisted dark green, dark blue, black/white and black/orange palette choices alongside Light/Dark/device appearance ([#30](https://github.com/RuneBrix/magic-the-deckbuilder/issues/30)).

- Make exploration deck tracking optional and separate from the full editor, with persisted hide/show and desktop drag/keyboard width, compact zone quantity tracking and explicit alternate add destinations. Preserve search state when changing the tracker ([#19](https://github.com/RuneBrix/magic-the-deckbuilder/issues/19); [workflow](docs/EXPLORATION.md)).
- Simplify the initial exploration area to optional starting searches, ordinary result headings and result-associated sorting. Distinguish loading/no-match/error/results feedback and clear the last staged guided clause back to initial without accepting obsolete responses. Keep the existing comparison tools secondary after results ([#20](https://github.com/RuneBrix/magic-the-deckbuilder/issues/20)); candidate lists remain separate.

- Expand guided discovery with type/subtype all/any matching, two mana-value comparisons, separate card-color/identity modes and exact mana-symbol minimums. Keep the effective Scryfall query editable in the primary search bar; guided edits and typed tags share that query, with preserved query-only expressions and explicit parsing limits ([#21](https://github.com/RuneBrix/magic-the-deckbuilder/issues/21), [#22](https://github.com/RuneBrix/magic-the-deckbuilder/issues/22); [workflow](docs/UNIFIED_SEARCH.md)).
- Clarify function discovery with labeled Add filter / Related actions, secondary catalog/count help, matching beside selected tags, and entry of existing Scryfall tags. Relationship browsing leaves the query unchanged ([#23](https://github.com/RuneBrix/magic-the-deckbuilder/issues/23)).
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
