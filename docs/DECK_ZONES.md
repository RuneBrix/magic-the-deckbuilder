# Deck zones and construction checks

Implemented for [D03 / #3](https://github.com/RuneBrix/magic-the-deckbuilder/issues/3). The selected rule family is **Modern constructed main deck and sideboard**, not complete automation of every Magic format.

## Authoritative basis

Checked on 2026-10-27 against Wizards' [current rules-document index](https://wpn.wizards.com/en/rules-documents), its linked [Magic Tournament Rules effective February 27, 2026](https://media.wizards.com/ContentResources/WPN/MTG_MTR_2026_Feb27_EN.pdf), sections 6.1–6.2, and the [Modern format page](https://magic.wizards.com/en/formats/modern).

The implemented constructed checks require at least 60 main-deck cards, no more than 15 sideboard cards, and combined name-based copy limits across both zones. Basic supertypes and supported explicit card-text copy exceptions override the normal four-copy limit. Restricted status applies across zones. Card-pool eligibility and banned status come from stored Scryfall legality data rather than a hardcoded set/ban list; review freshness before playing. A command zone is rejected for Modern.

## Storage and interaction

- Entries retain the existing card, quantity and personal roles, with `zone` set to `main`, `sideboard`, `command` or `maybeboard`. A zone can contain separate printing and finish entries for a rules card. Duplicate printing-and-finish entries are invalid backups. Construction copy limits aggregate English card names across the relevant zones, even if stored identifiers differ.
- Old entries without a zone map to main deck; legacy `commander: true` maps to command zone. Loading normalizes zones in memory without writing storage. JSON restore accepts both schemas; subsequent backups contain explicit zones. Existing commander metadata and personal tags remain intact.
- Cards supports all four zones with counts and quantity controls; empty Sideboard/Maybeboard viewing sections are hidden while destinations remain available. Use the card menu or drag a row to move its copies between zones. Matching versions merge and retain assigned functions. The storage limit of 500 copies per rules card per zone covers all versions. No copy is silently discarded to satisfy a construction rule.
- The [Add card to deck dialog](CARD_DETAILS.md#adding-copies) defaults to Main deck in Search cards. Details opened from a deck row defaults Add to that row’s zone. Choose any of the four zones before confirming. Statistics and progress count main deck only for constructed, or main plus command zone for Commander; sideboards and Maybeboard are excluded. Navigation can show the total number of stored cards.
- Text imports accept optional `Main deck`, `Sideboard`, `Command zone`, `Commander` or `Maybeboard` headings. Lists without headings still go to main deck. Imports remain atomic. Text exports preserve zones and quantities; JSON is the complete backup including personal roles. The completed [D06 text contract](DECKLIST_INTEROP.md) adds Archidekt generic headings and review; broader formats remain outside that scope.

## Check categories and coverage

**Failed checks** report confirmed violations of supported rules. **Data unavailable** reports missing or unrecognized stored legality/Oracle data; it does not label a card banned. **Manual review** reports unsupported rules, including unsupported companion predicates, unknown copy-limit text and special Commander cases. Passing supported checks is not tournament certification.

Commander and companion checks are implemented in bounded scope. Supported eligibility includes legendary creatures, legendary Vehicles, legendary Spacecraft with power/toughness, and explicit Oracle exceptions. Compatible partner variants combine color identities; basic-land types are checked even for empty stored identity. Commander still requires exactly 100 playing cards and one copy per commander. Special construction exceptions and pregame choices remain manual. See [supported cases, sources and limits](CONSTRUCTION_RULES.md).

Designate one existing Sideboard / outside-game card from its card options on Cards. The companion uses a constructed sideboard slot but stays outside Commander's 100. Checks evaluates stored legality, Commander identity and supported predicates for the applicable starting deck. **Remove as companion** clears the designation and leaves the card in Sideboard. Complete JSON preserves the designation. Zirda, unknown companions and special layouts require manual review. Missing facts are reported as unavailable. Other format presets use shared constructed checks with a visible format-specific manual-review notice. Modern is the verified rule family.

Tests include complete 60+15 constructed and 99+1 legacy Commander examples, across-zone name/copy and restriction cases, missing data, companions, old/new JSON backup behavior, atomic moves and text zone round trips. UI checks and platform limits are recorded in the implementation PR.


## Session legality refresh (#236)

Opening or reloading Arcana shows the library and refreshes at most one saved deck. Arcana chooses the saved search tracker when that deck has cards outside Maybeboard, even when the tracker is hidden. Otherwise it chooses the first eligible deck in saved workspace order. An empty workspace or one containing only Maybeboard cards sends no request.

Opening **Checks** also refreshes a deck whose format or card coverage has yet to be checked this session. Quantity and function edits recompute construction results locally. Returning to an unchanged, already checked deck or waiting five minutes sends no request. Arcana looks up distinct exact printing ids in sequential batches of at most 75. In-flight refreshes share a client queue. Requests for the same deck join its pending work, and results may use the server's five-minute cache. A failed refresh retains saved data and offers **Retry legality refresh**. Revisiting the same failed coverage leaves retry in the player's control.

Maybeboard is excluded from lookup and from validation or updates when cards move there during a request. Arcana updates only legality values and their refresh timestamps on surviving unchanged card entries. Stored printings, Oracle facts, quantities, functions, zones and deck modification dates are preserved. If the deck was deleted or changed formats, Arcana discards the response. Deleted or replaced card entries are skipped. Missing, invalid or mismatched data for a surviving entry prevents the save. Session status resets on reload and stays out of backups.


## Legality result presentation (#58)

Checks shows a single summary. Pending requests are neutral. Supported checks passing uses green. Known failures use red, missing data uses amber, and manual review or saved results after a failed lookup use neutral styling. Failure details identify the card, zone or format where available. Empty result categories are hidden. Cache and request policy are documented here.

**About these checks** gives a short overview of [construction coverage](CONSTRUCTION_RULES.md) and where to add a companion. Companion-specific issues appear when the chosen card or deck needs attention. Manual review counts deck-specific items (#237). Bracket discussion follows the legality results.


## Exact-printing legality refresh (#59)

Refresh now requests each distinct stored printing id, in batches of at most 75, through the same serialized/cached collection proxy. Names are still used by text import, but no longer identify refresh results. A real live probe confirmed two Very Cryptic Command printings with the same name and different Oracle identities; name-keyed mapping collapsed those variants and repeatedly reported mismatches. A second regression showed empty legality objects were incorrectly labeled fresh. Exact-id matching and selected-format status validation fix those causes without replacing card facts or weakening identity checks.

Unknown printing ids fail the lookup by exact id. Server handling includes rate spacing, a timeout and a five-minute cache. The current startup and recovery policy is documented under [Session legality refresh](#session-legality-refresh-236).

The [official Scryfall card fields](https://github.com/scryfall/api-types/blob/main/src/objects/Card/CardFields.ts) distinguish printing ids from rules identities, including same-name variants and reversible-card faces. A live collection request using `{id: printingId}` was verified on 1 November 2026; the main documentation page returned 403 in the research browser. This change does not certify the player's entire original deck or identify every possible refresh failure.

Verification: 124 native tests pass on Windows Node v24.14.1, including the two previously failing repros, exact-id forwarding/cache/validation, 75-card batching, retry, printing/format changes, removal/replacement races and data preservation. Windows desktop light/dark and 390px dark browser checks used two public same-name Very Cryptic Command variants in Main/Sideboard, confirmed fresh legality with zero unavailable data, and repeated the flow after reload. These cards correctly remain not legal in Modern; fresh data is distinct from a legal deck. Keyboard Enter opened Checks; the 390px page showed no horizontal overflow. Synthetic/public fixtures only; no personal deck dump was used. macOS/Safari and physical touch remain untested.

Implementation review: [PR #76](https://github.com/RuneBrix/magic-the-deckbuilder/pull/76).
