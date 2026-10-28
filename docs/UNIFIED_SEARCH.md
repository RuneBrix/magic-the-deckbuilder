# Unified card discovery

Issues [#21](https://github.com/RuneBrix/magic-the-deckbuilder/issues/21), [#22](https://github.com/RuneBrix/magic-the-deckbuilder/issues/22) and [#23](https://github.com/RuneBrix/magic-the-deckbuilder/issues/23) align guided filters, editable syntax and function discovery. GitHub tracks review/merge status. The dependency-free projection lives in `public/search.js`; Scryfall remains the search authority.

## One query

The primary search bar contains the effective editable query. Typing projects supported conditions into guided controls and selected function chips without replacing the focused input or changing its cursor. Guided text/number input updates the query while typing; changed controls and form submission run the search. Existing matching choices survive selecting a mode before its first value.

Typing invalidates pending requests. Previously completed results retain their original query context and are labeled when the query has changed; Search updates them. Pagination continues the displayed result query. Clear search and filters, or removing the final guided restriction, returns to the initial state and invalidates old responses. An explicit Search on a blank bar visibly becomes `game:paper`, preserving deliberate broad searches.

## Guided expressions

| Control | Supported representation / meaning |
| --- | --- |
| Types/subtypes | Comma-separated names; all requires each type, any accepts any type. `t:`, `type:`; quoted multiword values supported. |
| Mana value | Up to two comparisons using `<`, `<=`, `=`, `!=`, `>=`, `>`; all builds ranges, any builds alternatives. `mv`, `cmc`, `manavalue` aliases supported. |
| Card color / identity | Separate controls: contains all, contains any, exactly, only selected colors including colorless, multicolor only, colorless only. `c:`/`color:` and `id:`/`identity:` plus `=`, `>=`, `<=`. Color selection is disabled for multicolor/colorless modes. |
| Name / Oracle phrase | One positive `name:`/`n:` or `o:`/`oracle:` phrase per family. Quotes and escaped characters are preserved. Regex Oracle conditions remain query-only. |
| Mana cost contains | One `m:`/`mana:` literal cost expression; accepts ordinary and braced symbols, including hybrid. This is symbol containment, not an exact-cost promise. |
| Symbol minimums | Exact W/U/B/R/G/C symbol counts, 0–20 each, all required, serialized as `m>=...`. Conjoined minimum clauses combine by maximum count per symbol, not by adding overlapping requirements. `{C}` is colorless; `{1}` is generic. |
| Format | One positive `f:`/`format:` clause, independent of any tracked deck. |
| Function tags | Positive `otag:` clauses; all/any selected tags share the same query. A tag entered as syntax can be removed by its chip. |

Examples available without typing syntax:

| Desired cards | Guided choices | Query |
| --- | --- | --- |
| Exact white-blue | Card color: Exactly, White + Blue | `c=WU` |
| Mono-white | Card color: Exactly, White | `c=W` |
| Multicolor | Card color: Multicolor only | `c:m` |
| Colorless | Card color: Colorless only | `c:c` |
| White or colorless | Card color: Only these colors including colorless, White | `c<=W` |
| At least one colorless symbol | Minimum Colorless {C}: 1 | `m>={C}` |
| At least two blue symbols | Minimum Blue {U}: 2 | `m>={U}{U}` |
| Instant or sorcery, mana value 2–4 | Types: instant, sorcery / Any; comparisons ≥2 and ≤4 / All | `(t:"instant" OR t:"sorcery") (mv>=2 mv<=4)` |

Color and cost searches follow Scryfall's multi-face semantics: a card may match through an individual face. Card color is not commander identity, and literal symbols do not stand for hybrid alternatives.

## Preservation boundary

The small parser recognizes grouping and AND/OR precedence, quotes, escapes, regex tokens and negation so it can preserve advanced input safely. Projection edits independent supported conditions. Uniform type/tag OR groups, conjoined groups and supported mana/color groups round-trip without changing their meaning.

Mixed-family OR groups, negated expressions, mixed Boolean logic within one family, repeated unrepresentable name/Oracle/format/cost conditions, more than two mana-value comparisons, unsupported color operators/nicknames, regexes and unknown qualifiers remain query-only. Query-only help shows their source text; affected controls are disabled and explain that the expression must be edited in the query. Unrelated guided conditions can still be changed. Untouched expressions retain their text; top-level AND separators may normalize to spaces, and necessary parentheses protect OR precedence when adding a condition. Redundant outer grouping of the entire conjunction may normalize without changing meaning.

Incomplete quotes/regexes/groups, dangling AND/OR and unfinished recognized clauses pause guided edits and search, keeping the exact typed query. This does not validate every Scryfall expression: other invalid syntax is reported by Scryfall. Queries are bounded to 1,500 characters and 40 nested groups. No deck data or filter state is migrated or stored.

Comparison broadening removes only a representable independent condition (the entire function group for any/all), preserves query-only expressions, and restores the exact original query. It cannot relax one operand inside a mixed group safely.

## Function discovery

The subordinate Find a function input searches names and aliases. Labels distinguish curated starting points, the full bundled catalog, matching tags and relationship navigation. Add filter / Remove filter changes the query; Related only browses recorded relationships and moves focus to the detail heading. Load-more labels identify the next matching or catalog batch. Counts and snapshot provenance remain in secondary help.

Selected functions and their all/any choice remain outside the browser disclosure. Enter an existing Scryfall tag searches known tagging data; it does not create public tags. Aliases resolve against the snapshot for this entry flow; outside-snapshot tags are permitted with an explicit unsupported/no-match warning. Taxonomy acquisition/update scope is unchanged; see [Tag taxonomy](TAG_TAXONOMY.md).

## Verification

Native Node regression checks cover Boolean projection, exact source preservation, unknown/negated expressions, repeated edits, all seven color/mana examples, literal symbol counts, typed-tag removal, partial syntax, cursor/input preservation, pending-response cancellation, independent format filtering and existing comparison/deck/appearance/server behavior.

On 2026-10-28, all seven required color/minimum-symbol query examples returned successful live responses through the existing Scryfall proxy. The returned batches (up to 175 cards per query, all 28 for `{C}`) matched the expected property on the card or at least one face; this is sampling, not whole-dataset certification. Windows desktop and 390px light/dark browser checks cover query/control synchronization, numeric editing, cursor insertion, tag removal/matching, relationship browsing and responsive layouts. The Impeccable engine/detector is unavailable; no detector pass is claimed. macOS/Safari remain untested.

This group does not complete the remaining exploration-layout decisions in #20, candidate-list design in #24, or the optional tracker in #19.
