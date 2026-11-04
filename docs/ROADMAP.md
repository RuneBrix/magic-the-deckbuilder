# Roadmap

[GitHub Issues](https://github.com/RuneBrix/magic-the-deckbuilder/issues) holds acceptance criteria and live progress/review state. This page groups future direction, not a second ticket tracker or delivery promise. See [FEATURES.md](FEATURES.md) for behavior, [CHANGELOG.md](../CHANGELOG.md) for history and [DEVELOPMENT.md](DEVELOPMENT.md) for the feedback-to-merge cycle.

| Direction | Remaining scope / decision | Issues and contracts |
| --- | --- | --- |
| Deck editor/library refinements | Refine existing controls, grouping, drag destinations, hover details and library layout from current feedback. | [#90](https://github.com/RuneBrix/magic-the-deckbuilder/issues/90), [#91](https://github.com/RuneBrix/magic-the-deckbuilder/issues/91), [#92](https://github.com/RuneBrix/magic-the-deckbuilder/issues/92), [#93](https://github.com/RuneBrix/magic-the-deckbuilder/issues/93); [workspace](DECK_WORKSPACE.md). |
| Card details/deck functions | Global details, separate add/edit dialogs and one visible primary function; automatic membership preserves personal overrides. | [#46](https://github.com/RuneBrix/magic-the-deckbuilder/issues/46), [#99](https://github.com/RuneBrix/magic-the-deckbuilder/issues/99), [#100](https://github.com/RuneBrix/magic-the-deckbuilder/issues/100), [#101](https://github.com/RuneBrix/magic-the-deckbuilder/issues/101), [#102](https://github.com/RuneBrix/magic-the-deckbuilder/issues/102); [details](CARD_DETAILS.md), [taxonomy](TAG_TAXONOMY.md). |
| Construction (D03) | Commander eligibility/pairings and companion predicates beyond bounded checks. | [#13](https://github.com/RuneBrix/magic-the-deckbuilder/issues/13), [#14](https://github.com/RuneBrix/magic-the-deckbuilder/issues/14); [coverage](DECK_ZONES.md). |
| Cross-platform verification (D05) | Manual macOS/browser checks, separate from the configured Node CI matrix. | [#5](https://github.com/RuneBrix/magic-the-deckbuilder/issues/5); [platform evidence](../README.md#platform-verification-d05--5). |
| Ownership/budgets (D07) | Extend implemented ownership/EUR planning: repeat-upload/replacement policy, clearer scope/totals, partial budgets and broader price coverage. | [#72](https://github.com/RuneBrix/magic-the-deckbuilder/issues/72), [#107](https://github.com/RuneBrix/magic-the-deckbuilder/issues/107), [#109](https://github.com/RuneBrix/magic-the-deckbuilder/issues/109), [#110](https://github.com/RuneBrix/magic-the-deckbuilder/issues/110), [#111](https://github.com/RuneBrix/magic-the-deckbuilder/issues/111); [current workflow](COLLECTION_WORKFLOW.md). |

## Decisions retained

D01 uses a dated [tag snapshot](TAG_TAXONOMY.md); live sync is absent. D02 retains [broadening](EFFECT_COMPARISON.md), with candidates/comparison removed by #47; scoring is undecided. D04 uses [portable files](PORTABLE_STORAGE.md), deferring cloud sync/accounts. D06 supports the selected [Archidekt text contract](DECKLIST_INTEROP.md), not every format. D08 uses [source launchers](STARTUP.md), deferring native packaging. D09 established the [retained visual system](../DESIGN.md).

Browser verification for implemented empty-zone, statistics and persistent-navigation refinements (#53/#57/#61) remains required; [FEATURES.md](FEATURES.md#validation-baseline) records that limitation. Consult GitHub for live review state.

New feedback becomes issues when requested. Select implementation scope from those issues, keep revisions in the same PR and merge after developer inspection and approval.
