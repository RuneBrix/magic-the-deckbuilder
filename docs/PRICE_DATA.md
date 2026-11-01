# Price-data evidence for D07

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
