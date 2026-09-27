import { useCallback, useEffect, useRef, useState, type ChangeEvent } from 'react'
import { copy, fill } from '../shared/copy'
import { loadArtworkFile } from '../shared/imageFile'
import { loadArtwork, saveArtwork } from '../shared/imageStore'
import {
  BackIcon,
  Button,
  CornersIcon,
  IconButton,
  PhotoIcon,
  Slider,
  UploadIcon,
} from '../shared/ui'
import type { Quad } from './corners'
import { Overlay } from './Overlay'
import { loadSession, saveSession } from './persistence'
import { useCamera, type CameraStatus } from './useCamera'
import { useIdle } from './useIdle'
import { useStageSize } from './useStageSize'
import { useWakeLock } from './useWakeLock'

/** Lo que tarda en irse la interfaz cuando nadie toca la pantalla. */
const IDLE_MS = 3500

/**
 * La mesa de luz: la cámara de atrás mirando el papel y la foto encima, translúcida.
 *
 * Abajo, una sola píldora con lo que se toca: cambiar la foto, cuánto se ve, y
 * ajustar dónde cae. Arriba, volver. El permiso de cámara lo pide el navegador con
 * su propio cartel; del trípode se encarga el dibujante.
 */
export function App() {
  const app = useRef<HTMLDivElement>(null)
  const video = useRef<HTMLVideoElement>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const [photo, setPhoto] = useState<string | null>(null)
  /** Lo mismo que en Referencia: sin esperar a IndexedDB parpadea el inicio. */
  const [ready, setReady] = useState(false)
  const [session, setSession] = useState(loadSession)
  const [adjusting, setAdjusting] = useState(false)
  const camera = useCamera(video)
  const stage = useStageSize(app)

  useWakeLock(camera.status === 'lista')
  // Sin foto no hay nada abajo de los controles que valga la pena destapar. Y
  // ajustando, que se vayan sería sacarle las manijas de abajo del dedo.
  const idle = useIdle(IDLE_MS, photo !== null && !adjusting)

  useEffect(() => {
    let cancelled = false
    void loadArtwork('mesa').then((saved) => {
      if (cancelled) return
      if (saved) setPhoto(saved)
      setReady(true)
    })
    return () => {
      cancelled = true
    }
  }, [])

  // Con respiro: arrastrar una esquina dispara cambios a sesenta por segundo.
  useEffect(() => {
    const id = window.setTimeout(() => saveSession(session), 300)
    return () => window.clearTimeout(id)
  }, [session])

  const choose = useCallback(async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    // Vaciar el input: si no, elegir dos veces la misma foto no dispara el cambio.
    event.target.value = ''
    if (!file) return
    try {
      const { src } = await loadArtworkFile(file)
      setPhoto(src)
      // Otra foto trae otra proporción: las esquinas de la anterior la deformarían.
      setSession((s) => ({ ...s, corners: null }))
      setAdjusting(false)
      void saveArtwork('mesa', src)
    } catch {
      // Un archivo que no se puede abrir no rompe nada: queda la foto de antes.
    }
  }, [])

  const pickFile = useCallback(() => fileRef.current?.click(), [])
  const setCorners = useCallback((corners: Quad | null) => {
    setSession((s) => ({ ...s, corners }))
  }, [])

  const trouble = camera.status !== 'lista' && camera.status !== 'pidiendo'

  return (
    <div
      ref={app}
      className="app ds"
      data-idle={idle || undefined}
      data-adjusting={adjusting || undefined}
    >
      {/* muted + playsInline: sin los dos, el celular se niega a arrancar solo. */}
      <video className="camera" ref={video} autoPlay muted playsInline />

      {photo && stage && (
        <Overlay
          src={photo}
          opacity={session.opacity}
          corners={session.corners}
          stage={stage}
          adjusting={adjusting}
          onChange={setCorners}
        />
      )}

      <header className="topbar">
        <span className="chip">
          <IconButton label={copy.app.back} onClick={() => (window.location.href = '../')}>
            <BackIcon />
          </IconButton>
        </span>
        <h1 className="ds-sr">{copy.mesa.name}</h1>
        {/* Lo único que se explica, y solo mientras hace falta. Va arriba y no con
            los botones de abajo: ahí taparía las esquinas de abajo de la foto. */}
        {adjusting && <p className="card hint">{copy.mesa.cornersHint}</p>}
      </header>

      {trouble ? (
        <Trouble status={camera.status} onRetry={camera.retry} />
      ) : (
        ready &&
        !photo && (
          <div className="card welcome">
            <h2>{copy.mesa.name}</h2>
            <p>{copy.mesa.intro}</p>
            <Button variant="loud" icon={<UploadIcon />} onClick={pickFile}>
              {copy.mesa.upload}
            </Button>
          </div>
        )
      )}

      {photo && (
        <div className="controls">
          {/* Ajustando, arriba de la píldora: volver a empezar y terminar. */}
          {adjusting && (
            <div className="card adjust">
              <Button
                variant="quiet"
                onClick={() => setCorners(null)}
                disabled={session.corners === null}
              >
                {copy.mesa.reset}
              </Button>
              <Button variant="loud" onClick={() => setAdjusting(false)}>
                {copy.mesa.done}
              </Button>
            </div>
          )}

          <nav className="dock">
            <IconButton label={copy.mesa.change} onClick={pickFile}>
              <PhotoIcon />
            </IconButton>
            <Slider
              label={copy.mesa.opacity}
              value={Math.round(session.opacity * 100)}
              min={0}
              max={100}
              step={1}
              onChange={(v) => setSession((s) => ({ ...s, opacity: v / 100 }))}
              format={(v) => fill(copy.mesa.opacityValue, { n: v })}
            />
            <IconButton
              label={copy.mesa.corners}
              selected={adjusting}
              onClick={() => setAdjusting((on) => !on)}
            >
              <CornersIcon />
            </IconButton>
          </nav>
        </div>
      )}

      {/* Uno solo: lo usan la bienvenida y el botón de cambiar foto. */}
      <input ref={fileRef} type="file" accept="image/*" hidden onChange={choose} />
    </div>
  )
}

/**
 * Lo único que se explica sin que nadie lo pida, y solo cuando no hay imagen: qué
 * pasó con la cámara. Una pantalla negra sin motivo es peor que un cartel.
 */
function Trouble({ status, onRetry }: { status: CameraStatus; onRetry: () => void }) {
  if (status === 'insegura') {
    return (
      <div className="card trouble">
        <p>{copy.mesa.insecure}</p>
        <a className="ds-button ds-button--quiet" href={copy.mesa.siteUrl}>
          {copy.mesa.openSite}
        </a>
      </div>
    )
  }

  return (
    <div className="card trouble">
      <p>{status === 'denegada' ? copy.mesa.denied : copy.mesa.noCamera}</p>
      <Button variant="quiet" onClick={onRetry}>
        {copy.mesa.retry}
      </Button>
    </div>
  )
}
