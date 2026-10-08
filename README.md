# AromaMatch — Sistema de soporte a la decisión

Plataforma web para encontrar perfumes según preferencias, ocasión, temporada y presupuesto. Tiene tres perfiles de usuario: **Cliente**, **Asesor de ventas** y **Administrador**.

## Requisitos

- Node.js 22.13 o superior (usa el SQLite integrado `node:sqlite`)
- Python 3 + `reportlab`, solo si quieres regenerar el PDF de términos

## Cómo ejecutarlo

```bash
npm install
npm start
```

Abre http://localhost:3000. Al primer arranque se crea `data/aromamatch.db` con datos de ejemplo. Para empezar de cero: `npm run reset-db`.

### Cuentas de demostración

| Perfil | Correo | Contraseña |
|---|---|---|
| Cliente | mariana.lopez@correo.com | cliente123 |
| Asesor de ventas | jorge.ramirez@aromamatch.mx | asesor123 |
| Administrador | admin@aromamatch.mx | admin123 |

## Módulos (vistas del PDF de diseño)

| Perfil | Vistas |
|---|---|
| Público | Iniciar sesión (con selección de tipo de usuario), Crear cuenta con aceptación de Términos |
| Cliente | Catálogo con filtros, Detalle del perfume (pirámide olfativa, coincidencia, similares), Buscador inteligente, Comparador (hasta 3), Mi perfil (favoritos, perfil olfativo, preferencias, historial, eliminar cuenta) |
| Asesor | Atención a cliente (buscar cliente, registrar preferencia, recomendar, historial), Consultar catálogo, Recomendar productos, Comparador, Historial de clientes |
| Administrador | Dashboard (KPIs, familias, tendencia por temporada, ocasiones, top perfumes, exportar CSV), Gestión de perfumes (alta/edición/baja, imagen), Categorías, Tendencias |

## Motor de recomendación (`recomendador.js`)

Coincidencia = suma de pesos de los criterios que el perfume cumple ÷ suma de pesos de los criterios elegidos.

| Criterio | Peso |
|---|---|
| Familia olfativa | 30 % |
| Ocasión | 25 % |
| Temporada | 20 % |
| Intensidad | 15 % |
| Presupuesto | 10 % |

Rangos de presupuesto: Hasta $1,500 · $1,500 – $3,000 · Más de $3,000.

## Catálogo

`seed/perfumes.js` contiene 27 perfumes reales (26 publicados y Chanel N°5 en borrador) con marca, concentración, tamaño, pirámide olfativa, año de lanzamiento y perfumista. Los precios son de referencia aproximada en México (MXN) y la duración/proyección son estimaciones. Las marcas pertenecen a sus respectivos titulares. Si modificas el archivo, ejecuta `npm run reset-db`.

Fotos (`public/img/perfumes/`, créditos en `seed/imagenes.json`): 7 de Wikimedia Commons con licencia Creative Commons y autor citado (Black Opium, Le Male, Acqua di Giò, Cool Water, Terre d'Hermès, 1 Million, Santal 33) y 20 fotos de producto de las marcas obtenidas vía Fragrantica, usadas solo con fines académicos. El crédito se muestra en el detalle de cada perfume.

En la coincidencia con el perfil guardado se restan 20 puntos por cada nota que el cliente evita.

## Funciones de análisis del DSS (`analisis.js`)

| Función | Dónde | Qué hace |
|---|---|---|
| **¿Qué pasaría si…? (pesos)** | Buscador inteligente | Controles deslizantes para cambiar el peso de cada criterio; el ranking se recalcula al instante y las flechas ▲▼ muestran cuántos lugares se movió cada perfume. El cliente puede guardar sus pesos. |
| **¿Qué pasaría si…? (precio)** | Admin → Simulador de precios | Mide cuántos clientes con perfil tendrían el perfume en su presupuesto, con coincidencia ≥ 70 % y en su top 3, y estima los ingresos a 90 días. Permite aplicar el precio. |
| **Pronóstico de demanda** | Admin → Pronóstico | Por familia olfativa, 3 meses adelante. Compara *estacional con tendencia* contra *media móvil (3)* con una prueba retrospectiva (MAPE) y usa el de menor error. |
| **Punto de reorden** | Admin → Inventario | Demanda diaria (30 días × ajuste del pronóstico), stock de seguridad (z = 1.65, 95 %), punto de reorden y pedido sugerido para 30 días. El asesor registra ventas desde el detalle del perfume. |
| **Análisis ABC** | Admin → Inventario | Pareto por ingresos de 12 meses: A = 80 %, B = 15 %, C = 5 %. |
| **Alertas por excepción** | Campana (admin y cliente), dashboard y Mi perfil | Admin: agotados, punto de reorden, caídas de demanda interanuales, alzas pronosticadas y huecos de surtido (muchos clientes con un perfil sin opciones en su presupuesto). Cliente: baja de precio o agotado en sus favoritos. |

Los datos de ejemplo cubren 24 meses de historia, con estacionalidad por familia, crecimiento anual, una caída real de Acuático e inventario inicial con casos de agotado y reorden.

## Estructura

```
server.js            API REST (Express) y servidor de archivos
db.js                Esquema SQLite y datos iniciales
recomendador.js      Motor de decisión (pesos configurables)
analisis.js          Pronóstico, inventario/ABC, simulador de precios y alertas
public/              Frontend (HTML, CSS y JavaScript sin frameworks)
docs/                Terminos_y_Condiciones_AromaMatch.pdf (también en /terminos.pdf)
scripts/             generar_terminos.py
```

## Base de datos

Tablas: `usuarios`, `sesiones`, `categorias`, `perfumes` (con existencias y tiempo de entrega), `preferencias` (con pesos personalizados), `favoritos` (con precio al guardar), `actividad` (historial visible para cliente y asesor), `eventos` (uso agregado para dashboard, tendencias y pronóstico) y `ventas` (inventario y ABC). Las contraseñas se guardan con `scrypt` y sal.

## Documentación

| Archivo | Cómo se genera |
|---|---|
| `docs/Reporte_AromaMatch.pdf` — reporte técnico (24 páginas) | `python scripts/generar_reporte.py` |
| `docs/Terminos_y_Condiciones_AromaMatch.pdf` | `python scripts/generar_terminos.py` |
| `docs/capturas/*.png` — 19 capturas de pantalla | con el servidor encendido: `node scripts/capturas.js` (usa Chrome o Edge) |

Si cambias el sistema, vuelve a tomar las capturas y luego regenera el reporte. Después ejecuta `npm run reset-db`, porque las capturas registran algo de actividad de prueba.
