# Effect comparison

[D02 / #2](https://github.com/RuneBrix/magic-the-deckbuilder/issues/2) uses the manual comparison workflow chosen by the user: keep the original query, explicitly relax one guided condition, and compare two cards with the change explained. There is no recommendation or synergy ranking algorithm.

## Workflow

1. Search for an effect with function tags, Oracle text or other filters. Choose **Compare** below a result, or **Compare this card** in card details. Select up to two distinct Oracle identities; remove a selection before choosing a third.
2. Open **Compare alternatives** to review mana value/cost, colors, color identity, type, full Oracle text, role context, why the card was shown and its source query. Cards stay selected across searches and result batches until removed or the page reloads. Comparison does not write deck storage.
3. Use **Ignore …** to remove one active guided condition. Supported conditions are name, Oracle phrase, type, mana value, mana cost, color identity, the function-tag group, and format legality. The complete tag group is removed as one condition: removing just one OR operand would narrow the search.
4. The original and alternative queries and the ignored condition are shown explicitly. Further Ignore choices start from the same original filters, rather than accumulating relaxations. **Return to original search** restores those filters and searches again, including after an upstream error. Sorting alternatives retains the relaxation; applying other search controls starts a new search. Comparisons remain selected.

## Explanations and limits

- Alternative results match the query with the named condition removed. Every other original condition is retained. This is a reason to inspect a candidate, not proof that it has the same effect or is better for the deck. Removing color or legality filters may produce unsuitable cards.
- The unified query projects supported independent clauses into guided controls, including conditions typed as syntax. Broadening can remove those represented conditions. Unsupported or complex expressions remain query-only and preserve their source text; a restriction repeated there still applies. The UI offers no relaxation for a condition locked by a mixed/unsupported group. See [Unified search](UNIFIED_SEARCH.md) for the parsing boundary.
- Results retain the selected Scryfall sort and ordinary pagination. Loaded batches are not exhaustive. The app does not compute similarity, synergy, equivalence, upgrades or a best-card score.
- A selected result records the actual completed result query and its relaxation reason, even if controls have since been edited. Deck cards selected through details are labeled as manual selections with no query-membership claim. Comparisons retain their selected card data and context; they are not live synchronized snapshots.
- Functional roles show personal deck role tags recorded at selection plus the guided tags searched with all/any semantics. Individual Scryfall tag membership is not available in ordinary card responses and is **not** inferred from the query, especially an OR group. Oracle text remains the basis for manual effect comparison.
- Card addition and inspection reuse the existing deck controls. An earlier selected card remains available even after a new search replaces its result batch. No deck is replaced or edited by broadening or comparing.

## Verification

Native Node checks cover single-condition changes, preservation of raw syntax and original filters, all/any tag-group handling, unsupported choices, source-query provenance, selection limits, restoration after failure and stale-response protection. Desktop/mobile browser checks validate the interaction and layout; platform-specific limits are recorded in the implementation PR.
