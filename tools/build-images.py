"""
Bildepipeline for V.Z Entreprenør.

Leser originaler fra assets/source/ og skriver web-optimaliserte filer til assets/img/:
  - Responsive varianter (WebP + JPEG-fallback) i flere bredder
  - Beskåret logo-merke til header/footer
  - Favicons (PNG) og sosialt delingsbilde (Open Graph, 1200x630)

Kjør på nytt etter at du har lagt til eller byttet et bilde:
    python -m pip install pillow
    python tools/build-images.py

Nye prosjektbilder: legg originalen i assets/source/ med kebab-case-navn
(små bokstaver, bindestrek, ingen mellomrom) og legg navnet til i PHOTOS under.
"""

from pathlib import Path

from PIL import Image, ImageDraw, ImageFont, ImageOps

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "assets" / "source"
OUT = ROOT / "assets" / "img"

# Bredder vi genererer. Vi skalerer aldri opp — kilder smalere enn en bredde hoppes over.
WIDTHS = (480, 800, 1200, 1600)

PHOTOS = [
    "helsparkling-arbeid",
    "helsparkling-start",
    "underlag-flekksparklet",
    "kjokken-maling-oversikt",
    "kjokken-maling-tildekket",
    "lobby-sand-og-oliven",
    "lobby-sandfarget-volum",
    "lobby-gronn-vegg-oversikt",
    "lobby-gronn-vegg-sofagruppe",
    "kontor-terrakotta-vegg",
    "skillevegg-stenderverk",
    "soverom-brun-vegg",
]

# Farger fra designsystemet (holdes i synk med :root i styles.css)
INK = (28, 30, 26)
PAPER = (245, 241, 234)
CLAY = (180, 83, 42)

FONT_DIR = Path("C:/Windows/Fonts")


def font(name, size):
    try:
        return ImageFont.truetype(str(FONT_DIR / name), size)
    except OSError:
        return ImageFont.load_default()


def build_photo(name):
    img = ImageOps.exif_transpose(Image.open(SRC / f"{name}.jpg")).convert("RGB")
    widths = [w for w in WIDTHS if w <= img.width] or [img.width]
    for w in widths:
        h = round(img.height * w / img.width)
        resized = img.resize((w, h), Image.LANCZOS)
        resized.save(OUT / f"{name}-{w}.webp", "WEBP", quality=78, method=6)
        resized.save(OUT / f"{name}-{w}.jpg", "JPEG", quality=80, optimize=True, progressive=True)
    print(f"{name}: {img.width}x{img.height} -> {widths}")


def build_logo():
    logo = Image.open(SRC / "logo-vz-entreprenor.png").convert("RGBA")
    # Gjør (nesten) hvit bakgrunn transparent
    px = [(r, g, b, 0 if min(r, g, b) > 238 else a) for r, g, b, a in logo.get_flattened_data()]
    logo.putdata(px)
    bbox = logo.getbbox()
    full = logo.crop(bbox)
    # Takmerket = øverste del over teksten "V.Z - Entreprenør"
    mark = full.crop((0, 0, full.width, int(full.height * 0.58)))
    mark = mark.crop(mark.getbbox())
    for h in (48, 96):
        w = round(mark.width * h / mark.height)
        m = mark.resize((w, h), Image.LANCZOS)
        m.save(OUT / f"logo-mark-{h}.png", optimize=True)
        m.save(OUT / f"logo-mark-{h}.webp", "WEBP", quality=90)
    print("logo mark", mark.size)
    return mark


def draw_monogram(size):
    """Kvadratisk monogram-ikon: 'VZ' på mørk bakgrunn med terrakotta strek."""
    scale = 4
    s = size * scale
    img = Image.new("RGBA", (s, s), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    d.rounded_rectangle((0, 0, s - 1, s - 1), radius=int(s * 0.22), fill=INK)
    f = font("georgiab.ttf", int(s * 0.46))
    text = "VZ"
    tb = d.textbbox((0, 0), text, font=f)
    tw, th = tb[2] - tb[0], tb[3] - tb[1]
    d.text(((s - tw) / 2 - tb[0], s * 0.42 - th / 2 - tb[1]), text, font=f, fill=PAPER)
    bar_w, bar_h = s * 0.46, max(scale * 2, s * 0.06)
    d.rectangle(((s - bar_w) / 2, s * 0.72, (s + bar_w) / 2, s * 0.72 + bar_h), fill=CLAY)
    return img.resize((size, size), Image.LANCZOS)


def build_favicons():
    for size, name in ((32, "favicon-32.png"), (180, "apple-touch-icon.png"), (192, "icon-192.png"), (512, "icon-512.png")):
        draw_monogram(size).save(OUT / name, optimize=True)
    draw_monogram(48).save(ROOT / "favicon.ico", sizes=[(16, 16), (32, 32), (48, 48)])


def build_og(mark):
    W, H = 1200, 630
    og = Image.new("RGB", (W, H), PAPER)
    photo = ImageOps.exif_transpose(Image.open(SRC / "helsparkling-arbeid.jpg")).convert("RGB")
    photo = ImageOps.fit(photo, (520, H), Image.LANCZOS, centering=(0.5, 0.35))
    og.paste(photo, (W - 520, 0))
    d = ImageDraw.Draw(og)
    d.rectangle((0, 0, 12, H), fill=CLAY)
    m = mark.resize((round(mark.width * 72 / mark.height), 72), Image.LANCZOS)
    og.paste(m, (72, 72), m)
    d.text((72, 190), "Maler og snekker", font=font("georgiab.ttf", 64), fill=INK)
    d.text((72, 270), "i Oslo", font=font("georgiab.ttf", 64), fill=CLAY)
    d.text((72, 380), "Sparkling, maling og snekkerarbeid", font=font("segoeui.ttf", 32), fill=INK)
    d.text((72, 424), "for hjem og bedrift. Gratis befaring.", font=font("segoeui.ttf", 32), fill=INK)
    d.text((72, 530), "V.Z Entreprenør  ·  +47 968 28 588", font=font("segoeuib.ttf", 28), fill=INK)
    og.save(OUT / "og-image.jpg", "JPEG", quality=85, optimize=True, progressive=True)


if __name__ == "__main__":
    OUT.mkdir(parents=True, exist_ok=True)
    for p in PHOTOS:
        build_photo(p)
    mark = build_logo()
    build_favicons()
    build_og(mark)
    print("Ferdig.")
