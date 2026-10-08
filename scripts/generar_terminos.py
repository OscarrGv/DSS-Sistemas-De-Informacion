"""Genera docs/Terminos_y_Condiciones_AromaMatch.pdf

Uso:  python scripts/generar_terminos.py
Requiere: pip install reportlab
"""
import os
from datetime import date

from reportlab.lib import colors
from reportlab.lib.enums import TA_JUSTIFY, TA_CENTER
from reportlab.lib.pagesizes import LETTER
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.units import cm
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import (BaseDocTemplate, Frame, PageTemplate, Paragraph, Spacer, Table,
                                TableStyle, KeepTogether, PageBreak)

BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SALIDA = os.path.join(BASE, 'docs', 'Terminos_y_Condiciones_AromaMatch.pdf')

PLUM = colors.HexColor('#4A1F3F')
PLUM_SOFT = colors.HexColor('#EFE2EC')
CREAM = colors.HexColor('#F4EFE9')
AMBER = colors.HexColor('#A0561F')
TEXT = colors.HexColor('#231A20')
MUTED = colors.HexColor('#776B72')
LINE = colors.HexColor('#E7DED5')

VIGENCIA = '26 de septiembre de 2026'


# ---------- tipografías (Georgia/Calibri en Windows; si no existen, las estándar) ----------
def registrar_fuentes():
    fuentes = os.path.join(os.environ.get('WINDIR', r'C:\Windows'), 'Fonts')
    try:
        pdfmetrics.registerFont(TTFont('Serif', os.path.join(fuentes, 'georgia.ttf')))
        pdfmetrics.registerFont(TTFont('Serif-Bold', os.path.join(fuentes, 'georgiab.ttf')))
        pdfmetrics.registerFont(TTFont('Serif-Italic', os.path.join(fuentes, 'georgiai.ttf')))
        pdfmetrics.registerFont(TTFont('Sans', os.path.join(fuentes, 'calibri.ttf')))
        pdfmetrics.registerFont(TTFont('Sans-Bold', os.path.join(fuentes, 'calibrib.ttf')))
        pdfmetrics.registerFont(TTFont('Sans-Italic', os.path.join(fuentes, 'calibrii.ttf')))
        pdfmetrics.registerFontFamily('Sans', normal='Sans', bold='Sans-Bold', italic='Sans-Italic', boldItalic='Sans-Bold')
        pdfmetrics.registerFontFamily('Serif', normal='Serif', bold='Serif-Bold', italic='Serif-Italic', boldItalic='Serif-Bold')
        return 'Serif', 'Sans', 'Serif-Italic'
    except Exception:
        return 'Times-Roman', 'Helvetica', 'Times-Italic'


SERIF, SANS, SERIF_I = registrar_fuentes()

st_titulo = ParagraphStyle('titulo', fontName=SERIF, fontSize=26, leading=31, textColor=TEXT, spaceAfter=6)
st_sub = ParagraphStyle('sub', fontName=SANS, fontSize=11, leading=15, textColor=MUTED)
st_h1 = ParagraphStyle('h1', fontName=SERIF, fontSize=15, leading=19, textColor=PLUM, spaceBefore=16, spaceAfter=6)
st_h2 = ParagraphStyle('h2', fontName=SANS + '-Bold' if SANS == 'Sans' else 'Helvetica-Bold', fontSize=10.5,
                       leading=14, textColor=AMBER, spaceBefore=8, spaceAfter=3)
st_p = ParagraphStyle('p', fontName=SANS, fontSize=10.5, leading=15, textColor=TEXT, alignment=TA_JUSTIFY, spaceAfter=6)
st_li = ParagraphStyle('li', parent=st_p, leftIndent=14, bulletIndent=3, spaceAfter=3)
st_small = ParagraphStyle('small', fontName=SANS, fontSize=9, leading=12.5, textColor=MUTED, alignment=TA_JUSTIFY)
st_cell = ParagraphStyle('cell', fontName=SANS, fontSize=9.5, leading=13, textColor=TEXT)
st_cell_b = ParagraphStyle('cellb', parent=st_cell, fontName=st_h2.fontName)
st_quote = ParagraphStyle('quote', fontName=SERIF_I, fontSize=12, leading=16, textColor=PLUM, alignment=TA_CENTER)


def P(t):
    return Paragraph(t, st_p)


def H1(t):
    return Paragraph(t, st_h1)


def H2(t):
    return Paragraph(t, st_h2)


def lista(items):
    return [Paragraph(i, st_li, bulletText='•') for i in items]


def tabla(filas, anchos, cabecera=True):
    datos = [[Paragraph(c, st_cell_b if (cabecera and r == 0) else st_cell) for c in fila] for r, fila in enumerate(filas)]
    t = Table(datos, colWidths=anchos, repeatRows=1 if cabecera else 0)
    estilo = [
        ('GRID', (0, 0), (-1, -1), 0.6, LINE),
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
        ('LEFTPADDING', (0, 0), (-1, -1), 7), ('RIGHTPADDING', (0, 0), (-1, -1), 7),
        ('TOPPADDING', (0, 0), (-1, -1), 5), ('BOTTOMPADDING', (0, 0), (-1, -1), 5),
    ]
    if cabecera:
        estilo.append(('BACKGROUND', (0, 0), (-1, 0), PLUM_SOFT))
    t.setStyle(TableStyle(estilo))
    return t


def caja(contenido, fondo=CREAM, borde=None):
    t = Table([[contenido]], colWidths=[17 * cm])
    estilo = [('BACKGROUND', (0, 0), (-1, -1), fondo), ('LEFTPADDING', (0, 0), (-1, -1), 12),
              ('RIGHTPADDING', (0, 0), (-1, -1), 12), ('TOPPADDING', (0, 0), (-1, -1), 10),
              ('BOTTOMPADDING', (0, 0), (-1, -1), 10)]
    if borde:
        estilo.append(('LINEBEFORE', (0, 0), (0, -1), 3, borde))
    t.setStyle(TableStyle(estilo))
    return t


# ---------- encabezado y pie de página ----------
def portada(canvas, doc):
    w, h = LETTER
    canvas.saveState()
    canvas.setFillColor(PLUM)
    canvas.rect(0, h - 5.2 * cm, w, 5.2 * cm, stroke=0, fill=1)
    # Frasco
    x, y = 2 * cm, h - 3.35 * cm
    canvas.setStrokeColor(colors.white)
    canvas.setLineWidth(1.4)
    canvas.roundRect(x + 0.2 * cm, y + 1.05 * cm, 0.5 * cm, 0.3 * cm, 2, stroke=1, fill=0)
    canvas.roundRect(x, y, 0.9 * cm, 1.05 * cm, 5, stroke=1, fill=0)
    canvas.setFillColor(colors.white)
    canvas.setFont(SERIF, 24)
    canvas.drawString(x + 1.3 * cm, y + 0.25 * cm, 'AromaMatch')
    canvas.setFont(SANS, 9)
    canvas.setFillColor(colors.HexColor('#E6C595'))
    canvas.drawString(x + 1.32 * cm, y - 0.45 * cm, 'SISTEMA DE SOPORTE A LA DECISIÓN')
    canvas.setFillColor(colors.HexColor('#EADCE4'))
    canvas.setFont(SERIF_I, 11)
    canvas.drawRightString(w - 2 * cm, y + 0.25 * cm, '“Más que perfumes, mejores decisiones”')
    canvas.restoreState()
    pie(canvas, doc)


def interior(canvas, doc):
    w, h = LETTER
    canvas.saveState()
    canvas.setFillColor(PLUM)
    canvas.rect(0, h - 0.35 * cm, w, 0.35 * cm, stroke=0, fill=1)
    canvas.setFont(SERIF, 10)
    canvas.setFillColor(PLUM)
    canvas.drawString(2 * cm, h - 1.25 * cm, 'AromaMatch')
    canvas.setFont(SANS, 8.5)
    canvas.setFillColor(MUTED)
    canvas.drawRightString(w - 2 * cm, h - 1.25 * cm, 'Términos y Condiciones de Uso y Aviso de Privacidad')
    canvas.setStrokeColor(LINE)
    canvas.line(2 * cm, h - 1.5 * cm, w - 2 * cm, h - 1.5 * cm)
    canvas.restoreState()
    pie(canvas, doc)


def pie(canvas, doc):
    w, _ = LETTER
    canvas.saveState()
    canvas.setStrokeColor(LINE)
    canvas.line(2 * cm, 1.6 * cm, w - 2 * cm, 1.6 * cm)
    canvas.setFont(SANS, 8.5)
    canvas.setFillColor(MUTED)
    canvas.drawString(2 * cm, 1.1 * cm, f'Versión 1.0 · Vigente desde el {VIGENCIA}')
    canvas.drawRightString(w - 2 * cm, 1.1 * cm, f'Página {doc.page}')
    canvas.restoreState()


# ---------- contenido ----------
def contenido():
    s = []
    s.append(Spacer(1, 0.2 * cm))
    s.append(Paragraph('Términos y Condiciones de Uso', st_titulo))
    s.append(Paragraph('y Aviso de Privacidad Integral de la plataforma AromaMatch', st_sub))
    s.append(Spacer(1, 0.35 * cm))
    s.append(caja(Paragraph(
        f'<b>Fecha de entrada en vigor:</b> {VIGENCIA}.<br/>'
        'Lee este documento con atención. Al crear una cuenta, marcar la casilla de aceptación o utilizar '
        'la plataforma, confirmas que lo has leído, que lo entiendes y que aceptas quedar vinculado por él. '
        'Si no estás de acuerdo, no utilices AromaMatch.', st_p), borde=PLUM))

    s.append(Spacer(1, 0.2 * cm))
    s.append(H2('Contenido'))
    indice = ['1. Identificación del responsable', '2. Definiciones', '3. Aceptación de los términos',
              '4. Descripción del servicio', '5. Registro y cuentas de usuario', '6. Uso aceptable',
              '7. Naturaleza de las recomendaciones', '8. Catálogo, precios y disponibilidad',
              '9. Obligaciones del personal (asesores y administradores)', '10. Propiedad intelectual',
              '11. Aviso de Privacidad Integral', '12. Salud, alergias y uso de fragancias',
              '13. Limitación de responsabilidad', '14. Disponibilidad y cambios del servicio',
              '15. Suspensión y cancelación de cuentas', '16. Modificaciones a estos términos',
              '17. Legislación aplicable y jurisdicción', '18. Contacto']
    mitad = (len(indice) + 1) // 2
    t = Table([[Paragraph('<br/>'.join(indice[:mitad]), st_cell), Paragraph('<br/>'.join(indice[mitad:]), st_cell)]],
              colWidths=[8.5 * cm, 8.5 * cm])
    t.setStyle(TableStyle([('VALIGN', (0, 0), (-1, -1), 'TOP'), ('LEFTPADDING', (0, 0), (-1, -1), 0)]))
    s.append(t)

    # 1
    s.append(H1('1. Identificación del responsable'))
    s.append(P('AromaMatch (en adelante, <b>“AromaMatch”</b>, <b>“la Perfumería”</b> o <b>“nosotros”</b>) es una plataforma '
               'digital de soporte a la decisión para la selección de perfumes, operada por la perfumería AromaMatch, '
               'con sucursales en Veracruz, México (Sucursal Centro y Sucursal Norte). Para cualquier asunto relacionado '
               'con estos términos o con tus datos personales, puedes escribir a '
               '<b>contacto@aromamatch.mx</b> o a <b>privacidad@aromamatch.mx</b>.'))

    # 2
    s.append(H1('2. Definiciones'))
    s.append(tabla([
        ['Término', 'Significado'],
        ['Plataforma', 'El sistema web AromaMatch, incluidos el catálogo, el buscador inteligente, el comparador, '
                       'el perfil de cliente y los módulos de asesor y administración.'],
        ['Usuario', 'Toda persona que accede a la Plataforma, en cualquiera de sus tres perfiles.'],
        ['Cliente', 'Usuario registrado que busca, compara y guarda perfumes y recibe recomendaciones.'],
        ['Asesor de ventas', 'Personal de la Perfumería que atiende a clientes en tienda, consulta su perfil, '
                             'registra preferencias y emite recomendaciones.'],
        ['Administrador', 'Personal autorizado para gestionar el catálogo, las categorías y consultar estadísticas.'],
        ['Perfil olfativo', 'Conjunto de preferencias del Cliente (familia olfativa, ocasión, temporada, intensidad, '
                            'presupuesto y notas que evita) y su afinidad calculada.'],
        ['Coincidencia', 'Porcentaje orientativo que indica qué tanto se ajusta un perfume a los criterios elegidos.'],
    ], [4 * cm, 13 * cm]))

    # 3
    s.append(H1('3. Aceptación de los términos'))
    s.append(P('Estos Términos y Condiciones constituyen un acuerdo entre el Usuario y AromaMatch. Para crear una '
               'cuenta de Cliente es obligatorio marcar la casilla <i>“He leído y acepto los Términos y Condiciones y el '
               'Aviso de Privacidad”</i>; la Plataforma registra la fecha y hora de dicha aceptación. El uso de la '
               'Plataforma por parte de menores de 18 años requiere el consentimiento y la supervisión de su padre, '
               'madre o tutor, quien será responsable de su uso.'))

    # 4
    s.append(H1('4. Descripción del servicio'))
    s.append(P('AromaMatch es un <b>sistema de soporte a la decisión</b> que ayuda a encontrar perfumes adecuados según '
               'las preferencias, la ocasión, la temporada y el presupuesto de cada persona. Sus funciones principales son:'))
    s += lista([
        '<b>Catálogo:</b> información detallada de cada perfume (marca, concentración, contenido, precio, notas de salida, '
        'corazón y fondo, intensidad, duración y proyección), con filtros por presupuesto, ocasión, temporada, intensidad y público.',
        '<b>Buscador inteligente:</b> cuestionario de cinco preguntas que calcula la coincidencia de cada perfume con el Cliente.',
        '<b>Comparador:</b> comparación lado a lado de hasta tres perfumes.',
        '<b>Mi perfil:</b> favoritos, preferencias, perfil olfativo e historial de actividad.',
        '<b>Módulo de asesor:</b> consulta de clientes, registro de preferencias en tienda y emisión de recomendaciones.',
        '<b>Módulo de administración:</b> alta, edición y baja de perfumes y categorías; tablero de estadísticas, '
        'tendencias y exportación de reportes.',
    ])
    s.append(P('La Plataforma <b>no realiza ventas ni cobros en línea</b>. La compra de productos se efectúa en las '
               'sucursales físicas, conforme a las políticas vigentes en tienda.'))

    # 5
    s.append(H1('5. Registro y cuentas de usuario'))
    s += lista([
        'Para registrarte como Cliente debes proporcionar tu nombre completo, un correo electrónico válido y una '
        'contraseña de al menos ocho caracteres. El teléfono es opcional.',
        'Te comprometes a proporcionar información veraz, exacta y actualizada, y a mantenerla así desde <i>Mi perfil</i>.',
        'Eres responsable de la confidencialidad de tu contraseña y de toda actividad realizada con tu cuenta. '
        'Notifícanos de inmediato cualquier uso no autorizado.',
        'Las cuentas de Asesor de ventas y de Administrador son creadas exclusivamente por la Perfumería y son personales '
        'e intransferibles. Al iniciar sesión, el Usuario debe elegir el tipo de acceso que corresponde a su cuenta; '
        'la Plataforma rechaza accesos con un perfil distinto al asignado.',
        'La opción “Recordarme” mantiene la sesión abierta hasta 30 días en el dispositivo. No la uses en equipos compartidos.',
    ])

    # 6
    s.append(H1('6. Uso aceptable'))
    s.append(P('Al utilizar la Plataforma te obligas a no:'))
    s += lista([
        'Suplantar la identidad de otra persona o registrar cuentas con datos falsos o de terceros sin autorización.',
        'Intentar acceder a cuentas, módulos o información a los que no tengas permiso, o eludir los controles de acceso por perfil.',
        'Introducir código malicioso, realizar ataques de denegación de servicio o extraer información de forma masiva y automatizada.',
        'Utilizar la información de otros clientes para fines distintos a la atención dentro de la Perfumería.',
        'Usar la Plataforma con fines ilícitos o contrarios a la moral, al orden público o a estos términos.',
    ])

    # 7
    s.append(H1('7. Naturaleza de las recomendaciones'))
    s.append(P('Las recomendaciones y los porcentajes de coincidencia son <b>orientativos</b>. El olfato es subjetivo y la '
               'percepción de un perfume varía según la química de la piel, el clima y el tiempo de uso; por ello, '
               'AromaMatch <b>no garantiza</b> que un perfume recomendado sea del agrado del Cliente. Recomendamos '
               'siempre probar la fragancia en piel antes de comprar.'))
    s.append(P('Para que el método sea transparente, la coincidencia se calcula como la suma de los pesos de los '
               'criterios que el perfume cumple, dividida entre la suma de los pesos de los criterios elegidos:'))
    s.append(tabla([
        ['Criterio', 'Peso'],
        ['Familia olfativa', '30 %'], ['Ocasión', '25 %'], ['Temporada', '20 %'], ['Intensidad', '15 %'], ['Presupuesto', '10 %'],
    ], [8 * cm, 3 * cm]))
    s.append(Spacer(1, 4))
    s.append(P('En la coincidencia con el perfil guardado, se restan 20 puntos por cada nota que el Cliente indicó evitar. '
               'Las recomendaciones que emite un Asesor de ventas se basan en este cálculo y en su criterio profesional.'))

    # 8
    s.append(H1('8. Catálogo, precios y disponibilidad'))
    s += lista([
        'Los precios se expresan en pesos mexicanos (MXN) e incluyen el Impuesto al Valor Agregado (IVA), salvo indicación en contrario.',
        'Los precios, promociones y existencias pueden cambiar sin previo aviso. El precio aplicable es el vigente en '
        'tienda al momento de la compra; ante una diferencia, se respetará el precio exhibido conforme a la Ley Federal '
        'de Protección al Consumidor.',
        'Las imágenes de los productos son ilustrativas y pueden no coincidir con la presentación exacta a la venta. '
        'Las fotografías de producto pertenecen a sus respectivas marcas y se muestran solo para identificar el '
        'artículo; las tomadas de Wikimedia Commons se usan conforme a su licencia Creative Commons e indican '
        'su autor. Los frascos dibujados no representan el envase real.',
        'Las etiquetas “Disponible en tienda” o “Bajo pedido” son informativas y no constituyen apartado del producto.',
        'Los productos en estado “Borrador” no son visibles para clientes ni asesores.',
    ])

    # 9
    s.append(H1('9. Obligaciones del personal (asesores y administradores)'))
    s.append(P('Los Asesores de ventas y Administradores tienen acceso a datos personales de clientes únicamente para '
               'cumplir las finalidades descritas en el Aviso de Privacidad. Se obligan a:'))
    s += lista([
        'Guardar confidencialidad sobre la información de los clientes, aun después de terminada su relación con la Perfumería.',
        'Consultar y modificar el perfil de un cliente solo durante su atención y registrar de forma veraz las preferencias y recomendaciones.',
        'No exportar, copiar ni compartir datos personales fuera de la Plataforma. Los reportes del tablero administrativo '
        'contienen solo información estadística agregada.',
        'Cerrar sesión al terminar su jornada y no compartir sus credenciales.',
    ])

    # 10
    s.append(H1('10. Propiedad intelectual'))
    s.append(P('El software, el diseño, los textos, los logotipos, el nombre “AromaMatch”, el método de recomendación y '
               'demás contenidos de la Plataforma son propiedad de la Perfumería o de sus licenciantes y están protegidos '
               'por la Ley Federal del Derecho de Autor y la Ley Federal de Protección a la Propiedad Industrial. Las '
               'marcas de perfumes que aparecen en el catálogo pertenecen a sus respectivos titulares. Queda prohibida su '
               'reproducción, distribución o modificación sin autorización previa y por escrito.'))

    # 11
    s.append(PageBreak())
    s.append(H1('11. Aviso de Privacidad Integral'))
    s.append(P('En cumplimiento de la Ley Federal de Protección de Datos Personales en Posesión de los Particulares y su '
               'normativa aplicable, AromaMatch, como <b>responsable</b> del tratamiento, informa lo siguiente:'))

    s.append(H2('11.1 Datos personales que recabamos'))
    s.append(tabla([
        ['Categoría', 'Datos', 'Cómo se obtienen'],
        ['Identificación y contacto', 'Nombre completo, correo electrónico, teléfono (opcional).', 'Registro del Cliente o captura del Asesor.'],
        ['Autenticación', 'Contraseña (almacenada solo como huella cifrada), sesiones activas.', 'Registro e inicio de sesión.'],
        ['Preferencias', 'Familia olfativa, ocasiones, temporada, intensidad, presupuesto habitual, notas que evita y '
                         'notas del asesor.', 'Buscador inteligente, Mi perfil y atención en tienda.'],
        ['Uso de la Plataforma', 'Búsquedas, consultas de perfumes, favoritos, comparaciones, recomendaciones y su aceptación, '
                                 'con fecha y hora.', 'Automáticamente al usar la Plataforma.'],
        ['Constancia legal', 'Fecha y hora de aceptación de estos términos.', 'Registro del Cliente.'],
    ], [3.6 * cm, 8 * cm, 5.4 * cm]))
    s.append(Spacer(1, 4))
    s.append(P('AromaMatch <b>no recaba datos personales sensibles</b> ni datos financieros o patrimoniales. Te pedimos '
               'no incluir información de salud u otros datos sensibles en los campos de texto libre.'))

    s.append(H2('11.2 Finalidades del tratamiento'))
    s.append(P('<b>Finalidades primarias</b> (necesarias para el servicio):'))
    s += lista([
        'Crear y administrar tu cuenta, y autenticar tu identidad.',
        'Calcular tu perfil olfativo y generar recomendaciones personalizadas y porcentajes de coincidencia.',
        'Guardar tus favoritos, comparaciones e historial de actividad.',
        'Permitir que los Asesores de ventas te atiendan en tienda con base en tus preferencias.',
        'Atender solicitudes, dudas y el ejercicio de tus derechos.',
    ])
    s.append(P('<b>Finalidades secundarias</b> (no necesarias para el servicio):'))
    s += lista([
        'Elaborar estadísticas y tendencias de preferencias, de forma <b>agregada y sin identificarte</b>, para decisiones '
        'comerciales como surtido, inventario y campañas.',
        'Mejorar el método de recomendación y la experiencia de uso.',
    ])
    s.append(P('Si no deseas que tus datos se traten para las finalidades secundarias, puedes manifestarlo en cualquier '
               'momento escribiendo a privacidad@aromamatch.mx. Tu negativa no será motivo para negarte el servicio.'))

    s.append(H2('11.3 Transferencias y encargados'))
    s.append(P('AromaMatch <b>no vende ni transfiere</b> tus datos personales a terceros. Solo podrán comunicarse a '
               'proveedores que actúen como encargados (por ejemplo, servicios de alojamiento), bajo obligaciones de '
               'confidencialidad, o a autoridades competentes cuando exista un requerimiento legal fundado y motivado.'))

    s.append(H2('11.4 Derechos ARCO y revocación del consentimiento'))
    s.append(P('Tienes derecho a <b>Acceder</b> a tus datos, <b>Rectificarlos</b> si son inexactos, <b>Cancelarlos</b> cuando '
               'consideres que no se requieren para las finalidades señaladas y <b>Oponerte</b> a su tratamiento para '
               'fines específicos, así como a revocar tu consentimiento. Puedes ejercerlos:'))
    s += lista([
        '<b>Desde la Plataforma:</b> en <i>Mi perfil</i> puedes consultar tu información e historial, editar tus datos '
        'personales y preferencias, y eliminar tu cuenta con el botón “Eliminar mi cuenta”, que borra tu perfil, '
        'favoritos, preferencias e historial. Las estadísticas agregadas se conservan desvinculadas de tu identidad.',
        '<b>Por correo:</b> enviando tu solicitud a privacidad@aromamatch.mx con tu nombre, el correo de tu cuenta, '
        'el derecho que deseas ejercer y una descripción clara de lo solicitado. Responderemos en un plazo máximo de '
        '20 días hábiles y, de resultar procedente, la haremos efectiva dentro de los 15 días hábiles siguientes.',
    ])

    s.append(H2('11.5 Medidas de seguridad'))
    s.append(P('Aplicamos medidas administrativas, técnicas y físicas para proteger tus datos, entre ellas: '
               'almacenamiento de contraseñas mediante una función de derivación de clave con sal (<i>scrypt</i>), '
               'sesiones con token aleatorio y fecha de expiración, control de acceso por perfil (Cliente, Asesor, '
               'Administrador) y validación de la información en el servidor. Ningún sistema es infalible; si detectamos '
               'una vulneración que afecte de forma significativa tus derechos, te lo informaremos sin demora.'))

    s.append(H2('11.6 Almacenamiento local del navegador'))
    s.append(P('La Plataforma no utiliza cookies de publicidad ni de rastreo de terceros. Guarda en el almacenamiento '
               'local de tu navegador únicamente el identificador de sesión, tu nombre y tipo de cuenta, los perfumes '
               'agregados al comparador y el último tipo de acceso utilizado, con el fin de que el servicio funcione. Puedes borrarlos cerrando sesión '
               'o limpiando los datos del sitio en tu navegador.'))

    s.append(H2('11.7 Conservación'))
    s.append(P('Conservaremos tus datos mientras tu cuenta esté activa. Al eliminarla, se suprimen tus datos personales, '
               'salvo aquellos que debamos conservar por obligación legal, los cuales se bloquearán durante el plazo '
               'correspondiente antes de su supresión definitiva.'))

    s.append(H2('11.8 Cambios al Aviso de Privacidad'))
    s.append(P('Cualquier modificación a este Aviso se publicará en la Plataforma y en el documento descargable desde '
               'la pantalla de registro. Si no estás conforme con el tratamiento de tus datos, puedes acudir ante la '
               'autoridad competente en materia de protección de datos personales.'))

    # 12
    s.append(H1('12. Salud, alergias y uso de fragancias'))
    s.append(P('Los perfumes pueden contener alérgenos y sustancias sensibilizantes. Antes de usar una fragancia, '
               'revisa sus notas y los ingredientes del empaque, y realiza una prueba en una pequeña zona de la piel. '
               'Suspende su uso si presentas irritación y consulta a un profesional de la salud. Mantén los perfumes '
               'fuera del alcance de niños, lejos del fuego y evita el contacto con los ojos. La información de '
               'intensidad, duración y proyección es aproximada.'))

    # 13
    s.append(H1('13. Limitación de responsabilidad'))
    s.append(P('En la máxima medida permitida por la ley, AromaMatch no será responsable por: (a) decisiones de compra '
               'basadas exclusivamente en las recomendaciones de la Plataforma; (b) reacciones derivadas del uso de '
               'fragancias sin la prueba previa recomendada; (c) interrupciones, errores o pérdida de información '
               'originados por causas ajenas a su control razonable; ni (d) el uso indebido de la cuenta por no '
               'resguardar la contraseña. Nada de lo anterior limita los derechos que te otorga la Ley Federal de '
               'Protección al Consumidor.'))

    # 14
    s.append(H1('14. Disponibilidad y cambios del servicio'))
    s.append(P('Procuramos que la Plataforma esté disponible de forma continua, pero podrá suspenderse temporalmente por '
               'mantenimiento, actualizaciones o causas de fuerza mayor. Podemos agregar, modificar o retirar '
               'funciones, perfumes y categorías del catálogo en cualquier momento.'))

    # 15
    s.append(H1('15. Suspensión y cancelación de cuentas'))
    s.append(P('Puedes cancelar tu cuenta en cualquier momento desde <i>Mi perfil</i>. AromaMatch podrá suspender o '
               'cancelar cuentas que incumplan estos términos, previa notificación cuando sea posible. Las cuentas del '
               'personal se darán de baja al concluir su relación con la Perfumería.'))

    # 16
    s.append(H1('16. Modificaciones a estos términos'))
    s.append(P('Podemos actualizar estos Términos y Condiciones. La versión vigente y su fecha se indican al pie de este '
               'documento. Cuando los cambios sean relevantes, te lo informaremos en la Plataforma y, si es necesario, '
               'te pediremos una nueva aceptación. Continuar usando la Plataforma después de la publicación implica la '
               'aceptación de la versión actualizada.'))

    # 17
    s.append(H1('17. Legislación aplicable y jurisdicción'))
    s.append(P('Estos términos se rigen por las leyes de los Estados Unidos Mexicanos, en particular el Código de Comercio, '
               'la Ley Federal de Protección al Consumidor y la Ley Federal de Protección de Datos Personales en Posesión '
               'de los Particulares. Para su interpretación y cumplimiento, las partes se someten a los tribunales '
               'competentes de la ciudad de Veracruz, Veracruz, sin perjuicio de la competencia de la Procuraduría '
               'Federal del Consumidor (PROFECO) en el ámbito administrativo.'))

    # 18
    s.append(H1('18. Contacto'))
    s.append(tabla([
        ['Asunto', 'Medio'],
        ['Dudas generales y soporte', 'contacto@aromamatch.mx'],
        ['Privacidad y derechos ARCO', 'privacidad@aromamatch.mx'],
        ['Atención presencial', 'Sucursal Centro: lunes a sábado, 10:00 a 20:00 h<br/>Sucursal Norte: lunes a domingo, 11:00 a 21:00 h'],
    ], [5.5 * cm, 11.5 * cm]))

    # Aceptación
    s.append(Spacer(1, 0.6 * cm))
    s.append(KeepTogether([
        caja(Paragraph(
            '<b>Constancia de aceptación.</b> Al marcar la casilla de aceptación durante el registro en AromaMatch, el '
            'Cliente declara haber leído y comprendido íntegramente estos Términos y Condiciones y el Aviso de '
            'Privacidad Integral, y otorga su consentimiento para el tratamiento de sus datos personales conforme a lo '
            'aquí descrito. La Plataforma conserva la fecha y hora de la aceptación asociada a la cuenta.', st_p),
            fondo=PLUM_SOFT, borde=PLUM),
        Spacer(1, 0.6 * cm),
        Paragraph('“Más que perfumes, mejores decisiones”', st_quote),
    ]))
    s.append(Spacer(1, 0.5 * cm))
    s.append(Paragraph('Documento elaborado para el proyecto académico de la materia Sistemas de Información. Los datos '
                       'de contacto y sucursales son ilustrativos.', st_small))
    return s


def main():
    os.makedirs(os.path.dirname(SALIDA), exist_ok=True)
    doc = BaseDocTemplate(SALIDA, pagesize=LETTER, leftMargin=2 * cm, rightMargin=2 * cm, topMargin=2.2 * cm,
                          bottomMargin=2.2 * cm, title='Términos y Condiciones — AromaMatch', author='AromaMatch',
                          subject='Términos y Condiciones de Uso y Aviso de Privacidad')
    w, h = LETTER
    marco_portada = Frame(2 * cm, 2.2 * cm, w - 4 * cm, h - 5.2 * cm - 3.0 * cm, id='portada')
    marco = Frame(2 * cm, 2.2 * cm, w - 4 * cm, h - 4.2 * cm, id='normal')
    doc.addPageTemplates([
        PageTemplate(id='Portada', frames=[marco_portada], onPage=portada, autoNextPageTemplate='Interior'),
        PageTemplate(id='Interior', frames=[marco], onPage=interior),
    ])
    doc.build(contenido())
    print('PDF generado:', SALIDA)


if __name__ == '__main__':
    main()
