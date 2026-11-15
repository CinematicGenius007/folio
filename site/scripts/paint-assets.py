#!/usr/bin/env python3
"""Paint the website's scene images.

The site's look is a 1970s print ad: a navy dusk sky, one coral cloud, a green meadow that darkens down the
page, everything soft and grainy. To keep pages light, the images here are painted *without* grain (smooth
images compress to a few kilobytes); the grain is added in CSS on top of everything, text included.

Outputs go to site/public/assets/. They are committed, so the Vercel build never runs this.
Requires numpy and Pillow (with AVIF support). Run from the repo root:

    python3 site/scripts/paint-assets.py
"""
from pathlib import Path

import numpy as np
from PIL import Image, ImageFilter

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / "site" / "public" / "assets"
SHOTS = ROOT / "docs" / "screenshots"
rng = np.random.default_rng(7)

# Where the hero image hands over to the CSS ground gradient, and where the closing image picks it up.
GROUND_TOP = "#3e682c"
GROUND_END = "#121f1e"


def hexc(s):
    s = s.lstrip("#")
    return np.array([int(s[i : i + 2], 16) for i in (0, 2, 4)], np.float32) / 255


def resize(a, size):
    return np.asarray(Image.fromarray(a.astype(np.float32), mode="F").resize(size, Image.BICUBIC), np.float32)


def fbm(shape, base=(8, 8), octaves=5, persistence=0.55, periodic=False):
    """Fractal value noise. `periodic` makes it tile seamlessly (used for the ground texture)."""
    h, w = shape
    total, amp, norm = np.zeros(shape, np.float32), 1.0, 0.0
    by, bx = base
    for _ in range(octaves):
        gy, gx = max(2, int(by)), max(2, int(bx))
        small = rng.random((gy, gx)).astype(np.float32)
        if periodic:
            big = resize(np.tile(small, (3, 3)), (w * 3, h * 3))
            layer = big[h : 2 * h, w : 2 * w]
        else:
            layer = resize(small, (w, h))
        total += amp * layer
        norm += amp
        amp *= persistence
        by, bx = by * 2, bx * 2
    return total / norm


def blur(a, r):
    """Box blur of radius r (Pillow cannot blur float images, so this uses cumulative sums)."""
    r = max(1, round(r))
    out = a.astype(np.float32)
    for axis in (0, 1):
        pad = [(0, 0)] * out.ndim
        pad[axis] = (r + 1, r)
        c = np.cumsum(np.pad(out, pad, mode="edge"), axis=axis, dtype=np.float64)
        n = out.shape[axis]
        hi = np.take(c, np.arange(2 * r + 1, 2 * r + 1 + n), axis=axis)
        lo = np.take(c, np.arange(n), axis=axis)
        out = ((hi - lo) / (2 * r + 1)).astype(np.float32)
    return out


def blur3(a, r):
    for _ in range(3):
        a = blur(a, r)
    return a


def ramp(y, stops):
    ys = np.array([p for p, _ in stops], np.float32)
    cs = np.stack([hexc(c) for _, c in stops])
    return np.stack([np.interp(y, ys, cs[:, k]) for k in range(3)], -1)


def screen(base, layer):
    return 1 - (1 - base) * (1 - layer)


def finish(img, saturation=0.82):
    gray = img.mean(-1, keepdims=True)
    return np.clip(gray + (img - gray) * saturation, 0, 1)


def save(img, name, widths, alpha=None):
    """Writes AVIF + WebP at each width (alpha images: WebP only)."""
    rgb = (np.clip(img, 0, 1) * 255).astype(np.uint8)
    im = Image.fromarray(rgb) if alpha is None else Image.fromarray(
        np.dstack([rgb, (np.clip(alpha, 0, 1) * 255).astype(np.uint8)]), "RGBA"
    )
    for w in widths:
        h = round(im.height * w / im.width)
        out = im.resize((w, h), Image.LANCZOS)
        out.save(OUT / f"{name}-{w}.webp", quality=82, method=6)
        if alpha is None:
            out.save(OUT / f"{name}-{w}.avif", quality=60)
    print("wrote", name, widths)


# ---- hero: sky, cloud, hill, near meadow (painted at 960x640, shipped up to 1920 wide) -------------------
def hero():
    W, H = 960, 640
    Y, X = np.mgrid[0:H, 0:W].astype(np.float32)
    sky = ramp(Y, [(0, "#0b1022"), (120, "#141d36"), (230, "#1b3248"), (310, "#1f4d5c"), (370, "#2a6470")])
    sky *= (0.88 + 0.24 * fbm((H, W), base=(3, 6), octaves=4))[..., None]

    cx, cy = 560, 170
    Yt = Y - cy + (X - cx) * 0.12
    ell = np.exp(-(((X - cx) / 290) ** 2 + (Yt / 60) ** 2) ** 1.4)
    streak = fbm((H, W), base=(4, 3), octaves=6, persistence=0.62)
    cloud = blur3(np.clip((streak - 0.36) * 3.0, 0, 1) * ell, 2)
    core = np.exp(-(((X - cx + 40) / 170) ** 2 + ((Yt + 4) / 32) ** 2)) * np.clip((streak - 0.3) * 2.5, 0, 1)
    wide = np.exp(-(((X - cx) / 540) ** 2 + ((Y - cy) / 170) ** 2))
    img = sky + wide[..., None] * hexc("#4a1f2c") * 0.5
    img = screen(img, cloud[..., None] * hexc("#e8402c"))
    img = screen(img, blur3(core, 3)[..., None] * hexc("#ff5a36") * 1.0)

    edge = 372 - 44 * np.exp(-((X - 250) / 340) ** 2) + 34 * (X / W) ** 1.6
    edge = edge + 3 * (fbm((1, W), base=(1, 24), octaves=3)[0] - 0.5)
    mask = blur3((Y > edge).astype(np.float32), 0.6)

    ground = ramp(Y - edge, [(0, "#5a8636"), (90, "#4d7a30"), (200, GROUND_TOP)])
    tex = (0.8 + 0.32 * fbm((H, W), base=(110, 150), octaves=2, persistence=0.6))
    tex *= 0.82 + 0.3 * fbm((H, W), base=(28, 20), octaves=3, persistence=0.6)
    tex *= 0.76 + 0.44 * fbm((H, W), base=(7, 5), octaves=3)
    # texture fades out toward the bottom so the hand-over to the CSS ground is seamless
    fade_tex = np.clip((H - 20 - Y) / 140, 0, 1)
    ground = ground * (1 + (tex - 1) * fade_tex)[..., None]
    light = np.exp(-(((X - cx) / 600) ** 2)) * np.exp(-np.clip(Y - edge, 0, None) / 160)
    ground = ground + light[..., None] * hexc("#3a3a10") * 0.55
    ground = ground + np.exp(-((Y - edge - 4) / 5) ** 2)[..., None] * hexc("#9cc06a") * 0.25
    img = img * (1 - mask[..., None]) + ground * mask[..., None]

    # wildflowers, thinning toward the bottom
    specks = np.zeros((H, W, 3), np.float32)
    for _ in range(1500):
        x = rng.random() * W
        y = 330 + rng.random() ** 1.6 * 300
        if y < (372 - 44 * np.exp(-((x - 250) / 340) ** 2) + 34 * (x / W) ** 1.6) + 12:
            continue
        c = hexc("#f2d14a") if rng.random() > 0.12 else hexc("#ff7a4a")
        specks[int(min(y, H - 1)), int(x)] = c * (0.5 + 0.5 * rng.random())
    for k in range(3):
        specks[..., k] = blur(specks[..., k], 0.5) * 2.6
    img = screen(img, np.clip(specks, 0, 1) * np.clip((H - 60 - Y) / 200, 0, 1)[..., None])

    img = img + blur3(np.clip(img.mean(-1) - 0.36, 0, 1), 10)[..., None] * hexc("#ff6a4a") * 1.1
    img = finish(img)
    # last rows: exactly the colour the CSS ground starts with
    hand = np.clip((Y - (H - 40)) / 40, 0, 1)[..., None]
    img = img * (1 - hand) + hexc(GROUND_TOP) * hand
    save(img, "hero", [960, 1920])


# ---- closing: the second, fainter glow low on the page --------------------------------------------------
def closing():
    W, H = 960, 420
    Y, X = np.mgrid[0:H, 0:W].astype(np.float32)
    base = ramp(Y, [(0, GROUND_END), (130, "#16263a"), (420, "#0c1226")])
    base *= (0.9 + 0.2 * fbm((H, W), base=(3, 7), octaves=4))[..., None]
    streak = fbm((H, W), base=(10, 3), octaves=5, persistence=0.6)
    glow = np.exp(-(((X - 470) / 380) ** 2 + ((Y - 230) / 70) ** 2) ** 1.2) * (0.45 + 0.8 * streak)
    img = screen(base, blur3(glow, 3)[..., None] * hexc("#b8443a") * 0.75)
    img = img + blur3(np.clip(img.mean(-1) - 0.3, 0, 1), 10)[..., None] * hexc("#ff6a4a") * 0.6
    img = finish(img)
    top = np.clip(1 - Y / 30, 0, 1)[..., None]
    img = img * (1 - top) + hexc(GROUND_END) * top
    save(img, "closing", [960, 1920])


# ---- ground texture: a seamless tile of dark clumps, laid over the CSS gradient ------------------------
def ground_tile():
    T = 256
    clumps = fbm((T, T), base=(40, 40), octaves=2, persistence=0.6, periodic=True)
    tufts = fbm((T, T), base=(8, 8), octaves=3, persistence=0.6, periodic=True)
    patches = fbm((T, T), base=(2, 2), octaves=3, periodic=True)
    v = (0.8 + 0.36 * clumps) * (0.82 + 0.3 * tufts) * (0.76 + 0.44 * patches)
    dark = np.clip(1.0 - v, 0, 1) * 1.5  # how much to darken
    light = np.clip(v - 1.0, 0, 1) * 1.2  # how much to lighten
    a = np.clip((dark + light) * 0.55, 0, 0.3)
    rgb = np.where((light > dark)[..., None], hexc("#b6d08a"), hexc("#06120a")) * np.ones((T, T, 3))
    im = Image.fromarray(np.dstack([(rgb * 255).astype(np.uint8), (a * 255).astype(np.uint8)]), "RGBA")
    im.save(OUT / "ground.webp", quality=70, method=6)
    print("wrote ground tile")


# ---- product screenshots as faded memories, dissolved at the edges ------------------------------------
def memory(src, name, crop, size, widths, edge=0.32):
    im = Image.open(src).convert("RGB")
    if crop:
        im = im.crop(crop)
    im = im.resize(size, Image.LANCZOS)
    W, H = im.size
    a = np.asarray(im, np.float32) / 255
    lo, hi = np.array([0.16, 0.22, 0.17]), np.array([0.97, 0.92, 0.82])
    a = lo + (hi - lo) * a
    g = a.mean(-1, keepdims=True)
    a = g + (a - g) * 0.72
    a = np.asarray(Image.fromarray((np.clip(a, 0, 1) * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(0.8)),
                   np.float32) / 255
    yy, xx = np.mgrid[0:H, 0:W].astype(np.float32)
    nx, ny = (xx - W / 2) / (W / 2), (yy - H / 2) / (H / 2)
    r = (np.abs(nx) ** 4 + np.abs(ny) ** 4) ** 0.25
    wobble = resize(rng.random((6, 9)).astype(np.float32), (W, H))
    al = np.clip((1 - r) / edge + 0.12 * (wobble - 0.5), 0, 1)
    al = al * al * (3 - 2 * al) * 0.94
    save(a, name, widths, alpha=al)


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    hero()
    closing()
    ground_tile()
    memory(SHOTS / "dashboard-light.jpg", "memory-dashboard", (300, 20, 1140, 620), (1120, 800), [560, 1120])
    memory(SHOTS / "nested-folder-meadow.jpg", "memory-folders", (0, 0, 1080, 540), (1120, 560), [560, 1120], edge=0.36)


if __name__ == "__main__":
    main()
