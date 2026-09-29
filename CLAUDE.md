# dibujo

Herramientas de dibujo para uso propio de Facu, dibujante tradicional. Hoy hay tres, en el
orden en que se usan —**Referencia**, el preparador de la foto de referencia; **Mesa
de luz**, para calcar del celular; y **Enmarcado**, el probador de marcos— y la idea
es que crezca a más. Todas viven en este repo y se publican
juntas en GitHub Pages.

**Los nombres son de oficio, no de software.** La cosa y no la técnica, y lo más
corta que se pueda: Enmarcado, no "Simulador de molduras". Que sea una sola palabra es
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
npm run build:app    # además deja enmarcado.html y referencia.html sueltos, para mandar por mail
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

## Cómo está armada la portada

HTML y CSS sueltos, y un solo script: el que abre Instagram en la app (`main.ts`). Habla como la pantalla de inicio de Referencia
—"Hola artista!", una frase, el link a Instagram abajo— y usa su mismo sistema de
diseño. **Las herramientas van en el orden en que se usan**: la foto, el calcado, el
marco. Las tres ilustraciones son **la misma pera** en esos tres momentos (la foto
con la grilla, calcada sobre el papel, colgada en la pared), dibujada una sola vez
en un `<defs>` al principio del archivo; así la portada se lee como un recorrido y no
como tres cosas sueltas. El único movimiento es el trazo de la mesa de luz, que se
completa al pasar por encima: sin hover la tarjeta dice exactamente lo mismo.

**Los colores del dibujito salen de `--ds-*`**, como todo lo demás: papel, grafito,
moldura, lápiz. La única excepción son los de la foto, escritos en el `<defs>`: es
una foto y no interfaz, y tiene que leerse distinta del dibujo en grafito.

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

## Cómo está armado el probador de enmarcado

- `src/marco/domain/` — la geometría **en centímetros** y las medidas que se le dictan al
  enmarcador. Es la única fuente de verdad dimensional: el render multiplica por una
  escala recién al final, así que lo que se ve y lo que se encarga no pueden
  desincronizarse.
- `src/marco/render/` — las capas de la escena, de la pared hacia el espectador. La luz
  viaja como dato entre todas: es lo que hace que el conjunto lea como un objeto y
  no como recortes apilados.
- `src/marco/interaction/` — qué parte del cuadro está bajo el puntero, o bajo el dedo.
- `src/marco/components/` — el lienzo y las dos capas de controles que se apoyan
  encima: la de escritorio (`Overlay` y `hud/`) y la del celular (`mobile/`).
- `src/marco/hooks/` — `useCompact` decide qué capa va; `useTilt` lee la inclinación
  del teléfono.

**En escritorio la UI no tiene barra ni paneles.** Los controles se apoyan sobre la
parte que editan (en el celular sí hay barra: ver más abajo). Los anchos se arrastran directamente sobre el cuadro.
Las referencias visuales son Tiny Glade y Outside the Blocks.

**Los anclajes de la UI se calculan como fracción del elemento**, nunca con márgenes
fijos en píxeles: con un margen constante los controles se despegan de su esquina
apenas se hace zoom.

**Lo que se sumó al render para que se vea más real**, y que ve también el escritorio
porque es el mismo render:

- **El foco cae también sobre el cuadro** (`drawObjectFalloff` en `wall.ts`), no solo
  sobre la pared: unos pocos puntos de caída hacia los bordes lejanos del pozo de luz.
  Antes el cuadro iba parejo encima de una pared que sí caía a penumbra, y se leía
  pegado. Es suave a propósito: no alcanza para cambiar cómo se ven los colores de la
  obra, que es lo que se está juzgando.
- **Cada listón de madera tiene su tono** (`PIECE_TONE` en `frame.ts`), fijo y alternado.
  Cuatro piezas idénticas delatan un marco dibujado.
- **Sin marco, el canto del vidrio agarra luz** (`drawGlassEdge`), con el tinte verdoso
  del vidrio común visto de canto.
- **Los ganchitos son clips de acero de resorte** (`render/clips.ts`), en centímetros:
  una lengüeta de un centímetro que pisa el vidrio, el doblez sobre el canto que agarra
  la luz, y la sombra que tira sobre la obra a través del vidrio. Van como vienen los
  portarretratos de clip —uno al medio de cada lado corto, dos cerca de las puntas en
  los largos desde los 30 cm—. Antes eran cuatro pastillas grises montadas sobre el
  borde, y se leían como un juguete.
- **Las texturas de pared están en escala real** (`wallStructure` en `textures.ts`):
  cada una se dibuja en centímetros —la gota de gotelé de dos a seis milímetros, el
  hilo de lino de milímetro y medio, las manchas de llana del yeso de varios
  centímetros— y se pinta a la escala del cuadro, anclada a él. Antes se dibujaban en
  píxeles de pantalla y no se distinguían entre sí; ahora se ven, y acercar la vista
  las agranda como a todo lo demás. Las baldosas empalman sin costura: el ruido grande
  da la vuelta en el borde (`tileableFbm`) y lo que cae en un borde se pinta también
  del otro lado.
- **Las sombras tienen el color de lo que tapan** (`shadowTint` en `light.ts`). Una
  sombra es la misma superficie con menos luz: más saturada, porque la pared se
  ilumina con su propio rebote, y apenas más fría, porque lo que se tapa es el foco
  cálido. En negro semitransparente una pared crema salía gris sucio y una terracota,
  marrón. Vale para la sombra del cuadro, la penumbra de la pared y la sombra del
  marco sobre el passe-partout. La penumbra es una sola pasada que multiplica —ocupa
  la pantalla entera, y una pasada más ahí se paga en cada cuadro—; la sombra del
  cuadro son dos, la negra de siempre y el color encima, porque en una sola el color
  no llegaba a la parte suave, que es la que más se ve.
- **La sombra del cuadro es una cuña** (`shadow.ts`). Un cuadro colgado de un alambre
  se inclina: el canto de arriba se despega de la pared uno o dos centímetros
  (`standoff`) y el de abajo apoya. La sombra es ancha arriba, se afina hacia abajo y
  es más nítida donde apoya. Y la luz es un foco con posición (`spotPosition`), no el
  sol: cada esquina tira su sombra alejándose de él. El largo en el centro es el de
  antes; lo nuevo es la forma.
- **El brillo recorre la moldura** (`drawGlint` en `frame.ts`). Con la luz y el ojo en
  el infinito, cada listón brillaba igual de punta a punta, como un perfil extruido.
  Con el foco en un lugar y el ojo en otro, en cada punto del listón la luz llega de
  otro ángulo: el brillo es fuerte donde se compensan y se apaga hacia las puntas. El
  puntero —o la inclinación del teléfono— corre el ojo, y el brillo viaja por la
  moldura. La sección (dónde cae el brillo a lo ancho) sigue saliendo de
  `shadeProfile`; lo que se agregó es cuánto brilla a lo largo (`specPeak`).
- **La madera es una tabla** (`render/wood.ts`). Antes la veta eran líneas onduladas.
  Ahora son los anillos de un tronco cortados por la cara de la pieza: paralelos donde
  la cara pasa cerca de la médula y abiertos en catedrales donde se aleja, con poros
  en el roble y rayas finas en el nogal. La especie se deduce del color (claros, pino;
  medios, roble; oscuros, nogal), porque el color se elige aparte del material. Se
  hornea una vez por especie en centímetros —unos 70 ms, con un hash de enteros
  (`stripNoise`) porque el seno se llevaba casi todo el tiempo— y se pinta anclada a
  cada listón con un patrón transformado. Un navegador que no sepa transformar un
  patrón se queda con las líneas de antes.
- **La sombra y el vidrio mate andan en Safari** (`render/blur.ts`). `ctx.filter` está
  apagado en Safari —en todo iPhone, entonces— y la sombra salía como tres rectángulos
  de borde duro. El respaldo usa `shadowBlur` para la sombra y un achicar-y-agrandar
  para el mate. Chrome sigue por el camino de siempre y da lo mismo que antes.

### En escritorio

Las burbujas, sus abanicos y la cartela son de `components/Overlay.tsx` y `hud/`. Lo
que ya no se hace es lo que se probó y sobraba: nada aparece por arte de magia y nada
flota sin regla.

**Cada burbuja tiene un lugar que se puede adivinar** (`anchorsFor` en `zones.ts`):
dos a cada lado del cuadro y una abajo, todas afuera y sobre el eje del medio. A la
izquierda lo que lo envuelve, de afuera hacia adentro (marco, passe-partout); a la
derecha lo que lo cubre y lo rodea (vidrio, pared); abajo, la obra. Las que abren un
abanico van a los costados y no arriba o abajo, a propósito: el cuadro cuelga a la
altura de la vista y arriba sobran unos sesenta píxeles, mientras que a los costados
sobran cuatrocientos.

**En reposo son puntos, y crecen con el puntero.** `--p` (0 a 1) lo escribe el rAF en
cada anclaje según la distancia al mouse y lo suaviza ahí —más rápido al despertar que
al dormirse—, no con una transición de CSS, que se reinicia en cada cuadro y arrastra.
Lo discreto (abrir, apretar, fijar) sí es CSS, con `scale` y `transform` por separado
para que compongan. Mientras se arrastra un ancho, las burbujas se calman.

**Abrir, fijar y cerrar** (`Overlay`). Pasar por encima abre con un instante de
intención (`INTENT_MS`): pasar de largo no abre. **Un clic fija** el abanico —un aro
alrededor de la burbuja lo dice— y deja de depender del puntero; otro clic sobre la
misma burbuja, tocar afuera o Escape lo cierra. Sin fijar, vive mientras el puntero
esté en su cuerno (`inFan`, una cuenta de ángulo y distancia) o en la burbuja; no hay
rectángulo invisible. Al salir queda un respiro de `LEAVE_MS`, que solo tapa el
temblor de la mano. Con un abanico abierto las demás burbujas se apagan pero siguen
ahí: pasar a una cambia de categoría solo si el puntero ya salió del cuerno abierto
(cruzar una burbuja camino a una muestra no puede cambiar nada) y, con uno fijo, se
cambia con un clic.

**El abanico es geometría, no estilos** (`hud/fan.ts`). Todos los arcos usan el mismo
paso **en píxeles**: con un paso angular compartido los de adentro quedaban apretados
y las muestras se pisaban. Cada arco pide el radio que necesita según cuántas muestras
tiene, y el ángulo de apertura lo elige `chooseDirection`: el que deja todo en pantalla
y sin tapar el cuadro ni la pastilla de volver, lo más cerca posible del preferido. No
hay una etiqueta bajo cada muestra —con doce a la vez se pisaban—: se lee el nombre de
la que está bajo el puntero. Las muestras nacen debajo del puntero, así que recién
atienden al puntero cuando terminaron de desplegarse (`ARM_MS`); si no, la que cayera
encima quedaba como "hover" con su vista previa hasta que el mouse se moviera. El
escalonado de entrada tiene tope: veinticinco muestras a 9 ms dejaban la última un
cuarto de segundo atrás.

**La parte que se edita se marca con un aro, nunca con un relleno** (`.lit`, y `.leader`
para el hilo). Lo que se está juzgando es el color de la moldura, del passe-partout,
el vidrio; una capa encima lo falsearía. Solo al aparecer hay un destello de relleno
que se va antes de elegir nada.

**La obra se edita en la cartela**, no en un panel (`hud/Cartela.tsx`): al abrir la
obra la hoja de la pared pasa a modo edición —título y tamaño subrayados como campo,
cargar y girar debajo— y **el texto no se mueve**: el papel crece a su alrededor con un
margen negativo que compensa el relleno. La capa entera es transparente a los toques
(`pointer-events: none`), así que la hoja lo reactiva mientras se edita. Con el
cuadro girado los campos muestran la medida como cuelga, y el límite de tamaño se
aplica al salir del campo y no en cada tecla (acotar en cada tecla hace imposible tipear
"1" camino a "18").

**Volver y "Dejame sugerencias"** van en una pastilla fija arriba a la izquierda
(`.hud-pill`). El abanico la esquiva.

**Ningún tooltip nativo** (`title`): se prendía sobre las muestras a destiempo y
peleaba con la etiqueta propia. El nombre accesible va en `aria-label`. Con el teclado,
Enter en una burbuja la abre fija, y Tab entra al arco del espesor y a las muestras
—por eso `RadialMenu` va después de la burbuja en el documento—.

**Tipografía, curvas y duraciones salen del sistema** (`--ds-*`); lo propio de esta
capa, en `styles.css`, es el vidrio oscuro y el naranja del activo, que el diseño de
Figma todavía no dibuja para el escritorio. Ya no hay hoja de tema aparte.

### En el celular

La capa de escritorio vive de un puntero que pasa por encima —las burbujas despiertan
al mover el mouse, los abanicos se abren al pasar, el paralaje sigue al cursor—, y en
una pantalla que solo se toca no aparecía nunca: la herramienta abría sin controles. Por
eso Enmarcado tiene una segunda capa de controles para el celular. **El lienzo, el estado,
el reducer y el render son los mismos**; lo que cambia es lo que flota encima
(`components/mobile/` en vez de `Overlay`), y el lienzo (`Canvas.tsx`) tiene una rama
de gestos para el dedo. **El escritorio no se tocó**: su camino en `Canvas` es el de
antes, y todo el CSS del celular cuelga de `.is-compact` o de clases `m-`
(`src/marco/mobile.css`).

**La pregunta no es solo el ancho** (`useCompact`): angosta **o** sin un puntero que
pase por encima (`(hover: none) and (pointer: coarse)`). En Referencia alcanza con el
ancho porque su panel anda igual con el dedo; acá la capa de escritorio no anda sin
hover, así que un iPad o un teléfono acostado —que pasan de 720 px— tienen que recibir
la del celular. Una notebook táctil tiene mouse como puntero principal y sigue con la
de escritorio.

**Se ve como Referencia y como la mesa**: sistema de diseño (`shared/ui`) y textos en
`copy` (sección `marco`). Como en la mesa, todo flota sobre una imagen —acá la pared—,
así que cada cosa que se toca va en su pastilla del fondo claro. Abajo, volver a la
izquierda y las cinco pestañas a la derecha, con la marca oscura que viaja de pestaña en
pestaña: **Obra, Marco, Passe-partout, Vidrio, Pared**, el orden en que se decide un
cuadro. Los nombres de colores, acabados y perfiles salen de `palettes.ts`, los mismos
del escritorio: son vocabulario de taller, no textos de pantalla.

**El cajón mide lo que mide su contenido y el cuadro se acomoda arriba de él.** Al
revés que en Referencia, donde el cajón tapa la foto sin moverla: acá lo que se está
eligiendo es el cuadro, y taparlo sería elegir a ciegas. `MobileUI` registra en
`freeArea` una función que mide del DOM el lugar que dejan libre los controles, y el
lienzo la llama **en cada cuadro**, así que el cuadro sube y se achica acompañando la
transición de CSS del cajón, sin que nadie le avise. Acostado y bajito, el cajón pasa a
la derecha y el cuadro se encaja a su izquierda.

**La cartela cuelga debajo del cuadro** cuando no hay cajón abierto —al costado, si el
teléfono está acostado—, y se va mientras hay uno: no hay lugar, y el cuadro es lo que
importa mientras se elige. Es la misma cartela del escritorio con las letras del
sistema, y es lo que uno se lleva al enmarcador. El lienzo reserva su lugar al encajar
el cuadro y publica dónde va (`SceneSnapshot.label`).

**Cada pestaña, sus controles:**

- **Obra**: el título arriba y el tamaño real abajo, como en la cartela; y cambiar,
  girar y quitar. Ni el título ni las medidas se escriben en el cajón: tocarlos abre
  el editor a pantalla completa (ver abajo).
- **Marco**: el color en una **tira de muestras que se corre de costado** —se busca
  pasando el dedo y mirando el cuadro, como frente a la pared de muestras de una casa de
  cuadros—, acabado y perfil en filas que llevan a sus tarjetas (`Dropdown` +
  `OptionPicker`, como en Referencia), y ancho y espesor. El color va a la vista porque
  es lo que más se prueba; acabado y perfil se deciden menos y tienen nombres que hay
  que leer.
- **Passe-partout**: la tira de colores y el ancho.
- **Vidrio**: las cuatro tarjetas directo (`OptionPicker`), solo con el nombre.
- **Pared**: la tira de colores y la textura en una fila que lleva a sus tarjetas. Cada
  tarjeta muestra un pedazo de esa pared, acercado (`paintWallChip`): a la escala del
  cuadro la diferencia entre yeso y gotelé es sutil, y con el nombre solo no se veía.

**Los acabados son tres en el celular**: madera, pintado y metal (`MOLDING_FAMILIES` en
`palettes.ts`). Las siete de escritorio se distinguen mirando de cerca —veteado o lisa,
mate o satinado—, pero en el cuadro terminado casi no cambian nada. La familia se
reconoce por el material, así que un marco armado en escritorio con "Laca" aparece como
"Pintado". El escritorio sigue con las siete.

**"Sin" es la primera muestra de su tira**: sin marco, sin passe-partout, como "Sin
vidrio" es la primera tarjeta. No tener es una opción de enmarcado más, no un apagado
escondido. Sin marco, las filas que no tienen a qué aplicarse quedan apagadas. **Y el
ancho de los dos llega a cero**, que es lo mismo que la muestra de "sin": las dos formas
de sacarlo hacen lo mismo en las dos pestañas. Por debajo del centímetro no hay
passe-partout que cortar, así que el primer paso después del cero lo trae en su ancho
mínimo.

**Se escribe a pantalla completa** (`FieldEditor`). Con el teclado abierto el celular
se come media pantalla, y el cajón —con el campo adentro— quedaba tapado o empujaba
todo: el cuadro se achicaba a nada y el campo se iba de la vista. En el cajón el título
y las medidas son botones con forma de campo (`FieldButton`); tocarlos abre el editor
con el campo arriba de todo y "Listo" al lado del título —el teclado numérico del
iPhone no tiene tecla de aceptar—. Lo escrito se aplica en el acto, como todo; "Listo"
cierra, no confirma. Abajo, cuánto mide el cuadro terminado, que es lo que se encarga.
Los campos de medida son de texto con teclado decimal: uno numérico rechaza en silencio
la coma del teclado en castellano.

**El teclado tiene que salir en el mismo toque.** En iPhone, si el campo aparece en el
render siguiente y se enfoca desde un efecto, ya es tarde: el foco llega pero el
teclado no se abre. Por eso `edit` en `MobileUI` monta el editor en el acto
(`flushSync`) y lo enfoca ahí mismo, adentro del manejador del toque.

**Las muestras de moldura se miran de frente** (`look: 'face'` en `render/chip.ts`) y
las tarjetas de perfil de costado (`'bottom'`). Con la sección del lado de arriba —la
que usa el escritorio, y la que sigue usando—, un marco blanco se veía gris oscuro en su
muestra: en una caveta ese lado mira para abajo y queda en sombra.

**El cuadro también se toca**, y nada depende de pasar por encima:

- **Un dedo sobre la moldura o el passe-partout los ensancha**, como el mouse, con las
  mismas cotas y el medio centímetro de imán. La banda se agranda hacia afuera para el
  dedo (`touchZone`): una moldura de 3 cm en un teléfono mide veinte píxeles.
- **Las cotas aparecen solas un rato** al abrir Marco o Passe-partout, o al mover su
  ancho desde el slider: dicen que esa banda se estira, sin un texto que lo diga.
- **Un toque abre lo que edita la parte tocada**: la moldura, el passe-partout, la
  obra. Tocar la pared cierra el cajón —es tocar "afuera"—.
- **Dos dedos acercan**, anclados al medio de los dedos, hasta tres veces. De cerca, un
  dedo corre la vista —solo hacia donde sobra cuadro, como en Referencia— y un doble
  toque vuelve al encuadre. Soltar por debajo del encuadre vuelve solo.
- **Un dedo sobre la pared corre la luz**, como el mouse en escritorio: el reflejo barre
  el vidrio y asoma el canto de la moldura.

**El teléfono inclinado también corre la luz** (`useTilt`). Es lo que en escritorio hace
el mouse, y en un celular es todavía mejor: se mueve el teléfono y el cuadro responde
como un objeto. Mide cambios y no la postura —el centro se va acomodando solo en unos
tres segundos—. En iPhone el sensor pide permiso, y solo en respuesta a un toque: se
pide una vez, al primer toque sobre el cuadro (`askTiltPermission`). Si se niega no pasa
nada; el dedo sobre la pared sigue corriendo la luz.

**Un material nuevo se funde sobre el anterior** en vez de saltar (`looksKey` y
`snapshot` en `Canvas.tsx`). Solo lo que cambia sin mover nada de lugar —color,
acabado, perfil, vidrio, pared—: un cambio de medida con fundido se vería doble.

**El lienzo no pinta si nada cambió** (`paintedRef`). En escritorio el loop pinta
siempre; en un teléfono eso es batería gastada en una imagen quieta. Compara contra
**lo último que se pintó** —estado, escala, centro, paralaje—, no contra si la vista
está llegando a destino: mientras los dedos arrastran, la vista va pegada a ellos y
"ya llegó" en cada cuadro, y con esa pregunta el pellizco no se pintaba nunca.

**Sin dibujo, la pantalla de inicio de Referencia y la mesa** (`mobile/Welcome.tsx`):
el saludo, qué es, qué hacer, el botón, y abajo volver y "Dejame sugerencias". **En el
celular no hay dibujo de ejemplo**: hacía creer que ya había algo cargado. El
escritorio lo conserva —ahí invita a tocar los controles, que se descubren pasando el
mouse—. En el estado el ejemplo sigue siendo la obra por defecto; el celular lo lee
como "no hay dibujo". `App` espera a IndexedDB (`ready`) antes de elegir entre la
bienvenida y el cuadro: sin esa espera la bienvenida parpadearía con un dibujo
guardado. Al subir uno se abre Obra: es lo que sigue.

**Quitar el dibujo vuelve a la bienvenida y conserva el enmarcado**, como en
Referencia: probar la misma moldura en otro dibujo de la serie no tiene por qué costar
armarla de nuevo. Lo que se guarda es el dibujo de ejemplo, que es la obra "vacía".

**Los campos van a 16 px** y el `viewport` de `marco/index.html` lleva
`viewport-fit=cover` —la pared ocupa la pantalla entera y los controles se corren con
`env(safe-area-inset-*)`— e `interactive-widget=resizes-content`, para que en Android
el teclado achique la app en vez de tapar el campo.

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

**Referencia usa el sistema de diseño y el archivo de textos, y Mesa de luz y
Enmarcado también** (en el escritorio de Enmarcado, el vidrio oscuro y el naranja del
activo son propios de su capa). No hay un hexadecimal ni un tamaño de letra sueltos en `referencia/styles.css`, y
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

**La columna de escritorio tiene su propia escala.** El diseño está medido para un dedo
(48 px de alto, letras de 16 a 18) y con un mouse sobra. En `.panel` se redefinen los
tokens de tamaño (`--ds-text-*`, `--ds-control-*`, `--ds-icon`) y todo lo que cuelga de
ellos se achica de una vez, sin tocar componentes; el celular y la barra de abajo no
pasan por ahí porque `.panel` no existe en ellos. Tres cosas más viven ahí: los
títulos de sección (Foto, Grilla, Ajustes) no se dibujan —los dividers alcanzan, y la fila
cerrada de cada picker ya lleva su nombre— pero siguen en el documento para el lector de
pantalla (`ds-sr`); el encabezado centrado de las tarjetas abiertas tampoco se dibuja; y
"Cambiar foto" y quitar se apoyan sobre la miniatura y aparecen al pasar. Esto último
solo con `(hover: hover) and (pointer: fine)`, no con el ancho: un iPad acostado pasa de
720 px, recibe la columna, y un botón que solo existe con hover no se alcanza con el dedo.

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
en un trípode. Con un puntero que pasa por encima y fino (`isDesktop` / `useDesktop`, en
`shared/desktop.ts`: `(hover: hover) and (pointer: fine)`) la mesa no arranca: `App` muestra
`DesktopNotice` —la pantalla de inicio de siempre, con un QR a la dirección publicada— y
ni se llega a pedir la cámara, aunque haya una foto guardada. Es la misma pregunta del
puntero que en Enmarcado y no el ancho: una ventana angosta de escritorio sigue siendo
una compu, y un iPad no lo es. El QR (`shared/qr.ts`) es un generador propio, sin
librerías: modo bytes, corrección M, versiones 1 a 6. Apunta a `copy.mesa.siteUrl` y no
a la dirección actual porque el celular no ve el `localhost` de la compu. La portada
avisa en la tarjeta ("Es para usar desde el celu") solo con mouse, y en Referencia el
botón "Llevar a la mesa de luz" no aparece en una compu.

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
