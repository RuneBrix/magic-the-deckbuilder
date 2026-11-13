# Deck zones and construction checks

Implemented for [D03 / #3](https://github.com/RuneBrix/magic-the-deckbuilder/issues/3). The selected rule family is **Modern constructed main deck and sideboard**, not complete automation of every Magic format.

## Authoritative basis

Checked on 2026-10-27 against Wizards' [current rules-document index](https://wpn.wizards.com/en/rules-documents), its linked [Magic Tournament Rules effective February 27, 2026](https://media.wizards.com/ContentResources/WPN/MTG_MTR_2026_Feb27_EN.pdf), sections 6.1–6.2, and the [Modern format page](https://magic.wizards.com/en/formats/modern).

The implemented constructed checks require at least 60 main-deck cards, no more than 15 sideboard cards, and combined name-based copy limits across both zones. Basic supertypes and supported explicit card-text copy exceptions override the normal four-copy limit. Restricted status applies across zones. Card-pool eligibility and banned status come from stored Scryfall legality data rather than a hardcoded set/ban list; review freshness before playing. A command zone is rejected for Modern.

## Storage and interaction

- Entries retain the existing card, quantity and personal roles, with `zone` set to `main`, `sideboard`, `command` or `maybeboard`. A zone can contain separate printing and finish entries for a rules card. Duplicate printing-and-finish entries are invalid backups. Construction copy limits aggregate English card names across the relevant zones, even if stored identifiers differ.
- Old entries without a zone map to main deck; legacy `commander: true` maps to command zone. Loading normalizes zones in memory without writing storage. JSON restore accepts both schemas; subsequent backups contain explicit zones. Existing commander metadata and personal tags remain intact.
- Cards shows all four zones with separate counts and quantity controls. Use the card menu or drag a row to move its copies between zones. Matching versions merge and retain assigned functions. The storage limit of 500 copies per rules card per zone covers all versions. No copy is silently discarded to satisfy a construction rule.
- The [Add card to deck dialog](CARD_DETAILS.md#adding-copies) defaults to Main deck in Explore. Details opened from a deck row defaults Add to that row’s zone. Choose any of the four zones before confirming. Statistics and progress count main deck only for constructed, or main plus command zone for Commander; sideboards and Maybeboard are excluded. Navigation can show the total number of stored cards.
- Text imports accept optional `Main deck`, `Sideboard`, `Command zone`, `Commander` or `Maybeboard` headings. Lists without headings still go to main deck. Imports remain atomic. Text exports preserve zones and quantities; JSON is the complete backup including personal roles. Broader third-party interchange remains [D06 / #6](https://github.com/RuneBrix/magic-the-deckbuilder/issues/6).

## Check categories and coverage

**Failed checks** report confirmed violations of supported rules. **Data unavailable** reports missing or unrecognized stored legality/Oracle data; it does not label a card banned. **Manual review** reports unsupported rules, including unsupported companion predicates, unknown copy-limit text and special Commander cases. Passing supported checks is not tournament certification.

Commander and companion checks are implemented in bounded scope. Supported eligibility includes legendary creatures, legendary Vehicles, legendary Spacecraft with power/toughness, and explicit Oracle exceptions. Compatible partner variants combine color identities; basic-land types are checked even for empty stored identity. Commander still requires exactly 100 playing cards and one copy per commander. Special construction exceptions and pregame choices remain manual. See [supported cases, sources and limits](CONSTRUCTION_RULES.md).

Designate one existing Sideboard / outside-game card using the Checks selector. The companion uses a constructed sideboard slot but stays outside Commander's 100. Its stored legality/Commander identity and supported predicate are checked; the predicate includes commanders and excludes sideboard/Maybeboard. None clears the designation. Complete JSON preserves it; text does not. Zirda, unknown companions and special layouts remain manual; missing facts remain unavailable. Other format presets use shared constructed checks with a visible format-specific manual-review notice; Modern is the rule family verified by this issue.

Tests include complete 60+15 constructed and 99+1 legacy Commander examples, across-zone name/copy and restriction cases, missing data, companions, old/new JSON backup behavior, atomic moves and text zone round trips. UI checks and platform limits are recorded in the implementation PR.


## Automatic legality freshness (#28) and presentation (#27)

Startup/reload opens the library and does not refresh deck legality until a deck editor or tracked exploration is opened. Opening a full deck or selecting a tracker refreshes that deck on first access in the session; the library does not refresh all stored decks. Adding/removing a distinct stored printing or changing the deck format triggers another automatic refresh. Quantity and role edits do not. Zone edits trigger refresh when they change the set of relevant non-Maybeboard cards. Hidden trackers still identify the relevant deck.

Printing ids are deduplicated and sorted, split into batches of at most 75, and processed sequentially; deck refreshes share one client queue and the server's existing global rate queue/cache. Repeated actions join the in-flight deck request. Reload resets session freshness but does not bypass the server's five-minute response cache. Fresh means a successful lookup this session, possibly cached; after five minutes it is labeled stale, with a secondary retry. After reload, opening an editor or tracked exploration starts a new session refresh. Failed refreshes retain all last usable legality values and expose recovery rather than retrying endlessly.

Maybeboard is outside the playing deck by the user’s explicit decision (#44): it contributes no statistics, construction failures/data warnings or Game Changer evidence. It is excluded from legality lookup and from in-flight response validation/patching if an entry moves there. Only `legalities` and their successful refresh timestamp are patched into surviving relevant entries. Stored printing/artwork, Oracle facts, quantities, roles, zones and deck timestamps are preserved. Missing or mismatched cards fail the refresh atomically. Deleted decks and removed/replaced entries cannot be revived; new or changed printings/formats are picked up by a subsequent refresh. Editing remains available while requests run. Session status is not exported as durable proof of current legality, and no backup schema changes.

Checks remain in the dedicated workspace. Red failure sections, amber data/freshness notices, neutral informational/manual sections and green supported-pass states include authored SVG symbols and explicit labels. Existing messages retain card/zone names; unsupported rules remain manual and missing/stale data cannot produce a green overall pass. Bounded Commander/companion automation follows [the construction contract](CONSTRUCTION_RULES.md).


## Legality result presentation (#58)

The Checks tab labels deck legality explicitly and explains the checked rules and zones. Failed checks use stored deck/card data, with card, zone and format context where available; freshness remains separate from a legality result. Empty failure, unavailable-data and manual-review categories are hidden. Missing data never means a card is banned, and stale/failed refreshes cannot produce a supported-pass summary. A fresh supported pass with unsupported rules remains a neutral manual-review state.

Commander coverage names the implemented size, copy, commander-quantity, eligibility/pairing, combined-identity and basic-land-type checks. Companion selection and supported starting-deck restrictions are separate from command-zone designation. Results retain explicit manual/unavailable limits; see [construction coverage](CONSTRUCTION_RULES.md). Bracket discussion follows the legality results.


## Exact-printing legality refresh (#59)

Refresh now requests each distinct stored printing id, in batches of at most 75, through the same serialized/cached collection proxy. Names are still used by text import, but no longer identify refresh results. A real live probe confirmed two Very Cryptic Command printings with the same name and different Oracle identities; name-keyed mapping collapsed those variants and repeatedly reported mismatches. A second regression showed empty legality objects were incorrectly labeled fresh. Exact-id matching and selected-format status validation fix those causes without replacing card facts or weakening identity checks.

Coverage signatures include format and printing ids. Duplicate copies/zones share one printing request. Only surviving original entry/card objects are patched; removed/replaced cards and Maybeboard entries cannot poison results. New cards, changed printings or formats schedule fresh coverage after in-flight work. Offline, partial, invalid or mismatched results retain all stored legality and show the affected names with a retry action; a failed request cannot claim a fresh pass. Unknown/removed printing ids are not silently substituted by name. Successful refresh updates legality and its recorded date. Quantities, zones, functions and printing choices remain intact. Server headers, 120 ms spacing, timeout and five-minute cache are unchanged.

The [official Scryfall card fields](https://github.com/scryfall/api-types/blob/main/src/objects/Card/CardFields.ts) distinguish printing ids from rules identities, including same-name variants and reversible-card faces. A live collection request using `{id: printingId}` was verified on 1 November 2026; the main documentation page returned 403 in the research browser. This change does not certify the player's entire original deck or identify every possible refresh failure.

Verification: 124 native tests pass on Windows Node v24.14.1, including the two previously failing repros, exact-id forwarding/cache/validation, 75-card batching, retry, printing/format changes, removal/replacement races and data preservation. Windows desktop light/dark and 390px dark browser checks used two public same-name Very Cryptic Command variants in Main/Sideboard, confirmed fresh legality with zero unavailable data, and repeated the flow after reload. These cards correctly remain not legal in Modern; fresh data is distinct from a legal deck. Keyboard Enter opened Checks; the 390px page showed no horizontal overflow. Synthetic/public fixtures only; no personal deck dump was used. macOS/Safari and physical touch remain untested.

Implementation review: [PR #76](https://github.com/RuneBrix/magic-the-deckbuilder/pull/76).
