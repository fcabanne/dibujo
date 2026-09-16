import { language, languages, setLanguage } from '../../shared/copy'

/**
 * Cambiar de idioma.
 *
 * Se dibuja con el nombre del **otro** idioma y no con el actual: lo que hay
 * que poder leer es a dónde vas, sobre todo si estás acá justamente porque la
 * app se abrió en un idioma que no entendés. "English" se entiende aunque todo
 * lo demás esté en castellano, y al revés.
 *
 * No está en Figma. Usa el link del sistema, que sí está, para no inventar una
 * forma nueva. Cuando haya un tercer idioma esto pasa a ser una lista.
 */
export function LanguageLink() {
  const other = languages.find((option) => option.code !== language)
  if (!other) return null

  return (
    <button type="button" className="ds-link" onClick={() => setLanguage(other.code)}>
      {other.name}
    </button>
  )
}
