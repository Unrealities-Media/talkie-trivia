"""Compress the existing clue font, preserving its full character set.

Requires fonttools==4.60.1 and Brotli==1.2.0 in a local Python environment.
Run: python assets/fonts/build-web-clue.py
This does not regenerate or change the native TTF.
"""

from pathlib import Path
from fontTools.pens.recordingPen import RecordingPen
from fontTools.ttLib import TTFont

directory = Path(__file__).resolve().parent
source = directory / "PremiereClue.ttf"
target = source.with_suffix(".woff2")
font = TTFont(source, recalcTimestamp=False)
font.flavor = "woff2"
font.save(target)

# Check the decoded web font, including outlines and advance widths, rather
# than assuming that a smaller output still represents the same typography.
original = TTFont(source)
web = TTFont(target)
assert original.getGlyphOrder() == web.getGlyphOrder()
assert original.getBestCmap() == web.getBestCmap()
assert original["hmtx"].metrics == web["hmtx"].metrics
original_glyphs, web_glyphs = original.getGlyphSet(), web.getGlyphSet()
for name in original.getGlyphOrder():
    before, after = RecordingPen(), RecordingPen()
    original_glyphs[name].draw(before)
    web_glyphs[name].draw(after)
    assert before.value == after.value, name
print(f"Verified {len(original.getGlyphOrder())} glyphs: "
      f"{source.stat().st_size:,} -> {target.stat().st_size:,} bytes")
