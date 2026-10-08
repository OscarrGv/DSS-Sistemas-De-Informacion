"""Genera docs/Reporte_AromaMatch.pdf (reporte técnico del sistema).

Uso:  python scripts/generar_reporte.py
Requiere: pip install reportlab pillow   y las capturas de docs/capturas (node scripts/capturas.js)
"""
import os
import tempfile

from PIL import Image as PILImage
from reportlab.graphics.shapes import Drawing, Rect, String, Line, Polygon
from reportlab.lib import colors
from reportlab.lib.enums import TA_JUSTIFY, TA_CENTER, TA_LEFT
from reportlab.lib.pagesizes import LETTER
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.units import cm
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import (BaseDocTemplate, Frame, PageTemplate, Paragraph, Spacer, Table, TableStyle,
                                KeepTogether, PageBreak, Image, CondPageBreak)
from reportlab.platypus.tableofcontents import TableOfContents

BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CAPTURAS = os.path.join(BASE, 'docs', 'capturas')
SALIDA = os.path.join(BASE, 'docs', 'Reporte_AromaMatch.pdf')
FECHA = 'Septiembre de 2026'

PLUM = colors.HexColor('#4A1F3F')
PLUM_DARK = colors.HexColor('#2B1727')
PLUM_SOFT = colors.HexColor('#EFE2EC')
CREAM = colors.HexColor('#F4EFE9')
CREAM2 = colors.HexColor('#F3E9DE')
AMBER = colors.HexColor('#A0561F')
GREEN = colors.HexColor('#2F7A4A')
RED = colors.HexColor('#B23A3A')
TEXT = colors.HexColor('#231A20')
MUTED = colors.HexColor('#776B72')
LINE = colors.HexColor('#E7DED5')
GOLD = colors.HexColor('#E6C595')


def registrar_fuentes():
    f = os.path.join(os.environ.get('WINDIR', r'C:\Windows'), 'Fonts')
    try:
        for nombre, archivo in [('Serif', 'georgia.ttf'), ('Serif-Bold', 'georgiab.ttf'), ('Serif-Italic', 'georgiai.ttf'),
                                ('Sans', 'calibri.ttf'), ('Sans-Bold', 'calibrib.ttf'), ('Sans-Italic', 'calibrii.ttf'),
                                ('Mono', 'consola.ttf')]:
            pdfmetrics.registerFont(TTFont(nombre, os.path.join(f, archivo)))
        pdfmetrics.registerFontFamily('Sans', normal='Sans', bold='Sans-Bold', italic='Sans-Italic', boldItalic='Sans-Bold')
        pdfmetrics.registerFontFamily('Serif', normal='Serif', bold='Serif-Bold', italic='Serif-Italic', boldItalic='Serif-Bold')
        return 'Serif', 'Sans', 'Sans-Bold', 'Serif-Italic', 'Mono'
    except Exception:
        return 'Times-Roman', 'Helvetica', 'Helvetica-Bold', 'Times-Italic', 'Courier'


SERIF, SANS, SANS_B, SERIF_I, MONO = registrar_fuentes()

st = {
    'titulo': ParagraphStyle('titulo', fontName=SERIF, fontSize=34, leading=40, textColor=colors.white),
    'h1': ParagraphStyle('h1', fontName=SERIF, fontSize=19, leading=24, textColor=PLUM, spaceBefore=4, spaceAfter=10),
    'h2': ParagraphStyle('h2', fontName=SERIF, fontSize=13.5, leading=18, textColor=TEXT, spaceBefore=12, spaceAfter=5),
    'h3': ParagraphStyle('h3', fontName=SANS_B, fontSize=10.5, leading=14, textColor=AMBER, spaceBefore=8, spaceAfter=3),
    'p': ParagraphStyle('p', fontName=SANS, fontSize=10.5, leading=15, textColor=TEXT, alignment=TA_JUSTIFY, spaceAfter=6),
    'li': ParagraphStyle('li', fontName=SANS, fontSize=10.5, leading=14.5, textColor=TEXT, leftIndent=14, bulletIndent=3, spaceAfter=3),
    'cell': ParagraphStyle('cell', fontName=SANS, fontSize=9.3, leading=12.3, textColor=TEXT),
    'cellb': ParagraphStyle('cellb', fontName=SANS_B, fontSize=9.3, leading=12.3, textColor=TEXT),
    'cap': ParagraphStyle('cap', fontName=SANS, fontSize=9, leading=12, textColor=MUTED, alignment=TA_CENTER, spaceBefore=4, spaceAfter=12),
    'formula': ParagraphStyle('formula', fontName=MONO, fontSize=9.2, leading=14, textColor=TEXT),
    'small': ParagraphStyle('small', fontName=SANS, fontSize=9, leading=12.5, textColor=MUTED, alignment=TA_JUSTIFY),
    'kpi': ParagraphStyle('kpi', fontName=SERIF, fontSize=20, leading=23, textColor=PLUM, alignment=TA_CENTER),
    'kpil': ParagraphStyle('kpil', fontName=SANS, fontSize=8.5, leading=11, textColor=MUTED, alignment=TA_CENTER),
    'toc1': ParagraphStyle('toc1', fontName=SANS, fontSize=11, leading=19, textColor=TEXT, leftIndent=0),
    'toc2': ParagraphStyle('toc2', fontName=SANS, fontSize=9.8, leading=15, textColor=MUTED, leftIndent=16),
}

ANCHO = 17.4 * cm
_tmp = tempfile.mkdtemp(prefix='aromamatch-reporte-')


# ---------- helpers ----------
def P(t, s='p'):
    return Paragraph(t, st[s])


def lista(items):
    return [Paragraph(i, st['li'], bulletText='•') for i in items]


def tabla(filas, anchos, cabecera=True, zebra=False):
    datos = [[Paragraph(str(c), st['cellb'] if cabecera and r == 0 else st['cell']) for c in fila] for r, fila in enumerate(filas)]
    t = Table(datos, colWidths=anchos, repeatRows=1 if cabecera else 0)
    estilo = [('GRID', (0, 0), (-1, -1), 0.5, LINE), ('VALIGN', (0, 0), (-1, -1), 'TOP'),
              ('LEFTPADDING', (0, 0), (-1, -1), 6), ('RIGHTPADDING', (0, 0), (-1, -1), 6),
              ('TOPPADDING', (0, 0), (-1, -1), 4.5), ('BOTTOMPADDING', (0, 0), (-1, -1), 4.5)]
    if cabecera:
        estilo.append(('BACKGROUND', (0, 0), (-1, 0), PLUM_SOFT))
    if zebra:
        for r in range(2 if cabecera else 1, len(filas), 2):
            estilo.append(('BACKGROUND', (0, r), (-1, r), colors.HexColor('#FBF8F4')))
    t.setStyle(TableStyle(estilo))
    return t


def caja(flowables, fondo=CREAM, borde=None, ancho=ANCHO):
    if not isinstance(flowables, list):
        flowables = [flowables]
    t = Table([[flowables]], colWidths=[ancho])
    estilo = [('BACKGROUND', (0, 0), (-1, -1), fondo), ('LEFTPADDING', (0, 0), (-1, -1), 11), ('RIGHTPADDING', (0, 0), (-1, -1), 11),
              ('TOPPADDING', (0, 0), (-1, -1), 9), ('BOTTOMPADDING', (0, 0), (-1, -1), 9)]
    if borde:
        estilo.append(('LINEBEFORE', (0, 0), (0, -1), 3, borde))
    t.setStyle(TableStyle(estilo))
    return t


def formula(lineas):
    return caja([Paragraph(l, st['formula']) for l in lineas], fondo=CREAM2)


def kpis(items):
    celdas = [[Paragraph(v, st['kpi']), Paragraph(l, st['kpil'])] for v, l in items]
    t = Table([celdas], colWidths=[ANCHO / len(items)] * len(items))
    t.setStyle(TableStyle([('BACKGROUND', (0, 0), (-1, -1), CREAM), ('LINEAFTER', (0, 0), (-2, -1), 3, colors.white),
                           ('TOPPADDING', (0, 0), (-1, -1), 9), ('BOTTOMPADDING', (0, 0), (-1, -1), 9), ('VALIGN', (0, 0), (-1, -1), 'MIDDLE')]))
    return t


def captura(nombre, pie, alto_max=10.3 * cm, ancho=ANCHO, titulo=None):
    origen = os.path.join(CAPTURAS, f'{nombre}.png')
    if not os.path.exists(origen):
        return [P(f'<i>[Falta la captura {nombre}.png — ejecuta node scripts/capturas.js]</i>', 'small')]
    destino = os.path.join(_tmp, f'{nombre}.jpg')
    im = PILImage.open(origen).convert('RGB')
    im.save(destino, quality=82, optimize=True)
    w, h = im.size
    ancho_final = min(ancho, alto_max * w / h)
    img = Image(destino, width=ancho_final, height=ancho_final * h / w)
    marco = Table([[img]], colWidths=[ancho_final + 2])
    marco.setStyle(TableStyle([('BOX', (0, 0), (-1, -1), 0.6, LINE), ('LEFTPADDING', (0, 0), (-1, -1), 0), ('RIGHTPADDING', (0, 0), (-1, -1), 0),
                               ('TOPPADDING', (0, 0), (-1, -1), 0), ('BOTTOMPADDING', (0, 0), (-1, -1), 0)]))
    cabeza = [Paragraph(titulo, st['h2'])] if titulo else []
    return [KeepTogether(cabeza + [marco, Paragraph(pie, st['cap'])])]


class Doc(BaseDocTemplate):
    """Registra los títulos en el índice."""

    def afterFlowable(self, f):
        if isinstance(f, Paragraph) and f.style.name in ('h1', 'h2'):
            nivel = 0 if f.style.name == 'h1' else 1
            texto = f.getPlainText()
            clave = f'k{id(f)}'
            self.canv.bookmarkPage(clave)
            self.canv.addOutlineEntry(texto, clave, level=nivel, closed=nivel > 0)
            self.notify('TOCEntry', (nivel, texto, self.page, clave))


def H1(t):
    return [CondPageBreak(7 * cm), Paragraph(t, st['h1'])]


def H2(t):
    return [CondPageBreak(5.5 * cm), Paragraph(t, st['h2'])]


# ---------- diagramas ----------
def diagrama_arquitectura():
    d = Drawing(ANCHO, 245)

    def bloque(x, y, w, h, titulo, sub, fondo, texto=TEXT):
        d.add(Rect(x, y, w, h, rx=8, ry=8, fillColor=fondo, strokeColor=LINE, strokeWidth=0.8))
        d.add(String(x + w / 2, y + h - 17, titulo, fontName=SANS_B, fontSize=10, fillColor=texto, textAnchor='middle'))
        for i, s in enumerate(sub):
            d.add(String(x + w / 2, y + h - 31 - i * 12, s, fontName=SANS, fontSize=8.3, fillColor=texto if texto != TEXT else MUTED, textAnchor='middle'))

    def flecha(x1, y1, x2, y2, etiqueta=''):
        d.add(Line(x1, y1, x2, y2, strokeColor=PLUM, strokeWidth=1.3))
        import math
        a = math.atan2(y2 - y1, x2 - x1)
        p = [x2, y2, x2 - 7 * math.cos(a - 0.4), y2 - 7 * math.sin(a - 0.4), x2 - 7 * math.cos(a + 0.4), y2 - 7 * math.sin(a + 0.4)]
        d.add(Polygon(p, fillColor=PLUM, strokeColor=PLUM))
        if etiqueta:
            d.add(String((x1 + x2) / 2, (y1 + y2) / 2 + 5, etiqueta, fontName=SANS, fontSize=7.8, fillColor=MUTED, textAnchor='middle'))

    W = ANCHO
    # Usuarios
    for i, (n, s) in enumerate([('Cliente', 'Buscar · comparar · guardar'), ('Asesor de ventas', 'Atender · recomendar · vender'), ('Administrador', 'Gestionar · analizar · decidir')]):
        bloque(10 + i * (W - 20) / 3, 190, (W - 20) / 3 - 10, 48, n, [s], PLUM_SOFT)
    # Interfaz
    bloque(10, 122, W - 20, 50, 'Interfaz (subsistema de diálogo)', ['Aplicación web de una sola página · HTML, CSS y JavaScript · vistas según el rol del usuario'], PLUM, colors.white)
    flecha(W / 2, 190, W / 2, 174)
    # Servidor
    bloque(10, 52, W - 20, 52, 'Servidor Node.js + Express (API REST)', ['Autenticación por sesión · reglas de negocio · registro de actividad, eventos y ventas'], CREAM)
    flecha(W / 2, 122, W / 2, 106, 'JSON sobre HTTP')
    # Base de modelos y datos
    bloque(10, -2, W / 2 - 15, 40, 'Base de modelos', ['recomendador.js · analisis.js'], colors.HexColor('#F8E9D6'))
    bloque(W / 2 + 5, -2, W / 2 - 15, 40, 'Base de datos (SQLite)', ['8 tablas · 24 meses de historial'], colors.HexColor('#E3F1E6'))
    flecha(W / 4, 52, W / 4, 40)
    flecha(3 * W / 4, 52, 3 * W / 4, 40)
    return d


def diagrama_datos():
    d = Drawing(ANCHO, 230)
    tablas = {
        'usuarios': (200, 175, ['id, nombre, correo, rol', 'password_hash, sucursal']),
        'preferencias': (10, 175, ['familia, ocasiones, temporada', 'intensidad, presupuesto, pesos']),
        'favoritos': (10, 95, ['usuario_id, perfume_id', 'precio_guardado']),
        'actividad': (390, 175, ['usuario_id, tipo, detalle', 'resultado, autor, fecha']),
        'perfumes': (200, 60, ['nombre, marca, familia, precio', 'notas, existencias, entrega']),
        'categorias': (10, 15, ['tipo, nombre', 'descripción, color']),
        'eventos': (390, 95, ['tipo, perfume_id, familia', 'ocasión, temporada, aceptada']),
        'ventas': (390, 15, ['perfume_id, cantidad, precio', 'cliente_id, asesor_id, fecha']),
    }
    w, h = 165, 44
    centro = {k: (x + w / 2, y + h / 2) for k, (x, y, _) in tablas.items()}
    for a, b in [('usuarios', 'preferencias'), ('usuarios', 'favoritos'), ('usuarios', 'actividad'), ('usuarios', 'eventos'),
                 ('perfumes', 'favoritos'), ('perfumes', 'eventos'), ('perfumes', 'ventas'), ('usuarios', 'ventas'), ('perfumes', 'categorias')]:
        (x1, y1), (x2, y2) = centro[a], centro[b]
        d.add(Line(x1, y1, x2, y2, strokeColor=colors.HexColor('#C9AFC1'), strokeWidth=1, strokeDashArray=[3, 2] if b == 'categorias' else None))
    for k, (x, y, campos) in tablas.items():
        d.add(Rect(x, y, w, h, rx=6, ry=6, fillColor=colors.white, strokeColor=PLUM, strokeWidth=0.9))
        d.add(Rect(x, y + h - 15, w, 15, rx=6, ry=6, fillColor=PLUM, strokeColor=PLUM))
        d.add(Rect(x, y + h - 15, w, 8, fillColor=PLUM, strokeColor=PLUM))
        d.add(String(x + 7, y + h - 11, k, fontName=SANS_B, fontSize=8.8, fillColor=colors.white))
        for i, c in enumerate(campos):
            d.add(String(x + 7, y + h - 26 - i * 10.5, c, fontName=SANS, fontSize=7.6, fillColor=TEXT))
    return d


# ---------- encabezados ----------
def portada(canvas, doc):
    w, h = LETTER
    canvas.saveState()
    canvas.setFillColor(PLUM)
    canvas.rect(0, 0, w, h, stroke=0, fill=1)
    canvas.setFillColor(PLUM_DARK)
    canvas.rect(0, 0, w, 6.2 * cm, stroke=0, fill=1)
    x, y = 2.2 * cm, h - 3.2 * cm
    canvas.setStrokeColor(colors.white)
    canvas.setLineWidth(1.4)
    canvas.roundRect(x + 0.2 * cm, y + 1.05 * cm, 0.5 * cm, 0.3 * cm, 2, stroke=1, fill=0)
    canvas.roundRect(x, y, 0.9 * cm, 1.05 * cm, 5, stroke=1, fill=0)
    canvas.setFillColor(colors.white)
    canvas.setFont(SERIF, 22)
    canvas.drawString(x + 1.3 * cm, y + 0.25 * cm, 'AromaMatch')
    canvas.setFillColor(GOLD)
    canvas.setFont(SANS, 10)
    canvas.drawString(2.2 * cm, h - 9.3 * cm, 'REPORTE TÉCNICO DEL PROYECTO')
    canvas.setFillColor(colors.white)
    canvas.setFont(SERIF, 36)
    canvas.drawString(2.2 * cm, h - 11 * cm, 'Sistema de Soporte')
    canvas.drawString(2.2 * cm, h - 12.4 * cm, 'a la Decisión para la')
    canvas.drawString(2.2 * cm, h - 13.8 * cm, 'selección de perfumes')
    canvas.setFillColor(colors.HexColor('#EADCE4'))
    canvas.setFont(SANS, 12)
    canvas.drawString(2.2 * cm, h - 15.2 * cm, 'Análisis, diseño, modelos de decisión e implementación')
    canvas.setFont(SANS, 10.5)
    datos = [('Materia', 'Sistemas de Información'), ('Integrantes', '[Nombre(s) del equipo]'),
             ('Profesor(a)', '[Nombre del profesor(a)]'), ('Institución', '[Nombre de la institución]'), ('Fecha', FECHA)]
    for i, (k, v) in enumerate(datos):
        yy = 4.9 * cm - i * 0.72 * cm
        canvas.setFillColor(GOLD)
        canvas.drawString(2.2 * cm, yy, k.upper())
        canvas.setFillColor(colors.white)
        canvas.drawString(5.6 * cm, yy, v)
    canvas.setFillColor(GOLD)
    canvas.setFont(SERIF_I, 12)
    canvas.drawRightString(w - 2.2 * cm, 1.2 * cm, '“Más que perfumes, mejores decisiones”')
    canvas.restoreState()


def interior(canvas, doc):
    w, h = LETTER
    canvas.saveState()
    canvas.setFillColor(PLUM)
    canvas.rect(0, h - 0.3 * cm, w, 0.3 * cm, stroke=0, fill=1)
    canvas.setFont(SERIF, 9.5)
    canvas.drawString(2.1 * cm, h - 1.15 * cm, 'AromaMatch')
    canvas.setFont(SANS, 8.5)
    canvas.setFillColor(MUTED)
    canvas.drawRightString(w - 2.1 * cm, h - 1.15 * cm, 'Reporte técnico · Sistema de Soporte a la Decisión')
    canvas.setStrokeColor(LINE)
    canvas.line(2.1 * cm, h - 1.4 * cm, w - 2.1 * cm, h - 1.4 * cm)
    canvas.line(2.1 * cm, 1.5 * cm, w - 2.1 * cm, 1.5 * cm)
    canvas.drawString(2.1 * cm, 1.0 * cm, f'Sistemas de Información · {FECHA}')
    canvas.drawRightString(w - 2.1 * cm, 1.0 * cm, f'{doc.page}')
    canvas.restoreState()


# ---------- contenido ----------
def contenido():
    s = [PageBreak()]

    # Índice
    s.append(Paragraph('Contenido', st['h1']))
    toc = TableOfContents()
    toc.levelStyles = [st['toc1'], st['toc2']]
    toc.dotsMinLevel = 0
    s.append(toc)
    s.append(PageBreak())

    # 1. Resumen
    s += H1('1. Resumen ejecutivo')
    s.append(P('<b>AromaMatch</b> es un sistema de soporte a la decisión (DSS) web para una perfumería con dos sucursales. '
               'Ayuda a tres tipos de usuario a tomar decisiones distintas: el <b>cliente</b> decide qué perfume comprar según '
               'la ocasión, la temporada, su familia olfativa preferida, la intensidad y su presupuesto; el <b>asesor de ventas</b> '
               'decide qué recomendar a cada cliente en tienda; y el <b>administrador</b> decide qué surtir, cuánto pedir, a qué '
               'precio vender y qué familias impulsar.'))
    s.append(P('El sistema combina una base de datos con 27 perfumes reales y 24 meses de historial de uso, una base de modelos '
               '(coincidencia ponderada, pronóstico de demanda, punto de reorden, análisis ABC y simulación de precios) y una interfaz '
               'que permite explorar escenarios “¿qué pasaría si…?”, ver por qué se recomienda cada opción y recibir alertas cuando '
               'algo requiere una decisión. En todos los casos el sistema <b>propone y explica</b>; la decisión final la toma la persona.'))
    s.append(Spacer(1, 6))
    s.append(kpis([('27', 'perfumes reales<br/>en catálogo'), ('3', 'perfiles de<br/>usuario'), ('6', 'modelos de<br/>decisión'),
                   ('48,342', 'eventos de uso<br/>(24 meses)'), ('3,997', 'ventas<br/>registradas')]))
    s.append(Spacer(1, 6))
    s.append(P('Las cifras de uso y ventas son datos de ejemplo generados para la demostración; los perfumes, sus notas olfativas, '
               'años de lanzamiento y perfumistas son reales.', 'small'))

    # 2. Problema
    s += H1('2. Planteamiento del problema')
    s.append(P('Elegir un perfume es una decisión con mucha información y poca estructura. Un catálogo típico ofrece decenas de '
               'fragancias con descripciones subjetivas; el cliente no sabe qué significan las notas de salida, corazón y fondo, ni '
               'cuál conviene para una cita en otoño o para la oficina en verano. El resultado es una compra basada en la marca o en '
               'la recomendación del momento, y una alta probabilidad de arrepentimiento.'))
    s.append(P('Del lado del negocio, la perfumería enfrenta decisiones repetitivas pero semiestructuradas:'))
    s += lista([
        '¿Qué perfumes pedir y cuántas unidades, si la demanda cambia fuertemente con la temporada?',
        '¿Qué pasaría con las ventas si se baja el precio de un perfume?',
        '¿Qué familias olfativas están ganando o perdiendo interés, y qué huecos hay en el surtido?',
        '¿Cómo aprovechar lo que el asesor sabe de cada cliente para recomendar mejor?',
    ])
    s.append(P('Sin un sistema, estas decisiones se toman por intuición y con información dispersa. AromaMatch concentra los datos, '
               'aplica modelos sencillos y explicables, y presenta el resultado en el momento en que se necesita.'))

    # 3. Objetivos
    s += H1('3. Objetivos')
    s += H2('3.1 Objetivo general')
    s.append(P('Desarrollar un sistema de soporte a la decisión que ayude a clientes, asesores y administradores de una perfumería a '
               'elegir, recomendar y gestionar perfumes a partir de las preferencias del cliente y del historial de uso y ventas.'))
    s += H2('3.2 Objetivos específicos')
    s += lista([
        'Calcular un porcentaje de coincidencia entre cada perfume y los criterios del cliente con un modelo ponderado y transparente.',
        'Permitir el análisis “¿qué pasaría si…?” sobre los pesos de los criterios y sobre el precio de los productos.',
        'Pronosticar la demanda por familia olfativa para los próximos tres meses y medir el error del pronóstico.',
        'Calcular el punto de reorden, el stock de seguridad y el pedido sugerido de cada perfume.',
        'Clasificar el catálogo con un análisis ABC (Pareto) por ingresos.',
        'Avisar de forma proactiva (alertas por excepción) sobre agotados, caídas de demanda, oportunidades de surtido y bajas de precio.',
        'Registrar la actividad para cerrar el ciclo recomendación → compra y medir la aceptación de las recomendaciones.',
    ])

    # 4. Usuarios
    s += H1('4. Alcance y usuarios')
    s.append(tabla([
        ['Perfil', 'Decisión que apoya el sistema', 'Funciones principales'],
        ['Cliente', '¿Qué perfume me conviene comprar?', 'Catálogo con filtros, detalle con pirámide olfativa y coincidencia, buscador inteligente con pesos ajustables, comparador de hasta 3 perfumes, favoritos, perfil olfativo, historial y alertas de precio.'],
        ['Asesor de ventas', '¿Qué le recomiendo a este cliente?', 'Búsqueda de clientes, ficha con preferencias e historial, registro de preferencias en tienda, recomendaciones sugeridas según el perfil, buscador y comparador calculados para el cliente, registro de ventas.'],
        ['Administrador', '¿Qué surto, cuánto pido, a qué precio vendo?', 'Dashboard con indicadores, gestión de perfumes y categorías, tendencias, pronóstico de demanda, inventario con punto de reorden, análisis ABC, simulador de precios y alertas.'],
    ], [3 * cm, 4.6 * cm, 9.8 * cm], zebra=True))
    s.append(Spacer(1, 6))
    s.append(P('<b>Fuera del alcance:</b> pagos en línea, envíos a domicilio y facturación. La compra se realiza en tienda y el '
               'asesor la registra en el sistema.'))

    # 5. DSS
    s += H1('5. ¿Por qué AromaMatch es un DSS?')
    s.append(P('Un sistema de soporte a la decisión es un sistema de información interactivo que ayuda a una persona a resolver '
               'problemas semiestructurados combinando datos y modelos, sin sustituir su juicio. AromaMatch cumple con cada '
               'característica que la teoría pide:'))
    s.append(tabla([
        ['Característica de un DSS', 'Cómo la cumple AromaMatch'],
        ['Apoya decisiones semiestructuradas', 'Elegir perfume, fijar precio o decidir un pedido combinan cálculo (coincidencia, demanda) y criterio humano (gusto, estrategia).'],
        ['Base de datos', 'Catálogo, preferencias, favoritos, historial de actividad, 48,342 eventos de uso y 3,997 ventas (SQLite).'],
        ['Base de modelos', 'Coincidencia ponderada, pronóstico estacional con tendencia vs media móvil, stock de seguridad y punto de reorden, ABC, simulación de precio y reglas de alerta.'],
        ['Subsistema de diálogo (interfaz)', 'Vistas por perfil, controles deslizantes, gráficas, tablas y la explicación de cada fórmula en pantalla.'],
        ['Análisis “¿qué pasaría si…?”', 'Pesos del buscador (cliente) y simulador de precios (administrador) con recálculo inmediato.'],
        ['El usuario conserva el control', 'El sistema sugiere; la persona decide. El precio simulado solo se aplica con el botón “Aplicar”; el pedido sugerido solo se registra si el administrador captura la entrada.'],
        ['Soporta varios niveles', 'Operativo (asesor), táctico (reorden, precio, surtido) y estratégico ligero (tendencias y pronóstico).'],
    ], [5.2 * cm, 12.2 * cm], zebra=True))
    s.append(Spacer(1, 6))
    s.append(P('<b>Clasificación.</b> Según la tipología de Power, AromaMatch es principalmente un DSS <b>orientado a modelos</b> '
               '(sus resultados dependen de modelos cuantitativos parametrizables) y <b>orientado a datos</b> (dashboard, tendencias, '
               'ABC). La parte del cliente funciona además como un DSS personal. Las funciones transaccionales (inicio de sesión, alta de '
               'productos, registro de ventas) no son el DSS en sí: son las que alimentan su base de datos.'))

    # 6. Arquitectura
    s.append(KeepTogether([Paragraph('6. Arquitectura y tecnologías', st['h1']), diagrama_arquitectura(),
                           Paragraph('Figura 1. Arquitectura por capas y componentes del DSS.', st['cap'])]))
    s.append(tabla([
        ['Capa', 'Tecnología', 'Motivo de la elección'],
        ['Interfaz', 'HTML, CSS y JavaScript sin frameworks', 'Sin compilación ni dependencias; cualquier navegador moderno. Diseño adaptable a móvil.'],
        ['Servidor', 'Node.js 22+ con Express', 'Un solo lenguaje (JavaScript) en cliente y servidor; API REST sencilla.'],
        ['Base de datos', 'SQLite (módulo node:sqlite integrado)', 'Sin instalar un gestor aparte; un archivo portable que se crea con datos de ejemplo al primer arranque.'],
        ['Seguridad', 'scrypt con sal, tokens aleatorios', 'Contraseñas nunca en texto plano; sesiones que expiran (1 o 30 días).'],
        ['Documentos', 'Python + ReportLab', 'Genera los PDF de Términos y Condiciones y este reporte.'],
    ], [3 * cm, 5.4 * cm, 9 * cm], zebra=True))

    # 7. Datos
    s.append(KeepTogether([Paragraph('7. Modelo de datos', st['h1']), diagrama_datos(),
                           Paragraph('Figura 2. Tablas principales y sus relaciones.', st['cap'])]))
    s.append(tabla([
        ['Tabla', 'Contenido', 'Registros'],
        ['usuarios', 'Clientes, asesores y administrador; rol, sucursal, fecha de aceptación de términos', '84'],
        ['perfumes', 'Ficha completa, precio, existencias y días de entrega del proveedor', '27'],
        ['categorias', 'Familias olfativas (6), ocasiones (5) y temporadas (4)', '15'],
        ['preferencias', 'Perfil del cliente y pesos personalizados del buscador', '67'],
        ['favoritos', 'Perfumes guardados y precio al momento de guardarlos (para alertas)', '4'],
        ['actividad', 'Historial visible: búsquedas, recomendaciones, comparaciones, compras', '88'],
        ['eventos', 'Uso agregado: consultas, búsquedas, recomendaciones y su aceptación', '48,342'],
        ['ventas', 'Ventas en tienda: cantidad, precio, cliente y asesor', '3,997'],
    ], [3 * cm, 11.4 * cm, 3 * cm], zebra=True))

    # 8. Modelos
    s += H1('8. Modelos de decisión')
    s.append(P('Todos los modelos son deliberadamente sencillos y explicables: el usuario puede ver la fórmula en pantalla y entender '
               'por qué el sistema propone algo. Esta es una propiedad importante en un DSS, porque la confianza del usuario depende '
               'de que pueda verificar el razonamiento.'))

    s += H2('8.1 Coincidencia ponderada (motor de recomendación)')
    s.append(P('Cada respuesta del cliente es un criterio con un peso. La coincidencia de un perfume es la suma de los pesos de los '
               'criterios que cumple, dividida entre la suma de los pesos de los criterios que el cliente eligió:'))
    s.append(formula(['coincidencia = Σ peso(criterio cumplido) ÷ Σ peso(criterio elegido) × 100',
                      'pesos predeterminados: familia 30 · ocasión 25 · temporada 20 · intensidad 15 · presupuesto 10',
                      'penalización: −20 puntos por cada nota que el cliente indicó evitar']))
    s.append(Spacer(1, 4))
    s.append(P('<b>Ejemplo.</b> Criterios: cita, otoño, oriental, intensa y presupuesto de $1,500 a $3,000. '
               'Spicebomb ($2,790) cumple los cinco: 100 %. Black Opium ($3,350) cumple todo menos el presupuesto: '
               '(25+20+30+15) ÷ 100 = 90 %. El modelo reproduce exactamente los porcentajes de las vistas de diseño originales '
               '(100 %, 70 %, 55 %, 35 %, 35 %).'))
    s.append(P('Los <b>perfumes similares</b> usan el mismo modelo tomando como criterios los atributos del perfume que se está viendo.'))

    s += H2('8.2 Análisis “¿qué pasaría si…?” sobre los pesos')
    s.append(P('El cliente puede mover un control deslizante por criterio (0 a 100). El ranking se recalcula al instante y cada '
               'resultado muestra cuántos lugares subió o bajó respecto a los pesos predeterminados (flechas arriba o abajo). Un peso en 0 elimina el '
               'criterio. Con los mismos criterios del ejemplo, subir el presupuesto a 100 y bajar la familia a 5 hace que '
               '<b>1 Million</b> y <b>Angel</b> suban tres lugares, porque sí caben en el presupuesto. El cliente puede guardar sus '
               'pesos; a partir de ahí toda la coincidencia del catálogo se calcula con ellos.'))

    s += H2('8.3 Pronóstico de demanda')
    s.append(P('Se pronostica el interés (consultas y búsquedas) por familia olfativa para los tres meses siguientes, usando los '
               '24 meses completos más recientes. Se comparan dos métodos:'))
    s.append(formula(['Estacional con tendencia:  F(t) = Y(t − 12) × factor',
                      '   factor = Σ últimos 3 meses ÷ Σ mismos 3 meses del año anterior',
                      'Media móvil (3):  F = promedio de los últimos 3 meses',
                      'MAPE = promedio( |real − pronóstico| ÷ real ) × 100   (prueba con los 3 meses más recientes)']))
    s.append(Spacer(1, 4))
    s.append(P('El sistema “esconde” los tres meses más recientes, los pronostica con ambos métodos, mide el error (MAPE) y usa el '
               'método que se equivocó menos. En los datos actuales el método estacional gana en las seis familias, lo que confirma '
               'que la demanda de perfume depende de la temporada:'))
    s.append(tabla([
        ['Familia', 'MAPE estacional', 'MAPE media móvil', 'Pronóstico sep · oct · nov', 'Cambio a noviembre vs agosto'],
        ['Oriental', '13.7 %', '34.7 %', '359 · 455 · 517', '+48 %'],
        ['Amaderado', '4.6 %', '29.0 %', '259 · 308 · 356', '+49 %'],
        ['Gourmand', '16.6 %', '30.5 %', '149 · 177 · 209', '+56 %'],
        ['Floral', '4.9 %', '26.1 %', '445 · 371 · 330', '−31 %'],
        ['Cítrico', '8.8 %', '24.2 %', '340 · 286 · 204', '−46 %'],
        ['Acuático', '14.8 %', '22.1 %', '67 · 68 · 49', '−46 %'],
    ], [3 * cm, 2.9 * cm, 3.1 * cm, 4.3 * cm, 4.1 * cm], zebra=True))
    s.append(Spacer(1, 4))
    s.append(P('El pronóstico se traduce a frases que el administrador entiende de inmediato, por ejemplo: <i>“En noviembre la '
               'búsqueda de Gourmand subirá un 56 % respecto a agosto.”</i>'))

    s += H2('8.4 Inventario: stock de seguridad y punto de reorden')
    s.append(formula(['demanda diaria = ventas de los últimos 30 días ÷ 30 × ajuste del pronóstico',
                      '   ajuste = pronóstico del próximo mes ÷ último mes real de su familia (entre 0.5 y 2)',
                      'stock de seguridad = 1.65 × desviación estándar diaria × √(días de entrega)   ← 95 % de servicio',
                      'punto de reorden = demanda diaria × días de entrega + stock de seguridad',
                      'pedido sugerido = demanda de 30 días + stock de seguridad − existencias']))
    s.append(Spacer(1, 4))
    s.append(P('<b>Ejemplo (Sauvage).</b> Vendió 13 unidades en 30 días (0.43 por día). Como se espera que la familia Amaderado '
               'suba en el próximo mes (ajuste ×1.29), la demanda diaria esperada es 0.56. Con 7 días de entrega y un stock de '
               'seguridad de 3 unidades, el punto de reorden es 7. Hay 3 unidades en existencia (cobertura de 5 días), así que el '
               'sistema lo marca como <b>“Reordenar”</b> y sugiere pedir <b>17 unidades</b>. Aquí se ve cómo el pronóstico alimenta '
               'directamente la decisión de compra.'))

    s += H2('8.5 Análisis ABC (Pareto)')
    s.append(P('Los perfumes se ordenan por ingresos de los últimos 12 meses ($7,551,540 en total) y se clasifican según el '
               'porcentaje acumulado: <b>A</b> hasta el 80 %, <b>B</b> hasta el 95 % y <b>C</b> el resto.'))
    s.append(tabla([
        ['Clase', 'Perfumes', '% de ingresos', 'Decisión sugerida'],
        ['A', '13', '81.3 %', 'Nunca deben agotarse; revisión semanal. Encabezan J\'adore, Baccarat Rouge 540 y Black Opium.'],
        ['B', '7', '14.4 %', 'Revisión quincenal; pedidos regulares.'],
        ['C', '7', '4.4 %', 'Pedidos pequeños; candidatos a promoción o a salir del catálogo.'],
    ], [2 * cm, 2.4 * cm, 2.8 * cm, 10.2 * cm], zebra=True))

    s += H2('8.6 Simulador de precios')
    s.append(P('Para un perfume y un precio nuevo, el sistema recalcula la coincidencia de ese perfume con los 67 clientes que tienen '
               'perfil guardado y compara el escenario actual con el simulado:'))
    s.append(tabla([
        ['Indicador (Sauvage: $3,290 → $2,900)', 'Antes', 'Después', 'Cambio'],
        ['Clientes que lo tienen dentro de su presupuesto', '16', '21', '+5'],
        ['Clientes con coincidencia ≥ 70 %', '14', '16', '+2'],
        ['Clientes que lo tienen en su top 3 de recomendaciones', '15', '19', '+5 entran / −1 sale'],
        ['Ingresos a 90 días con las mismas 25 unidades', '$82,250', '$72,500', '−$9,750'],
        ['Ingresos a 90 días ajustando la demanda (25 → 32 u.)', '$82,250', '$92,800', '+$10,550'],
    ], [8.4 * cm, 2.6 * cm, 2.6 * cm, 3.8 * cm], zebra=True))
    s.append(Spacer(1, 4))
    s.append(P('El resultado no dice “baja el precio”: muestra que la decisión depende de si la rebaja atrae a más clientes. Si las '
               'ventas no cambian, se pierden $9,750; si la demanda crece en proporción a los clientes que ahora lo tienen en su top '
               '3, se ganan $10,550. El supuesto se muestra en pantalla y la decisión la toma el administrador.'))

    s += H2('8.7 Alertas por excepción')
    s.append(P('En lugar de esperar a que el usuario consulte un reporte, el sistema evalúa reglas y avisa cuando algo requiere una '
               'decisión (campana con contador, panel en el dashboard y en “Mi perfil”).'))
    s.append(tabla([
        ['Alerta', 'Regla', 'Nivel', 'Ejemplo actual'],
        ['Agotado', 'existencias = 0', 'Urgente', 'Daisy agotado; pedir 8 unidades'],
        ['Punto de reorden', 'existencias ≤ punto de reorden', 'Atención', 'Sauvage, Black Opium, J\'adore y Baccarat Rouge 540'],
        ['Caída de demanda', 'últimos 3 meses vs mismos 3 meses del año anterior ≤ −15 %', 'Atención', 'Acuático cayó 25 %'],
        ['Alza pronosticada', 'pronóstico del próximo mes ≥ +20 % vs último mes', 'Atención / aviso', 'Oriental subirá 30 % en octubre'],
        ['Hueco de surtido', '≥ 3 clientes con una familia y presupuesto, y ≤ 1 perfume que les quede', 'Oportunidad', '7 clientes Amaderado de hasta $1,500 sin opciones'],
        ['Baja de precio (cliente)', 'precio actual < precio al guardarlo en favoritos', 'Urgente', 'La Vie Est Belle: $3,650 → $3,450'],
        ['Favorito agotado (cliente)', 'favorito con existencias = 0', 'Aviso', '—'],
    ], [3.1 * cm, 6.3 * cm, 2.4 * cm, 5.6 * cm], zebra=True))
    s.append(Spacer(1, 4))
    s.append(P('La caída de demanda se compara contra el mismo trimestre del año anterior y no contra el trimestre inmediato. '
               'Así se evita una alerta falsa: sin esta corrección, el sistema reportaba que “Oriental cayó 35 %” en verano, cuando '
               'solo era el efecto de la temporada.', 'small'))

    # 9. Recorrido
    s.append(PageBreak())
    s += H1('9. Recorrido por el sistema')
    s += captura('01-login', 'Figura 3. Inicio de sesión con selección del tipo de usuario. El registro de clientes exige aceptar los Términos y Condiciones.', titulo='9.1 Acceso')
    s += captura('02-catalogo', 'Figura 4. Catálogo con filtros por presupuesto, ocasión, temporada, intensidad y público. Cada tarjeta indica la coincidencia con el perfil del cliente.', titulo='9.2 Cliente')
    s += captura('03-detalle', 'Figura 5. Detalle del perfume: pirámide olfativa, atributos, coincidencia explicada con sus razones y perfumes similares.')
    s += captura('04-buscador', 'Figura 6. Buscador inteligente con análisis “¿qué pasaría si…?”: al cambiar los pesos, las flechas muestran cuántos lugares se movió cada perfume.')
    s += captura('05-comparador', 'Figura 7. Comparador de hasta tres perfumes, con la mejor opción para el cliente resaltada.')
    s += captura('06-perfil', 'Figura 8. Mi perfil: aviso de baja de precio, favoritos, perfil olfativo, preferencias e historial de actividad.')
    s += captura('07-asesor-atencion', 'Figura 9. Atención a cliente: ficha, preferencias registradas, recomendaciones según el perfil e historial de atención.', titulo='9.3 Asesor de ventas')
    s += captura('08-asesor-detalle', 'Figura 10. Detalle para el asesor: existencias y botón para registrar la venta, que descuenta el inventario.')
    s += captura('09-dashboard', 'Figura 11. Dashboard: alertas que requieren decisión e indicadores del periodo comparados con el periodo anterior.', titulo='9.4 Administrador')
    s += captura('10-dashboard-graficas', 'Figura 12. Consultas por familia, tendencia por temporada, ocasiones más buscadas y perfumes más recomendados.')
    s += captura('15-pronostico-oriental', 'Figura 13. Pronóstico de Oriental: histórico de 24 meses, pronóstico del método elegido (línea discontinua) y método alternativo (punteada).')
    s += captura('16-inventario', 'Figura 14. Inventario: demanda ajustada por pronóstico, stock de seguridad, punto de reorden, cobertura y pedido sugerido.')
    s += captura('17-abc', 'Figura 15. Análisis ABC con diagrama de Pareto por ingresos de 12 meses.')
    s += captura('18-simulador', 'Figura 16. Simulador de precios: impacto en clientes e ingresos antes de aplicar un precio.')
    s += captura('11-gestion-perfumes', 'Figura 17. Gestión de perfumes: alta, edición (con foto, año y perfumista) y baja.')
    s += captura('13-tendencias', 'Figura 18. Tendencias de interés por familia, crecimiento trimestral, intensidad y rango de precio preferidos.')

    # 10. Seguridad
    s += H1('10. Seguridad y privacidad')
    s += lista([
        '<b>Contraseñas</b> almacenadas con scrypt y sal aleatoria; nunca en texto plano.',
        '<b>Sesiones</b> con token aleatorio de 48 caracteres y fecha de expiración; se limpian las vencidas al iniciar.',
        '<b>Control de acceso por rol</b> en cada ruta del servidor: por ejemplo, un cliente que intenta registrar una venta recibe “403 Sin permiso”.',
        '<b>Validación en el servidor</b> de todos los datos (correo, contraseñas, precios, existencias, imágenes PNG/JPG de máximo 2 MB).',
        '<b>Aviso de privacidad y derechos ARCO:</b> el cliente acepta los Términos y Condiciones al registrarse (se guarda la fecha), puede editar sus datos y eliminar su cuenta; los datos de uso quedan anónimos.',
        '<b>Estadísticas agregadas:</b> el reporte exportable del dashboard no contiene datos personales.',
    ])

    # 11. Pruebas
    s += H1('11. Pruebas realizadas')
    s.append(P('Se realizaron pruebas funcionales sobre la API y sobre la interfaz en el navegador. Casos principales:'))
    s.append(tabla([
        ['Caso de prueba', 'Resultado esperado', 'Resultado'],
        ['Buscador con los criterios de las vistas de diseño', '100 / 70 / 55 / 35 / 35 %', 'Correcto'],
        ['Mismos criterios con pesos distintos', 'Cambia el porcentaje (75 %, 10 %, 100 %)', 'Correcto'],
        ['Inicio de sesión con un rol que no corresponde', 'Rechazado con mensaje claro', 'Correcto'],
        ['Registro sin aceptar los Términos y Condiciones', 'Rechazado', 'Correcto'],
        ['Venta mayor a las existencias', 'Rechazada: “Solo hay 2 unidades”', 'Correcto'],
        ['Cliente intenta registrar una venta', 'HTTP 403 (sin permiso)', 'Correcto'],
        ['Venta del asesor asociada a un cliente', 'Descuenta inventario y aparece en el historial del cliente', 'Correcto'],
        ['Entrada de inventario a un perfume agotado', 'Desaparece la alerta de agotado', 'Correcto'],
        ['Descartar alerta de baja de precio', 'La alerta deja de mostrarse', 'Correcto'],
        ['Guardar pesos personalizados y volver al buscador', 'El buscador usa los pesos guardados', 'Correcto'],
        ['Editar un perfume sin cambiar su foto', 'Se conserva la foto y su crédito', 'Correcto'],
        ['Selección del método de pronóstico', 'Se elige el de menor MAPE (estacional en las 6 familias)', 'Correcto'],
        ['Vista en pantalla de celular', 'Sin desplazamiento horizontal; menú y alertas visibles', 'Correcto'],
    ], [6.4 * cm, 7.6 * cm, 3.4 * cm], zebra=True))

    # 12. Datos
    s += H1('12. Origen de los datos')
    s += lista([
        '<b>Perfumes:</b> 27 perfumes reales. Notas olfativas, año de lanzamiento y perfumista verificados con las fichas de Fragrantica.',
        '<b>Precios:</b> referencia aproximada de tiendas departamentales en México (MXN, IVA incluido); pueden variar.',
        '<b>Fotografías:</b> 7 de Wikimedia Commons con licencia Creative Commons y autor citado; 20 fotos de producto de las marcas vía Fragrantica, usadas solo con fines académicos. El crédito se muestra en el detalle de cada perfume.',
        '<b>Uso, clientes y ventas:</b> datos simulados de forma reproducible (24 meses, 81 clientes) con estacionalidad por familia, crecimiento anual del 12 %, una caída real del interés por los perfumes acuáticos y popularidad mayor para los superventas reales. Se etiquetan como “Datos de ejemplo”.',
    ])

    # 13. Limitaciones
    s += H1('13. Limitaciones y trabajo futuro')
    s.append(tabla([
        ['Limitación actual', 'Mejora propuesta'],
        ['Los datos de uso y ventas son simulados', 'Conectar el punto de venta real; los modelos no requieren cambios.'],
        ['El pronóstico usa dos métodos simples con 24 meses de historia', 'Agregar suavizamiento exponencial (Holt-Winters) cuando haya 3 años o más de datos.'],
        ['El simulador supone que la demanda sigue al número de clientes con el perfume en su top 3', 'Estimar la elasticidad-precio real con el historial de cambios de precio.'],
        ['Las recomendaciones no aprenden de la retroalimentación', 'Calificación “me gusta / no me gusta” y filtrado colaborativo (“clientes como tú eligieron…”).'],
        ['La recuperación de contraseña no envía correo', 'Integrar un servicio de correo con enlace temporal.'],
        ['SQLite en un solo servidor', 'Migrar a PostgreSQL si se usan varias sucursales en línea al mismo tiempo.'],
        ['Pruebas manuales', 'Pruebas automatizadas del motor y de la API.'],
    ], [7.5 * cm, 9.9 * cm], zebra=True))

    # 14. Conclusiones
    s += H1('14. Conclusiones')
    s.append(P('AromaMatch demuestra que un DSS no necesita modelos complejos para ser útil: basta con datos organizados, modelos '
               'explicables y una interfaz que ponga el resultado frente a la persona que decide, en el momento en que decide. El '
               'cliente entiende por qué un perfume le conviene y puede ajustar qué le importa; el asesor llega a la atención con el '
               'perfil y las sugerencias listas; y el administrador pasa de revisar reportes a recibir alertas con una acción concreta '
               '(“pedir 17 unidades de Sauvage”, “Acuático cayó 25 %”, “7 clientes sin opciones en su presupuesto”).'))
    s.append(P('Los modelos están conectados entre sí: el pronóstico ajusta la demanda del inventario, el inventario genera alertas, '
               'las ventas del asesor alimentan el ABC y cierran el ciclo de aceptación de recomendaciones, y el simulador usa el '
               'mismo motor de coincidencia que ven los clientes. Esa integración, junto con el análisis “¿qué pasaría si…?” y el '
               'control final del usuario, es lo que convierte a AromaMatch en un sistema de soporte a la decisión y no solo en un '
               'catálogo en línea.'))

    # Anexos
    s.append(PageBreak())
    s += H1('Anexo A. Instalación y cuentas de demostración')
    s.append(formula(['npm install          # instala Express', 'npm start            # http://localhost:3000',
                      'npm run reset-db     # vuelve a los datos de ejemplo', 'node scripts/capturas.js   # capturas para documentación']))
    s.append(Spacer(1, 6))
    s.append(tabla([
        ['Perfil', 'Correo', 'Contraseña'],
        ['Cliente', 'mariana.lopez@correo.com', 'cliente123'],
        ['Asesor de ventas', 'jorge.ramirez@aromamatch.mx', 'asesor123'],
        ['Administrador', 'admin@aromamatch.mx', 'admin123'],
    ], [4 * cm, 8 * cm, 5.4 * cm]))
    s += H1('Anexo B. Estructura del código')
    s.append(tabla([
        ['Archivo', 'Responsabilidad'],
        ['server.js', 'API REST: autenticación, catálogo, buscador, perfil, asesor, administración, alertas, ventas e inventario'],
        ['db.js', 'Esquema SQLite y generación de datos de ejemplo'],
        ['recomendador.js', 'Motor de coincidencia ponderada con pesos configurables'],
        ['analisis.js', 'Pronóstico, inventario, ABC, simulador de precios y reglas de alerta'],
        ['seed/perfumes.js, seed/imagenes.json', 'Catálogo real y créditos de fotografías'],
        ['public/js/*.js', 'Interfaz: núcleo, cliente, asesor, administrador y vistas de análisis'],
        ['scripts/*.py, scripts/capturas.js', 'Generación de PDF (términos y reporte) y capturas de pantalla'],
    ], [5.5 * cm, 11.9 * cm], zebra=True))
    s += H1('Anexo C. Principales rutas de la API')
    s.append(tabla([
        ['Método y ruta', 'Rol', 'Descripción'],
        ['POST /api/auth/login · /registro', 'Público', 'Inicio de sesión por rol · alta de cliente con aceptación de términos'],
        ['GET /api/perfumes · /perfumes/:id', 'Todos', 'Catálogo filtrado con coincidencia · detalle con similares'],
        ['POST /api/buscador', 'Cliente, asesor', 'Ranking por coincidencia con pesos (what-if)'],
        ['PUT /api/preferencias', 'Cliente', 'Guarda preferencias y pesos'],
        ['GET /api/alertas', 'Cliente, admin', 'Alertas por excepción según el rol'],
        ['POST /api/ventas', 'Asesor', 'Registra una venta y descuenta existencias'],
        ['GET /api/clientes/:id', 'Asesor', 'Ficha del cliente con recomendaciones'],
        ['GET /api/admin/pronostico', 'Admin', 'Pronóstico por familia con MAPE'],
        ['GET /api/admin/inventario', 'Admin', 'Punto de reorden, pedido sugerido y ABC'],
        ['POST /api/admin/simular', 'Admin', 'Simulación de precio'],
        ['GET /api/admin/dashboard · /reporte.csv', 'Admin', 'Indicadores del periodo · exportación'],
    ], [6.2 * cm, 2.8 * cm, 8.4 * cm], zebra=True))
    return s


def main():
    doc = Doc(SALIDA, pagesize=LETTER, leftMargin=2.1 * cm, rightMargin=2.1 * cm, topMargin=2.1 * cm, bottomMargin=2.1 * cm,
              title='Reporte técnico — AromaMatch', author='[Equipo del proyecto]', subject='Sistema de Soporte a la Decisión')
    w, h = LETTER
    doc.addPageTemplates([
        PageTemplate(id='Portada', frames=[Frame(0, 0, w, h, id='p')], onPage=portada, autoNextPageTemplate='Interior'),
        PageTemplate(id='Interior', frames=[Frame(2.1 * cm, 2.1 * cm, w - 4.2 * cm, h - 4.2 * cm, id='n')], onPage=interior),
    ])
    doc.multiBuild(contenido())
    print('PDF generado:', SALIDA)


if __name__ == '__main__':
    main()
