# Function-tag discovery

Implemented for [D01 / #1](https://github.com/RuneBrix/magic-the-deckbuilder/issues/1).

## Source and access

The bundled catalog comes from Scryfall's public [Oracle Tags bulk export](https://api.scryfall.com/bulk-data/oracle_tags), documented in [Bulk Data](https://scryfall.com/docs/api/bulk-data) and [Tags](https://scryfall.com/docs/api/tags). On 2026-10-27 this export supplied 4,590 Oracle tags, including canonical slugs, aliases, parent IDs and child IDs. The generator maps relationship IDs to canonical slugs and excludes card taggings. No Tagger HTML scraping, private endpoint, authentication or third-party taxonomy is required.

The catalog is a dated community-maintained snapshot, not a live or exhaustive promise about currently searchable effects. Card search still uses the public cards API and `otag:` syntax. A recorded relationship does not establish that every child card will match its parent, or guarantee nonempty results under other filters. The UI displays relationships as navigation; selecting a related tag adds a separate filter with the explicit all/any choice.

## Update strategy

Run `npm run update:tags` from the repository root with Node 22+ and network access. It resolves the current official export URL, downloads the gzipped JSONL, validates names and references, and atomically replaces `public/tag-catalog.js` only after conversion succeeds. Review the generated diff and date, run `npm test`, and commit the snapshot alongside any necessary starting-point changes. Refresh during release preparation or when a user reports missing or renamed tags; no download occurs during app startup. The last shipped snapshot remains usable if an update fails.

The generated file contains source URL, upstream timestamp and stable upstream UUIDs (`uuid`). Its `id` is the current query slug, used only for this snapshot's navigation and session filters; slugs are not permanent upstream identifiers. Use UUIDs to compare renamed tags across updates. Keep aliases and relationships sourced from the export. `TAGS` in `public/core.js` contains Arcana's curated starting labels and descriptions; these are additional search terms, not purported upstream aliases. Starting points must reference a canonical tag in the snapshot, as enforced by tests. Replace obsolete starting points when updating rather than inventing relationships.

## User behavior and limits

- Find a function searches names, upstream aliases and curated starting labels and descriptions. Spaces and hyphens are interchangeable. Exact matches appear first. The count below the field updates as you type. Blank search shows curated starting points, and longer match lists grow in batches of 30.
- Use a tag's arrow to see its recorded broader and narrower tags, aliases and original Tagger page. Browse links change the detail view without changing card filters. Add/remove buttons update filters; selected chips sit inside Browse by function, immediately below Combine functions by. Closing the disclosure hides chips and matching controls without removing active filters from the main query.
- When the catalog has no match, Add as an unlisted function accepts up to 80 letters, numbers, spaces or single hyphens. It adds a lowercase, hyphenated `otag:` filter. Scryfall may reject an unlisted tag or return no cards. Matching aliases use their canonical slugs. Workspace Help shows the snapshot date.
- Matching all (AND) sends space-separated `otag:` terms; Matching any (OR) joins them with `OR`. The existing View Scryfall query disclosure shows the exact composed query. Other filters are retained.
- Discovery itself works without upstream access because the catalog ships with the app. Card results still require internet access. There is no live taxonomy synchronization, fuzzy semantic ranking, or inferred relationship graph.
