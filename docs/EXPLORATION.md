# Card exploration and deck tracking

Issues [#19](https://github.com/RuneBrix/magic-the-deckbuilder/issues/19) and [#20](https://github.com/RuneBrix/magic-the-deckbuilder/issues/20) separate card search from the full deck editor.

## Tracker and destinations

- **Track deck** selects a deck or **No tracked deck**. It never deletes decks. The editor's open deck is separate: opening another deck does not silently change the exploration target. **Find cards to add** explicitly tracks the editor's deck and returns to the retained search.
- **Hide tracker** releases the panel's space but keeps the target selected. The toolbar continues to name the quick-add deck and Main deck zone. **Show tracker** restores the panel. Choosing a different deck shows its tracker.
- The tracker contains deck identity, playing-deck/sideboard counts, zone quantities and copy controls, with **Open full deck** for management, statistics, checks, import and export.
- Desktop resizing uses the panel's left edge. Focus that separator and use Left to widen, Right to narrow, Home for 280px and End for 480px. The displayed width is also capped at 40% of the viewport. At 960px and below the tracker moves beneath exploration, fills the available width and has a named jump shortcut; desktop resize controls are hidden.
- Result quick add adds one copy to the named tracked deck's Main deck. The number on that button is the matching Main deck entry's quantity, excluding other zones. Accessible names and hover help identify the destination. **Add to…** lets the player choose another deck without changing the tracked deck. With no tracked deck, the add button opens the same destination chooser and shows no implicit deck quantity. Card details additions also respect the explicit context.
- The chooser names the card and destination zone, requires a deck selection and mutates only on Add. Closing it does nothing. With no stored decks it offers deck creation, then adds the captured card to that new deck. Existing entry quantities/roles/zones are preserved; quantity and entry limits are checked before mutation.

Selection, visibility and preferred width persist separately under `arcana.explorer.v1`; they are not deck metadata and are not included in deck backups. An installation with no saved preference retains the former first-deck selection; an empty library tracks nothing. An explicit no-deck choice survives reload. Deleted/missing deck IDs become no tracked deck. Invalid preferences fall back safely; failed preference writes retain the session choice and show feedback. No new dependency or deck-data migration is required.

## Search hierarchy and states

Search leads the explorer. Filters and function browsing retain their existing collapsed disclosures and unified query. The results area uses an ordinary heading, optional starting searches and a labeled sort control when a search has run. The competing decorative welcome heading/icon is removed. Format legality remains in Filters and is independent of the tracked deck.

Initial, loading, no-match, request-error and populated states have separate feedback. No-match reports zero results and suggests changing the query; request failures offer retry. Clear search and filters, raw clearing and removal of the last guided clause restore the initial state and invalidate pending responses. Explicit blank submission still becomes `game:paper`, allowing an intentional broad search. Clearing is not a broad-search request.

Tracker changes preserve the query, guided controls, completed results, pagination, sort and completed-query context. Search remains session-local; reload restores tracker preferences and stored decks, not previous search results. My decks is the home on startup/reload and the Arcana logo destination (#37); navigation back to Explore cards retains search state within the session. The candidate shortlist and pair comparison were removed in [#47](CANDIDATES.md). Broaden this search stays a secondary disclosure after results; card-details autosave and printing selection are implemented in [#25/#26](CARD_DETAILS.md).

## Verification

Native Node regression tests cover independent editor/tracker context, target-only additions, unchanged decks during preference changes, preference restoration, keyboard/pointer resize bounds, pending-response cancellation and search states. Manual Windows browser checks cover live search, alternate/no-deck additions, desktop dragging/keyboard resizing, reload, and desktop/mobile light/dark layouts. macOS/Safari and physical mobile devices remain untested.
