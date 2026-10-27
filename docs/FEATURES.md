# Feature status

This inventory describes what the app does today. GitHub Issues track future work; linked pull requests and commits record its implementation. Update this file when behavior changes.

**Implemented** means available in the MVP, not exhaustively verified. **Partial** names a known ceiling. **Planned** means not implemented and not a delivery promise.

| Capability | Status | Current behavior / gap | Evidence |
| --- | --- | --- | --- |
| Create, rename, delete and switch decks | Implemented | Seven format presets; no account needed | `public/app.js` |
| Save decks | Partial | Browser-local storage; no device sync | `public/app.js`; backup validation test |
| Add/remove card copies | Implemented | Shared deck panel beside discovery | Browser add/persistence check |
| Card exploration | Implemented | Scryfall search, details, full images, sorting, result batches | Live search verified |
| Guided card filters | Implemented | Name, Oracle text, type, mana value/cost, color identity, format | Query composition test |
| Advanced Scryfall syntax | Implemented | Search bar accepts native syntax | `queryFor` in `public/core.js` |
| Function-tag discovery | Implemented | Search 4,590 snapshot tags by name/alias; browse verified broader/narrower links, curated starting points, custom entry, all/any matching and final query; dated snapshot, no live sync | [#1](https://github.com/RuneBrix/magic-the-deckbuilder/issues/1); [source/update limits](TAG_TAXONOMY.md); `test/tags.test.mjs` |
| Effect comparison | Implemented | Manually select two cards, relax one guided condition with original-query restoration, and compare attributes and explicit search/role context; no inferred equivalence | [D02 / #2](https://github.com/RuneBrix/magic-the-deckbuilder/issues/2); [workflow and limits](EFFECT_COMPARISON.md); comparison/workspace tests |
| Synergy recommendations | Planned | No similarity ranking, automatic upgrade recommendation or synergy scoring; separate scope decision | [D02 scope](https://github.com/RuneBrix/magic-the-deckbuilder/issues/2) |
| Deck statistics | Implemented | Quantity-weighted curve, average nonland mana value, types, card colors, user role tags | Statistics test |
| Format legality | Partial | Main-deck size, stored legality, copy limits, single commander, color identity | Legality tests; roadmap D03 |
| Current card data | Partial | Explicit refresh; server caches responses for five minutes | `server.mjs`, refresh action |
| Text decklist import/export | Partial | Quantities and names; import is atomic; no sideboards or preserved roles in text export | Parser test and browser import checks |
| JSON backup/restore | Implemented | Preserve complete decks and roles; restore adds decks | Backup and URL-validation tests |
| Responsive interface | Implemented | Desktop inspector; mobile panel shortcut and backup controls | Desktop/mobile browser checks |
| Focused workspace and appearance | Implemented | Expandable filters, function tags and query; Settings contains backups and persisted light/dark/device appearance; self-hosted typefaces and custom SVG navigation icons | [#9](https://github.com/RuneBrix/magic-the-deckbuilder/issues/9); `test/workspace.test.mjs`; desktop/mobile browser checks |
| macOS support | Partial | Cross-platform Node 22+ implementation; directly tested on Windows only | Roadmap D05 |
| Collection ownership | Planned | No inventory of owned cards | Roadmap D07 |
| Price and budget planning | Partial | Individual prices from Scryfall; no deck budget totals or alerts | Roadmap D07 |
| Native desktop application | Planned | Runs in a browser today; packaging undecided | Roadmap D08 |

## Validation baseline

The initial MVP passed eight automated checks (`npm test`) and live browser checks for search, card addition, reload persistence, atomic imports, and desktop/mobile layouts. These are the baseline, not a claim of full feature coverage. New fixes need validation appropriate to their behavior.

See [the roadmap](ROADMAP.md) for proposed work and [the development workflow](DEVELOPMENT.md) for how status changes are recorded.
