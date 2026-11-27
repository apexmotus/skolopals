"""Branded user-manual PDF kit: write content with these helpers, then call build().

Copy next to the project's manual content file (see templates/manual_content.py):

    from manual_kit import Manual
    m = Manual(brand={...}, images="docs/manual/images")
    m.part("Part 1", "Customers", "Thuli signs up", "What a customer does…")
    m.h2("1.1 Sign in")
    m.fig("g04-login", "Signing in.", ["Your email.", "Your password."])
    m.build("docs/manual/Product-User-Manual.pdf")

Layout rules baked in (learned the hard way):
- Phone screenshots (<= 800px wide) sit beside their callout list; desktop ones go full width.
- Images are re-encoded to JPEG at print size in images/_pdf/ (PDF ~8 MB instead of 16+).
- Phone images max 108 mm tall and desktop 98 mm, so two figures fit on a page.
- Callout text sits in its own <span>: inline <b> inside a flex <li> splits into columns.
- WeasyPrint runs as the Homebrew CLI: the system Python often can't load its native libraries.
"""
from __future__ import annotations

import shutil
import subprocess
from html import escape
from pathlib import Path

from PIL import Image

DEFAULT_BRAND = {
    "product": "Product",
    "org": "Company name",
    "address": "",
    "version": "Version 1.0",
    "cover_title": "User manual",
    "doc_title": None,  # running header and PDF title; defaults to "<product> User Manual"
    "cover_subtitle": "From sign-up to everyday use",
    "cover_blurb": "For customers, staff and administrators.",
    "logo": None,  # path to a PNG
    "font": '"Avenir Next", Avenir, Helvetica, sans-serif',
    "primary": "#d81b7a",   # buttons, accents
    "secondary": "#6a1b9a", # headings
    "deep": "#1a0a28",      # cover and part pages
    "surface": "#2a1040",   # table headers
    "callout": "#f5c211",   # must match capture-lib.mjs callout colour
    "soft": "#ff8cc6",      # subtitle text on dark
    "muted_dark": "#c9b8d9",
    "tint": "#f7f1fb",
    "line": "#e6dcef",
    "ink": "#24103a",
    "muted": "#6b5d78",
}


class Manual:
    def __init__(self, brand: dict, images: str | Path):
        self.brand = {**DEFAULT_BRAND, **brand}
        self.img = Path(images).resolve()
        self.pdf_img = self.img / "_pdf"
        self.pdf_img.mkdir(exist_ok=True)
        self.out: list[str] = []
        self.toc: list[tuple[int, str, str]] = []
        self._ids = 0

    # -- structure ---------------------------------------------------------------------------
    def _anchor(self, level: int, title: str) -> str:
        self._ids += 1
        aid = f"s{self._ids}"
        self.toc.append((level, title, aid))
        return aid

    def part(self, num: str, title: str, who: str, intro: str):
        aid = self._anchor(1, f"{num} · {title}")
        self.out.append(
            f'<section class="part" id="{aid}"><div class="part-num">{escape(num)}</div>'
            f'<h1>{escape(title)}</h1><p class="who">{escape(who)}</p><p class="lead">{intro}</p></section>'
        )

    def h2(self, title: str):
        self.out.append(f'<h2 id="{self._anchor(2, title)}">{escape(title)}</h2>')

    def h3(self, title: str):
        self.out.append(f"<h3>{escape(title)}</h3>")

    def p(self, html: str):
        self.out.append(f"<p>{html}</p>")

    def steps(self, *items: str):
        self.out.append('<ol class="steps">' + "".join(f"<li>{i}</li>" for i in items) + "</ol>")

    def bullets(self, *items: str):
        self.out.append("<ul>" + "".join(f"<li>{i}</li>" for i in items) + "</ul>")

    def note(self, html: str, kind: str = "tip"):
        label = {"tip": "Tip", "important": "Important", "staff": "For staff", "privacy": "Your privacy"}[kind]
        self.out.append(f'<div class="note {kind}"><strong>{label}</strong> {html}</div>')

    def table(self, head: list[str], rows: list[list[str]]):
        self.out.append(
            "<table><thead><tr>" + "".join(f"<th>{h}</th>" for h in head) + "</tr></thead><tbody>"
            + "".join("<tr>" + "".join(f"<td>{c}</td>" for c in r) + "</tr>" for r in rows)
            + "</tbody></table>"
        )

    def faq(self, items: list[tuple[str, str]]):
        self.out.append('<dl class="faq">' + "".join(f"<dt>{q}</dt><dd>{a}</dd>" for q, a in items) + "</dl>")

    def journey(self, steps: list[tuple[str, str, str]], roles: dict[str, str]):
        """steps: (title, text, role_key); roles: role_key -> label. Up to 4 roles (r1..r4 colours)."""
        keys = list(roles)
        rows = "".join(
            f'<div class="j r{keys.index(k) + 1}"><b>{escape(t)}</b><span>{x}</span></div>' for t, x, k in steps
        )
        legend = "".join(f'<span class="dot r{i + 1}"></span>{escape(v)} ' for i, v in enumerate(roles.values()))
        self.out.append(f'<div class="journey">{rows}</div><p class="legend">{legend}</p>')

    def raw(self, html: str):
        self.out.append(html)

    def pagebreak(self):
        self.out.append('<div class="break"></div>')

    # -- figures -----------------------------------------------------------------------------
    def _src(self, name: str) -> str:
        path = self.img / f"{name}.png"
        if not path.exists():
            raise SystemExit(f"missing image {path}")
        dest = self.pdf_img / f"{name}.jpg"
        if not dest.exists() or dest.stat().st_mtime < path.stat().st_mtime:
            im = Image.open(path).convert("RGB")
            if im.width > 1600:
                im = im.resize((1600, round(im.height * 1600 / im.width)), Image.LANCZOS)
            im.save(dest, "JPEG", quality=82, optimize=True)
        return dest.as_uri()

    def fig(self, name: str, caption: str, callouts: list[str] | None = None, max_mm: float | None = None):
        """callouts[i] explains marker i+1 in the screenshot. Keep them in the same order."""
        w, _ = Image.open(self.img / f"{name}.png").size
        uri = self._src(name)
        legend = ""
        if callouts:
            legend = '<ol class="callouts">' + "".join(
                f'<li><span class="badge">{i}</span><span>{c}</span></li>' for i, c in enumerate(callouts, 1)
            ) + "</ol>"
        style = f' style="max-height:{max_mm}mm"' if max_mm else ""
        if w <= 800:
            self.out.append(
                f'<figure class="phone"><div class="shot"><img src="{uri}"{style}></div>'
                f'<figcaption><p class="cap">{caption}</p>{legend}</figcaption></figure>'
            )
        else:
            self.out.append(
                f'<figure class="desk"><img src="{uri}"{style}>'
                f'<figcaption><p class="cap">{caption}</p>{legend}</figcaption></figure>'
            )

    def pair(self, a: str, cap_a: str, b: str, cap_b: str):
        """Two phone screens side by side (before/after)."""
        self.out.append(
            '<div class="pair">'
            + "".join(f'<figure><img src="{self._src(n)}"><figcaption>{c}</figcaption></figure>' for n, c in ((a, cap_a), (b, cap_b)))
            + "</div>"
        )

    # -- output ------------------------------------------------------------------------------
    def css(self) -> str:
        b = self.brand
        return f"""
@page {{ size: A4; margin: 18mm 16mm;
  @top-left {{ content: string(part); font: 600 8pt {b['font']}; color: {b['muted']}; }}
  @top-right {{ content: "{escape(b['doc_title'] or b['product'] + ' User Manual')}"; font: 8pt {b['font']}; color: {b['muted']}; }}
  @bottom-center {{ content: counter(page); font: 600 8pt {b['font']}; color: {b['secondary']}; }} }}
@page cover {{ margin: 0; @top-left {{ content: none }} @top-right {{ content: none }} @bottom-center {{ content: none }} }}
@page partpage {{ @top-left {{ content: none }} @top-right {{ content: none }} }}
body {{ font-family: {b['font']}; font-size: 10pt; line-height: 1.5; color: {b['ink']}; }}
.cover {{ page: cover; height: 297mm; background: {b['deep']}; color: #fff; position: relative; overflow: hidden; }}
.cover .band {{ position: absolute; left: 0; right: 0; bottom: 0; height: 22mm; background: linear-gradient(90deg, {b['primary']}, {b['secondary']}); }}
.cover .glow {{ position: absolute; right: -40mm; top: -40mm; width: 140mm; height: 140mm; border-radius: 50%; background: radial-gradient(circle, rgba(245,194,17,.35), rgba(245,194,17,0) 70%); }}
.cover img {{ width: 70mm; margin: 40mm 0 0 22mm; }}
.cover h1 {{ font-size: 40pt; line-height: 1.05; margin: 28mm 22mm 0; font-weight: 800; }}
.cover h1 span {{ color: {b['soft']}; }}
.cover p {{ margin: 8mm 22mm 0; font-size: 13pt; color: {b['muted_dark']}; max-width: 140mm; }}
.cover .meta {{ position: absolute; bottom: 32mm; left: 22mm; font-size: 9pt; color: {b['muted_dark']}; }}
.toc {{ page-break-after: always; }}
.toc ul {{ list-style: none; padding: 0; }}
.toc li a {{ color: {b['ink']}; text-decoration: none; }}
.toc li a::after {{ content: leader('.') target-counter(attr(href), page); color: {b['muted']}; }}
.toc li.l1 {{ font-weight: 700; margin-top: 3mm; }}
.toc li.l1 a {{ color: {b['secondary']}; }}
.toc li.l2 {{ padding-left: 6mm; font-size: 9.5pt; }}
.part {{ page: partpage; page-break-before: always; page-break-after: always; background: {b['deep']}; color: #fff; margin: -18mm -16mm; padding: 70mm 22mm 0; height: 297mm; box-sizing: border-box; }}
.part .part-num {{ color: {b['callout']}; font-weight: 800; letter-spacing: .1em; text-transform: uppercase; font-size: 11pt; }}
.part h1 {{ font-size: 34pt; margin: 4mm 0 2mm; line-height: 1.1; string-set: part content(); }}
.part .who {{ color: {b['soft']}; font-size: 13pt; margin: 0 0 10mm; }}
.part .lead {{ color: {b['muted_dark']}; font-size: 12pt; max-width: 140mm; }}
h2 {{ color: {b['secondary']}; font-size: 15pt; margin: 9mm 0 3mm; border-bottom: 2px solid {b['line']}; padding-bottom: 1.5mm; break-after: avoid; }}
h3 {{ font-size: 11pt; margin: 5mm 0 2mm; break-after: avoid; }}
p {{ margin: 0 0 3mm; }}
ul, ol {{ margin: 0 0 3mm; padding-left: 6mm; }}
li {{ margin-bottom: 1mm; }}
ol.steps li::marker {{ color: {b['primary']}; font-weight: 800; }}
figure {{ margin: 3mm 0 5mm; break-inside: avoid; }}
figure.phone {{ display: flex; gap: 7mm; align-items: flex-start; }}
figure.phone .shot {{ flex: 0 0 58mm; }}
figure.phone img {{ width: 58mm; max-height: 108mm; object-fit: cover; object-position: top; border-radius: 4mm; border: 1.2mm solid #120619; box-shadow: 0 1mm 3mm rgba(0,0,0,.25); }}
figure.phone figcaption {{ flex: 1; padding-top: 2mm; }}
figure.desk img {{ width: 100%; max-height: 98mm; object-fit: cover; object-position: top left; border-radius: 2mm; border: 0.4mm solid #ccc; box-shadow: 0 1mm 3mm rgba(0,0,0,.18); }}
figure.desk figcaption {{ margin-top: 2.5mm; }}
.cap {{ font-weight: 600; margin-bottom: 2mm; }}
ol.callouts {{ list-style: none; padding: 0; margin: 0; }}
ol.callouts li {{ display: flex; gap: 2.5mm; margin-bottom: 2mm; font-size: 9.5pt; }}
.badge {{ flex: 0 0 5.5mm; height: 5.5mm; border-radius: 50%; background: {b['callout']}; color: {b['deep']}; font-weight: 800; font-size: 8.5pt; text-align: center; line-height: 5.5mm; }}
.pair {{ display: flex; gap: 8mm; margin: 4mm 0 6mm; break-inside: avoid; }}
.pair figure {{ margin: 0; flex: 1; }}
.pair img {{ width: 58mm; max-height: 95mm; object-fit: cover; object-position: top; border-radius: 4mm; border: 1.2mm solid #120619; }}
.pair figcaption {{ font-size: 9pt; margin-top: 2mm; max-width: 70mm; }}
.note {{ border-left: 1.2mm solid {b['callout']}; background: #fff9e3; padding: 2.5mm 4mm; margin: 3mm 0 5mm; border-radius: 0 2mm 2mm 0; break-inside: avoid; font-size: 9.5pt; }}
.note.important {{ border-color: {b['primary']}; background: #fdeef5; }}
.note.staff {{ border-color: {b['secondary']}; background: {b['tint']}; }}
.note.privacy {{ border-color: #0b6e4f; background: #ecf8f2; }}
.note strong {{ display: block; text-transform: uppercase; font-size: 7.5pt; letter-spacing: .08em; margin-bottom: .5mm; }}
table {{ width: 100%; border-collapse: collapse; margin: 2mm 0 5mm; font-size: 9.5pt; break-inside: avoid; }}
th {{ text-align: left; background: {b['surface']}; color: #fff; padding: 2mm 3mm; font-weight: 600; }}
td {{ padding: 2mm 3mm; border-bottom: 0.3mm solid {b['line']}; vertical-align: top; }}
tr:nth-child(even) td {{ background: {b['tint']}; }}
.journey {{ display: flex; flex-direction: column; gap: 2mm; margin: 3mm 0; }}
.j {{ display: flex; gap: 4mm; align-items: baseline; padding: 2.5mm 4mm; border-radius: 2mm; border-left: 2mm solid; background: {b['tint']}; }}
.j b {{ flex: 0 0 22mm; }}
.r1 {{ border-color: {b['primary']}; }} .r2 {{ border-color: {b['callout']}; }} .r3 {{ border-color: #0b6e4f; }} .r4 {{ border-color: {b['secondary']}; }}
.legend {{ font-size: 8.5pt; color: {b['muted']}; }}
.dot {{ display: inline-block; width: 3mm; height: 3mm; border-radius: 50%; margin: 0 1mm 0 3mm; vertical-align: middle; }}
.dot.r1 {{ background: {b['primary']}; }} .dot.r2 {{ background: {b['callout']}; }} .dot.r3 {{ background: #0b6e4f; }} .dot.r4 {{ background: {b['secondary']}; }}
dl.faq dt {{ font-weight: 700; margin-top: 3mm; color: {b['secondary']}; break-after: avoid; }}
dl.faq dd {{ margin: 1mm 0 0; }}
.break {{ page-break-after: always; }}
"""

    def html(self) -> str:
        b = self.brand
        toc = "".join(f'<li class="l{lvl}"><a href="#{aid}">{escape(t)}</a></li>' for lvl, t, aid in self.toc)
        logo = f'<img src="{Path(b["logo"]).resolve().as_uri()}">' if b["logo"] else ""
        meta = " · ".join(x for x in (b["org"], b["address"], b["version"]) if x)
        return f"""<!doctype html><html><head><meta charset="utf-8"><title>{escape(b['doc_title'] or b['product'] + ' User Manual')}</title>
<style>{self.css()}</style></head><body>
<section class="cover"><div class="glow"></div>{logo}
  <h1>{escape(b['cover_title'])}<br><span>{escape(b['cover_subtitle'])}</span></h1>
  <p>{escape(b['cover_blurb'])}</p><div class="meta">{escape(meta)}</div><div class="band"></div></section>
<nav class="toc"><h2>Contents</h2><ul>{toc}</ul></nav>
{''.join(self.out)}
</body></html>"""

    def build(self, pdf_path: str | Path):
        pdf_path = Path(pdf_path).resolve()
        html_path = pdf_path.with_suffix(".html")
        html_path.write_text(self.html(), encoding="utf-8")
        exe = shutil.which("weasyprint")
        if not exe:
            raise SystemExit("weasyprint not found: brew install weasyprint")
        subprocess.run([exe, str(html_path), str(pdf_path)], check=True, stderr=subprocess.DEVNULL)
        print("wrote", pdf_path)
