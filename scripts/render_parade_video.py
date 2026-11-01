#!/usr/bin/env python3
"""Render a 4K transparent "character parade" video of every submitted character.

Usage (from the site root):
    python3 scripts/render_parade_video.py "images/WCTTP_Characters_<date>" OUT_DIR [--test]

Writes two ProRes 4444 (.mov, with alpha) clips to OUT_DIR:
  WCTTP-parade-loop.mov  starts mid-parade and loops seamlessly
  WCTTP-parade-fill.mov  starts empty and fills up; its last frame hands off
                         to the first frame of the loop clip
plus a small MP4 preview of each on a sky-blue background.
--test renders a few still PNGs instead of the videos.

Characters walk left to right in lanes that fill the frame. Higher lanes are
further away: smaller, slower and slightly hazed. Each character has a soft
ground shadow. Uses the full-size sprite sheets from the submissions folder
(the same list as the Characters page, including its EXCLUDE list).

Needs Pillow (pip install pillow) and ffmpeg: on the PATH, or from
`pip install imageio-ffmpeg` (macOS blocks hand-downloaded ffmpeg builds).
"""
import multiprocessing as mp
import os
import random
import shutil
import subprocess
import sys

from PIL import Image, ImageChops, ImageDraw, ImageFilter

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from build_characters import FPS, collect  # noqa: E402

W, H = 3840, 2160
VIDEO_FPS = 24
SECONDS = 18                # walk cycles (8 and 6 fps) and every lane all repeat in 18s
N_FRAMES = VIDEO_FPS * SECONDS
SRC = 800                   # sprite sheet frame size
LANES = 12
TOP_FEET, TOP_SIZE = 250, 230     # furthest lane: feet y and frame size on screen
BOTTOM_FEET, BOTTOM_SIZE = 2090, 800
WALK_SPEED = 0.8            # frame-widths per second at each lane's own scale
SPACING = 0.42              # gap between characters in a lane, in frame-widths
MAX_HAZE = 0.15             # furthest lane is mixed 15% toward white
SHADOW_ALPHA = 0.11         # matches the reference still
SEED = 2026


def ffmpeg():
    if shutil.which('ffmpeg'):
        return 'ffmpeg'
    import imageio_ffmpeg
    return imageio_ffmpeg.get_ffmpeg_exe()


def lanes():
    """Feet y and frame size per lane, far to near, spaced like a receding ground plane."""
    ratio = (BOTTOM_SIZE / TOP_SIZE) ** (1 / (LANES - 1))
    k = (BOTTOM_SIZE - TOP_SIZE) / (BOTTOM_FEET - TOP_FEET)   # size grows linearly with y
    out = []
    for i in range(LANES):
        size = TOP_SIZE * ratio ** i
        out.append(dict(i=i, size=size, feet=TOP_FEET + (size - TOP_SIZE) / k))
    for lane in out:
        lane['haze'] = MAX_HAZE * (1 - lane['i'] / (LANES - 1))
        lane['length'] = max(WALK_SPEED * lane['size'] * SECONDS, W + 1.4 * lane['size'])
        lane['speed'] = lane['length'] / SECONDS
    return out


def load(c):
    sheet = Image.open(c['sheet']).convert('RGBA')
    frames = [sheet.crop((i * SRC, 0, (i + 1) * SRC, SRC)) for i in range(c['frames'])]
    union = None
    legs, centers = 0, []
    for f in frames:
        a = f.getchannel('A').point(lambda v: 255 if v > 100 else 0)
        box = a.getbbox()
        if not box:
            continue
        union = box if union is None else (min(union[0], box[0]), min(union[1], box[1]),
                                           max(union[2], box[2]), max(union[3], box[3]))
    feet, top = union[3], union[1]
    for f in frames:   # widest stride in the bottom fifth of the figure sets the shadow width
        a = f.getchannel('A').point(lambda v: 255 if v > 100 else 0)
        y0 = feet - (feet - top) // 5
        box = a.crop((0, y0, SRC, feet)).getbbox()
        if box:
            legs = max(legs, box[2] - box[0])
            centers.append((box[0] + box[2]) / 2)
    height = feet - top
    c.update(src_frames=[f.crop(union) for f in frames], box=union, feet=feet,
             shadow_w=min(max(legs * 1.1, height * 0.35), height * 0.9),
             shadow_cx=sum(centers) / len(centers) if centers else (union[0] + union[2]) / 2)
    return c


def shadow(width, alpha):
    w, h = max(int(width), 4), max(int(width * 0.12), 2)
    pad = max(h, 4)
    img = Image.new('L', (w + 2 * pad, h + 2 * pad), 0)
    ImageDraw.Draw(img).ellipse((pad, pad, pad + w, pad + h), fill=int(255 * alpha))
    img = img.filter(ImageFilter.GaussianBlur(h * 0.35))
    out = Image.new('RGBA', img.size, (0, 0, 0, 0))
    out.putalpha(img)
    return out


def prepare(c, lane):
    """The character's frames scaled and hazed for one lane, plus its shadow and offsets."""
    sc = lane['size'] / SRC
    frames = []
    for f in c['src_frames']:
        f = f.resize((max(1, round(f.width * sc)), max(1, round(f.height * sc))), Image.LANCZOS)
        if lane['haze']:
            rgb = Image.blend(f.convert('RGB'), Image.new('RGB', f.size, 'white'), lane['haze'])
            rgb.putalpha(f.getchannel('A'))
            f = rgb
        frames.append(f)
    sh = shadow(c['shadow_w'] * sc, SHADOW_ALPHA)
    return dict(frames=frames, shadow=sh, fps=FPS[c['frames']],
                dx=c['box'][0] * sc, dy=(c['box'][1] - c['feet']) * sc,
                sdx=c['shadow_cx'] * sc - sh.width / 2, sdy=-sh.height / 2)


def plan(chars):
    rng = random.Random(SEED)
    ls = lanes()
    slots_per_lane = [int(l['length'] / (SPACING * l['size'])) for l in ls]
    # Deal characters into slots: every character at least once, no repeats within a lane
    pool = []
    while len(pool) < sum(slots_per_lane):
        batch = chars[:]
        rng.shuffle(batch)
        pool += batch
    slots = []
    for lane, n in zip(ls, slots_per_lane):
        used = set()
        gap = lane['length'] / n
        for k in range(n):
            j = next(j for j, c in enumerate(pool) if c['file'] not in used)
            c = pool.pop(j)
            used.add(c['file'])
            slots.append(dict(char=c, lane=lane,
                              u=(k + rng.uniform(-0.3, 0.3)) * gap % lane['length'],
                              feet=lane['feet'] + rng.uniform(-0.3, 0.3) * lane['size'] * 0.11,
                              phase=rng.randrange(8)))
    slots.sort(key=lambda s: s['feet'])   # far first, so nearer characters draw on top
    return slots


def paste(canvas, img, x, y):
    x, y = round(x), round(y)
    sx, sy = max(0, -x), max(0, -y)
    if x + img.width <= 0 or y + img.height <= 0 or x >= W or y >= H:
        return
    canvas.alpha_composite(img, dest=(x + sx, y + sy), source=(sx, sy))


SLOTS = []


def render(job):
    f, fill = job
    t = f / VIDEO_FPS
    canvas = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    for s in SLOTS:
        lane, p = s['lane'], s['prep']
        u = s['u'] + lane['speed'] * t
        if fill:
            u -= lane['length']
            if u < 0:
                continue          # hasn't walked on yet
        u %= lane['length']
        left = u - 1.2 * lane['size']
        if left > W:
            continue
        frame = p['frames'][(f * p['fps'] // VIDEO_FPS + s['phase']) % len(p['frames'])]
        paste(canvas, p['shadow'], left + p['sdx'], s['feet'] + p['sdy'])
        paste(canvas, frame, left + p['dx'], s['feet'] + p['dy'])
    return canvas.tobytes()


def encode(out_dir, name, fill, procs):
    mov = os.path.join(out_dir, f'{name}.mov')
    ff = subprocess.Popen([ffmpeg(), '-y', '-loglevel', 'error', '-f', 'rawvideo', '-pix_fmt', 'rgba',
                           '-s', f'{W}x{H}', '-r', str(VIDEO_FPS), '-i', '-',
                           '-c:v', 'prores_ks', '-profile:v', '4444', '-pix_fmt', 'yuva444p10le',
                           '-alpha_bits', '16', '-vendor', 'apl0', mov], stdin=subprocess.PIPE)
    with mp.get_context('fork').Pool(procs) as pool:
        for n, data in enumerate(pool.imap(render, [(f, fill) for f in range(N_FRAMES)], chunksize=2)):
            ff.stdin.write(data)
            if n % 48 == 0:
                print(f'  {name}: frame {n}/{N_FRAMES}', flush=True)
    ff.stdin.close()
    ff.wait()
    preview = os.path.join(out_dir, f'{name}-preview.mp4')
    subprocess.check_call([ffmpeg(), '-y', '-loglevel', 'error', '-f', 'lavfi', '-i',
                           f'color=c=0x9fd6e6:s=1920x1080:r={VIDEO_FPS}', '-i', mov,
                           '-filter_complex', '[1]scale=1920:-1[p];[0][p]overlay=shortest=1',
                           '-c:v', 'libx264', '-crf', '20', '-pix_fmt', 'yuv420p', preview])
    print(f'  wrote {mov}')


def main():
    args = [a for a in sys.argv[1:] if a != '--test']
    if len(args) != 2:
        sys.exit(__doc__)
    src, out_dir = args
    os.makedirs(out_dir, exist_ok=True)
    chars = [load(c) for c in collect(src)]
    print(f'{len(chars)} characters')
    for s in plan(chars):
        s['prep'] = prepare(s['char'], s['lane'])
        SLOTS.append(s)
    print(f'{len(SLOTS)} walkers in {LANES} lanes')
    if '--test' in sys.argv:
        for f, fill in [(0, False), (100, False), (120, True), (300, True)]:
            img = Image.frombytes('RGBA', (W, H), render((f, fill)))
            bg = Image.new('RGBA', (W, H), (159, 214, 230, 255))
            bg.alpha_composite(img)
            bg.convert('RGB').resize((1920, 1080)).save(
                os.path.join(out_dir, f'test-{"fill" if fill else "loop"}-{f}.png'))
        return
    procs = max(1, os.cpu_count() - 2)
    encode(out_dir, 'WCTTP-parade-loop', False, procs)
    encode(out_dir, 'WCTTP-parade-fill', True, procs)


if __name__ == '__main__':
    main()
