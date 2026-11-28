# Changelog

## Search cards setup — 2026-11-28

- Open Filters and Browse by function together in visually distinct panels. The panels split the width evenly on wide screens, stack in narrower spaces and summarize applied conditions when closed (#286).
- Choose Add a filter in the next grid slot to open the filter picker. Existing query conditions reveal their controls automatically. Each filter’s X removes its editable conditions (#285).
- Browse ten function starters in fixed slots that refill as you select them. Selected functions stays visible, and search pages support previous, next, an editable page number and a page menu (#284).

## Statistics charts and tokens — 2026-11-28

- Limit colored mana production to the combined Command zone identity in Commander, or Main deck identity when no commander is designated or in other formats. Use short chart captions and keep missing-data warnings visible (#271, #288).
- Show only the token name below Referenced tokens artwork and keep each tile linked to its exact printing (#282).

## Collection upload — 2026-11-27

- Upload or paste tab-separated deck TXT with set, collector number, finish and language. Map unfamiliar columns and review malformed rows before applying copies (#269).
- The wider Upload collection dialog separates examples, syntax status, processed columns and rows that need attention (#270).
- Recognize Archidekt TXT set codes, batch fallback lookups, and show clear correction instructions above the review limit. Text selection can end outside the dialog without dismissing it.

## Cards zone and group controls — 2026-11-27

- Collapse each deck zone independently in all four Cards layouts. Zone summaries and drag destinations stay available, and reopening a zone restores its group disclosures (#264).
- Sort Type and Function headings A–Z, including Land and Lands. Collapsed groups use less space, and the title and toggle stay in place when opening or closing the group (#262, #272).

## Function counts in Search cards — 2026-11-23

- Label direct tagging counts on function tiles. Related shows the dated snapshot count and Scryfall's paper search total beside its example cards (#242).

## Deck card selection — 2026-11-23

- Use Select beside Filter cards to choose whole deck entries across zones. The bottom Actions menu can assign functions, move entries, copy names and quantities, add exact printings to Collection, and confirm removal of the selected copies (#215).

## Deck and group export — 2026-11-23

- Export decks as TXT or CSV with zone, category and ownership selections, optional printing metadata, sorting and a one-row example. Complete JSON remains available (#238).
- Export group metadata, open an artwork grid, or remove copies from a Type or Function group. Removal confirms the zone, copy count and filter scope before saving (#233).

## Deck functions — 2026-11-23

- Initialize new cards' functions from broad families in the bundled Oracle Tags snapshot. Families beyond the original suggestions can now supply a default, and existing entries keep their stored assignments (#210).
- Rename a private function group from its group actions menu. The rename applies to every entry in that zone's group, including filtered-out entries. Future additions keep their own automatic defaults (#211).

## Deck ownership and costs — 2026-11-23

- Use compact quantity badges on visual cards. Turn on **Show ownership** in the Cards tab to see coverage and printing matches. Resting card controls use translucent backgrounds (#234).
- Show owned copies per row in **Ownership & costs**. The cheapest-printing estimate totals only the missing nonbasic copies in the selected zones (#235).

## Search cards and sourced tags — 2026-11-23

- Open **Search cards** from the main navigation, with the same search, tracker and deck navigation behavior (#218).
- Browse direct Scryfall Oracle tags in card details. Start a search from a tag, with confirmation before replacing the current query, filters and results (#217).

## Statistics charts and tokens — 2026-11-23

- Scale the mana curve and both colored-mana charts with the available Statistics panel width (#239).
- Show artwork and printing information for referenced tokens, with exact-printing links when artwork is unavailable (#240).

## Deck text import — 2026-11-22

- Resolve full double-faced names with an exact search when the bulk lookup misses them. Prefer a unique full card name over a matching card face (#230).
- Show the copy total and destination before applying a deck import. List only unresolved cards and give specific recovery steps for lookup or save failures (#231).

## Card action shortcuts — 2026-11-22

- Right-click deck cards and visual Collection cards to open their existing actions. Use the Menu key or Shift+F10 from a focused card or card-name control (#214).
- Find Add new function first in the assignment menu. If the save fails, the form keeps the name for retry and the card keeps its current functions (#216).

## Deck groups — 2026-11-19

- Copy quantities and full card names from a Type or Function group in any deck layout. With a filter active, copy only the shown cards from that group and zone (#212).
- Keep the Land type group and Land or Lands function groups last in each zone (#213).
- Collapse deck groups independently while keeping their counts, prices and actions available (#232).

## Deck legality checks — 2026-11-18

- Refresh legality for one saved deck at startup and when Checks needs updated card coverage. Offer a retry after a failed lookup (#236).
- Show a single legality result, with deck-specific Commander manual-review items and brief optional guidance under About these checks (#237).

## Card and dialog interactions — 2026-11-18

- Show larger Related-function examples that open their exact printing in Card details and return to the same relationship, scroll position and focused example (#241).
- Keep the page stationary while a modal dialog is open and allow its contents to scroll (#243).
- Prevent artwork and blank-space drags from selecting page content. Text selection and intentional deck-card moves remain available (#244).

## Search setup — 2026-11-18

- Show active filters and selected function tags beside their respective collapsed headings (#245).
- Submit from the main Search control or keyboard. Blank submissions preserve displayed results and send no request (#246).
- Keep the Scryfall query and its validation visible beneath navigation while editing filters, with the sticky area ending before results (#247).
- Keep open filter panels visible when a filter change starts a search.

## Card lookup and safe saves — 2026-11-18

- Validate Collection printing pages and supported finish choices; preserve existing finishes until deliberately changed. Keep explicit finish requests separate from omitted-finish defaults and check all fallback pages for ambiguous identities (#226).
- Keep decks and inventory unchanged when saving staged card additions, printing changes, deck creation/import or refreshed facts fails. Retain retryable forms and distinguish unavailable lookups from ordinary no-match results (#226).

## Owned printings and text exports — 2026-11-18

- Review and match deck copies to verified owned printings in selected zones, including finish/language changes and partial quantity splits. Preserve unmatched copies, functions and inventory; failed saves retain a retryable review (#175).
- Lead deck export with a text preview, independent zone/headings/quantity options and missing-copy output using the deck’s ownership matching. Keep complete JSON as a secondary backup action (#176).

## Collection upload recovery — 2026-11-17

- Recover CSV mappings with suggested columns, normalize edition names and codes, and show row-specific lookup errors with a correction path (#181). For set-only rows, select a compatible printing when the rules identity is clear, and accept Collector Number to select an exact variant. Batch edition-constrained lookups to reduce large CSV upload times.
- Separate upload guidance, validation, progress, cooldown and errors. Large workspaces can retry quota-limited writes with lossless compression of repeated card metadata while keeping complete JSON backups compatible (#179, #180).
- Review collection uploads before saving. Use supported finishes when the CSV omits finish, group unresolved rows by issue, and allow deliberate printing selection or row skipping before the final confirmation.

## Search clearing and activated abilities — 2026-11-17

- Make chip-input X controls clear lookup text while preserving selections; add explicit selected-chip, category, all-guided and function-only clearing, retaining unrelated/query-only clauses and useful focus (#189).
- Add an Activated abilities aid for tap, mana payment or both in the same printed cost, with optional compact mana symbols such as 3U and an editable Scryfall query. Document its bounded text-matching scope (#191).
- Keep the active guided filter panel open when an input change rebuilds the form before the disclosure event runs.

## Stable card visuals and ownership — 2026-11-16

- Use the developer-selected fixed full-card layouts and permanent price-only captions; hover/focus no longer moves card targets or following sections (#186).
- Add static foil color sheen and neutral etched treatment to selected deck/Collection artwork and deck previews, keeping finish accessible and data unchanged (#194).
- Use outlined, filled and split quantity markers for zero, full and partial collection coverage; show unassessed zones/identities distinctly and keep numbers readable on opaque backings (#197).

## Deck navigation and Statistics layout — 2026-11-16

- Return My decks to the last opened deck during the session; add Back to library above the deck title, retain library startup/reload and remove the redundant Find cards to add button (#187).
- Reduce top-navigation padding while retaining readable labels, 44px controls and measured sticky/menu/drag/anchor offsets (#196).
- Center and widen Statistics, emphasize section headings and align values with clear section separation; preserve every calculation and tool (#169).

## Settings, palettes and welcome guide — 2026-11-16

- Move Settings into a normal page with a named Back action that preserves the prior deck/search/collection workflow (#177).
- Offer seven palettes for each Light/Dark appearance, remember them separately and retain older preferences; preserve semantic states and mana colors (#178).
- Replace the technical introduction with a short welcome and practical route through decks, card discovery, collection and workspace copies; reference details remain beside their tools (#199).

## Complete cheapest scans and printing application

- Scan each nonbasic card independently through its final page, remove the 200-card/four-page batch limits, show progress and per-card errors, and retain completed/last-good results through cancellation and retry (#167).
- Review and apply verified regular English cheapest printings to selected zones. Preserve foil/etched entries, basic lands, unverified results, quantities, zones and functions; combine converging variants and save before applying changes. Inventory remains unchanged (#174).

## Deck currency and basic-land costs

- Save a euro or US dollar currency for each deck and apply its actual finish quotes across Cards, previews, printing dialogs, ownership estimates, price refresh and cheapest comparisons. Currency changes discard stale cheapest results (#171).
- Exclude basic lands, snow basics and Wastes from costs and unpriced warnings while retaining deck counts and ownership coverage; disclose excluded rows/copies (#168).
- Use € and $ symbols for displayed prices and currency labels throughout the interface (#207).

## Ownership and costs

- Separate copy quantities from monetary estimates, use the available page width and move calculation policy into secondary help (#170).
- Remove budget targets and comparisons; keep ownership/cost estimates and preserve valid legacy budget fields in complete JSON (#172).
- Sort the concise cost table by card, zone, price, copies or cheapest quote; keep unknown prices last and retain the overall missing-copy cost (#173).

## Card addition defaults

- Default ordinary single-faced lands to Land alongside existing tag-derived functions. Offer an explicit suggested function for existing entries and an Unassigned choice without rewriting saved manual functions (#163).
- Cover broader tag families for card advantage, combat control, untapping, attack taxes and cost reduction, including all ten reported Karona cards. Review and apply missing functions to existing empty entries without reimporting copies or changing manual/explicit Unassigned choices (#163).
- Add one default nonfoil copy immediately from Quick add, preserve other printing/finish variants, and retain saved/live copies on a failed save. Explain printings without nonfoil in the detailed form (#166).
- Store known default finishes for ordinary add paths and show resolved set/collector metadata in text rows regardless of entry origin, with honest unknowns for incomplete older records (#195).

## Explore filter readability

- Give guided filters wider columns, more space between selected chips and repeated values, and balanced empty panel headings (#182).
- Preserve complete focus outlines in scrolling filter rows, stack labeled Oracle controls in narrow panels, and center the generic-mana help symbol (#190).
- Hide empty selected-function summaries, emphasize Find a function and move snapshot/count context into About function data (#192).

## Deck summaries and stack headers

- Combine all four zone counts with the editor's playing-deck summary; keep Maybeboard outside playing totals (#165).
- Simplify deck totals and large-preview price/function labels while keeping unpriced counts and special finishes visible (#188).
- Align neighboring vertical stacks below variable-length headers and place horizontal group costs beside names/counts, with wrapping for narrow widths and enlarged text (#193).

## Collection pagination and totals

- Render up to 48 owned lots at a time in Visual cards and Text, with Previous/Next, direct page selection and lot ranges. Apply filters, sorting and grouping to the whole inventory before paging; keep pages valid after edits and removals (#164).
- Put concise copy totals below the Collection controls, distinguish filtered totals from the whole inventory and keep lot counts in page navigation. Remove allocation-policy boilerplate from the browsing page (#198).

## Collection captions and editing

- Put Collection quantity/options controls on the artwork, move Edit/Remove into the options menu and remove repeated visible card names. Keep Language, Finish and abbreviated Condition in a single compact caption line (#183).
- Open Update card in collection from artwork, captions and text-row backgrounds. Printing/finish/condition edits retain the chosen lot's quantity and replace the original on save, combining matching lots; cancellation, stale drafts and failed saves preserve holdings (#184).
- Keep Collection text columns and row heights stable through long metadata, grouping, sorting and filtering, with full-value access and sticky actions (#185).

## Deck keyboard navigation and touch controls

- Complete deck section tabs with automatic Left/Right/Home/End navigation, one sequential tab stop and labeled panels (#158).
- Enlarge text-deck copy controls and Collection quantity/Edit/Remove hit areas for narrow and touch layouts while retaining compact desktop sizing (#159).

## Input focus and draft preservation

- Keep Collection card-name suggestions within the dialog, scroll keyboard selection into view and skip individual options in the Tab path (#155).
- Preserve Search button focus during loading, results and failures; return retry focus to Search (#156).
- Retain invalid EUR budget drafts with adjacent validation, preserve the last valid saved amount and keep Tab/Shift+Tab progression stable (#157).

## Collection safety and construction checks

- Explain additive upload totals and intentional repeats; offer confirmed inventory replacement with a backup opportunity, and save staged uploads before applying (#72).
- Check supported Commander eligibility, partner variants, combined identity and basic-land types, with explicit limits for special rules (#13).
- Designate companions in Checks and preserve the choice in complete JSON; validate supported starting-deck predicates and keep unsupported cases explicit (#14).

## Quick add and automatic primary functions

- Search card names directly in the open deck after three characters, with keyboard suggestions and the shared Add card confirmation (#114).
- Initialize supported primary functions from the dated offline Oracle Tags memberships, including Beast Within / Removal, while retaining personal overrides and complete source memberships (#46).

## Card details and deck printing workflows

- Browse printings and exact-printing ownership in a global card details dialog (#99).
- Add a chosen quantity, printing, finish and primary function to an explicit deck and zone (#101).
- Change a deck entry’s printing and finish with a separate confirmation and finish-specific USD quote (#102).

## Zone and navigation acceptance

- Keep newly opened card menus available when a delayed focus/layout scroll leaves their anchor unchanged; moving the anchor still dismisses the menu (#61).
- Let phone trackers grow with their rows and reserve room below their final quantity controls for the floating tracker shortcut (#61).
- Verify empty/populated optional-zone transitions in every deck layout and the tracker, with preserved data and destinations (#53).

## Primary functions and reverse faces

- Edit one primary deck function while retaining all stored memberships; grouping, filtering and statistics use the primary (#100).
- Flip a double-faced card in visual stacks or the large preview, with temporary face state that resets on pointer/focus exit (#97).

## EUR deck pricing

- Compare stored unit and line costs with the cheapest quoted regular English paper printings in Ownership & budget (#111).
- Use available foil EUR quotes for foil entries, keep saved quotes when refresh finds no replacement and link missing quotes to exact Cardmarket products when mapped (#109).

## Browse by function

- Page through 40 function matches at a time in a responsive grid with direct Scryfall tagging counts (#128).
- Open Related to browse broader and narrower functions and preview up to eight paper-card matches before applying a filter (#130).

## Deck review

- Compare colored mana costs and production in Statistics and show primary assignments under Card functions (#105).
- List distinct Scryfall token references for the playing deck, with links to the exact token printings (#104).
- Show About bracket data directly in Commander Checks (#113).

## Deck library and creation

- Distinguish placeholder examples from entered text across the app (#87).
- Let the My decks grid grow with the available page width (#88).
- Suggest eligible paper commanders by name while creating a deck, with keyboard selection and the option to choose later (#89).

## Explore color and mana cost filters

- Edit card color and color identity in one Colors panel while keeping both query clauses independent (#122).
- Compare generic amounts and literal mana-symbol counts in repeatable rows with all/any matching (#125).

## Deck statistics

- Calculate draw chances by primary function or card type for a chosen number of draws and matches from Main deck (#103).
- Show total and median nonland mana value alongside the average, with mana curves by color, type, primary function, power, toughness and rarity (#106).

## Explore sorting and function filters

- Sort Explore results by USD price in either direction across pages and label unavailable quotes (#131).
- Keep keyboard focus in Browse by function after changing the match mode or removing a selected chip (#129).

## Searchable Explore filters

- Add searchable include and exclude chips for types and subtypes (#120).
- Add keyword ability chips with all/any matching (#124).
- Clear individual guided fields and repeatable values with focus returned to the cleared field (#126).

## Deck counts, prices and previews

- Emphasize type and Function headings and show copy counts across all four deck layouts (#90).
- Show stored USD estimates for displayed groups and zones, with unpriced copies called out. Visual stacks show the card name, set code and per-copy quote on hover or keyboard focus (#95).
- Show the primary Function and per-copy USD estimate beside the large deck preview (#94).

## Explore filter panels

- Give Filters and Browse by function distinct panels. Expand filter families individually, see the active conditions in the header, and run the search from that header (#119).
- Give Find a function a visible field boundary and live match count. Add a valid unlisted function from the lookup when the catalog has no match (#127).

## Deck card controls

- Give visual plus, minus and options buttons solid, palette-aware surfaces so they stay readable over light and dark art (#91).
- Ask before the minus button removes a command-zone entry. Keep the other entries and any copies in other zones (#96).
- Show only actions inside the Function and Move to flyouts (#98).

## Ownership and budget estimates

- Choose which deck zones contribute to ownership and cost estimates while keeping all cards visible (#107).
- Use a compact summary with matching labels for deck estimates, collection coverage and the cost to buy remaining copies (#108).
- Compare budgets against known EUR costs and show how many copies are unpriced (#110).

## Deck drag destinations

- Give Add to new function the same size as zone destinations in the drag strip (#92).
- Pause edge scrolling over the whole strip, including gaps. Keep labels visible above the dragged preview (#93).
- Remove the standing drag instructions from the Cards tab. Card actions still provide named keyboard and touch destinations and deletion confirmation (#112).

## Explore entry and tracking

- Start fresh from top-navigation Explore cards. Find cards to add keeps the current search and tracks the open deck (#116).
- Place destination guidance beneath Track deck when browsing without a deck (#117).
- Render results and broadening sections only when needed (#118).

## Repeatable search filters - 2026-11-04

- Start mana-value filtering with one comparison, add more as needed and keep longer lists locally scrollable with all/any matching (#121).
- Add repeatable Oracle/full-Oracle phrase rows with all/any matching, reminder-text guidance and preserved advanced query expressions (#123).
- Align mana-value and Oracle filters in evenly spaced rows under shared column headers, with square cross controls. Any row can be removed when multiple exist; preserve one remaining row, other filters and keyboard focus.

## Explore width and function-filter placement - 2026-11-04

- Use available Explore width and adaptive result columns while retaining the optional tracker and two-column phone view (#115).
- Remove initial Discover cards starters and unused conditional regions; retain reversible broadening without the redundant instructions (#118).
- Keep selected function chips inside Browse by function beneath Matching all / Matching any controls; collapsing preserves the active query (#129).

## Collection card controls and reset - 2026-11-03

- Give visual cards labeled table-equivalent details, aligned actions and inline Quantity controls. Widen the editor, reset dialog scroll, automatically load all available version pages, and add a typed-confirmation collection reset that preserves decks and persists before applying (PR #86).

## Direct collection upload and table view - 2026-11-03

- Validate TXT/CSV locally, map headerless CSV, confirm ignored columns/zone headings, then resolve and upload without a full card-list review. Reuse indexed local cards before lookup; record bulk-data research. Replace text layouts with one compact sortable table and consistent contained actions; distinguish examples and placeholders (PR #86).

## Large collection import pacing - 2026-11-03

- Share conservative Scryfall request pacing and 429 cooldowns across endpoints. Reuse pending/finished lookups, retain import progress for explicit resume after cooldown, show review progress and skip redundant name batches for constrained CSV rows (PR #86).

## Collection finish lookup fix - 2026-11-03

- Map regular finish to Scryfall nonfoil, search compatible alternate printings when the default is foil-only, and resolve full double-faced CSV names through a validated front-face fallback. Verified the supplied three-card Aang CSV against the running localhost proxy (PR #86).

## Archidekt collection CSV - 2026-11-03

- Import pasted or selected CSV with quantity, quoted card names, finish/foil, condition, language and set/edition fields. Ignore unrelated metadata, preview resolved lots and combine matching duplicates after review. Reject unresolved set/language constraints without applying partial data (PR #86).

## Collection browsing refinements - 2026-11-03

- Anchor one-character literal-prefix search suggestions to the add-card input. Add compact View/Group by/Sort by/Filter controls, fixed-width visual cards, compact text rows, remembered preferences and date/color/EUR-price sorting (PR #86).

## Collection workflow revisions - 2026-11-03

- Add reviewed deck-syntax collection list imports, contains-name search after two characters, and a staged printing/finish/condition quantity editor. Expand Collection to page width with text/visual views, sorting and contained row actions ([PR #86](https://github.com/RuneBrix/magic-the-deckbuilder/pull/86)).

## Recognizable mana symbols - 2026-11-03

- Use locally bundled Magic mana symbols for deck identity, statistics, text-card costs, details and guided filters (#56). Preserve accessible color names and literal generic/compound costs; no CDN or package dependency. Center glyphs in shared 16px circles and reduce the library/editor identity badges to match the filters.

## Direct deck-card dragging — 2026-11-03

- Drag all copies of a deck/zone entry into zones or existing Function groups (#55). Function drops move into the group's zone and make that label primary while retaining other assignments; both changes apply together. Command zone cards stay ungrouped while retaining their Functions. Same-group drops do nothing; Unassigned only moves zones and retains Functions. A full-size card copy follows the cursor with a dimmed original and clean hover/focus outlines after release; notifications say Added [card name] to [function], without quotation marks. The always-available Add to new function drag group opens the scoped name dialog and assigns only after valid submission. Zone merges keep the destination printing. During dragging, show group overlays, all zone destinations and a fixed lower-right trash target; trash opens the existing all-zones confirmation. Edge scrolling keeps hit testing current, cancellation leaves cards unchanged, and keyboard/touch retain card-menu actions.

## Clearer Commander bracket guidance — 2026-11-02

- Simplify bracket discussion and replace the dated update links with the current official Commander source (#60). Show one Last updated date as the last developer review of bundled data, explain developer-maintained app updates and separate card-legality refresh. Preserve manual assignments, Game Changer evidence and stale/missing-data limits.

## Simpler card action menus — 2026-11-02

- Group deck-card actions into Function and Move to submenus (#54). Existing deck Functions assign directly; Add new function opens a scoped create-and-assign dialog. Keep the card name in the visible header, retain deck/zone context for accessibility, and label all-zone deletion Delete card with its existing confirmation. Function and Move to open as side flyouts on hover and close when leaving the option/flyout, including after clicking the option. Outside clicks dismiss both panels; Left/Escape and viewport fitting retain keyboard and narrow-screen use.

## Explicit card-detail destinations — 2026-11-02

- Add deck/zone selectors and compact minus/quantity/plus controls to card details (#45). Selecting a target leaves the preview and decks unchanged; copy edits and printing application affect only that target. Use Functions labels, retain invalid drafts when switching is blocked, and replace the matching-printing wait cursor with a normal disabled state.

## Clearer deck legality results — 2026-11-02

- Label deck legality checks and their zone/rule scope, hide empty result categories, explain stored-data failures and missing-data limits, and place Commander bracket discussion after legality results (#58). Manual Commander checks name unsupported eligibility, pairings and basic-land restrictions; #13 remains open.

## Visual card corner controls - 2026-11-02

- Replace above-artwork toolbars with small palette-colored triangular quantities entirely inside rounded card corners and transparent right-side plus, minus and options controls in both visual views (#52). Preserve keyboard focus, menus, text layouts and complete artwork; tighten vertical resting advances to 48px and retain 44px touch targets. Center quantities away from the corner edges using larger Public Sans numerals and normal letter spacing. Counter colors follow the selected palette; plus, minus and options share equal square bounds.

## Quieter deck views and persistent navigation — 2026-11-02

- Hide actually empty Sideboard and Maybeboard viewing sections in all four layouts and the tracker; populated zones remain visible when filters match no cards, and all zones remain add/move destinations ([#53](https://github.com/RuneBrix/magic-the-deckbuilder/issues/53)).
- Place the mana curve beside compact card-type, personal-role and color tools; stack the tools on narrow screens without changing calculations ([#57](https://github.com/RuneBrix/magic-the-deckbuilder/issues/57)).
- Keep shared navigation at the viewport top and measure its wrapped height for scroll targets, the sticky preview and desktop tracker ([#61](https://github.com/RuneBrix/magic-the-deckbuilder/issues/61)). Browser layout/scroll verification remains pending.

## Reliable legality refresh — 2026-11-01

- Refresh exact stored printing ids so same-name rules variants no longer collide (#59). Require usable selected-format data before marking coverage fresh; identify missing/mismatched cards and retain stored data on failure. Printing/format changes and in-flight edits retain safe follow-up coverage.



## Face-aware deck types — 2026-11-01

- Group Invasion of Alara as Battle and recognize Conspiracy and other supported card types (#62). Share front-face type rules across grouping, filtering and statistics; preserve Artifact Creature/land priorities and full printing/face data. Split cards retain combined types.


## Double-click startup — 2026-11-01

- Add Windows and macOS source launchers with a Node 22+ check, server readiness before browser opening, stable loopback origin and manual-opening fallback (#8). Keep the terminal open to own the server; occupied ports never trigger an automatic origin change. Windows wrapper/headless checks pass; macOS and native double-click/browser association remain unverified.


## Portable file status and recovery guidance — 2026-11-01

- Distinguish browser autosave from requested workspace downloads in Settings (#64). Show edits since the last full-workspace file request this session, preserve initiation errors, and explain portable-device transfer, duplicate imports and recovery without claiming a file reached disk.


## Portable workspace files — 2026-11-01

- Download versioned JSON workspace files and continue opening legacy backups (#63). Preview independent deck copies before adding them; failed storage writes leave the current workspace intact and offer recovery downloads. New files require a compatible Arcana version.


## Archidekt text import review — 2026-11-01

- Accept Mainboard alongside existing zone headings for Archidekt quantity/name text exports (#6). Review resolved names, quantities and zones before applying; unresolved/ambiguous matches block the whole import. Editing a list invalidates its review. Text printing/function limits are stated in the review.

## Deck view review refinements — 2026-11-01

- Preserve the full native top border on card portraits. Fit the toolbar backing behind rounded image corners instead of overlapping the image; retain anchored hover reveals and continuous vertical stacks.

- Keep earlier cards fixed during hover reveals: horizontal stacks move only later cards right; vertical stacks move only later cards down. Compact vertical toolbars are 33px high on desktop, and full artwork continues behind the next rounded toolbar with consistent portrait joins. Narrow/touch views wrap full cards and retain larger controls.

- Align horizontal text entries to the same page-width three-column grid as vertical text. Add 8px gaps to sparse horizontal visual groups and an immediate hover/focus fan that pushes following cards right, redistributes overlap and uses reserved opening space without a sideways scroller.

- Horizontal visual cards remain separate until they fill the group, then overlap progressively with card count and available width without sideways scrolling. Hover/focus reveals covered controls. Every vertical toolbar keeps rounded upper corners, vertical visual groups wrap, and text +/− buttons gain the same hover outline.

- Unified full-width visual toolbars with outlined, tinted surfaces attached to artwork; options borders appear on hover, and options/quantity symbols are centered. Vertical stacks join at straight edges, spacing between groups/zones is tighter, and vertical text keeps three desktop group slots even for a single commander ([PR #51](https://github.com/RuneBrix/magic-the-deckbuilder/pull/51)).

## Deck views, card actions and Maybeboard — 2026-10-31

- Refined PR #51 after review: visual quantity/actions sit above artwork with reserved vertical-stack spacing; Command zone comes first in every view. Text rows are slimmer, align quantity/name sizing, put mana costs beside ellipsized names with full-name hover titles, and wrap vertical text groups into new rows.

- Added four visual/text deck views with horizontal visual stacks as default, shared grouping/filtering/sorting and responsive quantity/menu controls ([#41](https://github.com/RuneBrix/magic-the-deckbuilder/issues/41)).
- Added compact card menus for details, private function assignment/creation, zone moves, name copying, explicit copying to another deck and confirmed removal across all zones ([#43](https://github.com/RuneBrix/magic-the-deckbuilder/issues/43)).
- Added persistent Maybeboard, excluded from playing totals, statistics, construction checks and brackets by user decision. Moves, duplication, JSON backups and sectioned text preserve it; text still omits roles/printing/bracket metadata ([#44](https://github.com/RuneBrix/magic-the-deckbuilder/issues/44)).

## Deck controls and left preview — 2026-10-31

- Added live deck text filtering, Type/Function/No grouping labels and Sort by modes for stored-printing USD price, power and toughness. Missing/nonnumeric values sort last; existing name, mana value and quantity sorts remain ([#40](https://github.com/RuneBrix/magic-the-deckbuilder/issues/40)).
- Moved desktop card previews into a sticky left rail beside the card area with matching row highlighting. Keyboard focus updates previews; narrow screens retain full-details access without overlays ([#42](https://github.com/RuneBrix/magic-the-deckbuilder/issues/42)). Filtering, sorting and previews preserve deck data.

## Deck library and editor presentation — 2026-10-31

- Centered letters within the larger color-identity circles in listings and editor headers; tightened title-to-identity spacing and reduced empty listing space.
- Deck listings open through artwork or titles, show commander art crops and compact color/bracket information, and put management in accessible ⋮ disclosures ([#38](https://github.com/RuneBrix/magic-the-deckbuilder/issues/38)).
- The editor uses a compact full-width header with a shared management disclosure, visible Find cards to add, capitalized format and smaller Commander bracket selector. Bracket discussion guidance opens and focuses Checks ([#39](https://github.com/RuneBrix/magic-the-deckbuilder/issues/39)). Deck data and existing management confirmations remain intact.

## Home and exploration simplification — 2026-10-31

- My decks is first in the top navigation, followed by Explore cards and Settings. It opens on startup/reload and from the Arcana logo; Explore cards retains its search state during session navigation ([#37](https://github.com/RuneBrix/magic-the-deckbuilder/issues/37)).
- Removed candidate saving, overview/navigation and optional pair comparison at user request. Reversible search broadening, details, printing selection and deck additions remain ([#47](https://github.com/RuneBrix/magic-the-deckbuilder/issues/47)). No deck-storage migration.

Record completed user-facing changes here. Future work belongs in [GitHub issues and the roadmap](docs/ROADMAP.md).

## Unreleased

### Changed

- Collect up to 20 session-only candidates from results/details and review them separately, with optional two-card comparison; keep reversible search broadening secondary and independent ([#24](https://github.com/RuneBrix/magic-the-deckbuilder/issues/24); [scope](docs/EFFECT_COMPARISON.md#removed-candidate-workflow-47)).
- Assign Commander brackets manually and review named Game Changers against a dated official snapshot with conditional discussion ranges, human-review caveats and stale/missing-data states. Preserve assignments in JSON and duplication ([#29](https://github.com/RuneBrix/magic-the-deckbuilder/issues/29); [sources and bounds](docs/COMMANDER_BRACKETS.md)).

- Separate card facts/artwork from explicit named-deck controls, autosave validated role and zone edits, and keep invalid drafts visible for correction or deliberate discard ([#25](https://github.com/RuneBrix/magic-the-deckbuilder/issues/25)).
- Browse paginated paper printings with consistent artwork/release facts; preview without deck mutation, then explicitly apply to a named entry while preserving copies, roles and zone. JSON preserves printing choices; text lists do not ([#26](https://github.com/RuneBrix/magic-the-deckbuilder/issues/26); [workflow](docs/CARD_DETAILS.md)).

- Distinguish supported passes, failures, stale/unavailable legality and manual review with labeled icons and semantic colors in deck Checks ([#27](https://github.com/RuneBrix/magic-the-deckbuilder/issues/27)).
- Refresh legality automatically for the tracked/open deck each app session and after card-set changes; retain stored printing and live edits, surface cache/freshness limits and offer retry on failure ([#28](https://github.com/RuneBrix/magic-the-deckbuilder/issues/28)).
- Add persisted dark green, dark blue, black/white and black/orange palette choices alongside Light/Dark/device appearance ([#30](https://github.com/RuneBrix/magic-the-deckbuilder/issues/30)).

- Make exploration deck tracking optional and separate from the full editor, with persisted hide/show and desktop drag/keyboard width, compact zone quantity tracking and explicit alternate add destinations. Preserve search state when changing the tracker ([#19](https://github.com/RuneBrix/magic-the-deckbuilder/issues/19); [workflow](docs/EXPLORATION.md)).
- Simplify the initial exploration area to optional starting searches, ordinary result headings and result-associated sorting. Distinguish loading/no-match/error/results feedback and clear the last staged guided clause back to initial without accepting obsolete responses. Keep the existing comparison tools secondary after results ([#20](https://github.com/RuneBrix/magic-the-deckbuilder/issues/20)); candidate lists remain separate.

- Expand guided discovery with type/subtype all/any matching, two mana-value comparisons, separate card-color/identity modes and exact mana-symbol minimums. Keep the effective Scryfall query editable in the primary search bar; guided edits and typed tags share that query, with preserved query-only expressions and explicit parsing limits ([#21](https://github.com/RuneBrix/magic-the-deckbuilder/issues/21), [#22](https://github.com/RuneBrix/magic-the-deckbuilder/issues/22); [workflow](docs/UNIFIED_SEARCH.md)).
- Clarify function discovery with labeled Add filter / Related actions, secondary catalog/count help, matching beside selected tags, and entry of existing Scryfall tags. Relationship browsing leaves the query unchanged ([#23](https://github.com/RuneBrix/magic-the-deckbuilder/issues/23)).
- Replace the duplicate navigation sidebar with a shared top navigation and compact local-save status ([#16](https://github.com/RuneBrix/magic-the-deckbuilder/issues/16)).
- Open decks in a dedicated editor with zone moves, mana costs, identity summaries, type/primary-function grouping, ordering, all-role filtering and complete card previews. The first ordered personal role is the primary function; existing JSON data stays compatible ([#17](https://github.com/RuneBrix/magic-the-deckbuilder/issues/17); [workflow](docs/DECK_WORKSPACE.md)).
- Add library rename, deliberate delete confirmation, independent duplication, deck import/export, and optional commander designation during creation. New text imports create a deck only after all cards resolve; complete per-deck JSON exports preserve roles and zones ([#18](https://github.com/RuneBrix/magic-the-deckbuilder/issues/18)).
- Add explicit main deck, sideboard and command zones with safe zone moves, per-zone quantities and zone-preserving text/JSON round trips. Modern checks now combine copy limits across main/sideboard and separate failed checks, missing data and manual-review rules; statistics exclude sideboards. Preserve legacy Commander decks and track remaining Commander/companion rules separately ([D03 / #3](https://github.com/RuneBrix/magic-the-deckbuilder/issues/3); [coverage](docs/DECK_ZONES.md)).
- Add manual two-card effect comparison with mana, colors, Oracle text and role/search context. Broaden one guided condition with an explicit reason, preserved original query and return action; retain comparisons across searches without automatic ranking ([D02 / #2](https://github.com/RuneBrix/magic-the-deckbuilder/issues/2)).
- Expand function discovery to a bundled Scryfall snapshot of 4,590 tags with alias search, broader/narrower navigation, dated source information and custom-tag guidance. Replace unsupported starting suggestions with verified canonical names ([D01 / #1](https://github.com/RuneBrix/magic-the-deckbuilder/issues/1)); [source and updates](docs/TAG_TAXONOMY.md).
- Redesign the workspace with self-hosted Newsreader/Public Sans typography, forest-green and paper surfaces, custom card/search icons, and direct task-focused copy ([#9](https://github.com/RuneBrix/magic-the-deckbuilder/issues/9)).
- Keep search and the working deck central: expand filters, function tags and query only when needed; show the mana curve in Statistics; move JSON backup/restore into Settings on desktop and mobile.
- Add light, dark and device-following appearance in Settings. Save the choice separately from deck data, with a session fallback when browser storage is unavailable.

### Development

- Add GitHub issue and pull-request templates, a feature inventory, roadmap and development workflow.
- Record GitHub as the preferred tracker in project instructions. Transfer the initial roadmap into [GitHub issues #1–#8](https://github.com/RuneBrix/magic-the-deckbuilder/issues).

## Initial MVP — 2026-10-26

Initial local delivery; this is not a published GitHub release or signed desktop application.

### Added

- Local deck creation and editing, quantities, commander selection and personal role tags.
- Scryfall search with guided filters, full syntax, curated function tags and related narrower suggestions.
- Deck curve, average nonland mana value, type, color and role statistics.
- Partial format legality checks and card-data refresh.
- Atomic text imports, text export and JSON workspace backup/restore.
- Responsive interface with mobile deck access and backup controls.

### Validation

- Eight automated checks passed; live browser checks covered search, persistence, imports and desktop/mobile layouts on Windows.
- macOS execution, complete tag discovery and comprehensive format rules remain unverified or unimplemented as described in [FEATURES.md](docs/FEATURES.md).
