# dibujo

Herramientas de dibujo para uso propio de Facu, dibujante tradicional. Hoy hay tres
—**Cuadros**, el probador de enmarcado; **Referencia**, el preparador de la foto de
referencia; y **Mesa de luz**, para calcar del celular— y la idea es que crezca a más. Todas viven en este repo y se publican
juntas en GitHub Pages.

**Los nombres son de oficio, no de software.** La cosa y no la técnica, y lo más
corta que se pueda: Cuadros, no "Simulador de molduras". Que sea una sola palabra es
lo común, no la regla — "mesa de luz" son tres y es exactamente el objeto que un
dibujante nombraría. Lo que no entra es el nombre de software; si una herramienta
nueva no se puede nombrar así, el problema es el nombre.

Es un proyecto casero: sin backend, sin cuentas, sin tests. La vara es que ande bien
y se sienta lindo de usar, no que sea infraestructura seria.

## Reglas del proyecto

**Todo corre en el navegador.** No hay servidor ni API. Las imágenes que carga el
usuario se quedan en su máquina — nunca se suben a ningún lado. Esto es una promesa
que está escrita en el README y no se rompe.

**El código y la UI están en español.** Comentarios, nombres visibles, mensajes.
Los identificadores del código van en inglés.

**Cada herramienta compila a un único .html autocontenido**, para poder abrirla con
doble clic o mandarla por mail. Lo hace `vite-plugin-singlefile`. La mesa de luz es la
excepción, y no por descuido: los navegadores no prestan la cámara fuera de un
contexto seguro, así que abierta como `file://` no tendría con qué funcionar. Por eso
`build:app` no la copia.

## Estructura

```
index.html      portada, el bifurcador hacia las herramientas
marco/          probador de enmarcado
referencia/     preparador de la foto de referencia
mesa/           la mesa de luz
src/
  portada/      estilos de la portada
  shared/
    ui/         el sistema de diseño: tokens, componentes, íconos, fuentes
    copy/       los textos de pantalla, un archivo por idioma
    ...         lo demás que comparten las herramientas
  marco/        el probador de enmarcado
  referencia/   el preparador de la foto de referencia
  mesa/         la mesa de luz
```

**Para sumar una herramienta:** crear `<nombre>/index.html`, su carpeta en `src/`, y
agregarla a la lista de `scripts/build.mjs`, a la portada y al `ToolId` de
`src/shared/imageStore.ts`.

## Comandos

```bash
npm run dev          # servidor local en http://localhost:5173
npm run dev:celu     # además en https y abierto a la red local, para probar en el celular
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

**La cámara solo existe en contexto seguro.** `getUserMedia` no atiende fuera de
https o localhost, y no avisa distinto de cuando no hay cámara. Dos consecuencias que
sorprenden: la mesa de luz abierta como archivo suelto (`file://`) nunca va a ver
nada, y probarla en el celular contra `http://192.168.x.x:5173` tampoco funciona —
para eso está `npm run dev:celu`, que levanta el server en https con un certificado
inventado. El celular pide confirmar una vez y entra.

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
- `src/shared/ui/` — **el sistema de diseño**, sacado del archivo de Figma "Mi web":
  tokens con prefijo `--ds-`, siete componentes (Button, IconButton, Checkbox, Slider,
  Stepper, ChoiceGroup, Swatch), los nueve íconos y las tipografías empaquetadas. Un
  solo import trae todo, estilos incluidos. **Si no está en Figma, no se inventa acá**
  — y los componentes no traen textos, los reciben por props. Ver
  `src/shared/ui/LEEME.md`.
- `src/shared/copy/` — **los textos**, un JSON por idioma. Ningún texto visible se
  escribe adentro de un componente, y los números también salen de ahí (el separador
  decimal es idioma). Si a una traducción le falta una clave, no compila. Ver
  `src/shared/copy/LEEME.md`.
- `src/shared/tokens.css` — el tema **oscuro**: vidrio, acento cálido. Ya solo lo usa
  Cuadros, que todavía no está dibujada en Figma. Referencia y Mesa de luz pasaron al
  sistema de arriba. Cuando Cuadros se dibuje, esta hoja desaparece.

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
- `src/referencia/components/DownloadDialog.tsx` — las preguntas del export (tamaño,
  formato y etiquetas) preguntadas recién al exportar. Vivían abiertas en el panel y
  eran controles que no se tocan mientras se trabaja, compitiendo por la atención con
  los que sí.

**El espesor de las líneas y el paso del sobel se guardan relativos al ancho**, no en
píxeles. Un valor fijo se vería fino en pantalla y grueso en el export, o al revés.
Arranca en 4 (`grid.style.weight`, de 1 a 6).

**Los dos modos comparten el mismo número** (`grid.count`, de 2 a 8 según
`GRID_LIMITS`, arranca en 4). Es a propósito: cambiar de proporcional a cuadrada con
el mismo número muestra en qué se diferencian; con un número por modo, cada cambio
traía además un salto de tamaño y no se veía nada. La cuadrada reparte el ancho
justo, así que nunca sobra a la derecha — el alto casi nunca es múltiplo y la última
fila sale cortada. Y se elige con un stepper y no con un slider: es una decisión que
se toma de a una, no un punto que se busca arrastrando. En la UI se llama "Cantidad"
y no "Divisiones" — el campo y `grid.count` siguen hablando de divisiones puertas
adentro, es solo la palabra que ve quien dibuja la que cambió.

**`GridMode` tiene un tercer valor real: `'none'`.** Hubo una época sin él —sacar la
grilla era solo bajarle la opacidad a cero, y un tercer botón no entraba en la fila
de un celular—, pero el picker a pantalla completa (`OptionPicker`, ver más abajo)
tiene lugar de sobra para las tres tarjetas. Elegir "Ninguna" no toca `opacity`: son
dos perillas independientes, y perder el valor de una al tocar la otra sería el tipo
de acoplamiento que rompe la confianza en un control. `computeGrid` devuelve `null`
tanto en `mode === 'none'` como en opacidad cero — las dos siguen siendo formas
válidas de no tener grilla, y cualquiera de las dos apaga también las etiquetas, las
cotas y la línea de medidas del export. **Es el modo por defecto** (`DEFAULT_STATE`):
la foto arranca sin grilla, y elegir Proporcional o Cuadrada es un paso que se da a
propósito, no algo que ya viene puesto.

**Las etiquetas son una pregunta del export, no de la grilla.** Viven en
`state.export.labels` y se prenden con un interruptor (`Switch`) en el diálogo de
descarga, no en el panel — y a propósito **no** en `grid.style`, aunque ahí vivían
antes: ese objeto lo leen por igual la vista previa y el export (`paintScene`/
`paintGrid`, la misma función para las dos), así que si las etiquetas fueran parte
suyo prenderlas se vería también en la foto mientras se trabaja. En cambio
`paintScene`/`paintGrid` reciben `labels` como parámetro aparte, con default `false`:
el lienzo nunca lo pasa, y solo `exportFile` lo manda en `state.export.labels`. Así
"solo se ven en la descarga" es una consecuencia de la firma de la función, no una
convención que haya que acordarse de respetar.

**El tamaño del dibujo está escondido, no borrado** (`SHOW_PAPER` en `Panel.tsx`).
El estado, el dominio y los textos siguen enteros, que es lo que hace que las cotas en
centímetros puedan volver sin rearmar nada. Prenderlo es cambiar un `false`.

**El tamaño del dibujo y la hoja de impresión son dos cosas distintas.** El primero
(`state.paper`) existe solo para poder decir cuántos centímetros mide una casilla; la
segunda (`state.export.size`, ver `PRINT_SHEETS`) es el papel que entra en la
impresora. El export en hoja **no** sale a escala real, y está bien: el dibujo puede
ser un A2 y la impresora llegar hasta A4. Lo que lo vuelve utilizable es que las
medidas estén escritas encima, no que esté a escala.

**El diálogo de descarga se cierra con una X arriba**, no con un "Cancelar" al lado de
"Descargar": abajo quedan solo los caminos de salida —descargar, o llevar la foto a la
mesa de luz—, y cerrar no es uno de ellos.

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

**Los ajustes de imagen son cuatro modos cerrados**, no cinco perillas (`EffectsMode`
y `EFFECT_MODES`). Cada modo fija los valores que no le importan y deja a la vista
solo los que sí: Original ninguna, Blanco y negro una, Bordes una, Facetado tres. Las
perillas sueltas eran honestas pero pedían entender qué es una curva y qué es un
sobel, y acá lo que se elige es cómo mirar la referencia. **`bw` ya no es
independiente del modo** — antes sobrevivía a cambiar de modo a propósito, pero
"Bordes en color" o "Facetado en color" no eran combinaciones que alguien pidiera:
son monocromos porque son de línea o de manchas de valor, no porque alguien lo haya
tildado aparte. Blanco y negro pasó a ser su propio modo (con una perilla propia,
Contraste) en vez de una casilla que convivía con los otros tres. `reducer.ts`
reescribe `bw` entero al cambiar de modo, y `persistence.ts` lo vuelve a derivar del
modo guardado al abrir, para que una sesión vieja con "Bordes" y `bw: false` no
reaparezca a color.

**El selector de Tipo, Color y Ajustes es el mismo componente** (`Dropdown` +
`OptionPicker`): una fila cerrada que lleva a una pantalla propia de tarjetas
grandes, no un menú que se abre encima. Ese picker **sobrevive a cambiar de
pestaña** — si quedó en "Ninguna", o a mitad de elegir un modo de Ajustes, volver a
esa pestaña lo encuentra como se dejó. Lo único que lo cierra es una foto nueva
(`Panel.tsx`, el `useEffect` que también abre la pestaña de grilla). Y un modo sin nada
que configurar —"Ninguna" en la grilla, "Original" en Ajustes— deja su picker
abierto siempre (`gridPicker` y `adjustPicker`): la vista cerrada sería una fila
sola con un vacío abajo. Por eso Ajustes abre directo en sus cuatro tarjetas.

**Referencia usa el sistema de diseño y el archivo de textos, y Mesa de luz también;
Cuadros todavía no.** No hay un hexadecimal ni un tamaño de letra sueltos en `referencia/styles.css`, y
no hay un texto visible escrito adentro de un componente. Cuando se toque algo acá, se
mantiene así: color y tipografía salen de `--ds-*`, y las frases de `copy`.

**La pantalla de inicio reemplaza al dibujo de ejemplo.** Antes la herramienta abría con
una naturaleza muerta inventada; ahora, sin foto, muestra la pantalla del diseño
(Figma 18:76) y **no hay barra de pestañas**: no hay nada que configurar todavía, y
una barra de botones apagados promete algo que no cumple. `App` espera a que IndexedDB
conteste (`ready`) antes de decidir cuál mostrar: sin esa espera parpadea el inicio
cuando sí había una foto guardada, y parece que se hubiera perdido.

**Cada foto nueva abre la grilla.** Es a lo que se viene. Dejar abierta la pestaña de
la foto después de subirla sería mostrarle a alguien lo que acaba de hacer en vez de
lo que sigue.

**La barra de arriba no lleva el nombre de la herramienta**, como en el diseño: solo
el botón de volver y, cuando hay foto, el de descargar. El nombre sigue estando en un
`<h1>` para el lector de pantalla — que no se dibuje no quiere decir que la página no
se llame.

**Quitar la foto conserva los ajustes.** Borra la imagen del navegador y vuelve al
inicio, pero la grilla, el color y el modo siguen puestos: preparar varias fotos de la
misma serie no tiene por qué costar reconfigurar cada vez.

### Pantalla angosta

Referencia fue la primera en resolverlo, así que lo que salió de acá vale para las
que vengan.

**El escritorio no se toca.** Todo lo de celular vive en media queries y en una rama
del render; no hay una segunda versión de nada. Los controles están escritos **una
sola vez** (el arreglo `sections` de `Panel.tsx`) y se acomodan de dos formas: columna
al costado, o barra de pestañas abajo al estilo de Lightroom. Si aparece un control
nuevo, aparece en los dos lados solo.

**Son dos preguntas distintas, no una.** El **ancho** (`useCompact`, 720 px) decide el
acomodo: que el panel y la foto no entren juntos pasa igual en una ventana angosta de
escritorio, sin ningún dedo cerca. El **puntero** (`(hover: none)`, `(pointer:
coarse)` en el CSS) decide la interacción. Mezclarlas es lo que hace que una notebook
táctil reciba la interfaz equivocada.

**Nada puede aparecer al pasar por encima.** Se coló una vez y costó caro: la
miniatura de la foto revelaba "Cambiar foto" con el hover, y en un celular ese botón
quedaba en opacidad 0 — la única forma de cargar una foto propia, inalcanzable.

**Los gestos son nuestros.** `touch-action: none` sobre el lienzo, si no arrastrar
scrollea la página y pellizcar hace zoom del navegador. Un dedo mueve, dos acercan —y
dos dedos **solo** acercan, ancladas al medio de los dedos, igual que la rueda del
mouse ancla al puntero.

**Solo se puede mover la foto hacia el lado que sobra**, como en Lightroom: si la
foto zoomeada no excede el ancho o el alto disponible en pantalla, ese eje no se
mueve, ni arrastrando ni pellizcando lejos del centro. `Canvas.tsx` lo recalcula en
cada cuadro contra el tamaño real de la ventana, así que un cambio de tamaño no deja
la vista fuera de rango. Esto es lo que hace que anclar el pellizco al medio de los
dedos sea seguro: antes, sin este recorte, ese punto temblaba con la mano y la foto
parecía arrastrarse sola; ahora, como mucho, la vista llega al borde de lo que sobra.
No hay botón de "Ajustar" — doble tap (o doble clic) recentra, y con el movimiento ya
acotado no hace falta un botón aparte para volver.

**La foto no se mueve por navegar los controles**, solo por lo que se le hace con los
dedos — ni siquiera al abrir o cerrar el cajón entero. `.stage` (el lienzo) mide
siempre el alto entero de `.app` menos la barra de pestañas, una medida constante:
`.controls` es su único hermano de flex, y lo que cambia de tamaño adentro suyo —el
cajón (`.tab-drawer`)— está sacado del flujo (`position: absolute`, anclado con
`bottom: 100%` al borde de arriba de `.controls`) para que no le cuente. El cajón
**flota sobre la foto** en vez de empujarla: abierto, tapa con su propio fondo una
franja de abajo, como una bandeja que se levanta encima; cerrado, no tapa nada y se
ve la foto entera. Por eso puede medir lo que mide su contenido y nada más —Blanco y
negro, una perilla, ocupa menos que Facetado, tres— sin que el lienzo se
reencuadre nunca: cambiar de pestaña, abrir un picker o colapsar todo el panel son
la misma clase de cambio para la foto, ninguno la mueve. `Panel.tsx` mide ese alto con
`useDrawerHeight`: un `ResizeObserver` sobre la vista actual (`.panel-view`, no
`.tab-panel`, que ya tiene un alto impuesto por el cajón) que sigue el contenido real
—el de una perilla que aparece o desaparece, por ejemplo— y lo manda como
`--content-height` a `.controls`, de donde `.tab-drawer.is-open` lo toma. Antes el
cajón tenía un alto fijo, el de su vista más alta (`52vh` primero, después
`--panel-height: 213px` fijo), y las vistas más chicas dejaban un vacío; ahora cada
una mide lo justo.

**El cajón repite el padding de `.controls`, no lo hereda.** Al sacarlo del flujo
para que no empuje el lienzo, dejó de estar adentro de la caja con relleno de
`.controls` — así que sin su propio `padding: 16px 24px 0` (con `box-sizing:
border-box`, para que entre en el alto medido y no se sume aparte) su contenido
queda pegado a los tres bordes. La franja de abajo, antes de llegar a la barra de
pestañas, no hace falta repetirla: la pone el padding-top de `.controls`, que ahora
le toca solo a esa barra.

**El movimiento dice de dónde viene y a dónde va cada cosa**, y nada se anima para
adornar. La barra de pestañas lleva una marca oscura que viaja de botón en botón; una
pestaña nueva entra del lado en que está su botón; un picker entra "hacia adentro"
y las filas vuelven "hacia afuera"; el cajón se despliega y se pliega, y la foto
crece o se achica con él cuadro a cuadro. Lo tocable se hunde al apretarlo y vuelve
con resorte. En el lienzo: la foto nueva aparece fundiéndose, cambiar la grilla o
el modo de Ajustes funde lo viejo con lo nuevo (solo en cambios de un toque — lo que
se arrastra, como el espesor o el contraste, no se funde, porque llegaría siempre
tarde al dedo), arrastrar más allá del borde ofrece resistencia y vuelve al soltar,
achicar por debajo del encuadre vuelve solo, y el doble tap recentra en un
recorrido. Las duraciones y las curvas son tokens (`--ds-dur-*`, `--ds-ease`,
`--ds-spring`); lo que vive en JavaScript usa `shared/motion.ts` con la misma curva.
Con `prefers-reduced-motion` todo llega a su estado final en el acto.

**El doble tap se reconoce a mano** (`Canvas.tsx`), no con `dblclick`: no todos los
celulares lo mandan. Con mouse sí se usa `dblclick`, y se ignora si un doble tap
táctil acaba de resolverlo, para no recentrar dos veces.

**El hover solo existe con un puntero que pasa por encima** (`@media (hover:
hover)`). En un celular el hover queda pegado después del toque, y el botón quedaba
pintado como si lo siguieran tocando.

**Guardar se pide por la hoja de compartir** (`deliver` en `exporters.ts`). La
descarga común es poco confiable en Safari de celular: abre el archivo en una pestaña
en vez de guardarlo. Donde no hay `navigator.share`, cae en la descarga de siempre.

**La calidad del export no baja en celular.** Si no entra en memoria se avisa y se
sugiere una hoja más chica; bajarla en silencio sería romper la promesa del export.

**Acá sí hay panel**, al revés que en el enmarcado. No es incoherencia: son muchas
perillas que se tocan en la misma sesión buscando un punto, y eso se encuentra
probando de corrido, no abriendo y cerrando abanicos.

## Cómo está armada la mesa de luz

El celular en un trípode mirando el papel, la cámara ocupando la pantalla y la foto
encima, translúcida. Se dibuja mirando la pantalla: lo que se ve es el lápiz real
avanzando sobre la foto.

Es la más chica de las tres: no hay render propio, solo un `<video>` y un `<img>`
apilados, y el único cálculo es el de las esquinas (`corners.ts`). Todo el diseño
está en lo que **no** hay.

**Se ve como Referencia.** Mismo sistema de diseño y mismos textos en `copy` (sección
`mesa`). Lo único propio es que con foto todo flota sobre la cámara y no sobre el
fondo claro, así que cada cosa que se toca va en su propia pastilla (`.pill`), que es
la que le pone el fondo.

**Es solo para celular.** No hay acomodo de escritorio: la herramienta es un teléfono
en un trípode.

**Sin foto, la pantalla de inicio de Referencia, igual**: el saludo, dos frases, el
botón de subir al medio, y abajo volver y "Dejame sugerencias" (que abre la app de
Instagram con `openInstagram`, de `shared/suggestions.ts`). Como allá, `App` espera
a IndexedDB (`ready`) antes de mostrarla.

**La cámara se pide recién con la foto puesta** (`useCamera(video, enabled)`). Antes
no: un cartel del navegador encima de la bienvenida la taparía antes de que nadie la
lea. El permiso lo pide el navegador con su propio cartel, y no se antepone ninguna
pantalla nuestra explicándolo: sería pedir permiso para pedir permiso.

**Abajo, volver a la izquierda, la foto al medio y la linterna a la derecha**, cada
una en su pastilla: son de conversaciones distintas y no se tienen que tocar una por
otra. La de la foto tiene cambiarla y cuánto se ve.

**La linterna aparece solo si el teléfono deja prenderla** (`torch` en
`useCamera`). Es Chrome en Android; en iPhone el navegador no la presta, y un botón
que no hace nada es peor que ninguno. Sirve porque el teléfono en el trípode le hace
sombra justo a la parte de la hoja que se está dibujando.

**La foto puede llegar desde Referencia.** El diálogo de descarga tiene "Llevar a la
mesa de luz": la foto sale como se ve —ajustes, grilla y etiquetas— por el mismo
`paintScene` de siempre (`exportForLightTable`), se guarda en IndexedDB bajo la
clave `'mesa'` y se abre la mesa. Las dos herramientas viven en el mismo sitio y ven
el mismo almacenamiento, así que la promesa de no subir nada sigue en pie. Como la
foto cambia sin pasar por la mesa, la sesión guarda de qué foto son las esquinas
(`photoKey`) y las reinicia si no coinciden. En la versión suelta de Referencia
(`file://`) el botón no aparece: no hay mesa al lado a la cual llevarla.

**La foto arranca encajada en el lugar libre** (`INSET` en `corners.ts`): sin
meterse abajo de la barra, con aire alrededor para las manijas y lejos del borde,
donde la lente deforma.

**Las esquinas están siempre, sin modo y sin "Listo".** Un trípode casi nunca queda
perpendicular a la hoja: la cámara la ve como un trapecio y una foto derecha no calza
nunca. Llevando cada esquina de la foto a su marca en el papel, la foto toma la misma
perspectiva que la cámara (`perspective` en `corners.ts`, un `matrix3d` y no
triángulos: con triángulos una recta que cruza la diagonal sale doblada).

- **La manija va afuera de la esquina**, en diagonal, unida por un hilo. Encima, el
  dedo taparía justo el punto que se está calzando. El arrastre es relativo: la
  esquina se corre lo que se corre el dedo, sin saltar a donde apoyó.
- **Arrastrar la foto la mueve entera.**
- **Una esquina no puede dar vuelta la foto** (`isConvex`): si el movimiento la
  cruzaría, se queda donde estaba.
- **"Restablecer" aparece solo si se movió algo**, arriba de la barra y al medio. Un
  botón que no cambiaría nada es un botón que hay que leer para nada.
- **No hay textos de ayuda.** Se probó una frase mientras se ajustaba y sobraba:
  además de ser texto de más, tapaba las manijas.
- **Las esquinas se guardan en fracciones de la pantalla**, junto con la opacidad: el
  trípode no se mueve de un día para el otro. Una foto nueva las vuelve a cero, porque
  trae otra proporción.

**Los controles se van solos** (`useIdle`) y vuelven con un toque en cualquier lado.
Abajo de esa pantalla hay una hoja de papel: todo lo que quede dibujado encima es
papel que no se ve. Mientras están escondidos no reciben toques — el primero
despierta la interfaz y no mueve nada, que es lo que uno quiere cuando toca a ciegas.
Las manijas de las esquinas se van con ellos.

**La pantalla se mantiene prendida** (`useWakeLock`). Dibujar es justamente no tocar
el teléfono; sin esto se apaga a los treinta segundos y hay que soltar el lápiz. El
sistema suelta el permiso al pasar a segundo plano y no lo devuelve, así que se
vuelve a pedir cada vez que la pestaña reaparece.

**Al volver de otra app el video queda pausado**, con el último cuadro congelado en
pantalla. Parece que anda hasta que se mueve el papel y no pasa nada, así que
`useCamera` lo vuelve a arrancar cuando la pestaña se hace visible.

La foto se guarda como las demás, en IndexedDB bajo su propia clave (`'mesa'`), y la
opacidad y las esquinas en localStorage.
