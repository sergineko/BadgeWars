"""Optional maintenance: losslessly convert licensed source fonts with fontTools + brotli."""
from pathlib import Path
from fontTools.ttLib import TTFont

for source in Path('public/fonts').glob('*.ttf'):
    font = TTFont(source)
    font.flavor = 'woff2'
    font.save(source.with_suffix('.woff2'))
