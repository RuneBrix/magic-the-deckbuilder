# Roadmap

[GitHub Issues](https://github.com/RuneBrix/magic-the-deckbuilder/issues) are the source of truth for work status. This document groups the intended work and keeps the reasoning findable. Priorities below are proposals for feedback, not commitments.

| Reference | Work | Proposed priority | Scope | GitHub issue |
| --- | --- | --- | --- | --- |
| D01 | Discover and navigate a broader function-tag taxonomy | Implemented | Dated official snapshot, alias search and verified relationship navigation; [limits/update strategy](TAG_TAXONOMY.md) | [#1](https://github.com/RuneBrix/magic-the-deckbuilder/issues/1) |
| D02 | Explain reversible search broadening | Implemented revised scope (#47) | Reversible single-condition relaxation; candidate shortlist and manual pair comparison removed; [workflow/limits](EFFECT_COMPARISON.md). Automatic scoring remains a separate decision | [#2](https://github.com/RuneBrix/magic-the-deckbuilder/issues/2) |
| D03 | Extend format checks and support deck zones | Implemented selected family | [Modern construction and explicit zones](DECK_ZONES.md); Commander rules split to [#13](https://github.com/RuneBrix/magic-the-deckbuilder/issues/13), companions to [#14](https://github.com/RuneBrix/magic-the-deckbuilder/issues/14) | [#3](https://github.com/RuneBrix/magic-the-deckbuilder/issues/3) |
| D04 | Decide durable storage and cross-device workflow | Decision recorded | Portable local files; [contract](PORTABLE_STORAGE.md), implementation #63/#64 | [#4](https://github.com/RuneBrix/magic-the-deckbuilder/issues/4) |
| D05 | Verify macOS and automate cross-platform tests | In progress | Node 22/24 CI matrix; macOS browser checks remain open | [#5](https://github.com/RuneBrix/magic-the-deckbuilder/issues/5) |
| D06 | Improve decklist interoperability | In progress | Archidekt generic sections, review and atomic apply; full user export verification remains open; [bounds](DECKLIST_INTEROP.md) | [#6](https://github.com/RuneBrix/magic-the-deckbuilder/issues/6) |
| D07 | Collection ownership and deck budget planning | Later | Needs user feedback | [#7](https://github.com/RuneBrix/magic-the-deckbuilder/issues/7) |
| D08 | Decide whether native desktop packaging is useful | Later | Needs user feedback | [#8](https://github.com/RuneBrix/magic-the-deckbuilder/issues/8) |
| D09 | Redesign typography, icons and focused workflows; add dark mode | Current | Typography, themes and progressive disclosure; see feature inventory | [#9](https://github.com/RuneBrix/magic-the-deckbuilder/issues/9) |

Acceptance criteria and implementation progress live in the linked issues. [The issue index](ISSUE_BACKLOG.md) provides a compact overview.

## Deck workflow improvements

The first feedback group is [#16: shared top navigation](https://github.com/RuneBrix/magic-the-deckbuilder/issues/16), [#17: dedicated deck workspace](https://github.com/RuneBrix/magic-the-deckbuilder/issues/17), and [#18: library management and creation](https://github.com/RuneBrix/magic-the-deckbuilder/issues/18). The implementation and its data/interaction boundaries are described in [Deck workspace](DECK_WORKSPACE.md); GitHub tracks review and merge status.

[#19](https://github.com/RuneBrix/magic-the-deckbuilder/issues/19) implements the optional/resizable exploration tracker and explicit add destinations; [Exploration](EXPLORATION.md) records its boundaries and search-state behavior. Card-details autosave and named deck context are implemented in [#25](https://github.com/RuneBrix/magic-the-deckbuilder/issues/25), followed by preview/explicit deck-printing selection in [#26](https://github.com/RuneBrix/magic-the-deckbuilder/issues/26); [Card details](CARD_DETAILS.md) records storage and interaction limits; clearer check states and automatic freshness are [#27](https://github.com/RuneBrix/magic-the-deckbuilder/issues/27) and [#28](https://github.com/RuneBrix/magic-the-deckbuilder/issues/28). The check-state and freshness changes are implemented together with [#30 dark palettes](https://github.com/RuneBrix/magic-the-deckbuilder/issues/30); [refresh policy and check states](DECK_ZONES.md) describe their scope.

## How this relates to the MVP

The next feedback group is [#21: guided filter semantics](https://github.com/RuneBrix/magic-the-deckbuilder/issues/21), [#22: unified editable query](https://github.com/RuneBrix/magic-the-deckbuilder/issues/22), and [#23: function-tag interactions](https://github.com/RuneBrix/magic-the-deckbuilder/issues/23). [Unified search](UNIFIED_SEARCH.md) records supported expressions, preservation boundaries and verified examples. [#20](https://github.com/RuneBrix/magic-the-deckbuilder/issues/20) simplifies exploration hierarchy and initial/result feedback around that search. [#47](https://github.com/RuneBrix/magic-the-deckbuilder/issues/47) removes the candidate overview and optional pair comparison introduced in #24, retaining independent search broadening; [removal record](CANDIDATES.md). [#37](https://github.com/RuneBrix/magic-the-deckbuilder/issues/37) makes My decks the startup/reload home and logo destination while preserving in-session search state. [#29](https://github.com/RuneBrix/magic-the-deckbuilder/issues/29) adds manual Commander brackets with dated, count-based discussion ranges; [limits and sources](COMMANDER_BRACKETS.md).

The [feature inventory](FEATURES.md) records implemented and partial functionality. The [changelog](../CHANGELOG.md) records completed user-facing changes. A future idea belongs in an issue, not in the changelog as though it shipped.

## Previous tracker

Future planning is moving away from Linear at the user's request. D01–D04 and parts of D07–D08 preserve the follow-up topics previously grouped in `RUN-5`. The topics have been transferred into GitHub issues #1–#8. No Linear records have been deleted or modified.

[#38](https://github.com/RuneBrix/magic-the-deckbuilder/issues/38) implements compact artwork-led deck listings and [#39](https://github.com/RuneBrix/magic-the-deckbuilder/issues/39) implements the full-width compact editor header. Shared named-deck management disclosures retain existing actions and confirmations; [presentation choices and artwork fallback](DECK_WORKSPACE.md). Controls/previews are implemented in #40/#42; layouts and card menus are described below.

[#40](https://github.com/RuneBrix/magic-the-deckbuilder/issues/40) implements text filtering and deterministic numeric sorts, and [#42](https://github.com/RuneBrix/magic-the-deckbuilder/issues/42) implements the sticky left preview; [semantics and responsive bounds](DECK_WORKSPACE.md). Four visual/text layouts (#41), compact card menus (#43) and persistent Maybeboard (#44) are implemented for review in [PR #51](https://github.com/RuneBrix/magic-the-deckbuilder/pull/51). Maybeboard is outside the playing deck by user decision. Details simplification (#45) and automatic function classifications (#46) remain separate open work.
