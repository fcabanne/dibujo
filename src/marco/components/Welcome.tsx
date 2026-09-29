import { useCallback, useRef, useState, type ChangeEvent } from 'react'
import { copy } from '../../shared/copy'
import { loadArtworkFile } from '../../shared/imageFile'
import { openInstagram } from '../../shared/suggestions'
import { BackIcon, Button, IconButton, UploadIcon } from '../../shared/ui'

interface Props {
  onArtwork: (src: string, aspect: number) => void
}

/**
 * Lo primero que se ve sin un dibujo cargado, en el celular y en el escritorio: la
 * misma pantalla de inicio de Referencia y de la mesa de luz —el saludo, qué es esto,
 * qué hacer y el botón— y abajo volver y "Dejame sugerencias".
 *
 * Reemplaza al dibujo de ejemplo. Hacía creer que ya había algo cargado y que el
 * trabajo era cambiarlo; esta pantalla dice qué hacer, y la herramienta arranca con el
 * dibujo propio adentro del marco. En el escritorio además se puede soltar el archivo
 * encima, como sobre el lienzo.
 */
export function Welcome({ onArtwork }: Props) {
  const fileRef = useRef<HTMLInputElement>(null)
  const [note, setNote] = useState<string | null>(null)

  const load = useCallback(
    async (file: File | undefined) => {
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

  const onFile = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0]
      event.target.value = ''
      void load(file)
    },
    [load],
  )

  return (
    <div
      className="m-welcome-screen"
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => {
        e.preventDefault()
        void load(e.dataTransfer.files[0])
      }}
    >
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
