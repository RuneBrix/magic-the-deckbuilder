# Arcana
<!-- impeccable:product-schema 1 -->
## Platform
web
## Stack
Delegated by the request for an autonomous MVP: native browser modules, CSS, Node.js 22+ standard-library server. No install dependencies. Runs on Mac and Windows.
## Users and purpose
Magic players building decks and exploring cards who currently move between Scryfall, Tagger, and Archidekt. Bring discovery, deck editing, statistics, and format feedback into one workspace.
## Capabilities and constraints
Local browser storage, Scryfall live API, guided combinable function tags and Oracle filters, full advanced syntax, deck creation, import/export, mana curve and category counts. No authentication or cloud synchronization in this MVP. Function discovery searches a dated official Oracle Tags snapshot with aliases and recorded relationships; starting points are curated and live taxonomy synchronization is not implemented. Format checks are a useful subset, not a tournament certification. User requested deferring unspecified decisions until later feedback.
Reversible guided search broadening can ignore one supported condition and restore the original query. The candidate shortlist and two-card comparison were removed at user request (#47). Automatic similarity, upgrade and synergy rankings are not implemented.

Discovery uses one editable Scryfall query with guided type/subtype matching, mana comparisons, card color versus identity, symbol minimums and format selection. Supported positive clauses populate controls; complex or unsupported expressions remain query-only, preserving their text and meaning. Function filters use the same query; relationship browsing never adds a filter automatically. This is a bounded projection, not a complete replacement parser for Scryfall syntax.

Decks have main, sideboard and command zones. Modern construction checks are zone-aware; Commander and companion rules remain partial and are labeled for manual review. Existing browser data and legacy backups remain compatible.

My decks is the startup/reload home page and the Arcana logo destination (#37). It opens a dedicated deck editor with grouping, role/type filters, statistics and checks. The first ordered personal role tag is the primary function; every assigned role can be filtered. Exploration supports no tracked deck or a separately selected, hideable and resizable compact tracker, explicit add destinations and a route back to the editor. Search results and optional starting searches lead over secondary search broadening. The library opens decks through commander artwork or titles and shows color symbols and assigned brackets. Library/editor management uses named-deck action menus; independent duplication, text imports, full per-deck JSON export and optional commander designation during creation remain available.

Card details separates general facts from a named deck/zone context, with validated role/zone autosave. Set/printing choices preview independently and apply explicitly to all copies of one named entry. JSON preserves the stored printing; text interchange does not.

The compact full-width editor keeps Find cards to add visible beside its title; metadata and a small Commander bracket selector sit below it. Bracket discussion guidance opens and focuses the discussion in Checks. Commander decks support player-assigned brackets and a dated official Game Changers snapshot for count-based discussion ranges. Assignment is never automatic; intent, play patterns and unsupported rules remain human review. JSON preserves assigned brackets.

## Open decisions

Accounts and cross-device storage, live taxonomy synchronization, complete Commander/companion validation, collection tracking, and native desktop packaging.
