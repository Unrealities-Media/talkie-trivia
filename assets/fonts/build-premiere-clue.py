"""Build the bundled, OFL-licensed clue face from its checked-in source."""
from pathlib import Path
from fontTools.ttLib import TTFont
from fontTools.varLib.instancer import instantiateVariableFont
from fontTools.pens.ttGlyphPen import TTGlyphPen
from fontTools.pens.transformPen import TransformPen
from fontTools.pens.recordingPen import DecomposingRecordingPen

root = Path(__file__).resolve().parent
font = instantiateVariableFont(
    TTFont(root / "CormorantGaramond-Variable.ttf"), {"wght": 650}, inplace=False
)
glyphs = font.getGlyphSet()
outlines = {}
for name in font.getGlyphOrder():
    recording = DecomposingRecordingPen(glyphs)
    glyphs[name].draw(recording)
    pen = TTGlyphPen(None)
    recording.replay(TransformPen(pen, (0.84, 0, 0, 1, 0, 0)))
    outlines[name] = pen.glyph()
for name, glyph in outlines.items():
    font["glyf"][name] = glyph
    advance, bearing = font["hmtx"][name]
    font["hmtx"][name] = (round(advance * 0.84), round(bearing * 0.84))
for record in font["name"].names:
    if record.nameID in (1, 4, 6, 16):
        record.string = "PremiereClue".encode(record.getEncoding())
    elif record.nameID in (2, 17):
        record.string = "Regular".encode(record.getEncoding())
font.save(root / "PremiereClue.ttf")
