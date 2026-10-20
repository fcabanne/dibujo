import { LANGUAGES, copy, language, setLanguage } from './copy'

/**
 * Pasar al otro idioma. Un link y no un menú: hay dos idiomas, y el botón dice a
 * cuál se pasa, con el nombre que ese idioma se da a sí mismo ("English", "Castellano"),
 * que es lo que lee quien no entiende el que tiene delante.
 *
 * Elegir recarga la página en el otro idioma y lo recuerda para todo el sitio
 * (`setLanguage`). Vive en la pantalla de inicio de cada herramienta, junto a volver y a
 * "Dejame sugerencias"; la portada tiene el suyo, con aviso.
 */
export function LanguageSwitch() {
  const other = LANGUAGES.find((id) => id !== language) ?? language
  return (
    <button
      type="button"
      className="ds-link"
      lang={other}
      onClick={() => setLanguage(other)}
    >
      {copy.lang[other as keyof typeof copy.lang]}
    </button>
  )
}
