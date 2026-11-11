# Price-data evidence for D07

## Current EUR price coverage and comparison

On 2026-11-10 three first pages of English paper Scryfall printing searches returned 175 printings each. This was an alphabetical sample, so the counts describe those pages only.

| Printing sample | Regular EUR quotes | Foil EUR quotes | Cardmarket IDs |
| --- | ---: | ---: | ---: |
| Regular finish available | 174 | 117 | 175 |
| Foil only | 0 | 157 | 158 |
| Etched only | 0 | 0 | 175 |

For example, Abrade `trc` #449 returned HTTP 200 with both EUR fields null and Cardmarket ID 919573. Foil-only Aang, Air Nomad `tle` #210 returned €0.87 in `eur_foil`. Etched-only Abaddon the Despoiler `40k` #319 had an exact Cardmarket ID and neither EUR quote field. A failed refresh is different from a successful response with a missing quote. In either case the app keeps any last usable quote for the same printing and finish. A failed exact-ID batch leaves the saved estimates intact. [Scryfall price fields](https://github.com/scryfall/api-types/blob/main/src/objects/Card/values/Prices.ts) · [Scryfall search API](https://scryfall.com/docs/api/cards/search)

Cardmarket currently accepts no new API access applications. Its public daily price guide and product catalogue can be incorporated into apps without API credentials or extra permission. The Scryfall partnership already provides Cardmarket EUR data and exact product IDs where mapped. A separate guide import would require choosing a comparable price metric and verifying finish coverage, particularly for etched cards. Arcana uses `eur` and `eur_foil` from Scryfall and offers the documented exact-product URL for missing quotes. It does not use a regular quote to fill a foil or etched gap. The product redirect returned HTTP 403 in the research environment. [Cardmarket API access](https://help.cardmarket.com/en/cardmarket-api) · [Price guide announcement](https://news.cardmarket.com/en/Magic/were-making-the-price-guide-and-product-catalogue-available-for-download) · [Scryfall partnership and product links](https://insight.cardmarket.com/en/Articles/scryfall-x-cardmarket)

The comparison uses Scryfall-searchable English paper printings with a regular finish and a valid regular EUR quote. It matches Oracle IDs, so names or collector numbers alone cannot select a comparable printing. A live two-ID query for Sol Ring and Arcane Signet returned 185 eligible-by-language/game/finish printings across pages. Arcana checks at most 200 distinct Oracle IDs in sorted batches of eight, with up to four pages per batch. An unfinished batch stays unpriced, even if it contains a candidate quote. The shared proxy serializes and caches identical requests for five minutes. Known costs use integer cents and deck quantities. Unknown copies are counted separately. The comparison covers quoted card prices, excluding shipping, taxes and availability. [Scryfall API access policy](https://scryfall.com/docs/faqs/i-m-having-trouble-accessing-the-scryfall-api-or-i-m-blocked-17) · [Cardmarket shipping](https://help.cardmarket.com/en/ShippingCosts)

## Original D07 research

Access date: 2026-11-01. Research for [collection ownership and deck budget planning (#7)](https://github.com/RuneBrix/magic-the-deckbuilder/issues/7); this note records evidence and proposed boundaries, not shipped behavior.

## Verified first-party facts

Scryfall's own API type definitions describe card prices as daily information. The concrete price type exposes `usd`, `usd_foil`, `usd_etched`, `eur`, `eur_foil`, and `tix`, each `string | null`. Its descriptive comment also mentions `eur_etched`, but the concrete type does not declare that property; do not assume an EUR etched quote exists. [Card fields](https://github.com/scryfall/api-types/blob/main/src/objects/Card/CardFields.ts), [price type](https://github.com/scryfall/api-types/blob/main/src/objects/Card/values/Prices.ts).

`id` identifies a Scryfall card object. `oracle_id` identifies the rules identity across reprints; distinct same-name objects can have different Oracle IDs. The `reversible_card` layout has Oracle IDs on its faces instead of the root. Printing fields include set, collector number, language and available finishes. Consequently, use the stored printing's `id` for a price lookup and keep rules identity separate for ownership matching. This consequence is an application design inference. [Card identifiers and printing fields](https://github.com/scryfall/api-types/blob/main/src/objects/Card/CardFields.ts).

Scryfall asks clients to remain below 10 API requests per second. A `429` requires reducing load; repeatedly retrying through it can cause a block. Large batches should use bulk downloads. API calls need an explicit relevant `User-Agent`, an `Accept` header and HTTPS. These API rate limits do not apply to `*.scryfall.io` file origins. [Official access/rate-limit FAQ](https://scryfall.com/docs/faqs/i-m-having-trouble-accessing-the-scryfall-api-or-i-m-blocked-17).

## Proposed application policy

For the combined collection/budget feature, the proposed baseline is the deck entry's stored printing and its regular EUR (`prices.eur`) quote. This is a scope assumption for feedback, not a verified user decision or a cheapest-printing search. Keep USD separate; do not silently substitute USD for EUR or a foil quote for a missing regular quote.

Treat null, absent or invalid values as unknown, never zero. Show priced subtotals with the count of unpriced copies so a partial estimate cannot appear complete. Convert accepted decimal strings explicitly, preferably to integer cents for arithmetic. Label the result an estimate: it does not appraise a particular copy's condition, shipping, tax or a guaranteed purchase price. These are proposed product limits, not claims that Scryfall provides those adjustments.

Record when the app fetched a quote, label previously stored prices as saved estimates, and retain that timestamp after failed refreshes. A retrieval time does not prove when the underlying market observation occurred. A daily refresh/cache interval is consistent with the verified daily-data description; it is an application policy rather than a verified upstream freshness guarantee.

## Verification limits

The official [API overview](https://scryfall.com/docs/api), [card-object documentation](https://scryfall.com/docs/api/cards) and [bulk-data documentation](https://scryfall.com/docs/api/bulk-data) returned HTTP 403 through the research browser. The official GitHub types and indexed official FAQ above were accessible. Exact claims about once-per-24-hours price refresh, a recommended 24-hour cache, bulk rebuild frequency or bulk prices becoming stale after 24 hours could not be verified directly from their owning documentation in this session. Recheck those pages before presenting such timing as a current Scryfall guarantee. No live card-price response or condition-specific pricing contract was verified.
