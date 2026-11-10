# Function-tag discovery

Implemented for [D01 / #1](https://github.com/RuneBrix/magic-the-deckbuilder/issues/1).

## Source and access

The bundled catalog comes from Scryfall's public Oracle Tags bulk export. The 2026-11-10 export supplied 4,605 Oracle tags, including canonical slugs, aliases, parent and child IDs, and direct taggings. For each tag the generator counts distinct `taggings[].oracle_id` values and ships only the count. A valid empty list yields zero. A missing or invalid membership list aborts the refresh and leaves the previous snapshot intact. [Oracle Tags export](https://api.scryfall.com/bulk-data/oracle_tags) · [Bulk Data](https://scryfall.com/docs/api/bulk-data) · [Tags](https://scryfall.com/docs/api/tags)

The catalog is a dated, community-maintained snapshot. Counts cover direct Oracle memberships across the export. Live `otag:` search can match cards beyond those memberships, so the count does not predict the result total. For example, on 2026-11-10 `ramp` had 582 direct memberships while `game:paper otag:ramp` returned 2,288 search matches. A recorded relationship does not guarantee that a child card will match its parent or other filters. [Scryfall card search](https://scryfall.com/docs/api/cards/search)

## Update strategy

Run `npm run update:tags` from the repository root with Node 22+ and network access. It resolves the current official export URL, downloads the gzipped JSONL, validates names and references, and atomically replaces `public/tag-catalog.js` only after conversion succeeds. Review the generated diff and date, run `npm test`, and commit the snapshot alongside any necessary starting-point changes. Refresh during release preparation or when a user reports missing or renamed tags; no download occurs during app startup. The last shipped snapshot remains usable if an update fails.

The generated file contains source URL, upstream timestamp and stable upstream UUIDs (`uuid`). Its `id` is the current query slug, used only for this snapshot's navigation and session filters; slugs are not permanent upstream identifiers. Use UUIDs to compare renamed tags across updates. Keep aliases and relationships sourced from the export. `TAGS` in `public/core.js` contains Arcana's curated starting labels and descriptions; these are additional search terms, not purported upstream aliases. Starting points must reference a canonical tag in the snapshot, as enforced by tests. Replace obsolete starting points when updating rather than inventing relationships.

## User behavior and limits

- Find a function searches names, upstream aliases and curated starting labels and descriptions. Spaces and hyphens are interchangeable. Exact matches appear first and the match count updates as you type. Blank search shows curated starting points. Each page holds up to 40 matches in row order, with five equal columns and eight rows for a full desktop page. Narrow layouts use fewer columns. A new lookup returns to page one. The dated tagging counts are available offline. Typing and paging make no requests.
- Related opens a dialog with broader function links, a narrower function selector, Back and Forward, the direct count, aliases and the original Tagger page. The dialog shows up to eight paper-card search matches in two rows, using the first result page and the normal popularity sort. Navigation leaves the query alone. Add filter or Remove filter applies the current function using the existing all/any setting. Escape returns focus to the Related trigger.
- The dialog waits briefly before requesting one search page per visit and discards responses for closed or superseded views. The existing proxy paces requests and caches successful responses for five minutes. Unavailable examples can be retried without changing the query. Catalog navigation and counts remain available offline.
- When the catalog has no match, Add as an unlisted function accepts up to 80 letters, numbers, spaces or single hyphens. It adds a lowercase, hyphenated `otag:` filter. Scryfall may reject an unlisted tag or return no cards. Matching aliases use their canonical slugs. Workspace Help shows the snapshot date.
- Matching all (AND) sends space-separated `otag:` terms; Matching any (OR) joins them with `OR`. The existing View Scryfall query disclosure shows the exact composed query. Other filters are retained.
