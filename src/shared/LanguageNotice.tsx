import { useState } from 'react'
import { copy, hasChosenLanguage, keepLanguage, language, setLanguage } from './copy'
import './languageNotice.css'

/**
 * El aviso de idioma, para quien entra directo al link de una herramienta sin pasar por
 * la portada. Es el mismo de la portada: **bilingüe fijo** ("Ver en castellano · View in
 * English"), sin deducir nada del navegador, y se muestra hasta que se elige un idioma
 * —en cualquier página del sitio— o se lo cierra. Elegir el que ya está puesto, o cerrar,
 * solo deja asentado que ya se eligió.
 *
 * Es solo el aviso: las herramientas no tienen selector propio.
 */
export function LanguageNotice() {
  const [open, setOpen] = useState(!hasChosenLanguage)
  if (!open) return null

  const keep = () => {
    keepLanguage()
    setOpen(false)
  }
  const choose = (id: string) => (id === language ? keep() : setLanguage(id))

  return (
    <div className="lang-notice" role="region" aria-label={copy.lang.label}>
      <button type="button" lang="es" onClick={() => choose('es')}>
        {copy.lang.inviteEs}
      </button>
      <span aria-hidden="true">&middot;</span>
      <button type="button" lang="en" onClick={() => choose('en')}>
        {copy.lang.inviteEn}
      </button>
      <button type="button" className="lang-notice-close" aria-label={copy.lang.dismiss} onClick={keep}>
        &times;
      </button>
    </div>
  )
}
