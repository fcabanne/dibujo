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

/**
 * El idioma no se elige: se deduce del navegador y listo.
 *
 * No hay selector, y es a propósito. Nadie que abre una herramienta de dibujo
 * quiere que lo primero que le pregunten sea en qué idioma. El navegador ya
 * sabe la respuesta —el sistema operativo se la dio— y preguntar de nuevo es
 * pedirle al usuario que resuelva algo que el programa puede resolver solo.
 *
 * Se mira la **lista** de idiomas preferidos y no solo el primero: alguien con
 * el teléfono en inglés pero con castellano segundo va a preferir leer esto en
 * castellano antes que en un tercer idioma que no tenemos. Se toma el primero
 * de su lista que sepamos hablar.
 *
 * El `?lang=` es para revisar una traducción, no una preferencia: vale para
 * esa visita y no se guarda en ningún lado. Sacarlo de la dirección devuelve
 * todo a como estaba.
 */
function resolveLanguage(): string {
  const requested = new URLSearchParams(window.location.search).get('lang')
  if (requested && requested in LOCALES) return requested

  const preferred = window.navigator.languages?.length
    ? window.navigator.languages
    : [window.navigator.language]

  for (const tag of preferred) {
    const code = tag?.slice(0, 2)
    if (code && code in LOCALES) return code
  }

  return 'es'
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
