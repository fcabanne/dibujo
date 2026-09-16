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

const STORAGE_KEY = 'dibujo:idioma'

/**
 * Qué idioma mostrar, en orden: lo que diga la URL (`?lang=en`), lo que se
 * eligió antes, el idioma del sistema, y castellano.
 *
 * **El `?lang=` no se guarda.** Es una mirada, no una decisión: sirve para
 * revisar una traducción sin cambiar la configuración de nadie, y al sacarlo
 * de la URL todo vuelve a como estaba. Guardarlo fue un error — alcanzaba con
 * mandar un link de prueba para dejarle el idioma cambiado a alguien, sin
 * forma de volver. Lo único que se guarda es lo que se elige a propósito, con
 * `setLanguage`.
 */
function resolveLanguage(): string {
  const requested = new URLSearchParams(window.location.search).get('lang')
  if (requested && requested in LOCALES) return requested

  try {
    const saved = window.localStorage.getItem(STORAGE_KEY)
    if (saved && saved in LOCALES) return saved
  } catch {
    // Modo privado: se usa igual, solo que no se recuerda.
  }

  const system = window.navigator.language?.slice(0, 2)
  return system && system in LOCALES ? system : 'es'
}

/**
 * Cambiar de idioma a propósito. Recarga, porque los textos se resuelven una
 * sola vez al arrancar; recargar para cambiar de idioma es lo normal y cuesta
 * menos que hacer que cada texto de la app sea reactivo.
 *
 * Se va con el `?lang=` sacado de la URL: si quedara puesto, le ganaría a lo
 * que se acaba de elegir.
 */
export function setLanguage(code: string): void {
  if (!(code in LOCALES)) return
  try {
    window.localStorage.setItem(STORAGE_KEY, code)
  } catch {
    // Sin dónde guardarlo, el cambio vale para esta visita.
  }
  const url = new URL(window.location.href)
  url.searchParams.delete('lang')
  window.location.replace(url.toString())
}

export const language = resolveLanguage()

/** Los textos del idioma elegido. Se usa directo: `copy.grid.title`. */
export const copy: Copy = LOCALES[language]

/** Los idiomas que existen, para ofrecerlos en algún lado más adelante. */
export const languages = Object.keys(LOCALES).map((code) => ({
  code,
  name: LOCALES[code].language,
}))

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
