import { resolve } from 'node:path'
import { build } from 'vite'

/**
 * Compila cada página por separado.
 *
 * No es capricho: el plugin que incrusta todo en un solo .html activa
 * `inlineDynamicImports`, y rollup rechaza esa opción cuando hay más de una
 * entrada. Compilando de a una, cada página conserva la propiedad que nos importa
 * —ser un archivo autocontenido que se abre con doble clic— y el sitio completo
 * sigue saliendo en una sola corrida.
 *
 * Para sumar una herramienta: crear su `<nombre>/index.html` y agregarla acá.
 */
const PAGES = ['index.html', 'marco/index.html', 'referencia/index.html', 'mesa/index.html']

const root = process.cwd()

for (const [i, page] of PAGES.entries()) {
  await build({
    build: {
      // Solo la primera limpia: las siguientes se suman al mismo dist.
      emptyOutDir: i === 0,
      rollupOptions: { input: resolve(root, page) },
    },
  })
}
