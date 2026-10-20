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

/** Dónde queda guardada la elección. Una clave para todo el sitio: las herramientas viven en el mismo origen. */
const STORAGE_KEY = 'dibujo:lang'

/** Los idiomas que hay, en el orden en que se ofrecen. */
export const LANGUAGES = Object.keys(LOCALES)

function storedLanguage(): string | null {
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY)
    return stored && stored in LOCALES ? stored : null
  } catch {
    // Modo privado o datos bloqueados: sin elección guardada, y no pasa nada.
    return null
  }
}

/**
 * Qué idioma se muestra, en este orden:
 *
 * 1. `?lang=` — una mirada de esa visita, no se guarda (ver `LEEME.md`).
 * 2. Lo que la persona eligió con el selector.
 * 3. Castellano.
 *
 * **El navegador no entra a la cuenta.** Hubo dos intentos de deducirlo de
 * `navigator.languages` y los dos le mostraron inglés a un usuario argentino: esa
 * lista dice cómo está configurado el sistema operativo, no qué querés leer. Quien
 * no tiene el castellano a mano se entera por el aviso de la portada, que no
 * depende de ninguna detección.
 */
function resolveLanguage(): string {
  const requested = new URLSearchParams(window.location.search).get('lang')
  if (requested && requested in LOCALES) return requested
  return storedLanguage() ?? DEFAULT_LANGUAGE
}

export const language = resolveLanguage()

/** Los textos del idioma elegido. Se usa directo: `copy.grid.title`. */
export const copy: Copy = LOCALES[language]

/** ¿Ya eligió idioma alguna vez? Mientras no, la portada ofrece el cambio. */
export const hasChosenLanguage = storedLanguage() !== null

// Para el lector de pantalla y el traductor del navegador: la página dice en qué idioma está.
document.documentElement.lang = language

/**
 * Elige un idioma y lo recuerda. Recarga la página: los textos se leen una vez al
 * cargar (`copy` es una constante), y recargar es la forma de que todo —el DOM, los
 * títulos, los nombres de las muestras— salga del mismo idioma sin tener que
 * repintar cada componente.
 *
 * Saca el `?lang=` de la dirección: si no, esa mirada le ganaría a la elección.
 */
export function setLanguage(next: string): void {
  if (!(next in LOCALES)) return
  try {
    window.localStorage.setItem(STORAGE_KEY, next)
  } catch {
    // Sin dónde guardar, vale solo esta visita (por `?lang=`).
    const url = new URL(window.location.href)
    url.searchParams.set('lang', next)
    window.location.replace(url)
    return
  }
  const url = new URL(window.location.href)
  url.searchParams.delete('lang')
  window.location.replace(url)
}

/** Deja asentado que ya se eligió (o se descartó el aviso) sin cambiar de idioma. */
export function keepLanguage(): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, language)
  } catch {
    // Sin dónde guardar, el aviso vuelve la próxima vez. Es lo menos malo.
  }
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

/** Un texto por su camino (`'portada.title'`), para lo que no es un componente: el HTML. */
function lookup(path: string): string | undefined {
  const value = path.split('.').reduce<unknown>((node, part) => (node as Record<string, unknown> | undefined)?.[part], copy)
  return typeof value === 'string' ? value : undefined
}

const TRANSLATED_ATTRIBUTES = ['aria-label', 'alt', 'title']

/**
 * Pone en el idioma elegido los textos que viven en el HTML (ver `scripts/htmlCopy.mjs`,
 * que hace lo mismo al compilar con el castellano):
 *
 * - `data-t="clave"` — el contenido del elemento.
 * - `data-t-aria-label="clave"` (también `alt` y `title`) — ese atributo.
 * - `data-t-vars='{"n":1}'` — los valores de las llaves `{n}` de la frase.
 */
export function translateDocument(root: ParentNode = document): void {
  const valuesOf = (el: Element): Record<string, string | number> => {
    const raw = el.getAttribute('data-t-vars')
    return raw ? JSON.parse(raw) : {}
  }
  for (const el of root.querySelectorAll('[data-t]')) {
    const text = lookup(el.getAttribute('data-t') ?? '')
    if (text !== undefined) el.textContent = fill(text, valuesOf(el))
  }
  for (const attr of TRANSLATED_ATTRIBUTES) {
    for (const el of root.querySelectorAll(`[data-t-${attr}]`)) {
      const text = lookup(el.getAttribute(`data-t-${attr}`) ?? '')
      if (text !== undefined) el.setAttribute(attr, fill(text, valuesOf(el)))
    }
  }
}

translateDocument()
