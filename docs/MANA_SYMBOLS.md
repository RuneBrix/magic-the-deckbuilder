# Mana symbols (#56)

Deck identity, statistics, text-card costs, card details and guided color/identity filters share the same renderer. W/U/B/R/G use the recognizable sun, drop, skull, flame and tree; C uses the colorless diamond. Generic numbers, variable costs and compound symbols retain their literal notation, keeping {C}, {1}, {U/B} and {G/P} distinct. Color and identity search semantics are unchanged.

Symbols have accessible color names. Filter labels keep their written names and hide the redundant icon from accessibility APIs. All symbol circles share 16px square bounds with centered 13px glyphs, including the library/editor identity badges. All six glyphs use the same horizontal centering; the blue-only offset was removed after visual feedback. Colors stay fixed across appearance palettes; dark glyphs on light mana backgrounds retain small-size contrast.

## Source and loading

The unmodified Mana 1.18.0 TrueType font by Andrew Gioia is bundled locally from [commit 6ca9e696d3bda2519dcf3eebd96598f84ad9ddd8](https://github.com/andrewgioia/mana/tree/6ca9e696d3bda2519dcf3eebd96598f84ad9ddd8). Upstream licenses the font under SIL OFL 1.1; symbol imagery is copyright Wizards of the Coast. The upstream README and license accompany the font in `public/fonts/`. Arcana uses its own small CSS mapping, without the upstream stylesheet, npm package or CDN. The existing server already serves TrueType fonts.

## Verification — 3 November 2026

Windows in-app browser checks at localhost:3000 covered desktop and 390px widths, light/dark green appearance, readable symbols in identity/statistics/text cards and filters, single accessible checkbox names, keyboard focus, and no horizontal overflow in narrow filters. Desktop statistics remains two columns; narrow statistics becomes one. Navigation remained at top 0 after 1,089px of narrow deck scrolling. Empty Sideboard/Maybeboard sections were absent in all four layouts and the tracker (#53/#57/#61); native regressions cover zone transitions, filtered populated zones, destinations, weighted statistics and header measurement.

Physical touch, macOS/Safari, other dark palettes and every long-search/dialog overlap path were not manually verified. These checks supplement PR #78; they do not establish full completion of its outstanding browser matrix. The Impeccable engine could not run because its cache/runtime was unavailable; no detector pass is claimed.

Follow-up sizing/alignment check: desktop/light and 390px/dark green library and filter indicators all measured 16x16px with centered flex alignment. Keyboard filter names and focus remained intact; the targeted mana-rendering test and diff whitespace check passed.
