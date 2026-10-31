# Reversible search broadening

[D02 / #2](https://github.com/RuneBrix/magic-the-deckbuilder/issues/2) introduced search broadening alongside manual comparison. [#47](https://github.com/RuneBrix/magic-the-deckbuilder/issues/47) removes the candidate shortlist and optional pair comparison at user request; [removal record](CANDIDATES.md). Independent broadening remains available in Explore cards.

## Broadening and restoration

Broaden this search is a separate secondary disclosure after results. Ignore removes one supported independent condition while retaining every other source expression. The complete all/any function-tag group is removed together, because removing one OR operand could narrow results. Original/current queries and the ignored condition remain visible; Return to original search restores the exact source query, including after an upstream error. Further choices always start from the same original. Sorting retains broadening; applying other search controls begins a new search.

Advanced/complex source expressions remain intact and locked conditions are not offered for relaxation. Removing color or legality criteria may expose unsuitable cards, and loaded result pages are not exhaustive. See [Unified search](UNIFIED_SEARCH.md) for projection boundaries.

Native Node checks cover exact restoration, original-condition relaxation, upstream failures, pagination, stale responses and preserved search state across home navigation. Browser verification and platform limits are recorded in the implementing PR. No inferred equivalence, upgrade recommendation, synergy or best-card score is provided.
