"""Generate an OFL-licensed font subset with deliberately scrambled Unicode cmap."""
import sys
from pathlib import Path

root = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(root / '.tmp/fonttools'))
from fontTools.ttLib import TTFont
from fontTools import subset

font = TTFont(root / 'vendor/reference-font.otf')
options = subset.Options()
subsetter = subset.Subsetter(options=options)
subsetter.populate(text='精神文化')
subsetter.subset(font)
mapping = dict(zip('精神文化', '奣奦奪奯'))
for table in font['cmap'].tables:
    if table.isUnicode():
        table.cmap = {ord(mapping[chr(cp)]): glyph for cp, glyph in table.cmap.items() if chr(cp) in mapping}
out = root / 'tests/fixtures'
out.mkdir(parents=True, exist_ok=True)
font.save(out / 'encrypted-source-han.otf')
(out / 'OFL.txt').write_text((root / 'vendor/LICENSE-reference-font').read_text(encoding='utf-8'), encoding='utf-8')
print('Generated encrypted Source Han Sans CN Normal subset')
