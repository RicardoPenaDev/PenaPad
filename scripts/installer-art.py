"""Gera as imagens do instalador do Windows (NSIS) a partir do ícone do app.

Uso: python3 scripts/installer-art.py <pasta com Inter-Bold.ttf> [--preview]
Precisa do Pillow. A fonte Inter (licença OFL) está em https://github.com/rsms/inter/releases.

Saída em src-tauri/installer/:
  sidebar.bmp  164×314  telas de boas-vindas e de conclusão
  header.bmp   150×57   faixa no topo das outras telas
"""
import sys
from pathlib import Path

from PIL import Image, ImageChops, ImageDraw, ImageFilter, ImageFont

ROOT = Path(__file__).resolve().parent.parent
ICON = ROOT / "src-tauri/icons/icon.png"
OUT = ROOT / "src-tauri/installer"
FONTS = Path(sys.argv[1]) if len(sys.argv) > 1 else Path(".")

INK_DARK = (16, 42, 94)     # azul-tinta escuro
INK = (31, 79, 163)         # #1f4fa3, cor do app
INK_LIGHT = (74, 128, 222)
S = 4                       # desenha em 4× e reduz (bordas suaves)


def font(name: str, size: int) -> ImageFont.FreeTypeFont:
    return ImageFont.truetype(str(FONTS / name), size * S)


def gradient(w: int, h: int, top, bottom) -> Image.Image:
    g = Image.new("RGB", (1, h))
    for y in range(h):
        t = y / max(1, h - 1)
        g.putpixel((0, y), tuple(round(a + (b - a) * t) for a, b in zip(top, bottom)))
    return g.resize((w, h))


def feather_mask(icon: Image.Image) -> Image.Image:
    """Só o traço branco da pena (sem o quadrado azul)"""
    r, g, b, a = icon.split()
    white = ImageChops.multiply(ImageChops.multiply(r.point(lambda v: 255 if v > 225 else 0), b.point(lambda v: 255 if v > 225 else 0)), a)
    return white


def sidebar(icon: Image.Image) -> Image.Image:
    W, H = 164 * S, 314 * S
    img = gradient(W, H, INK_LIGHT, INK_DARK).convert("RGBA")
    # Pena grande e translúcida no fundo, saindo pela borda
    pena = feather_mask(icon).resize((int(W * 1.35), int(W * 1.35)), Image.LANCZOS)
    marca = Image.new("RGBA", pena.size, (255, 255, 255, 0))
    marca.putalpha(pena.point(lambda v: v * 0.10))
    img.alpha_composite(marca, (int(W * 0.05), int(H * 0.42)))
    # Brilho suave atrás do ícone
    glow = Image.new("L", (W, H), 0)
    ImageDraw.Draw(glow).ellipse((W * 0.12, H * 0.06, W * 0.88, H * 0.40), fill=70)
    glow = glow.filter(ImageFilter.GaussianBlur(26 * S))
    img.alpha_composite(Image.merge("RGBA", (*[Image.new("L", (W, H), 255)] * 3, glow)))
    # Ícone com sombra
    size = 84 * S
    ic = icon.resize((size, size), Image.LANCZOS)
    x, y = (W - size) // 2, 34 * S
    sombra = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    sombra.paste((0, 0, 0, 90), (x, y + 5 * S), ic.split()[3])
    img.alpha_composite(sombra.filter(ImageFilter.GaussianBlur(7 * S)))
    img.alpha_composite(ic, (x, y))
    d = ImageDraw.Draw(img)
    # Nome e descrição
    f1 = font("Inter-Bold.ttf", 24)
    def center(text, f, ty, fill):
        w = d.textlength(text, font=f)
        d.text(((W - w) / 2, ty), text, font=f, fill=fill)
    # Só o nome: a mesma imagem aparece no instalador em português e em inglês
    center("PenaPad", f1, 136 * S, (255, 255, 255, 255))
    d.rounded_rectangle((W / 2 - 14 * S, 172 * S, W / 2 + 14 * S, 174 * S), radius=S, fill=(255, 255, 255, 130))
    return img.convert("RGB").resize((164, 314), Image.LANCZOS)


def header(icon: Image.Image) -> Image.Image:
    W, H = 150 * S, 57 * S
    img = Image.new("RGBA", (W, H), (255, 255, 255, 255))
    # O instalador põe esta imagem à esquerda, com o título da tela logo depois: ícone + nome alinhados à esquerda
    size = 34 * S
    ic = icon.resize((size, size), Image.LANCZOS)
    img.alpha_composite(ic, (6 * S, (H - size) // 2))
    d = ImageDraw.Draw(img)
    f = font("Inter-Bold.ttf", 15)
    d.text((6 * S + size + 6 * S, H / 2 - 10 * S), "PenaPad", font=f, fill=INK + (255,))
    return img.convert("RGB").resize((150, 57), Image.LANCZOS)


if __name__ == "__main__":
    OUT.mkdir(exist_ok=True)
    icon = Image.open(ICON).convert("RGBA")
    sidebar(icon).save(OUT / "sidebar.bmp")
    header(icon).save(OUT / "header.bmp")
    # Prévias em PNG (só para olhar; não vão no instalador)
    if "--preview" in sys.argv:
        sidebar(icon).resize((164 * 2, 314 * 2), Image.LANCZOS).save(OUT / "_preview-sidebar.png")
        header(icon).resize((150 * 2, 57 * 2), Image.LANCZOS).save(OUT / "_preview-header.png")
    print("ok:", OUT)
