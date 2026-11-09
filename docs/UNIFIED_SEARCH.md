# Unified card discovery

Issues [#21](https://github.com/RuneBrix/magic-the-deckbuilder/issues/21), [#22](https://github.com/RuneBrix/magic-the-deckbuilder/issues/22) and [#23](https://github.com/RuneBrix/magic-the-deckbuilder/issues/23) align guided filters, editable syntax and function discovery. GitHub tracks review/merge status. The dependency-free projection lives in `public/search.js`; Scryfall remains the search authority.

## One query

Selected removable function chips and Combine functions by (Matching all / Matching any) live near the top inside Browse by function. Collapsing that disclosure hides its controls while preserving the active query.

The primary search bar contains the effective editable query. Typing projects supported conditions into guided controls and selected function chips without replacing the focused input or changing its cursor. Guided text/number input updates the query while typing; changed controls and form submission run the search. Existing matching choices survive selecting a mode before its first value.

Filters starts with Card name and gives each family a separate disclosure. The header summarizes the active filter families and query-only expression count. Search with these filters runs the current query from the header and leaves the disclosure state intact. The filter grid adapts to the space available beside the optional tracker.

Typing invalidates pending requests. Previously completed results retain their original query context and are labeled when the query has changed; Search updates them. Pagination continues the displayed result query. Clear search and filters, or removing the final guided restriction, returns to the initial state and invalidates old responses. An explicit Search on a blank bar visibly becomes `game:paper`, preserving deliberate broad searches.

## Guided expressions

| Control | Supported representation / meaning |
| --- | --- |
| Types and subtypes | Search and add removable chips from the first typed letter. Matching all (AND) requires each included type. Matching any (OR) accepts any included type. Do not include excludes every selected type, regardless of the include mode. Supports `t:`, `type:`, `-t:` and `-type:` with quoted multiword values. |
| Keyword abilities | Search and add removable chips for Scryfall keyword abilities. Matching all (AND) requires each ability and Matching any (OR) accepts alternatives. Supports `keyword:` and `kw:` with quoted multiword values. Keyword exclusion is edited in the query. |
| Mana value | Repeatable comparisons using `<`, `<=`, `=`, `!=`, `>=`, `>`; all builds ranges, any builds alternatives. `mv`, `cmc`, `manavalue` aliases supported. Starts with one row; Add additional mana value filter appends a blank row without searching. Column headers appear once; comparison, value and a square cross control share each evenly spaced row. With multiple rows, any row can be removed, including the first; the sole remaining row has its cross disabled. Removal focuses the next remaining row, or the previous row when removing the last. The row list scrolls locally above the all/any control. |
| Card color / identity | Separate controls: contains all, contains any, exactly, only selected colors including colorless, multicolor only, colorless only. `c:`/`color:` and `id:`/`identity:` plus `=`, `>=`, `<=`. Color selection is disabled for multicolor/colorless modes. |
| Name phrase | One positive `name:`/`n:` phrase. Quotes and escaped characters are preserved. |
| Oracle phrases | Repeatable positive `o:`/`oracle:` and `fo:`/`fulloracle:` rows, each with an Oracle / Full oracle selector. Full oracle includes reminder text. Add additional oracle filter appends a blank row; one header labels the Text source and Rules-text phrase columns. Each row places its source selector, phrase input and square cross control on one line. Any row can be deleted while multiple rows exist; the sole remaining row has its cross disabled. Removal preserves remaining phrases, their sources and matching mode. Matching all (AND) requires each phrase and Matching any (OR) accepts alternatives. Quotes, escapes and `~` remain intact; blank rows add no restriction. The row list scrolls locally. Regex Oracle conditions remain query-only. |
| Mana cost contains | One `m:`/`mana:` literal cost expression; accepts ordinary and braced symbols, including hybrid. This is symbol containment, not an exact-cost promise. |
| Symbol minimums | Exact W/U/B/R/G/C symbol counts, 0–20 each, all required, serialized as `m>=...`. Conjoined minimum clauses combine by maximum count per symbol, not by adding overlapping requirements. `{C}` is colorless; `{1}` is generic. |
| Format | One positive `f:`/`format:` clause, independent of any tracked deck. |
| Function tags | Positive `otag:` clauses; all/any selected tags share the same query. A tag entered as syntax can be removed by its chip. |

The type and keyword suggestions use a bundled [Scryfall catalogs snapshot](https://scryfall.com/docs/api/catalogs), fetched on 2026-11-09. Run `node scripts/update-filter-catalog.mjs` to refresh the snapshot. Typing uses the local list. Select a suggestion by click or touch, use Arrow Down and Enter, or press Enter in the field to choose the first match. Escape dismisses suggestions. The query stays as entered until a suggestion is selected, and typed query values can appear as chips even when the local snapshot has no suggestion for them.

Each writable text or number field and each chip picker has a trailing Clear control. Clear removes the targeted value or set of chips and returns focus to its field. Format clears to Any format. Card color and color identity clear their respective selected colors and reset their matching mode. In repeatable rows, Clear empties the value while keeping its comparison or text source. Remove deletes the entire row.

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
| Flying or first strike, excluding creatures | Keywords: Flying, First strike / Any. Do not include: Creature | `(keyword:"flying" OR keyword:"first strike") -t:"creature"` |

Color and cost searches follow Scryfall's multi-face semantics: a card may match through an individual face. Card color is not commander identity, and literal symbols do not stand for hybrid alternatives.

## Preservation boundary

The small parser recognizes grouping and AND/OR precedence, quotes, escapes, regex tokens and negation so it can preserve advanced input safely. Projection edits independent supported conditions. Uniform type, keyword and tag OR groups, independent type exclusions, conjoined groups and supported mana/color groups round-trip without changing their meaning.

Mixed-family OR groups, negation beyond standalone type exclusions, mixed Boolean logic within one family, repeated unrepresentable name/format/cost conditions, unsupported color operators/nicknames, regexes and unknown qualifiers remain query-only. Query-only help shows their source text and the affected controls are disabled. Unrelated guided conditions can still be changed. Untouched expressions retain their text. Top-level AND separators may normalize to spaces, and necessary parentheses protect OR precedence when adding a condition. Redundant outer grouping of the entire conjunction may normalize without changing meaning.

Incomplete quotes/regexes/groups, dangling AND/OR and unfinished recognized clauses pause guided edits and search, keeping the exact typed query. This does not validate every Scryfall expression: other invalid syntax is reported by Scryfall. Queries are bounded to 1,500 characters and 40 nested groups. No deck data or filter state is migrated or stored.

Comparison broadening removes only a representable independent condition (the entire function group for any/all), preserves query-only expressions, and restores the exact original query. It cannot relax one operand inside a mixed group safely.

## Function discovery

Find a function searches names and aliases and shows the match count beneath the field as you type. An empty field shows curated starting points. Add filter / Remove filter changes the query. Related browses recorded relationships and focuses the detail heading. Show next adds another batch of matching tags. The snapshot date is in workspace Help.

Selected functions and their all/any choice sit inside Browse by function. A valid name with zero catalog matches offers Add as an unlisted function in the same panel. The action adds an `otag:` filter and runs the current query. The panel labels unlisted tags and explains that Scryfall may reject them or return no cards. Catalog results use the canonical tag slug. See [Tag taxonomy](TAG_TAXONOMY.md).

## Verification

Native Node regression checks cover Boolean projection, exact source preservation, unknown/negated expressions, repeated edits, all seven color/mana examples, literal symbol counts, typed-tag removal, partial syntax, cursor/input preservation, pending-response cancellation, independent format filtering and existing broadening/deck/appearance/server behavior.

On 2026-10-28, all seven required color/minimum-symbol query examples returned successful live responses through the existing Scryfall proxy. The returned batches (up to 175 cards per query, all 28 for `{C}`) matched the expected property on the card or at least one face; this is sampling, not whole-dataset certification. Windows desktop and 390px light/dark browser checks cover query/control synchronization, numeric editing, cursor insertion, tag removal/matching, relationship browsing and responsive layouts. The Impeccable engine/detector is unavailable; no detector pass is claimed. macOS/Safari remain untested.

Exploration hierarchy and optional tracking (#19/#20) are documented in [Exploration](EXPLORATION.md); candidate removal (#47) is recorded in [Candidates](CANDIDATES.md), and retained broadening in [Search broadening](EFFECT_COMPARISON.md).
