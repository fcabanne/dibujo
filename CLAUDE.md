# dibujo

Herramientas de dibujo para uso propio de Facu, dibujante tradicional. Hoy hay una
—el probador de enmarcado— y la idea es que crezca a varias (grilla sobre foto para
usar de referencia, realce de bordes). Todas viven en este repo y se publican juntas
en GitHub Pages.

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
src/
  portada/      estilos de la portada
  shared/       lo que usan todas las herramientas
  marco/        el probador de enmarcado
```

**Para sumar una herramienta:** crear `<nombre>/index.html`, su carpeta en `src/`, y
agregarla a la lista de `scripts/build.mjs` y a la portada.

## Comandos

```bash
npm run dev          # servidor local en http://localhost:5173
npm run build        # compila el sitio entero a dist/
npm run build:app    # además deja cuadros.html suelto, para mandar por mail
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
  entra en el almacenamiento del navegador.
- `src/shared/imageStore.ts` — guarda la imagen en IndexedDB, **aparte** de la
  configuración. Van separadas porque cuando iban juntas en localStorage una foto
  pesada reventaba la cuota y se perdía la sesión entera en silencio.
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
