import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

/**
 * Los textos de los .html, sacados del archivo de textos.
 *
 * Una página escribe `<h2 data-t="portada.title"></h2>` y acá se rellena con el
 * castellano al compilar: así el texto no está escrito en el HTML (vive en
 * `src/shared/copy/es.json`, como todos) y la página sigue diciendo algo sin
 * JavaScript. En el navegador, `translateDocument` (en `copy/index.ts`) hace la
 * misma cuenta con el idioma elegido.
 *
 * - `data-t="clave"` — el contenido del elemento.
 * - `data-t-aria-label="clave"` (también `alt` y `title`) — ese atributo.
 * - `data-t-vars='{"n":1}'` — los valores de las llaves `{n}` de la frase.
 */
const ATTRS = ['aria-label', 'alt', 'title']

export function htmlCopy() {
  const es = JSON.parse(readFileSync(resolve(process.cwd(), 'src/shared/copy/es.json'), 'utf8'))

  const lookup = (key, vars = {}) => {
    const value = key.split('.').reduce((node, part) => node?.[part], es)
    if (typeof value !== 'string') throw new Error(`htmlCopy: no hay texto para "${key}"`)
    return value.replace(/\{(\w+)\}/g, (match, name) => (name in vars ? String(vars[name]) : match))
  }
  const escape = (text) =>
    text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
  const varsOf = (attrs) => {
    const raw = /data-t-vars='([^']*)'/.exec(attrs)
    return raw ? JSON.parse(raw[1]) : {}
  }

  return {
    name: 'html-copy',
    transformIndexHtml: {
      order: 'pre',
      handler(html) {
        return html.replace(/<(\w+)((?:\s[^<>]*?)?)>/g, (tag, name, attrs) => {
          let extra = ''
          for (const attr of ATTRS) {
            const found = new RegExp(`\\sdata-t-${attr}="([^"]+)"`).exec(attrs)
            if (found) extra += ` ${attr}="${escape(lookup(found[1], varsOf(attrs)))}"`
          }
          return extra ? `<${name}${attrs}${extra}>` : tag
        }).replace(/<(\w+)((?:\s[^<>]*?)?)\sdata-t="([^"]+)"([^<>]*)><\/\1>/g, (_, name, before, key, after) => {
          const text = escape(lookup(key, varsOf(before + after)))
          return `<${name}${before} data-t="${key}"${after}>${text}</${name}>`
        })
      },
    },
  }
}
