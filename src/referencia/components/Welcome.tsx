import { copy } from '../../shared/copy'
import { Button, UploadIcon } from '../../shared/ui'

interface Props {
  onUpload: () => void
}

/**
 * Lo primero que se ve cuando no hay ninguna foto cargada. Figma: 18:76.
 *
 * Reemplaza al dibujo de ejemplo que abría la herramienta antes. El ejemplo
 * invitaba a mover las perillas, pero también hacía creer que ya había una
 * foto puesta; esta pantalla dice qué es esto y qué hacer, que en una
 * herramienta que alguien abre por primera vez vale más.
 *
 * Los dos párrafos están separados en el archivo de textos y no partidos por
 * un salto de línea: en otro idioma puede que no se corten en el mismo lugar.
 *
 * El link va abajo de todo y no pegado al botón, como en el diseño (22:78).
 * Es de otra conversación: el botón es lo que hay que hacer ahora, el link es
 * para después, y lejos no compite.
 */
export function Welcome({ onUpload }: Props) {
  return (
    <>
      <div className="welcome">
        <div className="welcome-text">
          <h2>{copy.welcome.greeting}</h2>
          <p>{copy.welcome.intro}</p>
          <p>{copy.welcome.hint}</p>
        </div>

        <Button variant="loud" icon={<UploadIcon />} onClick={onUpload}>
          {copy.welcome.upload}
        </Button>
      </div>

      <a
        className="ds-link welcome-link"
        href={copy.welcome.suggestionsUrl}
        target="_blank"
        rel="noreferrer"
      >
        {copy.welcome.suggestions}
      </a>
    </>
  )
}
