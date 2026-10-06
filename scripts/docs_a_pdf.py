"""Convierte los documentos de entrega (Markdown) en PDF para la cooperativa.

Uso (desde la raíz del repo, en WSL o Linux con Python 3):
    pip install pymupdf markdown
    python3 scripts/docs_a_pdf.py

Lee docs/entrega/*.md y docs/entrega/privado/*.md y deja cada PDF junto a su .md.
Los .md son la fuente editable; los PDF son lo que se entrega.
"""
import glob
import io
import os
import re

import markdown
import pymupdf

VERDE = "#14493A"
VERDE_CLARO = "#E8F1EC"
VERDE_RGB = (0x14 / 255, 0x49 / 255, 0x3A / 255)
BANDA = 96

FUENTES = [
    # (familia, archivo, negrita, cursiva); se usan si existen.
    ("Cuerpo", "/mnt/c/Windows/Fonts/arial.ttf", False, False),
    ("Cuerpo", "/mnt/c/Windows/Fonts/arialbd.ttf", True, False),
    ("Cuerpo", "/mnt/c/Windows/Fonts/ariali.ttf", False, True),
    ("Cuerpo", "/mnt/c/Windows/Fonts/arialbi.ttf", True, True),
    ("Simbolos", "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf", False, False),
    ("Simbolos", "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", True, False),
    ("Mono", "/usr/share/fonts/truetype/dejavu/DejaVuSansMono.ttf", False, False),
    # Windows nativo (sin WSL).
    ("Cuerpo", "C:/Windows/Fonts/arial.ttf", False, False),
    ("Cuerpo", "C:/Windows/Fonts/arialbd.ttf", True, False),
    ("Cuerpo", "C:/Windows/Fonts/ariali.ttf", False, True),
    ("Cuerpo", "C:/Windows/Fonts/arialbi.ttf", True, True),
    ("Simbolos", "C:/Windows/Fonts/seguisym.ttf", False, False),
    ("Mono", "C:/Windows/Fonts/consola.ttf", False, False),
]

CSS = f"""
* {{ font-family: Cuerpo, Simbolos, sans-serif; }}
body {{ font-size: 10.5px; line-height: 1.45; color: #1f2933; }}
h1 {{ font-size: 21px; color: {VERDE}; margin: 0 0 4px 0; }}
h2 {{ font-size: 15px; color: {VERDE}; margin: 18px 0 6px 0; }}
h3 {{ font-size: 12px; color: {VERDE}; margin: 12px 0 4px 0; }}
h4 {{ font-size: 11px; margin: 10px 0 3px 0; }}
p {{ margin: 0 0 6px 0; text-align: justify; }}
ul, ol {{ margin: 0 0 6px 0; padding-left: 16px; }}
li {{ margin-bottom: 3px; }}
table {{ border-collapse: collapse; width: 100%; margin: 4px 0 10px 0; }}
th {{ color: {VERDE}; font-weight: bold; text-align: left; padding: 4px 5px; font-size: 9.5px; border: 0.6px solid #b8c4bd; }}
td {{ padding: 4px 5px; font-size: 9.5px; border: 0.6px solid #b8c4bd; vertical-align: top; }}
pre {{ font-family: Mono; font-size: 8.5px; margin: 4px 0 8px 12px; }}
code {{ font-family: Mono; font-size: 9px; }}
hr {{ border: 0; margin: 6px 0; }}
blockquote {{ margin: 6px 0 6px 12px; font-style: italic; }}
"""


def archivo_fuentes():
    arch = pymupdf.Archive()
    caras = []
    for familia, ruta, negrita, cursiva in FUENTES:
        if not os.path.exists(ruta):
            continue
        arch.add(open(ruta, "rb").read(), os.path.basename(ruta))
        caras.append(
            f"@font-face {{ font-family: {familia}; src: url({os.path.basename(ruta)});"
            f" font-weight: {'bold' if negrita else 'normal'}; font-style: {'italic' if cursiva else 'normal'}; }}"
        )
    return arch, "\n".join(caras)


def preparar_md(texto):
    # Los diagramas mermaid no se pueden dibujar en PDF; cada documento ya trae su versión en texto o en tablas.
    texto = re.sub(r"```mermaid.*?```\s*", "", texto, flags=re.S)
    # Casillas de verificación de listas.
    texto = texto.replace("- [ ] ", "- ☐ ").replace("- [x] ", "- ☑ ")
    # Sublistas con 2 o 3 espacios: Markdown estándar pide 4.
    texto = re.sub(r"(?m)^ {2,3}(?=[-*] |\d+\. )", "    ", texto)
    return texto


def a_html(texto):
    lineas = texto.splitlines()
    titulo = "Documento"
    if lineas and lineas[0].startswith("# "):
        titulo = lineas[0][2:].strip()
        lineas = lineas[1:]
    cuerpo = markdown.markdown("\n".join(lineas), extensions=["tables", "fenced_code", "sane_lists", "nl2br"])
    return titulo, cuerpo


def generar(ruta_md):
    texto = preparar_md(open(ruta_md, encoding="utf-8").read())
    titulo, html_doc = a_html(texto)
    arch, caras = archivo_fuentes()
    story = pymupdf.Story(html=html_doc, user_css=caras + CSS, archive=arch)
    # En memoria: en Windows un archivo temporal queda bloqueado por el escritor.
    temporal = io.BytesIO()
    escritor = pymupdf.DocumentWriter(temporal)
    pagina = pymupdf.paper_rect("letter")
    marco = pagina + (54, 54, -54, -60)
    mas = True
    primera = True
    while mas:
        dispositivo = escritor.begin_page(pagina)
        mas, _ = story.place(marco + (0, BANDA, 0, 0) if primera else marco)
        primera = False
        story.draw(dispositivo)
        escritor.end_page()
    escritor.close()

    # Pie de página con título y numeración.
    doc = pymupdf.open("pdf", temporal.getvalue())
    total = len(doc)
    corto = titulo if len(titulo) <= 70 else titulo[:67] + "…"
    for i, p in enumerate(doc):
        if i == 0:
            banda = pymupdf.Rect(54, 40, p.rect.width - 54, 40 + BANDA)
            p.draw_rect(banda, color=None, fill=VERDE_RGB, overlay=False)
            caja = banda + (18, 14, -18, -26)
            p.insert_htmlbox(caja, f'<div style="color:#ffffff;font-family:sans-serif;font-weight:bold;font-size:20px;line-height:1.2">{titulo}</div>')
            p.insert_text((banda.x0 + 18, banda.y1 - 12), "Cooperativa Green Alliance · NIT 902.103.335-7 · www.greenallianceco.com", fontsize=9, color=(0.87, 0.93, 0.9))
        y = p.rect.height - 32
        p.draw_line((54, y - 8), (p.rect.width - 54, y - 8), color=(0.79, 0.83, 0.80), width=0.5)
        p.insert_text((54, y), f"Cooperativa Green Alliance · {corto}", fontsize=7.5, color=(0.35, 0.4, 0.38))
        etiqueta = f"Página {i + 1} de {total}"
        ancho = pymupdf.get_text_length(etiqueta, fontsize=7.5)
        p.insert_text((p.rect.width - 54 - ancho, y), etiqueta, fontsize=7.5, color=(0.35, 0.4, 0.38))
    doc.set_metadata({"title": titulo, "author": "Cooperativa Green Alliance", "subject": titulo})
    salida = ruta_md[:-3] + ".pdf"
    doc.save(salida, garbage=3, deflate=True)
    doc.close()
    print(f"{salida}: {total} páginas")


if __name__ == "__main__":
    for ruta in sorted(glob.glob("docs/entrega/*.md") + glob.glob("docs/entrega/privado/*.md")):
        generar(ruta)
