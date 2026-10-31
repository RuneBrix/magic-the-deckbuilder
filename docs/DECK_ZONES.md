# Deck zones and construction checks

Implemented for [D03 / #3](https://github.com/RuneBrix/magic-the-deckbuilder/issues/3). The selected rule family is **Modern constructed main deck and sideboard**, not complete automation of every Magic format.

## Authoritative basis

Checked on 2026-10-27 against Wizards' [current rules-document index](https://wpn.wizards.com/en/rules-documents), its linked [Magic Tournament Rules effective February 27, 2026](https://media.wizards.com/ContentResources/WPN/MTG_MTR_2026_Feb27_EN.pdf), sections 6.1–6.2, and the [Modern format page](https://magic.wizards.com/en/formats/modern).

The implemented constructed checks require at least 60 main-deck cards, no more than 15 sideboard cards, and combined name-based copy limits across both zones. Basic supertypes and supported explicit card-text copy exceptions override the normal four-copy limit. Restricted status applies across zones. Card-pool eligibility and banned status come from stored Scryfall legality data rather than a hardcoded set/ban list; review freshness before playing. A command zone is rejected for Modern.

## Storage and interaction

- Entries retain the existing card, quantity and personal roles, with `zone` set to `main`, `sideboard`, `command` or `maybeboard`. The same Oracle identity can occur once in each zone. Same-zone duplicates remain invalid backups. Construction copy limits aggregate English card names across the relevant zones, even if stored identifiers differ.
- Old entries without a zone map to main deck; legacy `commander: true` maps to command zone. Loading normalizes zones in memory without writing storage. JSON restore accepts both schemas; subsequent backups contain explicit zones. Existing commander metadata and personal tags remain intact.
- Cards shows all four zones with separate counts and quantity controls. Inspect a specific row to move that entry's copies between zones. Moves merge matching destination entries and union roles; exceeding the storage ceiling of 500 copies aborts without mutation. Editing roles can still explicitly remove roles. No copy is silently discarded to satisfy a construction rule.
- Discovery quick Add actions add to main deck; Add to… explicitly chooses any zone, including Maybeboard. Adding from an inspected zone row targets that row's zone. Statistics and progress count main deck only for constructed, or main plus command zone for Commander; sideboards and Maybeboard are excluded. Navigation can show the total number of stored cards.
- Text imports accept optional `Main deck`, `Sideboard`, `Command zone`, `Commander` or `Maybeboard` headings. Lists without headings still go to main deck. Imports remain atomic. Text exports preserve zones and quantities; JSON is the complete backup including personal roles. Broader third-party interchange remains [D06 / #6](https://github.com/RuneBrix/magic-the-deckbuilder/issues/6).

## Check categories and coverage

**Failed checks** report confirmed violations of supported rules. **Data unavailable** reports missing or unrecognized stored legality/Oracle data; it does not label a card banned. **Manual review** reports unsupported rules, including companion cards, unknown copy-limit text and Commander cases. Passing supported checks is not tournament certification.

Commander retains partial checks: 100 cards in main plus command zone, singleton/copy exceptions, one copy per commander and single-command identity. Sideboard/outside-game entries are excluded from the 100 and explicitly require review. Pair compatibility, multiple-command identity, current special commander eligibility and basic-land type restrictions remain in [follow-up #13](https://github.com/RuneBrix/magic-the-deckbuilder/issues/13). Nonstandard commander eligibility is reported as manual rather than conclusively rejected. No card is moved merely by changing formats.

Companion designation and starting-deck predicates remain in [follow-up #14](https://github.com/RuneBrix/magic-the-deckbuilder/issues/14). Companion cards can be stored, but do not receive a false automatic approval. Other format presets use shared constructed checks with a visible format-specific manual-review notice; Modern is the rule family verified by this issue.

Tests include complete 60+15 constructed and 99+1 legacy Commander examples, across-zone name/copy and restriction cases, missing data, companions, old/new JSON backup behavior, atomic moves and text zone round trips. UI checks and platform limits are recorded in the implementation PR.


## Automatic legality freshness (#28) and presentation (#27)

Startup/reload opens the library and does not refresh deck legality until a deck editor or tracked exploration is opened. Opening a full deck or selecting a tracker refreshes that deck on first access in the session; the library does not refresh all stored decks. Adding/removing a distinct card identity/name triggers another automatic refresh. Quantity and role edits do not. Zone edits trigger refresh when they change the set of relevant non-Maybeboard cards. Hidden trackers still identify the relevant deck.

Names are deduplicated and sorted, split into batches of at most 75, and processed sequentially; deck refreshes share one client queue and the server's existing global rate queue/cache. Repeated actions join the in-flight deck request. Reload resets session freshness but does not bypass the server's five-minute response cache. Fresh means a successful lookup this session, possibly cached; after five minutes it is labeled stale, with a secondary retry. After reload, opening an editor or tracked exploration starts a new session refresh. Failed refreshes retain all last usable legality values and expose recovery rather than retrying endlessly.

Maybeboard is outside the playing deck by the user’s explicit decision (#44): it contributes no statistics, construction failures/data warnings or Game Changer evidence. It is excluded from legality lookup and from in-flight response validation/patching if an entry moves there. Only `legalities` are patched into surviving relevant entries. Stored printing/artwork, Oracle facts, quantities, roles, zones and deck timestamps are preserved. Missing or mismatched cards fail the refresh atomically. Deleted decks and removed/replaced entries cannot be revived; newly added identities are picked up by a subsequent refresh. Editing remains available while requests run. Session status is not exported as durable proof of current legality, and no backup schema changes.

Checks remain in the dedicated workspace. Red failure sections, amber data/freshness notices, neutral informational/manual sections and green supported-pass states include authored SVG symbols and explicit labels. Existing messages retain card/zone names; unsupported rules remain manual and missing/stale data cannot produce a green overall pass. Commander/companion automation remains #13/#14.
