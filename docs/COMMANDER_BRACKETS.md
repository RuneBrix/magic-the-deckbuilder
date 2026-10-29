# Commander bracket assignment and discussion (#29)

## Supported scope

The user requested a solution on 2026-10-29. This implementation supports manual assignment and bounded, explainable discussion guidance. It does not compute deck power, certify a bracket, automatically assess combos, or extend Commander construction-rule automation (#13/#14).

A player assigns any of the five brackets, or leaves it unassigned, in the dedicated Commander workspace. The library and Checks display that choice explicitly as player-assigned. Recomputing guidance never replaces the choice. Changing to a non-Commander format hides the control but retains the metadata if the deck later returns to Commander.

Checks separately suggests a **discussion range under standard Game Changer limits**. Recognized copies in main plus command zone are counted; sideboard cards are excluded. Counts use actual quantities and report the named cards and zones, so duplicate construction errors are not silently collapsed. One to three recognized copies produces a 3–5 discussion range; four or more produces 4–5. Zero matches does not select Bracket 1 or 2, because intent and play patterns can place a deck elsewhere. Counts cannot distinguish Optimized from cEDH.

These ranges are a reason to discuss the deck, not a definitive lower-bound certification. The October guidance specifically allows thematic Exhibition exceptions by group agreement. A manual choice below the standard count-based range gets a discussion notice, not an automatic change or construction failure. Combos/timing, extra-turn chaining, mass land denial, speed, consistency, theme and cEDH intent remain human judgments. Construction checks and stored-legality freshness remain separately labeled.

## Official evidence and snapshot

Reviewed on **2026-10-29**:

- [Current official Commander page](https://magic.wizards.com/en/formats/commander): bracket names, standard Game Changer limits and the embedded current card list.
- [February 9, 2026 update](https://magic.wizards.com/en/news/announcements/commander-brackets-beta-update-february-9-2026): additions reflected in the current list; no bracket-level change in that update.
- [October 21, 2025 update](https://magic.wizards.com/en/news/announcements/commander-brackets-beta-update-october-21-2025): intent/turn expectations, thematic Exhibition flexibility, and removal of separate tutor restrictions.

`public/commander-brackets.js` contains the 53 card names extracted from the official current page’s serialized `auto-card` data, with verification date, last reviewed list-update date and primary-source links. Matching uses English rules names, normalizes apostrophes/case, and recognizes the front name of a double-faced card such as Tergrid. It does not translate foreign imported names or infer unlisted future changes.

This is a **bundled snapshot, not live synchronization**. The app suppresses new range suggestions after 90 days without review. That threshold is an application review policy, not an official Wizards expiry rule. Stale snapshots can still show explicitly outdated matching evidence; missing/invalid lists and incomplete card records suppress suggestions. Manual assignment remains available. Freshness of the list is independent of the app’s five-minute card-legality cache.

To update: inspect the current official page and subsequent announcements; review all added/removed names and bracket policy changes; update the data module and provenance dates only after that review. Update the count/addition/removal regression fixtures and this document. Run the full suite and review the UI before publishing a changed policy. Never move the verification date merely to silence the stale warning.

## Data preservation

The optional deck-level `bracket` is an integer 1–5; absence means unassigned. Old backups remain valid. Complete per-deck/workspace JSON backup, restore and independent duplication preserve the field. Invalid assigned values reject a backup atomically. Quantities, zones, cards and roles are unchanged by assignment. Text decklists do not preserve bracket metadata; no external-format preservation is promised.

Automated checks cover snapshot provenance, official additions/removals, quantity/zone counts, front-face matching, missing/old data, ranges without assignment, legacy/invalid JSON, duplication and separate UI labels. Windows browser verification and untested-platform limits are recorded in the implementation PR.
