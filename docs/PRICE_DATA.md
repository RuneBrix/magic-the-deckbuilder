# Price estimates and comparison

This contract records application boundaries. Inspect `storedEuroPrice`, `deckPrintingPrice` and `collectionReport` in `public/core.js`, pricing handlers in `public/app.js`, and affected collection/deck tests for current behavior. [Collection workflow](COLLECTION_WORKFLOW.md#ownership-and-budget) owns the user interaction.

## Stored quotes

Card/deck displays use the stored printing and selected finish: USD has regular, foil and etched fields; EUR has regular and foil fields. Legacy entries infer the supported default finish. A missing quote stays unknown rather than borrowing another currency/finish or becoming zero. An etched EUR quote is unavailable in the supported fields. Totals use quantity-weighted integer cents and count unpriced copies separately.

Refresh checks exact stored printing IDs without changing holdings, quantities, functions, zones or chosen printings. A missing/invalid quote or failed lookup retains last usable data for the same printing/finish. Retrieval time is not a promise of the market observation time or a live purchase price. Estimates exclude condition appraisal, shipping, tax, availability and checkout guarantees.

## Current EUR price coverage and comparison

Cheapest comparison considers searchable English paper printings with a regular finish and valid regular EUR quote, matched by verified rules identity. Completed searches contribute their lowest quote; unfinished searches remain incomplete rather than presenting a provisional candidate as complete. The operation preserves deck entries and uses existing bounded, serialized/cached requests. Inspect the handler for current batch/page limits rather than copying them into future implementations from an old report.

An exact Cardmarket product link may be available for a missing quote; it does not establish a price or authorize integration with a different data source. Verify current primary documentation before changing upstream access or pricing assumptions. The [dated price-data research](archive/PRICE_DATA_RESEARCH.md) preserves original samples, sources and verification limits; its service-access statements and measurements are historical, not current guarantees.
