"""Build the readable, condensed display face from its bundled OFL source.

Requires fontTools. Use the small optical master to retain fine strokes in
24–40px headings; the large result headline has its own bold display face.
"""
from pathlib import Path
from fontTools.ttLib import TTFont
from fontTools.varLib.instancer import instantiateVariableFont
from fontTools.pens.ttGlyphPen import TTGlyphPen
from fontTools.pens.transformPen import TransformPen
from fontTools.pens.recordingPen import DecomposingRecordingPen

root = Path(__file__).resolve().parent
font = instantiateVariableFont(
    TTFont(root / "BodoniModa-Variable.ttf"), {"wght": 500, "opsz": 12}, inplace=False
)
glyphs = font.getGlyphSet()
outlines = {}
for name in font.getGlyphOrder():
    recording = DecomposingRecordingPen(glyphs)
    glyphs[name].draw(recording)
    pen = TTGlyphPen(None)
    recording.replay(TransformPen(pen, (0.78, 0, 0, 1, 0, 0)))
    outlines[name] = pen.glyph()
for name, glyph in outlines.items():
    font["glyf"][name] = glyph
    advance, bearing = font["hmtx"][name]
    font["hmtx"][name] = (round(advance * 0.78), round(bearing * 0.78))
for record in font["name"].names:
    if record.nameID in (1, 4, 6, 16):
        record.string = "PremiereDisplay".encode(record.getEncoding())
    elif record.nameID in (2, 17):
        record.string = "Regular".encode(record.getEncoding())
font.save(root / "PremiereDisplay.ttf")
