# Collection upload efficiency

Investigated 3 November 2026 for [PR #86](https://github.com/RuneBrix/magic-the-deckbuilder/pull/86).

## Primary evidence and limits

- The live [Scryfall bulk-data manifest](https://api.scryfall.com/bulk-data) describes `oracle_cards` as one card object per Oracle ID, `default_cards` as every card object in English (or its only printed language), and `all_cards` as every card object in every language. A single metadata request returned compressed sizes of 25,307,999, 80,753,221 and 402,132,527 bytes respectively. These sizes change. The manifest currently provides dated `jsonl_download_uri` values ending in `.jsonl.gz`; resolve the manifest instead of hardcoding paths. No card database was downloaded for this investigation.
- Scryfall's maintained [List types](https://github.com/scryfall/api-types/blob/main/src/objects/List/List.ts) distinguish the current page's `data` from `total_cards` and expose `has_more`/`next_page`. A large search count is not a complete downloaded database. [Card layout types](https://github.com/scryfall/api-types/blob/main/src/objects/Card/Card.ts) distinguish single-faced and multi-faced cards, so matching has to retain face-name handling.
- The [collection endpoint](https://scryfall.com/docs/api/cards/collection) is the reference for batched identifiers. Arcana currently submits up to 75 unique names per request. Its supported batch size is covered by local proxy tests. The documentation page, [bulk-data documentation](https://scryfall.com/docs/api/bulk-data), and [rate-limit page](https://scryfall.com/docs/api/rate-limits) returned HTTP 403 to the research browser; this note does not claim a fresh read of their prose or infer undocumented request-rate allowances. Existing conservative pacing and 429/Retry-After handling remain enforced.

## Why searches seem faster

Inference from the API shape and implementation: exploration displays one broad result page and can defer later pages. Import must resolve the requested rows and check printing/finish/language/set before applying collection quantities. A single broad search cannot safely substitute for arbitrary exact-card import, and printing fallbacks can add requests.

## Changes implemented

- Validate file syntax, ignored columns and skipped lines locally before any lookup. Start resolution only when Upload is pressed; no full resolved-card review DOM is generated.
- Reuse compatible stored printings from the collection, decks and the session's bounded card cache. Match name, explicit set/language and actual finish before reuse. No request is needed when all requested cards already have compatible local facts.
- Index stored and returned cards by full/face names instead of rescanning the complete card array for each row. Deduplicate default-name requests, using front names for double-faced identifiers, and retain 75-name batching, bounded lookup caches and explicit cooldown resume.
- Keep one paced upstream queue; increasing concurrency or discarding cooldowns is not an acceptable speed optimization.

## Recommended next step for large cold imports

An explicit optional local bulk index is the strongest next step when most requested printings are unknown locally. Stream the manifest-selected compressed JSONL, retain only card fields needed for matching/rendering, index by name/set/language, and persist a versioned cache outside tracked source. This shifts repeated API work into a one-time download and disk/index cost. It needs a download-size/progress/cancel UI, atomic cache replacement, freshness policy and storage limits before implementation.

`oracle_cards` alone cannot preserve arbitrary printing/set/finish/language choices. `default_cards` is smaller but does not cover every language; multilingual fidelity needs `all_cards` or selective API fallback. These are engineering conclusions from the manifest descriptions, not benchmark results. No claim is made that the current first-time full-collection import is instant, or that its speed has been measured on the user's collection.
