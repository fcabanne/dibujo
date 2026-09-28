import { useCallback, useRef, useState, type ChangeEvent } from 'react'
import { copy } from '../../../shared/copy'
import { loadArtworkFile } from '../../../shared/imageFile'
import { openInstagram } from '../../../shared/suggestions'
import { BackIcon, Button, IconButton, UploadIcon } from '../../../shared/ui'

interface Props {
  onArtwork: (src: string, aspect: number) => void
}

/**
 * Lo primero que se ve en el celular sin un dibujo cargado: la misma pantalla de
 * inicio de Referencia y de la mesa de luz —el saludo, qué es esto, qué hacer y el
 * botón— y abajo volver y "Dejame sugerencias".
 *
 * Reemplaza al dibujo de ejemplo, que en el escritorio sigue estando. En el celular
 * hacía creer que ya había algo cargado y que el trabajo era cambiarlo; esta pantalla
 * dice qué hacer, y la herramienta arranca con el dibujo propio adentro del marco.
 */
export function Welcome({ onArtwork }: Props) {
  const fileRef = useRef<HTMLInputElement>(null)
  const [note, setNote] = useState<string | null>(null)

  const onFile = useCallback(
    async (event: ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0]
      event.target.value = ''
      if (!file) return
      try {
        const { src, aspect } = await loadArtworkFile(file)
        onArtwork(src, aspect)
      } catch (error) {
        setNote(error instanceof Error ? error.message : copy.marco.loadFailed)
      }
    },
    [onArtwork],
  )

  return (
    <div className="m-welcome-screen">
      <div className="m-welcome">
        <div className="m-welcome-text">
          <h2>{copy.welcome.greeting}</h2>
          <p>{copy.marco.intro}</p>
          <p>{copy.marco.hint}</p>
        </div>
        <Button variant="loud" icon={<UploadIcon />} onClick={() => fileRef.current?.click()}>
          {copy.marco.upload}
        </Button>
        {note && <p className="m-welcome-note">{note}</p>}
      </div>

      <div className="m-welcome-bottombar">
        <nav className="m-tray">
          <IconButton label={copy.app.back} onClick={() => (window.location.href = '../')}>
            <BackIcon />
          </IconButton>
        </nav>
        <a
          className="ds-link"
          href={copy.welcome.suggestionsUrl}
          onClick={(e) => openInstagram(e, copy.welcome.suggestionsUrl)}
        >
          {copy.welcome.suggestions}
        </a>
      </div>

      <h1 className="ds-sr">{copy.marco.name}</h1>
      <input ref={fileRef} type="file" accept="image/*" hidden onChange={onFile} />
    </div>
  )
}
