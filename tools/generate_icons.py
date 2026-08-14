from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[1]
ASSETS = ROOT / "assets"
DESKTOP_ASSETS = ROOT / "desktop" / "Qingdan.Desktop" / "Assets"
ASSETS.mkdir(parents=True, exist_ok=True)
DESKTOP_ASSETS.mkdir(parents=True, exist_ok=True)

SIZE = 1024
BACKGROUND = "#263b31"
image = Image.new("RGBA", (SIZE, SIZE), (0, 0, 0, 0))
draw = ImageDraw.Draw(image)
draw.rounded_rectangle((0, 0, SIZE - 1, SIZE - 1), radius=SIZE // 4, fill=BACKGROUND)

font_candidates = [
    Path("C:/Windows/Fonts/msyhbd.ttc"),
    Path("C:/Windows/Fonts/msyh.ttc"),
    Path("C:/Windows/Fonts/simhei.ttf"),
]
font_path = next(path for path in font_candidates if path.exists())
font = ImageFont.truetype(str(font_path), 490)
text = "清"
box = draw.textbbox((0, 0), text, font=font)
text_width = box[2] - box[0]
text_height = box[3] - box[1]
position = ((SIZE - text_width) / 2 - box[0], (SIZE - text_height) / 2 - box[1] - 10)
draw.text(position, text, font=font, fill="white")

image.resize((192, 192), Image.Resampling.LANCZOS).save(ASSETS / "qingdan-icon-192.png", optimize=True)
image.resize((512, 512), Image.Resampling.LANCZOS).save(ASSETS / "qingdan-icon-512.png", optimize=True)
image.save(
    DESKTOP_ASSETS / "Qingdan.ico",
    format="ICO",
    sizes=[(16, 16), (24, 24), (32, 32), (48, 48), (64, 64), (128, 128), (256, 256)],
)
print("Generated Qingdan PNG and Windows ICO assets.")
