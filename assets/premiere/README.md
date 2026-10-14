# Midnight Premiere assets

The gameplay theater now renders the original board's text-free artwork directly. `reference-board.png` is an unchanged copy of `output/design-mockups/01-midnight-premiere.png`; PremiereStage clips the rectangle x=442, y=354, width=458, height=69 and scales it to the measured stage width. The original phone border, caption, and other controls are excluded. Native text and controls remain separate. The generated `theatre.png` remains the fallback artwork for unavailable movie posters.

Generated theatre, projection-paper, and ticket-paper textures use the approved reference at `output/design-mockups/01-midnight-premiere.png`. Rendered text and controls remain native, selectable, and accessible; no clue or answer is baked into these textures.

## Fonts

Bundled SIL Open Font License sources: [Bodoni Moda](https://github.com/google/fonts/tree/main/ofl/bodonimoda), [Cormorant Garamond](https://github.com/google/fonts/tree/main/ofl/cormorantgaramond), and [Jost](https://github.com/google/fonts/tree/main/ofl/jost). License files are beside the fonts in `assets/fonts`.

Static instances are renamed PremiereDisplay (Bodoni Moda weight 500, optical size 64), PremiereDisplay-Bold (weight 800, optical size 96), PremiereSerif (Cormorant Garamond weight 500), and PremiereSans (Jost weight 400). Display glyphs and horizontal metrics are condensed to 78% for the reference's tall cinema typography. All other glyph dimensions are unchanged. Original variable fonts are included for reproducibility.

## Generation prompts

Clue and ticket text use PremiereClue, a Cormorant Garamond weight-600 instance condensed to 90%. Rebuild with `python assets/fonts/build-premiere-clue.py` using fontTools 4.60.1. Its source and SIL license are included alongside the output font.

### Asset 1

Edit the supplied Midnight Premiere mockup into a production UI background asset. Isolate and recreate ONLY the cinema seating and projector-beam artwork directly below the cream clue screen in the LEFT phone panel. Landscape aspect ratio 3:1. Exactly match the reference's photographic velvety near-black/navy cinema seats, thin warm coral/red rim highlights, ivory smoky projector beams fanning upward, subtle blue atmosphere. Several rows of seats fill lower 65%, dark navy nearly black top behind light beams. Full bleed. No screen, no cream rectangle, no text, no letters, no UI, no frame, no people. This image will be placed immediately below the app's cream clue screen. Preserve the lush photographic realism and exact navy/coral palette of the reference; no vector/cartoon shapes.

### Asset 2

Edit supplied mockup into one clean texture asset: isolate the cream cinema projection screen material from LEFT phone. Landscape 16:9 rectangle, FULL BLEED screen texture only. Match original warm ivory center glow #F8E7CA, grainy charcoal vignette mostly at extreme edges, subtle film grain, aged projection-screen fabric. All words, lines, chips, furniture and frame removed. Empty illuminated projection screen for live text overlay. Match the reference's bright soft center and realistic subtle texture exactly.

### Asset 3

Edit supplied mockup into one production UI asset: isolate LEFT phone's ticket stub paper behind 'The Matrix'. Landscape aspect ratio 5:1. Remove all letters, icons, writing and dividers. Full bleed rectangular warm gray-beige ticket paper #B4A793 with fine realistic fiber/grain from the reference, gently mottled with subtle fold at 60% width. No shadows, no surrounding background, no perforated outer shape (implemented by code). Exact reference paper material, no added decoration.

