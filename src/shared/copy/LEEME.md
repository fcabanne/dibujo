# Los textos

Todo lo que se lee en pantalla vive acá, en archivos que se pueden editar sin tocar
código. Ningún texto visible está escrito adentro de un componente.

## Los archivos

| archivo | qué es |
|---|---|
| `es.json` | **castellano — la fuente de verdad** |
| `en.json` | inglés |
| `index.ts` | la maquinaria: elegir idioma, reemplazar valores, formatear números |

## Cómo editar un texto

Abrís `es.json`, buscás la frase y la cambiás. Nada más. Está agrupado por pantalla y
por sección, así que se lee como el producto y no como el código:

```json
"welcome": {
  "greeting": "Hola artista!",
  "upload": "Subir foto"
}
```

**Las llaves con `{nombre}` adentro son valores que pone el programa.** Se pueden
mover de lugar en la frase, pero no borrar ni renombrar:

```json
"done": "Listo: {file}"
"grid": "Grilla: {cols} × {rows} · {total} casillas"
```

Moverlas es justamente el punto: en otro idioma el orden de las partes de una frase
cambia, y por eso las frases están enteras y no armadas a pedazos en el código.

## Cómo probar otro idioma

Agregale `?lang=en` a la dirección:

```
http://localhost:5173/referencia/?lang=en
```

**El `?lang=` no se guarda**: es una mirada, no una decisión. Vale para esa visita y
al sacarlo de la dirección todo vuelve a como estaba, así que mandarle este link a
alguien no le deja el idioma cambiado.

## Qué idioma se muestra

En este orden:

1. **`?lang=`** en la dirección: una mirada de esa visita, no se guarda.
2. **Lo que la persona eligió** con el selector, guardado para todo el sitio
   (`localStorage`, clave `dibujo:lang`; las cuatro páginas comparten origen).
3. **Castellano.**

**El navegador no entra a la cuenta.** Hubo dos intentos de deducir el idioma de
`navigator.languages` y los dos terminaron mostrándole inglés a un usuario argentino: esa
lista dice cómo está configurado el sistema operativo, no qué querés leer. Por eso
quien no tiene el castellano a mano se entera con **un aviso bilingüe fijo** en la
portada ("Ver en castellano · View in English"), que no depende de ninguna detección: se
muestra hasta que se elige un idioma o se lo cierra, y después no vuelve.

**Dónde se elige:** solo en la portada: el selector (`ES | EN`, arriba a la derecha) y el
aviso. Las herramientas no tienen selector: leen lo que se eligió ahí.

**Cambiar de idioma recarga la página** (`setLanguage`): los textos se leen una vez al
cargar y `copy` es una constante, así que recargar es lo que hace que todo salga del
mismo idioma. Las herramientas guardan su sesión, así que no se pierde nada.

## Los textos de los .html

Las páginas no tienen texto escrito: lo marcan y sale de acá.

```html
<h2 data-t="app.name"></h2>
<a data-t-aria-label="portada.scroll" href="#referencia">…</a>
<p data-t="portada.counter" data-t-vars='{"n":1,"total":3}'></p>
```

- `data-t="clave"` — el contenido del elemento.
- `data-t-aria-label="clave"` (también `alt` y `title`) — ese atributo.
- `data-t-vars` — los valores de las llaves `{n}`.

Al compilar, `scripts/htmlCopy.mjs` los rellena con el castellano (así la página dice algo
sin JavaScript); en el navegador, `translateDocument` los pone en el idioma elegido.

## Sumar un idioma

1. Copiar `es.json` a `<id>.json` y traducirlo. Si falta una clave, no compila.
2. Registrarlo en `LOCALES` de `index.ts` y sumar su nombre (`lang.<id>`) en todos los archivos.
3. El selector de la portada (`.idioma` en `index.html`) lleva un botón por idioma: sumar el suyo
   (`lang.short<Id>` para el texto corto, `lang.<id>` para el nombre completo).

## Qué no está acá

Los mensajes de desarrollador que nadie lee en pantalla (`console.warn`, el `throw` de un
shader que no compila, "Falta el nodo #root") se quedan en el código: no se traducen.
