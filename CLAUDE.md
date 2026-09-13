# dibujo

Herramientas de dibujo para uso propio de Facu, dibujante tradicional. Hoy hay dos
—**Cuadros**, el probador de enmarcado, y **Referencia**, el preparador de la foto de
referencia— y la idea es que crezca a más. Todas viven en este repo y se publican
juntas en GitHub Pages.

**Los nombres son de oficio, no de software.** Una palabra, concreta, la cosa y no la
técnica: Cuadros, no "Simulador de molduras". Si una herramienta nueva no entra en
esa forma, el problema es el nombre.

Es un proyecto casero: sin backend, sin cuentas, sin tests. La vara es que ande bien
y se sienta lindo de usar, no que sea infraestructura seria.

## Reglas del proyecto

**Todo corre en el navegador.** No hay servidor ni API. Las imágenes que carga el
usuario se quedan en su máquina — nunca se suben a ningún lado. Esto es una promesa
que está escrita en el README y no se rompe.

**El código y la UI están en español.** Comentarios, nombres visibles, mensajes.
Los identificadores del código van en inglés.

**Cada herramienta compila a un único .html autocontenido**, para poder abrirla con
doble clic o mandarla por mail. Lo hace `vite-plugin-singlefile`.

## Estructura

```
index.html      portada, el bifurcador hacia las herramientas
marco/          probador de enmarcado
referencia/     preparador de la foto de referencia
src/
  portada/      estilos de la portada
  shared/       lo que usan todas las herramientas
  marco/        el probador de enmarcado
  referencia/   el preparador de la foto de referencia
```

**Para sumar una herramienta:** crear `<nombre>/index.html`, su carpeta en `src/`, y
agregarla a la lista de `scripts/build.mjs` y a la portada.

## Comandos

```bash
npm run dev          # servidor local en http://localhost:5173
npm run build        # compila el sitio entero a dist/
npm run build:app    # además deja cuadros.html y referencia.html sueltos, para mandar por mail
npm run deploy       # compila y publica en GitHub Pages
```

Publicado en https://fcabanne.github.io/dibujo/

## Trampas conocidas

**Nunca sobrescribir un archivo fuente con `cat > archivo`.** Trunca el archivo a
cero antes de escribirlo, el watcher de Vite en Windows alcanza a leer la versión
vacía y la cachea. El navegador tira `does not provide an export named 'X'` con el
archivo perfecto en disco, y no se arregla recargando: hay que reiniciar el server.
Para sobrescribir: escribir a `.tmp` y `mv` encima, o usar la herramienta Edit.

**Cada página se compila por separado** (`scripts/build.mjs`). No es capricho: el
plugin que incrusta todo en un solo `.html` activa `inlineDynamicImports`, y rollup
rechaza esa opción cuando hay más de una entrada. De a una, cada página conserva la
propiedad que importa —ser un archivo autocontenido— y el sitio sale en una corrida.

**Verificar en el navegador es engañoso cuando la pestaña no está pintando.** Las
transiciones CSS quedan congeladas a mitad de camino y `requestAnimationFrame` se
suspende, así que las posiciones y opacidades que se midan pueden ser de una
animación a medio correr. Para medir estado final: desactivar transiciones, o forzar
cuadros con capturas de pantalla.

## Código que comparten las herramientas

Lo que ya existe y conviene reusar antes de escribir algo nuevo:

- `src/shared/imageFile.ts` — carga un archivo de imagen, lo reescala a 2000 px y lo
  normaliza a data URI. El reescalado no es cosmético: sin él una foto de cámara no
  entra en el almacenamiento del navegador. Es para herramientas donde la imagen es
  una vista previa; si la herramienta tiene que **devolver** la foto, usar el de abajo.
- `src/shared/referenceImage.ts` — la foto en dos versiones a la vez: el Blob
  original intacto (lo que se exporta) y una copia liviana rasterizada (lo que se ve).
  Lo usa Referencia, que promete devolver la foto en su tamaño.
- `src/shared/imageStore.ts` — guarda la imagen en IndexedDB, **aparte** de la
  configuración. Van separadas porque cuando iban juntas en localStorage una foto
  pesada reventaba la cuota y se perdía la sesión entera en silencio. Guarda data
  URIs (`saveArtwork`) o el archivo original como Blob (`saveOriginal`), cada
  herramienta bajo su propia clave.
- `src/marco/state/persistence.ts` — autoguardado de la configuración en localStorage.
  Liviano a propósito: unos pocos KB que nunca fallan por cuota.
- `src/marco/components/Canvas.tsx` — lienzo con su loop de render, manejo de densidad de
  pantalla y drag & drop de imágenes.
- `src/shared/tokens.css` — los tokens de diseño: vidrio oscuro, acento cálido. Que todas
  las herramientas se sientan de la misma familia.

## Cómo está armado el probador de enmarcado

- `src/marco/domain/` — la geometría **en centímetros** y las medidas que se le dictan al
  enmarcador. Es la única fuente de verdad dimensional: el render multiplica por una
  escala recién al final, así que lo que se ve y lo que se encarga no pueden
  desincronizarse.
- `src/marco/render/` — las capas de la escena, de la pared hacia el espectador. La luz
  viaja como dato entre todas: es lo que hace que el conjunto lea como un objeto y
  no como recortes apilados.
- `src/marco/interaction/` — qué parte del cuadro está bajo el puntero.
- `src/marco/components/` — el lienzo y la capa de controles que se apoya encima.

**La UI no tiene barra ni paneles.** Los controles se apoyan sobre la parte que
editan y desaparecen solos. Los anchos se arrastran directamente sobre el cuadro.
Las referencias visuales son Tiny Glade y Outside the Blocks.

**Los anclajes de la UI se calculan como fracción del elemento**, nunca con márgenes
fijos en píxeles: con un margen constante los controles se despegan de su esquina
apenas se hace zoom.

## Cómo está armada Referencia

Prepara la foto de referencia antes de dibujarla: grilla encima, ajustes de imagen, y
export a tamaño original o a hoja imprimible.

Se llamaba "Grilla" hasta que la grilla pasó a ser una de las tres cosas que hace. El
nombre viejo sobrevive en dos lugares, a propósito: `RENAMED` en `imageStore.ts` y
`RENAMED_KEY` en su `persistence.ts` leen lo guardado bajo la clave vieja una vez y lo
reescriben con la nueva, para que renombrar no le borre la sesión a nadie. Las dos se
pueden borrar cuando ya no queden navegadores con datos viejos. Ojo: **"grilla" sigue
siendo el nombre de la función**, y esa palabra no se toca — la sección del panel, el
cálculo y los comentarios siguen hablando de la grilla.

- `src/referencia/domain/` — dónde caen las líneas y cuánto mide cada casilla. La grilla
  se calcula **siempre en fracciones 0..1** del lado de la foto, nunca en píxeles: la
  misma grilla se dibuja en una vista previa de mil píxeles y en un export de seis
  mil, y en cuanto hay dos cuentas distintas dejan de coincidir.
- `src/referencia/render/effects.ts` — los ajustes de imagen en un shader WebGL. Están en
  la placa porque un realce de bordes son nueve lecturas por píxel: en JavaScript el
  slider deja de responder, y encontrar el punto justo es todo el ejercicio.
- `src/referencia/render/scene.ts` — **una sola** función pinta la pantalla y los dos
  exports. Es lo que garantiza que lo que encontraste jugando sea lo que sale.
- `src/referencia/export/pdf.ts` — un PDF mínimo escrito a mano, sin librerías. Existe
  por una razón de dibujante: al imprimir un PNG el visor lo reescala y la casilla
  que decía 2,5 cm sale de 2,3; un PDF con la hoja declarada en tamaño real se
  imprime 1:1 y la regla coincide. El JPEG entra tal cual con el filtro `DCTDecode`,
  así que elegir PDF no cuesta ninguna vuelta extra de compresión.
- `src/referencia/components/DownloadDialog.tsx` — las dos preguntas del export (tamaño y
  formato) preguntadas recién al exportar. Vivían abiertas en el panel y eran dos
  controles que no se tocan mientras se trabaja, compitiendo por la atención con los
  que sí.

**El espesor de las líneas y el paso del sobel se guardan relativos al ancho**, no en
píxeles. Un valor fijo se vería fino en pantalla y grueso en el export, o al revés.

**Los dos modos comparten el mismo número** (`grid.count`, de 2 a 8 según
`GRID_LIMITS`). Es a propósito: cambiar de proporcional a cuadrada con el mismo
número muestra en qué se diferencian; con un número por modo, cada cambio traía
además un salto de tamaño y no se veía nada. La cuadrada reparte el ancho justo, así
que nunca sobra a la derecha — el alto casi nunca es múltiplo y la última fila sale
cortada.

**El tamaño del dibujo y la hoja de impresión son dos cosas distintas.** El primero
(`state.paper`) existe solo para poder decir cuántos centímetros mide una casilla; la
segunda (`state.export.size`, ver `PRINT_SHEETS`) es el papel que entra en la
impresora. El export en hoja **no** sale a escala real, y está bien: el dibujo puede
ser un A2 y la impresora llegar hasta A4. Lo que lo vuelve utilizable es que las
medidas estén escritas encima, no que esté a escala.

**Un `<dialog>` modal no siempre se cierra solo con Escape.** En la vista empotrada
del escritorio el evento llega a la página —trusted y todo— y el navegador no lo
cierra. `DownloadDialog` lo maneja a mano, y escucha `close` con
`addEventListener` en vez de con `onClose` de React, porque ese evento no burbujea y
React lo entrega de forma despareja. Quedarse encerrado en un modal es de las peores
cosas que puede hacer una interfaz: no confiar en el comportamiento nativo acá.

**El margen de seguridad es una constante** (`SAFE_MARGIN`), no un control: toda
impresora se come unos milímetros del borde. Por la misma razón la hoja se orienta
sola según la foto — una foto apaisada sobre un A4 parado desperdicia media hoja y
nadie elige eso a propósito. Lo que se escribe en "a medida" sí se respeta tal cual.

**Las medidas se leen sobre la foto, no en una tabla.** `drawCellSize` dibuja las
cotas de la casilla adentro de A1, y van también en el export: la hoja impresa que
apoyás en la mesa tiene que poder decir sola cuánto mide su propia grilla. Cada cota
va **de punta a punta de lo que mide** —del borde de la foto a la primera línea de la
grilla—; una cota que no toca sus dos extremos no dice qué está midiendo. Cuando hay
cotas, esa esquina es suya: no se dibujan ahí ni la "A" ni el "1".

**Todo lo que se escribe sobre la foto se mide contra el ancho de la foto**
(`typeSize`), nunca contra el tamaño de la casilla. Si escalara con la grilla, el
mismo número saldría minúsculo con ocho divisiones y descomunal con dos.

**Los ajustes de imagen son tres modos cerrados**, no cinco perillas (`EffectsMode` y
`EFFECT_MODES`). Cada modo fija los valores que no le importan y deja a la vista solo
los que sí: Bordes muestra una perilla, Facetado tres, Original ninguna. Las perillas
sueltas eran honestas pero pedían entender qué es una curva y qué es un sobel, y acá
lo que se elige es cómo mirar la referencia. El blanco y negro queda afuera del modo
—y arriba, en la UI— porque es independiente y sobrevive al cambio.

**Acá sí hay panel**, al revés que en el enmarcado. No es incoherencia: son muchas
perillas que se tocan en la misma sesión buscando un punto, y eso se encuentra
probando de corrido, no abriendo y cerrando abanicos.
