import { copy } from '../../shared/copy'
import { Button, CameraIcon, UploadIcon } from '../../shared/ui'

interface Props {
  onUpload: () => void
  /** Sacar la foto con la cámara. Sin él —un archivo suelto, sin cámara— no se ofrece. */
  onCamera?: () => void
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
 * El link de sugerencias no está acá: vive en `Panel`, compartiendo la fila
 * de abajo con el botón de volver.
 */
export function Welcome({ onUpload, onCamera }: Props) {
  return (
    <div className="welcome">
      <div className="welcome-text">
        <h2>{copy.welcome.greeting}</h2>
        <p>{copy.welcome.intro}</p>
      </div>

      <div className="welcome-actions">
        <Button variant="loud" icon={<UploadIcon />} onClick={onUpload}>
          {copy.welcome.upload}
        </Button>
        {onCamera && (
          <Button variant="quiet" icon={<CameraIcon />} onClick={onCamera}>
            {copy.camera.use}
          </Button>
        )}
      </div>
    </div>
  )
}
