# Roadmap

[GitHub Issues](https://github.com/RuneBrix/magic-the-deckbuilder/issues) holds acceptance criteria and live progress/review state. This page groups future direction, not a second ticket tracker or delivery promise. See [FEATURES.md](FEATURES.md) for behavior, [CHANGELOG.md](../CHANGELOG.md) for history and [DEVELOPMENT.md](DEVELOPMENT.md) for the feedback-to-merge cycle.

| Direction | Remaining scope / decision | Issues and contracts |
| --- | --- | --- |
| Deck editor/library refinements | Stable card inspection, concise metadata, aligned headers and navigation refinements from selected feedback. | [Feedback index #162](https://github.com/RuneBrix/magic-the-deckbuilder/issues/162); [workspace](DECK_WORKSPACE.md). |
| Card discovery and functions | Refine guided filter spacing, scoped clearing and primary-function assignment across add paths. Existing details and add/edit dialogs remain the baseline. | [#162](https://github.com/RuneBrix/magic-the-deckbuilder/issues/162); [discovery](UNIFIED_SEARCH.md), [details](CARD_DETAILS.md), [taxonomy](TAG_TAXONOMY.md). |
| Construction (D03) | Any extension beyond implemented bounded Commander/companion checks needs selected criteria and current primary rules evidence. | [Supported scope](CONSTRUCTION_RULES.md); [zone/check boundaries](DECK_ZONES.md). |
| Cross-platform verification (D05) | Manual macOS/browser checks, separate from the configured Node CI matrix. | [#5](https://github.com/RuneBrix/magic-the-deckbuilder/issues/5); [platform evidence](../README.md#platform-verification-d05--5). |
| Ownership/budgets (D07) | Collection scale/import recovery, simpler cost presentation and explicit printing/currency changes from selected feedback. Reviewed additive/replacement imports are already implemented. | [#162](https://github.com/RuneBrix/magic-the-deckbuilder/issues/162); [current workflow](COLLECTION_WORKFLOW.md), [price boundaries](PRICE_DATA.md). |

## Decisions retained

D01 uses a dated [tag snapshot](TAG_TAXONOMY.md); live sync is absent. D02 retains [broadening](EFFECT_COMPARISON.md), with candidates/comparison removed by #47; scoring is undecided. D04 uses [portable files](PORTABLE_STORAGE.md), deferring cloud sync/accounts. D06 supports the selected [Archidekt text contract](DECKLIST_INTEROP.md), not every format. D08 uses [source launchers](STARTUP.md), deferring native packaging. D09 established the [retained visual system](../DESIGN.md).

Chromium acceptance evidence for empty-zone, statistics and persistent-navigation refinements (#53/#57/#61) is recorded in [FEATURES.md](FEATURES.md#validation-baseline), with remaining platform limits. Consult GitHub for live review state.

New feedback becomes issues when requested. Select implementation scope from those issues, keep revisions in the same PR and merge after developer inspection and approval.
