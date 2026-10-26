---
name: Arcana
description: A calm card discovery and deckbuilding workspace.
colors:
  accent: "#6450b7"
  accent-hover: "#52409c"
  ink: "#263149"
  ground: "#f6f7fb"
  white: "#fff"
  muted: "#626c7e"
  line: "#e5e8ef"
  soft: "#eeebf8"
  focus: "#9c8bd9"
  mana-white: "#eee7d0"
  mana-blue: "#c5e1f1"
  mana-black: "#d7cfdc"
  mana-red: "#f1c4ba"
  mana-green: "#cbe0cc"
  mana-colorless: "#e5e5e8"
typography:
  headline:
    fontFamily: "'DM Sans', sans-serif"
    fontSize: "30px"
    fontWeight: 650
    lineHeight: 1.2
    letterSpacing: "-1px"
  title:
    fontFamily: "'DM Sans', sans-serif"
    fontSize: "17px"
    fontWeight: 650
    letterSpacing: "-.3px"
  body:
    fontFamily: "'DM Sans', sans-serif"
    fontSize: "14px"
  control:
    fontFamily: "'DM Sans', sans-serif"
    fontSize: "12px"
    fontWeight: 550
  card-name:
    fontFamily: "'DM Sans', sans-serif"
    fontSize: "11px"
    fontWeight: 600
rounded:
  badge: "4px"
  field: "5px"
  button: "6px"
  navigation: "7px"
  search: "9px"
  card: "11px"
  library: "12px"
  dialog: "14px"
spacing:
  compact: "8px"
  control: "10px"
  content: "18px"
  panel: "22px"
  gutter: "30px"
components:
  button-primary:
    backgroundColor: "{colors.accent}"
    textColor: "{colors.white}"
    typography: "{typography.control}"
    rounded: "{rounded.button}"
    padding: "10px 15px"
  button-primary-hover:
    backgroundColor: "{colors.accent-hover}"
  button-secondary:
    backgroundColor: "{colors.white}"
    textColor: "{colors.ink}"
    typography: "{typography.control}"
    rounded: "{rounded.button}"
    padding: "10px 15px"
  input:
    backgroundColor: "{colors.white}"
    textColor: "#3c465c"
    rounded: "{rounded.field}"
    padding: "9px 10px"
  navigation-selected:
    backgroundColor: "{colors.soft}"
    textColor: "#5945a3"
    rounded: "{rounded.navigation}"
    padding: "13px 12px"
  chip:
    backgroundColor: "#fafafd"
    textColor: "{colors.ink}"
    rounded: "{rounded.field}"
    padding: "7px 10px"
  chip-selected:
    backgroundColor: "{colors.soft}"
    textColor: "#58419e"
  library-card:
    backgroundColor: "{colors.white}"
    rounded: "{rounded.library}"
---

# Design System: Arcana

## Overview

**Creative North Star: "The Collector's Desk"**

Cool porcelain surfaces, navy ink, and violet selections frame the cards as the richest visual material. The interface is compact and orderly: discovery and deck editing share a working surface, with typography and hairlines carrying hierarchy.

**Key Characteristics:**
- Quiet neutral surfaces with violet actions and selection.
- Compact controls and generous, uncropped card imagery.
- A persistent working deck on wide screens; stacked work areas on small screens.

## Colors

### Primary

Violet accent marks primary actions, selected filters, links, and active deck tabs. Soft violet gives selected areas a quieter fill; the deeper accent marks primary-button hover.

### Secondary

The six mana backgrounds encode card identity. Their associated darker text remains distinct from the violet interaction palette.

### Neutral

Porcelain ground separates white navigation, search, filter, and deck surfaces. Navy ink carries content; muted slate carries supporting text. Pale hairlines divide work areas. The focus color marks keyboard position.

**The Selection Rule.** Use the violet family consistently for interactive selection; keep mana colors tied to card identity.

## Typography

DM Sans is the shared display and body face, with a sans-serif fallback. The main headline is semibold and tightly tracked; compact names, controls, and supporting details form a dense information hierarchy.

The headline scales to (26px) at the medium breakpoint and (25px) on phones. Section titles use the title role; card names use the card-name role. Paragraphs use (1.7) line-height. Counts in deck progress, quantities, and statistics use tabular numerals.

## Layout

The default workspace uses a (214px) navigation column, flexible explorer, and (340px) deck inspector. The explorer is capped at (1260px), with (30px) side gutters. Navigation and inspector remain sticky and viewport-height on wide screens.

At widths above (1550px), the side columns widen to (230px) and (365px), and results show four columns. At (1200px) and below, side columns narrow to (180px) and (305px) and results use two columns. At (960px) and below, the deck moves below the explorer and results use three columns. At (600px) and below, navigation becomes a compact horizontal header, results use two columns, and explorer gutters shrink to (18px). The deck library changes from three columns to two to one. Advanced fields become a single column on phones.

## Elevation & Depth

Tonal layering and thin borders carry most depth. Search has a near-invisible ambient shadow; card hover lifts by (3px) with a soft shadow. Dialogs and temporary notifications use stronger shadows. These exact effects, motion, and responsive thresholds are recorded in the sidecar.

## Shapes

Controls use small rounded corners; search and grouped surfaces are slightly softer. Card image frames retain the full portrait proportion (488/680). Library cards and dialogs use the largest container radii. Mana controls are circular; they do not establish a general pill style.

## Components

- **Buttons:** Compact violet primary and white bordered secondary variants share padding and shape. Primary hover deepens; secondary hover gains a pale violet fill. Disabled buttons reduce opacity to (.55).
- **Fields:** White fields use a fine border and compact padding. Search is a larger combined field with an embedded primary action; its focus-within border and faint outline use the accent.
- **Navigation:** Selected items use a soft violet surface and darker violet text. The mobile header keeps the two main destinations visible.
- **Tags:** Compact bordered chips wrap naturally. Selected function tags gain violet fill and border; removable query chips appear below. Color identity uses circular controls with a violet chosen outline.
- **Cards:** Portrait images are uncropped and lift on hover. Names and add controls sit below, followed by compact metadata. Library deck cards use white bordered containers with a tinted cover and padded body.
- **Deck inspector:** Hairline tabs, grouped compact rows, tabular counts, and a pale violet mana curve support editing without competing with card art.
- **Dialogs and feedback:** Rounded white dialogs sit over a translucent navy backdrop. Toasts use navy with white text. Warning and legality colors remain contextual.

**The Focus Rule.** Keep the shared visible keyboard outline on interactive controls; preserve reduced-motion behavior when extending components.

## Do's and Don'ts

### Do:

- **Do** use violet for actions and selection, and mana colors for card identity.
- **Do** preserve complete card images and readable names.
- **Do** retain keyboard focus visibility and the reduced-motion override.
- **Do** adapt the working deck into the document flow on narrow screens.

### Don't:

- **Don't** crop card art to fit landscape tiles.
- **Don't** replace compact information rows with decorative oversized containers.
