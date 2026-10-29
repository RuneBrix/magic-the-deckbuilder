# Candidate overview and effect comparison

[D02 / #2](https://github.com/RuneBrix/magic-the-deckbuilder/issues/2) established manual two-card comparison and reversible search broadening without ranking. [#24](https://github.com/RuneBrix/magic-the-deckbuilder/issues/24) puts that optional comparison inside a separate candidate workflow. [Chosen scope and acceptance](CANDIDATES.md) were recorded before implementation.

## Workflow

Save candidate on a result or in details collects a card without leaving exploration. Candidates opens a separate overview for up to 20 distinct rules identities, showing full portrait artwork, mana/type/color/identity/Oracle text, release and recorded role/search context. Inspect opens complete details; Add names its tracked destination or requires a chooser with no tracker. Remove candidate also removes its comparison selection. Clear candidates is explicit. Return to exploration restores the current query/results/sort/pagination state.

The shortlist is session-only and independent of deck storage/backups. It survives searches and navigation but clears on reload. A second printing of an existing identity is the same candidate; remove and save again to choose a different snapshot. Stored candidate data and roles are snapshots, not live synchronized claims.

Compare candidate optionally selects at most two cards for an attribute table. Comparison stays secondary inside the overview. A saved result records the completed result query and broadening explanation even if the primary query has since been edited. Selected guided tags are search context; individual membership is never inferred, particularly for OR groups. Manually saved cards carry no query-membership claim. There is no inferred equivalence, upgrade recommendation, synergy or best-card score.

## Broadening and restoration

Broaden this search is a separate secondary disclosure after results. Ignore removes one supported independent condition while retaining every other source expression. The complete all/any function-tag group is removed together, because removing one OR operand could narrow results. Original/current queries and the ignored condition remain visible; Return to original search restores the exact source query, including after an upstream error. Further choices always start from the same original. Sorting retains broadening; applying other search controls begins a new search.

Advanced/complex source expressions remain intact and locked conditions are not offered for relaxation. Removing color or legality criteria may expose unsuitable cards, and loaded result pages are not exhaustive. See [Unified search](UNIFIED_SEARCH.md) for projection boundaries.

Native Node checks cover candidate limits/deduplication, immutable recorded provenance, pair limits/removal, independent tracker context, unchanged deck storage/query state, broadening/restoration and stale search responses. Browser checks cover the separate overview, optional table, required destination, keyboard focus and desktop/mobile light/dark layout; platform limits are recorded in the PR.
