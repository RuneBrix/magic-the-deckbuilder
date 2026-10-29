# Candidate workflow (#24)

## Scope selected before implementation

The user requested a solution for #24 on 2026-10-29. Retain the existing visual language, search semantics and manual comparison logic. Replace direct result/detail comparison with a session-only candidate shortlist. Save/remove actions must be discoverable on results and in details, without moving the user away from a search. A secondary Candidates button opens a separate overview and Return to exploration restores the existing search state.

Limit the shortlist to 20 distinct rules identities, one selected printing per candidate. Candidates survive searches, pagination, tracker changes and app navigation in the same session; reload clears them. They are independent of deck storage/backups. Removing a candidate removes its optional comparison selection; clearing requires an explicit Clear candidates action. No automatic ranking, synergy scores or inferred upgrades.

The overview shows full artwork, mana value/cost, type, card colors/identity, full Oracle text, printing, recorded personal-role context and completed-query provenance. Each candidate can be inspected, removed, added to a named destination, or selected for an optional two-card comparison. The two-card table remains secondary within the overview. Adding does not remove candidates or change tracking.

Search broadening stays a separate secondary disclosure after results, called Broaden this search. It removes one supported independent condition, shows the ignored condition and original/current queries, and restores the exact original query. Selecting another relaxation starts from the original, never accumulates. Removing color or format filters can produce cards outside the intended deck; no equivalence claim.

Implementation acceptance: independent collection and two-card selection limits; identity deduplication; snapshot context from completed results; safe no-deck additions; preserved query on navigation; empty/limit/removed states; keyboard focus and desktop/mobile light/dark checks. Existing query, printing and deck regression coverage must remain valid.

The scoped workflow above was implemented and reviewed against the retained interface. Regression checks cover limit/deduplication, completed-query snapshots, independent deck context, optional comparison/removal and invalid role drafts. Browser checks and platform limits are recorded in the implementation PR.
