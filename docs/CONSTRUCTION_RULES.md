# Bounded Commander and companion checks

Implemented for #13/#14. Reviewed 13 November 2026 against Wizards' [Comprehensive Rules, effective 6 November 2026](https://media.wizards.com/2026/downloads/MagicCompRules%2020261106.pdf), especially 100.4a, 702.124, 702.139 and 903. The official [rules page](https://magic.wizards.com/en/rules) supplies updates. Companion predicate details also use the [Ikoria release notes](https://magic.wizards.com/en/news/feature/ikoria-lair-behemoths-and-commander-2020-edition-release-notes-2020-04-10); their original companion casting procedure is superseded by current CR 702.139.

## Commander

Checks supports single commanders and two-command configurations using ordinary Partner, matching Partner labels (including Friends forever), reciprocal Partner with names, Choose a Background with a legendary Background enchantment, and Doctor's companion with a legendary creature whose only creature types are Time Lord Doctor. Different partner abilities cannot be mixed. More than two commanders fails.

Single eligibility uses the front face: legendary creatures, legendary Vehicles, legendary Spacecraft with stored power/toughness, or explicit “can be your commander” Oracle text. This includes current noncreature eligibility rather than the older creature-only rule. A valid pair combines identities before testing playing cards and the designated companion. Basic land subtypes impose their associated colors even when stored color identity is empty; both faces are inspected. Stored legality, 100 main-plus-command cards, command quantities and copy exceptions retain their existing checks.

Pregame color choices and detected special construction exceptions require manual review; identity checks are withheld for these configurations to avoid reporting an exception as a proven violation. Missing Oracle/eligibility facts remain unavailable. Unusual construction exceptions and interchangeable names are outside this bounded certification; keep the general manual-review notice. Legality refresh updates stored legality, not the rules implementation or all other Oracle facts.

## Companion

The Checks selector designates one existing Sideboard / outside-game entry. Storing or adding a companion-capable card alone does not designate it. None clears the choice; selecting another entry changes it. Moving the selected entry out of Sideboard clears designation, as does removing that entry. Copying cards into another deck does not copy designation; duplicating a whole deck does. The selected printing, finish, quantities, functions and unrelated entries are retained.

In constructed play, the selected companion occupies a normal sideboard slot and participates in sideboard legality/copy limits. Its condition inspects Main deck only. In Commander it is outside the 100, but must have legal stored format data, fit the commander identity, have one stored copy and not share a starting-deck name. Its condition inspects Main deck plus Command zone. Other outside-game cards and Maybeboard do not participate. Commander has no official sideboard; Arcana's Sideboard remains an outside-game storage area with an explicit notice for undesignated entries.

Predicates supported for ordinary single-faced cards:

| Companion | Starting-deck condition |
| --- | --- |
| Gyruda | Even mana values, including lands |
| Jegantha | No repeated literal mana-cost symbol on a card |
| Kaheera | Creature cards have an allowed creature subtype or Changeling |
| Keruga | Nonlands have mana value at least three |
| Lurrus | Permanent cards have mana value at most two |
| Lutri | Nonland names are distinct, across printings/quantities |
| Obosh | Nonland mana values are odd |
| Umori | All nonlands share at least one card type |
| Yorion | At least 20 cards above the format minimum (80 constructed; 120 Commander, conflicting with the separate exact-100 requirement) |

Zirda's activated-ability predicate, unknown companions and special layouts are explicitly manual. Missing cost/type/Oracle data is unavailable. Predicate support does not override a companion's stored banned/not-legal status. The app does not execute the in-game companion action.

The optional boolean `entry.companion` extends existing versioned workspace deck records (versions 1/2 and legacy arrays). Absent means no designation; validation rejects multiple designations or a designation outside Sideboard. Complete JSON preserves it; name/quantity/zone text deliberately loses it. No new storage key or migration rewrites existing decks.

## Verification

Native synthetic fixtures cover complete decks, valid/invalid pairs, combined identities, eligibility, basic-land types, companion predicates, data gaps, designation changes/moves, and complete JSON round trips. Browser checks cover selection, focus, reload and clear in isolated Chromium desktop/phone light/dark contexts. These checks do not establish macOS/Safari acceptance or complete Magic rules certification; record actual run results in the PR.
