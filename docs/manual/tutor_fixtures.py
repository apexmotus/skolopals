"""Fake upload files for the Tutor guide's application scenes. Every file says SAMPLE.

  python3 docs/manual/tutor_fixtures.py
"""
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont
from reportlab.lib.pagesizes import A4
from reportlab.pdfgen import canvas

out = Path(__file__).parent / "fixtures"
out.mkdir(parents=True, exist_ok=True)
NAME = "Palesa Mokoena"


def font(size, bold=False):
    names = ["Arial Bold.ttf", "Arial.ttf"] if bold else ["Arial.ttf"]
    for n in names:
        for d in ("/System/Library/Fonts/Supplemental/", "/Library/Fonts/"):
            try:
                return ImageFont.truetype(d + n, size)
            except OSError:
                pass
    return ImageFont.load_default()


def pdf(path, title, lines):
    c = canvas.Canvas(str(path), pagesize=A4)
    w, h = A4
    c.setFont("Helvetica-Bold", 18)
    c.drawString(60, h - 70, title)
    c.setFont("Helvetica", 11)
    y = h - 105
    for line in lines:
        c.drawString(60, y, line)
        y -= 18
    c.saveState()
    c.setFont("Helvetica-Bold", 90)
    c.setFillGray(0.85)
    c.translate(w / 2, h / 2)
    c.rotate(35)
    c.drawCentredString(0, 0, "SAMPLE")
    c.restoreState()
    c.save()


pdf(out / "sample-cv.pdf", f"{NAME} — Curriculum vitae (SAMPLE)", [
    "Made-up CV used only for the Skolopals Tutor guide.",
    "",
    "Experience",
    "  2022–2026  Mathematics teacher, Grades 4–7 (sample school)",
    "  2020–2022  After-school maths tutor",
    "",
    "Education",
    "  BEd (Intermediate Phase), 2021",
])

pdf(out / "sample-qualification.pdf", "Bachelor of Education — Intermediate Phase (SAMPLE)", [
    f"Awarded to {NAME}, 2021.",
    "This is not a real certificate. It is used only to show the upload step.",
])


def card(path, size, draw_fn):
    img = Image.new("RGB", size, "#e9ecef")
    d = ImageDraw.Draw(img)
    draw_fn(d, img)
    stamp = Image.new("RGBA", size, (0, 0, 0, 0))
    ImageDraw.Draw(stamp).text((size[0] // 2, size[1] // 2), "SAMPLE", font=font(size[0] // 6, True),
                               fill=(200, 30, 30, 120), anchor="mm")
    img = Image.alpha_composite(img.convert("RGBA"), stamp.rotate(20, center=(size[0] // 2, size[1] // 2)))
    img.convert("RGB").save(path, quality=90)


def id_card(d, img):
    d.rounded_rectangle((20, 20, 1180, 740), 30, fill="#d8f0e0", outline="#2b7a4b", width=6)
    d.text((60, 50), "SAMPLE IDENTITY CARD — NOT A REAL DOCUMENT", font=font(40, True), fill="#1d4d31")
    d.rectangle((60, 150, 380, 560), fill="#b8c4cc")
    d.ellipse((150, 200, 290, 340), fill="#8896a0")
    d.rounded_rectangle((110, 350, 330, 560), 60, fill="#8896a0")
    for i, (k, v) in enumerate([("Surname", "MOKOENA"), ("Names", "PALESA"), ("Date of birth", "01 JAN 1995"),
                                ("Identity number", "000000 0000 00 0")]):
        d.text((430, 160 + i * 95), k, font=font(28), fill="#3a4a40")
        d.text((430, 195 + i * 95), v, font=font(40, True), fill="#111")


def selfie(d, img):
    d.rectangle((0, 0, 900, 1200), fill="#cfd8dc")
    d.ellipse((290, 260, 610, 620), fill="#90a4ae")
    d.rounded_rectangle((170, 660, 730, 1200), 200, fill="#90a4ae")
    d.text((450, 120), "SAMPLE SELFIE", font=font(60, True), fill="#37474f", anchor="mm")


card(out / "sample-id.jpg", (1200, 760), id_card)
card(out / "sample-selfie.jpg", (900, 1200), selfie)
pdf(out / "sample-police-clearance.pdf", "Police clearance certificate (SAMPLE)", [
    f"Issued to {NAME}. Not a real certificate: used only for the Skolopals Tutor guide.",
])
print("fixtures in", out)
