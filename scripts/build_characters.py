#!/usr/bin/env python3
"""Rebuild the Characters page from a folder of game submissions.

Usage (from the site root):
    python3 scripts/build_characters.py "images/WCTTP_Characters_<date>"

The submissions folder has one sub-folder per character, named
"Artist Name - Character Name", each containing a *_spritesheet.png
(plus an email .txt and a PNGs folder, which are ignored and never published).

For each character this:
  1. converts the sprite sheet to a 400px-tall WebP in images/characters/
     (skipped if the WebP is already newer than the source), and
  2. rewrites the card grid in characters.html between the
     <!-- CHARACTERS:START --> / <!-- CHARACTERS:END --> markers,
     along with the character count in the intro text.

Needs ImageMagick (`magick`) on the PATH.
"""
import html
import os
import re
import subprocess
import sys
import unicodedata

SITE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT_DIR = os.path.join(SITE, 'images', 'characters')
PAGE = os.path.join(SITE, 'characters.html')
FRAME_PX = 400
FPS = {8: 8, 4: 6}            # 4-frame walk cycles play a little slower
UNTITLED_2024 = 'untitled 2024'  # shown on the card as "2024 edition"
# Display-name fixes for names that can't be typed the same way in a folder name
ARTIST_NAMES = {'Now What!': 'Now What?!'}


def slug(text):
    text = unicodedata.normalize('NFKD', text).encode('ascii', 'ignore').decode()
    return re.sub(r'[^a-z0-9]+', '-', text.lower()).strip('-')


def collect(src):
    chars = []
    for name in sorted(os.listdir(src), key=str.lower):
        folder = os.path.join(src, name)
        if not os.path.isdir(folder) or ' - ' not in name:
            continue
        sheets = sorted(f for f in os.listdir(folder) if f.endswith('_spritesheet.png'))
        if not sheets:
            print(f'  skipped (no *_spritesheet.png): {name}')
            continue
        artist, character = (part.strip() for part in name.split(' - ', 1))
        sheet = os.path.join(folder, sheets[0])
        w, h = map(int, subprocess.check_output(
            ['magick', 'identify', '-format', '%w %h', sheet]).split())
        frames = w // h
        if w % h or frames not in FPS:
            print(f'  skipped ({w}x{h} is not 4 or 8 square frames): {name}')
            continue
        chars.append(dict(artist=artist, character=character, frames=frames, sheet=sheet,
                          file=f'{slug(artist)}--{slug(character)}.webp'))
    return chars


def convert(c):
    dst = os.path.join(OUT_DIR, c['file'])
    if os.path.exists(dst) and os.path.getmtime(dst) >= os.path.getmtime(c['sheet']):
        return False
    subprocess.check_call(['magick', c['sheet'], '-resize', f'x{FRAME_PX}', '-quality', '85',
                           '-define', 'webp:alpha-quality=90', '-define', 'webp:method=6', dst])
    return True


def card(c):
    name = '2024 edition' if c['character'].lower() == UNTITLED_2024 else c['character']
    return f'''            <li class="char-card" tabindex="0" style="--frames:{c['frames']}; --fps:{FPS[c['frames']]};">
              <div class="char-card__stage">
                <div class="char-card__circle"></div>
                <div class="char-card__sprite"><img src="images/characters/{c['file']}" alt="" width="{c['frames'] * FRAME_PX}" height="{FRAME_PX}" loading="lazy"></div>
              </div>
              <div class="char-card__plate">
                <span class="char-card__name">{html.escape(name)}</span>
                <span class="char-card__artist">{html.escape(ARTIST_NAMES.get(c['artist'], c['artist']))}</span>
              </div>
            </li>'''


def main():
    if len(sys.argv) != 2:
        sys.exit(__doc__)
    src = sys.argv[1]
    os.makedirs(OUT_DIR, exist_ok=True)
    chars = collect(src)
    files = {c['file'] for c in chars}
    if len(files) != len(chars):
        sys.exit('Two characters ended up with the same file name — rename one folder.')
    converted = sum(convert(c) for c in chars)

    page = open(PAGE, encoding='utf-8').read()
    grid = '\n'.join(card(c) for c in chars)
    page, n = re.subn(r'(<!-- CHARACTERS:START -->).*?(<!-- CHARACTERS:END -->)',
                      lambda m: m.group(1) + '\n' + grid + '\n            ' + m.group(2), page, flags=re.S)
    if n != 1:
        sys.exit('Could not find the CHARACTERS:START / CHARACTERS:END markers in characters.html')
    page = re.sub(r'(<span class="char-count">)\d+(</span>)', rf'\g<1>{len(chars)}\g<2>', page)
    open(PAGE, 'w', encoding='utf-8').write(page)

    stale = sorted(set(os.listdir(OUT_DIR)) - files - {'.DS_Store'})
    print(f'{len(chars)} characters on the page, {converted} sprite sheets converted.')
    if stale:
        print('WebPs no longer used by the page (safe to delete):', *stale, sep='\n  ')


if __name__ == '__main__':
    main()
