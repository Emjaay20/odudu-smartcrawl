# Odudu brand assets

Status: **proposed, awaiting owner approval.** Nothing here is wired into the
console, the pages, the documentation site, the README or the mail shell yet.
The mark and the wordmark ship as final only after the owner says yes.

"Odudu" means authority in Ibibio, spoken in Akwa Ibom, Nigeria. The mark is a
staff, the sign of that authority carried: a ring on a straight shaft with a
short crossbar.

## Files

| File                                       | What it is                                                                    |
| ------------------------------------------ | ----------------------------------------------------------------------------- |
| `mark.svg`                                 | The staff on a 32 grid, one colour (`currentColor`), so it themes             |
| `wordmark.svg`                             | `odudu` as five outlines, one colour                                          |
| `lockup.svg`                               | Mark left, wordmark right, one baseline                                       |
| `favicon.svg`, `favicon.ico`               | Mark on the Instrument rail surface, amber ring; the icon holds 16, 32 and 48 |
| `apple-touch-icon.png`, `icon-192/512.png` | The same tile, full bleed                                                     |
| `social.svg`, `social.png`                 | 1200 x 630 share image: lockup and tagline on the rail surface                |
| `LICENSE-IBM-Plex-Mono.txt`                | The font licence that covers the wordmark outlines                            |
| `build.ts`                                 | Exports every PNG and the ICO from the SVGs: `node brand/build.ts`            |

## Construction

The grid is 32 by 32. The shaft is a line at x=16 from y=10 to y=30. The ring
is a circle centred on (16, 6) with radius 4, and the shaft starts where the
ring ends, so its round cap meets the ring's inner edge without entering the
hole. The crossbar is a line at y=20 from x=12 to x=20. One stroke width, 2,
with round caps, is set once on a group. Everything sits on whole grid units
and the mark is symmetric about x=16.

At 16 px the stroke is one pixel wide and lands between two pixels, so the
shaft renders as two half-covered columns; the ring's hole stays open. The
test in `tests/lint/brand-assets.test.ts` holds both facts.

The crossbar's height is the open question for the owner. At y=20 the figure
reads as the astronomical sign for Venus. At y=14 (a collar under the ring) it
reads as a sceptre. The candidate sheet in `docs/phases/p4g-docs/` shows three
heights; changing one means editing one path in each SVG and running the build.

## Colour

The mark, wordmark and lockup take the colour of the text around them. The
favicon and social image use Instrument's own tokens
(`apps/admin-console/src/shared/view/tokens.css`) and nothing else: the rail
surface `#111514`, the rail ink `#e4e9e7`, the system amber `#f7c95a` for the
ring (amber means authority and nothing else), and the jade `#4fc894` rule.

## Wordmark

The lowercase word `odudu` is set in IBM Plex Mono Medium at 26 units on the
grid's baseline (y=31) and converted to outlines, so it renders the same
everywhere and no page fetches a font for it. IBM Plex Mono is licensed under
the SIL Open Font License 1.1, which permits embedding glyph outlines in a
logo; the licence text is `LICENSE-IBM-Plex-Mono.txt`. The tagline on the
social image is the same font at weight 400, also outlined.

The outlines were produced once with opentype.js 1.3.4 from
`@fontsource/ibm-plex-mono` 5.3.0 (`ibm-plex-mono-latin-500-normal.woff`),
`Font.getPath(character, x, 31, 26)` with the advance of one glyph, 15.6 units,
between letters. The repository does not depend on opentype.js; the outputs are
committed.

## Use

- Clear space: at least the height of the ring (8 units) on every side.
- Minimum size: the mark 16 px high, the lockup 96 px wide.
- Put the mark on a surface that gives it 4.5:1; Instrument's pairs do.
- Do not recolour the ring except to the system amber, outline the strokes,
  change the stroke weight, rotate, skew, add effects, or redraw the crossbar.
- Do not use the mark to suggest that a product is made or endorsed by the
  Odudu project.

## Trademark

The name Odudu and the staff mark are not licensed by the repository's
licences; see `LICENSING.md`. An informal web search on 2026-10-15 found no
product, company or trademark filing named Odudu in identity or software. It
cannot compare logos by eye and is not a clearance; a formal trademark and
design search stays an optional step before any commercial use.
