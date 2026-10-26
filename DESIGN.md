# Arcana interface

The workspace serves card discovery and deck editing. Issue [#9](https://github.com/RuneBrix/magic-the-deckbuilder/issues/9) replaces the original violet dashboard with a collector’s index: warm paper, forest-green ink, crisp rules and restrained square controls. Card imagery remains complete and uncropped.

## Typography and icons

Self-hosted Newsreader gives headings and the wordmark an editorial character. Public Sans carries controls and dense deck rows. Font licenses and provenance live in public/fonts/. Headings use moderate weight and tracking no tighter than -0.025em. Body copy names concrete tasks, with no decorative slogans.

Authored SVGs share a 24-unit grid, 1.7-unit stroke and rounded joins. The overlapping card mark contains a diamond; the search lens repeats that diamond. Functional plus, close, transfer and help symbols retain familiar shapes. Icons accompany labels or accessible names.

## Appearance tokens

All interface surfaces use CSS variables in public/style.css. Mana colors keep their game meaning in either theme.

| Role | Light | Dark |
| --- | --- | --- |
| Ground | #f4f1e9 | #171e1b |
| Surface | #fffdf7 | #202a24 |
| Ink | #243a30 | #e4e9dc |
| Supporting text | #60685f | #acb9ac |
| Action | #276047 | #acd2a5 |
| Action text | #fffdf7 | #16251b |
| Divider | #d5d6ca | #435147 |
| Selection | #e5eadf | #2f4134 |

Settings offers Light, Dark and Use device setting. The default follows the device; explicit choices persist under arcana.theme.v1, separate from deck storage. A blocked preference write retains the current session’s choice and shows feedback. System appearance changes update the app only in device mode. Native form controls, focus, selection, scrollbars and browser theme color follow the palette.

## Focus and disclosure

The initial explorer shows the primary search, collapsed Filters and Browse by function, an optional query disclosure and three starting searches. Filters contains type, mana value, color identity, card name, Oracle text and cost. Selected function tags stay visible as removable chips even when the browser is collapsed. Clear filters appears when a query is active. Open disclosure state survives search and deck rerenders.

Settings, available in the header on every viewport, holds appearance and complete JSON backup/restore. Import/export stays with the working deck. The Cards tab focuses on quantities; the mana curve lives in Statistics. Checks retains its partial-legality explanation and refresh action.

## Layout and states

Wide screens retain navigation, flexible explorer and a sticky deck inspector. At 1200px, columns narrow; at 960px the deck enters document flow; at 600px navigation becomes a compact header. Phones retain two card columns and a fixed deck shortcut. Expanded text filters stack vertically; settings actions wrap or stack. Dialogs stay within the viewport and preserve native focus containment and Escape dismissal.

Use small radii for controls and generous separation between work areas. Card images preserve portrait proportions and their existing brief hover lift; reduced-motion preferences suppress transitions and animations. Native details/summary controls expose state and keyboard activation. All controls retain visible keyboard focus. Loading, empty, error, disabled and storage-warning states use the same theme tokens.

## Verification limits

Issue #9 was checked in the Windows browser at desktop and 390px mobile widths in both themes, with live Scryfall search, card addition, deck persistence, settings, keyboard disclosure and dialog dismissal. Automated tests cover appearance preference handling and disclosure rendering in addition to existing deck/server checks. These checks do not establish macOS or Safari support.
