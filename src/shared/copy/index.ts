import es from './es.json'
import enJson from './en.json'

/**
 * La forma de los textos sale del castellano, que es el idioma en el que se
 * escribe primero. Todo lo demás se declara con este tipo.
 */
export type Copy = typeof es

/**
 * Acá está la verificación que hace que esto no se pudra: si al inglés le
 * falta una clave, **no compila**. Y si un componente pide una clave que no
 * existe, tampoco. No hace falta ninguna dependencia para eso.
 */
const en: Copy = enJson

const LOCALES: Record<string, Copy> = { es, en }

/** El idioma del sitio. Todo se escribe primero acá. */
const DEFAULT_LANGUAGE = 'es'

/**
 * Esto está en castellano. Punto.
 *
 * Hubo dos intentos de deducirlo del navegador y los dos dieron inglés a un
 * usuario argentino, porque `navigator.languages` no dice dónde estás ni qué
 * querés leer: dice cómo está configurado el sistema operativo. Un teléfono en
 * inglés no significa que su dueño prefiera leer esto en inglés — este sitio es
 * de un dibujante argentino y su idioma es el castellano.
 *
 * Elegir idioma automáticamente es un problema que tiene buenas soluciones, y
 * ninguna es mirar una lista y creerle. Cuando se encare de verdad —con algo
 * que se pueda elegir y que quede elegido, dibujado en Figma— se hace bien.
 * Hasta entonces, una constante que no puede equivocarse.
 *
 * La traducción al inglés no se tira: está completa y se revisa con `?lang=en`.
 * Lo que no hace es aparecer sola.
 */
function resolveLanguage(): string {
  const requested = new URLSearchParams(window.location.search).get('lang')
  if (requested && requested in LOCALES) return requested
  return DEFAULT_LANGUAGE
}

export const language = resolveLanguage()

/** Los textos del idioma elegido. Se usa directo: `copy.grid.title`. */
export const copy: Copy = LOCALES[language]

// Durante un día el idioma se guardó acá. Fue un error —alcanzaba con abrir un
// link con `?lang=` para quedarse con ese idioma puesto, sin forma de volver— y
// esta línea limpia lo que aquella versión dejó escrito. Borrable cuando ya no
// queden navegadores con la clave.
try {
  window.localStorage.removeItem('dibujo:idioma')
} catch {
  // Modo privado: no había nada que limpiar.
}

/**
 * Reemplaza `{nombre}` por su valor.
 *
 *     fill(copy.grid.proportionalValue, { n: 8, total: 64 })
 *
 * Se resuelve con una pasada de reemplazo y no concatenando en el
 * componente, porque el orden de las partes de una frase cambia de un
 * idioma a otro y concatenar lo clava en el orden del castellano.
 */
export function fill(template: string, values: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (match, key: string) =>
    key in values ? String(values[key]) : match,
  )
}

/**
 * Los números también son idioma: en castellano el separador decimal es la
 * coma y en inglés el punto. El formato sale del archivo de textos, así que
 * sumar un idioma trae su forma de escribir números sin tocar código.
 */
export function formatNumber(value: number, options?: Intl.NumberFormatOptions): string {
  return value.toLocaleString(copy.locale, options)
}

/** Un número con como mucho un decimal. Es el que usan las medidas en cm. */
export function formatDecimal(value: number): string {
  return formatNumber(value, { maximumFractionDigits: 1 })
}
