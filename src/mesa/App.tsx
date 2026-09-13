import { useCallback, useEffect, useRef, useState, type ChangeEvent } from 'react'
import { loadArtworkFile } from '../shared/imageFile'
import { loadArtwork, saveArtwork } from '../shared/imageStore'
import { loadOpacity, saveOpacity } from './persistence'
import { useCamera, type CameraStatus } from './useCamera'
import { useIdle } from './useIdle'
import { useWakeLock } from './useWakeLock'

/** Lo que tarda en irse la interfaz cuando nadie toca la pantalla. */
const IDLE_MS = 3500

/**
 * La mesa de luz: la cámara de atrás mirando el papel y la foto encima, translúcida.
 *
 * Toda la herramienta son dos controles —cargar la foto y cuánto se ve— y ninguna
 * instrucción. El permiso de cámara lo pide el navegador con su propio cartel; del
 * trípode se encarga el dibujante.
 */
export function App() {
  const video = useRef<HTMLVideoElement>(null)
  const [photo, setPhoto] = useState<string | null>(null)
  const [opacity, setOpacity] = useState(loadOpacity)
  const camera = useCamera(video)

  useWakeLock(camera.status === 'lista')
  // Sin foto no hay nada abajo de los controles que valga la pena destapar.
  const idle = useIdle(IDLE_MS, photo !== null)

  useEffect(() => {
    void loadArtwork('mesa').then((saved) => {
      if (saved) setPhoto(saved)
    })
  }, [])

  useEffect(() => {
    saveOpacity(opacity)
  }, [opacity])

  const choose = useCallback(async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    // Vaciar el input: si no, elegir dos veces la misma foto no dispara el cambio.
    event.target.value = ''
    if (!file) return
    try {
      const { src } = await loadArtworkFile(file)
      setPhoto(src)
      void saveArtwork('mesa', src)
    } catch {
      // Un archivo que no se puede abrir no rompe nada: queda la foto de antes.
    }
  }, [])

  const trouble = camera.status !== 'lista' && camera.status !== 'pidiendo'

  return (
    <div className="app" data-idle={idle || undefined}>
      {/* muted + playsInline: sin los dos, el celular se niega a arrancar solo. */}
      <video className="camera" ref={video} autoPlay muted playsInline />

      {photo && <img className="overlay" src={photo} alt="" style={{ opacity }} />}

      {trouble && <Trouble status={camera.status} onRetry={camera.retry} />}

      <div className="controls" data-empty={photo ? undefined : true}>
        <label className="load">
          <PhotoIcon />
          <span>{photo ? 'Cambiar foto' : 'Cargar foto'}</span>
          <input type="file" accept="image/*" onChange={choose} />
        </label>

        {photo && (
          <input
            className="opacity"
            type="range"
            min={0}
            max={100}
            value={Math.round(opacity * 100)}
            onChange={(event) => setOpacity(Number(event.target.value) / 100)}
            aria-label="Opacidad de la foto"
          />
        )}
      </div>
    </div>
  )
}

/**
 * Lo único que se explica en toda la herramienta, y solo cuando no hay imagen: qué
 * pasó con la cámara. Una pantalla negra sin motivo es peor que un cartel.
 */
function Trouble({ status, onRetry }: { status: CameraStatus; onRetry: () => void }) {
  if (status === 'insegura') {
    return (
      <p className="trouble">
        La cámara necesita el sitio publicado: los navegadores no la prestan a un
        archivo abierto con doble clic.
        <a href="https://fcabanne.github.io/dibujo/mesa/">Abrir la mesa de luz</a>
      </p>
    )
  }

  return (
    <p className="trouble">
      {status === 'denegada'
        ? 'La cámara está bloqueada para este sitio. Habilitala desde el candado de la barra de direcciones.'
        : 'No se encontró ninguna cámara.'}
      <button type="button" onClick={onRetry}>
        Reintentar
      </button>
    </p>
  )
}

function PhotoIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <rect x="3" y="5" width="18" height="14" rx="2.5" />
      <circle cx="8.5" cy="10" r="1.8" />
      <path d="M3.5 17.5l5-5 4 3.5 3-2.5 5 4.5" />
    </svg>
  )
}
