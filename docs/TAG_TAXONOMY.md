# Function-tag discovery

Implemented for [D01 / #1](https://github.com/RuneBrix/magic-the-deckbuilder/issues/1).

## Source and access

The bundled catalog comes from Scryfall's public [Oracle Tags bulk export](https://api.scryfall.com/bulk-data/oracle_tags), documented in [Bulk Data](https://scryfall.com/docs/api/bulk-data) and [Tags](https://scryfall.com/docs/api/tags). On 2026-10-27 this export supplied 4,590 Oracle tags, including canonical slugs, aliases, parent IDs and child IDs. The generator maps relationship IDs to canonical slugs and excludes card taggings. No Tagger HTML scraping, private endpoint, authentication or third-party taxonomy is required.

The catalog is a dated community-maintained snapshot, not a live or exhaustive promise about currently searchable effects. Card search still uses the public cards API and `otag:` syntax. A recorded relationship does not establish that every child card will match its parent, or guarantee nonempty results under other filters. The UI displays relationships as navigation; selecting a related tag adds a separate filter with the explicit all/any choice.

## Update strategy

Run `npm run update:tags` from the repository root with Node 22+ and network access. It resolves the current official export URL, downloads the gzipped JSONL, validates names and references, and atomically replaces `public/tag-catalog.js` only after conversion succeeds. Review the generated diff and date, run `npm test`, and commit the snapshot alongside any necessary starting-point changes. Refresh during release preparation or when a user reports missing or renamed tags; no download occurs during app startup. The last shipped snapshot remains usable if an update fails.

The generated file contains source URL, upstream timestamp and stable upstream UUIDs (`uuid`). Its `id` is the current query slug, used only for this snapshot's navigation and session filters; slugs are not permanent upstream identifiers. Use UUIDs to compare renamed tags across updates. Keep aliases and relationships sourced from the export. `TAGS` in `public/core.js` contains Arcana's curated starting labels and descriptions; these are additional search terms, not purported upstream aliases. Starting points must reference a canonical tag in the snapshot, as enforced by tests. Replace obsolete starting points when updating rather than inventing relationships.

## User behavior and limits

- Search names, upstream aliases and curated starting labels/descriptions. Spaces and hyphens are interchangeable; exact matches appear first. Results are shown in batches of 30 with a match count and Show more control; Browse all traverses the full snapshot.
- Use a tag's arrow to see its recorded broader and narrower tags, aliases and original Tagger page. Browse links change the detail view without changing card filters. Add/remove buttons update filters; selected chips survive closing the browser.
- Custom tag accepts names or known aliases. Known aliases resolve to canonical slugs. Unknown names remain usable and are explicitly identified as outside the snapshot; this is not proof of invalidity. Scryfall may reject them or return no cards. Raw advanced syntax remains available.
- Match all sends space-separated `otag:` terms; Match any joins them with `OR`. The existing View Scryfall query disclosure shows the exact composed query. Other filters are retained.
- Discovery itself works without upstream access because the catalog ships with the app. Card results still require internet access. There is no live taxonomy synchronization, fuzzy semantic ranking, or inferred relationship graph.
