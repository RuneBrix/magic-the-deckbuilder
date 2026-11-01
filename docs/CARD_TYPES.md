# Deck card types (#62)

Deck grouping, typed filters, free-text type/subtype matching, primary type statistics and land classification share a deck-facing type line. Full stored Scryfall card/face records and printing choices are not changed.

## Face and grouping policy

- For transform, modal double-faced, adventure, flip and reversible records, use the first face's type line. If face data is absent, use the first section of the stored combined type line. Other single-faced records use their stored type line. This is a deck presentation policy, not a complete rules engine.
- Split cards combine the types of both halves. Full card/face names remain searchable even when reverse-face types do not participate in deck grouping/filtering.
- Parse types only before the subtype dash; a subtype substring is not a card type. Recognize Artifact, Battle, Conspiracy, Creature, Dungeon, Enchantment, Instant, Kindred, Land, Phenomenon, Plane, Planeswalker, Scheme, Sorcery and Vanguard. Legacy Tribal is an alias for Kindred; unknown types remain Other.
- Each entry has one primary group, using the established priority Land, Creature, Planeswalker, Instant, Sorcery, Artifact, Enchantment, Battle, then Conspiracy, Dungeon, Phenomenon, Plane, Scheme, Vanguard, Kindred. Land Creature remains Land; Artifact Creature remains Creature.
- Typed filtering recognizes every applicable deck-facing type, while Statistics counts only the primary group. Those counts therefore sum to the included card total rather than double-counting multitype cards. Existing quantity weighting and zone exclusions remain intact.
- Land totals and the nonland mana-value average use the same face policy. Bala Ged Recovery is a front-face Sorcery rather than a land merely because its back is Bala Ged Sanctuary.

Invasion of Alara is Battle rather than its reverse-face Sorcery. Backup Plan is explicitly Conspiracy. Bonecrusher Giant remains Creature rather than Stomp's Instant type. Fire // Ice remains Instant. Type/subtype text search uses the selected type line; this does not change the unified Scryfall search language in Explore. Details still display the complete stored facts for both faces.

## Sources and fixtures

Checked 1 November 2026 against Wizards' [current rules index](https://magic.wizards.com/en/rules) and its [Comprehensive Rules effective 25 September 2026](https://media.wizards.com/2026/downloads/MagicCompRules%2020260925.txt), particularly 205.2a–b and 300.1–2 for the card-type list and multitype objects. The choice of one primary deck group is an application convention, not a requirement stated by those rules.

Public fixtures in test/fixtures/card-types.json were fetched from Scryfall's exact-name API on the recorded retrieval date: Invasion of Alara, Backup Plan, Dryad Arbor, Urza's Saga, Bonecrusher Giant, Bala Ged Recovery, Fire // Ice and Very Cryptic Command. [Scryfall card/face field definitions](https://github.com/scryfall/api-types/blob/main/src/objects/Card/CardFields.ts) document type lines, layouts and multiface records. The fixtures preserve the returned type/face data; regression checks also assert no mutation of these records. They are a small public sample, not a player deck or full-catalog validation.

## Verification

Standalone type branch: 120 native tests passed on Windows Node v24.14.1. The integrated branch stacked on #76 passes all 127 native tests. Regressions first reproduced Invasion of Alara grouping as Sorcery, Backup Plan falling into Other, and reverse-face land contamination of filtering/statistics. Tests cover the fetched fixtures, primary count totals, exact type tokens, legacy aliases and every supported card type.

Windows browser: all four visual/text layouts show matching Battle/Conspiracy groups; Sorcery text filtering shows only the front-face Sorcery in the sample, while Statistics reports Battle 1, Conspiracy 1 and Land 2. Desktop light and 390px dark views inspected; no horizontal page overflow. Existing controls/details remain accessible. Physical touch, macOS/Safari and exhaustive layout/card data remain untested.
