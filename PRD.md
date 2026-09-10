# PRD — Cuadros (Frame Visualizer)

> Herramienta interactiva de escritorio para probar enmarcados de dibujos tradicionales
> antes de llevarlos a la casa de cuadros.

**Versión:** 1.0 (MVP)
**Fecha:** 2026-09-06
**Autor:** Facu Cabanne

---

## 1. Contexto y problema

Soy dibujante tradicional. Cuando termino un dibujo lo llevo a enmarcar, pero nunca sé
bien cómo va a quedar: qué color de marco, qué ancho, qué material, si lleva passe-partout,
qué vidrio. Son muchas variables y en la casa de cuadros me ofrecen siempre lo clásico,
que termina siendo aburrido.

Además, no tengo forma de anticipar cómo se va a ver el cuadro contra la pared donde va a
colgar (el color y el estilo de la pared cambian todo).

**Lo que falta:** un lugar donde tirar la imagen del dibujo y probar combinaciones de
enmarcado de forma visual, rápida y realista — y salir de ahí con medidas precisas para
llevar a la carpintería.

---

## 2. Objetivo

Una herramienta que permita:

1. **Explorar** combinaciones de enmarcado de forma visual y sin fricción.
2. **Comparar** las opciones que más gustaron, una al lado de la otra.
3. **Salir con datos precisos** (medidas de cada pieza) para encargar el marco.

---

## 3. Usuario

Dibujante / ilustrador tradicional, con obra física terminada, sin conocimiento técnico
de enmarcado ni de software de diseño. Trabaja en desktop.

---

## 4. Flujo principal

```
1. Abre la app → ve un dibujo placeholder ya enmarcado (invita a jugar)
2. Reemplaza el placeholder por su dibujo (drag & drop o file picker)
3. (Opcional pero sugerido) Ingresa el tamaño real del dibujo en cm
4. Juega con los controles: marco, passe-partout, vidrio, fondo
5. Guarda snapshots de las opciones que le gustan
6. Recorre la galería de snapshots y compara
7. Guarda el proyecto a un archivo local para retomar después
8. [Post-MVP] Exporta ficha de medidas
```

---

## 5. Alcance del MVP

### 5.1 Lienzo / preview

- Render **2D frontal** (nada de 3D) con **sombras trabajadas**.
- La escena muestra: **pared de fondo + cuadro + sombra proyectada del cuadro sobre la pared**.
- La sombra **cambia según el espesor total** del cuadro (más espesor = sombra más
  larga/marcada). Es la señal visual de profundidad.
- Texturas y brillos realistas en marco, vidrio y passe-partout.
- Actualización en tiempo real al mover cualquier control (< 100 ms).

### 5.2 La obra (imagen)

| Requisito | Detalle |
|---|---|
| Placeholder inicial | Un dibujo de ejemplo ya cargado y enmarcado |
| Reemplazo | Drag & drop sobre el lienzo + botón file picker |
| Formatos | PNG, JPG, WEBP |
| Posición | Siempre **centrada**, sin pan/arrastre |
| Zoom | Sí — ajusta el encuadre de la imagen dentro de la ventana del marco |
| Rotación | Rota el **cuadro entero** (obra + marco), no la imagen dentro del marco |

### 5.3 Marco

| Control | Rango / opciones |
|---|---|
| Ancho | Slider 0 – 10 cm. **0 = sin marco** → aparecen ganchitos de sujeción de vidrio |
| Espesor (profundidad) | Slider — afecta la sombra proyectada |
| Color / material | Paleta clásica sugerida (negro, blanco, natural, nogal, roble, dorado, plateado, crudo) |
| Custom | Color picker libre para salir de la paleta |
| Acabado | Mate / satinado / brillante / veteado |

### 5.4 Passe-partout

| Control | Detalle |
|---|---|
| On / off | Toggle. Por defecto: on |
| Ancho | Slider, **uniforme en los 4 lados** (variable por lado queda para después) |
| Color | Paleta sugerida (crudos, blancos, grises, negros) + picker custom |
| Bisel interno | Sí, visible en el canto |

> Multi-nivel (doble passe-partout) queda **fuera del MVP**, pero el modelo de datos lo
> tiene que contemplar como array para poder sumarlo sin romper nada.

### 5.5 Vidrio

Selector con **efecto visual real** (no decorativo):

| Tipo | Comportamiento visual |
|---|---|
| Cristal común | Transparente + reflejo especular marcado (banda diagonal) |
| Antirreflejo | Transparente, sin reflejo, leve pérdida de contraste |
| Mate | Difusión suave sobre la obra, sin reflejo |
| Sin vidrio | Obra limpia, sin capa |

### 5.6 Fondo / pared

- **Color liso**: paleta sugerida de colores de pared + picker custom.
- **Patrones**: liso, textura sutil (yeso/gotelé), patrón geométrico discreto.
- Importante para la decisión, pero **secundario** frente al resto de controles: su UI
  vive más al margen.

### 5.7 Medidas y precisión

- Unidad única: **centímetros**.
- El usuario ingresa el **tamaño real del dibujo** (ancho × alto en cm). Es la base de escala.
- No es obligatorio, pero la UI lo **sugiere** para mejorar el resultado final.
- Con esa base, la app calcula y muestra en vivo:
  - Medida exterior del marco
  - Medida de la ventana (luz) del passe-partout
  - Medida del vidrio
  - Ancho y espesor de cada pieza
  - Diagonal y profundidad total
- Los sliders pueden **snapear** a valores redondos (0.5 cm) para dar medidas prolijas.

### 5.8 Snapshots

- Se crean **manualmente** (botón explícito).
- Se muestran en una **galería scrolleable** con thumbnail de cada opción.
- Click en un snapshot → restaura esa configuración completa.
- Se puede borrar un snapshot individual.
- El snapshot guarda la configuración completa, no solo la imagen.

### 5.9 Persistencia

- **Autoguardado local** de la sesión en curso (localStorage): si cierra y vuelve, sigue ahí.
- **Guardar proyecto** → descarga un archivo (JSON, extensión `.cuadro`) con configuración,
  snapshots e imagen embebida en base64.
- **Abrir proyecto** → carga ese archivo y restaura todo.
- Un proyecto por sesión (no hay gestor de múltiples proyectos abiertos).

### 5.10 Exportación

**En stand-by para el MVP.** Se define después. La intención es una ficha (PDF y/o imagen)
con el render del cuadro y todas las medidas, en un formato que entienda cualquier
carpintería. El modelo de datos ya tiene que poder alimentarla.

---

## 6. Interfaz

**Referencias:** Tiny Glade, Outside the Blocks.

Principios:

- **Controles flotantes** sobre el lienzo, no un sidebar de formulario. Nada de paneles
  densos con labels y campos.
- **Radiales / arcos de opciones**: al abrir una categoría (ej. color de marco) las
  opciones se despliegan en un arco de swatches circulares. Snappy, con animación corta.
- **Icónico antes que textual**: los controles se entienden por la forma y el color.
- El lienzo manda: la UI ocupa lo mínimo y se aparta.
- Los valores numéricos existen pero son **secundarios** — aparecen al interactuar con el
  slider, o en un panel de medidas que se puede desplegar.
- Feedback inmediato: nada de "aplicar".

Zonas:

| Zona | Contenido |
|---|---|
| Centro | Lienzo con pared + cuadro + sombra |
| Cluster flotante (izq. o inferior) | Marco, passe-partout, vidrio — los controles principales |
| Al margen | Fondo/pared, imagen (cargar, zoom, rotar) |
| Esquina | Snapshots (botón + galería desplegable) |
| Discreta | Medidas (panel desplegable) y proyecto (guardar/abrir) |

> El "botón guardar" no es un botón de barra: guardar proyecto y abrir proyecto viven en
> un control discreto de esquina, y el autoguardado hace que casi nunca haga falta.

---

## 7. Fuera de alcance (MVP)

- Mobile / responsive (desktop only)
- 3D o perspectiva
- Multi-nivel de passe-partout
- Exportación PDF (stand-by)
- Backend, cuentas, sincronización, compartir
- Catálogo de materiales reales con precios
- Múltiples proyectos simultáneos

---

## 8. Stack

- **Vite + React + TypeScript**
- **Canvas 2D** para el render (sombras, texturas, reflejos)
- **localStorage** para autoguardado; archivo `.cuadro` (JSON) para guardar/abrir
- **100 % offline**, sin backend

---

## 9. Criterios de éxito

- [ ] Cargar un dibujo y verlo enmarcado en menos de 10 segundos, sin leer instrucciones.
- [ ] Cualquier cambio de parámetro se refleja en el lienzo en menos de 100 ms.
- [ ] Se pueden guardar y recorrer al menos 20 snapshots sin degradación.
- [ ] Las medidas calculadas son consistentes con el tamaño real ingresado (±1 mm).
- [ ] El resultado se siente *lindo*: da ganas de probar combinaciones.

---

## 10. Próximos pasos (post-MVP)

1. Ficha de medidas exportable (PDF + imagen)
2. Doble passe-partout y anchos por lado
3. Responsive / tablet
4. Vista comparativa lado a lado dedicada
5. Iluminación de la escena (luz cálida/fría, dirección)
6. Catálogo de molduras reales
