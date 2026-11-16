# Price estimates and comparison

This contract records application boundaries. Inspect `deckPrintingPrice` and `collectionReport` in `public/core.js`, pricing handlers in `public/app.js`, and affected collection/deck tests for current behavior. [Collection workflow](COLLECTION_WORKFLOW.md#ownership-and-budget) owns the user interaction.

## Stored quotes

Deck currency is saved per deck and survives complete deck/workspace JSON and duplication. Decks without a choice default to EUR, preserving prior ownership estimates. Cards and Ownership use this choice consistently; changing it saves atomically, cancels/discards session cheapest results and ignores late results from the old currency. Global Explore sorting/quotes remain USD and Collection text quotes remain EUR; prices and currency controls use €/$ symbols.

Card/deck displays use the stored printing and selected finish: USD has regular, foil and etched fields; EUR has regular and foil fields. Legacy entries infer the supported default finish. A missing quote stays unknown rather than borrowing another currency/finish or becoming zero. An etched EUR quote is unavailable in the supported fields. Totals use quantity-weighted integer cents and count unpriced copies separately. Basic lands (Basic supertype plus Land type, including snow basics and Wastes) are excluded from all cost totals and unpriced warnings even when priced. They retain zone/deck counts and ownership allocation. Detail rows and selected-zone copy notes disclose this exclusion; basic-only estimates show a dash rather than a zero valuation.

Refresh checks exact stored printing IDs without changing holdings, quantities, functions, zones or chosen printings. A missing/invalid quote or failed lookup retains last usable data for the same printing/finish. Retrieval time is not a promise of the market observation time or a live purchase price. Estimates exclude condition appraisal, shipping, tax, availability and checkout guarantees.

<a id="current-eur-price-coverage-and-comparison"></a>

## Current price coverage and comparison

Cheapest comparison checks every nonbasic verified rules identity across the deck in the selected currency, using English paper printings with a regular finish and valid regular quote. Each identity is paginated independently through its final page; one high-print-count card cannot mark neighboring cards incomplete. The former 200-identity/four-page grouped limits are removed. The local proxy's existing 1,000-page boundary remains explicit: reaching it without a final page reports failure and never exposes a provisional minimum. Equal prices choose a stable printing-ID order.

Progress reports completed identities and the current card/page. Failure is recorded per identity and does not discard completed cards. A completed scan without any eligible quote is distinct from an error, unfinished scan or absent rules identity. Cancellation and retry retain completed identities and restart an interrupted identity from page one. A fresh check can retain last-complete quotes visibly while rechecking; unsuccessful rechecks never replace them with partial minima. HTTP throttling stops further identities until the user retries. Session results are invalidated when currency changes and do not survive a reload.

**Apply cheapest printings** opens a review for selected estimate zones. It replaces only regular-finish, nonbasic entries with a completed verified English paper quote in the current currency. Foil/etched, unknown identities, failed/unfinished results and outside-scope entries remain unchanged. Scanning alone never changes a deck. The review names zones, changed/already-matching/skipped copy counts and individual printing changes. Cancellation, stale deck/results and failed persistence leave live and saved cards untouched.

Application retains rules identities, copy totals, zones and functions without touching inventory. Converging printing/finish entries merge quantities and union their ordered function lists in original deck-entry order; the review discloses merging. Latest known legality is retained. Changes are validated and saved as a complete staged deck before applying to live state.

An exact Cardmarket product link may be available for a missing euro quote; it does not establish a price or authorize integration with a different data source. Verify current primary documentation before changing upstream access or pricing assumptions. The [dated price-data research](archive/PRICE_DATA_RESEARCH.md) preserves original samples, sources and verification limits; its service-access statements and measurements are historical, not current guarantees.
