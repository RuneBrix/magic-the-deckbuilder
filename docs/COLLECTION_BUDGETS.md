# Combined collection and budget workflow (D07)

On 1 November 2026 the user chose **collection ownership and budget planning together** for [#7](https://github.com/RuneBrix/magic-the-deckbuilder/issues/7). This PR resolves the decision and scopes implementation; it does not ship inventory, budget totals or missing-card estimates.

## Selected workflow and working defaults

A player edits owned lots, opens a deck and sees deck demand, owned/missing copies, a full deck estimate and a missing-copy estimate together. The default scope is Main + Command + Sideboard, excluding Maybeboard with a visible label. One optional EUR budget compares against the missing-copy estimate; a full-deck comparison can be chosen explicitly. These currency/matching/valuation policies are proposed implementation defaults, not additional user statements; they remain open to feedback during review.

| Concern | Working default and boundary |
| --- | --- |
| Ownership | Manual lots keyed by stored printing + finish + optional condition; quantities are physical holdings, independent of deck quantities. |
| Matching | Any printing/finish of the same verified rules identity may satisfy a deck. Preserve exact lot metadata so a future explicit exact-printing mode is possible. Unresolved rules identity is shown, never guessed by name alone. |
| Reuse | Each deck is evaluated independently; copies are not reserved across simultaneously assembled decks. |
| Quote | Stored deck printing, regular EUR quote from Scryfall. This is an estimate of selected deck printings, not an appraisal of owned lots or a cheapest-printing finder. |
| Finish/condition | Lots retain finish and optional condition. First estimates use regular-printing quotes, disclose that simplification and never silently fall back to foil/USD. Foil/etched-only or unquoted printings remain unpriced. No condition-based adjustment. |
| Currency | EUR, with integer-cent arithmetic and explicit currency labels. No FX conversion. Existing individual-card USD display/sorting remains a separate labeled capability. |
| Costs | Exclude shipping, tax, seller availability and checkout guarantees. |
| Unknown prices | Null/absent/malformed values are unknown, not zero. Show the priced subtotal and number of unpriced copies. A known subtotal above budget is a confirmed overage; a lower incomplete subtotal cannot establish under-budget status. |
| Freshness | Label saved/undated estimates. Record successful retrieval time for new quotes; disclose that it is not the market observation time. Application policy: request daily updates at most, retain last-good data on failure and mark it as saved. No promise of live market prices. |

The [source evidence](PRICE_DATA.md) distinguishes current verified Scryfall facts from application policy and documentation that could not be fetched. Price refresh must use stored printing ids, obey the existing bounded/serialized proxy, and update only prices/freshness. It cannot alter holdings, deck quantities or chosen printings. Opening and editing stored holdings/estimates remains usable offline once the app runs.

## Concrete accounting examples

If a deck needs two copies in Main and one in Sideboard and the player owns two, its total demand is three and its deficit is one. Subtract ownership after combining zones; do not subtract those same two owned copies separately in each zone. Maybeboard ideas do not increase demand by default.

Two different decks may each show an owned Sol Ring from the same collection; that means each can be built individually, not that two physical copies exist. A future reservation system is separate scope.

When demand uses differently priced printings, allocate owned copies in a stable, disclosed order (Main, Command, Sideboard, then printing id), leaving a deterministic estimate for the remaining selected entries. Do not imply the result optimizes purchases. A missing quote leaves its portion unpriced rather than treating it as free.

## Preservation and interchange

The inventory is workspace-wide and budgets belong to decks. Extend portable files with a version that older readers reject; v1's reader ignores unknown fields, so silently adding inventory to a v1 envelope would risk losing it on re-export. Continue reading v1/legacy decks, preserving their cards, zones, ordered functions, printings and brackets. A deck-only import leaves existing holdings unchanged. A complete inventory import must preview keep/replace choices and never silently sum repeated backup imports. Persist before applying and retain current data on failure. No cloud service, database, account or personal collection dump is introduced.

External collection imports/updates are scoped separately from manual ownership and price display. Collect representative formats before choosing mappings; an ordinary decklist does not prove ownership. Reimport and replacement policies require preview and explicit confirmation.

## Implementation issues

- [#70: owned copies and portable storage](https://github.com/RuneBrix/magic-the-deckbuilder/issues/70).
- [#71: combined budget and missing-copy estimates](https://github.com/RuneBrix/magic-the-deckbuilder/issues/71), delivered with #70 for the combined workflow.
- [#72: collection interchange](https://github.com/RuneBrix/magic-the-deckbuilder/issues/72), dependent on real selected-format examples and explicit duplicate/update policies.

No implementation or live-price validation is claimed here. Decision/document review and link/diff checks are the validation for this PR.
