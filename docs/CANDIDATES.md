# Candidate workflow removal

[#47](https://github.com/RuneBrix/magic-the-deckbuilder/issues/47) supersedes the candidate workflow introduced by [#24](https://github.com/RuneBrix/magic-the-deckbuilder/issues/24) in [PR #36](https://github.com/RuneBrix/magic-the-deckbuilder/pull/36). User feedback found the separate inspection workflow unnecessary.

Save/remove candidate actions, counts/navigation, the separate overview, optional two-card comparison, session snapshots and their handlers/styles are removed. Candidates were session-only, so no deck migration or storage deletion is needed.

Ordinary card exploration, printing previews, details, explicit deck destinations and all saved deck data remain. [Reversible search broadening](EFFECT_COMPARISON.md) remains independent. No replacement recommendation or ranking system is introduced. Details simplification beyond candidate removal remains #45.
