# Cuadros

Probador de enmarcado para dibujo tradicional. Cargás tu dibujo, probás marcos,
passe-partout, vidrios y colores de pared, y te llevás las medidas exactas para
encargar el cuadro.

Corre entero en el navegador. No hay servidor, no hay cuenta, y **las imágenes que
cargás no salen de tu máquina**: se quedan en el navegador y nunca se suben a ningún
lado.

## Usarlo

Online, la última versión: **[abrir la app](https://fcabanne.github.io/dibujo/)**

También se puede bajar como un único archivo `.html` y abrirlo con doble clic, sin
internet y sin instalar nada.

## Desarrollo

```bash
npm install
npm run dev          # servidor local en http://localhost:5173
```

```bash
npm run build:app    # genera cuadros.html, la app entera en un solo archivo
npm run deploy       # compila y publica en GitHub Pages
```

## Cómo está armado

Vite + React + TypeScript, y todo el cuadro se dibuja en un canvas 2D.

- `src/domain/` — la geometría en centímetros y las medidas que se le dictan al
  enmarcador. Es la única fuente de verdad dimensional: el render multiplica por
  una escala recién al final.
- `src/render/` — las capas de la escena, de la pared hacia el espectador. La luz
  viaja como dato entre todas para que el conjunto lea como un objeto.
- `src/interaction/` — qué parte del cuadro está bajo el puntero.
- `src/components/` — el lienzo y la capa de controles que se apoya encima.
