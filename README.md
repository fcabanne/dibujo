# Dibujo

Herramientas para dibujo tradicional, hechas para uso propio. Corren enteras en el
navegador: no hay servidor, no hay cuenta, y **las imágenes que cargás no salen de
tu máquina** — se quedan en el navegador y nunca se suben a ningún lado.

**[Abrir las herramientas](https://fcabanne.github.io/dibujo/)**

## Qué hay

- **[Cuadros](https://fcabanne.github.io/dibujo/marco/)** — probá marcos,
  passe-partout y vidrios sobre tu dibujo, y salí con las medidas para encargarlo.
- **[Referencia](https://fcabanne.github.io/dibujo/referencia/)** — prepará la foto
  antes de dibujarla: le ponés una grilla (proporcional o de cuadrados exactos), le
  marcás los bordes o le aplastás los tonos para que se lea mejor, y la descargás en
  su tamaño original o en una hoja lista para imprimir.
- **[Mesa de luz](https://fcabanne.github.io/dibujo/mesa/)** — para el celular:
  apuntá la cámara al papel, poné la foto encima con la transparencia que quieras y
  calcá mirando la pantalla.

Cuadros y Referencia también se pueden bajar como un único archivo `.html` y abrirlas
con doble clic, sin internet y sin instalar nada. La mesa de luz no: los navegadores
solo le prestan la cámara a un sitio servido por https.

## Desarrollo

```bash
npm install
npm run dev          # servidor local en http://localhost:5173
npm run dev:celu     # además en https y abierto a la red local, para probar en el celular
```

```bash
npm run build        # compila el sitio entero a dist/
npm run build:app    # además deja cuadros.html y referencia.html sueltos, para mandar por mail
npm run deploy       # compila y publica en GitHub Pages
```

## Cómo está armado

Vite + React + TypeScript. En Cuadros y Referencia todo lo que se ve se dibuja
en un canvas 2D; la mesa de luz son un video y una imagen, apilados.

```
index.html      portada
marco/          probador de enmarcado
referencia/     preparador de la foto de referencia
mesa/           la mesa de luz
src/
  portada/      estilos de la portada
  shared/       lo que usan todas las herramientas
  marco/        el probador de enmarcado
  referencia/   el preparador de la foto de referencia
  mesa/         la mesa de luz
```

Las convenciones del proyecto y las trampas conocidas están en `CLAUDE.md`.
