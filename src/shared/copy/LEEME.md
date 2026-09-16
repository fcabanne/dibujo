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
"divisionsValue": "{n} × {n} · {total} casillas"
```

Moverlas es justamente el punto: en otro idioma el orden de las partes de una frase
cambia, y por eso las frases están enteras y no armadas a pedazos en el código.

## Cómo probar otro idioma

Agregale `?lang=en` a la dirección:

```
http://localhost:5173/referencia/?lang=en
```

**El `?lang=` no se guarda**: es una mirada, no una decisión. Al sacarlo de la
dirección todo vuelve a como estaba, así que mandarle este link a alguien no le deja
el idioma cambiado.

Para cambiarlo de verdad está el selector abajo del botón de subir foto, y también en
la pestaña Foto. Dice el nombre del **otro** idioma, no el actual: si la app se abrió
en uno que no entendés, lo que tenés que poder leer es a dónde vas.

Sin `?lang=` ni nada elegido, el orden es: lo que se eligió antes → el idioma del
sistema → castellano.

## Cómo sumar un idioma

1. Copiar `es.json` a `pt.json` y traducir los valores (las llaves no se tocan).
2. Cambiar `"locale"` por el de ese idioma — `"pt-BR"`. **Los números también son
   idioma**: de ahí sale si el decimal se escribe con coma o con punto.
3. En `index.ts`, importarlo y sumarlo a `LOCALES`. Son dos líneas.

## La red de seguridad

El tipo de los textos sale del castellano. Los demás idiomas se declaran con ese
tipo, así que **si a una traducción le falta una clave, el proyecto no compila**. Lo
mismo si alguien escribe mal una clave en un componente.

No hace falta ninguna librería para eso: lo hace TypeScript solo.

## Lo que todavía no pasa por acá

Referencia sí, entera. **Cuadros, Mesa de luz y la portada todavía no**: sus textos
siguen escritos adentro de sus componentes. Cuando les toque, se suman con sus
propias secciones a estos mismos archivos.
