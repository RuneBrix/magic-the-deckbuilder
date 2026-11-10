# Card details and printing choices

## Card details

Inspect from a deck, Explore cards or Collection to open the same read-only card details. Deck rows and collection entries open their stored printing. The dialog shows full artwork, Oracle text, release facts and stored format legality. A date appears only when Arcana has a recorded successful legality refresh for the displayed data. Choose a printing to update the preview, the Scryfall link and the exact-printing ownership total across finishes and conditions.

The first page of paper printings loads on open. **Load more printings** fetches one page at a time. The current printing stays available during loading and after a failed lookup. Retry uses the same page. Cards without a stored Oracle identity retain their original printing and explain the lookup limit. Responses for closed or replaced dialogs are ignored. **Add this card to collection** opens the collection editor. **Back to card details** restores the viewed printing and returns focus to the collection action.

## Adding copies

**Add card to deck** from details, an Explore result, or the deck card menu uses the same confirmation form. The open or tracked deck is preselected for ordinary Add. Without a deck in context, choose a destination. **Add to…** and **Add to another deck…** start with an explicit destination choice. Choose the zone, printing, finish, optional primary function and quantity. The existing copy count covers the chosen deck across all zones, printings and finishes. Destination changes leave the tracked deck and viewed card in place.

Confirmation adds the entered quantity. Matching printing and finish copies in the chosen zone share an entry. Other printings, finishes and zones keep separate entries. If a primary function is provided for a matching entry, it becomes the first of its stored functions and the remaining assignments are retained. A blank function leaves any existing primary in place. Copying through the deck card menu also carries over the source entry’s stored functions. The deck is limited to 500 copies of a rules card per zone across printings and finishes, and 1,000 entries. Back, Cancel and Escape discard the pending addition.

## Changing a deck entry

Choose **Change in-deck card details** in an entry’s options menu. The form identifies the deck, zone, card and quantity. **Save printing and finish** applies to those copies and preserves quantity, zone, personal functions and the latest stored legality. If the same printing and finish already has a separate entry in that zone, choose a different version or use the deck’s quantity controls to combine copies deliberately.

Both forms show the stored per-copy USD quote for the selected printing and finish. Nonfoil, foil and etched use their corresponding Scryfall fields. Missing quotes remain unavailable. The separate [Ownership & budget estimate](COLLECTION_BUDGETS.md) continues to use regular EUR quotes.

## Preservation and lookup

Complete per-deck and workspace JSON files preserve the stored printing and optional finish on each entry. Files with multiple versions of the same card in a zone require this revision or later. Older entries without an explicit finish still load, with the regular or sole supported finish used for USD estimates. Legacy moves and text imports retain their existing destination merge behavior when both entries lack a chosen finish. Text export combines quantities by name within each zone. [Text interchange](DECKLIST_INTEROP.md) carries names, quantities and zones. Use JSON for printing, finish, and function data.

The fixed local `/api/printings` endpoint validates the Oracle UUID and page number, and uses the existing Scryfall timeout, rate queue and five-minute cache. Results are checked against the original rules identity and validated as backup-compatible cards. Reversible same-identity faces retain both artworks. [Candidate and pair comparison removal](EFFECT_COMPARISON.md#removed-candidate-workflow-47) records the earlier discovery scope change.
