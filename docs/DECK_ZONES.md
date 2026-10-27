# Deck zones and construction checks

Implemented for [D03 / #3](https://github.com/RuneBrix/magic-the-deckbuilder/issues/3). The selected rule family is **Modern constructed main deck and sideboard**, not complete automation of every Magic format.

## Authoritative basis

Checked on 2026-10-27 against Wizards' [current rules-document index](https://wpn.wizards.com/en/rules-documents), its linked [Magic Tournament Rules effective February 27, 2026](https://media.wizards.com/ContentResources/WPN/MTG_MTR_2026_Feb27_EN.pdf), sections 6.1–6.2, and the [Modern format page](https://magic.wizards.com/en/formats/modern).

The implemented constructed checks require at least 60 main-deck cards, no more than 15 sideboard cards, and combined name-based copy limits across both zones. Basic supertypes and supported explicit card-text copy exceptions override the normal four-copy limit. Restricted status applies across zones. Card-pool eligibility and banned status come from stored Scryfall legality data rather than a hardcoded set/ban list; refresh before playing. A command zone is rejected for Modern.

## Storage and interaction

- Entries retain the existing card, quantity and personal roles, with `zone` set to `main`, `sideboard` or `command`. The same Oracle identity can occur once in each zone. Same-zone duplicates remain invalid backups. Construction copy limits aggregate English card names across the relevant zones, even if stored identifiers differ.
- Old entries without a zone map to main deck; legacy `commander: true` maps to command zone. Loading normalizes zones in memory without writing storage. JSON restore accepts both schemas; subsequent backups contain explicit zones. Existing commander metadata and personal tags remain intact.
- Cards shows all three zones with separate counts and quantity controls. Inspect a specific row to move that entry's copies between zones. Moves merge matching destination entries and union roles; exceeding the storage ceiling of 500 copies aborts without mutation. Editing roles can still explicitly remove roles. No copy is silently discarded to satisfy a construction rule.
- Discovery and comparison Add actions add to main deck. Adding from an inspected zone row targets that row's zone. Statistics and progress count main deck only for constructed, or main plus command zone for Commander; sideboards are excluded. Navigation can show the total number of stored cards.
- Text imports accept optional `Main deck`, `Sideboard`, `Command zone` or `Commander` headings. Lists without headings still go to main deck. Imports remain atomic. Text exports preserve zones and quantities; JSON is the complete backup including personal roles. Broader third-party interchange remains [D06 / #6](https://github.com/RuneBrix/magic-the-deckbuilder/issues/6).

## Check categories and coverage

**Failed checks** report confirmed violations of supported rules. **Data unavailable** reports missing or unrecognized stored legality/Oracle data; it does not label a card banned. **Manual review** reports unsupported rules, including companion cards, unknown copy-limit text and Commander cases. Passing supported checks is not tournament certification.

Commander retains partial checks: 100 cards in main plus command zone, singleton/copy exceptions, one copy per commander and single-command identity. Sideboard/outside-game entries are excluded from the 100 and explicitly require review. Pair compatibility, multiple-command identity, current special commander eligibility and basic-land type restrictions remain in [follow-up #13](https://github.com/RuneBrix/magic-the-deckbuilder/issues/13). Nonstandard commander eligibility is reported as manual rather than conclusively rejected. No card is moved merely by changing formats.

Companion designation and starting-deck predicates remain in [follow-up #14](https://github.com/RuneBrix/magic-the-deckbuilder/issues/14). Companion cards can be stored, but do not receive a false automatic approval. Other format presets use shared constructed checks with a visible format-specific manual-review notice; Modern is the rule family verified by this issue.

Tests include complete 60+15 constructed and 99+1 legacy Commander examples, across-zone name/copy and restriction cases, missing data, companions, old/new JSON backup behavior, atomic moves and text zone round trips. UI checks and platform limits are recorded in the implementation PR.
